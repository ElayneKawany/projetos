export interface DadosBasePayback {
  baselineValor: number | null
  metaValor: number | null
  tipoIndicador: 'PERCENTUAL' | 'ABSOLUTO'
  economiaMensalEsperada: number | null
  paybackPrevistoMeses: number | null
  investimentoTotal: number | null
  dataGolive: string | null        // YYYY-MM-DD — data conclusão real ou data_fim_prev
}

export interface RegistroPayback {
  id: number
  data: string           // YYYY-MM-DD
  valor_real: number
  origem: string
  observacao: string | null
  criado_por: number | null
  created_at: string
  criador_nome?: string
}

export interface PontoGrafico {
  mes: string            // "Jan/25"
  data: string           // YYYY-MM-DD
  valorReal: number | null
  meta: number | null
  baseline: number | null
  reducaoReal: number | null        // quanto já reduziu do baseline
  progressoPct: number | null       // % da meta atingida
  economiaAcumulada: number | null  // R$ acumulado
}

export interface ResultadoPayback {
  progresso: number                 // 0-100+
  reducaoEsperada: number | null    // baseline - meta (ou meta - baseline para indicadores crescentes)
  reducaoReal: number | null        // baseline - último valorReal
  economiaRealAcumulada: number | null
  economiaRealMedia: number | null  // por mês
  paybackPrevistoMeses: number | null
  paybackRealProjecao: number | null  // projeção baseada no ritmo atual
  progressoEsperado: number | null    // % esperado no tempo decorrido
  mesesDecorridos: number
  atrasado: boolean
  adiantado: boolean
  status: 'SEM_DADOS' | 'EM_LINHA' | 'ATRASADO' | 'ADIANTADO' | 'CONCLUIDO'
  pontos: PontoGrafico[]
}

function mesesEntre(de: string, ate: string): number {
  const d = new Date(de)
  const a = new Date(ate)
  return (a.getFullYear() - d.getFullYear()) * 12 + (a.getMonth() - d.getMonth())
}

function labelMes(data: string): string {
  const d = new Date(data)
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
}

export function calcularPayback(
  base: DadosBasePayback,
  registros: RegistroPayback[],
): ResultadoPayback {
  const semDados: ResultadoPayback = {
    progresso: 0, reducaoEsperada: null, reducaoReal: null,
    economiaRealAcumulada: null, economiaRealMedia: null,
    paybackPrevistoMeses: base.paybackPrevistoMeses,
    paybackRealProjecao: null, progressoEsperado: null,
    mesesDecorridos: 0, atrasado: false, adiantado: false,
    status: 'SEM_DADOS', pontos: [],
  }

  if (base.baselineValor === null || base.metaValor === null) return semDados

  const baseline = base.baselineValor
  const meta = base.metaValor
  // Diferença esperada (sempre positiva — baseline e meta podem ter qualquer direção)
  const reducaoEsperada = Math.abs(baseline - meta)
  if (reducaoEsperada === 0) return semDados

  // Registros ordenados por data
  const sorted = [...registros].sort((a, b) => a.data.localeCompare(b.data))

  const hoje = new Date().toISOString().slice(0, 10)
  const dataRef = base.dataGolive ?? sorted[0]?.data ?? hoje
  const mesesDecorridos = sorted.length > 0
    ? Math.max(1, mesesEntre(dataRef, sorted[sorted.length - 1].data) + 1)
    : 0

  // Pontos para o gráfico — inclui meses entre dataRef e última leitura
  const pontos: PontoGrafico[] = sorted.map((r, idx) => {
    const reducaoReal = baseline - r.valor_real
    const progressoPct = reducaoEsperada > 0 ? (reducaoReal / reducaoEsperada) * 100 : 0

    // Economia acumulada: progressoPct/100 × economiaMensalEsperada × número de meses
    const mesesAteAgora = mesesEntre(dataRef, r.data) + 1
    const econAcum = base.economiaMensalEsperada !== null
      ? (progressoPct / 100) * base.economiaMensalEsperada * mesesAteAgora
      : null

    return {
      mes: labelMes(r.data),
      data: r.data,
      valorReal: r.valor_real,
      meta,
      baseline,
      reducaoReal,
      progressoPct,
      economiaAcumulada: econAcum,
    }
  })

  if (sorted.length === 0) {
    return { ...semDados, reducaoEsperada, pontos }
  }

  const ultimo = sorted[sorted.length - 1]
  const reducaoReal = baseline - ultimo.valor_real
  const progresso = (reducaoReal / reducaoEsperada) * 100

  // Indicador qualitativo: atingiu a meta?
  const concluido = progresso >= 100

  // Economia acumulada
  let economiaRealAcumulada: number | null = null
  let economiaRealMedia: number | null = null
  if (base.economiaMensalEsperada !== null && mesesDecorridos > 0) {
    const progressoFraction = Math.min(1, Math.max(0, progresso / 100))
    economiaRealAcumulada = progressoFraction * base.economiaMensalEsperada * mesesDecorridos
    economiaRealMedia = economiaRealAcumulada / mesesDecorridos
  }

  // Projeção do payback real
  let paybackRealProjecao: number | null = null
  if (base.investimentoTotal !== null && economiaRealMedia !== null && economiaRealMedia > 0) {
    paybackRealProjecao = base.investimentoTotal / economiaRealMedia
  }

  // Progresso esperado no tempo decorrido
  let progressoEsperado: number | null = null
  if (base.paybackPrevistoMeses !== null && base.paybackPrevistoMeses > 0) {
    progressoEsperado = (mesesDecorridos / base.paybackPrevistoMeses) * 100
  }

  const TOLERANCIA = 10 // pontos percentuais
  let atrasado = false
  let adiantado = false
  if (progressoEsperado !== null) {
    if (progresso < progressoEsperado - TOLERANCIA) atrasado = true
    else if (progresso > progressoEsperado + TOLERANCIA) adiantado = true
  }

  const status = concluido ? 'CONCLUIDO'
    : atrasado ? 'ATRASADO'
    : adiantado ? 'ADIANTADO'
    : 'EM_LINHA'

  return {
    progresso: Math.max(0, progresso),
    reducaoEsperada,
    reducaoReal,
    economiaRealAcumulada,
    economiaRealMedia,
    paybackPrevistoMeses: base.paybackPrevistoMeses,
    paybackRealProjecao,
    progressoEsperado,
    mesesDecorridos,
    atrasado,
    adiantado,
    status,
    pontos,
  }
}
