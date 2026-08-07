'use strict'
const Database = require('better-sqlite3')
const db = new Database('./data/megag-pmo.db')

// Fix 1: Items NO_PRAZO whose data_conclusao was set to datetime('now') (after data_fim)
// For these, set data_conclusao = data_fim (they were completed on time per the import)
const fix1 = db.prepare(`
  UPDATE cronograma_tarefas
  SET data_conclusao = data_fim
  WHERE status = 'CONCLUIDA'
    AND prazo_status = 'NO_PRAZO'
    AND data_conclusao IS NOT NULL
    AND data_fim IS NOT NULL
    AND date(data_conclusao) > date(data_fim)
    AND (ativo IS NULL OR ativo = 1)
`).run()
console.log(`Fix 1: ${fix1.changes} NO_PRAZO records aligned (data_conclusao → data_fim)`)

// Fix 2: Items incorrectly marked FORA_DO_PRAZO but concluded before/on data_fim
const fix2 = db.prepare(`
  UPDATE cronograma_tarefas
  SET prazo_status = 'NO_PRAZO'
  WHERE status = 'CONCLUIDA'
    AND prazo_status = 'FORA_DO_PRAZO'
    AND data_conclusao IS NOT NULL
    AND data_fim IS NOT NULL
    AND date(data_conclusao) <= date(data_fim)
    AND (ativo IS NULL OR ativo = 1)
`).run()
console.log(`Fix 2: ${fix2.changes} FORA_DO_PRAZO records corrected → NO_PRAZO`)

// Verification
const check = db.prepare(`
  SELECT nivel, prazo_status,
    date(data_conclusao) as dc, date(data_fim) as df,
    (date(data_conclusao) > date(data_fim)) as late
  FROM cronograma_tarefas
  WHERE status = 'CONCLUIDA' AND data_conclusao IS NOT NULL AND data_fim IS NOT NULL AND (ativo IS NULL OR ativo = 1)
`).all()
const inconsistentes = check.filter(r => (r.prazo_status === 'FORA_DO_PRAZO') !== !!r.late)
console.log(`Inconsistências restantes: ${inconsistentes.length}`)
