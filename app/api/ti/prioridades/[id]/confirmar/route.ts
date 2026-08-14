import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'CEO', 'DIRETOR'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão para confirmar prioridade' }, { status: 403 })
  }

  const { id } = await params
  const prioridadeId = parseInt(id)
  if (isNaN(prioridadeId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { comite_id } = body

  if (!comite_id) return NextResponse.json({ error: 'comite_id é obrigatório' }, { status: 400 })

  const db = getDb()
  const existente = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(prioridadeId) as any
  if (!existente) return NextResponse.json({ error: 'Prioridade não encontrada' }, { status: 404 })

  if (existente.prioridade === null || existente.prioridade === undefined) {
    return NextResponse.json({ error: 'Defina a prioridade antes de confirmar' }, { status: 400 })
  }

  db.prepare(`
    UPDATE ti_prioridades
    SET confirmada = 1,
        confirmada_em = datetime('now'),
        confirmada_por = ?,
        confirmada_por_nome = ?,
        confirmada_comite_id = ?,
        solicitacao_alteracao = 0,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(session.id, session.nome, comite_id, prioridadeId)

  const updated = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(prioridadeId)
  return NextResponse.json({ prioridade: updated })
}
