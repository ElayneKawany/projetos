import * as XLSX from 'xlsx'
import { buscarContratosCompletos } from './dashboard'
import type { FinanceiroContratoCompleto } from '@/types'

const CABECALHO = [
  'Número Contrato', 'Contratado', 'Tipo Contrato', 'Natureza Financeira', 'Descrição Serviço', 'Valor Aprovado',
  'Número Documento', 'Tipo Documento', 'Nota Fiscal', 'Data Pagamento', 'Competência',
  'Valor Pago', 'Observação',
]

const COL_WIDTHS = [
  { wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 16 },
  { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 12 },
  { wch: 14 }, { wch: 30 },
]

function fmtDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

function contratoParaLinhas(c: FinanceiroContratoCompleto): unknown[][] {
  if (c.pagamentos.length === 0) {
    return [[
      c.numero_contrato ?? '', c.contratado, c.tipo_contrato, c.natureza_financeira,
      c.descricao_servico ?? '', c.valor_aprovado,
      '', '', '', null, '', 0, '',
    ]]
  }
  return c.pagamentos.map(p => [
    c.numero_contrato ?? '', c.contratado, c.tipo_contrato, c.natureza_financeira,
    c.descricao_servico ?? '', c.valor_aprovado,
    p.numero_documento ?? '', p.tipo_documento ?? '', p.nota_fiscal ?? '',
    fmtDate(p.data_pagamento),
    p.competencia ?? '',
    p.valor_pago,
    p.observacao ?? '',
  ])
}

/** Gera o buffer XLSX para exportação de contratos e pagamentos de um projeto. */
export function gerarExcelFinanceiro(projeto_id: number): ArrayBuffer {
  const contratos = buscarContratosCompletos(projeto_id)

  const aoa: unknown[][] = [CABECALHO]
  for (const c of contratos) {
    aoa.push(...contratoParaLinhas(c))
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  ws['!cols'] = COL_WIDTHS

  // Formatar coluna de data (índice 9 = Data Pagamento) como DD/MM/YYYY
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let R = 1; R <= range.e.r; R++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 9 })
    const cell = ws[addr]
    if (cell) ws[addr] = { ...cell, z: 'DD/MM/YYYY' }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'FINANCEIRO')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true }) as ArrayBuffer
}
