/**
 * Enquadramento de lançamentos (pagamentos/NF) em contratos.
 *
 * O fornecedor NÃO é a chave de identificação do contrato — um mesmo contrato
 * (ex.: "Material — Aço e Cordoalha") pode receber lançamentos de fornecedores
 * diferentes. O contrato só restringe fornecedor quando `contratado` estiver
 * preenchido; vazio = aceita qualquer fornecedor.
 *
 * Prioridade de enquadramento (nessa ordem):
 *   1. Contrato informado diretamente (ex.: botão "Lançar pagamento" dentro do
 *      card de um contrato específico) — decisão humana, vence sempre.
 *   2. Busca por critérios do contrato: obra/projeto (projeto_id) + categoria +
 *      fornecedor (só quando o contrato restringe) + saldo suficiente.
 *      0 compatíveis → SEM_CONTRATO · 1 → AUTOMÁTICO · 2+ → AGUARDANDO_ANÁLISE.
 *
 * Saldo/utilizado nunca são armazenados — são sempre derivados de
 * SUM(valor_pago) (ver buscarContratosCompletos em ./dashboard.ts), então
 * trocar o contrato de um lançamento (enquadramento manual/correção) recalcula
 * o saldo dos dois contratos automaticamente, sem nenhuma escrita extra.
 */
import type { EnquadramentoStatus, FinanceiroContrato, FinanceiroEnquadramentoHistorico, TipoDocumentoFinanceiro } from '@/types'
import { FinanceiroRepository } from '@/lib/repositories'
import { criarPagamento, buscarPagamentoPorId } from './pagamentos'

export interface EnquadrarLancamentoInput {
  projeto_id: number
  /** Quando vem preenchido (ex.: usuário abriu "Lançar pagamento" dentro de um contrato), vence a busca por critérios. */
  contrato_id?: number | null
  fornecedor: string
  categoria?: string | null
  valor_pago: number
  numero_documento?: string | null
  tipo_documento?: TipoDocumentoFinanceiro
  nota_fiscal?: string | null
  data_pagamento?: string | null
  competencia?: string | null
  observacao?: string | null
  arquivo_path?: string | null
}

export interface ResultadoEnquadramento {
  pagamento_id: number
  status: EnquadramentoStatus
  contrato_id: number | null
  contratos_candidatos: number[] | null
}

/** Busca contratos compatíveis com um lançamento — uma única query filtrada, sem busca textual pesada. */
export function encontrarContratosCompativeis(criterios: {
  projeto_id: number
  categoria?: string | null
  fornecedor: string
  valor: number
}): FinanceiroContrato[] {
  return FinanceiroRepository.findContratosCompativeis({
    projeto_id: criterios.projeto_id,
    categoria: criterios.categoria ?? null,
    fornecedor: criterios.fornecedor,
    valor: criterios.valor,
  }) as unknown as FinanceiroContrato[]
}

export function enquadrarLancamento(
  dados: EnquadrarLancamentoInput,
  usuario_id: number,
  usuario_nome: string
): ResultadoEnquadramento {
  let contrato_id: number | null = null
  let status: EnquadramentoStatus
  let contratos_candidatos: number[] | null = null
  let regra_utilizada: string
  let tipo_acao: FinanceiroEnquadramentoHistorico['tipo_acao']

  if (dados.contrato_id != null) {
    // Prioridade 1 — contrato já definido, não roda a busca.
    contrato_id = dados.contrato_id
    status = 'MANUAL'
    tipo_acao = 'MANUAL'
    regra_utilizada = 'contrato informado diretamente'
  } else {
    const compativeis = encontrarContratosCompativeis({
      projeto_id: dados.projeto_id,
      categoria: dados.categoria,
      fornecedor: dados.fornecedor,
      valor: dados.valor_pago,
    })
    tipo_acao = 'AUTOMATICO'
    if (compativeis.length === 0) {
      status = 'SEM_CONTRATO'
      regra_utilizada = 'nenhum contrato compatível (projeto + categoria + fornecedor + saldo)'
    } else if (compativeis.length === 1) {
      contrato_id = compativeis[0].id
      status = 'AUTOMATICO'
      regra_utilizada = 'único contrato compatível (projeto + categoria + fornecedor + saldo)'
    } else {
      contratos_candidatos = compativeis.map(c => c.id)
      status = 'AGUARDANDO_ANALISE'
      regra_utilizada = `${compativeis.length} contratos compatíveis (projeto + categoria + fornecedor + saldo)`
    }
  }

  const pagamento_id = criarPagamento(
    {
      contrato_id,
      projeto_id: dados.projeto_id,
      numero_documento: dados.numero_documento,
      tipo_documento: dados.tipo_documento,
      nota_fiscal: dados.nota_fiscal,
      data_pagamento: dados.data_pagamento,
      competencia: dados.competencia,
      valor_pago: dados.valor_pago,
      observacao: dados.observacao,
      arquivo_path: dados.arquivo_path,
      fornecedor: dados.fornecedor,
      enquadramento_status: status,
      contratos_candidatos,
    },
    usuario_id,
    usuario_nome
  )

  FinanceiroRepository.insertHistoricoEnquadramento({
    pagamento_id,
    projeto_id: dados.projeto_id,
    contrato_id_anterior: null,
    contrato_id_novo: contrato_id,
    tipo_acao,
    regra_utilizada,
    usuario_id,
    usuario_nome,
  })

  return { pagamento_id, status, contrato_id, contratos_candidatos }
}

/**
 * Correção manual (§8) — inclui a seleção manual de contrato para um lançamento
 * AGUARDANDO_ANALISE/SEM_CONTRATO. Nunca altera `valor_pago`. Saldo dos contratos
 * (antigo e novo) é recalculado automaticamente porque é sempre derivado — só
 * precisamos trocar o vínculo.
 */
export function corrigirEnquadramento(
  pagamento_id: number,
  novo_contrato_id: number,
  usuario_id: number,
  usuario_nome: string
): void {
  const pagamento = buscarPagamentoPorId(pagamento_id)
  if (!pagamento) throw new Error('Pagamento não encontrado.')

  const contratoNovo = FinanceiroRepository.findContratoParaPagamento(novo_contrato_id)
  if (!contratoNovo) throw new Error('Contrato não encontrado.')

  const contrato_id_anterior = pagamento.contrato_id

  FinanceiroRepository.updatePagamentoContrato(pagamento_id, novo_contrato_id, 'MANUAL', null)

  FinanceiroRepository.insertHistoricoEnquadramento({
    pagamento_id,
    projeto_id: pagamento.projeto_id,
    contrato_id_anterior,
    contrato_id_novo: novo_contrato_id,
    tipo_acao: 'CORRECAO_MANUAL',
    regra_utilizada: 'seleção manual do usuário',
    usuario_id,
    usuario_nome,
  })
}

export function buscarHistoricoEnquadramento(pagamento_id: number): FinanceiroEnquadramentoHistorico[] {
  return FinanceiroRepository.findHistoricoEnquadramento(pagamento_id) as unknown as FinanceiroEnquadramentoHistorico[]
}
