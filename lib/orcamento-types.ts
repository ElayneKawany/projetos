/**
 * @file lib/orcamento-types.ts
 *
 * Tipos e constantes do módulo de Orçamento sem nenhuma dependência de servidor.
 * Seguro para importar em Client Components.
 *
 * A lógica de banco (queries, mutations) permanece em lib/orcamento.ts.
 */

export type TipoInvestimento = 'CAPEX_ATIVO' | 'CAPEX_RETORNO' | 'OPEX'

export const TIPO_INVESTIMENTO_LABELS: Record<TipoInvestimento, string> = {
  CAPEX_ATIVO:   'CAPEX – Aquisição de Ativo',
  CAPEX_RETORNO: 'CAPEX – Retorno Financeiro',
  OPEX:          'OPEX – Despesa Operacional',
}

export const TIPO_INVESTIMENTO_CORES: Record<TipoInvestimento, string> = {
  CAPEX_ATIVO:   '#003087',
  CAPEX_RETORNO: '#16A34A',
  OPEX:          '#C8A84B',
}

export interface OrcamentoItem {
  id: number
  grupo_id: number
  projeto_id: number
  nome: string
  descricao: string | null
  conta_contabil_id: number | null
  conta_contabil_codigo: string | null
  conta_contabil_descricao: string | null
  centro_custo_id: number | null
  centro_custo_codigo: string | null
  centro_custo_descricao: string | null
  valor_aprovado: number
  valor_revisado: number | null
  status: string
  prioridade: string
  responsavel_usuario_id: number | null
  responsavel_nome: string | null
  ordem: number
  ativo: number
  criado_por: number | null
  created_at: string
}

export interface OrcamentoGrupo {
  id: number
  projeto_id: number
  viabilidade_id: number | null
  tipo: TipoInvestimento
  nome: string
  cor: string | null
  icone: string | null
  ordem: number
  ativo: number
  criado_por: number | null
  created_at: string
  itens: OrcamentoItem[]
}
