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
  valor_aprovado: number
  observacao?: string | null
}

export interface AtualizarContratoInput {
  numero_contrato?: string | null
  contratado?: string
  tipo_contrato?: TipoContrato
  natureza_financeira?: NaturezaFinanceira
  descricao_servico?: string | null
  valor_aprovado?: number
  status?: StatusContrato
  observacao?: string | null
}

export interface CriarPagamentoInput {
  contrato_id: number
  projeto_id: number
  numero_documento?: string | null
  tipo_documento?: TipoDocumentoFinanceiro
  nota_fiscal?: string | null
  data_pagamento?: string | null
  competencia?: string | null
  valor_pago: number
  observacao?: string | null
  arquivo_path?: string | null
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
