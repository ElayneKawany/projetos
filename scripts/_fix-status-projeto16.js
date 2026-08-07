const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

db.transaction(() => {
  db.prepare(`UPDATE projetos SET status = 'EXECUCAO' WHERE id = 16`).run()
  db.prepare(`
    INSERT INTO projeto_status_historico (projeto_id, status_de, status_para, usuario_id, created_at)
    VALUES (16, 'VIABILIDADE', 'EXECUCAO', 1, datetime('now'))
  `).run()
})()

const p = db.prepare(`SELECT status FROM projetos WHERE id = 16`).get()
console.log(`Projeto 16 status: ${p.status}`)
console.log('✓ Status corrigido para EXECUCAO.')
db.close()
