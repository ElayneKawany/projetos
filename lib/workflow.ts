import getDb from './db'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EtapaInput {
  ordem: number
  usuario_id: number
  usuario_nome: string
  tipo: 'APROVACAO' | 'CIENCIA'
}

export interface WorkflowEtapa {
  id: number
  workflow_id: number
  ordem: number
  usuario_id: number
  usuario_nome: string
  tipo: string
  status: string
  observacao: string | null
  respondido_em: string | null
}

export interface WorkflowAprovacao {
  id: number
  projeto_id: number
  tipo: string
  referencia_id: number
  etapa_atual: number
  status: string
  modelo_id: number | null
  criado_por: number
  created_at: string
  etapas: WorkflowEtapa[]
}

// ─── Consultas ───────────────────────────────────────────────────────────────

/** Retorna o workflow ativo (EM_ANDAMENTO) de um documento */
export function buscarWorkflow(
  referencia_id: number,
  tipo: string
): WorkflowAprovacao | null {
  const db = getDb()
  const wf = db
    .prepare(
      `SELECT * FROM workflow_aprovacao
       WHERE referencia_id = ? AND tipo = ? AND status = 'EM_ANDAMENTO'
       ORDER BY id DESC LIMIT 1`
    )
    .get(referencia_id, tipo) as Omit<WorkflowAprovacao, 'etapas'> | undefined
  if (!wf) return null
  const etapas = db
    .prepare('SELECT * FROM workflow_etapas WHERE workflow_id = ? ORDER BY ordem')
    .all(wf.id) as WorkflowEtapa[]
  return { ...wf, etapas }
}

// ─── Criação ─────────────────────────────────────────────────────────────────

/** Cria um novo workflow, cancelando qualquer workflow ativo anterior */
export function criarWorkflow(params: {
  projeto_id: number
  tipo: string
  referencia_id: number
  criado_por: number
  etapas: EtapaInput[]
  modelo_id?: number | null
}): WorkflowAprovacao {
  const db = getDb()

  // Cancelar workflow ativo anterior, se houver (reenvio após revisão)
  db.prepare(
    `UPDATE workflow_aprovacao
     SET status = 'CANCELADO'
     WHERE referencia_id = ? AND tipo = ? AND status = 'EM_ANDAMENTO'`
  ).run(params.referencia_id, params.tipo)

  const wf = db
    .prepare(
      `INSERT INTO workflow_aprovacao
         (projeto_id, tipo, referencia_id, etapa_atual, status, criado_por, modelo_id)
       VALUES (?, ?, ?, 1, 'EM_ANDAMENTO', ?, ?)`
    )
    .run(params.projeto_id, params.tipo, params.referencia_id, params.criado_por, params.modelo_id ?? null)

  const wfId = wf.lastInsertRowid as number

  const insEtapa = db.prepare(
    `INSERT INTO workflow_etapas
       (workflow_id, ordem, usuario_id, usuario_nome, tipo, status)
     VALUES (?, ?, ?, ?, ?, 'PENDENTE')`
  )
  for (const e of params.etapas) {
    insEtapa.run(wfId, e.ordem, e.usuario_id, e.usuario_nome, e.tipo)
  }

  return buscarWorkflow(params.referencia_id, params.tipo)!
}

// ─── Processamento de resposta ────────────────────────────────────────────────

export type WorkflowResult = 'ADVANCED' | 'COMPLETED' | 'REJECTED'

/**
 * Processa a resposta de um participante na etapa atual.
 * Retorna:
 *  - 'ADVANCED'  → avançou para a próxima etapa (documento permanece PENDENTE_APROVACAO)
 *  - 'COMPLETED' → todas as etapas concluídas (documento deve ser marcado APROVADO)
 *  - 'REJECTED'  → etapa rejeitada (documento deve voltar para RASCUNHO)
 */
export function processarResposta(params: {
  workflow: WorkflowAprovacao
  acao: 'APROVAR' | 'CIENTE' | 'REJEITAR'
  observacao?: string
}): WorkflowResult {
  const db = getDb()
  const { workflow, acao, observacao } = params

  const etapa = workflow.etapas.find(e => e.ordem === workflow.etapa_atual)
  if (!etapa) throw new Error('Etapa atual não encontrada no workflow.')

  if (acao === 'REJEITAR') {
    db.prepare(
      `UPDATE workflow_etapas
       SET status = 'REJEITADO', observacao = ?, respondido_em = datetime('now')
       WHERE id = ?`
    ).run(observacao ?? null, etapa.id)
    db.prepare(
      `UPDATE workflow_aprovacao SET status = 'REJEITADO' WHERE id = ?`
    ).run(workflow.id)
    return 'REJECTED'
  }

  const novoStatus = acao === 'APROVAR' ? 'APROVADO' : 'CIENTE'
  db.prepare(
    `UPDATE workflow_etapas
     SET status = ?, observacao = ?, respondido_em = datetime('now')
     WHERE id = ?`
  ).run(novoStatus, observacao ?? null, etapa.id)

  const proxima = workflow.etapas.find(e => e.ordem === etapa.ordem + 1)
  if (proxima) {
    db.prepare(
      `UPDATE workflow_aprovacao SET etapa_atual = ? WHERE id = ?`
    ).run(proxima.ordem, workflow.id)
    return 'ADVANCED'
  }

  db.prepare(
    `UPDATE workflow_aprovacao SET status = 'CONCLUIDO' WHERE id = ?`
  ).run(workflow.id)
  return 'COMPLETED'
}
