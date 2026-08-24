/**
 * Interfaces de entrada/saída do módulo Financeiro — Contratos.
 * Este arquivo não importa nada do banco — zero dependências circulares.
 */
import type { TipoContrato, TipoDocumentoFinanceiro, StatusContrato, NaturezaFinanceira } from '@/types'

export interface CriarContratoInput {
  projeto_id: number
  numero_contrato?: string | null
  contratado: string
  tipo_contrato?: TipoContrato
  natureza_financeira: NaturezaFinanceira
  descricao_servico?: string | null
  /** Critério de enquadramento (ex.: "Aço e Cordoalha"). Omitido/null = sem restrição de categoria. */
  categoria?: string | null
  valor_aprovado: number
  observacao?: string | null
  /** Projeção de pagamentos — 'NENHUMA' (default) | 'PARCELADO'. Nunca é pagamento real. */
  tipo_projecao?: 'NENHUMA' | 'PARCELADO'
  parcelas_projecao?: Array<{ numero: number; competencia: string; valor_projetado: number }>
}

export interface AtualizarContratoInput {
  numero_contrato?: string | null
  contratado?: string
  tipo_contrato?: TipoContrato
  natureza_financeira?: NaturezaFinanceira
  descricao_servico?: string | null
  categoria?: string | null
  valor_aprovado?: number
  status?: StatusContrato
  observacao?: string | null
}

export interface CriarPagamentoInput {
  /** null = ainda não enquadrado (AGUARDANDO_ANALISE ou SEM_CONTRATO) — ver lib/financeiro/enquadramento.ts */
  contrato_id: number | null
  projeto_id: number
  numero_documento?: string | null
  tipo_documento?: TipoDocumentoFinanceiro
  nota_fiscal?: string | null
  data_pagamento?: string | null
  competencia?: string | null
  valor_pago: number
  observacao?: string | null
  arquivo_path?: string | null
  /** Fornecedor que emitiu este lançamento — usado pelo enquadramento; omitido/null em fluxos onde o contrato já define o fornecedor. */
  fornecedor?: string | null
  enquadramento_status?: 'AUTOMATICO' | 'AGUARDANDO_ANALISE' | 'SEM_CONTRATO' | 'MANUAL' | null
  contratos_candidatos?: number[] | null
}

export interface AtualizarPagamentoInput {
  numero_documento?: string | null
  tipo_documento?: TipoDocumentoFinanceiro
  nota_fiscal?: string | null
  data_pagamento?: string | null
  competencia?: string | null
  valor_pago?: number
  observacao?: string | null
  arquivo_path?: string | null
}

/**
 * Contrato parseado de planilha Excel.
 * Usado pelo importador antes de persistir no banco.
 */
export interface ContratoParseado {
  numero_contrato: string | null
  contratado: string
  tipo_contrato: TipoContrato
  natureza_financeira: NaturezaFinanceira
  descricao_servico: string | null
  valor_aprovado: number
  pagamentos: Omit<CriarPagamentoInput, 'contrato_id' | 'projeto_id'>[]
}
