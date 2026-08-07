const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

// Verifica os itens pelo código/nome
const rows = db.prepare(`
  SELECT id, codigo, nome, data_fim, data_conclusao, prazo_status, status, percentual
  FROM cronograma_tarefas
  WHERE codigo IN ('4.1','4.2','4.3','5.2','5.3')
    AND (ativo IS NULL OR ativo = 1)
  ORDER BY codigo
`).all()
rows.forEach(r => console.log(JSON.stringify(r)))
db.close()
