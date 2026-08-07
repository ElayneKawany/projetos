import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import { parsearExcelFinanceiro } from '@/lib/importadores/financeiro-excel'
import { FinanceiroRepository } from '@/lib/repositories'
import { db } from '@/lib/database'
import type { ContratoParseado } from './types'

export type { ContratoParseado }

export function importarContratos(
  projeto_id: number,
  contratos: ContratoParseado[],
  usuario_id: number,
  usuario_nome: string
): { importados: number; pagamentosImportados: number } {
  let importados = 0
  let pagamentosImportados = 0

  db.transaction(() => {
    for (const c of contratos) {
      const existing = FinanceiroRepository.findContratoExistente(
        projeto_id, c.contratado, c.numero_contrato
      )

      let contrato_id: number

      if (existing) {
        contrato_id = existing.id
        FinanceiroRepository.updateContratoValorAprovadoMax(contrato_id, c.valor_aprovado)
      } else {
        contrato_id = Number(FinanceiroRepository.insertContratoImportado({
          projeto_id,
          numero_contrato: c.numero_contrato ?? null,
          contratado: c.contratado,
          tipo_contrato: c.tipo_contrato,
          natureza_financeira: c.natureza_financeira ?? 'CAPEX',
          descricao_servico: c.descricao_servico ?? null,
          valor_aprovado: c.valor_aprovado,
          criado_por: usuario_id,
        }))
        importados++
      }

      for (const p of c.pagamentos) {
        FinanceiroRepository.insertPagamentoImportado({
          contrato_id,
          projeto_id,
          numero_documento: p.numero_documento ?? null,
          tipo_documento: p.tipo_documento ?? 'NF',
          nota_fiscal: p.nota_fiscal ?? null,
          data_pagamento: p.data_pagamento ?? null,
          competencia: p.competencia ?? null,
          valor_pago: p.valor_pago,
          observacao: p.observacao ?? null,
          criado_por: usuario_id,
        })
        pagamentosImportados++
      }
    }
  })

  registrarEvento({
    projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'MOVIMENTO',
    evento: 'IMPORTADO',
    titulo: `Importação financeira: ${importados} contrato(s), ${pagamentosImportados} pagamento(s)`,
    usuario_id,
    usuario_nome,
    origem: 'IMPORTACAO',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'UPLOAD',
    entidade: 'financeiro_contratos',
    projeto_id,
    descricao: `Importação Excel: ${importados} contratos, ${pagamentosImportados} pagamentos`,
    dados_depois: { importados, pagamentosImportados },
  })

  return { importados, pagamentosImportados }
}

/** Processa um buffer de planilha Excel e persiste no banco em transação única. */
export function importarExcelFinanceiro(
  projeto_id: number,
  buffer: ArrayBuffer,
  usuario_id: number,
  usuario_nome: string
): ReturnType<typeof parsearExcelFinanceiro> & { importados: number; pagamentosImportados: number } {
  const resultado = parsearExcelFinanceiro(buffer)

  if (resultado.errosFatais.length > 0 || resultado.contratos.length === 0) {
    return { ...resultado, importados: 0, pagamentosImportados: 0 }
  }

  const { importados, pagamentosImportados } = importarContratos(
    projeto_id,
    resultado.contratos,
    usuario_id,
    usuario_nome,
  )

  return { ...resultado, importados, pagamentosImportados }
}
