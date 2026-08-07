import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import type { FinanceiroContratoPagamento } from '@/types'
import { FinanceiroRepository } from '@/lib/repositories'
import { fmtBRL } from './constants'
import type { CriarPagamentoInput, AtualizarPagamentoInput } from './types'

export function buscarPagamentos(
  projeto_id: number,
  contrato_id?: number
): FinanceiroContratoPagamento[] {
  return FinanceiroRepository.findPagamentosPorContrato(projeto_id, contrato_id) as unknown as FinanceiroContratoPagamento[]
}

export function buscarPagamentoPorId(id: number): FinanceiroContratoPagamento | undefined {
  return FinanceiroRepository.findPagamentoByIdCompleto(id) as unknown as FinanceiroContratoPagamento | undefined
}

export function criarPagamento(
  dados: CriarPagamentoInput,
  usuario_id: number,
  usuario_nome: string
): number {
  const contrato = FinanceiroRepository.findContratoParaPagamento(dados.contrato_id)
  if (!contrato) throw new Error('Contrato não encontrado.')

  const id = Number(FinanceiroRepository.insertPagamentoCompleto({
    contrato_id: dados.contrato_id,
    projeto_id: dados.projeto_id,
    numero_documento: dados.numero_documento ?? null,
    tipo_documento: dados.tipo_documento ?? 'NF',
    nota_fiscal: dados.nota_fiscal ?? null,
    data_pagamento: dados.data_pagamento ?? null,
    competencia: dados.competencia ?? null,
    valor_pago: dados.valor_pago,
    observacao: dados.observacao ?? null,
    arquivo_path: dados.arquivo_path ?? null,
    criado_por: usuario_id,
  }))

  registrarEvento({
    projeto_id: dados.projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'PAGAMENTO',
    evento: 'PAGO',
    titulo: `Pagamento lançado — ${contrato.contratado}`,
    descricao: `R$ ${fmtBRL(dados.valor_pago)}${dados.nota_fiscal ? ` · NF ${dados.nota_fiscal}` : ''}`,
    usuario_id,
    usuario_nome,
    referencia_id: id,
    referencia_tipo: 'financeiro_pagamentos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'CREATE',
    entidade: 'financeiro_pagamentos',
    entidade_id: id,
    projeto_id: dados.projeto_id,
    descricao: `Pagamento lançado: R$ ${fmtBRL(dados.valor_pago)} para "${contrato.contratado}"`,
    dados_depois: dados,
  })

  return id
}

export function atualizarPagamento(
  id: number,
  dados: AtualizarPagamentoInput,
  projeto_id: number,
  usuario_id: number,
  usuario_nome: string
): void {
  const antes = buscarPagamentoPorId(id)

  FinanceiroRepository.updatePagamentoCompleto(id, {
    numero_documento: dados.numero_documento,
    tipo_documento: dados.tipo_documento,
    nota_fiscal: dados.nota_fiscal,
    data_pagamento: dados.data_pagamento,
    competencia: dados.competencia,
    valor_pago: dados.valor_pago,
    observacao: dados.observacao,
    arquivo_path: dados.arquivo_path,
  })

  registrarEvento({
    projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'PAGAMENTO',
    evento: 'ALTERADO',
    titulo: 'Pagamento alterado',
    usuario_id,
    usuario_nome,
    referencia_id: id,
    referencia_tipo: 'financeiro_pagamentos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'UPDATE',
    entidade: 'financeiro_pagamentos',
    entidade_id: id,
    projeto_id,
    descricao: 'Pagamento atualizado',
    dados_antes: antes,
    dados_depois: dados,
  })
}

export function desativarPagamento(
  id: number,
  projeto_id: number,
  usuario_id: number,
  usuario_nome: string
): void {
  const antes = buscarPagamentoPorId(id)
  FinanceiroRepository.softDeletePagamentoCompleto(id)

  registrarEvento({
    projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'PAGAMENTO',
    evento: 'CANCELADO',
    titulo: 'Pagamento excluído',
    usuario_id,
    usuario_nome,
    referencia_id: id,
    referencia_tipo: 'financeiro_pagamentos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'DELETE_SOFT',
    entidade: 'financeiro_pagamentos',
    entidade_id: id,
    projeto_id,
    descricao: 'Pagamento desativado (soft-delete)',
    dados_antes: antes,
  })
}

export type { CriarPagamentoInput, AtualizarPagamentoInput }
