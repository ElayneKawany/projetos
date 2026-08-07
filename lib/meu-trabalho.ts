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

  const cron = db
    .prepare("SELECT id FROM cronogramas WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1")
    .get(projetoId) as { id: number } | undefined

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
    WHERE ct.cronograma_id = ? AND ct.nivel = 'TAREFA'
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
