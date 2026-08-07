import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const db = getDb()
  const tipos = db
    .prepare('SELECT * FROM config_cronograma_tipos WHERE ativo = 1 ORDER BY ordem, label')
    .all()
  return NextResponse.json(tipos)
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session || !temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { label, codigo } = await request.json()
  if (!label?.trim() || !codigo?.trim())
    return NextResponse.json({ error: 'Label e código são obrigatórios.' }, { status: 400 })

  const db = getDb()
  const codigoNorm = codigo.trim().toUpperCase().replace(/\s+/g, '_')

  const existente = db
    .prepare('SELECT id FROM config_cronograma_tipos WHERE codigo = ?')
    .get(codigoNorm)
  if (existente) return NextResponse.json({ error: 'Código já está em uso.' }, { status: 409 })

  const maxOrdem = (db
    .prepare('SELECT MAX(ordem) as m FROM config_cronograma_tipos')
    .get() as { m: number | null }).m ?? 0

  const result = db
    .prepare('INSERT INTO config_cronograma_tipos (codigo, label, ordem, is_system) VALUES (?, ?, ?, 0)')
    .run(codigoNorm, label.trim(), maxOrdem + 1)

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
