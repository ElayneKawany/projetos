/**
 * Funções de leitura agregada do módulo Financeiro.
 * Sem efeitos colaterais — apenas leitura.
 * As funções desta camada são a fonte de dados para o módulo de Acompanhamento de Payback:
 * qualquer lançamento financeiro (criarPagamento, importarContratos) atualiza automaticamente
 * os dados retornados aqui, pois são calculados sob demanda sem cache.
 */
import type {
  FinanceiroContrato,
  FinanceiroContratoPagamento,
  FinanceiroContratoCompleto,
  FinanceiroResumoExecutivo,
  FinanceiroCardsPayback,
  NaturezaFinanceira,
  TipoContrato,
} from '@/types'
import { FinanceiroRepository } from '@/lib/repositories'

// ─── Viabilidade ──────────────────────────────────────────────────────────────

export function buscarViabilidadeFinanceira(projeto_id: number): { capex: number; opex: number } {
  return FinanceiroRepository.findViabilidadeCapexOpex(projeto_id)
}

// ─── Contratos completos (com pagamentos embutidos) ───────────────────────────

export function buscarContratosCompletos(projeto_id: number): FinanceiroContratoCompleto[] {
  const contratos = FinanceiroRepository.findContratosParaDashboard(projeto_id) as unknown as FinanceiroContrato[]
  const pagamentos = FinanceiroRepository.findPagamentosParaDashboard(projeto_id) as unknown as FinanceiroContratoPagamento[]

  const pagByContrato = new Map<number, FinanceiroContratoPagamento[]>()
  for (const p of pagamentos) {
    const list = pagByContrato.get(p.contrato_id) ?? []
    list.push(p)
    pagByContrato.set(p.contrato_id, list)
  }

  return contratos.map(c => {
    const pags = pagByContrato.get(c.id) ?? []
    const valor_pago_total = pags.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
    const saldo = c.valor_aprovado - valor_pago_total
    const percentual = c.valor_aprovado > 0
      ? Math.round((valor_pago_total / c.valor_aprovado) * 100)
      : 0
    return { ...c, pagamentos: pags, valor_pago_total, saldo, percentual }
  })
}

// ─── Resumo executivo (header cards) ─────────────────────────────────────────

export function buscarResumoFinanceiro(projeto_id: number): FinanceiroResumoExecutivo {
  const { capex, opex } = buscarViabilidadeFinanceira(projeto_id)
  const contratos = buscarContratosCompletos(projeto_id)

  const capex_executado = contratos
    .filter(c => c.natureza_financeira === 'CAPEX')
    .reduce((s, c) => s + c.valor_pago_total, 0)

  const opex_executado = contratos
    .filter(c => c.natureza_financeira === 'OPEX')
    .reduce((s, c) => s + c.valor_pago_total, 0)

  const total_planejado = capex + opex
  const total_executado = capex_executado + opex_executado
  const saldo = total_planejado - total_executado
  const percentual_executado = total_planejado > 0
    ? Math.round((total_executado / total_planejado) * 100)
    : 0

  return {
    capex_viabilidade: capex,
    opex_viabilidade: opex,
    capex_executado,
    opex_executado,
    saldo_capex: capex - capex_executado,
    saldo_opex: opex - opex_executado,
    total_planejado,
    total_executado,
    saldo,
    percentual_executado,
    quantidade_contratos: contratos.length,
  }
}

// ─── Cards para o módulo de Acompanhamento de Payback ─────────────────────────

/**
 * Retorna os dados agregados consumidos pelo módulo de Acompanhamento de Payback.
 * Calculado sob demanda — qualquer pagamento criado/atualizado/excluído reflete
 * automaticamente aqui sem necessidade de invalidação de cache.
 */
export function buscarCardsFinanceiros(projeto_id: number): FinanceiroCardsPayback {
  const resumo = buscarResumoFinanceiro(projeto_id)

  const linhasMensais = FinanceiroRepository.findDistribuicaoMensalPagamentos(projeto_id)

  let acumulado = 0
  const distribuicao_mensal = linhasMensais.map(r => {
    acumulado += r.valor_pago ?? 0
    return { competencia: r.mes, valor_pago: r.valor_pago ?? 0, acumulado }
  })

  const linhasTipo = FinanceiroRepository.findDistribuicaoPorTipoContrato(projeto_id) as {
    tipo_contrato: string; valor_aprovado: number; valor_pago: number
  }[]

  const por_tipo_contrato = linhasTipo.map(r => ({
    tipo_contrato: r.tipo_contrato as TipoContrato,
    valor_aprovado: r.valor_aprovado ?? 0,
    valor_pago: r.valor_pago ?? 0,
    percentual: r.valor_aprovado > 0
      ? Math.round((r.valor_pago / r.valor_aprovado) * 100)
      : 0,
  }))

  const { capex_viabilidade, opex_viabilidade, capex_executado, opex_executado } = resumo
  const por_natureza: FinanceiroCardsPayback['por_natureza'] = (
    ['CAPEX', 'OPEX'] as NaturezaFinanceira[]
  ).map(nat => {
    const planejado = nat === 'CAPEX' ? capex_viabilidade : opex_viabilidade
    const executado = nat === 'CAPEX' ? capex_executado : opex_executado
    return {
      natureza: nat,
      valor_planejado: planejado,
      valor_executado: executado,
      saldo: planejado - executado,
      percentual: planejado > 0 ? Math.round((executado / planejado) * 100) : 0,
    }
  })

  return { resumo, distribuicao_mensal, por_natureza, por_tipo_contrato }
}
