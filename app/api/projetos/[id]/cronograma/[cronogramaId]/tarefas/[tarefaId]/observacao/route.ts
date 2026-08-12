import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import { registrarHistoricoAlteracao } from '@/lib/projetos'
import { getDb } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string; tarefaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId, tarefaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)
  const tarefa_id     = Number(tarefaId)

  const body = await request.json().catch(() => ({}))
  const nova_observacao: string = (body?.observacao ?? '').trim()

  const cronograma = CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)
  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  const item = CronogramaRepository.findTarefaByIdAndCronograma(tarefa_id, cronograma_id)
  if (!item) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })

  const obs_anterior: string = (item.observacoes as string | null) ?? ''

  if (obs_anterior === nova_observacao) {
    return NextResponse.json({ ok: true, changed: false })
  }

  const db = getDb()
  db.prepare(
    `UPDATE cronograma_tarefas SET observacoes = ?, alterado_por = ?, alterado_em = datetime('now','localtime') WHERE id = ?`
  ).run(nova_observacao || null, session.id, tarefa_id)

  registrarHistoricoAlteracao({
    projeto_id,
    usuario_id:   session.id,
    usuario_nome: session.nome,
    campo:        `Observação — ${item.nome}`,
    valor_anterior: obs_anterior || null,
    valor_novo:     nova_observacao || null,
    acao:           'UPDATE',
  })

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'CRONOGRAMA',
    evento:          'ALTERADO',
    titulo:          `Observação atualizada: ${item.nome}`,
    descricao:       `Por ${session.nome}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   tarefa_id,
    referencia_tipo: 'cronograma_tarefa',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'UPDATE',
    entidade:     'cronograma_tarefas',
    entidade_id:  tarefa_id,
    projeto_id,
    descricao:    `Observação de "${item.nome}" atualizada por ${session.nome}`,
    dados_antes:  { observacoes: obs_anterior || null },
    dados_depois: { observacoes: nova_observacao || null },
  })

  return NextResponse.json({ ok: true, changed: true })
}
