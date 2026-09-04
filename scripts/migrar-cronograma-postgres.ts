/**
 * Copia cronogramas/cronograma_tarefas/cronograma_responsaveis/
 * cronograma_tarefa_pagamento/cronograma_tarefa_parcelas/
 * cronograma_tarefa_parcelas_historico do SQLite (`data/megag-pmo.db`) para o
 * Postgres da fatia 5 da migração (`lib/repositories/cronograma.ts`, schema "AI").
 *
 * `cronogramas.projeto_id` tem FK pra "AI"."TI_PMO_PROJETOS" — como a fatia
 * `projetos` ainda não existe, este script também upserta ali (mesmo padrão já
 * usado por migrar-usuarios-postgres.ts pra perfis/diretorias/areas), mas só as
 * linhas de projeto realmente referenciadas pelos cronogramas migrados aqui —
 * não é escopo desta fatia popular a tabela toda.
 *
 * Necessário rodar em QUALQUER ambiente antes de usar o código desta fatia —
 * sem isso, toda tela de cronograma fica vazia (só enxerga o que já estiver em
 * Postgres). Pré-requisito: scripts/migrar-usuarios-postgres.ts já rodado
 * (satisfaz as FKs de usuarios usadas aqui: criado_por, responsavel_id, etc.).
 *
 * Introspecta as colunas reais do SQLite (PRAGMA table_info) e do Postgres
 * (information_schema) e usa a interseção — várias colunas destas tabelas
 * foram adicionadas via runMigrations() (ALTER TABLE), não estão em schema.sql.
 *
 * Idempotente (ON CONFLICT DO UPDATE) — pode rodar de novo com segurança.
 *
 * Uso: PG_DATABASE_URL=... npx tsx scripts/migrar-cronograma-postgres.ts
 */
import Database from 'better-sqlite3'
import { Pool } from 'pg'

const sqlite = new Database('data/megag-pmo.db', { readonly: true })
const pool = new Pool({ connectionString: process.env.PG_DATABASE_URL })

// Colunas INTEGER 0/1 (SQLite) que viram boolean nativo em Postgres — levantado
// em scripts/gen-schema-postgres.js (BOOLEAN_COLUMNS), não por nome parecido.
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  TI_PMO_PROJETOS: ['ativo'],
  TI_PMO_CRONOGRAMAS: ['is_baseline', 'ativo', 'arquivado'],
  TI_PMO_CRONOGRAMA_TAREFAS: ['bloqueio', 'ativo'],
  TI_PMO_CRONOGRAMA_RESPONSAVEIS: [],
  TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO: [],
  TI_PMO_CRONOGRAMA_TAREFA_PARCELAS: [],
  TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO: [],
}

// SQLite guarda datas como TEXT solto, sem validar — a base de dev tem alguns
// valores impossíveis (ex.: "2026-06-31", junho só tem 30 dias) que o Postgres
// rejeita de verdade. Não é bug de schema, é dado sujo pré-existente: clampa o
// dia pro último dia válido do mês em vez de falhar o backfill inteiro.
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(.*)$/
function sanitizeDate(v: string): string {
  const m = DATE_RE.exec(v)
  if (!m) return v
  const [, y, mo, d, rest] = m
  const year = Number(y), month = Number(mo), day = Number(d)
  const lastDay = new Date(year, month, 0).getDate()
  if (day <= lastDay) return v
  console.warn(`  aviso: data inválida "${v}" ajustada para dia ${lastDay}`)
  return `${y}-${mo}-${String(lastDay).padStart(2, '0')}${rest}`
}

function sqliteColumns(table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(c => c.name)
}

async function pgColumns(table: string): Promise<string[]> {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'AI' AND table_name = $1`,
    [table]
  )
  return res.rows.map(r => r.column_name as string)
}

/** Busca todas as linhas de `sqliteTable`, restrito às colunas que existem nos dois
 * bancos, converte as colunas boolean e upserta em `"AI".pgTable`. Retorna as linhas
 * upsertadas (só com as colunas usadas) pra permitir reset de sequence depois. */
async function migrarTabela(
  sqliteTable: string,
  pgTable: string,
  opts?: { where?: string; params?: unknown[] }
): Promise<Array<Record<string, unknown>>> {
  const colsSqlite = new Set(sqliteColumns(sqliteTable))
  const colsPg = await pgColumns(pgTable)
  const cols = colsPg.filter(c => colsSqlite.has(c))
  if (!cols.includes('id')) throw new Error(`${sqliteTable}: coluna id ausente na interseção`)

  const where = opts?.where ? ` WHERE ${opts.where}` : ''
  const rows = sqlite.prepare(
    `SELECT ${cols.join(',')} FROM ${sqliteTable}${where} ORDER BY id`
  ).all(...(opts?.params ?? [])) as Array<Record<string, unknown>>

  const boolCols = new Set(BOOLEAN_COLUMNS[pgTable] ?? [])
  const converted = rows.map(r => {
    const out: Record<string, unknown> = { ...r }
    for (const c of boolCols) if (c in out) out[c] = out[c] === 1
    for (const c of cols) if (typeof out[c] === 'string') out[c] = sanitizeDate(out[c] as string)
    return out
  })

  if (converted.length > 0) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',')
    const updates = cols.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ')
    for (const r of converted) {
      await pool.query(
        `INSERT INTO "AI"."${pgTable}" (${cols.join(',')}) OVERRIDING SYSTEM VALUE VALUES (${placeholders})
         ON CONFLICT (id) DO UPDATE SET ${updates}`,
        cols.map(c => r[c])
      )
    }
  }
  console.log(`${pgTable}: ${converted.length} linhas upsertadas`)
  return converted
}

async function resetSequence(pgTable: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return
  const maxId = Math.max(...rows.map(r => r.id as number))
  await pool.query(`SELECT setval(pg_get_serial_sequence('"AI"."${pgTable}"', 'id'), $1)`, [maxId])
}

async function main() {
  if (!process.env.PG_DATABASE_URL) {
    throw new Error('PG_DATABASE_URL não definida.')
  }

  // 0. Projetos referenciados por cronogramas — stub só pra satisfazer a FK
  // fk_cronogramas_projeto. Popular a tabela projetos de verdade é escopo de
  // uma fatia futura; aqui só o suficiente pra cronogramas funcionarem.
  const projetoIds = (sqlite.prepare('SELECT DISTINCT projeto_id AS id FROM cronogramas').all() as Array<{ id: number }>)
    .map(r => r.id)
  const projetos = projetoIds.length
    ? await migrarTabela('projetos', 'TI_PMO_PROJETOS', {
        where: `id IN (${projetoIds.map(() => '?').join(',')})`,
        params: projetoIds,
      })
    : []

  // 1-6. Tabelas da fatia, em ordem de dependência.
  const cronogramas = await migrarTabela('cronogramas', 'TI_PMO_CRONOGRAMAS')
  const tarefas = await migrarTabela('cronograma_tarefas', 'TI_PMO_CRONOGRAMA_TAREFAS')
  const responsaveis = await migrarTabela('cronograma_responsaveis', 'TI_PMO_CRONOGRAMA_RESPONSAVEIS')
  const pagamentos = await migrarTabela('cronograma_tarefa_pagamento', 'TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO')
  const parcelas = await migrarTabela('cronograma_tarefa_parcelas', 'TI_PMO_CRONOGRAMA_TAREFA_PARCELAS')
  const parcelasHistorico = await migrarTabela('cronograma_tarefa_parcelas_historico', 'TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO')

  // Sequences — só das tabelas desta fatia (projetos fica fora, não é dono da tabela).
  await resetSequence('TI_PMO_CRONOGRAMAS', cronogramas)
  await resetSequence('TI_PMO_CRONOGRAMA_TAREFAS', tarefas)
  await resetSequence('TI_PMO_CRONOGRAMA_RESPONSAVEIS', responsaveis)
  await resetSequence('TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO', pagamentos)
  await resetSequence('TI_PMO_CRONOGRAMA_TAREFA_PARCELAS', parcelas)
  await resetSequence('TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO', parcelasHistorico)

  console.log('Projetos-stub upsertados (satisfaz FK):', projetos.length)

  const count = await pool.query('SELECT COUNT(*) AS c FROM "AI"."TI_PMO_CRONOGRAMAS"')
  console.log('Total de cronogramas em Postgres agora:', count.rows[0].c)

  await pool.end()
  sqlite.close()
}

main().catch(e => { console.error(e); process.exit(1) })
