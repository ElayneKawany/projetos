import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lancId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, lancId } = await params
  const projeto_id = Number(id)
  const db = getDb()

  const lancamento = db.prepare(
    'SELECT * FROM payback_lancamentos WHERE id = ? AND projeto_id = ?'
  ).get(Number(lancId), projeto_id) as Record<string, unknown> | undefined

  if (!lancamento) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 })

  const body = await request.json()
  const campos = ['competencia', 'data_lancamento', 'investimento_periodo', 'beneficio_periodo', 'tipo_beneficio', 'observacao']
  const sets: string[] = []
  const vals: unknown[] = []

  for (const campo of campos) {
    if (body[campo] !== undefined) {
      sets.push(`${campo} = ?`)
      vals.push(body[campo])
    }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })

  sets.push("updated_at = datetime('now')")
  vals.push(Number(lancId), projeto_id)

  db.prepare(`UPDATE payback_lancamentos SET ${sets.join(', ')} WHERE id = ? AND projeto_id = ?`).run(...vals)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'payback_lancamentos',
    entidade_id: Number(lancId),
    projeto_id,
    descricao: `Lançamento de payback atualizado`,
    dados_antes: lancamento,
    dados_depois: body,
  })

  const atualizado = db.prepare('SELECT * FROM payback_lancamentos WHERE id = ?').get(Number(lancId))
  return NextResponse.json(atualizado)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lancId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, lancId } = await params
  const projeto_id = Number(id)
  const db = getDb()

  const lancamento = db.prepare(
    'SELECT * FROM payback_lancamentos WHERE id = ? AND projeto_id = ?'
  ).get(Number(lancId), projeto_id) as Record<string, unknown> | undefined

  if (!lancamento) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 })

  db.prepare('DELETE FROM payback_lancamentos WHERE id = ?').run(Number(lancId))

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'DELETE',
    entidade: 'payback_lancamentos',
    entidade_id: Number(lancId),
    projeto_id,
    descricao: `Lançamento de payback excluído — competência ${lancamento.competencia}`,
    dados_antes: lancamento,
  })

  return NextResponse.json({ ok: true })
}
