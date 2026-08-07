import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)
  const body = await req.json()
  const { data, valor_real, origem = 'manual', observacao } = body

  if (!data || valor_real === undefined || valor_real === null) {
    return NextResponse.json({ error: 'data e valor_real são obrigatórios' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO payback_registros (projeto_id, data, valor_real, origem, observacao, criado_por)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projetoId, data, Number(valor_real), origem, observacao ?? null, session.id)

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
