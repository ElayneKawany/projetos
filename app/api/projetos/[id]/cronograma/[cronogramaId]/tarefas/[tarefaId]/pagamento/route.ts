import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import { gerarParcelas, avancarData, type Periodicidade } from '@/lib/cronograma/parcelas'
import getDb from '@/lib/db'

const PERIODICIDADES_VALIDAS: Periodicidade[] = [
  'SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL',
]

async function carregarTarefaPagamento(id: string, cronogramaId: string, tarefaId: string) {
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)
  const tarefa_id     = Number(tarefaId)
  const cronograma = CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)
  const tarefa = CronogramaRepository.findTarefaByIdAndCronograma(tarefa_id, cronograma_id) as Record<string, unknown> | undefined
  return { projeto_id, cronograma_id, tarefa_id, cronograma, tarefa }
}

// ─── PATCH — Alterar Tarefa de Pagamento ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string; tarefaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId, tarefaId } = await params
  const { projeto_id, cronograma_id, tarefa_id, cronograma, tarefa } =
    await carregarTarefaPagamento(id, cronogramaId, tarefaId)

  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (!tarefa || (tarefa.ativo != null && tarefa.ativo === 0)) {
    return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })
  }
  if (tarefa.natureza_tarefa !== 'PAGAMENTO') {
    return NextResponse.json({ error: 'Esta ação só é válida para Tarefa de Pagamento.' }, { status: 400 })
  }

  const body = await request.json() as {
    nome: string
    beneficiario?: string | null
    valor_total: number
    qtd_parcelas: number
    periodicidade?: string
    data_primeira_parcela: string
    responsavel_id?: number | null
    observacoes?: string | null
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome/descrição do pagamento é obrigatório.' }, { status: 400 })
  }
  const valorTotal = Number(body.valor_total)
  if (!valorTotal || valorTotal <= 0) {
    return NextResponse.json({ error: 'Valor total deve ser maior que zero.' }, { status: 400 })
  }
  const qtdParcelas = Number(body.qtd_parcelas)
  if (!qtdParcelas || qtdParcelas <= 0 || !Number.isInteger(qtdParcelas)) {
    return NextResponse.json({ error: 'Quantidade de parcelas deve ser um número inteiro maior que zero.' }, { status: 400 })
  }
  if (!body.data_primeira_parcela) {
    return NextResponse.json({ error: 'Data da primeira parcela é obrigatória.' }, { status: 400 })
  }
  const periodicidade = (body.periodicidade ?? 'MENSAL') as Periodicidade
  if (!PERIODICIDADES_VALIDAS.includes(periodicidade)) {
    return NextResponse.json({ error: 'Periodicidade inválida.' }, { status: 400 })
  }

  const parcelasAtuais = CronogramaRepository.findParcelasByTarefaIds([tarefa_id])
  const pagas      = parcelasAtuais.filter(p => p.status === 'PAGO')
  const qtdPagas   = pagas.length
  const somaPagasCentavos = pagas.reduce((s, p) => s + Math.round(p.valor * 100), 0)
  const somaPagas  = somaPagasCentavos / 100

  if (qtdParcelas < qtdPagas) {
    return NextResponse.json(
      { error: `Não é possível reduzir para menos que as ${qtdPagas} parcela(s) já paga(s).` },
      { status: 400 }
    )
  }
  if (Math.round(valorTotal * 100) < somaPagasCentavos) {
    return NextResponse.json(
      { error: `O novo valor total não pode ser menor que o valor já pago (R$ ${somaPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).` },
      { status: 400 }
    )
  }

  const headerAntes = CronogramaRepository.findPagamentoHeaderByTarefaIds([tarefa_id])[0]

  const qtdPendentesNovas    = qtdParcelas - qtdPagas
  const valorRestanteCentavos = Math.round(valorTotal * 100) - somaPagasCentavos
  const valorRestante        = valorRestanteCentavos / 100
  const dataAncora           = avancarData(body.data_primeira_parcela, periodicidade, qtdPagas)

  const novasParcelas = qtdPendentesNovas > 0
    ? gerarParcelas(valorRestante, qtdPendentesNovas, dataAncora, periodicidade)
    : []

  const db = getDb()
  db.transaction(() => {
    CronogramaRepository.updateTarefaBasico(tarefa_id, cronograma_id, {
      nome:           body.nome.trim(),
      observacoes:    body.observacoes ?? null,
      responsavel_id: body.responsavel_id ?? null,
      alterado_por:   session.id,
    })

    CronogramaRepository.updatePagamentoHeader(tarefa_id, {
      beneficiario:           body.beneficiario?.trim() || null,
      valor_total:            valorTotal,
      qtd_parcelas:           qtdParcelas,
      periodicidade,
      data_primeira_parcela:  body.data_primeira_parcela,
    })

    CronogramaRepository.deleteParcelasPendentes(tarefa_id)

    for (const p of novasParcelas) {
      CronogramaRepository.insertParcela({
        cronograma_tarefa_id: tarefa_id,
        numero:               qtdPagas + p.numero,
        valor:                p.valor,
        data_vencimento:      p.data_vencimento,
      })
    }
  })()

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'PAGAMENTO',
    evento:          'ALTERADO',
    titulo:          `Tarefa de pagamento alterada: ${body.nome.trim()}`,
    descricao:       `Novo valor total: R$ ${valorTotal.toFixed(2)}, ${qtdParcelas} parcela(s) (${qtdPagas} já paga(s) preservada(s)), por ${session.nome}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   tarefa_id,
    referencia_tipo: 'cronograma_tarefa',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'UPDATE',
    entidade:     'cronograma_tarefa_pagamento',
    entidade_id:  tarefa_id,
    projeto_id,
    descricao:    `Tarefa de pagamento "${body.nome.trim()}" alterada`,
    dados_antes:  headerAntes,
    dados_depois: { nome: body.nome, beneficiario: body.beneficiario, valor_total: valorTotal, qtd_parcelas: qtdParcelas, periodicidade },
  })

  return NextResponse.json({ ok: true })
}

// ─── DELETE — Excluir Tarefa de Pagamento (somente ADMIN/PMO) ─────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string; tarefaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'cronograma:excluir_pagamento')) {
    return NextResponse.json({ error: 'Sem permissão para excluir tarefa de pagamento.' }, { status: 403 })
  }

  const { id, cronogramaId, tarefaId } = await params
  const { projeto_id, tarefa_id, cronograma, tarefa } =
    await carregarTarefaPagamento(id, cronogramaId, tarefaId)

  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (!tarefa || (tarefa.ativo != null && tarefa.ativo === 0)) {
    return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })
  }
  if (tarefa.natureza_tarefa !== 'PAGAMENTO') {
    return NextResponse.json({ error: 'Esta ação só é válida para Tarefa de Pagamento.' }, { status: 400 })
  }

  CronogramaRepository.softDeleteTarefa(tarefa_id, session.id)

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'PAGAMENTO',
    evento:          'ALTERADO',
    titulo:          `Tarefa de pagamento excluída: ${tarefa.nome}`,
    descricao:       `Excluída por ${session.nome} (perfil ${session.perfil})`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   tarefa_id,
    referencia_tipo: 'cronograma_tarefa',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'DELETE_SOFT',
    entidade:     'cronograma_tarefa_pagamento',
    entidade_id:  tarefa_id,
    projeto_id,
    descricao:    `Tarefa de pagamento "${tarefa.nome}" excluída (soft-delete) por ${session.nome}`,
    dados_antes:  { id: tarefa_id, nome: tarefa.nome },
  })

  return NextResponse.json({ ok: true })
}
