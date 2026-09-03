/**
 * @file lib/orcamento.ts
 *
 * Serviço compartilhado para gestão do Orçamento do Projeto.
 *
 * O orçamento é a ÚNICA fonte de verdade para todos os valores financeiros
 * aprovados. Nenhum módulo (Financeiro, Payback, Encerramento, Dashboard)
 * deve armazenar totais de CAPEX, OPEX ou Economia — todos devem calcular
 * a partir deste serviço.
 *
 * Hierarquia:
 *   Projeto
 *     └── orcamento_grupos  (Nível 1 — ex: "CAPEX – Hardware")
 *           └── orcamento_itens (Nível 2 — ex: "Servidor Dell R$ 80.000")
 *
 * Tipos de investimento:
 *   CAPEX_ATIVO    → aquisição de ativo (hardware, licenças perpetuas…)
 *   CAPEX_RETORNO  → investimento que gera retorno financeiro direto
 *   OPEX           → despesa operacional recorrente
 *
 * @module orcamento
 * @usedBy ViabilidadeEditor (criação de grupos/itens durante elaboração)
 * @usedBy FinanceiroTab (execução do orçamento aprovado)
 * @usedBy Payback (consome itens CAPEX_RETORNO)
 * @usedBy Dashboard Executivo (indicadores financeiros do projeto)
 * @usedBy Encerramento (comparativo previsto × realizado)
 */

import getDb from './db'
import { registrarAuditoria } from './db/auditoria'
import { UsuariosRepository } from './repositories/usuarios'

// Tipos e constantes sem dependência de servidor — importáveis em Client Components
export type { TipoInvestimento, OrcamentoItem, OrcamentoGrupo } from './orcamento-types'
export { TIPO_INVESTIMENTO_LABELS, TIPO_INVESTIMENTO_CORES } from './orcamento-types'

import { TIPO_INVESTIMENTO_CORES } from './orcamento-types'
import type { TipoInvestimento, OrcamentoItem, OrcamentoGrupo } from './orcamento-types'

export interface TotaisOrcamento {
  /** Total aprovado para CAPEX de aquisição de ativo */
  capex_ativo: number
  /** Total aprovado para CAPEX de retorno financeiro */
  capex_retorno: number
  /** Total aprovado para OPEX */
  opex: number
  /** CAPEX_ATIVO + CAPEX_RETORNO */
  capex_total: number
  /** Soma de todos os investimentos */
  investimento_total: number
}

export interface TotaisGrupo {
  grupo_id: number
  valor_aprovado: number
  valor_revisado: number | null
  quantidade_itens: number
}

// ─── Consultas ────────────────────────────────────────────────────────────────

/**
 * Retorna o orçamento completo de um projeto com grupos e itens.
 *
 * @param projeto_id - ID do projeto
 * @returns Lista de grupos com seus itens aninhados, ordenados por grupo.ordem e item.ordem
 *
 * @usedBy FinanceiroTab — painel executivo
 * @usedBy ViabilidadeEditor — aba Orçamento
 * @usedBy Payback — consome itens CAPEX_RETORNO
 *
 * @example
 * ```ts
 * const orcamento = await buscarOrcamento(projetoId)
 * const totalCapex = orcamento
 *   .filter(g => g.tipo === 'CAPEX_ATIVO')
 *   .flatMap(g => g.itens)
 *   .reduce((s, i) => s + i.valor_aprovado, 0)
 * ```
 */
export async function buscarOrcamento(projeto_id: number): Promise<OrcamentoGrupo[]> {
  const db = getDb()

  const grupos = db.prepare(`
    SELECT * FROM orcamento_grupos
    WHERE projeto_id = ? AND ativo = 1
    ORDER BY ordem, id
  `).all(projeto_id) as Omit<OrcamentoGrupo, 'itens'>[]

  const itensSemNome = db.prepare(`
    SELECT
      oi.*,
      cc.codigo  AS conta_contabil_codigo,
      cc.descricao AS conta_contabil_descricao,
      ccu.codigo  AS centro_custo_codigo,
      ccu.descricao AS centro_custo_descricao
    FROM orcamento_itens oi
    LEFT JOIN config_contas_contabeis cc  ON cc.id  = oi.conta_contabil_id
    LEFT JOIN config_centros_custo    ccu ON ccu.id = oi.centro_custo_id
    WHERE oi.projeto_id = ? AND oi.ativo = 1
    ORDER BY oi.ordem, oi.id
  `).all(projeto_id) as Omit<OrcamentoItem, 'responsavel_nome'>[]

  // responsavel_nome vinha de JOIN com usuarios, que já está em Postgres —
  // busca em lote por responsavel_usuario_id e faz o merge em JS.
  const nomes = await UsuariosRepository.findNomesPorIds(
    itensSemNome.map(i => i.responsavel_usuario_id).filter((v): v is number => v != null)
  )
  const itens: OrcamentoItem[] = itensSemNome.map(i => ({
    ...i,
    responsavel_nome: i.responsavel_usuario_id != null ? nomes.get(i.responsavel_usuario_id)?.nome ?? null : null,
  }))

  return grupos.map(g => ({
    ...g,
    itens: itens.filter(i => i.grupo_id === g.id),
  }))
}

/**
 * Calcula os totais financeiros de um projeto a partir dos itens de orçamento.
 *
 * NUNCA armazene esses totais em outras tabelas — sempre recalcule via esta função.
 *
 * @param projeto_id - ID do projeto
 * @returns Totais por tipo e total geral (todos REAL, nunca null)
 *
 * @usedBy FinanceiroTab — indicadores do painel executivo
 * @usedBy ViabilidadeEditor — totais calculados na aba Orçamento
 * @usedBy Dashboard Executivo — KPIs financeiros
 * @usedBy Payback — base de cálculo do retorno esperado
 *
 * @example
 * ```ts
 * const totais = calcularTotaisOrcamento(projetoId)
 * console.log(`CAPEX aprovado: R$ ${totais.capex_total}`)
 * console.log(`Investimento total: R$ ${totais.investimento_total}`)
 * ```
 */
export function calcularTotaisOrcamento(projeto_id: number): TotaisOrcamento {
  const db = getDb()

  const rows = db.prepare(`
    SELECT og.tipo, COALESCE(SUM(oi.valor_aprovado), 0) AS total
    FROM orcamento_grupos og
    LEFT JOIN orcamento_itens oi ON oi.grupo_id = og.id AND oi.ativo = 1
    WHERE og.projeto_id = ? AND og.ativo = 1
    GROUP BY og.tipo
  `).all(projeto_id) as { tipo: string; total: number }[]

  const totais: TotaisOrcamento = {
    capex_ativo: 0,
    capex_retorno: 0,
    opex: 0,
    capex_total: 0,
    investimento_total: 0,
  }

  for (const r of rows) {
    if (r.tipo === 'CAPEX_ATIVO')   totais.capex_ativo   = r.total
    if (r.tipo === 'CAPEX_RETORNO') totais.capex_retorno = r.total
    if (r.tipo === 'OPEX')          totais.opex          = r.total
  }

  totais.capex_total       = totais.capex_ativo + totais.capex_retorno
  totais.investimento_total = totais.capex_total + totais.opex

  return totais
}

/**
 * Retorna os totais de um grupo específico.
 *
 * @param grupo_id - ID do grupo de orçamento
 * @returns Totais aprovado e revisado para o grupo
 *
 * @usedBy CardFinanceiro — exibe totais por grupo
 * @usedBy FinanceiroTab — detalhamento por grupo
 */
export function calcularTotaisGrupo(grupo_id: number): TotaisGrupo {
  const db = getDb()

  const r = db.prepare(`
    SELECT
      grupo_id,
      COALESCE(SUM(valor_aprovado), 0)       AS valor_aprovado,
      SUM(valor_revisado)                     AS valor_revisado,
      COUNT(*)                               AS quantidade_itens
    FROM orcamento_itens
    WHERE grupo_id = ? AND ativo = 1
    GROUP BY grupo_id
  `).get(grupo_id) as TotaisGrupo | undefined

  return r ?? { grupo_id, valor_aprovado: 0, valor_revisado: null, quantidade_itens: 0 }
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

/**
 * Cria um novo grupo de investimento no orçamento do projeto.
 *
 * Grupos são criados na aba Orçamento da Viabilidade. Após aprovação da
 * Viabilidade, novos grupos só podem ser criados mediante revisão formal.
 *
 * @param params.projeto_id - ID do projeto
 * @param params.viabilidade_id - ID da Viabilidade (opcional — grupo ad-hoc possível)
 * @param params.tipo - Tipo de investimento (CAPEX_ATIVO | CAPEX_RETORNO | OPEX)
 * @param params.nome - Nome descritivo do grupo (ex: "CAPEX – Hardware")
 * @param params.cor - Cor hexadecimal para dashboards (opcional)
 * @param params.icone - Emoji ou nome de ícone (opcional)
 * @param params.ordem - Posição na ordenação visual
 * @param params.criado_por - ID do usuário
 * @returns ID do grupo criado
 *
 * @usedBy ViabilidadeEditor — aba Orçamento
 *
 * @example
 * ```ts
 * const grupoId = criarGrupo({
 *   projeto_id: 1,
 *   viabilidade_id: 3,
 *   tipo: 'CAPEX_ATIVO',
 *   nome: 'CAPEX – Hardware',
 *   cor: '#003087',
 *   criado_por: session.id,
 * })
 * ```
 */
export function criarGrupo(params: {
  projeto_id: number
  viabilidade_id?: number | null
  tipo: TipoInvestimento
  nome: string
  cor?: string | null
  icone?: string | null
  ordem?: number
  criado_por: number
}): number {
  const db = getDb()

  const r = db.prepare(`
    INSERT INTO orcamento_grupos
      (projeto_id, viabilidade_id, tipo, nome, cor, icone, ordem, criado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.projeto_id,
    params.viabilidade_id ?? null,
    params.tipo,
    params.nome,
    params.cor ?? TIPO_INVESTIMENTO_CORES[params.tipo],
    params.icone ?? null,
    params.ordem ?? 0,
    params.criado_por,
  )

  return Number(r.lastInsertRowid)
}

/**
 * Cria um item de investimento dentro de um grupo.
 *
 * O item é a unidade mínima do orçamento. Cada lançamento financeiro
 * deve referenciar um item — ele herda conta contábil e centro de custo.
 *
 * @param params.grupo_id - ID do grupo pai
 * @param params.projeto_id - ID do projeto
 * @param params.nome - Nome do item (ex: "Servidor Dell PowerEdge")
 * @param params.valor_aprovado - Valor orçado aprovado (em R$)
 * @param params.conta_contabil_id - FK para config_contas_contabeis (nullable)
 * @param params.centro_custo_id - FK para config_centros_custo (nullable)
 * @param params.responsavel_usuario_id - Responsável pelo item (nullable)
 * @param params.prioridade - ALTA | MEDIA | BAIXA
 * @param params.criado_por - ID do usuário
 * @returns ID do item criado
 *
 * @usedBy ViabilidadeEditor — aba Orçamento
 *
 * @example
 * ```ts
 * const itemId = criarItem({
 *   grupo_id: 5,
 *   projeto_id: 1,
 *   nome: 'Servidor Dell PowerEdge',
 *   valor_aprovado: 80000,
 *   conta_contabil_id: 2,
 *   criado_por: session.id,
 * })
 * ```
 */
export function criarItem(params: {
  grupo_id: number
  projeto_id: number
  nome: string
  descricao?: string | null
  conta_contabil_id?: number | null
  centro_custo_id?: number | null
  valor_aprovado: number
  valor_revisado?: number | null
  prioridade?: string
  responsavel_usuario_id?: number | null
  ordem?: number
  criado_por: number
}): number {
  const db = getDb()

  const r = db.prepare(`
    INSERT INTO orcamento_itens
      (grupo_id, projeto_id, nome, descricao, conta_contabil_id, centro_custo_id,
       valor_aprovado, valor_revisado, prioridade, responsavel_usuario_id, ordem, criado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.grupo_id,
    params.projeto_id,
    params.nome,
    params.descricao ?? null,
    params.conta_contabil_id ?? null,
    params.centro_custo_id ?? null,
    params.valor_aprovado,
    params.valor_revisado ?? null,
    params.prioridade ?? 'MEDIA',
    params.responsavel_usuario_id ?? null,
    params.ordem ?? 0,
    params.criado_por,
  )

  const itemId = Number(r.lastInsertRowid)

  registrarAuditoria({
    usuario_id: params.criado_por,
    acao: 'CREATE',
    entidade: 'orcamento_itens',
    entidade_id: itemId,
    projeto_id: params.projeto_id,
    descricao: `Item de orçamento criado: ${params.nome} (R$ ${params.valor_aprovado.toFixed(2)})`,
    dados_depois: { nome: params.nome, valor_aprovado: params.valor_aprovado },
  })

  return itemId
}

/**
 * Atualiza um item de orçamento existente (soft-update — mantém histórico via auditoria).
 *
 * @param id - ID do item
 * @param params - Campos a atualizar (parcial)
 * @param usuario_id - ID do usuário que está atualizando
 *
 * @usedBy ViabilidadeEditor — aba Orçamento
 */
export function atualizarItem(
  id: number,
  params: Partial<{
    nome: string
    descricao: string | null
    conta_contabil_id: number | null
    centro_custo_id: number | null
    valor_aprovado: number
    valor_revisado: number | null
    status: string
    prioridade: string
    responsavel_usuario_id: number | null
    ordem: number
  }>,
  usuario_id: number
): void {
  const db = getDb()

  const campos = Object.keys(params) as (keyof typeof params)[]
  if (!campos.length) return

  const sets = campos.map(c => `${c} = @${c}`).join(', ')
  const values: Record<string, unknown> = { id, ...params }

  db.prepare(`UPDATE orcamento_itens SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run(values)

  registrarAuditoria({
    usuario_id,
    acao: 'UPDATE',
    entidade: 'orcamento_itens',
    entidade_id: id,
    descricao: `Item de orçamento atualizado`,
    dados_depois: params,
  })
}

/**
 * Desativa um item de orçamento (soft delete — nunca exclui fisicamente).
 *
 * @param id - ID do item
 * @param usuario_id - ID do usuário
 *
 * @usedBy ViabilidadeEditor — aba Orçamento
 */
export function desativarItem(id: number, usuario_id: number): void {
  const db = getDb()

  db.prepare(
    `UPDATE orcamento_itens SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(id)

  registrarAuditoria({
    usuario_id,
    acao: 'DELETE_SOFT',
    entidade: 'orcamento_itens',
    entidade_id: id,
    descricao: 'Item de orçamento desativado',
  })
}

/**
 * Desativa um grupo inteiro e todos os seus itens (soft delete em cascata).
 *
 * @param grupo_id - ID do grupo
 * @param usuario_id - ID do usuário
 *
 * @usedBy ViabilidadeEditor — aba Orçamento
 */
export function desativarGrupo(grupo_id: number, usuario_id: number): void {
  const db = getDb()

  const executar = db.transaction(() => {
    db.prepare(`UPDATE orcamento_itens SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE grupo_id = ?`).run(grupo_id)
    db.prepare(`UPDATE orcamento_grupos SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(grupo_id)
  })
  executar()

  registrarAuditoria({
    usuario_id,
    acao: 'DELETE_SOFT',
    entidade: 'orcamento_grupos',
    entidade_id: grupo_id,
    descricao: 'Grupo de orçamento e itens desativados',
  })
}
