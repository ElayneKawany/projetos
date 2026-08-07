import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = getDb()
  const modelos = db.prepare(
    'SELECT * FROM workflow_modelos WHERE ativo = 1 ORDER BY nome'
  ).all() as { id: number }[]

  const stmt = db.prepare(
    'SELECT * FROM workflow_modelo_etapas WHERE modelo_id = ? ORDER BY ordem'
  )
  return NextResponse.json(
    modelos.map(m => ({ ...m, etapas: stmt.all(m.id) }))
  )
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { nome, descricao, etapas } = await request.json() as {
    nome: string
    descricao?: string
    etapas: { ordem: number; usuario_id: number; usuario_nome: string; tipo: string }[]
  }

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!etapas?.length) return NextResponse.json({ error: 'O modelo deve ter pelo menos uma etapa' }, { status: 400 })

  const db = getDb()
  const modeloId = db.prepare(
    'INSERT INTO workflow_modelos (nome, descricao, criado_por, criado_por_nome) VALUES (?, ?, ?, ?)'
  ).run(nome.trim(), descricao?.trim() ?? null, session.id, session.nome).lastInsertRowid

  const insEtapa = db.prepare(
    'INSERT INTO workflow_modelo_etapas (modelo_id, ordem, usuario_id, usuario_nome, tipo) VALUES (?, ?, ?, ?, ?)'
  )
  for (const e of etapas) {
    insEtapa.run(modeloId, e.ordem, e.usuario_id, e.usuario_nome, e.tipo)
  }

  return NextResponse.json({ id: modeloId }, { status: 201 })
}
