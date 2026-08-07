import * as XLSX from 'xlsx'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TapImportado {
  objetivo_detalhado: string
  situacao_atual: string
  escopo_fisico: string
  escopo_sistemico: string
  escopo_processo: string
  beneficios_tap: string
  setores_envolvidos: string[]
  etapas_projeto: string[]
  entregaveis: string[]
  pontos_atencao: string[]
  pontos_definir: string[]
}

export interface ResultadoImportacao {
  dados: TapImportado
  camposFaltantes: string[]
  avisos: string[]
}

// ── Mapa de campos (label no XLSX → campo em TapImportado) ───────────────────

type ChaveTexto  = 'objetivo_detalhado' | 'situacao_atual' | 'escopo_fisico' | 'escopo_sistemico' | 'escopo_processo' | 'beneficios_tap'
type ChaveLista  = 'setores_envolvidos' | 'etapas_projeto' | 'entregaveis' | 'pontos_atencao' | 'pontos_definir'

const CAMPOS_TEXTO: Array<{ label: string; chave: ChaveTexto }> = [
  { label: 'Objetivo do Projeto',      chave: 'objetivo_detalhado' },
  { label: 'Situação Atual',           chave: 'situacao_atual'     },
  { label: 'Escopo Físico',            chave: 'escopo_fisico'      },
  { label: 'Escopo Sistêmico',         chave: 'escopo_sistemico'   },
  { label: 'Escopo de Processo',       chave: 'escopo_processo'    },
  { label: 'Benefícios Esperados',     chave: 'beneficios_tap'     },
]

const CAMPOS_LISTA: Array<{ label: string; chave: ChaveLista }> = [
  { label: 'Setores Envolvidos',        chave: 'setores_envolvidos' },
  { label: 'Etapas do Projeto',         chave: 'etapas_projeto'    },
  { label: 'Entregáveis',              chave: 'entregaveis'        },
  { label: 'Pontos de Atenção',        chave: 'pontos_atencao'     },
  { label: 'Pontos a serem Definidos', chave: 'pontos_definir'     },
]

const TODOS_CAMPOS = [
  ...CAMPOS_TEXTO.map(c => c.label),
  ...CAMPOS_LISTA.map(c => c.label),
]

// ── Exportar XLSX (template vazio, horizontal) ────────────────────────────────

export function gerarXlsxTap(): Buffer {
  const wb = XLSX.utils.book_new()

  // Linha 1: cabeçalhos; Linha 2: vazia para preenchimento
  const ws = XLSX.utils.aoa_to_sheet([
    TODOS_CAMPOS,
    TODOS_CAMPOS.map(() => ''),
  ])

  // Largura automática (mínimo 30, máximo 60 chars)
  ws['!cols'] = TODOS_CAMPOS.map(label => ({ wch: Math.min(60, Math.max(30, label.length + 4)) }))

  XLSX.utils.book_append_sheet(wb, ws, 'TAP')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ── Parsear XLSX importado (formato horizontal) ───────────────────────────────

export function parsearXlsxTap(buffer: Buffer): ResultadoImportacao {
  const wb   = XLSX.read(buffer, { type: 'buffer' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  // Suporta tanto formato horizontal (row[0]=headers, row[1]=values)
  // quanto formato vertical legacy (col A = label, col B = value)
  const isHorizontal = rows.length >= 1 && CAMPOS_TEXTO.some(c => rows[0]?.includes(c.label))

  const mapa: Record<string, string> = {}

  if (isHorizontal) {
    const headers = (rows[0] ?? []).map(h => String(h ?? '').trim())
    const values  = (rows[1] ?? []).map(v => String(v ?? '').trim())
    for (let i = 0; i < headers.length; i++) {
      if (headers[i]) mapa[headers[i]] = values[i] ?? ''
    }
  } else {
    // Formato vertical legacy (coluna A = label, coluna B = valor)
    for (const row of rows) {
      const chave = String(row[0] ?? '').trim()
      const valor = String(row[1] ?? '').trim()
      if (chave && valor) mapa[chave] = valor
    }
  }

  function obter(label: string) { return mapa[label] ?? '' }
  function lista(label: string) {
    return obter(label).split('|').map(s => s.trim()).filter(Boolean)
  }

  const dados: TapImportado = {
    objetivo_detalhado: obter('Objetivo do Projeto'),
    situacao_atual:     obter('Situação Atual'),
    escopo_fisico:      obter('Escopo Físico'),
    escopo_sistemico:   obter('Escopo Sistêmico'),
    escopo_processo:    obter('Escopo de Processo'),
    beneficios_tap:     obter('Benefícios Esperados'),
    setores_envolvidos: lista('Setores Envolvidos'),
    etapas_projeto:     lista('Etapas do Projeto'),
    entregaveis:        lista('Entregáveis'),
    pontos_atencao:     lista('Pontos de Atenção'),
    pontos_definir:     lista('Pontos a serem Definidos'),
  }

  return montarResultado(dados)
}

// ── Validação ─────────────────────────────────────────────────────────────────

function montarResultado(dados: TapImportado): ResultadoImportacao {
  const camposFaltantes: string[] = []
  const avisos: string[] = []

  const todosCampos = [
    ...CAMPOS_TEXTO.map(c => ({ chave: c.chave as keyof TapImportado, label: c.label })),
    ...CAMPOS_LISTA.map(c => ({ chave: c.chave as keyof TapImportado, label: c.label })),
  ]

  for (const campo of todosCampos) {
    const val = dados[campo.chave]
    const vazio = Array.isArray(val) ? val.length === 0 : !val
    if (vazio) camposFaltantes.push(campo.label)
  }

  if (camposFaltantes.length > 0) {
    avisos.push(`${camposFaltantes.length} campo(s) não preenchido(s) — complete manualmente.`)
  }

  return { dados, camposFaltantes, avisos }
}
