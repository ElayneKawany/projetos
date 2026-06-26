import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, vid } = await params
  const db = getDb()
  const viabilidade = db
    .prepare('SELECT * FROM viabilidade_versoes WHERE id = ? AND projeto_id = ?')
    .get(Number(vid), Number(id))
  if (!viabilidade) return NextResponse.json({ error: 'Viabilidade não encontrada.' }, { status: 404 })
  const body = await request.json()
  const acao: string = body.acao // 'APROVAR' | 'REVISAO'
  const novoStatusVib = acao === 'APROVAR' ? 'APROVADO' : 'RASCUNHO'
  const novoStatusAprov = acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO'
  db.prepare(
    `UPDATE viabilidade_versoes SET status = ?, aprovado_por = ?, aprovado_em = datetime('now') WHERE id = ? AND projeto_id = ?`
  ).run(novoStatusVib, session.id, Number(vid), Number(id))
  db.prepare(
    `UPDATE aprovacoes SET status = ?, aprovador_id = ?, aprovado_em = datetime('now'), observacao_apr = ? WHERE referencia_id = ? AND tipo = 'VIABILIDADE'`
  ).run(novoStatusAprov, session.id, body.observacao || null, Number(vid))
  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: acao === 'APROVAR' ? 'APPROVE' : 'REJECT',
    entidade: 'viabilidade_versoes',
    entidade_id: Number(vid),
    projeto_id: Number(id),
    descricao: `Viabilidade ${acao === 'APROVAR' ? 'aprovada' : 'enviada para revisão'} por ${session.nome}`,
    dados_depois: { acao, observacao: body.observacao },
  })
  return NextResponse.json({ ok: true })
}
