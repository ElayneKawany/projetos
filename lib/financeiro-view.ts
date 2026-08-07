/**
 * @file lib/financeiro-view.ts
 *
 * Tipos de navegação do Painel Financeiro.
 *
 * A estrutura de `FinanceiroView` suporta 4 níveis de drill-down sem
 * necessidade de refatoração futura ao adicionar novos níveis:
 *
 *   Painel → Tipo (CAPEX_ATIVO | CAPEX_RETORNO | OPEX) → Item → Detalhe do Item
 *
 * Seguro para importar em Client Components (sem dependência de servidor).
 *
 * @module financeiro-view
 * @usedBy FinanceiroTab — controla o nível de navegação exibido
 * @usedBy DetalhamentoFinanceiro — recebe o nível atual
 * @usedBy DetalheItem — nível mais profundo
 */

import type { TipoInvestimento, OrcamentoItem, OrcamentoGrupo } from './orcamento-types'

/** Painel executivo consolidado — nível raiz */
export type ViewPainel = { nivel: 'painel' }

/** Detalhamento por tipo de investimento */
export type ViewTipo = { nivel: 'tipo'; tipo: TipoInvestimento }

/** Detalhe de um item de orçamento específico */
export type ViewItem = {
  nivel: 'item'
  tipo: TipoInvestimento
  grupo: OrcamentoGrupo
  item: OrcamentoItem
}

/** União discriminada de todas as views do painel financeiro */
export type FinanceiroView = ViewPainel | ViewTipo | ViewItem

/** Produz o breadcrumb textual da view atual */
export function breadcrumbFinanceiro(
  view: FinanceiroView,
  labels: Record<TipoInvestimento, string>
): string[] {
  if (view.nivel === 'painel') return ['Financeiro']
  if (view.nivel === 'tipo') return ['Financeiro', labels[view.tipo]]
  return ['Financeiro', labels[view.tipo], view.grupo.nome, view.item.nome]
}
