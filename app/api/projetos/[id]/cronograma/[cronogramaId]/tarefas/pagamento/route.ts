import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { asyncDb } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import { gerarParcelas, type Periodicidade } from '@/lib/cronograma/parcelas'

const CRONOGRAMA_STATUS_ACEITOS = ['RASCUNHO', 'APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO']
const PERIODICIDADES_VALIDAS: Periodicidade[] = [
  'SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id) as Record<string, unknown> | undefined
  if (!cronograma) {
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  }
  if (!CRONOGRAMA_STATUS_ACEITOS.includes(cronograma.status as string)) {
    return NextResponse.json(
      { error: 'Tarefas de pagamento só podem ser adicionadas a cronogramas aprovados ou em execução.' },
      { status: 400 }
    )
  }

  const body = await request.json() as {
    macro_id?: number | null
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

  const parcelasGeradas = gerarParcelas(valorTotal, qtdParcelas, body.data_primeira_parcela, periodicidade)

  const tarefaId = await asyncDb.transaction(async () => {
    const ordemMax = await CronogramaRepository.maxOrdem(cronograma_id)
    const novaId = Number(await CronogramaRepository.insertTarefa({
      cronograma_id,
      parent_id:      body.macro_id ?? null,
      nivel:          'TAREFA',
      natureza_tarefa: 'PAGAMENTO',
      nome:           body.nome.trim(),
      responsavel_id: body.responsavel_id ?? null,
      observacoes:    body.observacoes ?? null,
      status:         'NAO_INICIADA',
      ordem:          ordemMax + 1,
      criado_por:     session.id,
      alterado_por:   session.id,
    }))

    await CronogramaRepository.insertPagamentoHeader({
      cronograma_tarefa_id:  novaId,
      beneficiario:          body.beneficiario?.trim() || null,
      valor_total:           valorTotal,
      qtd_parcelas:          qtdParcelas,
      periodicidade,
      data_primeira_parcela: body.data_primeira_parcela,
      criado_por:            session.id,
    })

    for (const p of parcelasGeradas) {
      await CronogramaRepository.insertParcela({
        cronograma_tarefa_id: novaId,
        numero:               p.numero,
        valor:                p.valor,
        data_vencimento:      p.data_vencimento,
      })
    }

    return novaId
  })

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'PAGAMENTO',
    evento:          'CRIADO',
    titulo:          `Tarefa de pagamento criada: ${body.nome.trim()}`,
    descricao:       `${qtdParcelas} parcela(s) geradas, totalizando R$ ${valorTotal.toFixed(2)}, por ${session.nome}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   tarefaId,
    referencia_tipo: 'cronograma_tarefa',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'CREATE',
    entidade:     'cronograma_tarefa_pagamento',
    entidade_id:  tarefaId,
    projeto_id,
    descricao:    `Tarefa de pagamento "${body.nome.trim()}" criada com ${qtdParcelas} parcela(s)`,
    dados_depois: { nome: body.nome, beneficiario: body.beneficiario, valor_total: valorTotal, qtd_parcelas: qtdParcelas, periodicidade },
  })

  return NextResponse.json({ ok: true, id: tarefaId }, { status: 201 })
}
