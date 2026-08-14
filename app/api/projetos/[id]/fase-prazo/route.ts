import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const db = getDb()
  const rows = db.prepare(
    'SELECT status, data_limite FROM projeto_fase_prazo WHERE projeto_id = ?'
  ).all(Number(id))
  return NextResponse.json(rows)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const { prazos } = await req.json() as { prazos: { status: string; data_limite: string | null }[] }
  if (!Array.isArray(prazos)) return NextResponse.json({ error: 'prazos inválido' }, { status: 400 })

  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO projeto_fase_prazo (projeto_id, status, data_limite, usuario_id, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(projeto_id, status) DO UPDATE SET
      data_limite = excluded.data_limite,
      usuario_id  = excluded.usuario_id,
      updated_at  = CURRENT_TIMESTAMP
  `)
  const tx = db.transaction(() => {
    for (const p of prazos) {
      upsert.run(Number(id), p.status, p.data_limite || null, session.id)
    }
  })
  tx()
  return NextResponse.json({ ok: true })
}
