import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const motivos = db.prepare(
    'SELECT * FROM config_motivos_pausa ORDER BY ordem, nome'
  ).all()
  return NextResponse.json({ motivos })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const db = getDb()
  const { nome, descricao, ordem } = await request.json()
  if (!nome?.trim())
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })

  const maxOrdem = (db.prepare('SELECT COALESCE(MAX(ordem),0) as m FROM config_motivos_pausa').get() as { m: number }).m

  const r = db.prepare(
    'INSERT INTO config_motivos_pausa (nome, descricao, ordem) VALUES (?, ?, ?)'
  ).run(nome.trim(), descricao?.trim() ?? null, ordem ?? maxOrdem + 1)

  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 })
}
