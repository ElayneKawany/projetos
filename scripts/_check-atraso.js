const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

const rows = db.prepare(`
  SELECT id, nivel, codigo, nome, data_fim, data_conclusao, prazo_status, status
  FROM cronograma_tarefas
  WHERE status = 'CONCLUIDA'
    AND (prazo_status = 'FORA_DO_PRAZO' OR (data_conclusao IS NOT NULL AND data_fim IS NOT NULL AND date(data_conclusao) > date(data_fim)))
    AND (ativo IS NULL OR ativo = 1)
  ORDER BY codigo
`).all()

console.log(`Total: ${rows.length}`)
rows.forEach(r => console.log(JSON.stringify(r)))
db.close()
