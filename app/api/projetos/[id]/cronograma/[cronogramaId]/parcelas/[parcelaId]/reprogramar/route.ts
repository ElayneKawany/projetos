import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string; parcelaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId, parcelaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)
  const parcela_id    = Number(parcelaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)
  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  const parcela = CronogramaRepository.findParcelaById(parcela_id)
  if (!parcela) return NextResponse.json({ error: 'Parcela não encontrada.' }, { status: 404 })
  if (parcela.status === 'PAGO') {
    return NextResponse.json({ error: 'Parcela já paga não pode ser reprogramada.' }, { status: 400 })
  }

  const body = await request.json() as { nova_data_vencimento?: string; justificativa?: string; tipo?: string }
  const { nova_data_vencimento, justificativa } = body
  const isEdicao = body.tipo === 'EDITAR'

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!nova_data_vencimento || !dateRe.test(nova_data_vencimento)) {
    return NextResponse.json({ error: 'nova_data_vencimento é obrigatória, no formato YYYY-MM-DD.' }, { status: 400 })
  }
  if (!isEdicao && !justificativa?.trim()) {
    return NextResponse.json({ error: 'Justificativa é obrigatória para reprogramar uma parcela.' }, { status: 400 })
  }

  const dataAnterior = parcela.data_vencimento

  if (isEdicao) {
    CronogramaRepository.corrigirDataVencimentoParcela(parcela_id, nova_data_vencimento)
  } else {
    CronogramaRepository.reprogramarParcela(parcela_id, nova_data_vencimento, parcela.data_vencimento_baseline, dataAnterior)
  }

  CronogramaRepository.insertParcelaHistorico({
    parcela_id,
    cronograma_tarefa_id: parcela.cronograma_tarefa_id,
    projeto_id,
    campo: 'data_vencimento',
    valor_anterior: dataAnterior,
    valor_novo: nova_data_vencimento,
    justificativa: justificativa?.trim() || (isEdicao ? 'Correção de data cadastrada incorretamente' : null),
    usuario_id: session.id,
    usuario_nome: session.nome,
  })

  const acaoLabel = isEdicao ? 'corrigida' : 'reprogramada'
  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'PAGAMENTO',
    evento:          'ALTERADO',
    titulo:          `Parcela nº ${parcela.numero} ${acaoLabel}`,
    descricao:       `Vencimento ${dataAnterior} → ${nova_data_vencimento} por ${session.nome}${justificativa?.trim() ? `. Justificativa: ${justificativa.trim()}` : ''}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   parcela_id,
    referencia_tipo: 'cronograma_tarefa_parcela',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'UPDATE',
    entidade:     'cronograma_tarefa_parcelas',
    entidade_id:  parcela_id,
    projeto_id,
    descricao:    `Parcela nº ${parcela.numero} ${acaoLabel}: ${dataAnterior} → ${nova_data_vencimento}${justificativa?.trim() ? `. Justificativa: ${justificativa.trim()}` : ''}`,
    dados_antes:  { data_vencimento: dataAnterior, data_vencimento_baseline: parcela.data_vencimento_baseline },
    dados_depois: { data_vencimento: nova_data_vencimento },
  })

  return NextResponse.json({ ok: true })
}
