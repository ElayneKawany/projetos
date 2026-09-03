import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

// PATCH — corrige a data do pagamento REALIZADO de uma parcela já paga (não a data de
// vencimento, que é independente). Só existe para parcelas com status PAGO; não altera
// vencimento/valor/qtd_parcelas/valor_total/status/percentual pago.
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
  if (parcela.status !== 'PAGO') {
    return NextResponse.json({ error: 'Só é possível corrigir a data de pagamento de uma parcela já paga.' }, { status: 400 })
  }

  const body = await request.json() as { nova_data_pagamento?: string }
  const { nova_data_pagamento } = body

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!nova_data_pagamento || !dateRe.test(nova_data_pagamento)) {
    return NextResponse.json({ error: 'nova_data_pagamento é obrigatória, no formato YYYY-MM-DD.' }, { status: 400 })
  }

  const parcelaComPagamento = parcela as unknown as { data_pagamento: string | null }
  const dataAnterior = parcelaComPagamento.data_pagamento

  CronogramaRepository.corrigirDataPagamentoParcela(parcela_id, nova_data_pagamento)

  CronogramaRepository.insertParcelaHistorico({
    parcela_id,
    cronograma_tarefa_id: parcela.cronograma_tarefa_id,
    projeto_id,
    campo: 'data_pagamento',
    valor_anterior: dataAnterior,
    valor_novo: nova_data_pagamento,
    justificativa: null,
    usuario_id: session.id,
    usuario_nome: session.nome,
  })

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'PAGAMENTO',
    evento:          'ALTERADO',
    titulo:          `Data de pagamento da parcela nº ${parcela.numero} corrigida`,
    descricao:       `Data do pagamento realizado ${dataAnterior ?? '—'} → ${nova_data_pagamento} por ${session.nome} (vencimento não foi alterado)`,
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
    descricao:    `Data de pagamento da parcela nº ${parcela.numero} corrigida: ${dataAnterior ?? '—'} → ${nova_data_pagamento}`,
    dados_antes:  { data_pagamento: dataAnterior },
    dados_depois: { data_pagamento: nova_data_pagamento },
  })

  return NextResponse.json({ ok: true })
}
