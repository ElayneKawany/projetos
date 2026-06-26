import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, tapId } = await params
  const db = getDb()
  const tap = db
    .prepare('SELECT * FROM tap_versoes WHERE id = ? AND projeto_id = ?')
    .get(Number(tapId), Number(id))
  if (!tap) return NextResponse.json({ error: 'TAP não encontrado.' }, { status: 404 })
  const body = await request.json()
  const acao: string = body.acao // 'APROVAR' | 'REVISAO'
  const novoStatusTap = acao === 'APROVAR' ? 'APROVADO' : 'RASCUNHO'
  const novoStatusAprov = acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO'
  db.prepare(
    `UPDATE tap_versoes SET status = ?, aprovado_por = ?, aprovado_em = datetime('now') WHERE id = ? AND projeto_id = ?`
  ).run(novoStatusTap, session.id, Number(tapId), Number(id))
  db.prepare(
    `UPDATE aprovacoes SET status = ?, aprovador_id = ?, aprovado_em = datetime('now'), observacao_apr = ? WHERE referencia_id = ? AND tipo = 'TAP'`
  ).run(novoStatusAprov, session.id, body.observacao || null, Number(tapId))
  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: acao === 'APROVAR' ? 'APPROVE' : 'REJECT',
    entidade: 'tap_versoes',
    entidade_id: Number(tapId),
    projeto_id: Number(id),
    descricao: `TAP ${acao === 'APROVAR' ? 'aprovado' : 'enviado para revisão'} por ${session.nome}`,
    dados_depois: { acao, observacao: body.observacao },
  })
  return NextResponse.json({ ok: true })
}
