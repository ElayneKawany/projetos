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

// ── Campos — labels exatamente como no modelo oficial MegaG PMO ──────────────

type ChaveTexto = 'objetivo_detalhado' | 'situacao_atual' | 'escopo_fisico' | 'escopo_sistemico' | 'escopo_processo' | 'beneficios_tap'
type ChaveLista = 'setores_envolvidos' | 'etapas_projeto' | 'entregaveis' | 'pontos_atencao' | 'pontos_definir'

const CAMPOS_TEXTO: Array<{ label: string; chave: ChaveTexto }> = [
  { label: 'Objetivo Detalhado',  chave: 'objetivo_detalhado' },
  { label: 'Situação Atual',      chave: 'situacao_atual'     },
  { label: 'Escopo Físico',       chave: 'escopo_fisico'      },
  { label: 'Escopo Sistêmico',    chave: 'escopo_sistemico'   },
  { label: 'Escopo de Processo',  chave: 'escopo_processo'    },
  { label: 'Benefícios Esperados',chave: 'beneficios_tap'     },
]

const CAMPOS_LISTA: Array<{ label: string; chave: ChaveLista }> = [
  { label: 'Setores Envolvidos (separar por |)', chave: 'setores_envolvidos' },
  { label: 'Etapas do Projeto (separar por |)', chave: 'etapas_projeto'     },
  { label: 'Entregáveis (separar por |)',        chave: 'entregaveis'        },
  { label: 'Pontos de Atenção (separar por |)', chave: 'pontos_atencao'     },
  { label: 'Pontos a Definir (separar por |)',  chave: 'pontos_definir'     },
]

// Aliases de versões anteriores do template para garantir compatibilidade retroativa
const ALIASES: Record<string, string> = {
  'Objetivo do Projeto':      'Objetivo Detalhado',
  'Setores Envolvidos':       'Setores Envolvidos (separar por |)',
  'Etapas do Projeto':        'Etapas do Projeto (separar por |)',
  'Entregáveis':              'Entregáveis (separar por |)',
  'Pontos de Atenção':        'Pontos de Atenção (separar por |)',
  'Pontos a serem Definidos': 'Pontos a Definir (separar por |)',
}

// ── Exportar XLSX — formato oficial vertical (col A = campo, col B = valor) ──

export function gerarXlsxTap(): Buffer {
  const wb = XLSX.utils.book_new()

  // Estrutura exata do Modelo TAP.xlsx oficial MegaG PMO
  const linhas: (string | null)[][] = [
    ['MegaG PMO – Modelo TAP', ''],
    ['', ''],
    ['INSTRUÇÕES:', 'Preencha os valores na coluna B. Não altere a coluna A.'],
    ['', ''],
    ['Campo', 'Valor'],
    ...CAMPOS_TEXTO.map(c => [c.label, '']),
    ...CAMPOS_LISTA.map(c => [c.label, '']),
  ]

  const ws = XLSX.utils.aoa_to_sheet(linhas)

  // Largura das colunas conforme o arquivo de referência
  ws['!cols'] = [
    { wch: 39 }, // Coluna A — campo
    { wch: 81 }, // Coluna B — valor
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'TAP')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ── Parsear XLSX importado ────────────────────────────────────────────────────

export function parsearXlsxTap(buffer: Buffer): ResultadoImportacao {
  const wb   = XLSX.read(buffer, { type: 'buffer' })
  // Lê a aba "TAP" se existir; caso contrário a primeira aba
  const wsNome = wb.SheetNames.includes('TAP') ? 'TAP' : wb.SheetNames[0]
  const ws   = wb.Sheets[wsNome]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  // Detecta formato: horizontal (linha 0 = cabeçalhos com labels de campo)
  // ou vertical (col A = label, col B = valor) — padrão do modelo oficial
  const todosLabels = [...CAMPOS_TEXTO, ...CAMPOS_LISTA].map(c => c.label)
  const isHorizontal = rows.length >= 1 &&
    todosLabels.some(label => rows[0]?.some(h => norm(h) === norm(label)))

  const mapa: Record<string, string> = {}

  if (isHorizontal) {
    const headers = (rows[0] ?? []).map(h => String(h ?? '').trim())
    const values  = (rows[1] ?? []).map(v => String(v ?? '').trim())
    for (let i = 0; i < headers.length; i++) {
      if (headers[i]) mapa[headers[i]] = values[i] ?? ''
    }
  } else {
    // Formato vertical oficial: col A = label, col B = valor
    for (const row of rows) {
      const chave = String(row[0] ?? '').trim()
      const valor = String(row[1] ?? '').trim()
      if (chave) mapa[chave] = valor
    }
  }

  // Resolver aliases de versões anteriores para labels canônicos
  for (const [antigo, canônico] of Object.entries(ALIASES)) {
    if (antigo in mapa && !(canônico in mapa)) {
      mapa[canônico] = mapa[antigo]
    }
  }

  function obter(label: string) { return mapa[label] ?? '' }
  function lista(label: string) {
    return obter(label).split('|').map(s => s.trim()).filter(Boolean)
  }

  const dados: TapImportado = {
    objetivo_detalhado: obter(CAMPOS_TEXTO[0].label),
    situacao_atual:     obter(CAMPOS_TEXTO[1].label),
    escopo_fisico:      obter(CAMPOS_TEXTO[2].label),
    escopo_sistemico:   obter(CAMPOS_TEXTO[3].label),
    escopo_processo:    obter(CAMPOS_TEXTO[4].label),
    beneficios_tap:     obter(CAMPOS_TEXTO[5].label),
    setores_envolvidos: lista(CAMPOS_LISTA[0].label),
    etapas_projeto:     lista(CAMPOS_LISTA[1].label),
    entregaveis:        lista(CAMPOS_LISTA[2].label),
    pontos_atencao:     lista(CAMPOS_LISTA[3].label),
    pontos_definir:     lista(CAMPOS_LISTA[4].label),
  }

  return montarResultado(dados)
}

// ── Normalização para comparação de labels ────────────────────────────────────

function norm(s: string) {
  return String(s ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
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
