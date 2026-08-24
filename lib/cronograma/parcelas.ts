/**
 * @file lib/cronograma/parcelas.ts
 *
 * Regras de negócio da "Tarefa de Pagamento" (Cronograma): geração de parcelas,
 * cálculo de status por data de vencimento e resumo de percentual pago.
 *
 * Funções puras, sem acesso a banco — importáveis tanto pelas rotas de API
 * quanto pelo componente client (mesmo padrão de calcStatusAuto/calcDiasFaltando
 * em components/projeto/CronogramaEditor.tsx, replicado aqui para parcela).
 */

export type Periodicidade =
  | 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export type StatusParcela = 'PAGO' | 'ATRASADA' | 'VENCE_HOJE' | 'PENDENTE'

export interface ParcelaGerada {
  numero: number
  valor: number
  data_vencimento: string
}

const MESES_POR_PERIODO: Record<Exclude<Periodicidade, 'SEMANAL' | 'QUINZENAL'>, number> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function somarPeriodo(base: Date, periodicidade: Periodicidade, n: number): Date {
  if (periodicidade === 'SEMANAL') {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7 * n)
  }
  if (periodicidade === 'QUINZENAL') {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 14 * n)
  }
  const meses = MESES_POR_PERIODO[periodicidade] * n
  const d = new Date(base.getFullYear(), base.getMonth() + meses, 1)
  const ultimoDiaDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(base.getDate(), ultimoDiaDoMes))
  return d
}

/**
 * Avança `n` períodos (na periodicidade informada) a partir de `dataBase` — usado para
 * encontrar a data de vencimento onde as parcelas pendentes recalculadas de uma Tarefa de
 * Pagamento devem começar, encaixando exatamente depois das `n` parcelas já pagas.
 */
export function avancarData(dataBase: string, periodicidade: Periodicidade, n: number): string {
  if (n <= 0) return dataBase
  return toISODate(somarPeriodo(parseDateOnly(dataBase), periodicidade, n))
}

/**
 * Gera N parcelas cuja soma é sempre exatamente igual a `valorTotal` — a diferença de
 * centavos por divisão não exata (nunca mais que `qtdParcelas` centavos) é absorvida
 * pela última parcela, em vez de distribuída ou descartada.
 */
export function gerarParcelas(
  valorTotal: number,
  qtdParcelas: number,
  dataPrimeiraParcela: string,
  periodicidade: Periodicidade
): ParcelaGerada[] {
  const totalCentavos = Math.round(valorTotal * 100)
  const baseCentavos = Math.floor(totalCentavos / qtdParcelas)
  const restoCentavos = totalCentavos - baseCentavos * qtdParcelas

  const base = parseDateOnly(dataPrimeiraParcela)
  const parcelas: ParcelaGerada[] = []
  for (let i = 0; i < qtdParcelas; i++) {
    const numero = i + 1
    const centavos = numero === qtdParcelas ? baseCentavos + restoCentavos : baseCentavos
    const data = i === 0 ? base : somarPeriodo(base, periodicidade, i)
    parcelas.push({ numero, valor: centavos / 100, data_vencimento: toISODate(data) })
  }
  return parcelas
}

/**
 * Mesma regra de data usada em calcStatusAuto (CronogramaEditor.tsx) — parcela paga é
 * sempre PAGO independente da data (regra explícita do pedido: não existe "pago com atraso").
 */
export function calcStatusParcela(parcela: { status: string; data_vencimento: string }): StatusParcela {
  if (parcela.status === 'PAGO') return 'PAGO'
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = parseDateOnly(parcela.data_vencimento)
  const dias = Math.round((venc.getTime() - hoje.getTime()) / 86_400_000)
  if (dias < 0) return 'ATRASADA'
  if (dias === 0) return 'VENCE_HOJE'
  return 'PENDENTE'
}

export interface ResumoPagamento {
  valorTotal: number
  valorPago: number
  valorRestante: number
  totalParcelas: number
  parcelasPagas: number
  percentual: number
}

export function calcResumoPagamento(
  valorTotal: number,
  parcelas: Array<{ valor: number; status: string }>
): ResumoPagamento {
  const totalParcelas = parcelas.length
  const parcelasPagas = parcelas.filter(p => p.status === 'PAGO').length
  // Soma/subtrai em centavos (inteiros) para não deixar resíduo de ponto flutuante
  // (ex.: valorTotal - valorPago dando "-R$ 0,00" quando o esperado é exatamente zero).
  const totalCentavos = Math.round(valorTotal * 100)
  const pagoCentavos  = parcelas.filter(p => p.status === 'PAGO').reduce((s, p) => s + Math.round(p.valor * 100), 0)
  const valorPago      = pagoCentavos / 100
  const valorRestante  = (totalCentavos - pagoCentavos) / 100
  const percentual = totalCentavos > 0 ? Math.round((pagoCentavos / totalCentavos) * 100) : 0
  return {
    valorTotal,
    valorPago,
    valorRestante,
    totalParcelas,
    parcelasPagas,
    percentual,
  }
}
