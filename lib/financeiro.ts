import { registrarAuditoria } from './db/auditoria'
import { FinanceiroRepository } from './repositories/financeiro'
import type { TotaisOrcamento } from './orcamento'

// ============================================================
// CÁLCULOS FINANCEIROS (sem inventar premissas)
// ============================================================

export function calcularROI(investimento: number, beneficioLiquido: number): number | null {
  if (!investimento || investimento === 0) return null
  return ((beneficioLiquido - investimento) / investimento) * 100
}

export function calcularTIR(fluxos: number[], maxIteracoes = 1000): number | null {
  if (!fluxos.length || fluxos[0] >= 0) return null

  // Método Newton-Raphson
  let tir = 0.1
  for (let i = 0; i < maxIteracoes; i++) {
    let vpl = 0
    let dvpl = 0
    for (let t = 0; t < fluxos.length; t++) {
      vpl  += fluxos[t] / Math.pow(1 + tir, t)
      dvpl -= t * fluxos[t] / Math.pow(1 + tir, t + 1)
    }
    const delta = vpl / dvpl
    tir -= delta
    if (Math.abs(delta) < 1e-7) return tir * 100
  }
  return null
}

export function calcularPayback(investimento: number, fluxoAnual: number[]): number | null {
  if (!investimento || !fluxoAnual.length) return null
  let acumulado = -investimento
  for (let m = 0; m < fluxoAnual.length * 12; m++) {
    const mesDoAno = m % 12
    const anoIdx = Math.floor(m / 12)
    if (anoIdx >= fluxoAnual.length) break
    acumulado += fluxoAnual[anoIdx] / 12
    if (acumulado >= 0) return m + 1
  }
  return null
}

// ============================================================
// VIABILIDADE
// ============================================================

export async function salvarViabilidade(dados: {
  projeto_id: number
  selic?: number
  taxa_desconto?: number
  inflacao?: number
  investimento_total?: number
  receitas_previstas?: unknown
  custos_previstos?: unknown
  economia_prevista?: unknown
  impacto_operacional?: string
  recursos_necessarios?: string
  mudanca_processo?: string
  tecnologias?: string
  integracoes?: string
  infraestrutura?: string
  riscos?: unknown
  impactos?: unknown
  data_inicio_prev?: string
  data_fim_prev?: string
  marcos?: unknown
  criado_por: number
}): Promise<number> {
  // Calcular indicadores com os dados informados pelo usuário
  let roi: number | null = null
  let tir: number | null = null
  let payback: number | null = null

  if (dados.investimento_total && dados.receitas_previstas) {
    const receitas = dados.receitas_previstas as { ano: number; valor: number }[]
    const custos = (dados.custos_previstos as { ano: number; valor: number }[] | null) || []

    const totalBeneficio = receitas.reduce((acc, r) => acc + r.valor, 0)
    const totalCusto = custos.reduce((acc, c) => acc + c.valor, 0)
    roi = calcularROI(dados.investimento_total, totalBeneficio - totalCusto)

    if (dados.taxa_desconto) {
      const fluxos = [-dados.investimento_total, ...receitas.map((r, i) => r.valor - (custos[i]?.valor || 0))]
      tir = calcularTIR(fluxos)
      payback = calcularPayback(dados.investimento_total, receitas.map((r, i) => r.valor - (custos[i]?.valor || 0)))
    }
  }

  // Verificar se já existe versão rascunho
  const existente = await FinanceiroRepository.findViabilidadeRascunho(dados.projeto_id)

  const jsonFields = {
    receitas_previstas: JSON.stringify(dados.receitas_previstas),
    custos_previstos:   JSON.stringify(dados.custos_previstos),
    economia_prevista:  JSON.stringify(dados.economia_prevista),
    riscos:             JSON.stringify(dados.riscos),
    impactos:           JSON.stringify(dados.impactos),
    marcos:             JSON.stringify(dados.marcos),
  }

  if (existente) {
    await FinanceiroRepository.updateViabilidade(existente.id, {
      ...dados,
      ...jsonFields,
      roi, tir, payback_meses: payback,
    })
    return existente.id
  } else {
    const versao = await FinanceiroRepository.maxVersaoViabilidade(dados.projeto_id) + 1
    return Number(await FinanceiroRepository.insertViabilidade({
      ...dados,
      ...jsonFields,
      versao,
      roi, tir, payback_meses: payback,
    }))
  }
}

export function criarLancamento(dados: {
  projeto_id: number
  tipo: 'CAPEX' | 'OPEX'
  categoria: string
  descricao: string
  fornecedor?: string
  numero_doc?: string
  valor: number
  data_lancamento: string
  competencia?: string
  observacoes?: string
  arquivo_path?: string
  criado_por: number
}): number {
  const id = Number(FinanceiroRepository.insertLancamento(dados))

  registrarAuditoria({
    usuario_id: dados.criado_por,
    acao: 'CREATE',
    entidade: 'financeiro_lancamentos',
    entidade_id: id,
    projeto_id: dados.projeto_id,
    descricao: `Lançamento ${dados.tipo} R$ ${dados.valor.toFixed(2)}: ${dados.descricao}`,
  })

  return id
}

export function buscarResumoFinanceiro(projeto_id: number) {
  const proj = FinanceiroRepository.findProjetoCapexOpex(projeto_id)
  if (!proj) return null

  const capexReal = FinanceiroRepository.sumLancamentosAprovados(projeto_id, 'CAPEX')
  const opexReal  = FinanceiroRepository.sumLancamentosAprovados(projeto_id, 'OPEX')

  return {
    capex_planejado: proj.capex_aprovado,
    capex_realizado: capexReal,
    capex_saldo:     proj.capex_aprovado - capexReal,
    opex_planejado:  proj.opex_aprovado,
    opex_realizado:  opexReal,
    opex_saldo:      proj.opex_aprovado - opexReal,
  }
}

// ============================================================
// INDICADORES FINANCEIROS COMPARTILHADOS
// Utilizados por: Financeiro, Dashboard, Payback, Encerramento
// ============================================================

/**
 * Calcula o saldo disponível de um item/grupo de orçamento.
 *
 * O saldo é reduzido pelo valor comprometido (movimentos não cancelados),
 * não apenas pelo valor pago. Isso reflete a realidade gerencial do projeto.
 *
 * @param valor_previsto - Valor aprovado no orçamento (R$)
 * @param valor_comprometido - Soma dos movimentos ativos (R$)
 * @returns Saldo disponível (pode ser negativo se houver estouro)
 *
 * @usedBy FinanceiroTab — saldo por item e grupo
 * @usedBy CardFinanceiro — exibição do saldo na barra de progresso
 * @usedBy Dashboard Executivo — indicadores de saldo do portfólio
 *
 * @example
 * ```ts
 * const saldo = calcularSaldo(100000, 35000) // → 65000
 * const estourado = calcularSaldo(100000, 115000) // → -15000 (saldo negativo)
 * ```
 */
export function calcularSaldo(valor_previsto: number, valor_comprometido: number): number {
  return valor_previsto - valor_comprometido
}

/**
 * Calcula o percentual executado em relação ao valor previsto.
 *
 * Retorna 0 se o previsto for zero para evitar divisão por zero.
 * Pode retornar valores acima de 100% em caso de estouro orçamentário.
 *
 * @param valor_previsto - Valor aprovado no orçamento (R$)
 * @param valor_executado - Valor efetivamente executado (R$)
 * @returns Percentual de 0 a N (ex: 85.5 para 85,5%)
 *
 * @usedBy CardFinanceiro — barra de progresso
 * @usedBy FinanceiroTab — coluna % da tabela de resumo
 * @usedBy Dashboard Executivo — gauge de execução
 *
 * @example
 * ```ts
 * const pct = calcularPercentualExecutado(100000, 75000) // → 75
 * const estouro = calcularPercentualExecutado(100000, 110000) // → 110
 * ```
 */
export function calcularPercentualExecutado(valor_previsto: number, valor_executado: number): number {
  if (!valor_previsto || valor_previsto === 0) return 0
  return (valor_executado / valor_previsto) * 100
}

/**
 * Tipos dos indicadores financeiros completos de um item ou grupo.
 * Preparado para contemplar todos os estados do ciclo financeiro.
 */
export interface IndicadoresFinanceiros {
  /** Valor aprovado no orçamento — fonte: orcamento_itens.valor_aprovado */
  valor_previsto: number
  /** Soma de movimentos ativos (PENDENTE + APROVADO) — representa compromisso */
  valor_comprometido: number
  /** Soma de movimentos APROVADOS — documentos confirmados */
  valor_executado: number
  /** Soma de pagamentos efetivados — fonte: financeiro_pagamentos */
  valor_pago: number
  /** Previsto - Comprometido */
  saldo_disponivel: number
  /** Percentual comprometido em relação ao previsto */
  percentual_comprometido: number
  /** Percentual executado em relação ao previsto */
  percentual_executado: number
  /** Percentual pago em relação ao previsto */
  percentual_pago: number
}

/**
 * Calcula todos os indicadores financeiros de um item de orçamento.
 *
 * Esta função é a fonte canônica de indicadores — qualquer painel que
 * precise exibir Previsto, Comprometido, Executado, Pago ou Saldo deve
 * usar esta função ou `calcularIndicadoresGrupo`.
 *
 * @param item_id - ID do item de orçamento
 * @param valor_previsto - Valor aprovado para o item
 * @returns Indicadores financeiros completos
 *
 * @usedBy FinanceiroTab — detalhamento por item
 * @usedBy CardFinanceiro — dados do card
 * @usedBy Payback — base para cálculo de retorno
 *
 * @example
 * ```ts
 * const ind = calcularIndicadoresItem(itemId, item.valor_aprovado)
 * console.log(`Saldo: R$ ${ind.saldo_disponivel}`)
 * console.log(`Executado: ${ind.percentual_executado.toFixed(1)}%`)
 * ```
 */
export function calcularIndicadoresItem(
  item_id: number,
  valor_previsto: number
): IndicadoresFinanceiros {
  const comprometido = FinanceiroRepository.sumMovimentosItem(item_id, ['PENDENTE', 'APROVADO'])
  const executado    = FinanceiroRepository.sumMovimentosItem(item_id, ['APROVADO'])
  const pago         = FinanceiroRepository.sumPagamentosItem(item_id)

  return {
    valor_previsto,
    valor_comprometido:       comprometido,
    valor_executado:          executado,
    valor_pago:               pago,
    saldo_disponivel:         calcularSaldo(valor_previsto, comprometido),
    percentual_comprometido:  calcularPercentualExecutado(valor_previsto, comprometido),
    percentual_executado:     calcularPercentualExecutado(valor_previsto, executado),
    percentual_pago:          calcularPercentualExecutado(valor_previsto, pago),
  }
}

/**
 * Calcula os indicadores financeiros consolidados de um projeto inteiro.
 *
 * @param projeto_id - ID do projeto
 * @param totais - Totais do orçamento calculados via calcularTotaisOrcamento()
 * @returns Indicadores financeiros consolidados do projeto
 *
 * @usedBy FinanceiroTab — painel executivo (cabeçalho KPIs)
 * @usedBy Dashboard Executivo — indicadores do portfólio
 * @usedBy Encerramento — comparativo previsto × realizado
 *
 * @example
 * ```ts
 * import { calcularTotaisOrcamento } from '@/lib/orcamento'
 * import { calcularIndicadoresProjeto } from '@/lib/financeiro'
 *
 * const totais = calcularTotaisOrcamento(projetoId)
 * const indicadores = calcularIndicadoresProjeto(projetoId, totais)
 * ```
 */
export function calcularIndicadoresProjeto(
  projeto_id: number,
  totais: TotaisOrcamento
): IndicadoresFinanceiros {
  const comprometido = FinanceiroRepository.sumMovimentosProjeto(projeto_id, ['PENDENTE', 'APROVADO'])
  const executado    = FinanceiroRepository.sumMovimentosProjeto(projeto_id, ['APROVADO'])
  const pago         = FinanceiroRepository.sumPagamentosProjeto(projeto_id)
  const previsto     = totais.investimento_total

  return {
    valor_previsto:           previsto,
    valor_comprometido:       comprometido,
    valor_executado:          executado,
    valor_pago:               pago,
    saldo_disponivel:         calcularSaldo(previsto, comprometido),
    percentual_comprometido:  calcularPercentualExecutado(previsto, comprometido),
    percentual_executado:     calcularPercentualExecutado(previsto, executado),
    percentual_pago:          calcularPercentualExecutado(previsto, pago),
  }
}

export interface Inconsistencia {
  tipo: string
  descricao: string
  item_id?: number
  item_nome?: string
  severidade: 'CRITICA' | 'ALTA' | 'MEDIA'
}

/**
 * Identifica inconsistências financeiras automáticas de um projeto.
 *
 * Verifica estouro orçamentário, movimentos sem item vinculado,
 * itens sem movimentação e documentos duplicados.
 *
 * @param projeto_id - ID do projeto
 * @returns Lista de inconsistências encontradas (vazia se tudo OK)
 *
 * @usedBy FinanceiroTab — seção de alertas automáticos
 * @usedBy Dashboard Executivo — alertas do portfólio
 * @usedBy Relatórios — auditoria financeira
 *
 * @example
 * ```ts
 * const alertas = verificarInconsistencias(projetoId)
 * if (alertas.length > 0) {
 *   console.warn(`${alertas.length} inconsistência(s) encontrada(s)`)
 * }
 * ```
 */
export function verificarInconsistencias(projeto_id: number): Inconsistencia[] {
  const alertas: Inconsistencia[] = []

  for (const e of FinanceiroRepository.findEstourosOrcamentarios(projeto_id)) {
    alertas.push({
      tipo: 'ESTOURO_ORCAMENTARIO',
      descricao: `Item "${e.nome}" comprometeu R$ ${e.comprometido.toFixed(2)} de R$ ${e.valor_aprovado.toFixed(2)} aprovados.`,
      item_id: e.id,
      item_nome: e.nome,
      severidade: 'CRITICA',
    })
  }

  const orfaos = FinanceiroRepository.countMovimentosOrfaos(projeto_id)
  if (orfaos > 0) {
    alertas.push({
      tipo: 'MOVIMENTO_SEM_ITEM',
      descricao: `${orfaos} movimento(s) financeiro(s) sem item de orçamento vinculado.`,
      severidade: 'ALTA',
    })
  }

  const semMovimento = FinanceiroRepository.findItensSemMovimento(projeto_id)
  if (semMovimento.length > 0) {
    alertas.push({
      tipo: 'ITEM_SEM_MOVIMENTACAO',
      descricao: `${semMovimento.length} item(ns) de orçamento sem movimentação financeira.`,
      severidade: 'MEDIA',
    })
  }

  for (const d of FinanceiroRepository.findDocumentosDuplicados(projeto_id)) {
    alertas.push({
      tipo: 'DOCUMENTO_DUPLICADO',
      descricao: `Documento "${d.numero_doc}" lançado ${d.qtd} vezes no mesmo projeto.`,
      severidade: 'ALTA',
    })
  }

  return alertas
}

export function buscarConfiguracaoFinanceira() {
  const rows = FinanceiroRepository.findConfigFinanceira()
  const cfg: Record<string, number> = {}
  rows.forEach(r => { cfg[r.chave] = parseFloat(r.valor) })
  return cfg
}
