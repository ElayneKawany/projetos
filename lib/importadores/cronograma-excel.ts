/**
 * @file lib/importadores/cronograma-excel.ts
 *
 * Parser do modelo oficial MegaG para importação de cronograma.
 *
 * Aceita APENAS a planilha gerada pelo endpoint /api/projetos/[id]/cronograma/exportar
 * (ou o modelo em branco de /cronograma/modelo).
 *
 * Colunas oficiais (exatas, nenhum alias aceito):
 *   WBS | Nível | Nome | Descrição | Tipo | Criticidade | Responsável |
 *   Executor | Data Início | Data Fim | Percentual | Status | Observações
 *
 * Datas: aceita células Date nativas do Excel, serial numbers e texto DD/MM/AAAA.
 * Datas vazias: gravadas como NULL — campos opcionais.
 * Responsável / Executor: aceita qualquer nome — grava nome_ext; se houver
 * correspondência com usuário cadastrado, grava também o id.
 * Responsável vazio: gravado como NULL — não bloqueia a importação.
 *
 * Nível aceito (case-insensitive):
 *   FASE, TAREFA, SUBTAREFA, SUB-TAREFA, SUB TAREFA → normalizado para SUBTAREFA
 */

import * as XLSX from 'xlsx'
import { calcularDuracao } from '@/lib/utils/date'

/** @deprecated não obriga mais responsável cadastrado; mantido por compatibilidade com route.ts */
export const DEFAULT_RESPONSAVEL_IMPORTACAO: number | null = null

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface ParseOptions {
  defaultResponsavelId?: number | null
}

export interface UsuarioResumo {
  id: number
  nome: string
}

export interface TarefaParseada {
  nome: string
  descricao: string | null
  nivel: 'FASE' | 'TAREFA' | 'SUBTAREFA'
  tipo: string
  criticidade: string
  tipo_macro: string
  data_inicio: string | null
  data_fim: string | null
  /** Data real de conclusão (coluna "Data Conclusão" — opcional na planilha). */
  data_conclusao: string | null
  duracao_dias: number | null
  responsavel_id: number | null
  responsavel_nome_ext: string | null
  executor_id: number | null
  executor_nome_ext: string | null
  percentual: number
  status_tarefa: string
  /**
   * 'NO_PRAZO'     — CONCLUIDA com data_conclusao ≤ data_fim (ou sem data_conclusao).
   * 'FORA_DO_PRAZO'— CONCLUIDA com data_conclusao > data_fim.
   * null           — tarefa não concluída.
   */
  prazo_status: 'NO_PRAZO' | 'FORA_DO_PRAZO' | null
  observacoes: string | null
  ordem: number
  /**
   * Posição (1-based `ordem`) do item pai neste mesmo array de resultado.
   * TAREFA → ordem da FASE pai (null se sem fase).
   * SUBTAREFA → ordem da TAREFA pai.
   * FASE → null.
   * Usado pelo route.ts para resolver o parent_id após a inserção sequencial.
   */
  parentOrdinal: number | null
  /** Todos os nomes de responsáveis (pode ser mais de um separado por ; , /) */
  responsaveis_nomes: string[]
}

export interface ErroPorLinha {
  linha: number
  coluna: string
  erro: string
}

export interface ResultadoImportacao {
  tarefas: TarefaParseada[]
  linhasLidas: number
  importadas: number
  ignoradas: number
  /** @deprecated use importadas */ tarefasCriadas: number
  /** @deprecated use ignoradas  */ descartadas: number
  fasesCriadas: number
  subtarefasCriadas: number
  warnings: string[]
  erros: ErroPorLinha[]
  errosFatais: string[]
}

// ─── Inferência de tipo_macro pelo nome ───────────────────────────────────────

const VALID_TIPOS_MACRO = new Set([
  'INICIACAO', 'PLANEJAMENTO', 'ESTRUTURACAO', 'DESENVOLVIMENTO',
  'IMPLANTACAO', 'GO_LIVE', 'ENCERRAMENTO', 'OUTRO',
])

export function inferirTipoMacro(nome: string): string {
  if (/Inicia/i.test(nome))    return 'INICIACAO'
  if (/Planej/i.test(nome))    return 'PLANEJAMENTO'
  if (/Estrutur/i.test(nome))  return 'ESTRUTURACAO'
  if (/Desenvolv/i.test(nome)) return 'DESENVOLVIMENTO'
  if (/Implant/i.test(nome))   return 'IMPLANTACAO'
  if (/Go Live/i.test(nome))   return 'GO_LIVE'
  if (/Encerr/i.test(nome))    return 'ENCERRAMENTO'
  return 'OUTRO'
}

// ─── Colunas oficiais (normalizado → campo interno) ────────────────────────────

function normChave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const COLUNAS_OFICIAIS: Record<string, string> = {
  wbs:              'wbs',
  nivel:            'nivel',
  nome:             'nome',
  descricao:        'descricao',
  tipo:             'tipo',
  criticidade:      'criticidade',
  responsavel:      'responsavel',
  executor:         'executor',
  datainicio:       'data_inicio',
  datafim:          'data_fim',
  dataconclusao:    'data_conclusao',  // opcional — data real de conclusão
  percentual:       'percentual',
  status:           'status',
  observacoes:      'observacoes',
  tipomacro:        'tipo_macro',
}

// Apenas Nome e Nível são verdadeiramente obrigatórios como colunas.
// Responsável, Data Início e Data Fim são opcionais — aceitos como NULL.
const COLUNAS_OBRIGATORIAS = ['nome', 'nivel']

// ─── Parsing de datas ──────────────────────────────────────────────────────────

export function parsearDataExcel(valor: unknown): string | null {
  if (valor == null || valor === '') return null

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof valor === 'number' && valor > 0) {
    const serial = valor > 60 ? valor - 1 : valor
    const ms = Math.round((serial - 25569) * 86400000)
    const dt = new Date(ms)
    if (isNaN(dt.getTime())) return null
    const y  = dt.getUTCFullYear()
    const mo = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const d  = String(dt.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }

  if (typeof valor === 'string') {
    const s = valor.trim()
    if (!s) return null

    const m4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (m4) {
      const [, d, mo, y] = m4
      const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
      return new Date(iso + 'T12:00:00').toString() === 'Invalid Date' ? null : iso
    }

    const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
    if (m2) {
      const [, d, mo, yy] = m2
      const iso = `20${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
      return new Date(iso + 'T12:00:00').toString() === 'Invalid Date' ? null : iso
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(s + 'T12:00:00').toString() === 'Invalid Date' ? null : s
    }
  }

  return null
}

// ─── Normalização de nível ─────────────────────────────────────────────────────
//
// Aceita (case-insensitive, sem acentos):
//   "FASE"                          → 'FASE'
//   "TAREFA"                        → 'TAREFA'
//   "SUBTAREFA" | "SUB-TAREFA"      → 'SUBTAREFA'
//   "SUB TAREFA" | "subTarefa"      → 'SUBTAREFA'
//
// normChave() remove hífens, espaços e converte para minúsculas, então
// "sub-tarefa" → "subtarefa" e "sub tarefa" → "subtarefa".

function normalizarNivel(valor: unknown): 'FASE' | 'TAREFA' | 'SUBTAREFA' | null {
  if (!valor) return null
  const s = normChave(String(valor))
  if (s === 'fase')      return 'FASE'
  if (s === 'tarefa')    return 'TAREFA'
  if (s === 'subtarefa') return 'SUBTAREFA'
  return null
}

// ─── Normalização de outros campos ────────────────────────────────────────────

function normalizarTipo(valor: unknown): string {
  if (!valor) return 'TAREFA'
  const s = normChave(String(valor))
  const MAP: Record<string, string> = {
    tarefa:       'TAREFA',
    marco:        'MARCO',
    entrega:      'ENTREGA',
    reuniao:      'REUNIAO',
    homologacao:  'HOMOLOGACAO',
    implantacao:  'IMPLANTACAO',
    treinamento:  'TREINAMENTO',
    golive:       'GO_LIVE',
    outro:        'OUTRO',
  }
  return MAP[s] ?? 'TAREFA'
}

function normalizarCriticidade(valor: unknown): string {
  if (!valor) return 'NORMAL'
  const s = normChave(String(valor))
  if (s === 'critica' || s === 'critical') return 'CRITICA'
  if (s === 'alta' || s === 'high')        return 'ALTA'
  if (s === 'baixa' || s === 'low')        return 'BAIXA'
  return 'NORMAL'
}

/**
 * Calcula prazo_status de uma tarefa importada.
 *
 * Regras:
 *  - Tarefa não concluída → null
 *  - CONCLUIDA sem data_conclusao → 'NO_PRAZO' (conservador, compatibilidade)
 *  - CONCLUIDA com data_conclusao ≤ data_fim → 'NO_PRAZO'
 *  - CONCLUIDA com data_conclusao > data_fim → 'FORA_DO_PRAZO'
 */
function calcularPrazoStatusImportacao(
  statusTarefa: string,
  dataFim: string | null,
  dataConclusao: string | null,
): 'NO_PRAZO' | 'FORA_DO_PRAZO' | null {
  if (statusTarefa !== 'CONCLUIDA') return null
  if (!dataConclusao || !dataFim) return 'NO_PRAZO'
  return dataConclusao <= dataFim ? 'NO_PRAZO' : 'FORA_DO_PRAZO'
}

function normalizarStatus(valor: unknown): string {
  if (!valor) return 'PENDENTE'
  const s = normChave(String(valor))
  if (s === 'emandamento' || s === 'iniciada' || s === 'emexecucao') return 'EM_ANDAMENTO'
  if (s === 'concluida' || s === 'concluido' || s === 'finalizada')  return 'CONCLUIDA'
  return 'PENDENTE'
}

function normalizarPercentual(valor: unknown): number {
  if (valor == null || valor === '') return 0
  const n = Number(String(valor).replace('%', '').trim())
  if (isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ─── Resolução de usuário (por nome) ──────────────────────────────────────────

function resolverUsuario(nome: string | undefined | null, usuarios: UsuarioResumo[]): number | null {
  if (!nome || typeof nome !== 'string') return null
  const q = nome.trim().toLowerCase()
  if (!q) return null
  const exato = usuarios.find(u => u.nome.toLowerCase() === q)
  if (exato) return exato.id
  if (q.length >= 5) {
    const parcial = usuarios.find(
      u => u.nome.toLowerCase().includes(q) || q.includes(u.nome.toLowerCase())
    )
    if (parcial) return parcial.id
  }
  return null
}

// ─── Função principal ──────────────────────────────────────────────────────────

export function parsearExcelCronograma(
  buffer: ArrayBuffer,
  usuarios: UsuarioResumo[],
  _options?: ParseOptions
): ResultadoImportacao {
  const errosFatais: string[] = []

  // ── 1. Ler workbook ──────────────────────────────────────────────────────────
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    throw new Error('Arquivo inválido: não foi possível ler o Excel. Utilize o modelo oficial (.xlsx).')
  }

  // ── 2. Localizar aba CRONOGRAMA ──────────────────────────────────────────────
  const abaNome = workbook.SheetNames.find(n => normChave(n) === 'cronograma')
    ?? workbook.SheetNames[0]

  if (!abaNome) throw new Error('Arquivo Excel vazio — nenhuma aba encontrada.')

  const planilha = workbook.Sheets[abaNome]

  const linhasRaw: unknown[][] = XLSX.utils.sheet_to_json(planilha, {
    header: 1,
    defval: null,
    raw: true,
  })

  if (linhasRaw.length < 2) {
    throw new Error('Planilha sem dados — é necessário ao menos uma linha de cabeçalho e uma de dados.')
  }

  // ── 3. Localizar linha de cabeçalho ──────────────────────────────────────────
  let linhaHeader = -1
  let headers: string[] = []

  for (let i = 0; i < Math.min(5, linhasRaw.length); i++) {
    const row = linhasRaw[i]
    if (!row) continue
    const textos = row.map(c => (c != null ? String(c) : ''))
    if (textos.filter(t => t.trim()).length >= 3) {
      linhaHeader = i
      headers = textos
      break
    }
  }

  if (linhaHeader === -1) {
    throw new Error('Cabeçalho não encontrado. Utilize o modelo oficial baixado pelo sistema.')
  }

  // ── 4. Mapear colunas ────────────────────────────────────────────────────────
  const colIdx: Record<string, number> = {}
  for (let i = 0; i < headers.length; i++) {
    const chave = normChave(headers[i] ?? '')
    if (COLUNAS_OFICIAIS[chave]) {
      colIdx[COLUNAS_OFICIAIS[chave]] = i
    }
  }

  const faltando = COLUNAS_OBRIGATORIAS.filter(c => colIdx[c] === undefined)
  if (faltando.length > 0) {
    const NOMES: Record<string, string> = { nome: 'Nome', nivel: 'Nível' }
    throw new Error(
      `Colunas obrigatórias não encontradas: ${faltando.map(c => NOMES[c] ?? c).join(', ')}. ` +
      'Utilize o modelo oficial baixado pelo sistema.'
    )
  }

  // ── 5. Processar linhas de dados ─────────────────────────────────────────────
  const tarefas: TarefaParseada[] = []
  const erros: ErroPorLinha[] = []
  const warnings: string[] = []
  let ignoradas = 0
  let ordemAtual = 0

  // Rastreamento de hierarquia para resolução de parent_id no route.ts
  let lastFaseOrdinal: number | null    = null
  let lastTarefaOrdinal: number | null  = null

  for (let i = linhaHeader + 1; i < linhasRaw.length; i++) {
    const row = linhasRaw[i]
    const numLinha = i + 1

    // Linha completamente vazia → pular silenciosamente
    if (!row || row.every(c => c == null || c === '')) {
      ignoradas++
      continue
    }

    const getCol = (campo: string): unknown => {
      const idx = colIdx[campo]
      return idx !== undefined ? row[idx] : null
    }

    // ── Nome (obrigatório) ───────────────────────────────────────────────────
    const nome = getCol('nome') != null ? String(getCol('nome')).trim() : ''
    if (!nome) {
      erros.push({ linha: numLinha, coluna: 'Nome', erro: 'Nome é obrigatório.' })
      ignoradas++
      continue
    }

    // ── Nível (obrigatório; rejeita apenas valores verdadeiramente inválidos) ─
    const nivelRaw = getCol('nivel')
    const nivel = normalizarNivel(nivelRaw)
    if (!nivel) {
      erros.push({
        linha: numLinha,
        coluna: 'Nível',
        erro: `Valor inválido: "${nivelRaw ?? '(vazio)'}". Use FASE, TAREFA ou SUBTAREFA.`,
      })
      ignoradas++
      continue
    }

    // ── Responsável (opcional — NULL quando vazio; aceita múltiplos separados por ; , /) ──
    const respRaw = getCol('responsavel') != null ? String(getCol('responsavel')).trim() : ''
    // Split multiple names by common separators (;  ,  /  newline)
    const respNomes: string[] = respRaw
      ? respRaw.split(/[;,/\n]+/).map(s => s.trim()).filter(Boolean)
      : []
    // Primary responsável = first name
    const respNome = respNomes[0] ?? ''
    const responsavelId = respNome ? resolverUsuario(respNome, usuarios) : null
    if (respNome && !responsavelId) {
      warnings.push(`Linha ${numLinha}: Responsável "${respNome}" não cadastrado no sistema — gravado como texto livre.`)
    }
    // Warn for additional responsáveis not found
    for (let ri = 1; ri < respNomes.length; ri++) {
      if (!resolverUsuario(respNomes[ri], usuarios)) {
        warnings.push(`Linha ${numLinha}: Responsável adicional "${respNomes[ri]}" não cadastrado — gravado como texto livre.`)
      }
    }

    // ── Datas (opcionais — NULL quando vazio ou inválido) ────────────────────
    const dataInicio    = parsearDataExcel(getCol('data_inicio'))
    const dataFim       = parsearDataExcel(getCol('data_fim'))
    const dataConclusao = parsearDataExcel(getCol('data_conclusao'))

    // Avisa (não bloqueia) quando a data veio preenchida mas não foi reconhecida
    const rawInicio = getCol('data_inicio')
    if (rawInicio != null && rawInicio !== '' && !dataInicio) {
      warnings.push(`Linha ${numLinha}: Data Início "${rawInicio}" não reconhecida — gravado como NULL.`)
    }
    const rawFim = getCol('data_fim')
    if (rawFim != null && rawFim !== '' && !dataFim) {
      warnings.push(`Linha ${numLinha}: Data Fim "${rawFim}" não reconhecida — gravado como NULL.`)
    }
    const rawConclusao = getCol('data_conclusao')
    if (rawConclusao != null && rawConclusao !== '' && !dataConclusao) {
      warnings.push(`Linha ${numLinha}: Data Conclusão "${rawConclusao}" não reconhecida — gravado como NULL.`)
    }

    // ── Executor (opcional) ──────────────────────────────────────────────────
    const execNome  = getCol('executor') != null ? String(getCol('executor')).trim() : ''
    const executorId = execNome
      ? (resolverUsuario(execNome, usuarios) ?? null)
      : responsavelId
    if (execNome && !resolverUsuario(execNome, usuarios)) {
      warnings.push(`Linha ${numLinha}: Executor "${execNome}" não cadastrado no sistema — gravado como texto livre.`)
    }
    const executorNomeExt: string | null = execNome || null

    // ── Outros campos ────────────────────────────────────────────────────────
    const descricao    = getCol('descricao')   != null ? String(getCol('descricao')).trim()   || null : null
    const observacoes  = getCol('observacoes') != null ? String(getCol('observacoes')).trim() || null : null
    const percentual   = normalizarPercentual(getCol('percentual'))
    const statusTarefa = normalizarStatus(getCol('status'))
    const tipo         = normalizarTipo(getCol('tipo'))
    const criticidade  = normalizarCriticidade(getCol('criticidade'))
    const duracaoDias  = calcularDuracao(dataInicio, dataFim)

    // tipo_macro: só relevante para FASEs
    let tipoMacro = 'OUTRO'
    if (nivel === 'FASE') {
      const colVal = getCol('tipo_macro')
      const colStr = colVal != null ? String(colVal).trim().toUpperCase() : ''
      tipoMacro = (colStr && VALID_TIPOS_MACRO.has(colStr))
        ? colStr
        : inferirTipoMacro(nome)
    }

    // ── Hierarquia pai/filho ─────────────────────────────────────────────────
    ordemAtual++

    let parentOrdinal: number | null = null
    if (nivel === 'FASE') {
      lastFaseOrdinal   = ordemAtual
      lastTarefaOrdinal = null
      parentOrdinal     = null
    } else if (nivel === 'TAREFA') {
      lastTarefaOrdinal = ordemAtual
      parentOrdinal     = lastFaseOrdinal   // null se nenhuma fase precedente
    } else {
      // SUBTAREFA
      parentOrdinal     = lastTarefaOrdinal  // null se nenhuma tarefa precedente
    }

    tarefas.push({
      nome,
      descricao,
      nivel,
      tipo,
      criticidade,
      tipo_macro:           tipoMacro,
      data_inicio:          dataInicio,
      data_fim:             dataFim,
      data_conclusao:       dataConclusao,
      duracao_dias:         duracaoDias,
      responsavel_id:       responsavelId,
      responsavel_nome_ext: respNome || null,
      executor_id:          executorId,
      executor_nome_ext:    executorNomeExt,
      percentual:           statusTarefa === 'CONCLUIDA' ? 100 : percentual,
      status_tarefa:        statusTarefa,
      prazo_status:         calcularPrazoStatusImportacao(statusTarefa, dataFim, dataConclusao),
      observacoes,
      ordem:                ordemAtual,
      parentOrdinal,
      responsaveis_nomes:   respNomes,
    })
  }

  const fasesCriadas      = tarefas.filter(t => t.nivel === 'FASE').length
  const tarefasCriadas    = tarefas.filter(t => t.nivel === 'TAREFA').length
  const subtarefasCriadas = tarefas.filter(t => t.nivel === 'SUBTAREFA').length

  return {
    tarefas,
    linhasLidas:    linhasRaw.length - linhaHeader - 1,
    importadas:     tarefas.length,
    tarefasCriadas,
    fasesCriadas,
    subtarefasCriadas,
    ignoradas,
    descartadas:    ignoradas,
    warnings,
    erros,
    errosFatais,
  }
}
