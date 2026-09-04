/**
 * @file lib/permissoes.ts
 *
 * Biblioteca centralizada de permissões e visibilidade do sistema MegaG PMO.
 *
 * TODAS as regras de "quem pode ver/editar o quê" vivem aqui.
 * Nenhum módulo pode duplicar lógica de EXISTS de participação ou checagem de perfil.
 *
 * Hierarquia de perfis:
 *   ADMIN(100) > PMO(80) > CEO(70) > DIRETOR(60) > GESTOR(40) > SOLICITANTE(20)
 *
 * @usedBy lib/projetos.ts — buscarProjetos()
 * @usedBy app/api/* — checagem de autorização
 * @usedBy lib/meu-trabalho.ts — tarefas e pendências do usuário
 */

import getDb from './db'
import type { Projeto } from '@/types'
import { UsuariosRepository, CronogramaRepository } from '@/lib/repositories'

// ─── Hierarquia de Perfis ─────────────────────────────────────────────────────

const NIVEL_PERFIL: Record<string, number> = {
  ADMIN:      100,
  PMO:         80,
  CEO:         70,
  DIRETOR:     60,
  GESTOR:      40,
  SOLICITANTE: 20,
}

/**
 * Verifica se um perfil tem nível maior ou igual ao mínimo requerido.
 * @example temNivelMinimo('PMO', 70) // false — PMO(80) não é CEO(70)... true na verdade
 */
export function temNivelMinimo(perfil: string, nivelMinimo: number): boolean {
  return (NIVEL_PERFIL[perfil] ?? 0) >= nivelMinimo
}

// ─── Visibilidade de Projetos ─────────────────────────────────────────────────

/**
 * Retorna o fragmento SQL WHERE e os parâmetros para filtrar projetos visíveis
 * para um usuário, com base em seu perfil e participações.
 *
 * Regras por perfil:
 * - ADMIN / PMO / CEO  → todos os projetos
 * - DIRETOR            → projetos da sua diretoria
 * - GESTOR             → próprios + participante de cronograma ou workflow
 * - SOLICITANTE        → solicitante/criador + participante de cronograma ou workflow
 *
 * A cláusula de participação cobre:
 *   - responsável_id ou executor_id em cronograma_tarefas
 *   - usuario_id em workflow_etapas
 *
 * @param usuario - Dados básicos do usuário autenticado
 * @returns Fragmento WHERE e parâmetros prontos para uso em prepared statements
 */
export async function getProjetoVisibility(usuario: {
  id: number
  perfil: string
}): Promise<{ where: string; params: Record<string, unknown> }> {
  const nivel = NIVEL_PERFIL[usuario.perfil] ?? 0

  // ADMIN, PMO, CEO — visibilidade total
  if (nivel >= 70) {
    return { where: '1=1', params: {} }
  }

  // DIRETOR — projetos das diretorias onde é diretor_responsavel_id
  if (usuario.perfil === 'DIRETOR') {
    return {
      where: 'p.diretoria_id IN (SELECT id FROM diretorias WHERE diretor_responsavel_id = @uid AND ativo = 1)',
      params: { uid: usuario.id },
    }
  }

  // cronograma_tarefas/cronogramas já estão em Postgres — não dá pra fazer o EXISTS
  // original em SQL puro contra projetos (SQLite). Resolve antes, no Postgres, em
  // quais projetos o usuário participa via cronograma (responsável/executor de
  // alguma tarefa), e inclui como lista de ids literal no WHERE — a participação
  // via workflow (SQLite) continua via EXISTS normal.
  const projetoIdsCronograma = await CronogramaRepository.findProjetoIdsParticipante(usuario.id)
  const cronogramaParams: Record<string, unknown> = {}
  const cronogramaIn = projetoIdsCronograma.length
    ? `p.id IN (${projetoIdsCronograma.map((id, i) => {
        cronogramaParams[`cronProj${i}`] = id
        return `@cronProj${i}`
      }).join(',')})`
    : '1=0'

  // Subquery de participação — reutilizada por GESTOR e SOLICITANTE
  const participantWhere = `
    (${cronogramaIn}) OR EXISTS (
      SELECT 1 FROM workflow_etapas we
      JOIN workflow_aprovacao wa ON wa.id = we.workflow_id
      WHERE wa.projeto_id = p.id
        AND we.usuario_id = @uid
    )`

  if (usuario.perfil === 'GESTOR') {
    return {
      where: `(p.gerente_id = @uid OR p.solicitante_id = @uid OR p.created_by = @uid OR ${participantWhere})`,
      params: { uid: usuario.id, ...cronogramaParams },
    }
  }

  // SOLICITANTE (e DIRETOR sem diretoria como fallback)
  return {
    where: `(p.solicitante_id = @uid OR p.created_by = @uid OR ${participantWhere})`,
    params: { uid: usuario.id, ...cronogramaParams },
  }
}

/**
 * Retorna todos os projetos visíveis para o usuário, com filtros opcionais.
 * Centraliza a lógica de visibilidade — não duplicar em outros módulos.
 *
 * @param usuario - Usuário autenticado
 * @param filtros - Filtros adicionais (status, busca, etc.)
 * @returns Lista de projetos visíveis com joins de nome
 *
 * @usedBy lib/projetos.ts — buscarProjetos() delega aqui
 * @usedBy futuro Dashboard, Comitês, Documentos
 *
 * Sem callers hoje (`grep -rn "buscarProjetosVisiveis"` só encontra a própria
 * definição) — convertida por consistência com a fatia `usuarios`, com menos
 * rigor de teste já que nada chama esta função no momento.
 */
export async function buscarProjetosVisiveis(
  usuario: { id: number; perfil: string },
  filtros?: {
    status?: string
    diretoria_id?: number
    prioridade?: string
    busca?: string
    limit?: number
    offset?: number
  }
): Promise<Projeto[]> {
  const db = getDb()
  const vis = await getProjetoVisibility(usuario)
  const conditions: string[] = ['p.ativo = 1', `(${vis.where})`]
  const params: Record<string, unknown> = { ...vis.params }

  if (filtros?.status) {
    conditions.push('p.status = @status')
    params.status = filtros.status
  }
  if (filtros?.diretoria_id) {
    conditions.push('p.diretoria_id = @diretoria_id')
    params.diretoria_id = filtros.diretoria_id
  }
  if (filtros?.prioridade) {
    conditions.push('p.prioridade = @prioridade')
    params.prioridade = filtros.prioridade
  }
  if (filtros?.busca) {
    conditions.push('(p.nome LIKE @busca OR p.codigo LIKE @busca OR p.objetivo LIKE @busca)')
    params.busca = `%${filtros.busca}%`
  }

  const limit = filtros?.limit ?? 100
  const offset = filtros?.offset ?? 0

  const projetos = db.prepare(`
    SELECT p.*,
           d.nome  as diretoria_nome,
           a.nome  as area_nome
    FROM projetos p
    LEFT JOIN diretorias d ON p.diretoria_id = d.id
    LEFT JOIN areas a ON p.area_id = a.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE p.prioridade WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
      p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).all(params) as (Projeto & { solicitante_id: number | null; gerente_id: number | null })[]

  const ids = [...new Set(
    projetos.flatMap(p => [p.solicitante_id, p.gerente_id]).filter((v): v is number => v != null)
  )]
  const nomes = await UsuariosRepository.findNomesPorIds(ids)

  return projetos.map(p => ({
    ...p,
    solicitante_nome: p.solicitante_id != null ? nomes.get(p.solicitante_id)?.nome ?? null : null,
    gerente_nome: p.gerente_id != null ? nomes.get(p.gerente_id)?.nome ?? null : null,
  })) as Projeto[]
}

/**
 * Verifica se um usuário pode visualizar um projeto específico.
 * Use para checagem pontual (ex.: API de detalhe do projeto).
 *
 * @param usuario - Usuário a verificar
 * @param projeto - Projeto a verificar (precisa de id e campos de ownership)
 */
// Sem callers hoje (`grep -rn "podeVisualizarProjeto("` só encontra a própria
// definição) — convertida por consistência, com menos rigor de teste.
export async function podeVisualizarProjeto(
  usuario: { id: number; perfil: string },
  projeto: {
    id: number
    gerente_id?: number | null
    solicitante_id?: number | null
    created_by?: number | null
    diretoria_id?: number | null
  }
): Promise<boolean> {
  const nivel = NIVEL_PERFIL[usuario.perfil] ?? 0
  if (nivel >= 70) return true // ADMIN, PMO, CEO

  if (usuario.perfil === 'DIRETOR') {
    const db = getDb()
    const dirs = db
      .prepare('SELECT id FROM diretorias WHERE diretor_responsavel_id = ? AND ativo = 1')
      .all(usuario.id) as Array<{ id: number }>
    return dirs.some(d => d.id === projeto.diretoria_id)
  }

  if (
    projeto.gerente_id    === usuario.id ||
    projeto.solicitante_id === usuario.id ||
    projeto.created_by    === usuario.id
  ) return true

  // cronograma_tarefas/cronogramas já estão em Postgres.
  if (await CronogramaRepository.temParticipacaoNoProjeto(projeto.id, usuario.id)) return true

  const db = getDb()
  const wfPart = db.prepare(`
    SELECT 1 FROM workflow_etapas we
    JOIN workflow_aprovacao wa ON wa.id = we.workflow_id
    WHERE wa.projeto_id = ? AND we.usuario_id = ?
    LIMIT 1
  `).get(projeto.id, usuario.id)
  return !!wfPart
}

// ─── Permissões de Edição ─────────────────────────────────────────────────────

/**
 * Verifica se o usuário pode editar dados gerais do projeto.
 * Regra: ADMIN e PMO sempre; GESTOR somente se for o gerente do projeto.
 */
export function podeEditarProjeto(
  usuario: { id: number; perfil: string },
  projeto: { gerente_id?: number | null }
): boolean {
  if (['ADMIN', 'PMO'].includes(usuario.perfil)) return true
  if (usuario.perfil === 'GESTOR' && projeto.gerente_id === usuario.id) return true
  return false
}

/**
 * Verifica se o usuário pode editar o cronograma de um projeto.
 * Regra idêntica a podeEditarProjeto — centralizado aqui para evolução futura
 * (ex.: GESTOR de área no modo colaborativo).
 */
export function podeEditarCronograma(
  usuario: { id: number; perfil: string },
  projeto: { gerente_id?: number | null }
): boolean {
  if (['ADMIN', 'PMO'].includes(usuario.perfil)) return true
  if (usuario.perfil === 'GESTOR' && projeto.gerente_id === usuario.id) return true
  return false
}

/**
 * Verifica se o usuário pode submeter artefatos para aprovação via workflow.
 * Apenas ADMIN e PMO.
 */
export function podeSubmeterArtefato(usuario: { perfil: string }): boolean {
  return ['ADMIN', 'PMO'].includes(usuario.perfil)
}

/**
 * Verifica se o usuário pode aprovar/rejeitar artefatos no workflow.
 * Apenas ADMIN e PMO têm permissão de iniciar o fluxo.
 * (A aprovação em si é feita por qualquer usuário designado na etapa.)
 */
export function podeAprovarArtefato(usuario: { perfil: string }): boolean {
  return ['ADMIN', 'PMO'].includes(usuario.perfil)
}

/**
 * Verifica se o usuário pode gerenciar configurações globais do sistema.
 */
export function podeGerenciarConfiguracoes(usuario: { perfil: string }): boolean {
  return ['ADMIN', 'PMO'].includes(usuario.perfil)
}
