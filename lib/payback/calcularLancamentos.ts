import type { PaybackLancamento, PaybackLancamentosResumo, PaybackStatus } from '@/types'

interface BaseViabilidade {
  capex?: number | null
  opex?: number | null
  economia_estimada?: number | null
  payback_meses?: number | null
}

interface BaseProjeto {
  capex_aprovado?: number | null
  opex_aprovado?: number | null
  data_conclusao_real?: string | null
}

export function calcularResumoPayback(
  viabilidade: BaseViabilidade | null,
  projeto: BaseProjeto,
  lancamentos: PaybackLancamento[]
): PaybackLancamentosResumo {
  const capex = viabilidade?.capex ?? projeto?.capex_aprovado ?? 0
  const opex  = viabilidade?.opex  ?? projeto?.opex_aprovado  ?? 0
  const investimento_aprovado = (capex ?? 0) + (opex ?? 0)

  const beneficio_previsto    = viabilidade?.economia_estimada ?? null
  const payback_previsto_meses = viabilidade?.payback_meses   ?? null
  const data_golive            = projeto?.data_conclusao_real  ?? null

  // Ordenar por competência para garantir cálculo cronológico
  const ordenados = [...lancamentos].sort((a, b) =>
    a.competencia.localeCompare(b.competencia)
  )

  const investimento_realizado = ordenados.reduce((s, l) => s + (l.investimento_periodo ?? 0), 0)
  const beneficio_acumulado    = ordenados.reduce((s, l) => s + (l.beneficio_periodo    ?? 0), 0)

  const saldo_financeiro  = beneficio_acumulado - investimento_realizado
  const percentual_recuperado = investimento_aprovado > 0
    ? (beneficio_acumulado / investimento_aprovado) * 100
    : 0
  const valor_restante = Math.max(0, investimento_aprovado - beneficio_acumulado)

  // Payback real: mês em que o benefício acumulado supera o investimento total aprovado
  let payback_real_meses: number | null = null
  if (ordenados.length > 0 && investimento_aprovado > 0) {
    let cumBeneficio = 0
    for (let i = 0; i < ordenados.length; i++) {
      cumBeneficio += ordenados[i].beneficio_periodo ?? 0
      if (cumBeneficio >= investimento_aprovado) {
        payback_real_meses = i + 1
        break
      }
    }
  }

  let status: PaybackStatus = 'SEM_LANCAMENTOS'
  if (ordenados.length > 0) {
    status = beneficio_acumulado >= investimento_aprovado && investimento_aprovado > 0
      ? 'CONCLUIDO'
      : 'EM_ANDAMENTO'
  }

  return {
    capex_aprovado: capex ?? 0,
    opex_aprovado:  opex  ?? 0,
    investimento_aprovado,
    beneficio_previsto,
    payback_previsto_meses,
    data_golive,
    investimento_realizado,
    beneficio_acumulado,
    saldo_financeiro,
    percentual_recuperado,
    valor_restante,
    payback_real_meses,
    status,
    lancamentos: ordenados,
  }
}
