import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const prioridadeId = parseInt(id)
  if (isNaN(prioridadeId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { nova_prioridade, motivo } = body

  if (nova_prioridade === undefined || typeof nova_prioridade !== 'number' || nova_prioridade < 0 || nova_prioridade > 4) {
    return NextResponse.json({ error: 'nova_prioridade deve ser um número entre 0 e 4' }, { status: 400 })
  }
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'motivo é obrigatório' }, { status: 400 })
  }

  const db = getDb()
  const existente = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(prioridadeId) as any
  if (!existente) return NextResponse.json({ error: 'Prioridade não encontrada' }, { status: 404 })

  if (!existente.confirmada) {
    return NextResponse.json({ error: 'Só é possível solicitar alteração de prioridades já confirmadas' }, { status: 400 })
  }

  if (existente.solicitacao_alteracao) {
    return NextResponse.json({ error: 'Já existe uma solicitação de alteração pendente' }, { status: 409 })
  }

  db.prepare(`
    UPDATE ti_prioridades
    SET solicitacao_alteracao = 1,
        solicitacao_por = ?,
        solicitacao_por_nome = ?,
        solicitacao_em = datetime('now'),
        solicitacao_motivo = ?,
        solicitacao_nova_prioridade = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(session.id, session.nome, motivo, nova_prioridade, prioridadeId)

  const updated = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(prioridadeId)
  return NextResponse.json({ prioridade: updated })
}
