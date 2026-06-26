import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const db = getDb()
  const aprovacao = db.prepare(`
    SELECT a.*, p.codigo as projeto_codigo, p.nome as projeto_nome,
           s.nome as solicitante_nome, ap.nome as aprovador_nome
    FROM aprovacoes a
    LEFT JOIN projetos p ON a.projeto_id = p.id
    LEFT JOIN usuarios s ON a.solicitante_id = s.id
    LEFT JOIN usuarios ap ON a.aprovador_id = ap.id
    WHERE a.id = ?
  `).get(Number(id))
  if (!aprovacao) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  return NextResponse.json({ aprovacao })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const db = getDb()
  const body = await request.json()
  const { status, observacao } = body

  db.prepare(`
    UPDATE aprovacoes SET status = ?, aprovador_id = ?, aprovado_em = datetime('now'), observacao_apr = ? WHERE id = ?
  `).run(status, session.id, observacao || null, Number(id))

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: status === 'APROVADO' ? 'APPROVE' : 'REJECT',
    entidade: 'aprovacoes',
    entidade_id: Number(id),
    descricao: `Aprovacao ${status}${observacao ? ': ' + observacao : ''}`,
    dados_depois: { status, observacao },
  })
  return NextResponse.json({ ok: true })
}
