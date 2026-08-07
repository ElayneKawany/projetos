import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = getDb()
  const tipos = db.prepare('SELECT * FROM workflow_tipos_participacao ORDER BY id').all()
  return NextResponse.json(tipos)
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session || !temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, codigo, descricao } = await request.json()
  if (!nome?.trim() || !codigo?.trim())
    return NextResponse.json({ error: 'Nome e código são obrigatórios' }, { status: 400 })

  const db = getDb()
  const codigoNorm = codigo.trim().toUpperCase().replace(/\s+/g, '_')

  const existente = db.prepare('SELECT id FROM workflow_tipos_participacao WHERE codigo = ?').get(codigoNorm)
  if (existente) return NextResponse.json({ error: 'Código já está em uso' }, { status: 409 })

  const result = db.prepare(
    'INSERT INTO workflow_tipos_participacao (nome, codigo, descricao) VALUES (?, ?, ?)'
  ).run(nome.trim(), codigoNorm, descricao?.trim() ?? null)

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
