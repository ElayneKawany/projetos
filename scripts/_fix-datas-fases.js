const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

// Busca o cronograma_id das fases sem data
const fases = db.prepare(`
  SELECT id, codigo, nome
  FROM cronograma_tarefas
  WHERE (ativo IS NULL OR ativo = 1)
    AND nivel = 'FASE'
    AND (data_inicio IS NULL OR data_fim IS NULL)
`).all()

console.log(`Fases a corrigir: ${fases.length}`)

const updFase = db.prepare(`
  UPDATE cronograma_tarefas SET data_inicio = ?, data_fim = ? WHERE id = ?
`)

db.transaction(() => {
  for (const fase of fases) {
    // Pega min(data_inicio) e max(data_fim) das tarefas filhas
    const datas = db.prepare(`
      SELECT MIN(data_inicio) as di, MAX(data_fim) as df
      FROM cronograma_tarefas
      WHERE parent_id = ?
        AND (ativo IS NULL OR ativo = 1)
        AND data_inicio IS NOT NULL
        AND data_fim IS NOT NULL
    `).get(fase.id)

    if (datas && datas.di && datas.df) {
      updFase.run(datas.di, datas.df, fase.id)
      console.log(`[${fase.codigo}] ${fase.nome}: ${datas.di} → ${datas.df}`)
    } else {
      console.log(`[${fase.codigo}] ${fase.nome}: filhas sem data — pulado`)
    }
  }
})()

console.log('\n✓ Concluído.')
db.close()
