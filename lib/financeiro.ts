import getDb from './db'
import { registrarAuditoria } from './db/auditoria'

// ============================================================
// CÁLCULOS FINANCEIROS (sem inventar premissas)
// ============================================================

export function calcularROI(investimento: number, beneficioLiquido: number): number | null {
  if (!investimento || investimento === 0) return null
  return ((beneficioLiquido - investimento) / investimento) * 100
}

export function calcularVPL(
  taxaDesconto: number,  // ex: 0.12 para 12%
  fluxos: number[]       // fluxo[0] = investimento negativo, fluxo[1..n] = retornos
): number | null {
  if (!taxaDesconto || !fluxos.length) return null
  const r = taxaDesconto / 100
  return fluxos.reduce((acc, fc, t) => acc + fc / Math.pow(1 + r, t), 0)
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

export function salvarViabilidade(dados: {
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
}): number {
  const db = getDb()

  // Calcular indicadores com os dados informados pelo usuário
  let roi: number | null = null
  let vpl: number | null = null
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
      vpl = calcularVPL(dados.taxa_desconto, fluxos)
      tir = calcularTIR(fluxos)
      payback = calcularPayback(dados.investimento_total, receitas.map((r, i) => r.valor - (custos[i]?.valor || 0)))
    }
  }

  // Verificar se já existe versão rascunho
  const existente = db.prepare(
    `SELECT id, versao FROM viabilidade WHERE projeto_id = ? AND status = 'RASCUNHO' ORDER BY versao DESC LIMIT 1`
  ).get(dados.projeto_id) as { id: number; versao: number } | undefined

  if (existente) {
    db.prepare(`
      UPDATE viabilidade SET
        selic=@selic, taxa_desconto=@taxa_desconto, inflacao=@inflacao,
        investimento_total=@investimento_total, receitas_previstas=@receitas_previstas,
        custos_previstos=@custos_previstos, economia_prevista=@economia_prevista,
        roi=@roi, vpl=@vpl, tir=@tir, payback_meses=@payback_meses,
        impacto_operacional=@impacto_operacional, recursos_necessarios=@recursos_necessarios,
        mudanca_processo=@mudanca_processo, tecnologias=@tecnologias,
        integracoes=@integracoes, infraestrutura=@infraestrutura,
        riscos=@riscos, impactos=@impactos,
        data_inicio_prev=@data_inicio_prev, data_fim_prev=@data_fim_prev,
        marcos=@marcos, updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `).run({
      ...dados,
      receitas_previstas: JSON.stringify(dados.receitas_previstas),
      custos_previstos: JSON.stringify(dados.custos_previstos),
      economia_prevista: JSON.stringify(dados.economia_prevista),
      riscos: JSON.stringify(dados.riscos),
      impactos: JSON.stringify(dados.impactos),
      marcos: JSON.stringify(dados.marcos),
      integracoes: dados.integracoes,
      roi, vpl, tir, payback_meses: payback,
      id: existente.id,
    })
    return existente.id
  } else {
    const versao = ((db.prepare(
      'SELECT MAX(versao) as v FROM viabilidade WHERE projeto_id = ?'
    ).get(dados.projeto_id) as { v: number } | undefined)?.v || 0) + 1

    const result = db.prepare(`
      INSERT INTO viabilidade
        (projeto_id, versao, selic, taxa_desconto, inflacao, investimento_total,
         receitas_previstas, custos_previstos, economia_prevista,
         roi, vpl, tir, payback_meses,
         impacto_operacional, recursos_necessarios, mudanca_processo,
         tecnologias, integracoes, infraestrutura,
         riscos, impactos, data_inicio_prev, data_fim_prev, marcos, criado_por)
      VALUES
        (@projeto_id, @versao, @selic, @taxa_desconto, @inflacao, @investimento_total,
         @receitas_previstas, @custos_previstos, @economia_prevista,
         @roi, @vpl, @tir, @payback_meses,
         @impacto_operacional, @recursos_necessarios, @mudanca_processo,
         @tecnologias, @integracoes, @infraestrutura,
         @riscos, @impactos, @data_inicio_prev, @data_fim_prev, @marcos, @criado_por)
    `).run({
      ...dados,
      versao,
      receitas_previstas: JSON.stringify(dados.receitas_previstas),
      custos_previstos: JSON.stringify(dados.custos_previstos),
      economia_prevista: JSON.stringify(dados.economia_prevista),
      riscos: JSON.stringify(dados.riscos),
      impactos: JSON.stringify(dados.impactos),
      marcos: JSON.stringify(dados.marcos),
      integracoes: dados.integracoes,
      roi, vpl, tir, payback_meses: payback,
    })
    return Number(result.lastInsertRowid)
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
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO financeiro_lancamentos
      (projeto_id, tipo, categoria, descricao, fornecedor, numero_doc, valor,
       data_lancamento, competencia, observacoes, arquivo_path, criado_por)
    VALUES
      (@projeto_id, @tipo, @categoria, @descricao, @fornecedor, @numero_doc, @valor,
       @data_lancamento, @competencia, @observacoes, @arquivo_path, @criado_por)
  `).run(dados)

  registrarAuditoria({
    usuario_id: dados.criado_por,
    acao: 'CREATE',
    entidade: 'financeiro_lancamentos',
    entidade_id: Number(result.lastInsertRowid),
    projeto_id: dados.projeto_id,
    descricao: `Lançamento ${dados.tipo} R$ ${dados.valor.toFixed(2)}: ${dados.descricao}`,
  })

  return Number(result.lastInsertRowid)
}

export function buscarResumoFinanceiro(projeto_id: number) {
  const db = getDb()
  const proj = db.prepare('SELECT capex_aprovado, opex_aprovado FROM projetos WHERE id = ?').get(projeto_id) as { capex_aprovado: number; opex_aprovado: number } | undefined
  if (!proj) return null

  const capexReal = (db.prepare(
    `SELECT COALESCE(SUM(valor),0) as total FROM financeiro_lancamentos WHERE projeto_id=? AND tipo='CAPEX' AND status='APROVADO'`
  ).get(projeto_id) as { total: number }).total

  const opexReal = (db.prepare(
    `SELECT COALESCE(SUM(valor),0) as total FROM financeiro_lancamentos WHERE projeto_id=? AND tipo='OPEX' AND status='APROVADO'`
  ).get(projeto_id) as { total: number }).total

  return {
    capex_planejado: proj.capex_aprovado,
    capex_realizado: capexReal,
    capex_saldo: proj.capex_aprovado - capexReal,
    opex_planejado: proj.opex_aprovado,
    opex_realizado: opexReal,
    opex_saldo: proj.opex_aprovado - opexReal,
  }
}

export function buscarConfiguracaoFinanceira() {
  const db = getDb()
  const rows = db.prepare('SELECT chave, valor FROM config_global WHERE chave IN (?,?,?)').all('selic','taxa_desconto','inflacao') as { chave: string; valor: string }[]
  const cfg: Record<string, number> = {}
  rows.forEach(r => { cfg[r.chave] = parseFloat(r.valor) })
  return cfg
}
