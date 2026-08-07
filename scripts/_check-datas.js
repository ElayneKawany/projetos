const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

const rows = db.prepare(`
  SELECT id, codigo, nome, nivel, data_inicio, data_fim, status
  FROM cronograma_tarefas
  WHERE (ativo IS NULL OR ativo = 1)
    AND (data_inicio IS NULL OR data_inicio = '' OR data_fim IS NULL OR data_fim = '')
  ORDER BY codigo
`).all()

console.log(`Itens sem data: ${rows.length}`)
rows.forEach(r => console.log(`[${r.codigo}] ${r.nome} | inicio=${r.data_inicio} fim=${r.data_fim} status=${r.status}`))
db.close()
