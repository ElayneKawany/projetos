/**
 * @file lib/importadores/financeiro-excel.ts
 *
 * Parser do modelo oficial MegaG para importação de contratos e pagamentos.
 *
 * Colunas oficiais (ordem fixa do template):
 *   Número Contrato | Contratado | Tipo Contrato | Descrição Serviço | Valor Aprovado |
 *   Número Documento | Tipo Documento | Nota Fiscal | Data Pagamento | Competência |
 *   Valor Pago | Observação
 *
 * Consolidação: linhas com mesmo (Número Contrato + Contratado) são agrupadas.
 * Cada linha com Valor Pago > 0 gera um pagamento.
 */

import * as XLSX from 'xlsx'
import type { TipoContrato, TipoDocumentoFinanceiro, NaturezaFinanceira } from '@/types'
import type { ContratoParseado, CriarPagamentoInput } from '@/lib/financeiro/types'

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export interface ResultadoImportacaoFinanceiro {
  contratos: ContratoParseado[]
  linhasLidas: number
  contratosImportados: number
  pagamentosImportados: number
  warnings: string[]
  erros: string[]
  errosFatais: string[]
}

// ─── Normalização ────────────────────────────────────────────────────────────

function normChave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const COLUNAS_OFICIAIS: Record<string, string> = {
  numerocontrato:      'numero_contrato',
  contratado:          'contratado',
  tipocontrato:        'tipo_contrato',
  naturezafinanceira:  'natureza_financeira',
  descricaoservico:    'descricao_servico',
  valoraprovado:       'valor_aprovado',
  numerodocumento:     'numero_documento',
  tipodocumento:       'tipo_documento',
  notafiscal:          'nota_fiscal',
  datapagamento:       'data_pagamento',
  competencia:         'competencia',
  valorpago:           'valor_pago',
  observacao:          'observacao',
}

const TIPOS_CONTRATO_VALIDOS = new Set<TipoContrato>(['SERVICO', 'FORNECIMENTO', 'OBRA', 'OUTRO'])
const TIPOS_DOC_VALIDOS = new Set<TipoDocumentoFinanceiro>(['NF', 'BOLETO', 'TED', 'PIX', 'CHEQUE', 'OUTRO'])

function normNatureza(raw: string): NaturezaFinanceira {
  const u = raw.toUpperCase().trim()
  if (u === 'OPEX') return 'OPEX'
  return 'CAPEX'
}

function normTipoContrato(raw: string): TipoContrato {
  const u = raw.toUpperCase().trim()
  if (TIPOS_CONTRATO_VALIDOS.has(u as TipoContrato)) return u as TipoContrato
  // Aliases comuns
  if (/servi/i.test(raw)) return 'SERVICO'
  if (/fornec/i.test(raw)) return 'FORNECIMENTO'
  if (/obra/i.test(raw)) return 'OBRA'
  return 'OUTRO'
}

function normTipoDoc(raw: string): TipoDocumentoFinanceiro {
  const u = raw.toUpperCase().trim()
  if (TIPOS_DOC_VALIDOS.has(u as TipoDocumentoFinanceiro)) return u as TipoDocumentoFinanceiro
  if (/nota|nf/i.test(raw)) return 'NF'
  if (/boleto/i.test(raw)) return 'BOLETO'
  if (/ted/i.test(raw)) return 'TED'
  if (/pix/i.test(raw)) return 'PIX'
  if (/cheque/i.test(raw)) return 'CHEQUE'
  return 'OUTRO'
}

function parsearValor(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  const s = String(v).replace(/[R$\s.]/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parsearData(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    return v.toISOString().slice(0, 10)
  }
  if (typeof v === 'number') {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    const mm = String(d.m).padStart(2, '0')
    const dd = String(d.d).padStart(2, '0')
    return `${d.y}-${mm}-${dd}`
  }
  const s = String(v).trim()
  // DD/MM/AAAA
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

// ─── Parser principal ────────────────────────────────────────────────────────

export function parsearExcelFinanceiro(buffer: ArrayBuffer): ResultadoImportacaoFinanceiro {
  const warnings: string[] = []
  const erros: string[] = []
  const errosFatais: string[] = []

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    errosFatais.push('Arquivo inválido ou corrompido. Certifique-se de enviar um .xlsx ou .xls.')
    return { contratos: [], linhasLidas: 0, contratosImportados: 0, pagamentosImportados: 0, warnings, erros, errosFatais }
  }

  const wsName = wb.SheetNames[0]
  if (!wsName) {
    errosFatais.push('Planilha vazia.')
    return { contratos: [], linhasLidas: 0, contratosImportados: 0, pagamentosImportados: 0, warnings, erros, errosFatais }
  }

  const ws = wb.Sheets[wsName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false })

  if (rows.length === 0) {
    errosFatais.push('A planilha não contém dados (apenas cabeçalho ou vazia).')
    return { contratos: [], linhasLidas: 0, contratosImportados: 0, pagamentosImportados: 0, warnings, erros, errosFatais }
  }

  // Mapear cabeçalho normalizado → chave original
  const headerMap: Record<string, string> = {}
  for (const key of Object.keys(rows[0])) {
    const norm = normChave(key)
    const campo = COLUNAS_OFICIAIS[norm]
    if (campo) headerMap[campo] = key
  }

  const missingRequired = ['contratado'].filter(f => !headerMap[f])
  if (missingRequired.length > 0) {
    errosFatais.push(`Colunas obrigatórias não encontradas: ${missingRequired.join(', ')}. Verifique o template.`)
    return { contratos: [], linhasLidas: 0, contratosImportados: 0, pagamentosImportados: 0, warnings, erros, errosFatais }
  }

  const getCol = (row: Record<string, unknown>, campo: string) =>
    headerMap[campo] ? row[headerMap[campo]] : null

  // Mapa de consolidação: chave = "numero_contrato|||contratado"
  const contratoMap = new Map<string, ContratoParseado>()
  let linhasLidas = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const numLinha = i + 2  // +2 por causa do cabeçalho
    linhasLidas++

    const contratadoRaw = getCol(row, 'contratado')
    if (!contratadoRaw || String(contratadoRaw).trim() === '') {
      warnings.push(`Linha ${numLinha}: campo "Contratado" vazio — linha ignorada.`)
      continue
    }
    const contratado = String(contratadoRaw).trim()

    const numContratoRaw = getCol(row, 'numero_contrato')
    const numero_contrato = numContratoRaw ? String(numContratoRaw).trim() || null : null

    const chave = `${numero_contrato ?? ''}|||${contratado}`

    const valorAprovadoRaw = getCol(row, 'valor_aprovado')
    const valorAprovado = parsearValor(valorAprovadoRaw) ?? 0

    const tipoContratoRaw = getCol(row, 'tipo_contrato')
    const tipo_contrato = tipoContratoRaw ? normTipoContrato(String(tipoContratoRaw)) : 'SERVICO'

    const naturezaRaw = getCol(row, 'natureza_financeira')
    const natureza_financeira: NaturezaFinanceira = naturezaRaw ? normNatureza(String(naturezaRaw)) : 'CAPEX'

    const descricaoRaw = getCol(row, 'descricao_servico')
    const descricao_servico = descricaoRaw ? String(descricaoRaw).trim() || null : null

    if (!contratoMap.has(chave)) {
      contratoMap.set(chave, {
        numero_contrato,
        contratado,
        tipo_contrato,
        natureza_financeira,
        descricao_servico,
        valor_aprovado: valorAprovado,
        pagamentos: [],
      })
    } else {
      // Consolidar: manter maior valor_aprovado
      const existing = contratoMap.get(chave)!
      if (valorAprovado > existing.valor_aprovado) {
        existing.valor_aprovado = valorAprovado
      }
      if (!existing.descricao_servico && descricao_servico) {
        existing.descricao_servico = descricao_servico
      }
    }

    // Pagamento: só gera se valor_pago > 0
    const valorPagoRaw = getCol(row, 'valor_pago')
    const valor_pago = parsearValor(valorPagoRaw)

    if (valor_pago != null && valor_pago > 0) {
      const tipoDocRaw = getCol(row, 'tipo_documento')
      const tipo_documento: TipoDocumentoFinanceiro = tipoDocRaw ? normTipoDoc(String(tipoDocRaw)) : 'NF'

      const numDocRaw = getCol(row, 'numero_documento')
      const numero_documento = numDocRaw ? String(numDocRaw).trim() || null : null

      const nfRaw = getCol(row, 'nota_fiscal')
      const nota_fiscal = nfRaw ? String(nfRaw).trim() || null : null

      const dataPagamentoRaw = getCol(row, 'data_pagamento')
      const data_pagamento = parsearData(dataPagamentoRaw)
      if (dataPagamentoRaw && !data_pagamento) {
        warnings.push(`Linha ${numLinha}: data de pagamento "${dataPagamentoRaw}" inválida — campo ignorado.`)
      }

      const compRaw = getCol(row, 'competencia')
      const competencia = compRaw ? String(compRaw).trim() || null : null

      const obsRaw = getCol(row, 'observacao')
      const observacao = obsRaw ? String(obsRaw).trim() || null : null

      const pagamento: Omit<CriarPagamentoInput, 'contrato_id' | 'projeto_id'> = {
        numero_documento,
        tipo_documento,
        nota_fiscal,
        data_pagamento,
        competencia,
        valor_pago,
        observacao,
      }

      contratoMap.get(chave)!.pagamentos.push(pagamento)
    }
  }

  const contratos = Array.from(contratoMap.values())
  const pagamentosImportados = contratos.reduce((s, c) => s + c.pagamentos.length, 0)

  if (contratos.length === 0) {
    warnings.push('Nenhum contrato válido encontrado na planilha.')
  }

  return {
    contratos,
    linhasLidas,
    contratosImportados: contratos.length,
    pagamentosImportados,
    warnings,
    erros,
    errosFatais,
  }
}
