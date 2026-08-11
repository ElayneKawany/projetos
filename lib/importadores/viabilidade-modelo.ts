import * as XLSX from 'xlsx'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ViabilidadeImportada {
  resumo_executivo: string
  capex: number | null
  opex: number | null
  opex_periodicidade: string
  economia_estimada: number | null
  economia_periodicidade: string
  tipo_payback: string
  payback_informado: number | null
  payback_unidade: string
  sistemas_envolvidos: string
  complexidade_tecnica: string
  dependencia_fornecedores: string
  infraestrutura: string
  impacto_operacional: string
  mudanca_processo: string
  recursos_necessarios: string
  impactos: string
  riscos: string
  data_inicio_prev: string
  data_fim_prev: string
  marcos: string
  recomendacao: string
  justificativa_recomendacao: string
  condicoes_aprovacao: string
  baseline_valor: number | null
  meta_valor: number | null
  tipo_indicador: string
  economia_mensal_esperada: number | null
  beneficios_esperados: string
}

export interface ResultadoImportacaoViabilidade {
  dados: ViabilidadeImportada
  camposFaltantes: string[]
  avisos: string[]
}

// ── Labels quantitativos (label XLSX → campo DB) ──────────────────────────────

const COLUNAS_QUANT: Array<{ label: string; chave: keyof ViabilidadeImportada; tipo?: 'num' }> = [
  { label: 'Nome do Projeto',                   chave: 'resumo_executivo'          }, // contexto — não importado direto
  { label: 'Diretoria Responsável',             chave: 'resumo_executivo'          }, // idem
  { label: 'Área Solicitante',                  chave: 'resumo_executivo'          }, // idem
  { label: 'Gerente do Projeto',                chave: 'resumo_executivo'          }, // idem
  { label: 'Resumo Executivo',                  chave: 'resumo_executivo'          },
  { label: 'CAPEX (R$)',                        chave: 'capex',                 tipo: 'num' },
  { label: 'OPEX (R$)',                         chave: 'opex',                  tipo: 'num' },
  { label: 'Periodicidade OPEX',                chave: 'opex_periodicidade'        },
  { label: 'Economia Estimada (R$)',            chave: 'economia_estimada',     tipo: 'num' },
  { label: 'Periodicidade Economia',            chave: 'economia_periodicidade'    },
  { label: 'Tipo Payback',                      chave: 'tipo_payback'              },
  { label: 'Payback Estimado (meses)',          chave: 'payback_informado',     tipo: 'num' },
  { label: 'Sistemas Envolvidos',               chave: 'sistemas_envolvidos'       },
  { label: 'Complexidade Técnica',             chave: 'complexidade_tecnica'      },
  { label: 'Dependência de Fornecedores',      chave: 'dependencia_fornecedores'  },
  { label: 'Infraestrutura',                    chave: 'infraestrutura'            },
  { label: 'Impacto Operacional',              chave: 'impacto_operacional'       },
  { label: 'Mudança de Processo',              chave: 'mudanca_processo'          },
  { label: 'Recursos Necessários',             chave: 'recursos_necessarios'      },
  { label: 'Impactos',                          chave: 'impactos'                  },
  { label: 'Benefícios Esperados',             chave: 'beneficios_esperados'      },
  { label: 'Riscos',                            chave: 'riscos'                    },
  { label: 'Data Início Prevista',             chave: 'data_inicio_prev'          },
  { label: 'Data Término Prevista',            chave: 'data_fim_prev'             },
  { label: 'Marcos Principais',               chave: 'marcos'                    },
  { label: 'Recomendação',                    chave: 'recomendacao'              },
  { label: 'Justificativa da Recomendação',   chave: 'justificativa_recomendacao'},
  { label: 'Condições de Aprovação',          chave: 'condicoes_aprovacao'       },
]

// ── Labels qualitativos — ordem e labels exatos do modelo oficial MegaG PMO ──

const COLUNAS_QUAL: Array<{ label: string; chave: keyof ViabilidadeImportada | null; tipo?: 'num' }> = [
  { label: 'Nome do Projeto',            chave: null                          }, // contexto
  { label: 'Diretoria Responsável',      chave: null                          }, // contexto
  { label: 'Área Solicitante',           chave: null                          }, // contexto
  { label: 'Gerente do Projeto',         chave: null                          }, // contexto
  { label: 'Patrocinador',               chave: null                          }, // contexto
  { label: 'Objetivo',                   chave: null                          }, // contexto
  { label: 'Cenário Atual',              chave: 'resumo_executivo'            },
  { label: 'Problema / Oportunidade',    chave: 'impactos'                    },
  { label: 'Solução Proposta',           chave: 'sistemas_envolvidos'         },
  { label: 'Escopo',                     chave: null                          }, // informativo
  { label: 'Premissas',                  chave: 'complexidade_tecnica'        },
  { label: 'Restrições',                 chave: 'dependencia_fornecedores'    },
  { label: 'Benefícios Esperados',       chave: 'beneficios_esperados'        },
  { label: 'Impactos Operacionais',      chave: 'impacto_operacional'         },
  { label: 'Impactos Organizacionais',   chave: 'mudanca_processo'            },
  { label: 'Impactos Estratégicos',      chave: null                          }, // informativo
  { label: 'Riscos',                     chave: 'riscos'                      },
  { label: 'Plano de Mitigação',         chave: null                          }, // informativo
  { label: 'CAPEX (R$)',                 chave: 'capex',           tipo: 'num' },
  { label: 'OPEX (R$)',                  chave: 'opex',            tipo: 'num' },
  { label: 'Stakeholders',              chave: null                          }, // informativo
  { label: 'Recursos Necessários',      chave: 'recursos_necessarios'        },
  { label: 'Cronograma Macro',           chave: 'marcos'                      },
  { label: 'Critérios de Sucesso',       chave: 'condicoes_aprovacao'         },
  { label: 'Indicadores Qualitativos',   chave: 'tipo_indicador'              },
  { label: 'Alinhamento Estratégico',    chave: 'justificativa_recomendacao'  },
  { label: 'Parecer Final',              chave: 'recomendacao'                },
]

// ── Exportar XLSX Quantitativo (template vazio, horizontal) ──────────────────

export function gerarXlsxViabilidade(): Buffer {
  return gerarTemplate(COLUNAS_QUANT.map(c => c.label), 'Viabilidade')
}

// ── Exportar XLSX Qualitativo — formato vertical, modelo oficial MegaG PMO ───

export function gerarXlsxViabilidadeQualitativo(): Buffer {
  const wb = XLSX.utils.book_new()

  // Estrutura exata do Modelo viabilidade.xlsx oficial
  const linhas: (string | null)[][] = [
    ['MegaG PMO – Estudo de Viabilidade Qualitativo', null],
    ['INSTRUÇÕES: Preencha os valores na coluna B. Não altere os textos da coluna A.', null],
    [null, null],
    ['── INFORMAÇÕES DO PROJETO ──', null],
    ['Nome do Projeto',         null],
    ['Diretoria Responsável',   null],
    ['Área Solicitante',        null],
    ['Gerente do Projeto',      null],
    ['Patrocinador',            null],
    ['Objetivo',                null],
    [null, null],
    ['── CONTEXTO ──', null],
    ['Cenário Atual',           null],
    ['Problema / Oportunidade', null],
    ['Solução Proposta',        null],
    [null, null],
    ['── ESCOPO E PLANEJAMENTO ──', null],
    ['Escopo',                  null],
    ['Premissas',               null],
    ['Restrições',              null],
    [null, null],
    ['── BENEFÍCIOS E IMPACTOS ──', null],
    ['Benefícios Esperados',       null],
    ['Impactos Operacionais',      null],
    ['Impactos Organizacionais',   null],
    ['Impactos Estratégicos',      null],
    [null, null],
    ['── RISCOS ──', null],
    ['Riscos',              null],
    ['Plano de Mitigação',  null],
    [null, null],
    ['── INVESTIMENTO (se aplicável) ──', null],
    ['CAPEX (R$)', null],
    ['OPEX (R$)',  null],
    [null, null],
    ['── EXECUÇÃO ──', null],
    ['Stakeholders',        null],
    ['Recursos Necessários',null],
    ['Cronograma Macro',    null],
    [null, null],
    ['── RESULTADO ESPERADO ──', null],
    ['Critérios de Sucesso',     null],
    ['Indicadores Qualitativos', null],
    ['Alinhamento Estratégico',  null],
    ['Parecer Final',            null],
  ]

  const ws = XLSX.utils.aoa_to_sheet(linhas)

  // Mesclar título e instrução na linha inteira (A1:B1 e A2:B2)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ]

  // Largura das colunas conforme referência
  ws['!cols'] = [
    { wch: 40 }, // Coluna A — campo
    { wch: 80 }, // Coluna B — valor
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Viabilidade Qualitativa')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ── Exportar XLSX Quantitativo (template horizontal — não alterado) ───────────

function gerarTemplate(headers: string[], nomePlanilha: string): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    headers.map(() => ''),
  ])
  ws['!cols'] = headers.map(h => ({ wch: Math.min(55, Math.max(22, h.length + 4)) }))
  XLSX.utils.book_append_sheet(wb, ws, nomePlanilha)
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ── Parsear XLSX importado ────────────────────────────────────────────────────

export function parsearXlsxViabilidade(buffer: Buffer): ResultadoImportacaoViabilidade {
  const wb   = XLSX.read(buffer, { type: 'buffer' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  const mapa: Record<string, string> = {}

  // Detecta formato: horizontal (linha 1 = cabeçalhos) ou vertical legacy (colA=label, colB=valor)
  const primeiraLinha = (rows[0] ?? []).map(h => String(h ?? '').trim())
  const isHorizontal  = [...COLUNAS_QUANT, ...COLUNAS_QUAL].some(c => primeiraLinha.includes(c.label))

  if (isHorizontal) {
    const values = (rows[1] ?? []).map(v => String(v ?? '').trim())
    for (let i = 0; i < primeiraLinha.length; i++) {
      if (primeiraLinha[i]) mapa[primeiraLinha[i]] = values[i] ?? ''
    }
  } else {
    for (const row of rows) {
      const chave = String(row[0] ?? '').trim()
      const valor = String(row[1] ?? '').trim()
      if (chave && valor && !chave.startsWith('──') && !chave.startsWith('MegaG') && !chave.startsWith('INSTRUÇÕES')) {
        mapa[chave] = valor
      }
    }
  }

  // Aliases: compatibilidade com labels de versões anteriores do template
  const ALIASES_QUAL: Record<string, string> = {
    'Diretoria':               'Diretoria Responsável',
    'Problema/Oportunidade':   'Problema / Oportunidade',
    'CAPEX':                   'CAPEX (R$)',
    'OPEX':                    'OPEX (R$)',
    'Dependências':            'Escopo',
    'Investimento Total':      'CAPEX (R$)', // histórico — mapeado para evitar erro
  }
  for (const [antigo, canônico] of Object.entries(ALIASES_QUAL)) {
    if (antigo in mapa && !(canônico in mapa)) mapa[canônico] = mapa[antigo]
  }

  const isQual = !!mapa['Cenário Atual'] || !!mapa['Parecer Final'] || !!mapa['Cronograma Macro']
  const colunas = isQual ? COLUNAS_QUAL : COLUNAS_QUANT

  function obter(...labels: string[]) {
    for (const l of labels) if (mapa[l]) return mapa[l]
    return ''
  }
  function num(...labels: string[]): number | null {
    const v = obter(...labels)
    const n = parseFloat(v.replace(',', '.'))
    return isNaN(n) ? null : n
  }

  // Monta dados a partir das colunas mapeadas
  const parcial: Partial<ViabilidadeImportada> = {}
  for (const col of colunas) {
    if (!col.chave) continue
    const valor = mapa[col.label] ?? ''
    if (!valor) continue
    if (col.tipo === 'num') {
      const n = parseFloat(valor.replace(',', '.'))
      ;(parcial as Record<string, unknown>)[col.chave] = isNaN(n) ? null : n
    } else {
      ;(parcial as Record<string, unknown>)[col.chave] = valor
    }
  }

  const dados: ViabilidadeImportada = {
    resumo_executivo:           parcial.resumo_executivo           ?? obter('Resumo Executivo', 'Cenário Atual'),
    capex:                      parcial.capex                      ?? num('CAPEX (R$)', 'CAPEX'),
    opex:                       parcial.opex                       ?? num('OPEX (R$)', 'OPEX'),
    opex_periodicidade:         parcial.opex_periodicidade         ?? (obter('Periodicidade OPEX') || 'MENSAL'),
    economia_estimada:          parcial.economia_estimada          ?? num('Economia Estimada (R$)'),
    economia_periodicidade:     parcial.economia_periodicidade     ?? (obter('Periodicidade Economia') || 'MENSAL'),
    tipo_payback:               parcial.tipo_payback               ?? (obter('Tipo Payback') || (isQual ? 'QUALITATIVO' : 'QUANTITATIVO')),
    payback_informado:          parcial.payback_informado          ?? num('Payback Estimado (meses)'),
    payback_unidade:            'MESES',
    sistemas_envolvidos:        parcial.sistemas_envolvidos        ?? obter('Sistemas Envolvidos', 'Solução Proposta'),
    complexidade_tecnica:       parcial.complexidade_tecnica       ?? obter('Complexidade Técnica', 'Premissas'),
    dependencia_fornecedores:   parcial.dependencia_fornecedores   ?? obter('Dependência de Fornecedores', 'Restrições'),
    infraestrutura:             parcial.infraestrutura             ?? obter('Infraestrutura'),
    impacto_operacional:        parcial.impacto_operacional        ?? obter('Impacto Operacional', 'Impactos Operacionais'),
    mudanca_processo:           parcial.mudanca_processo           ?? obter('Mudança de Processo', 'Impactos Organizacionais'),
    recursos_necessarios:       parcial.recursos_necessarios       ?? obter('Recursos Necessários'),
    impactos:                   parcial.impactos                   ?? obter('Impactos', 'Problema / Oportunidade', 'Problema/Oportunidade'),
    beneficios_esperados:       parcial.beneficios_esperados       ?? obter('Benefícios Esperados'),
    riscos:                     parcial.riscos                     ?? obter('Riscos'),
    data_inicio_prev:           parcial.data_inicio_prev           ?? obter('Data Início Prevista'),
    data_fim_prev:              parcial.data_fim_prev              ?? obter('Data Término Prevista'),
    marcos:                     parcial.marcos                     ?? obter('Marcos Principais', 'Cronograma Macro'),
    recomendacao:               parcial.recomendacao               ?? obter('Recomendação', 'Parecer Final'),
    justificativa_recomendacao: parcial.justificativa_recomendacao ?? obter('Justificativa da Recomendação', 'Alinhamento Estratégico'),
    condicoes_aprovacao:        parcial.condicoes_aprovacao        ?? obter('Condições de Aprovação', 'Critérios de Sucesso'),
    tipo_indicador:             parcial.tipo_indicador             ?? obter('Indicadores Qualitativos'),
    baseline_valor:             null,
    meta_valor:                 null,
    economia_mensal_esperada:   null,
  }

  return montarResultado(dados, isQual)
}

// ── Validação ─────────────────────────────────────────────────────────────────

const OBRIGATORIOS_QUANT = ['resumo_executivo', 'impacto_operacional', 'riscos', 'recomendacao']
const OBRIGATORIOS_QUAL  = ['resumo_executivo', 'impacto_operacional', 'riscos', 'recomendacao']

function montarResultado(dados: ViabilidadeImportada, isQual: boolean): ResultadoImportacaoViabilidade {
  const obrigatorios = isQual ? OBRIGATORIOS_QUAL : OBRIGATORIOS_QUANT
  const camposFaltantes: string[] = []
  const avisos: string[] = []

  for (const chave of obrigatorios) {
    const val = dados[chave as keyof ViabilidadeImportada]
    if (!val && val !== 0) camposFaltantes.push(chave)
  }

  if (camposFaltantes.length > 0) {
    avisos.push(`${camposFaltantes.length} campo(s) obrigatório(s) não encontrado(s).`)
  }

  return { dados, camposFaltantes, avisos }
}
