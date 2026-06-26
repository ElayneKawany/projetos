import getDb from './index'

interface AuditoriaParams {
  usuario_id?: number | null
  usuario_nome?: string
  acao: string
  entidade: string
  entidade_id?: number | null
  projeto_id?: number | null
  descricao: string
  dados_antes?: unknown
  dados_depois?: unknown
  ip?: string
  user_agent?: string
}

/**
 * Registra entrada de auditoria. Nunca falha silenciosamente.
 * Registros de auditoria jamais são deletados.
 */
export function registrarAuditoria(params: AuditoriaParams): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO auditoria
      (usuario_id, usuario_nome, acao, entidade, entidade_id, projeto_id,
       descricao, dados_antes, dados_depois, ip, user_agent)
    VALUES
      (@usuario_id, @usuario_nome, @acao, @entidade, @entidade_id, @projeto_id,
       @descricao, @dados_antes, @dados_depois, @ip, @user_agent)
  `).run({
    usuario_id: params.usuario_id ?? null,
    usuario_nome: params.usuario_nome ?? null,
    acao: params.acao,
    entidade: params.entidade,
    entidade_id: params.entidade_id ?? null,
    projeto_id: params.projeto_id ?? null,
    descricao: params.descricao,
    dados_antes: params.dados_antes ? JSON.stringify(params.dados_antes) : null,
    dados_depois: params.dados_depois ? JSON.stringify(params.dados_depois) : null,
    ip: params.ip ?? null,
    user_agent: params.user_agent ?? null,
  })
}

export function buscarAuditoria(filtros: {
  projeto_id?: number
  entidade?: string
  usuario_id?: number
  limit?: number
  offset?: number
}) {
  const db = getDb()
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filtros.projeto_id) {
    conditions.push('a.projeto_id = @projeto_id')
    params.projeto_id = filtros.projeto_id
  }
  if (filtros.entidade) {
    conditions.push('a.entidade = @entidade')
    params.entidade = filtros.entidade
  }
  if (filtros.usuario_id) {
    conditions.push('a.usuario_id = @usuario_id')
    params.usuario_id = filtros.usuario_id
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filtros.limit ?? 50
  const offset = filtros.offset ?? 0

  return db.prepare(`
    SELECT a.*, u.nome as usuario_nome_atual
    FROM auditoria a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).all(params)
}
