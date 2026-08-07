/**
 * Constantes do módulo Financeiro — Contratos.
 * Importar daqui sempre; nunca duplicar valores mágicos nos serviços.
 */

/**
 * Sentinel para `movimento_id` em registros criados pelo módulo de Contratos.
 * A tabela `financeiro_pagamentos` foi projetada com `movimento_id NOT NULL` (modelo legado).
 * Registros novos, vinculados a contratos, usam 0 como placeholder.
 *
 * TODO: tornar `movimento_id` nullable em `financeiro_pagamentos` e remover este sentinel
 *       quando todas as bases legadas estiverem migradas para o módulo de Contratos.
 */
export const MOVIMENTO_CONTRATO = 0

/** Valores válidos para `financeiro_contratos.natureza_financeira` */
export const NATUREZA_FINANCEIRA = ['CAPEX', 'OPEX'] as const

/** Valores válidos para `financeiro_contratos.status` */
export const STATUS_CONTRATO = ['ATIVO', 'SUSPENSO', 'ENCERRADO', 'CANCELADO'] as const

/** Valores válidos para `financeiro_contratos.tipo_contrato` */
export const TIPO_CONTRATO = ['SERVICO', 'FORNECIMENTO', 'OBRA', 'OUTRO'] as const

/** Valores válidos para `financeiro_pagamentos.tipo_documento` */
export const TIPO_DOCUMENTO = ['NF', 'BOLETO', 'TED', 'PIX', 'CHEQUE', 'OUTRO'] as const

/** Valores válidos para status de pagamento (reservado para evolução futura) */
export const STATUS_PAGAMENTO = ['PENDENTE', 'PAGO', 'CANCELADO'] as const

/** Formata valor monetário no padrão pt-BR (ex.: 1.250,00) */
export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
