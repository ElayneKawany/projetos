/**
 * MIGRAÇÃO DE PORTFÓLIO — PMO MegaG  v4.1
 *
 * Substitui completamente a base de projetos a partir de uma planilha Excel.
 * Preserva: usuários, perfis, diretorias, áreas, configurações, motivos de pausa.
 *
 * Execução (servidor PARADO):
 *   node scripts/import-portfolio.js "C:\caminho\para\planilha.xlsx"
 *   node scripts/import-portfolio.js          ← usa scripts/projetos-validacao.xlsx
 *
 * Após a migração: npm run dev
 */

'use strict'

const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')
const readline = require('readline')
const xl       = require('xlsx')

// ── Constantes ────────────────────────────────────────────────────────────────

const VERSAO_SCRIPT = '4.1'
const DB_PATH       = path.join(__dirname, '..', 'data', 'megag-pmo.db')
const LOGS_DIR      = path.join(__dirname, '..', 'logs')
const XLSX_PATH     = process.argv[2] || path.join(__dirname, 'projetos-validacao.xlsx')
const ARQUIVO_NOME  = path.basename(XLSX_PATH)

// Valores aceitos por campo — validação estrita
const ETAPAS_ACEITAS = new Set([
  'Proposta / Ideia',
  'Estudo de Viabilidade',
  'Em Execução',
  'Acompanhamento de Payback',
  'Pausado',
])
const PRIORIDADES_ACEITAS = new Set(['Alta', 'Média', 'Media', 'Baixa'])
const TIPO_GANHO_ACEITOS  = new Set([
  'QUALITATIVO', 'QUANTITATIVO',
  'Qualitativo', 'Quantitativo',
  'qualitativo', 'quantitativo',
])

// ── Timestamp para arquivos ───────────────────────────────────────────────────

const NOW_OBJ       = new Date()
const TS_YYYYMMDD   = NOW_OBJ.toISOString().slice(0, 10).replace(/-/g, '')
const TS_HHMMSS     = NOW_OBJ.toISOString().slice(11, 19).replace(/:/g, '')
const TS_SLUG       = `${TS_YYYYMMDD}_${TS_HHMMSS}`
const NOW_ISO       = NOW_OBJ.toISOString()
const NOW_DATE      = NOW_OBJ.toISOString().slice(0, 10)
const NOW_TIME      = NOW_OBJ.toISOString().slice(11, 19)

// ── Pré-condições ─────────────────────────────────────────────────────────────

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Banco não encontrado. Execute node scripts/seed.js primeiro.')
  process.exit(1)
}
if (!fs.existsSync(XLSX_PATH)) {
  console.error(`❌ Arquivo não encontrado: ${XLSX_PATH}`)
  process.exit(1)
}

// ── Backup automático ─────────────────────────────────────────────────────────

const bkpNome = `backup_${TS_SLUG}.db`
const bkpPath = path.join(path.dirname(DB_PATH), bkpNome)
fs.copyFileSync(DB_PATH, bkpPath)

// ── Diretório de logs ─────────────────────────────────────────────────────────

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
const LOG_BASE = path.join(LOGS_DIR, `migracao_projetos_${TS_SLUG}`)
const LOG_TXT  = LOG_BASE + '.log'
const LOG_JSON = LOG_BASE + '.json'

const logLines = []
function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}`
  logLines.push(linha)
  console.log(msg)
}

// ── Helpers globais ───────────────────────────────────────────────────────────

function normalize(s) {
  if (!s) return ''
  return String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s&]/g, '').trim()
}

function pad(v, w) { return String(v).padEnd(w) }

function excelDateToISO(serial) {
  // Serial numérico do Excel
  if (serial && typeof serial === 'number') {
    const d = new Date((serial - 25569) * 86400 * 1000)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  // String no formato DD/MM/AAAA
  if (serial && typeof serial === 'string') {
    const m = serial.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
  }
  return null
}

function isoDateValida(iso) {
  if (!iso) return false
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const [, a, mo, dia] = m.map(Number)
  const d = new Date(a, mo - 1, dia)
  return d.getFullYear() === a && d.getMonth() === mo - 1 && d.getDate() === dia
}

function mapStatus(etapa) {
  const e = String(etapa || '').trim()
  if (e === 'Acompanhamento de Payback') return 'PROJETO_CONCLUIDO'
  if (e === 'Em Execução')               return 'EXECUCAO'
  if (e === 'Estudo de Viabilidade')     return 'VIABILIDADE'
  if (e === 'Pausado')                   return 'PAUSADO'
  return 'TRIAGEM'
}

function mapPrioridade(p) {
  const k = normalize(p)
  if (k === 'alta')                      return 'ALTA'
  if (k === 'baixa')                     return 'BAIXA'
  if (k === 'media' || k === 'média')    return 'MEDIA'
  return null
}

function mapTipoBeneficio(t) {
  const k = normalize(t)
  if (k === 'quantitativo') return 'QUANTITATIVO'
  if (k === 'qualitativo')  return 'QUALITATIVO'
  return null
}

function normalizeEtapa(raw) {
  // Remove prefixo numérico do Excel: "1 - Proposta/Ideia" → "Proposta / Ideia"
  const stripped = String(raw || '').trim().replace(/^\d+\s*[-–]\s*/, '')
  const k = normalize(stripped)
  if (k.startsWith('proposta'))       return 'Proposta / Ideia'
  if (k.startsWith('estudo'))         return 'Estudo de Viabilidade'
  if (k.startsWith('em execu'))       return 'Em Execução'
  if (k.startsWith('acompanhamento')) return 'Acompanhamento de Payback'
  if (k.startsWith('pausado'))        return 'Pausado'
  return stripped
}

// ── Readline ──────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
function perguntar(msg) {
  return new Promise(resolve => rl.question(msg, ans => resolve(ans.trim())))
}

// ── Salvar logs ───────────────────────────────────────────────────────────────

function salvarLogs(relatorio) {
  try {
    fs.writeFileSync(LOG_TXT, logLines.join('\n') + '\n', 'utf8')
  } catch { /* não bloqueia */ }
  try {
    fs.writeFileSync(LOG_JSON, JSON.stringify(relatorio, null, 2), 'utf8')
  } catch { /* não bloqueia */ }
}

// ── Função principal ──────────────────────────────────────────────────────────

async function main() {

  // ════════════════════════════════════════════════════════════════════════
  // FASE 1 — LEITURA RÁPIDA DA PLANILHA (para exibir na confirmação)
  // ════════════════════════════════════════════════════════════════════════

  log(`\n📋 Lendo planilha: ${ARQUIVO_NOME}`)
  const wb   = xl.readFile(XLSX_PATH)
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = xl.utils.sheet_to_json(ws, { defval: '' })

  if (rows.length === 0) {
    console.error('\n❌ Planilha vazia — migração cancelada.')
    rl.close(); process.exit(1)
  }

  // ════════════════════════════════════════════════════════════════════════
  // FASE 2 — RELATÓRIO DA BASE ATUAL + TELA DE CONFIRMAÇÃO
  // ════════════════════════════════════════════════════════════════════════

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = OFF')

  function contar(t) {
    try { return (db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() || { c: 0 }).c } catch { return 0 }
  }

  const antes = {
    projetos:     contar('projetos'),
    taps:         contar('tap_versoes'),
    viabilidades: contar('viabilidade'),
    cronogramas:  contar('cronogramas'),
    contratos:    contar('financeiro_contratos'),
    pagamentos:   contar('financeiro_pagamentos'),
    snapshots:    contar('projeto_snapshot_final'),
    timeline:     contar('projeto_timeline'),
  }

  const L   = 64
  const sep = '═'.repeat(L)
  const sepM= '─'.repeat(L)

  console.log('\n╔' + sep + '╗')
  console.log('║' + pad('  MIGRAÇÃO DE PORTFÓLIO — PMO MegaG  v' + VERSAO_SCRIPT, L) + '║')
  console.log('╠' + sep + '╣')
  console.log('║' + pad(`  Banco de dados   : ${path.basename(DB_PATH)}`, L) + '║')
  console.log('║' + pad(`  Arquivo Excel    : ${ARQUIVO_NOME}`, L) + '║')
  console.log('║' + pad(`  Backup criado    : ${bkpNome}`, L) + '║')
  console.log('╠' + sep + '╣')
  console.log('║' + pad('  SITUAÇÃO ATUAL DO BANCO:', L) + '║')
  const labelsAntes = {
    projetos: 'Projetos existentes', taps: 'TAPs', viabilidades: 'Estudos Viab.',
    cronogramas: 'Cronogramas', contratos: 'Contratos', pagamentos: 'Pagamentos',
    snapshots: 'Snapshots', timeline: 'Eventos Timeline',
  }
  for (const [k, v] of Object.entries(antes)) {
    console.log('║  • ' + pad(labelsAntes[k] + ' : ' + v, L - 4) + '║')
  }
  console.log('╠' + sep + '╣')
  console.log('║' + pad(`  Projetos na planilha : ${rows.length} linhas`, L) + '║')
  console.log('╠' + sep + '╣')
  console.log('║  ⚠️  TODOS os dados acima serão EXCLUÍDOS.              ║')
  console.log('║  Usuários, configurações e dados mestres: MANTIDOS.    ║')
  console.log('║  Usuários não encontrados: campos ficarão NULOS (aviso).║')
  console.log('╚' + sep + '╝\n')

  // ════════════════════════════════════════════════════════════════════════
  // FASE 3 — CONFIRMAÇÃO (palavra exata: IMPORTAR)
  // ════════════════════════════════════════════════════════════════════════

  const confirma = await perguntar('Digite IMPORTAR para confirmar a migração: ')
  rl.close()
  if (confirma !== 'IMPORTAR') {
    console.log('\n⛔ Migração cancelada pelo usuário.\n')
    db.close()
    process.exit(0)
  }

  log('\n✓ Confirmação recebida — iniciando migração')

  // ════════════════════════════════════════════════════════════════════════
  // FASE 4 — CARREGAMENTO DE DADOS MESTRES DO BANCO
  // ════════════════════════════════════════════════════════════════════════

  log('\n📦 Carregando dados mestres...')

  const DIR_MAP  = {}  // normalize(nome) → id
  for (const d of db.prepare('SELECT id, nome FROM diretorias WHERE ativo=1').all()) {
    DIR_MAP[normalize(d.nome)] = d.id
  }

  const areaCache = {}
  for (const a of db.prepare('SELECT id, nome FROM areas WHERE ativo=1').all()) {
    areaCache[normalize(a.nome)] = a.id
  }

  const userByNome = {}  // normalize(nome) → id
  for (const u of db.prepare('SELECT id, nome FROM usuarios WHERE ativo=1').all()) {
    userByNome[normalize(u.nome)] = u.id
  }

  const INVALIDOS = new Set(['crm','comercial','financeiro','financeira','logistica','transportes','marketing','ti','rh','fiscal','projetos'])

  function resolveDir(nomeDir) {
    if (!nomeDir) return null
    const k = normalize(nomeDir)
    if (DIR_MAP[k]) return DIR_MAP[k]
    for (const [key, id] of Object.entries(DIR_MAP)) {
      if (k.includes(key) || key.includes(k)) return id
    }
    return null
  }

  // Lookup-only — NÃO cria usuários. Retorna null se não encontrado.
  function lookupUser(nome) {
    if (!nome) return null
    const nomeTrim = String(nome).trim()
    if (!nomeTrim || nomeTrim === '-' || /^-?\d+(\.\d+)?$/.test(nomeTrim)) return null
    const nomePrincipal = nomeTrim.split(',')[0].trim()
    const k = normalize(nomePrincipal)
    if (!k || INVALIDOS.has(k)) return null
    return userByNome[k] ?? null
  }

  function getOrCreateArea(nome, dirId) {
    if (!nome) return null
    const k = normalize(nome)
    if (areaCache[k] !== undefined) return areaCache[k]
    const base = 'AREA-' + nome.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,12)
    let codigo = base, s = 2
    while (db.prepare('SELECT id FROM areas WHERE codigo = ?').get(codigo)) { codigo = base + s++ }
    const sigla = nome.replace(/[aeiouáéíóúãõâêôàèìùç\s]/gi,'').toUpperCase().slice(0,5) || nome.slice(0,4).toUpperCase()
    const r = db.prepare('INSERT INTO areas (diretoria_id,codigo,nome,sigla) VALUES (?,?,?,?)').run(dirId || 1, codigo, nome.trim(), sigla)
    areaCache[k] = r.lastInsertRowid
    return r.lastInsertRowid
  }

  // ════════════════════════════════════════════════════════════════════════
  // FASE 5 — VALIDAÇÃO COMPLETA DA PLANILHA (PRÉ-INSERT)
  // Nenhum dado é gravado nesta fase.
  // Qualquer falha bloqueia toda a importação.
  // ════════════════════════════════════════════════════════════════════════

  log('\n🔍 Validando planilha (fase pré-import)...')

  const erros           = []
  const warnings        = []
  const nomesVistos     = new Set()
  const projetosValidos = []

  const responsaveisNaoEncontrados = []
  const pmosNaoEncontrados         = []
  const pontofocalNaoEncontrados   = []
  const diretoriasInvalidas        = []
  const camposPreenchidosAuto      = []

  for (let i = 0; i < rows.length; i++) {
    const r      = rows[i]
    const linha  = i + 2
    const errsLinha = []

    const nome      = String(r['PROJETO']              || r['Projeto']    || r['Nome']         || '').trim()
    const etapa     = normalizeEtapa(r['Etapa do Funil'] || r['Etapa'] || '')
    const diretoria = String(r['Diretoria']             || '').trim()
    const descricao = String(r['DESCRIÇÃO']             || r['Descrição']  || r['Descricao']    || '').trim()
    const objetivo  = String(r['OBJETIVO DO PROJETO']   || r['Objetivo']   || '').trim()
    const prioridade= String(r['Prioridade']            || '').trim()
    const tipoGanho = String(r['Tipo de Ganho ']        || r['Tipo de Ganho'] || r['Tipo Beneficio'] || '').trim()
    const responsav = String(r['Responsável ']          || r['Responsável']|| r['Responsavel']  || '').trim()
    const pmo       = String(r['PMO']                   || '').trim()
    const pontoFocal= String(r['Ponto focal']           || r['Ponto Focal']|| '').trim()
    const dataFimRaw= r['Data fim'] || r['Data Fim'] || r['Data Prevista']

    // ── 1. Nome ───────────────────────────────────────────────────────────
    if (!nome) {
      errsLinha.push('NOME: campo vazio')
    } else {
      const nk = nome.toLowerCase().trim()
      if (nomesVistos.has(nk)) {
        errsLinha.push(`NOME: duplicado na planilha — "${nome}"`)
      } else {
        nomesVistos.add(nk)
      }
    }

    // ── 2. Etapa do Funil ─────────────────────────────────────────────────
    if (!etapa) {
      errsLinha.push('ETAPA DO FUNIL: campo vazio')
    } else if (!ETAPAS_ACEITAS.has(etapa)) {
      errsLinha.push(`ETAPA DO FUNIL: valor inválido "${etapa}" — aceito: ${[...ETAPAS_ACEITAS].join(' | ')}`)
    }

    // ── 3. Diretoria — WARNING se não encontrada (INSERT usa fallback diretoria_id=1)
    if (!diretoria) {
      warnings.push(`Linha ${linha}: WARNING — Diretoria vazia → usará diretoria padrão`)
      if (nome) diretoriasInvalidas.push({ nome, linha, diretoria: '(vazio)' })
    } else {
      const dirId = resolveDir(diretoria)
      if (dirId === null) {
        warnings.push(`Linha ${linha}: WARNING — Diretoria "${diretoria}" não encontrada → usará diretoria padrão`)
        diretoriasInvalidas.push({ nome, linha, diretoria })
      }
    }

    // ── 4. Descrição ──────────────────────────────────────────────────────
    if (!descricao) errsLinha.push('DESCRIÇÃO: campo vazio')

    // ── 5. Prioridade — WARNING se vazio (padrão: MEDIA) ─────────────────
    if (!prioridade) {
      warnings.push(`Linha ${linha}: WARNING — Prioridade vazia → padrão MÉDIA`)
    } else if (!PRIORIDADES_ACEITAS.has(prioridade)) {
      warnings.push(`Linha ${linha}: WARNING — Prioridade inválida "${prioridade}" → padrão MÉDIA`)
    }

    // ── 6. Tipo de Ganho — WARNING se vazio ───────────────────────────────
    if (!tipoGanho) {
      warnings.push(`Linha ${linha}: WARNING — Tipo de Ganho vazio → ficará nulo`)
    } else if (!TIPO_GANHO_ACEITOS.has(tipoGanho)) {
      warnings.push(`Linha ${linha}: WARNING — Tipo de Ganho inválido "${tipoGanho}" → ficará nulo`)
    }

    // ── 7. Responsável — WARNING se não encontrado (não bloqueia) ─────────
    if (!responsav) {
      errsLinha.push('RESPONSÁVEL: campo vazio')
    } else if (lookupUser(responsav) === null) {
      warnings.push(`Linha ${linha}: WARNING — Responsável "${responsav}" não encontrado → campo ficará nulo`)
      responsaveisNaoEncontrados.push({ nome, linha, responsavel: responsav })
    }

    // ── 8. PMO — WARNING se não encontrado (não bloqueia) ─────────────────
    if (!pmo) {
      errsLinha.push('PMO: campo vazio')
    } else if (lookupUser(pmo) === null) {
      warnings.push(`Linha ${linha}: WARNING — PMO "${pmo}" não encontrado → campo ficará nulo`)
      pmosNaoEncontrados.push({ nome, linha, pmo })
    }

    // ── 9. Ponto Focal — WARNING se não encontrado (não bloqueia) ─────────
    if (pontoFocal && pontoFocal !== '-') {
      if (lookupUser(pontoFocal) === null) {
        warnings.push(`Linha ${linha}: WARNING — Ponto Focal "${pontoFocal}" não encontrado → campo ficará nulo`)
        pontofocalNaoEncontrados.push({ nome, linha, ponto_focal: pontoFocal })
      }
    }

    // ── 10. Data Final — WARNING se vazio ────────────────────────────────
    if (!dataFimRaw && dataFimRaw !== 0) {
      warnings.push(`Linha ${linha}: WARNING — Data Final vazia → ficará nula`)
    } else {
      const iso = excelDateToISO(dataFimRaw)
      if (!iso) {
        warnings.push(`Linha ${linha}: WARNING — Data Final "${dataFimRaw}" inválida → ficará nula`)
      } else if (!isoDateValida(iso)) {
        warnings.push(`Linha ${linha}: WARNING — Data Final impossível "${iso}" → ficará nula`)
      }
    }

    // ── 11. Objetivo vazio → auto-preenche ────────────────────────────────
    if (!objetivo && nome) {
      camposPreenchidosAuto.push({ nome, linha, campo: 'Objetivo', valor: 'A definir' })
    }

    if (errsLinha.length > 0) {
      erros.push({ linha, nome: nome || '(sem nome)', erros: errsLinha })
    } else {
      projetosValidos.push({ r, linha, nome })
    }
  }

  const linhasValidas   = projetosValidos.length
  const linhasInvalidas = erros.length

  log(`\n  Linhas lidas      : ${rows.length}`)
  log(`  Linhas válidas    : ${linhasValidas}`)
  log(`  Linhas inválidas  : ${linhasInvalidas}`)
  log(`  Warnings          : ${warnings.length}`)

  warnings.forEach(w => log(`  ${w}`))

  if (erros.length > 0) {
    log('\n' + sep)
    log('  ❌ VALIDAÇÃO FALHOU — MIGRAÇÃO CANCELADA')
    log(sep)
    log('  Nenhum projeto foi importado. Base inalterada.')
    log('\n  ERROS ENCONTRADOS:')
    for (const { linha, nome, erros: ee } of erros) {
      log(`\n  Linha ${linha}: "${nome}"`)
      ee.forEach(e => log(`    • ${e}`))
    }
    log('\n  Corrija os erros na planilha e execute novamente.')
    log(sep + '\n')
    log('  STATUS FINAL: ⛔ MIGRAÇÃO CANCELADA\n')
    salvarLogs({ status: 'CANCELADA', motivo: 'validacao_falhou', erros, warnings, arquivo: ARQUIVO_NOME, data: NOW_ISO })
    db.close()
    process.exit(1)
  }

  log('\n  ✓ Todas as validações aprovadas — prosseguindo com a importação\n')

  // ════════════════════════════════════════════════════════════════════════
  // FASE 6 — DELETE + INSERT EM UMA ÚNICA TRANSAÇÃO ATÔMICA
  //
  // DELETE e INSERT ocorrem dentro do mesmo BEGIN/COMMIT.
  // Qualquer falha (SQLite, constraint, etc.) reverte TUDO automaticamente —
  // inclusive os DELETEs. O backup é restaurado como camada extra de segurança.
  // Importação parcial é impossível por construção.
  // ════════════════════════════════════════════════════════════════════════

  const TABELAS_PROJETO = [
    'payback_competencias',
    'projeto_snapshot_final',
    'financeiro_pagamentos',
    'financeiro_contratos',
    'financeiro_movimentos',
    'orcamento_itens',
    'orcamento_grupos',
    'cronograma_tarefas',
    'cronogramas',
    'viabilidade',
    'tap_versoes',
    'projeto_historico_alteracoes',
    'projeto_status_historico',
    'projeto_prioridade_historico',
    'projeto_timeline',
    'workflow_etapas',
    'workflow_aprovacao',
    'comite_projetos',
    'documento_aprovacoes',
    'aprovacoes',
    'auditoria',
    'projetos',
  ]

  const ADMIN_ID = (() => {
    try {
      const row = db.prepare("SELECT u.id FROM usuarios u JOIN perfis p ON u.perfil_id=p.id WHERE p.codigo='ADMIN' LIMIT 1").get()
      return row ? row.id : 1
    } catch { return 1 }
  })()

  let motivoPausaDefaultId = null
  try {
    const mp = db.prepare('SELECT id FROM config_motivos_pausa WHERE ativo=1 ORDER BY ordem LIMIT 1').get()
    motivoPausaDefaultId = mp?.id ?? null
  } catch { /* ok */ }

  const ano = new Date().getFullYear()
  let codeSeq = 0
  function nextCode() { return `PRJ-${ano}-${String(++codeSeq).padStart(4,'0')}` }

  const timelineDesc = `Migrado em ${NOW_DATE} ${NOW_TIME} — Arquivo: ${ARQUIVO_NOME} — Script v${VERSAO_SCRIPT}`

  const stmtProj = db.prepare(`
    INSERT INTO projetos
      (codigo, nome, descricao, objetivo, status, prioridade, diretoria_id, area_id,
       gerente_id, solicitante_id, ponto_focal, data_fim_prev,
       pmo_responsavel_id, tipo_beneficio,
       projeto_migrado, migrado_em, migrado_por,
       origem_dados, arquivo_origem,
       motivo_pausa_id, data_pausa,
       created_by, created_at, updated_at)
    VALUES
      (@codigo, @nome, @descricao, @objetivo, @status, @prioridade, @diretoria_id, @area_id,
       @gerente_id, @solicitante_id, @ponto_focal, @data_fim_prev,
       @pmo_responsavel_id, @tipo_beneficio,
       1, @migrado_em, @migrado_por,
       'MIGRACAO_EXCEL', @arquivo_origem,
       @motivo_pausa_id, @data_pausa,
       @created_by, datetime('now'), datetime('now'))
  `)
  const stmtStatusH = db.prepare(`
    INSERT INTO projeto_status_historico
      (projeto_id, status_de, status_para, motivo, usuario_id, created_at)
    VALUES (?, 'PROPOSTA', ?, ?, ?, datetime('now'))
  `)
  const stmtTimeline = db.prepare(`
    INSERT INTO projeto_timeline
      (projeto_id, modulo, artefato, evento, origem, titulo, descricao, usuario_id, usuario_nome, created_at)
    VALUES (?, 'SISTEMA', 'PROJETO', 'IMPORTADO', 'IMPORTACAO', 'Projeto migrado', ?, ?, 'Sistema', datetime('now'))
  `)
  const stmtTimelinePausa = db.prepare(`
    INSERT INTO projeto_timeline
      (projeto_id, modulo, artefato, evento, origem, titulo, descricao, usuario_id, usuario_nome, created_at)
    VALUES (?, 'SISTEMA', 'PROJETO', 'SUSPENSO', 'IMPORTACAO', 'Projeto pausado', 'Projeto pausado na migração histórica', ?, 'Sistema', datetime('now'))
  `)
  const stmtTap = db.prepare(`
    INSERT INTO tap_versoes
      (projeto_id, versao, label, fase_origem, status, objetivo_detalhado, criado_por, created_at)
    VALUES (?, 1, 'TAP v1', 'TRIAGEM', ?, ?, ?, datetime('now'))
  `)
  const stmtViab = db.prepare(`
    INSERT INTO viabilidade
      (projeto_id, versao, status, resumo_executivo, criado_por, created_at, updated_at)
    VALUES (?, 1, ?, ?, ?, datetime('now'), datetime('now'))
  `)
  const stmtLastId = db.prepare('SELECT last_insert_rowid() AS id')

  const contadores = {
    total: 0, triagem: 0, viabilidade: 0, execucao: 0, concluido: 0, pausados: 0,
    semCronograma: 0, semResponsavel: 0, semPmo: 0, semPontoFocal: 0,
  }

  // Captura detalhada da linha que falhou durante o INSERT
  let falhaInsert = null  // { linha, nome, motivo, erro }
  let removidos   = 0

  // ── Função restaurarBackup ─────────────────────────────────────────────
  function restaurarBackup() {
    try {
      db.close()
    } catch { /* já fechado */ }
    try {
      fs.copyFileSync(bkpPath, DB_PATH)
      log(`   ♻️  Backup restaurado: ${bkpNome} → ${path.basename(DB_PATH)}`)
    } catch (erBkp) {
      log(`   ⚠️  Não foi possível restaurar o backup automaticamente: ${erBkp.message}`)
      log(`   Restaure manualmente: copie "${bkpPath}" para "${DB_PATH}"`)
    }
  }

  // ── Transação única: DELETE + INSERT ──────────────────────────────────
  const migrarTudo = db.transaction((lista) => {

    // PARTE A — limpeza (dentro da mesma transação)
    for (const t of TABELAS_PROJETO) {
      try {
        const res = db.prepare(`DELETE FROM ${t}`).run()
        if (res.changes > 0) removidos += res.changes
      } catch { /* tabela pode não existir ainda */ }
    }
    for (const t of TABELAS_PROJETO) {
      try { db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t) } catch {}
    }

    // PARTE B — inserção linha a linha com captura de erro individual
    for (const { r, linha, nome } of lista) {
      try {
        const etapa     = normalizeEtapa(r['Etapa do Funil'] || r['Etapa'] || '')
        const diretoria = String(r['Diretoria']         || '').trim()
        const area      = String(r['Área responsável '] || r['Área responsável'] || r['Area'] || '').trim()
        const responsav = String(r['Responsável ']      || r['Responsável']|| r['Responsavel'] || '').trim()
        const pontoFocal= String(r['Ponto focal']       || r['Ponto Focal']|| '').trim()
        const pmo       = String(r['PMO']               || '').trim()
        const descricao = String(r['DESCRIÇÃO']         || r['Descrição']  || r['Descricao']   || '').trim()
        const objetivo  = String(r['OBJETIVO DO PROJETO'] || r['Objetivo'] || '').trim()
        const prioridade= String(r['Prioridade']        || '').trim()
        const tipoGanho = String(r['Tipo de Ganho ']    || r['Tipo de Ganho'] || r['Tipo Beneficio'] || '').trim()
        const dataFimRaw= r['Data fim'] || r['Data Fim'] || r['Data Prevista']

        const status  = mapStatus(etapa)
        const dirId   = resolveDir(diretoria) || 1
        const areaId  = getOrCreateArea(area || 'Sem área', dirId)

        const pmoId   = lookupUser(pmo)
        const respId  = lookupUser(responsav)
        const pfId    = (pontoFocal && pontoFocal !== '-') ? lookupUser(pontoFocal) : null

        if (!respId) contadores.semResponsavel++
        if (!pmoId)  contadores.semPmo++
        if (pontoFocal && pontoFocal !== '-' && !pfId) contadores.semPontoFocal++

        const autorId    = pmoId || respId || ADMIN_ID
        const isPausado  = status === 'PAUSADO'
        const isExecucao = status === 'EXECUCAO'
        const isConcluido= status === 'PROJETO_CONCLUIDO'

        const pontoFocalVal = (pontoFocal && pontoFocal !== '-')
          ? (pfId ? pontoFocal : null)
          : null

        stmtProj.run({
          codigo:             nextCode(),
          nome,
          descricao,
          objetivo:           objetivo || 'A definir',
          status,
          prioridade:         mapPrioridade(prioridade) || 'MEDIA',
          diretoria_id:       dirId,
          area_id:            areaId,
          gerente_id:         respId || null,
          solicitante_id:     autorId,
          ponto_focal:        pontoFocalVal,
          data_fim_prev:      excelDateToISO(dataFimRaw),
          pmo_responsavel_id: pmoId || null,
          tipo_beneficio:     mapTipoBeneficio(tipoGanho),
          migrado_em:         NOW_ISO,
          migrado_por:        ADMIN_ID,
          arquivo_origem:     ARQUIVO_NOME,
          motivo_pausa_id:    isPausado ? motivoPausaDefaultId : null,
          data_pausa:         isPausado ? NOW_DATE : null,
          created_by:         autorId,
        })

        const projId = stmtLastId.get().id

        stmtStatusH.run(projId, status, `Migração histórica — ${ARQUIVO_NOME}`, autorId)
        stmtTimeline.run(projId, timelineDesc, ADMIN_ID)
        if (isPausado) stmtTimelinePausa.run(projId, ADMIN_ID)

        if (status === 'TRIAGEM' || isPausado) {
          stmtTap.run(projId, 'RASCUNHO', objetivo || null, autorId)
        }
        if (status === 'VIABILIDADE') {
          stmtTap.run(projId,  'APROVADO', objetivo || null, autorId)
          stmtViab.run(projId, 'RASCUNHO', objetivo || null, autorId)
        }
        if (isExecucao) {
          stmtTap.run(projId,  'APROVADO', objetivo || null, autorId)
          stmtViab.run(projId, 'APROVADO', objetivo || null, autorId)
          contadores.semCronograma++
        }
        if (isConcluido) {
          stmtTap.run(projId,  'APROVADO', objetivo || null, autorId)
          stmtViab.run(projId, 'APROVADO', objetivo || null, autorId)
        }

        contadores.total++
        if (status === 'TRIAGEM')          contadores.triagem++
        else if (status === 'VIABILIDADE') contadores.viabilidade++
        else if (isExecucao)               contadores.execucao++
        else if (isConcluido)              contadores.concluido++
        else if (isPausado)                contadores.pausados++

      } catch (eLinha) {
        // Captura o contexto exato da linha que falhou antes de relançar
        falhaInsert = {
          linha,
          nome,
          motivo: 'Falha ao inserir projeto no banco de dados',
          erro:   eLinha.message,
        }
        throw eLinha  // propaga para rollback de toda a transação (incluindo DELETEs)
      }
    }
  })

  log('⚙️  Executando migração (DELETE + INSERT em transação única)...')
  const inicio = Date.now()

  try {
    migrarTudo(projetosValidos)
  } catch (e) {
    // A transação foi revertida automaticamente (DELETE + INSERT — tudo desfeito).
    // O backup é restaurado como camada extra de segurança.
    restaurarBackup()

    log('\n' + sep)
    log('  ❌ MIGRAÇÃO CANCELADA — ROLLBACK EXECUTADO — BACKUP RESTAURADO')
    log(sep)
    if (falhaInsert) {
      log(`  Linha da planilha : ${falhaInsert.linha}`)
      log(`  Projeto           : "${falhaInsert.nome}"`)
      log(`  Motivo            : ${falhaInsert.motivo}`)
      log(`  Erro do banco     : ${falhaInsert.erro}`)
    } else {
      log(`  Erro              : ${e.message}`)
    }
    log(sep + '\n')
    log('  STATUS FINAL: ⛔ MIGRAÇÃO CANCELADA\n')
    salvarLogs({
      status: 'ROLLBACK',
      motivo: 'insert_falhou',
      falha:  falhaInsert ?? null,
      erro:   e.message,
      arquivo: ARQUIVO_NOME,
      data:    NOW_ISO,
    })
    process.exit(1)
  }

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1)
  log(`✓ ${removidos} registros removidos, ${contadores.total} projetos inseridos em ${duracao}s\n`)

  // ════════════════════════════════════════════════════════════════════════
  // FASE 8 — VERIFICAÇÃO DE QUANTIDADE (pós-transação)
  // ════════════════════════════════════════════════════════════════════════

  log('🔎 Verificando quantidade inserida...')

  const qtdNoDb = (db.prepare('SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1').get() || { c: 0 }).c
  if (qtdNoDb !== linhasValidas) {
    restaurarBackup()
    log('\n' + sep)
    log('  ❌ MIGRAÇÃO CANCELADA — QUANTIDADE DIVERGENTE — BACKUP RESTAURADO')
    log(sep)
    log(`  Esperado (planilha válida) : ${linhasValidas} projetos`)
    log(`  Encontrado no banco        : ${qtdNoDb} projetos`)
    log(`  Diferença                  : ${Math.abs(linhasValidas - qtdNoDb)} projeto(s) não inserido(s)`)
    log(sep + '\n')
    log('  STATUS FINAL: ⛔ MIGRAÇÃO CANCELADA\n')
    salvarLogs({ status: 'ROLLBACK', motivo: 'quantidade_divergente', esperado: linhasValidas, obtido: qtdNoDb, arquivo: ARQUIVO_NOME, data: NOW_ISO })
    process.exit(1)
  }
  log(`   ✓ Quantidade confirmada: ${qtdNoDb} projetos\n`)

  // ════════════════════════════════════════════════════════════════════════
  // FASE 9 — VALIDAÇÃO PÓS-IMPORTAÇÃO (integridade no banco)
  // ════════════════════════════════════════════════════════════════════════

  log('🔎 Validação pós-importação (integridade)...')

  const falhasPos = []
  const chk = (sql) => (db.prepare(sql).get() || { c: 0 }).c
  const lst = (sql) => db.prepare(sql).all().map(r => r.nome).slice(0, 5).join(', ')

  const semCodigo = chk("SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1 AND (codigo IS NULL OR codigo='')")
  if (semCodigo > 0)
    falhasPos.push(`${semCodigo} projeto(s) sem código`)

  const semNome = chk("SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1 AND (nome IS NULL OR nome='')")
  if (semNome > 0)
    falhasPos.push(`${semNome} projeto(s) sem nome`)

  const semDesc = chk("SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1 AND (descricao IS NULL OR descricao='')")
  if (semDesc > 0)
    falhasPos.push(`${semDesc} projeto(s) sem descrição: ${lst("SELECT nome FROM projetos WHERE projeto_migrado=1 AND (descricao IS NULL OR descricao='') LIMIT 5")}`)

  const semStatusV = chk("SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1 AND (status IS NULL OR status='')")
  if (semStatusV > 0)
    falhasPos.push(`${semStatusV} projeto(s) sem status`)

  const semDirV = chk('SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1 AND (diretoria_id IS NULL OR diretoria_id=0)')
  if (semDirV > 0)
    falhasPos.push(`${semDirV} projeto(s) sem diretoria`)

  const dups = db.prepare("SELECT nome, COUNT(*) as c FROM projetos WHERE projeto_migrado=1 GROUP BY LOWER(TRIM(nome)) HAVING c > 1").all()
  if (dups.length > 0)
    falhasPos.push(`Nomes duplicados: ${dups.map(d => `"${d.nome}" (${d.c}x)`).join(', ')}`)

  const semOrigem = chk("SELECT COUNT(*) as c FROM projetos WHERE projeto_migrado=1 AND (origem_dados IS NULL OR origem_dados='')")
  if (semOrigem > 0)
    falhasPos.push(`${semOrigem} projeto(s) sem origem_dados`)

  if (falhasPos.length > 0) {
    restaurarBackup()
    log('\n' + sep)
    log('  ❌ MIGRAÇÃO CANCELADA — INTEGRIDADE PÓS-INSERT FALHOU — BACKUP RESTAURADO')
    log(sep)
    falhasPos.forEach(f => log(`  • ${f}`))
    log(sep + '\n')
    log('  STATUS FINAL: ⛔ MIGRAÇÃO CANCELADA\n')
    salvarLogs({ status: 'ROLLBACK', motivo: 'validacao_pos_falhou', falhas: falhasPos, arquivo: ARQUIVO_NOME, data: NOW_ISO })
    process.exit(1)
  }

  log('   ✓ Integridade confirmada\n')

  // ════════════════════════════════════════════════════════════════════════
  // FASE 10 — AUDITORIA (config_global + tabela auditoria)
  // ════════════════════════════════════════════════════════════════════════

  const upsertConfig = db.prepare(`
    INSERT INTO config_global (chave, valor, descricao)
    VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, descricao=excluded.descricao
  `)

  try {
    db.transaction(() => {
      upsertConfig.run('ultima_migracao_data',           NOW_ISO,                  'Data/hora da última migração de portfólio')
      upsertConfig.run('ultima_migracao_usuario',        'Administrador PMO',      'Usuário que executou a última migração')
      upsertConfig.run('ultima_migracao_arquivo',        ARQUIVO_NOME,             'Arquivo Excel utilizado na última migração')
      upsertConfig.run('ultima_migracao_total_projetos', String(contadores.total), 'Total de projetos importados na última migração')
      upsertConfig.run('ultima_migracao_versao',         VERSAO_SCRIPT,            'Versão do script utilizado na última migração')
    })()
  } catch { /* config_global pode ter schema diferente */ }

  try {
    db.prepare(`
      INSERT INTO auditoria
        (usuario_id, usuario_nome, acao, entidade, descricao, dados_antes, dados_depois, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      ADMIN_ID,
      'Administrador PMO',
      'MIGRACAO',
      'projetos',
      `Migração histórica v${VERSAO_SCRIPT}: ${contadores.total} projetos importados de "${ARQUIVO_NOME}"`,
      JSON.stringify(antes),
      JSON.stringify({ ...contadores, arquivo: ARQUIVO_NOME, versao: VERSAO_SCRIPT, data: NOW_ISO }),
    )
  } catch { /* auditoria não bloqueia */ }

  db.close()

  // ════════════════════════════════════════════════════════════════════════
  // FASE 11 — RELATÓRIO FINAL + LOGS
  // ════════════════════════════════════════════════════════════════════════

  const duracaoTotal = ((Date.now() - (NOW_OBJ.getTime())) / 1000).toFixed(1)

  log('\n' + sep)
  log('  RELATÓRIO FINAL — MIGRAÇÃO PMO MegaG  v' + VERSAO_SCRIPT)
  log(sep)
  log(`  Arquivo utilizado               : ${ARQUIVO_NOME}`)
  log(`  Data / Hora                     : ${NOW_DATE} ${NOW_TIME}`)
  log(`  Backup criado                   : ${bkpNome}`)
  log(sepM)
  log(`  Total encontrado na planilha    : ${rows.length}`)
  log(`  Total importado                 : ${contadores.total}`)
  log(sepM)
  log('  DISTRIBUIÇÃO POR ETAPA:')
  log(`  • Proposta / Ideia (TAP)        : ${contadores.triagem}`)
  log(`  • Estudo de Viabilidade         : ${contadores.viabilidade}`)
  log(`  • Em Execução                   : ${contadores.execucao}`)
  log(`  • Proj. Concluído (ex-Payback)  : ${contadores.concluido}`)
  log(`  • Pausados                      : ${contadores.pausados}`)
  log(sepM)
  log(`  Projetos migrados (flag=1)      : ${contadores.total}`)
  log(`  Projetos sem cronograma         : ${contadores.semCronograma}`)
  log(sepM)
  log('  WARNINGS — CAMPOS NULOS (usuários não encontrados):')
  log(`  • Responsável não definido      : ${contadores.semResponsavel}`)
  if (responsaveisNaoEncontrados.length > 0)
    responsaveisNaoEncontrados.forEach(({ nome, responsavel, linha }) =>
      log(`      Linha ${linha}: "${responsavel}" → ${nome}`))
  log(`  • PMO não definido              : ${contadores.semPmo}`)
  if (pmosNaoEncontrados.length > 0)
    pmosNaoEncontrados.forEach(({ nome, pmo, linha }) =>
      log(`      Linha ${linha}: "${pmo}" → ${nome}`))
  log(`  • Ponto Focal não definido      : ${contadores.semPontoFocal}`)
  if (pontofocalNaoEncontrados.length > 0)
    pontofocalNaoEncontrados.forEach(({ nome, ponto_focal, linha }) =>
      log(`      Linha ${linha}: "${ponto_focal}" → ${nome}`))
  log(sepM)
  log(`  Log de texto salvo              : logs/migracao_projetos_${TS_SLUG}.log`)
  log(`  Log JSON salvo                  : logs/migracao_projetos_${TS_SLUG}.json`)
  log(`  Tempo total da migração         : ${duracaoTotal}s`)
  log(sep)
  log('\n  ✅ STATUS FINAL: MIGRAÇÃO CONCLUÍDA COM SUCESSO\n')
  log('  Próximo passo: npm run dev\n')

  const relatorio = {
    status: 'SUCESSO',
    versao_script: VERSAO_SCRIPT,
    data: NOW_ISO,
    arquivo: ARQUIVO_NOME,
    backup: bkpNome,
    linhas_planilha: rows.length,
    linhas_validas: linhasValidas,
    linhas_invalidas: linhasInvalidas,
    contadores,
    warnings,
    responsaveis_nao_encontrados: responsaveisNaoEncontrados,
    pmos_nao_encontrados: pmosNaoEncontrados,
    pontos_focais_nao_encontrados: pontofocalNaoEncontrados,
    campos_preenchidos_auto: camposPreenchidosAuto,
    duracao_segundos: parseFloat(duracaoTotal),
  }

  salvarLogs(relatorio)
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e.message)
  console.error('   STATUS FINAL: MIGRAÇÃO CANCELADA\n')
  process.exit(1)
})
