/**
 * IMPORTAÇÃO DE PORTFÓLIO – PMO MegaG
 *
 * Importa os projetos do arquivo portfolio-data.json para o banco SQLite.
 *
 * Execução:
 *   node scripts/import-portfolio.js
 *
 * ⚠️  Pare o servidor (Ctrl+C) antes de executar.
 *      Após a importação, reinicie com: npm run dev
 */

const Database = require('better-sqlite3')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')
const path     = require('path')
const fs       = require('fs')

const DB_PATH   = path.join(__dirname, '..', 'data', 'megag-pmo.db')
const DATA_PATH = path.join(__dirname, 'portfolio-data.json')

if (!fs.existsSync(DB_PATH))   { console.error('❌ Banco não encontrado. Execute node scripts/seed.js primeiro.'); process.exit(1) }
if (!fs.existsSync(DATA_PATH)) { console.error('❌ portfolio-data.json não encontrado em scripts/'); process.exit(1) }

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const projects = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
console.log(`📋 ${projects.length} projetos encontrados no portfolio-data.json`)

// ── Helpers ───────────────────────────────────────────────────
/** Remove acentos e normaliza string para comparação */
function normalize(s) {
  if (!s) return ''
  return String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ── Diretorias mapping ────────────────────────────────────────
const DIR_MAP = {}
for (const d of db.prepare('SELECT id, nome, sigla FROM diretorias').all()) {
  DIR_MAP[normalize(d.nome)] = d.id
  DIR_MAP[normalize(d.sigla)] = d.id
}

function getDirId(nome) {
  if (!nome) return 2
  const k = normalize(nome)
  if (DIR_MAP[k]) return DIR_MAP[k]
  if (k.includes('log'))    return DIR_MAP['diretoria de operacoes'] || DIR_MAP['do'] || 1
  if (k.includes('comerc')) return DIR_MAP['diretoria comercial']    || DIR_MAP['dc'] || 2
  if (k.includes('financ')) return DIR_MAP['diretoria financeira']   || DIR_MAP['df'] || 3
  if (k.includes('rh') || k.includes('pessoas')) return DIR_MAP['diretoria de pessoas'] || DIR_MAP['drh'] || 5
  if (k.includes('ti') || k.includes('tecnolog')) return DIR_MAP['diretoria de tecnologia'] || DIR_MAP['dti'] || 4
  return 2
}

// Garantir mapeamento de "Logística" para diretoria de operações
const logDir = db.prepare("SELECT id FROM diretorias WHERE lower(nome) LIKE '%opera%' OR lower(sigla)='do'").get()
if (logDir) { DIR_MAP['logistica'] = logDir.id; DIR_MAP['logística'] = logDir.id }

// ── Áreas: get or create ──────────────────────────────────────
const AREA_DIR_HINTS = {
  'm&a':1, 'transportes':1, 'excelencia logistica':1,
  'vendas':2, 'marketing':2, 'crm':2, 'inovacao':2, 'comunicacao':2,
  'relacionamento':2, 'novos negocios':2, 'comercial':2,
  'financeiro':3, 'controladoria':3, 'contabilidade':3, 'fiscal':3,
  'rh':5, 'ti':4, 'projetos':3, 'compras':1,
}

const areaCache = {}

function getOrCreateArea(nome, dirId) {
  if (!nome) return null
  const key = normalize(nome)
  if (areaCache[key] !== undefined) return areaCache[key]

  const existing = db.prepare("SELECT id FROM areas WHERE lower(replace(replace(nome,'ã','a'),'é','e')) = ?").get(key)
    || db.prepare("SELECT id FROM areas WHERE lower(nome) LIKE ?").get('%' + key.slice(0,6) + '%')
  if (existing) { areaCache[key] = existing.id; return existing.id }

  const hintDirId = AREA_DIR_HINTS[key] || dirId || 1
  // Código único: base + contador se necessário
  const baseCode = 'AREA-' + nome.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,12)
  let codigo = baseCode
  let suffix = 2
  while (db.prepare('SELECT id FROM areas WHERE codigo = ?').get(codigo)) {
    codigo = baseCode + suffix++
  }
  const sigla = nome.replace(/[aeiouáéíóúãõâêôàèìùç\s]/gi,'').toUpperCase().slice(0,5) || nome.slice(0,4).toUpperCase()

  const r = db.prepare('INSERT INTO areas (diretoria_id,codigo,nome,sigla) VALUES (?,?,?,?)').run(hintDirId, codigo, nome.trim(), sigla)
  areaCache[key] = r.lastInsertRowid
  console.log(`  ✚ Área criada: ${nome} (id=${r.lastInsertRowid})`)
  return r.lastInsertRowid
}

// ── Usuários: get or create ───────────────────────────────────
const userCache = {}     // normalized-name → id
const emailCache = new Set()  // emails already used

// Pré-popular cache com usuários existentes
for (const u of db.prepare('SELECT id, nome, email FROM usuarios').all()) {
  userCache[normalize(u.nome)] = u.id
  emailCache.add(u.email.toLowerCase())
}

const senhaHash = bcrypt.hashSync('Megag@2026', 8)

function getOrCreateUser(nome, perfilCodigo = 'GESTOR', dirId = null) {
  if (!nome || nome.trim() === '-') return null
  const key = normalize(nome)
  if (userCache[key] !== undefined) return userCache[key]

  // Busca no DB (por nome normalizado) antes de criar
  const rows = db.prepare('SELECT id, nome FROM usuarios').all()
  for (const r of rows) {
    if (normalize(r.nome) === key) {
      userCache[key] = r.id
      return r.id
    }
  }

  const perfil = db.prepare('SELECT id FROM perfis WHERE codigo = ?').get(perfilCodigo)
  const perfilId = perfil ? perfil.id : 4

  // CPF: MD5 hash → 11 dígitos, garantir unicidade
  let fakeCpf = crypto.createHash('md5').update(key).digest('hex').replace(/[a-f]/g,'1').slice(0,11)
  let cpfSuffix = 0
  while (db.prepare('SELECT id FROM usuarios WHERE cpf = ?').get(fakeCpf)) {
    fakeCpf = crypto.createHash('md5').update(key + cpfSuffix++).digest('hex').replace(/[a-f]/g,'1').slice(0,11)
  }

  // Email: normalizado, garantir unicidade
  const baseEmail = key.replace(/\s+/g,'.').replace(/[^a-z.]/g,'') + '@megag.com.br'
  let email = baseEmail
  let emailSuffix = 2
  while (emailCache.has(email)) {
    email = baseEmail.replace('@', emailSuffix++ + '@')
  }
  emailCache.add(email)

  const r = db.prepare(`
    INSERT INTO usuarios (cpf,nome,email,cargo,senha_hash,perfil_id,diretoria_id,ativo)
    VALUES (?,?,?,?,?,?,?,1)
  `).run(fakeCpf, nome.trim(), email, perfilCodigo, senhaHash, perfilId, dirId)

  userCache[key] = r.lastInsertRowid
  return r.lastInsertRowid
}

// Pré-criar PMOs
for (const n of ['Lucas Cataldi','Elayne Kawany','Fabio Brito','Gisele Silva']) {
  getOrCreateUser(n, 'PMO', 1)
}
console.log('✓ PMOs mapeados')

// ── Próximo código de projeto ─────────────────────────────────
const lastProj = db.prepare("SELECT codigo FROM projetos ORDER BY id DESC LIMIT 1").get()
let codeCounter = lastProj ? parseInt(lastProj.codigo.split('-').pop()) : 0
function nextCode() { return `PRJ-2026-${String(++codeCounter).padStart(4,'0')}` }

// ── Statements preparados ─────────────────────────────────────
const stmtInsertProj = db.prepare(`
  INSERT INTO projetos
    (codigo,nome,descricao,objetivo,status,prioridade,complexidade,
     diretoria_id,area_id,gerente_id,solicitante_id,
     data_fim_prev,created_by,created_at,updated_at)
  VALUES
    (@codigo,@nome,@descricao,@objetivo,@status,@prioridade,@complexidade,
     @diretoria_id,@area_id,@gerente_id,@solicitante_id,
     @data_fim_prev,@created_by,datetime('now'),datetime('now'))
`)

const stmtLastId  = db.prepare('SELECT last_insert_rowid() AS id')

const stmtStatusH = db.prepare(`
  INSERT INTO projeto_status_historico
    (projeto_id,status_de,status_para,motivo,usuario_id,created_at)
  VALUES (?,?,?,'Importado do Portfolio de projetos.xlsx',?,datetime('now'))
`)

const stmtPriorH  = db.prepare(`
  INSERT INTO projeto_prioridade_historico
    (projeto_id,prioridade_de,prioridade_para,motivo,usuario_id,created_at)
  VALUES (?,?,?,'Importado do Portfolio de projetos.xlsx',?,datetime('now'))
`)

// ── Importação em transação ───────────────────────────────────
let importedCount = 0
let skippedCount  = 0

const importAll = db.transaction((list) => {
  for (const p of list) {
    if (db.prepare('SELECT id FROM projetos WHERE lower(nome)=?').get(normalize(p.nome))) {
      skippedCount++
      continue
    }

    const dirId    = getDirId(p.diretoria)
    const areaId   = getOrCreateArea(p.area, dirId)
    const pmoId    = p.pmo         ? getOrCreateUser(p.pmo,         'PMO',    dirId) : null
    const respId   = p.responsavel ? getOrCreateUser(p.responsavel, 'GESTOR', dirId) : null
    const autorId  = pmoId || 1

    stmtInsertProj.run({
      codigo:        nextCode(),
      nome:          p.nome,
      descricao:     p.descricao  || null,
      objetivo:      p.objetivo   || 'A definir',
      status:        p.status,
      prioridade:    p.prioridade,
      complexidade:  p.complexidade,
      diretoria_id:  dirId,
      area_id:       areaId,
      gerente_id:    respId || pmoId || 1,
      solicitante_id: autorId,
      data_fim_prev: p.data_fim   || null,
      created_by:    autorId,
    })

    const projId = stmtLastId.get().id
    stmtStatusH.run(projId, p.status === 'PROPOSTA' ? 'PROPOSTA' : 'PROPOSTA', p.status, autorId)
    stmtPriorH.run(projId,  p.prioridade === 'MEDIA' ? 'MEDIA' : 'MEDIA',      p.prioridade, autorId)

    importedCount++
  }
})

console.log('\n📥 Importando projetos...')
importAll(projects)

// ── Auditoria ─────────────────────────────────────────────────
db.prepare(`
  INSERT INTO auditoria
    (usuario_id,usuario_nome,acao,entidade,descricao,dados_antes,dados_depois,created_at)
  VALUES (1,'Administrador','CREATE','projetos',?,'{}',?,datetime('now'))
`).run(
  `Importação em massa: ${importedCount} projetos do Portfolio de projetos.xlsx`,
  JSON.stringify({ total: importedCount })
)

console.log('\n' + '═'.repeat(50))
console.log(`✅  Importação concluída!`)
console.log(`   Importados : ${importedCount} projetos`)
console.log(`   Ignorados  : ${skippedCount} (já existiam no banco)`)
console.log('═'.repeat(50))
console.log('\nReinicie o servidor: npm run dev')
