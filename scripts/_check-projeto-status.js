const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

// Status dos projetos ativos
const projetos = db.prepare(`
  SELECT id, nome, status FROM projetos WHERE ativo = 1 ORDER BY id
`).all()
console.log('=== PROJETOS ===')
projetos.forEach(p => console.log(`[${p.id}] ${p.nome} → status=${p.status}`))

// Cronogramas por projeto
console.log('\n=== CRONOGRAMAS ===')
const crons = db.prepare(`
  SELECT c.projeto_id, c.id, c.status, c.versao
  FROM cronogramas c
  WHERE (c.ativo = 1 OR c.ativo IS NULL)
  ORDER BY c.projeto_id, c.versao DESC
`).all()
crons.forEach(c => console.log(`  projeto_id=${c.projeto_id} cron_id=${c.id} status=${c.status} versao=${c.versao}`))

// Histórico de status dos projetos
console.log('\n=== HISTÓRICO STATUS ===')
const hist = db.prepare(`
  SELECT projeto_id, status_de, status_para, created_at
  FROM projeto_status_historico
  ORDER BY projeto_id, created_at
`).all()
hist.forEach(h => console.log(`  [${h.projeto_id}] ${h.status_de} → ${h.status_para} em ${h.created_at}`))

db.close()
