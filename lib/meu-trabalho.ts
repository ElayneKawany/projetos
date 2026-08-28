/**
 * @file lib/meu-trabalho.ts
 *
 * Serviço "Meu Trabalho" — agrega em um único lugar todas as tarefas,
 * aprovações, pendências e documentos do usuário logado.
 *
 * Este módulo é a fonte para a futura página /meu-trabalho e para os
 * indicadores do Dashboard Executivo.
 *
 * REGRAS:
 *  - Apenas leitura. Nunca persiste dados aqui.
 *  - Todas as queries respeitam soft-delete (ativo = 1, deleted_at IS NULL).
 *  - Funções de dashboard retornam agregados, não listas brutas.
 */

import getDb from './db'
import type { SessionUser } from './auth'
import { CronogramaRepository } from './repositories/cronograma'
import { diasUteisEntre } from './utils/dias-uteis'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TarefaResumo {
  tarefa_id: number
  cronograma_id: number
  projeto_id: number
  projeto_nome: string
  codigo: string | null
  nome: string
  nivel: string
  tipo: string | null
  criticidade: string | null
  data_inicio: string | null
  data_fim: string | null
  duracao_dias: number | null
  percentual: number | null
  status: string | null
  papel: 'RESPONSAVEL' | 'EXECUTOR'
}

export interface AprovacaoPendente {
  etapa_id: number
  workflow_id: number
  projeto_id: number
  projeto_nome: string
  artefato_tipo: string | null
  artefato_id: number | null
  etapa_tipo: 'APROVACAO' | 'CIENCIA'
  etapa_ordem: number
  criado_em: string
}

export interface PendenciaResumo {
  tipo: 'TAREFA_ATRASADA' | 'TAREFA_SEM_RESPONSAVEL' | 'APROVACAO_PENDENTE'
  projeto_id: number
  projeto_nome: string
  referencia_id: number
  descricao: string
  criticidade: string | null
  data_limite: string | null
}

export interface DocumentoResumo {
  id: number
  projeto_id: number
  projeto_nome: string
  tipo: 'TAP' | 'VIABILIDADE' | 'CRONOGRAMA'
  versao: number
  status: string
  criado_por_nome: string | null
  created_at: string
}

// ─── Tarefas ──────────────────────────────────────────────────────────────────

/**
 * Retorna todas as tarefas de cronograma em que o usuário é responsável
 * ou executor, com dados do projeto e status atual.
 *
 * Usado para: página "Minhas Tarefas", widget do Dashboard.
 *
 * @param usuarioId - ID do usuário logado
 * @param filtros   - opções de filtro (status, criticidade, atrasadas)
 */
export function buscarMinhasTarefas(
  usuarioId: number,
  filtros?: {
    status?: string
    criticidade?: string
    apenasAtrasadas?: boolean
    limit?: number
  }
): TarefaResumo[] {
  const db = getDb()

  const wheres: string[] = [
    '(ct.responsavel_id = @uid OR ct.executor_id = @uid)',
    'ct.nivel = \'TAREFA\'',
  ]
  const params: Record<string, unknown> = { uid: usuarioId }

  if (filtros?.status) {
    wheres.push('ct.status = @status')
    params.status = filtros.status
  }
  if (filtros?.criticidade) {
    wheres.push('ct.criticidade = @criticidade')
    params.criticidade = filtros.criticidade
  }
  if (filtros?.apenasAtrasadas) {
    wheres.push("ct.data_fim < date('now') AND (ct.status IS NULL OR ct.status NOT IN ('CONCLUIDA','CANCELADA'))")
  }

  const limit = filtros?.limit ? `LIMIT ${filtros.limit}` : ''

  const rows = db.prepare(`
    SELECT
      ct.id              AS tarefa_id,
      ct.cronograma_id,
      p.id               AS projeto_id,
      p.nome             AS projeto_nome,
      ct.codigo,
      ct.nome,
      ct.nivel,
      ct.tipo,
      ct.criticidade,
      ct.data_inicio,
      ct.data_fim,
      ct.duracao_dias,
      ct.percentual,
      ct.status,
      CASE WHEN ct.responsavel_id = @uid THEN 'RESPONSAVEL' ELSE 'EXECUTOR' END AS papel
    FROM cronograma_tarefas ct
    JOIN cronogramas cr ON cr.id = ct.cronograma_id
    JOIN projetos p      ON p.id = cr.projeto_id
    WHERE ${wheres.join(' AND ')}
    ORDER BY ct.data_fim ASC, ct.criticidade DESC
    ${limit}
  `).all(params) as TarefaResumo[]

  return rows
}

// ─── Aprovações ───────────────────────────────────────────────────────────────

/**
 * Retorna aprovações pendentes onde o usuário é o aprovador da etapa atual.
 *
 * Usado para: badge de notificação, página "Minhas Aprovações".
 *
 * @param usuarioId - ID do usuário logado
 */
export function buscarMinhasAprovacoes(usuarioId: number): AprovacaoPendente[] {
  const db = getDb()

  return db.prepare(`
    SELECT
      we.id            AS etapa_id,
      wa.id            AS workflow_id,
      wa.projeto_id,
      p.nome           AS projeto_nome,
      wa.artefato_tipo,
      wa.artefato_id,
      we.tipo          AS etapa_tipo,
      we.ordem         AS etapa_ordem,
      wa.created_at    AS criado_em
    FROM workflow_etapas we
    JOIN workflow_aprovacao wa ON wa.id = we.workflow_id
    JOIN projetos p            ON p.id = wa.projeto_id
    WHERE we.usuario_id = @uid
      AND we.status     = 'PENDENTE'
      AND wa.status     = 'PENDENTE'
      AND wa.ordem_atual = we.ordem
    ORDER BY wa.created_at ASC
  `).all({ uid: usuarioId }) as AprovacaoPendente[]
}

// ─── Pendências consolidadas ──────────────────────────────────────────────────

/**
 * Agrega todas as pendências do usuário em uma única lista priorizada:
 *   - Tarefas atrasadas sob sua responsabilidade
 *   - Aprovações aguardando sua ação
 *
 * Usado para: badge de alerta, painel de pendências no Dashboard.
 *
 * @param usuarioId - ID do usuário logado
 */
export function buscarMinhasPendencias(usuarioId: number): PendenciaResumo[] {
  const pendencias: PendenciaResumo[] = []

  // 1. Tarefas atrasadas
  const atrasadas = buscarMinhasTarefas(usuarioId, { apenasAtrasadas: true, limit: 50 })
  for (const t of atrasadas) {
    pendencias.push({
      tipo:          'TAREFA_ATRASADA',
      projeto_id:    t.projeto_id,
      projeto_nome:  t.projeto_nome,
      referencia_id: t.tarefa_id,
      descricao:     t.nome,
      criticidade:   t.criticidade,
      data_limite:   t.data_fim,
    })
  }

  // 2. Aprovações pendentes
  const aprovacoes = buscarMinhasAprovacoes(usuarioId)
  for (const a of aprovacoes) {
    pendencias.push({
      tipo:          'APROVACAO_PENDENTE',
      projeto_id:    a.projeto_id,
      projeto_nome:  a.projeto_nome,
      referencia_id: a.etapa_id,
      descricao:     `${a.etapa_tipo === 'CIENCIA' ? 'Ciência' : 'Aprovação'} de ${a.artefato_tipo ?? 'artefato'}`,
      criticidade:   null,
      data_limite:   null,
    })
  }

  return pendencias
}

// ─── Documentos ───────────────────────────────────────────────────────────────

/**
 * Retorna TAPs, Estudos de Viabilidade e Cronogramas criados pelo usuário
 * ou que passaram pelo workflow do usuário.
 *
 * Usado para: "Meus Documentos" (futura Sprint).
 *
 * @param usuarioId - ID do usuário logado
 * @param limit     - máximo de documentos (default 50)
 */
export function buscarMeusDocumentos(
  usuarioId: number,
  limit = 50
): DocumentoResumo[] {
  const db = getDb()
  const docs: DocumentoResumo[] = []

  // TAPs
  const taps = db.prepare(`
    SELECT
      t.id,
      t.projeto_id,
      p.nome AS projeto_nome,
      'TAP'  AS tipo,
      t.versao,
      t.status,
      u.nome AS criado_por_nome,
      t.created_at
    FROM tap t
    JOIN projetos p ON p.id = t.projeto_id
    LEFT JOIN usuarios u ON u.id = t.criado_por
    WHERE t.criado_por = @uid
       OR EXISTS (
         SELECT 1 FROM workflow_aprovacao wa
         JOIN workflow_etapas we ON we.workflow_id = wa.id
         WHERE wa.artefato_tipo = 'TAP' AND wa.artefato_id = t.id
           AND we.usuario_id = @uid
       )
    ORDER BY t.created_at DESC
    LIMIT @lim
  `).all({ uid: usuarioId, lim: limit }) as DocumentoResumo[]
  docs.push(...taps)

  // Estudos de Viabilidade
  const viabs = db.prepare(`
    SELECT
      v.id,
      v.projeto_id,
      p.nome             AS projeto_nome,
      'VIABILIDADE'      AS tipo,
      v.versao,
      v.status,
      u.nome             AS criado_por_nome,
      v.created_at
    FROM viabilidade v
    JOIN projetos p ON p.id = v.projeto_id
    LEFT JOIN usuarios u ON u.id = v.criado_por
    WHERE v.criado_por = @uid
       OR EXISTS (
         SELECT 1 FROM workflow_aprovacao wa
         JOIN workflow_etapas we ON we.workflow_id = wa.id
         WHERE wa.artefato_tipo = 'VIABILIDADE' AND wa.artefato_id = v.id
           AND we.usuario_id = @uid
       )
    ORDER BY v.created_at DESC
    LIMIT @lim
  `).all({ uid: usuarioId, lim: limit }) as DocumentoResumo[]
  docs.push(...viabs)

  // Cronogramas
  const crons = db.prepare(`
    SELECT
      cr.id,
      cr.projeto_id,
      p.nome         AS projeto_nome,
      'CRONOGRAMA'   AS tipo,
      cr.versao,
      cr.status,
      u.nome         AS criado_por_nome,
      cr.created_at
    FROM cronogramas cr
    JOIN projetos p ON p.id = cr.projeto_id
    LEFT JOIN usuarios u ON u.id = cr.criado_por
    WHERE cr.criado_por = @uid
       OR EXISTS (
         SELECT 1 FROM workflow_aprovacao wa
         JOIN workflow_etapas we ON we.workflow_id = wa.id
         WHERE wa.artefato_tipo = 'CRONOGRAMA' AND wa.artefato_id = cr.id
           AND we.usuario_id = @uid
       )
    ORDER BY cr.created_at DESC
    LIMIT @lim
  `).all({ uid: usuarioId, lim: limit }) as DocumentoResumo[]
  docs.push(...crons)

  // Ordena por data decrescente e limita ao total
  return docs
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
}

// ─── Indicadores de Dashboard ─────────────────────────────────────────────────

export interface IndicadoresCronograma {
  total_tarefas:      number
  tarefas_concluidas: number
  tarefas_atrasadas:  number
  tarefas_criticas:   number
  percentual_geral:   number
  por_responsavel: Array<{
    usuario_id:   number
    usuario_nome: string
    total:        number
    concluidas:   number
    atrasadas:    number
  }>
}

/**
 * Computa indicadores de cronograma para o dashboard de um projeto.
 *
 * @param projetoId - ID do projeto
 */
export function indicadoresCronograma(projetoId: number): IndicadoresCronograma {
  const db = getDb()

  const cron = CronogramaRepository.findCronogramaVigente(projetoId)

  if (!cron) {
    return {
      total_tarefas: 0, tarefas_concluidas: 0, tarefas_atrasadas: 0,
      tarefas_criticas: 0, percentual_geral: 0, por_responsavel: [],
    }
  }

  const tarefas = db.prepare(`
    SELECT ct.*, u.nome AS responsavel_nome
    FROM cronograma_tarefas ct
    LEFT JOIN usuarios u ON u.id = ct.responsavel_id
    WHERE ct.cronograma_id = ? AND ct.nivel = 'TAREFA' AND (ct.ativo IS NULL OR ct.ativo = 1)
  `).all(cron.id) as Array<{
    id: number
    responsavel_id: number | null
    responsavel_nome: string | null
    status: string | null
    criticidade: string | null
    data_fim: string | null
    percentual: number | null
  }>

  const hoje = new Date().toISOString().slice(0, 10)

  const total     = tarefas.length
  const concl     = tarefas.filter(t => t.status === 'CONCLUIDA').length
  const atrasadas = tarefas.filter(t =>
    t.data_fim && t.data_fim < hoje && t.status !== 'CONCLUIDA' && t.status !== 'CANCELADA'
  ).length
  const criticas  = tarefas.filter(t => t.criticidade === 'CRITICA').length
  const pctGeral  = total > 0 ? Math.round((concl / total) * 100) : 0

  // Agrega por responsável
  const mapaResp = new Map<number, {
    usuario_id: number; usuario_nome: string
    total: number; concluidas: number; atrasadas: number
  }>()

  for (const t of tarefas) {
    if (!t.responsavel_id) continue
    if (!mapaResp.has(t.responsavel_id)) {
      mapaResp.set(t.responsavel_id, {
        usuario_id:   t.responsavel_id,
        usuario_nome: t.responsavel_nome ?? `ID ${t.responsavel_id}`,
        total: 0, concluidas: 0, atrasadas: 0,
      })
    }
    const r = mapaResp.get(t.responsavel_id)!
    r.total++
    if (t.status === 'CONCLUIDA') r.concluidas++
    if (t.data_fim && t.data_fim < hoje && t.status !== 'CONCLUIDA' && t.status !== 'CANCELADA') r.atrasadas++
  }

  return {
    total_tarefas:      total,
    tarefas_concluidas: concl,
    tarefas_atrasadas:  atrasadas,
    tarefas_criticas:   criticas,
    percentual_geral:   pctGeral,
    por_responsavel:    Array.from(mapaResp.values()),
  }
}

// ─── Próximas Tarefas (Dashboard) ─────────────────────────────────────────────

export interface ProximaTarefaItem {
  tarefa_id: number
  projeto_id: number
  projeto_codigo: string | null
  projeto_nome: string
  diretoria_nome: string | null
  nivel: 'FASE' | 'TAREFA' | 'SUBTAREFA'
  nome: string
  responsavel_nome: string | null
  data_inicio: string | null
  data_fim: string
  dias: number
  situacao: 'ATRASADA' | 'VENCE_HOJE' | 'PROXIMA'
  status: string | null
  observacoes: string | null
}

const CRONOGRAMA_STATUS_APROVADO = ['APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO', 'ENCERRADO']

/**
 * Busca de base (query + CTE de cronograma vigente + filtro de permissão)
 * compartilhada por `buscarProximasTarefasDashboard` (página /proximas-tarefas,
 * janela de 7 dias corridos — comportamento existente, não alterado) e pelos
 * dois painéis novos do Dashboard (`buscarTarefasProximasVencimento` /
 * `buscarTarefasAtrasadas`, que aplicam dias úteis em cima do mesmo resultado).
 *
 * Filtro de permissão (aplicado aqui, no backend):
 *  - ADMIN, PMO, CEO: todas as tarefas de todos os projetos.
 *  - DIRETOR: apenas tarefas de projetos da própria diretoria.
 *  - Demais perfis: apenas tarefas onde é responsável ou executor
 *    (coluna própria ou tabela cronograma_responsaveis).
 *
 * Considera só o cronograma mais recente já aprovado de cada projeto
 * (RASCUNHO/PENDENTE_APROVACAO são ignorados) e aplica a hierarquia
 * fase>tarefa>subtarefa: uma tarefa não aparece se tiver subtarefa ativa,
 * uma fase não aparece se tiver tarefa ativa — evita linhas duplicadas.
 *
 * `janelaDiasCorridos` limita o upper bound de data_fim no SQL (atrasadas não
 * têm limite inferior — sempre entram). Cada chamador aplica o corte fino
 * (dias corridos ou dias úteis) em JS sobre o resultado.
 */
function buscarTarefasCronogramaJanela(
  session: SessionUser,
  janelaDiasCorridos: number
): ProximaTarefaItem[] {
  const db = getDb()

  const wheres: string[] = [
    '(ct.ativo IS NULL OR ct.ativo = 1)',
    'p.ativo = 1',
    `(
      ct.nivel = 'SUBTAREFA'
      OR (ct.nivel = 'TAREFA' AND NOT EXISTS (
            SELECT 1 FROM cronograma_tarefas sub
            WHERE sub.parent_id = ct.id AND sub.nivel = 'SUBTAREFA' AND (sub.ativo IS NULL OR sub.ativo = 1)))
      OR (ct.nivel = 'FASE' AND NOT EXISTS (
            SELECT 1 FROM cronograma_tarefas tar
            WHERE tar.parent_id = ct.id AND tar.nivel = 'TAREFA' AND (tar.ativo IS NULL OR tar.ativo = 1)))
    )`,
    "NOT (ct.data_conclusao IS NOT NULL OR ct.status = 'CONCLUIDA' OR ct.percentual >= 100)",
    'ct.data_fim IS NOT NULL',
    `date(ct.data_fim) <= date('now', '+${janelaDiasCorridos} days')`,
  ]
  const params: Record<string, unknown> = {
    statusAprovado0: CRONOGRAMA_STATUS_APROVADO[0],
    statusAprovado1: CRONOGRAMA_STATUS_APROVADO[1],
    statusAprovado2: CRONOGRAMA_STATUS_APROVADO[2],
    statusAprovado3: CRONOGRAMA_STATUS_APROVADO[3],
  }

  if (['ADMIN', 'PMO', 'CEO'].includes(session.perfil)) {
    // sem filtro adicional — vê tudo
  } else if (session.perfil === 'DIRETOR') {
    wheres.push('p.diretoria_id = @diretoriaId')
    params.diretoriaId = session.diretoria_id
  } else {
    wheres.push(`(
      ct.responsavel_id = @uid OR ct.executor_id = @uid
      OR EXISTS (SELECT 1 FROM cronograma_responsaveis cresp WHERE cresp.cronograma_tarefa_id = ct.id AND cresp.usuario_id = @uid)
    )`)
    params.uid = session.id
  }

  const rows = db.prepare(`
    WITH cronograma_atual AS (
      SELECT cr.id AS cronograma_id, cr.projeto_id
      FROM cronogramas cr
      WHERE (cr.ativo IS NULL OR cr.ativo = 1)
        AND cr.status IN (@statusAprovado0, @statusAprovado1, @statusAprovado2, @statusAprovado3)
        AND cr.versao = (
          SELECT MAX(cr2.versao) FROM cronogramas cr2
          WHERE cr2.projeto_id = cr.projeto_id
            AND (cr2.ativo IS NULL OR cr2.ativo = 1)
            AND cr2.status IN (@statusAprovado0, @statusAprovado1, @statusAprovado2, @statusAprovado3)
        )
    )
    SELECT
      ct.id            AS tarefa_id,
      p.id             AS projeto_id,
      p.codigo         AS projeto_codigo,
      p.nome           AS projeto_nome,
      d.nome           AS diretoria_nome,
      ct.nivel,
      ct.nome,
      COALESCE(ur.nome, ct.responsavel_nome_ext, (
        SELECT COALESCE(u2.nome, cr2.usuario_nome_ext)
        FROM cronograma_responsaveis cr2
        LEFT JOIN usuarios u2 ON u2.id = cr2.usuario_id
        WHERE cr2.cronograma_tarefa_id = ct.id
        ORDER BY cr2.id ASC LIMIT 1
      ))              AS responsavel_nome,
      ct.data_inicio,
      ct.data_fim,
      ct.status,
      ct.observacoes
    FROM cronograma_tarefas ct
    JOIN cronograma_atual ca ON ca.cronograma_id = ct.cronograma_id
    JOIN projetos p          ON p.id = ca.projeto_id
    LEFT JOIN diretorias d   ON d.id = p.diretoria_id
    LEFT JOIN usuarios ur    ON ur.id = ct.responsavel_id
    WHERE ${wheres.join(' AND ')}
    ORDER BY ct.data_fim ASC
  `).all(params) as Array<{
    tarefa_id: number
    projeto_id: number
    projeto_codigo: string | null
    projeto_nome: string
    diretoria_nome: string | null
    nivel: string
    nome: string
    responsavel_nome: string | null
    data_inicio: string | null
    data_fim: string
    status: string | null
    observacoes: string | null
  }>

  const hoje = new Date().toISOString().slice(0, 10)

  return rows.map(r => {
    const situacao: ProximaTarefaItem['situacao'] =
      r.data_fim < hoje ? 'ATRASADA' : r.data_fim === hoje ? 'VENCE_HOJE' : 'PROXIMA'
    const dias = Math.round(
      (new Date(r.data_fim + 'T00:00:00').getTime() - new Date(hoje + 'T00:00:00').getTime()) / 86_400_000
    )
    return {
      tarefa_id: r.tarefa_id,
      projeto_id: r.projeto_id,
      projeto_codigo: r.projeto_codigo,
      projeto_nome: r.projeto_nome,
      diretoria_nome: r.diretoria_nome,
      nivel: r.nivel as ProximaTarefaItem['nivel'],
      nome: r.nome,
      responsavel_nome: r.responsavel_nome,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      dias,
      situacao,
      status: r.status,
      observacoes: r.observacoes,
    }
  })
}

/**
 * Tarefas de cronograma atrasadas, vencendo hoje ou vencendo nos próximos 7
 * dias corridos — usado pela página cheia /proximas-tarefas. Comportamento
 * inalterado (dias corridos, não úteis) — ver `buscarTarefasCronogramaJanela`
 * para a regra de permissão/fonte compartilhada com os painéis do Dashboard.
 */
export function buscarProximasTarefasDashboard(
  session: SessionUser,
  opts?: { limit?: number }
): { total: number; itens: ProximaTarefaItem[] } {
  const itensCompletos = buscarTarefasCronogramaJanela(session, 7)
  const total = itensCompletos.length
  const itens = opts?.limit ? itensCompletos.slice(0, opts.limit) : itensCompletos
  return { total, itens }
}

/**
 * Painel "Tarefas Próximas ao Vencimento" do Dashboard: tarefas que vencem
 * hoje (sempre incluídas — ordenação por data_fim já as coloca primeiro) ou
 * faltam de 1 a 7 dias ÚTEIS para vencer. Atrasadas nunca entram aqui.
 */
export function buscarTarefasProximasVencimento(
  session: SessionUser,
  opts?: { limit?: number }
): { total: number; itens: ProximaTarefaItem[] } {
  // Janela generosa em dias corridos (7 dias úteis cabem em até 9 dias
  // corridos considerando um fim de semana no meio) — o corte exato é feito
  // abaixo, em dias úteis.
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const todas = buscarTarefasCronogramaJanela(session, 9)

  const itensCompletos = todas.filter(t => {
    if (t.situacao === 'VENCE_HOJE') return true
    if (t.situacao !== 'PROXIMA') return false
    const fim = new Date(t.data_fim + 'T00:00:00')
    const uteis = diasUteisEntre(hoje, fim)
    return uteis >= 1 && uteis <= 7
  })

  const total = itensCompletos.length
  const itens = opts?.limit ? itensCompletos.slice(0, opts.limit) : itensCompletos
  return { total, itens }
}

export interface TarefaAtrasadaResumo {
  projeto_id: number
  projeto_codigo: string | null
  projeto_nome: string
  diretoria_nome: string | null
  tarefa_id: number
  nivel: ProximaTarefaItem['nivel']
  nome: string
  data_fim: string
  dias_atraso: number
}

export interface ResponsavelAtrasos {
  responsavel_nome: string
  itens: TarefaAtrasadaResumo[]
}

/**
 * Painel "Tarefas Atrasadas" do Dashboard: uma linha por projeto (a tarefa
 * atrasada de vencimento mais antigo — o "primeiro impedimento" do projeto),
 * agrupado por responsável. Não repete várias tarefas do mesmo projeto.
 */
export function buscarTarefasAtrasadas(
  session: SessionUser
): { total_projetos: number; porResponsavel: ResponsavelAtrasos[] } {
  const atrasadas = buscarTarefasCronogramaJanela(session, 0)
    .filter(t => t.situacao === 'ATRASADA')

  // Uma por projeto: a de menor data_fim (mais antiga = primeiro impedimento).
  const primeiraPorProjeto = new Map<number, ProximaTarefaItem>()
  for (const t of atrasadas) {
    const atual = primeiraPorProjeto.get(t.projeto_id)
    if (!atual || t.data_fim < atual.data_fim) primeiraPorProjeto.set(t.projeto_id, t)
  }

  // Agrupa por responsável (sem responsável vira seu próprio grupo).
  const porResp = new Map<string, TarefaAtrasadaResumo[]>()
  for (const t of primeiraPorProjeto.values()) {
    const resp = t.responsavel_nome ?? 'Sem responsável'
    const resumo: TarefaAtrasadaResumo = {
      projeto_id: t.projeto_id,
      projeto_codigo: t.projeto_codigo,
      projeto_nome: t.projeto_nome,
      diretoria_nome: t.diretoria_nome,
      tarefa_id: t.tarefa_id,
      nivel: t.nivel,
      nome: t.nome,
      data_fim: t.data_fim,
      dias_atraso: Math.abs(t.dias),
    }
    if (!porResp.has(resp)) porResp.set(resp, [])
    porResp.get(resp)!.push(resumo)
  }

  const porResponsavel: ResponsavelAtrasos[] = Array.from(porResp.entries())
    .map(([responsavel_nome, itens]) => ({
      responsavel_nome,
      itens: itens.sort((a, b) => a.data_fim.localeCompare(b.data_fim)),
    }))
    .sort((a, b) => a.responsavel_nome.localeCompare(b.responsavel_nome, 'pt-BR'))

  return { total_projetos: primeiraPorProjeto.size, porResponsavel }
}
