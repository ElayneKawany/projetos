/**
 * @file lib/payback.ts
 *
 * Serviço central do módulo de Acompanhamento de Payback.
 *
 * REGRAS ARQUITETURAIS:
 *   — Toda regra de negócio financeira do Payback fica aqui.
 *   — APIs e componentes apenas chamam estas funções; nunca contêm cálculos inline.
 *   — Dados planejados vêm de TAP / Viabilidade / Cronograma (nunca duplicados).
 *   — Dados realizados vêm de Financeiro / Cronograma / Projeto.
 *   — calcularROI / calcularTIR / calcularPayback são funções puras
 *     (sem acesso ao DB) — podem ser usadas em testes unitários ou no cliente.
 *
 * @module payback
 */

import getDb from './db'
import { asyncDb } from './database'
import type {
  PaybackResumo,
  PaybackCompetencia,
  PaybackFluxo,
  PaybackIndicadores,
  PaybackHistorico,
  PaybackRelatorio,
  PaybackSnapshot,
  PaybackDashboardCard,
} from '@/types'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface ViabilidadeRow {
  capex: number | null
  opex: number | null
  economia_estimada: number | null
  payback_informado: number | null
  tir: number | null
}

interface TapRow {
  roi_previsto: number | null
  payback_meses: number | null
}

interface SnapshotRow {
  roi_previsto: number | null
  roi_atual: number | null
  capex_previsto: number | null
  capex_executado: number | null
  opex_previsto: number | null
  opex_executado: number | null
  economia_prevista: number | null
  economia_realizada: number | null
  dias_desvio: number | null
}

interface ProjetoRow {
  status: string
  data_conclusao_real: string | null
  capex_aprovado: number
  opex_aprovado: number
}

// ─── Funções puras (sem DB) ───────────────────────────────────────────────────

/**
 * Calcula o ROI percentual.
 * ROI = ((beneficioLiquido - investimento) / investimento) * 100
 */
export function calcularROI(
  investimento: number,
  beneficioLiquido: number,
): number | null {
  if (investimento <= 0) return null
  return ((beneficioLiquido - investimento) / investimento) * 100
}

/**
 * Calcula a TIR (Taxa Interna de Retorno) pelo método de Newton-Raphson.
 * @param fluxos - Array com fluxo de caixa [FC0, FC1, ...]; FC0 normalmente negativo (investimento).
 * @param maxIteracoes - Limite de iterações para convergência.
 * @returns Taxa decimal (ex: 0.15 = 15%) ou null se não convergir.
 */
export function calcularTIR(
  fluxos: number[],
  maxIteracoes = 1000,
): number | null {
  if (fluxos.length < 2) return null

  let taxa = 0.1
  for (let i = 0; i < maxIteracoes; i++) {
    const vpl      = fluxos.reduce((acc, fc, t) => acc + fc / Math.pow(1 + taxa, t), 0)
    const derivada = fluxos.reduce((acc, fc, t) => acc - (t * fc) / Math.pow(1 + taxa, t + 1), 0)
    if (Math.abs(derivada) < 1e-10) return null
    const novaTaxa = taxa - vpl / derivada
    if (Math.abs(novaTaxa - taxa) < 1e-8) return novaTaxa
    taxa = novaTaxa
  }
  return null
}

/**
 * Calcula o período de Payback (em meses) a partir do fluxo acumulado.
 * @param investimento - Investimento inicial (valor positivo).
 * @param fluxoMensal - Array de fluxos mensais positivos.
 * @returns Número de meses até recuperar o investimento, ou null se não recuperar.
 */
export function calcularPayback(
  investimento: number,
  fluxoMensal: number[],
): number | null {
  if (investimento <= 0 || fluxoMensal.length === 0) return null
  let acumulado = 0
  for (let i = 0; i < fluxoMensal.length; i++) {
    acumulado += fluxoMensal[i]
    if (acumulado >= investimento) return i + 1
  }
  return null
}

/**
 * Calcula a economia acumulada de um array de competências.
 */
export function calcularEconomia(competencias: PaybackCompetencia[]): number {
  return competencias.reduce((acc, c) => acc + c.economia, 0)
}

/**
 * Projeta o fluxo de caixa futuro replicando a média mensal dos últimos 3 períodos.
 * @param historico  - Fluxos mensais realizados.
 * @param mesesFuturos - Quantidade de meses a projetar.
 */
export function projetarPayback(
  historico: PaybackFluxo[],
  mesesFuturos: number,
): PaybackFluxo[] {
  if (historico.length === 0 || mesesFuturos <= 0) return []

  const janela   = historico.slice(-3)
  const mediaFluxo   = janela.reduce((a, f) => a + f.fluxo_liquido, 0) / janela.length
  const mediaReceita = janela.reduce((a, f) => a + f.receita, 0) / janela.length
  const mediaEco     = janela.reduce((a, f) => a + f.economia, 0) / janela.length
  const mediaCapex   = janela.reduce((a, f) => a + f.despesa_capex, 0) / janela.length
  const mediaOpex    = janela.reduce((a, f) => a + f.despesa_opex, 0) / janela.length

  const ultimo = historico[historico.length - 1]
  let acumulado = ultimo.fluxo_acumulado

  return Array.from({ length: mesesFuturos }, (_, i) => {
    let mes = ultimo.mes + i + 1
    let ano = ultimo.ano
    while (mes > 12) { mes -= 12; ano++ }
    acumulado += mediaFluxo
    return {
      periodo: `${ano}-${String(mes).padStart(2, '0')}`,
      ano,
      mes,
      receita:         mediaReceita,
      economia:        mediaEco,
      despesa_capex:   mediaCapex,
      despesa_opex:    mediaOpex,
      fluxo_liquido:   mediaFluxo,
      fluxo_acumulado: acumulado,
    }
  })
}

// ─── Funções de acesso ao DB ──────────────────────────────────────────────────

/**
 * Busca o resumo executivo do Payback para um projeto.
 * Combina dados do projeto, snapshot final e competências lançadas.
 */
export async function buscarResumoPayback(projeto_id: number): Promise<PaybackResumo> {
  const db = getDb()

  const projeto = db.prepare(
    `SELECT status, data_conclusao_real, capex_aprovado, opex_aprovado FROM projetos WHERE id = ?`
  ).get(projeto_id) as ProjetoRow | undefined

  const snapshot = db.prepare(
    `SELECT * FROM projeto_snapshot_final WHERE projeto_id = ?`
  ).get(projeto_id) as SnapshotRow | undefined

  const competencias = db.prepare(
    `SELECT * FROM payback_competencias WHERE projeto_id = ? ORDER BY ano, mes`
  ).all(projeto_id) as PaybackCompetencia[]

  const viab = db.prepare(
    `SELECT capex, opex, economia_estimada, payback_informado, tir FROM viabilidade
     WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`
  ).get(projeto_id) as ViabilidadeRow | undefined

  // Consulta a tap_versoes que existia aqui foi removida: o resultado nunca era
  // usado (só `void tap` pra suprimir aviso de variável não lida) — os dados de
  // TAP realmente usados neste resumo vêm de buscarIndicadoresFinanceiros abaixo.
  const indicadores = await buscarIndicadoresFinanceiros(projeto_id)

  const ultimaComp = competencias.length > 0
    ? `${competencias[competencias.length - 1].ano}-${String(competencias[competencias.length - 1].mes).padStart(2, '0')}`
    : null

  const dataInicio = projeto?.data_conclusao_real ?? null

  let mesesDecorridos = 0
  if (dataInicio) {
    const inicio = new Date(dataInicio)
    const agora  = new Date()
    mesesDecorridos = (agora.getFullYear() - inicio.getFullYear()) * 12
      + (agora.getMonth() - inicio.getMonth())
  }

  void snapshot
  void viab

  return {
    projeto_id,
    status_payback:              projeto?.status ?? 'EXECUCAO',
    data_inicio_payback:         dataInicio,
    data_previsao_encerramento:  null,
    data_encerramento_real:      null,
    meses_decorridos:            mesesDecorridos,
    meses_previstos:             null,
    indicadores,
    total_competencias:          competencias.length,
    ultima_competencia:          ultimaComp,
  }
}

/**
 * Busca todas as competências mensais de um projeto, ordenadas cronologicamente.
 */
export function buscarCompetencias(projeto_id: number): PaybackCompetencia[] {
  const db = getDb()
  return db.prepare(
    `SELECT * FROM payback_competencias WHERE projeto_id = ? ORDER BY ano, mes`
  ).all(projeto_id) as PaybackCompetencia[]
}

/**
 * Constrói o fluxo de caixa acumulado a partir das competências lançadas.
 */
export function buscarFluxoCaixa(projeto_id: number): PaybackFluxo[] {
  const competencias = buscarCompetencias(projeto_id)
  let acumulado = 0

  return competencias.map(c => {
    const fluxo_liquido = c.receita + c.economia - c.capex - c.opex
    acumulado += fluxo_liquido
    return {
      periodo:         `${c.ano}-${String(c.mes).padStart(2, '0')}`,
      ano:             c.ano,
      mes:             c.mes,
      receita:         c.receita,
      economia:        c.economia,
      despesa_capex:   c.capex,
      despesa_opex:    c.opex,
      fluxo_liquido,
      fluxo_acumulado: acumulado,
    }
  })
}

/**
 * Calcula e retorna os indicadores financeiros consolidados (planejado vs. realizado).
 * Planejado → TAP / Viabilidade.
 * Realizado → Financeiro (contratos) / Competências de Payback.
 */
export async function buscarIndicadoresFinanceiros(projeto_id: number): Promise<PaybackIndicadores> {
  const db = getDb()

  const viab = db.prepare(
    `SELECT capex, opex, economia_estimada, tir FROM viabilidade
     WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`
  ).get(projeto_id) as Omit<ViabilidadeRow, 'payback_informado'> | undefined

  const tap = await asyncDb.queryOne<Pick<TapRow, 'roi_previsto'>>(
    `SELECT roi_previsto FROM "AI"."TI_PMO_TAP_VERSOES"
     WHERE projeto_id = ? AND status = 'APROVADO' ORDER BY versao DESC LIMIT 1`,
    [projeto_id]
  )

  const snapshot = db.prepare(
    `SELECT capex_executado, opex_executado, economia_realizada FROM projeto_snapshot_final
     WHERE projeto_id = ?`
  ).get(projeto_id) as Pick<SnapshotRow, 'capex_executado' | 'opex_executado' | 'economia_realizada'> | undefined

  const competencias = buscarCompetencias(projeto_id)
  const economiaReal = competencias.reduce((a, c) => a + c.economia + c.receita, 0)
  const fluxoCaixa   = buscarFluxoCaixa(projeto_id)
  const fluxoAcum    = fluxoCaixa.length > 0
    ? fluxoCaixa[fluxoCaixa.length - 1].fluxo_acumulado
    : null

  const capexExec = snapshot?.capex_executado ?? null
  const opexExec  = snapshot?.opex_executado  ?? null
  const totalInv  = (capexExec ?? 0) + (opexExec ?? 0)

  const roiAtual = totalInv > 0 && economiaReal > 0
    ? calcularROI(totalInv, economiaReal)
    : null

  return {
    roi_previsto:    tap?.roi_previsto ?? null,
    roi_atual:       roiAtual,
    roi_final:       null,
    tir_prevista:    viab?.tir ?? null,
    tir_atual:       null,
    tir_final:       null,
    capex_planejado: viab?.capex ?? null,
    capex_executado: capexExec,
    opex_planejado:  viab?.opex ?? null,
    opex_executado:  opexExec,
    economia_prevista: viab?.economia_estimada ?? null,
    economia_real:     economiaReal > 0 ? economiaReal : null,
    fluxo_acumulado:   fluxoAcum,
    saldo:             fluxoAcum,
  }
}

/**
 * Gera o resumo executivo do Payback como texto estruturado (para relatórios).
 */
export async function gerarResumoExecutivo(projeto_id: number): Promise<{
  resumo: PaybackResumo
  fluxo: PaybackFluxo[]
  indicadores: PaybackIndicadores
  projecao: PaybackFluxo[]
}> {
  const resumo      = await buscarResumoPayback(projeto_id)
  const fluxo       = buscarFluxoCaixa(projeto_id)
  const indicadores = await buscarIndicadoresFinanceiros(projeto_id)
  const projecao    = projetarPayback(fluxo, 6)

  return { resumo, fluxo, indicadores, projecao }
}

/**
 * Busca o histórico de auditoria do módulo Payback para um projeto.
 */
export function buscarHistorico(projeto_id: number): PaybackHistorico[] {
  const db = getDb()
  return (db.prepare(
    `SELECT id, projeto_id, acao, descricao, usuario_id, usuario_nome,
            dados_antes, dados_depois, created_at
     FROM auditoria
     WHERE projeto_id = ? AND entidade IN ('payback_competencias','payback')
     ORDER BY created_at DESC`
  ).all(projeto_id) as Array<PaybackHistorico & { dados_antes: string | null; dados_depois: string | null }>)
    .map(row => ({
      ...row,
      dados_antes:  row.dados_antes  ? JSON.parse(row.dados_antes)  as Record<string, unknown> : null,
      dados_depois: row.dados_depois ? JSON.parse(row.dados_depois) as Record<string, unknown> : null,
    }))
}

/**
 * Cria um snapshot pontual do estado atual do Payback.
 * Diferente de ProjetoSnapshotFinal — pode ser gerado a qualquer momento durante o acompanhamento.
 */
export async function criarSnapshot(
  projeto_id: number,
  criado_por: string,
  observacoes?: string,
): Promise<PaybackSnapshot> {
  const indicadores = await buscarIndicadoresFinanceiros(projeto_id)
  const fluxo       = buscarFluxoCaixa(projeto_id)
  const agora       = new Date().toISOString()

  return {
    projeto_id,
    data_referencia: agora.slice(0, 10),
    indicadores,
    competencias: fluxo,
    observacoes:  observacoes ?? null,
    criado_por,
    created_at:   agora,
  }
}

/**
 * Prepara os cards do dashboard executivo de Payback.
 * Retorna estrutura pronta para renderização — sem cálculos nos componentes.
 */
export async function buscarDashboardCards(projeto_id: number): Promise<PaybackDashboardCard[]> {
  const ind = await buscarIndicadoresFinanceiros(projeto_id)
  const competencias = buscarCompetencias(projeto_id)
  const receitaAcum  = competencias.reduce((a, c) => a + c.receita, 0)
  const economiaAcum = competencias.reduce((a, c) => a + c.economia, 0)

  return [
    { label: 'Receita Acumulada',  valor: receitaAcum,          unidade: 'R$',  tendencia: null, percentual: null },
    { label: 'Economia Acumulada', valor: economiaAcum,         unidade: 'R$',  tendencia: null, percentual: null },
    { label: 'CAPEX Executado',    valor: ind.capex_executado,  unidade: 'R$',  tendencia: null, percentual: null },
    { label: 'OPEX Executado',     valor: ind.opex_executado,   unidade: 'R$',  tendencia: null, percentual: null },
    { label: 'ROI',                valor: ind.roi_atual,        unidade: '%',   tendencia: null, percentual: null },
    { label: 'TIR',                valor: ind.tir_atual,        unidade: '%',   tendencia: null, percentual: null },
    { label: 'Payback',            valor: null,                 unidade: 'meses', tendencia: null, percentual: null },
    { label: 'Fluxo Acumulado',    valor: ind.fluxo_acumulado,  unidade: 'R$',  tendencia: null, percentual: null },
  ]
}

/**
 * Estrutura de metadados dos relatórios disponíveis.
 * Retorna a lista de relatórios configurados — sem gerar conteúdo ainda.
 */
export function listarRelatoriosDisponiveis(projeto_id: number): PaybackRelatorio[] {
  const agora = new Date().toISOString()
  const tipos: PaybackRelatorio['tipo'][] = [
    'RESUMO_EXECUTIVO', 'FINANCEIRO', 'ROI', 'TIR',
    'FLUXO_CAIXA', 'COMPETENCIAS', 'HISTORICO', 'PDF', 'EXCEL',
  ]
  return tipos.map(tipo => ({
    tipo,
    titulo: {
      RESUMO_EXECUTIVO: 'Resumo Executivo',
      FINANCEIRO:       'Relatório Financeiro',
      ROI:              'Análise de ROI',
      TIR:              'Análise de TIR',
      FLUXO_CAIXA:      'Fluxo de Caixa',
      COMPETENCIAS:     'Competências Mensais',
      HISTORICO:        'Histórico de Alterações',
      PDF:              'Exportar PDF',
      EXCEL:            'Exportar Excel',
    }[tipo],
    projeto_id,
    gerado_em:  agora,
    gerado_por: '',
  }))
}
