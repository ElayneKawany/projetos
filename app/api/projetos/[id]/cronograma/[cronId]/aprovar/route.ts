import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cronId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, cronId } = await params
  const db = getDb()
  const cronograma = db
    .prepare('SELECT * FROM cronogramas WHERE id = ? AND projeto_id = ?')
    .get(Number(cronId), Number(id))
  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  db.prepare(
    `UPDATE cronogramas
     SET is_baseline = 1, aprovado_por = ?, aprovado_em = datetime('now'), status = 'APROVADO'
     WHERE id = ? AND projeto_id = ?`
  ).run(session.id, Number(cronId), Number(id))

  db.prepare(
    `UPDATE aprovacoes
     SET status = 'APROVADO', aprovador_id = ?, aprovado_em = datetime('now')
     WHERE referencia_id = ? AND tipo = 'CRONOGRAMA'`
  ).run(session.id, Number(cronId))

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'APPROVE',
    entidade: 'cronogramas',
    entidade_id: Number(cronId),
    projeto_id: Number(id),
    descricao: `Cronograma aprovado como baseline por ${session.nome}`,
    dados_depois: { is_baseline: true },
  })

  return NextResponse.json({ ok: true })
}
