import getDb from './db'
import { asyncDb } from './database'

// Tabela Postgres real (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts).
const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export type TipoNotificacao =
  | 'REVISAO_TAP'
  | 'REVISAO_VIABILIDADE'
  | 'REVISAO_CRONOGRAMA'
  | 'APROVACAO'
  | 'VENCIMENTO_30D'
  | 'VENCIMENTO_15D'
  | 'VENCIMENTO_7D'
  | 'ATRASO'

export interface Notificacao {
  id: number
  usuario_id: number
  projeto_id: number | null
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  lida: number
  lida_em: string | null
  created_at: string
  projeto_nome?: string | null
}

export function criarNotificacao(dados: {
  usuario_id: number
  projeto_id?: number
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
}): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO notificacoes (usuario_id, projeto_id, tipo, titulo, mensagem)
    VALUES (@usuario_id, @projeto_id, @tipo, @titulo, @mensagem)
  `).run({
    usuario_id: dados.usuario_id,
    projeto_id: dados.projeto_id ?? null,
    tipo: dados.tipo,
    titulo: dados.titulo,
    mensagem: dados.mensagem,
  })
}

/** Notifica todos os usuários PMO e ADMIN ativos, exceto o originador. */
export async function notificarPMOs(dados: {
  originador_id: number
  projeto_id: number
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
}): Promise<void> {
  const db = getDb()

  // perfis continua em SQLite; usuarios já está em Postgres — resolve os
  // perfil_id de PMO/ADMIN aqui e depois consulta usuarios (Postgres) com eles.
  const perfisPmoAdmin = db.prepare(`
    SELECT id FROM perfis WHERE codigo IN ('PMO', 'ADMIN')
  `).all() as { id: number }[]
  const perfilIds = perfisPmoAdmin.map(p => p.id)

  const pmos = perfilIds.length
    ? await asyncDb.queryMany<{ id: number }>(
        `SELECT id FROM ${T_USUARIOS} WHERE ativo = true AND perfil_id = ANY(?)`,
        [perfilIds]
      )
    : []

  for (const pmo of pmos) {
    if (pmo.id !== dados.originador_id) {
      criarNotificacao({
        usuario_id: pmo.id,
        projeto_id: dados.projeto_id,
        tipo: dados.tipo,
        titulo: dados.titulo,
        mensagem: dados.mensagem,
      })
    }
  }

  // Também notifica o gerente do projeto, se houver e não for PMO/ADMIN
  const projeto = db.prepare(`
    SELECT gerente_id FROM projetos WHERE id = ?
  `).get(dados.projeto_id) as { gerente_id: number | null } | undefined

  if (projeto?.gerente_id && projeto.gerente_id !== dados.originador_id) {
    const jaNotificado = pmos.some(p => p.id === projeto.gerente_id)
    if (!jaNotificado) {
      criarNotificacao({
        usuario_id: projeto.gerente_id,
        projeto_id: dados.projeto_id,
        tipo: dados.tipo,
        titulo: dados.titulo,
        mensagem: dados.mensagem,
      })
    }
  }
}

export function buscarNotificacoes(usuario_id: number, limit = 50): Notificacao[] {
  const db = getDb()
  return db.prepare(`
    SELECT n.*, p.nome as projeto_nome
    FROM notificacoes n
    LEFT JOIN projetos p ON p.id = n.projeto_id
    WHERE n.usuario_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(usuario_id, limit) as Notificacao[]
}

export function marcarNotificacaoLida(id: number, usuario_id: number): void {
  const db = getDb()
  db.prepare(`
    UPDATE notificacoes SET lida = 1, lida_em = datetime('now')
    WHERE id = ? AND usuario_id = ?
  `).run(id, usuario_id)
}

export function marcarTodasLidas(usuario_id: number): void {
  const db = getDb()
  db.prepare(`
    UPDATE notificacoes SET lida = 1, lida_em = datetime('now')
    WHERE usuario_id = ? AND lida = 0
  `).run(usuario_id)
}

export function contarNaoLidas(usuario_id: number): number {
  const db = getDb()
  return (db.prepare(
    'SELECT COUNT(*) as total FROM notificacoes WHERE usuario_id = ? AND lida = 0'
  ).get(usuario_id) as { total: number }).total
}
