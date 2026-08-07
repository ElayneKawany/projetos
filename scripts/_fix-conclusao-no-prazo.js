// Fix: items com prazo_status=NO_PRAZO (ou nulo) mas data_conclusao > data_fim
// Alinha data_conclusao = data_fim para que calcStatusAuto mostre "Concluído"
const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, '../data/megag-pmo.db'))

// Mostra os afetados antes
const afetados = db.prepare(`
  SELECT id, nivel, nome, data_fim, data_conclusao, prazo_status
  FROM cronograma_tarefas
  WHERE data_conclusao IS NOT NULL
    AND data_fim IS NOT NULL
    AND date(data_conclusao) > date(data_fim)
    AND (prazo_status IS NULL OR prazo_status = 'NO_PRAZO')
    AND (ativo IS NULL OR ativo = 1)
`).all()

console.log(`Registros a corrigir: ${afetados.length}`)
afetados.forEach(r => console.log(`  [${r.nivel}] ${r.nome} | fim=${r.data_fim} concl=${r.data_conclusao} prazo=${r.prazo_status}`))

if (afetados.length === 0) {
  console.log('Nada a corrigir.')
  db.close()
  process.exit(0)
}

const upd = db.prepare(`
  UPDATE cronograma_tarefas
  SET data_conclusao = data_fim
  WHERE id = ?
`)

db.transaction(() => {
  for (const r of afetados) upd.run(r.id)
})()

console.log(`\n✓ ${afetados.length} registro(s) corrigido(s): data_conclusao alinhada com data_fim.`)
db.close()
