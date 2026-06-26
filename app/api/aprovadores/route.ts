import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const db = getDb()
  const aprovadores = db.prepare(`
    SELECT da.*, u.nome as usuario_nome, u.cargo
    FROM documento_aprovadores da
    JOIN usuarios u ON da.usuario_id = u.id
    WHERE da.ativo = 1
    ORDER BY da.tipo_documento, da.ordem
  `).all()
  return NextResponse.json({ aprovadores })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const db = getDb()
  const { tipo_documento, usuario_id, ordem } = await request.json()
  db.prepare(`INSERT INTO documento_aprovadores (tipo_documento, usuario_id, ordem, created_by) VALUES (?, ?, ?, ?)`)
    .run(tipo_documento, usuario_id, ordem || 1, session.id)
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  db.prepare(`UPDATE documento_aprovadores SET ativo = 0 WHERE id = ?`).run(Number(id))
  return NextResponse.json({ ok: true })
}
