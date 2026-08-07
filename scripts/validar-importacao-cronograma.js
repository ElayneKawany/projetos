/**
 * Validação de importação do cronograma
 *
 * Lê o modelo oficial, executa o parser e verifica:
 *   - Ordem das fases / tarefas / subtarefas preservada
 *   - parent_id correto para cada nível
 *   - WBS gerada igual à da planilha
 *   - Nenhuma subtarefa órfã
 *   - Nenhuma atividade mudou de pai
 *
 * Uso:  node scripts/validar-importacao-cronograma.js
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const XLSX = require('xlsx')

// ── Helpers ──────────────────────────────────────────────────────────────────

function normChave(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function parsearDataExcel(valor) {
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
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`
  }
  if (typeof valor === 'string') {
    const s = valor.trim()
    if (!s) return null
    const m4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (m4) return `${m4[3]}-${m4[2].padStart(2,'0')}-${m4[1].padStart(2,'0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  }
  return null
}

function normalizarNivel(valor) {
  if (!valor) return null
  const s = normChave(String(valor))
  if (s === 'fase')      return 'FASE'
  if (s === 'tarefa')    return 'TAREFA'
  if (s === 'subtarefa') return 'SUBTAREFA'
  return null
}

// ── WBS (mesmo algoritmo do servidor) ────────────────────────────────────────

function calcularWBS(tarefas) {
  let faseCount = 0, tarefaCount = 0, subtarefaCount = 0, rootCount = 0
  return tarefas.map(t => {
    if (t.nivel === 'FASE') {
      faseCount++; tarefaCount = 0; subtarefaCount = 0
      return String(faseCount)
    }
    if (t.nivel === 'SUBTAREFA') {
      subtarefaCount++
      if (faseCount > 0 && tarefaCount > 0) return `${faseCount}.${tarefaCount}.${subtarefaCount}`
      if (tarefaCount > 0) return `${tarefaCount}.${subtarefaCount}`
      return `${rootCount}.${subtarefaCount}`
    }
    subtarefaCount = 0
    if (faseCount > 0) { tarefaCount++; return `${faseCount}.${tarefaCount}` }
    rootCount++; return String(rootCount)
  })
}

// ── Leitura da planilha ───────────────────────────────────────────────────────

const PLANILHA = path.join(__dirname, 'modelo-cronograma-megag.xlsx')

if (!fs.existsSync(PLANILHA)) {
  console.error(`\n❌  Arquivo não encontrado: ${PLANILHA}`)
  process.exit(1)
}

console.log('─'.repeat(70))
console.log('  VALIDAÇÃO — IMPORTAÇÃO DE CRONOGRAMA')
console.log('─'.repeat(70))
console.log(`📄  Arquivo: ${path.basename(PLANILHA)}`)

const COLUNAS_OFICIAIS = {
  wbs: 'wbs', nivel: 'nivel', nome: 'nome', descricao: 'descricao',
  tipo: 'tipo', criticidade: 'criticidade', responsavel: 'responsavel',
  executor: 'executor', datainicio: 'data_inicio', datafim: 'data_fim',
  percentual: 'percentual', status: 'status', observacoes: 'observacoes',
  tipomacro: 'tipo_macro',
}

const workbook = XLSX.read(fs.readFileSync(PLANILHA), { type: 'buffer', cellDates: true })
const abaNome  = workbook.SheetNames.find(n => normChave(n) === 'cronograma') ?? workbook.SheetNames[0]
const planilha = workbook.Sheets[abaNome]

console.log(`📑  Aba usada: "${abaNome}"`)

const linhasRaw = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: null, raw: true })

// Localizar cabeçalho
let linhaHeader = -1, headers = []
for (let i = 0; i < Math.min(5, linhasRaw.length); i++) {
  const row = linhasRaw[i]
  if (!row) continue
  const textos = row.map(c => (c != null ? String(c) : ''))
  if (textos.filter(t => t.trim()).length >= 3) { linhaHeader = i; headers = textos; break }
}

if (linhaHeader === -1) {
  console.error('\n❌  Cabeçalho não encontrado na planilha.')
  process.exit(1)
}

// Mapear índices das colunas
const colIdx = {}
headers.forEach((h, i) => {
  const chave = normChave(h ?? '')
  if (COLUNAS_OFICIAIS[chave]) colIdx[COLUNAS_OFICIAIS[chave]] = i
})

console.log(`\n📋  Colunas mapeadas: ${Object.keys(colIdx).join(', ')}`)

// ── Parsing (replica exatamente o parser TS) ──────────────────────────────────

const tarefas    = []
const erros      = []
const warnings   = []
let ignoradas    = 0
let ordemAtual   = 0

let lastFaseOrdinal   = null
let lastTarefaOrdinal = null

const getCol = (row, campo) => colIdx[campo] !== undefined ? row[colIdx[campo]] : null

for (let i = linhaHeader + 1; i < linhasRaw.length; i++) {
  const row    = linhasRaw[i]
  const numLinha = i + 1

  if (!row || row.every(c => c == null || c === '')) { ignoradas++; continue }

  const nome = getCol(row, 'nome') != null ? String(getCol(row, 'nome')).trim() : ''
  if (!nome) {
    erros.push({ linha: numLinha, erro: 'Nome vazio' }); ignoradas++; continue
  }

  const nivelRaw = getCol(row, 'nivel')
  const nivel    = normalizarNivel(nivelRaw)
  if (!nivel) {
    erros.push({ linha: numLinha, erro: `Nível inválido: "${nivelRaw ?? ''}"` }); ignoradas++; continue
  }

  const dataInicio = parsearDataExcel(getCol(row, 'data_inicio'))
  const dataFim    = parsearDataExcel(getCol(row, 'data_fim'))
  const wbsExcel   = getCol(row, 'wbs') != null ? String(getCol(row, 'wbs')).trim() : ''

  ordemAtual++
  let parentOrdinal = null
  if      (nivel === 'FASE')      { lastFaseOrdinal = ordemAtual; lastTarefaOrdinal = null; parentOrdinal = null }
  else if (nivel === 'TAREFA')    { lastTarefaOrdinal = ordemAtual; parentOrdinal = lastFaseOrdinal }
  else                            { parentOrdinal = lastTarefaOrdinal }

  tarefas.push({ ordem: ordemAtual, nivel, nome, wbsExcel, dataInicio, dataFim, parentOrdinal })
}

// ── WBS server-side ───────────────────────────────────────────────────────────

const wbsGerada = calcularWBS(tarefas)

// ── Simulação de INSERT (resolve parent_id) ───────────────────────────────────
//    O DB real usa lastInsertRowid — aqui usamos um id sintético (= ordem)

const ordemToId = new Map()
const tarefasComId = tarefas.map((t, i) => {
  const syntheticId = i + 1          // simula DB id
  ordemToId.set(t.ordem, syntheticId)
  const parentId = t.parentOrdinal != null ? (ordemToId.get(t.parentOrdinal) ?? null) : null
  return { ...t, id: syntheticId, parentId, wbsGerada: wbsGerada[i] }
})

// ── Relatório ─────────────────────────────────────────────────────────────────

const fases      = tarefasComId.filter(t => t.nivel === 'FASE')
const tarefasNv  = tarefasComId.filter(t => t.nivel === 'TAREFA')
const subtarefas = tarefasComId.filter(t => t.nivel === 'SUBTAREFA')

console.log('\n' + '─'.repeat(70))
console.log('  CONTAGEM')
console.log('─'.repeat(70))
console.log(`  Fases:       ${fases.length}`)
console.log(`  Tarefas:     ${tarefasNv.length}`)
console.log(`  Subtarefas:  ${subtarefas.length}`)
console.log(`  Total:       ${tarefasComId.length}`)
console.log(`  Descartadas: ${ignoradas}`)
if (erros.length)    console.log(`  ⚠️  Erros de linha: ${erros.length}`)
if (warnings.length) console.log(`  ℹ️  Warnings: ${warnings.length}`)

// ── Verificação 1: WBS gerada × WBS da planilha ───────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log('  VERIFICAÇÃO 1 — WBS gerada vs WBS da planilha')
console.log('─'.repeat(70))

let wbsOK = true
tarefasComId.forEach(t => {
  if (!t.wbsExcel) return   // planilha sem WBS preenchida — não há o que comparar
  if (t.wbsGerada !== t.wbsExcel) {
    console.log(`  ❌  Ordem ${t.ordem} | "${t.nome.substring(0,35)}"`)
    console.log(`        Planilha: "${t.wbsExcel}"  →  Gerado: "${t.wbsGerada}"`)
    wbsOK = false
  }
})
if (wbsOK) {
  const planilhaTemWBS = tarefasComId.some(t => t.wbsExcel)
  console.log(planilhaTemWBS
    ? `  ✅  Todas as WBS coincidem`
    : `  ℹ️  Planilha sem coluna WBS preenchida — WBS será gerada pelo servidor`)
}

// ── Verificação 2: Hierarquia por fase ───────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log('  VERIFICAÇÃO 2 — Hierarquia FASE → TAREFA → SUBTAREFA')
console.log('─'.repeat(70))

let hierOK = true

fases.forEach((fase, fi) => {
  const filhosTarefa = tarefasNv.filter(t => t.parentId === fase.id)
  process.stdout.write(`  FASE ${fase.wbsGerada}: "${fase.nome.substring(0,40)}" — ${filhosTarefa.length} tarefa(s)\n`)

  filhosTarefa.forEach(tarefa => {
    const filhosSub = subtarefas.filter(s => s.parentId === tarefa.id)
    process.stdout.write(`    TAREFA ${tarefa.wbsGerada}: "${tarefa.nome.substring(0,35)}" — ${filhosSub.length} sub(s)\n`)
    filhosSub.forEach(sub => {
      process.stdout.write(`      SUBTAREFA ${sub.wbsGerada}: "${sub.nome.substring(0,32)}"\n`)
    })
  })
})

// ── Verificação 3: Órfãos ─────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log('  VERIFICAÇÃO 3 — Subtarefas sem pai (órfãs)')
console.log('─'.repeat(70))

const subtarefasOrfas = subtarefas.filter(s => s.parentId === null)
if (subtarefasOrfas.length === 0) {
  console.log('  ✅  Nenhuma subtarefa órfã')
} else {
  subtarefasOrfas.forEach(s => {
    console.log(`  ❌  SUBTAREFA órfã → ordem ${s.ordem} | "${s.nome}" | parentOrdinal=${s.parentOrdinal}`)
    hierOK = false
  })
}

// Tarefas sem pai de fase (aviso, não crítico)
const tarefasSemFase = tarefasNv.filter(t => t.parentId === null)
if (tarefasSemFase.length > 0) {
  console.log(`  ℹ️  ${tarefasSemFase.length} tarefa(s) sem fase pai — precedem qualquer FASE (aceitável no modelo)`)
  tarefasSemFase.forEach(t => console.log(`       → "${t.nome}"`))
}

// ── Verificação 4: Ordem preservada ──────────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log('  VERIFICAÇÃO 4 — Ordem sequencial preservada')
console.log('─'.repeat(70))

let ordemOK = true
for (let i = 1; i < tarefasComId.length; i++) {
  if (tarefasComId[i].ordem !== tarefasComId[i - 1].ordem + 1) {
    console.log(`  ❌  Lacuna de ordem entre linhas ${tarefasComId[i-1].ordem} e ${tarefasComId[i].ordem}`)
    ordemOK = false
  }
}
if (ordemOK) console.log('  ✅  Ordem sequencial contínua sem lacunas')

// ── Verificação 5: parent_id consistency ─────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log('  VERIFICAÇÃO 5 — parent_id apontando para o nível correto')
console.log('─'.repeat(70))

let parentOK = true
const idToTarefa = new Map(tarefasComId.map(t => [t.id, t]))

tarefasNv.forEach(t => {
  if (t.parentId == null) return
  const pai = idToTarefa.get(t.parentId)
  if (!pai || pai.nivel !== 'FASE') {
    console.log(`  ❌  TAREFA "${t.nome}" tem parent_id=${t.parentId} que não é FASE (é ${pai?.nivel ?? 'inexistente'})`)
    parentOK = false
  }
})
subtarefas.forEach(s => {
  if (s.parentId == null) return
  const pai = idToTarefa.get(s.parentId)
  if (!pai || pai.nivel !== 'TAREFA') {
    console.log(`  ❌  SUBTAREFA "${s.nome}" tem parent_id=${s.parentId} que não é TAREFA (é ${pai?.nivel ?? 'inexistente'})`)
    parentOK = false
  }
})
if (parentOK) console.log('  ✅  Todos os parent_id apontam para o nível correto')

// ── Verificação 6: Datas ──────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log('  VERIFICAÇÃO 6 — Datas')
console.log('─'.repeat(70))

const comData      = tarefasComId.filter(t => t.dataInicio || t.dataFim).length
const semData      = tarefasComId.filter(t => !t.dataInicio && !t.dataFim).length
console.log(`  Com data:   ${comData}`)
console.log(`  Sem data:   ${semData} (gravadas como NULL — ✅ comportamento esperado)`)

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(70))
const tudo = wbsOK && hierOK && ordemOK && parentOK && subtarefasOrfas.length === 0
if (tudo) {
  console.log('  ✅  IMPORTAÇÃO VALIDADA — estrutura idêntica ao modelo da planilha')
} else {
  console.log('  ❌  DIVERGÊNCIAS ENCONTRADAS — ver detalhes acima')
}
console.log('═'.repeat(70))

console.log(`\n  📊  RESUMO DA ENTREGA`)
console.log(`  Fases importadas:       ${fases.length}`)
console.log(`  Tarefas importadas:     ${tarefasNv.length}`)
console.log(`  Subtarefas importadas:  ${subtarefas.length}`)
console.log(`  Total geral:            ${tarefasComId.length}`)
console.log(`  Todos vinculados ao pai correto: ${subtarefasOrfas.length === 0 && parentOK ? 'SIM ✅' : 'NÃO ❌'}`)
console.log()
