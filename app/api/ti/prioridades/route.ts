import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = getDb()
  const rows = db.prepare('SELECT * FROM ti_prioridades ORDER BY updated_at DESC').all()
  return NextResponse.json({ prioridades: rows })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { atividade_id, fonte = 'dev2026', prioridade } = body

  if (atividade_id === undefined || prioridade === undefined) {
    return NextResponse.json({ error: 'atividade_id e prioridade são obrigatórios' }, { status: 400 })
  }
  if (typeof prioridade !== 'number' || prioridade < 0 || prioridade > 4) {
    return NextResponse.json({ error: 'prioridade deve ser um número entre 0 e 4' }, { status: 400 })
  }

  const db = getDb()
  const existente = db.prepare('SELECT * FROM ti_prioridades WHERE atividade_id = ? AND fonte = ?').get(atividade_id, fonte) as any

  if (existente?.confirmada === 1) {
    return NextResponse.json({ error: 'Prioridade confirmada — não pode ser alterada diretamente. Use "Solicitar Alteração" ou defina em novo Comitê.' }, { status: 409 })
  }

  if (existente) {
    db.prepare(`
      UPDATE ti_prioridades SET prioridade = ?, updated_at = datetime('now') WHERE id = ?
    `).run(prioridade, existente.id)
    const updated = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(existente.id)
    return NextResponse.json({ prioridade: updated })
  } else {
    const result = db.prepare(`
      INSERT INTO ti_prioridades (atividade_id, fonte, prioridade) VALUES (?, ?, ?)
    `).run(atividade_id, fonte, prioridade)
    const created = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json({ prioridade: created }, { status: 201 })
  }
}
