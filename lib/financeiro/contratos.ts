import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import type { FinanceiroContrato } from '@/types'
import { FinanceiroRepository } from '@/lib/repositories'
import { fmtBRL } from './constants'
import type { CriarContratoInput, AtualizarContratoInput } from './types'

export function buscarContratos(projeto_id: number): FinanceiroContrato[] {
  return FinanceiroRepository.findContratosAtivosProjeto(projeto_id) as unknown as FinanceiroContrato[]
}

export function buscarContratoPorId(id: number): FinanceiroContrato | undefined {
  return FinanceiroRepository.findContratoByIdCompleto(id) as unknown as FinanceiroContrato | undefined
}

export function criarContrato(
  dados: CriarContratoInput,
  usuario_id: number,
  usuario_nome: string
): number {
  const id = Number(FinanceiroRepository.insertContratoCompleto({
    projeto_id: dados.projeto_id,
    numero_contrato: dados.numero_contrato ?? null,
    contratado: dados.contratado,
    tipo_contrato: dados.tipo_contrato ?? 'SERVICO',
    natureza_financeira: dados.natureza_financeira,
    descricao_servico: dados.descricao_servico ?? null,
    valor_aprovado: dados.valor_aprovado,
    observacao: dados.observacao ?? null,
    criado_por: usuario_id,
  }))

  registrarEvento({
    projeto_id: dados.projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'MOVIMENTO',
    evento: 'CRIADO',
    titulo: `Contrato criado: ${dados.contratado} [${dados.natureza_financeira}]`,
    descricao: `Valor aprovado: R$ ${fmtBRL(dados.valor_aprovado)}`,
    usuario_id,
    usuario_nome,
    referencia_id: id,
    referencia_tipo: 'financeiro_contratos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'CREATE',
    entidade: 'financeiro_contratos',
    entidade_id: id,
    projeto_id: dados.projeto_id,
    descricao: `Contrato criado: ${dados.contratado}`,
    dados_depois: dados,
  })

  return id
}

export function atualizarContrato(
  id: number,
  dados: AtualizarContratoInput,
  projeto_id: number,
  usuario_id: number,
  usuario_nome: string
): void {
  const antes = buscarContratoPorId(id)

  FinanceiroRepository.updateContratoCompleto(id, {
    numero_contrato: dados.numero_contrato,
    contratado: dados.contratado,
    tipo_contrato: dados.tipo_contrato,
    natureza_financeira: dados.natureza_financeira,
    descricao_servico: dados.descricao_servico,
    valor_aprovado: dados.valor_aprovado,
    status: dados.status,
    observacao: dados.observacao,
  })

  const naturezaMudou = dados.natureza_financeira && antes?.natureza_financeira !== dados.natureza_financeira
  registrarEvento({
    projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'MOVIMENTO',
    evento: 'ALTERADO',
    titulo: `Contrato alterado: ${dados.contratado ?? antes?.contratado}`,
    descricao: naturezaMudou
      ? `Natureza financeira alterada de ${antes?.natureza_financeira ?? '?'} para ${dados.natureza_financeira}`
      : undefined,
    usuario_id,
    usuario_nome,
    referencia_id: id,
    referencia_tipo: 'financeiro_contratos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'UPDATE',
    entidade: 'financeiro_contratos',
    entidade_id: id,
    projeto_id,
    descricao: 'Contrato atualizado',
    dados_antes: antes,
    dados_depois: dados,
  })
}

export function desativarContrato(
  id: number,
  projeto_id: number,
  usuario_id: number,
  usuario_nome: string
): void {
  const antes = buscarContratoPorId(id)
  FinanceiroRepository.softDeleteContratoDatetimeNow(id)

  registrarEvento({
    projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'MOVIMENTO',
    evento: 'CANCELADO',
    titulo: 'Contrato excluído',
    usuario_id,
    usuario_nome,
    referencia_id: id,
    referencia_tipo: 'financeiro_contratos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'DELETE_SOFT',
    entidade: 'financeiro_contratos',
    entidade_id: id,
    projeto_id,
    descricao: 'Contrato desativado (soft-delete)',
    dados_antes: antes,
  })
}

export type { CriarContratoInput, AtualizarContratoInput }
