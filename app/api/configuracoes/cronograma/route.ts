import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { registrarAuditoria } from '@/lib/db/auditoria'

const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const cfg = db
    .prepare("SELECT valor FROM config_global WHERE chave = 'responsavel_padrao_importacao'")
    .get() as { valor: string } | undefined

  const userId = cfg?.valor ? Number(cfg.valor) : null
  let responsavel = null
  if (userId) {
    responsavel = await asyncDb.queryOne<{ id: number; nome: string; email: string }>(
      `SELECT id, nome, email FROM ${T_USUARIOS} WHERE id = ? AND ativo = true`,
      [userId]
    ) ?? null
  }

  return NextResponse.json({ responsavel_padrao: responsavel })
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão. Apenas ADMIN ou PMO.' }, { status: 403 })
  }

  const { usuario_id } = await request.json() as { usuario_id: number | null }

  const db = getDb()

  if (usuario_id !== null && usuario_id !== undefined) {
    const usuario = await asyncDb.queryOne(
      `SELECT id FROM ${T_USUARIOS} WHERE id = ? AND ativo = true`,
      [Number(usuario_id)]
    )
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }
  }

  const anterior = db
    .prepare("SELECT valor FROM config_global WHERE chave = 'responsavel_padrao_importacao'")
    .get() as { valor: string } | undefined

  db.prepare(`
    UPDATE config_global SET valor = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE chave = 'responsavel_padrao_importacao'
  `).run(usuario_id ? String(usuario_id) : '', session.id)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'config_global',
    descricao: `Responsável padrão de importação de cronograma alterado para usuário id=${usuario_id ?? 'nenhum'}`,
    dados_antes: { chave: 'responsavel_padrao_importacao', valor: anterior?.valor },
    dados_depois: { chave: 'responsavel_padrao_importacao', valor: usuario_id ? String(usuario_id) : '' },
  })

  return NextResponse.json({ ok: true })
}
