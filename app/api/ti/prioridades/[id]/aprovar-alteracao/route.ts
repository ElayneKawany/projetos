import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

// Aprovação da alteração de prioridade (requer ADMIN, PMO, CEO ou DIRETOR)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'CEO', 'DIRETOR'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão para aprovar alteração de prioridade' }, { status: 403 })
  }

  const { id } = await params
  const prioridadeId = parseInt(id)
  if (isNaN(prioridadeId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { aprovado } = body  // true = aprova, false = rejeita

  const db = getDb()
  const existente = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(prioridadeId) as any
  if (!existente) return NextResponse.json({ error: 'Prioridade não encontrada' }, { status: 404 })

  if (!existente.solicitacao_alteracao) {
    return NextResponse.json({ error: 'Não há solicitação de alteração pendente' }, { status: 400 })
  }

  if (aprovado) {
    db.prepare(`
      UPDATE ti_prioridades
      SET prioridade = ?,
          confirmada = 0,
          solicitacao_alteracao = 0,
          solicitacao_por = NULL,
          solicitacao_por_nome = NULL,
          solicitacao_em = NULL,
          solicitacao_motivo = NULL,
          solicitacao_nova_prioridade = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(existente.solicitacao_nova_prioridade, prioridadeId)
  } else {
    // Rejeitada: apenas cancela a solicitação
    db.prepare(`
      UPDATE ti_prioridades
      SET solicitacao_alteracao = 0,
          solicitacao_por = NULL,
          solicitacao_por_nome = NULL,
          solicitacao_em = NULL,
          solicitacao_motivo = NULL,
          solicitacao_nova_prioridade = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(prioridadeId)
  }

  const updated = db.prepare('SELECT * FROM ti_prioridades WHERE id = ?').get(prioridadeId)
  return NextResponse.json({ prioridade: updated, aprovado })
}
