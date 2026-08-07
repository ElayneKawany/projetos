// Corrige itens CONCLUIDA onde data_conclusao foi atribuída como datetime('now') no import
// mas o trabalho foi realizado no prazo: alinha data_conclusao = data_fim e prazo_status = NO_PRAZO
// IDs confirmados via inspeção: 10, 11, 12, 14, 23
const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

const ids = [10, 11, 12, 14, 23]

const upd = db.prepare(`
  UPDATE cronograma_tarefas
  SET data_conclusao = data_fim,
      prazo_status   = 'NO_PRAZO'
  WHERE id = ?
`)

db.transaction(() => {
  for (const id of ids) upd.run(id)
})()

// Confirma
const rows = db.prepare(`
  SELECT id, codigo, nome, data_fim, data_conclusao, prazo_status
  FROM cronograma_tarefas WHERE id IN (${ids.join(',')})
`).all()
rows.forEach(r => console.log(`[${r.codigo}] ${r.nome}: fim=${r.data_fim} concl=${r.data_conclusao} prazo=${r.prazo_status}`))
console.log(`\n✓ ${ids.length} registro(s) corrigido(s).`)
db.close()
