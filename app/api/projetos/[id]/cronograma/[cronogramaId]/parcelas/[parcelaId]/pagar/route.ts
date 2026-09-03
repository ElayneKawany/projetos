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
    return NextResponse.json({ error: 'Esta parcela já está marcada como paga.' }, { status: 400 })
  }

  const body = await request.json() as { data_pagamento?: string }
  const dataPagamento = body.data_pagamento || new Date().toISOString().slice(0, 10)

  CronogramaRepository.marcarParcelaPaga(parcela_id, dataPagamento, session.id)

  CronogramaRepository.insertParcelaHistorico({
    parcela_id,
    cronograma_tarefa_id: parcela.cronograma_tarefa_id,
    projeto_id,
    campo: 'status',
    valor_anterior: parcela.status,
    valor_novo: 'PAGO',
    justificativa: null,
    usuario_id: session.id,
    usuario_nome: session.nome,
  })

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'PAGAMENTO',
    evento:          'PAGO',
    titulo:          `Parcela nº ${parcela.numero} marcada como paga`,
    descricao:       `Parcela nº ${parcela.numero} (R$ ${parcela.valor.toFixed(2)}) paga em ${dataPagamento} por ${session.nome}`,
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
    descricao:    `Parcela nº ${parcela.numero} marcada como paga em ${dataPagamento}`,
    dados_antes:  { status: parcela.status },
    dados_depois: { status: 'PAGO', data_pagamento: dataPagamento, pago_por: session.id },
  })

  return NextResponse.json({ ok: true })
}
