import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

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

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)
  if (!cronograma)
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  const tarefa = CronogramaRepository.findTarefaByIdAndCronograma(tarefa_id, cronograma_id) as
    Record<string, unknown> | undefined
  if (!tarefa)
    return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })

  const body = await request.json()
  const { nova_data, nova_data_inicio, justificativa } = body as { nova_data?: string; nova_data_inicio?: string; justificativa?: string }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!nova_data && !nova_data_inicio) {
    return NextResponse.json({ error: 'Informe nova_data e/ou nova_data_inicio no formato YYYY-MM-DD.' }, { status: 400 })
  }
  if (nova_data && !dateRe.test(nova_data)) {
    return NextResponse.json({ error: 'nova_data deve estar no formato YYYY-MM-DD.' }, { status: 400 })
  }
  if (nova_data_inicio && !dateRe.test(nova_data_inicio)) {
    return NextResponse.json({ error: 'nova_data_inicio deve estar no formato YYYY-MM-DD.' }, { status: 400 })
  }

  const dataFimAtual        = tarefa.data_fim as string | null
  const dataFimBaselineAtual = tarefa.data_fim_baseline as string | null
  const dataInicioAtual     = tarefa.data_inicio as string | null
  const dataInicioBaselineAtual = tarefa.data_inicio_baseline as string | null

  const novoBaselineFim    = nova_data        ? (dataFimBaselineAtual    ?? dataFimAtual)    : dataFimBaselineAtual
  const novoBaselineInicio = nova_data_inicio ? (dataInicioBaselineAtual ?? dataInicioAtual) : dataInicioBaselineAtual
  const novoFim    = nova_data        ?? dataFimAtual
  const novoInicio = nova_data_inicio ?? dataInicioAtual

  const db = getDb()
  db.prepare(
    `UPDATE cronograma_tarefas
     SET data_inicio = ?, data_inicio_baseline = ?,
         data_fim = ?, data_fim_baseline = ?,
         alterado_por = ?, alterado_em = datetime('now')
     WHERE id = ? AND cronograma_id = ?`
  ).run(novoInicio, novoBaselineInicio, novoFim, novoBaselineFim, session.id, tarefa_id, cronograma_id)

  const partesFim    = nova_data        ? `data_fim ${dataFimAtual ?? '—'} → ${nova_data}` : null
  const partesInicio = nova_data_inicio ? `data_inicio ${dataInicioAtual ?? '—'} → ${nova_data_inicio}` : null
  const descParts    = [partesInicio, partesFim].filter(Boolean).join('; ')

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'CRONOGRAMA',
    evento:          'ALTERADO',
    titulo:          'Tarefa reprogramada',
    descricao:       `"${tarefa.nome}" reprogramada: ${descParts} por ${session.nome}${justificativa ? `. Justificativa: ${justificativa}` : ''}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   cronograma_id,
    referencia_tipo: 'cronograma',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'UPDATE',
    entidade:     'cronograma_tarefas',
    entidade_id:  tarefa_id,
    projeto_id,
    descricao:    `Tarefa reprogramada: ${descParts}${justificativa ? `. Justificativa: ${justificativa}` : ''}`,
    dados_antes:  { data_inicio: dataInicioAtual, data_inicio_baseline: dataInicioBaselineAtual, data_fim: dataFimAtual, data_fim_baseline: dataFimBaselineAtual },
    dados_depois: { data_inicio: novoInicio,      data_inicio_baseline: novoBaselineInicio,      data_fim: novoFim,    data_fim_baseline: novoBaselineFim },
  })

  return NextResponse.json({ ok: true })
}
