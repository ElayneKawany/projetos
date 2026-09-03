import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { UsuariosRepository } from '@/lib/repositories'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const db = getDb()
  const aprovacao = db.prepare(`
    SELECT a.*, p.codigo as projeto_codigo, p.nome as projeto_nome
    FROM aprovacoes a
    LEFT JOIN projetos p ON a.projeto_id = p.id
    WHERE a.id = ?
  `).get(Number(id)) as (Record<string, unknown> & { solicitante_id: number | null; aprovador_id: number | null }) | undefined
  if (!aprovacao) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  const ids = [aprovacao.solicitante_id, aprovacao.aprovador_id].filter((v): v is number => v != null)
  const nomes = await UsuariosRepository.findNomesPorIds(ids)
  const aprovacaoComNomes = {
    ...aprovacao,
    solicitante_nome: aprovacao.solicitante_id != null ? nomes.get(aprovacao.solicitante_id)?.nome ?? null : null,
    aprovador_nome: aprovacao.aprovador_id != null ? nomes.get(aprovacao.aprovador_id)?.nome ?? null : null,
  }
  return NextResponse.json({ aprovacao: aprovacaoComNomes })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
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
