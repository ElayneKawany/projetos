'use strict'
const Database = require('better-sqlite3')
const db = new Database('./data/megag-pmo.db')

// Fix: set data_conclusao for CONCLUIDA subtarefas that have it NULL
const result = db.prepare(`
  UPDATE cronograma_tarefas
  SET data_conclusao = COALESCE(alterado_em, datetime('now'))
  WHERE nivel = 'SUBTAREFA'
    AND status = 'CONCLUIDA'
    AND data_conclusao IS NULL
    AND (ativo IS NULL OR ativo = 1)
`).run()

console.log(`Updated ${result.changes} subtarefa(s) with data_conclusao`)

// Verify
const remaining = db.prepare(`
  SELECT COUNT(*) as cnt FROM cronograma_tarefas
  WHERE nivel = 'SUBTAREFA' AND status = 'CONCLUIDA' AND data_conclusao IS NULL AND (ativo IS NULL OR ativo = 1)
`).get()
console.log(`Remaining CONCLUIDA subtarefas without data_conclusao: ${remaining.cnt}`)
