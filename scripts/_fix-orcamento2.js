const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

db.transaction(() => {
  // 4.1, 4.2, 4.3 → concluído no prazo: alinha data_conclusao = data_fim
  db.prepare(`
    UPDATE cronograma_tarefas
    SET data_conclusao = data_fim, prazo_status = 'NO_PRAZO'
    WHERE id IN (32, 33, 34)
  `).run()

  // 5.2, 5.3 → volta para PENDENTE (data_conclusao=NULL, percentual=0)
  db.prepare(`
    UPDATE cronograma_tarefas
    SET status = 'PENDENTE', data_conclusao = NULL, percentual = 0, prazo_status = NULL
    WHERE id IN (38, 39)
  `).run()
})()

const rows = db.prepare(`
  SELECT id, codigo, nome, data_fim, data_conclusao, prazo_status, status, percentual
  FROM cronograma_tarefas WHERE id IN (32,33,34,38,39) ORDER BY id
`).all()
rows.forEach(r => console.log(`[${r.codigo}] ${r.nome}: status=${r.status} concl=${r.data_conclusao} prazo=${r.prazo_status}`))
console.log('\n✓ Correção aplicada.')
db.close()
