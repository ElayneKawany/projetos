/**
 * Copia usuarios (+ perfis/diretorias/areas, exigidos pelas FKs de usuarios em
 * Postgres) do SQLite (`data/megag-pmo.db`) para o Postgres da fatia 4 da
 * migração (`lib/repositories/usuarios.ts`, tabela "AI"."TI_PMO_USUARIOS").
 *
 * Necessário rodar em QUALQUER ambiente antes de usar o código desta fatia —
 * sem isso, login e toda tela que lista/resolve nome de usuário ficam
 * quebrados (só enxergam os usuários que já estiverem em Postgres).
 *
 * Idempotente (ON CONFLICT DO UPDATE) — pode rodar de novo com segurança pra
 * ressincronizar depois de mudanças feitas via SQLite (antes desta fatia).
 *
 * Uso: PG_DATABASE_URL=... npx tsx scripts/migrar-usuarios-postgres.ts
 */
import Database from 'better-sqlite3'
import { Pool } from 'pg'

const sqlite = new Database('data/megag-pmo.db', { readonly: true })
const pool = new Pool({ connectionString: process.env.PG_DATABASE_URL })

async function upsert(table: string, cols: string[], rows: Record<string, unknown>[], idCol = 'id') {
  for (const r of rows) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',')
    const updates = cols.filter(c => c !== idCol).map(c => `${c} = EXCLUDED.${c}`).join(', ')
    await pool.query(
      `INSERT INTO "AI"."${table}" (${cols.join(',')}) OVERRIDING SYSTEM VALUE VALUES (${placeholders})
       ON CONFLICT (${idCol}) DO UPDATE SET ${updates}`,
      cols.map(c => r[c])
    )
  }
  console.log(`${table}: ${rows.length} linhas upsertadas`)
}

async function main() {
  if (!process.env.PG_DATABASE_URL) {
    throw new Error('PG_DATABASE_URL não definida.')
  }

  // 1. perfis (satisfaz FK fk_usuarios_perfil)
  const perfis = sqlite.prepare('SELECT * FROM perfis ORDER BY id').all() as Array<Record<string, unknown>>
  await upsert('TI_PMO_PERFIS', ['id', 'codigo', 'nome', 'descricao', 'permissoes', 'ativo', 'created_at'],
    perfis.map(p => ({ ...p, permissoes: p.permissoes ?? '{}', ativo: p.ativo === 1 })))

  // 2. diretorias (satisfaz FK fk_usuarios_diretoria) — diretor_responsavel_id fica NULL
  // pra todas nesta base (confirmado); se algum dia deixar de ser, isso precisa rodar
  // em duas passadas (diretorias sem diretor_responsavel_id, depois usuarios, depois
  // um UPDATE de diretor_responsavel_id) pra não violar a FK circular.
  const diretorias = sqlite.prepare('SELECT * FROM diretorias ORDER BY id').all() as Array<Record<string, unknown>>
  await upsert('TI_PMO_DIRETORIAS', ['id', 'codigo', 'nome', 'sigla', 'ativo', 'created_at', 'descricao', 'updated_at'],
    diretorias.map(d => ({ ...d, ativo: d.ativo === 1 })))

  // 3. areas (satisfaz FK fk_usuarios_area)
  const areas = sqlite.prepare('SELECT * FROM areas ORDER BY id').all() as Array<Record<string, unknown>>
  await upsert('TI_PMO_AREAS', ['id', 'diretoria_id', 'codigo', 'nome', 'sigla', 'ativo', 'created_at', 'descricao', 'updated_at'],
    areas.map(a => ({ ...a, ativo: a.ativo === 1 })))

  // 4. usuarios propriamente dito
  const usuarios = sqlite.prepare('SELECT * FROM usuarios ORDER BY id').all() as Array<Record<string, unknown>>
  await upsert('TI_PMO_USUARIOS',
    ['id', 'cpf', 'nome', 'email', 'senha_hash', 'cargo', 'diretoria_id', 'area_id', 'perfil_id', 'ativo', 'ultimo_login', 'created_at', 'updated_at'],
    usuarios.map(u => ({ ...u, ativo: u.ativo === 1 })))

  for (const [table, rows] of [['TI_PMO_PERFIS', perfis], ['TI_PMO_DIRETORIAS', diretorias], ['TI_PMO_AREAS', areas], ['TI_PMO_USUARIOS', usuarios]] as const) {
    const maxId = Math.max(...rows.map(r => r.id as number))
    await pool.query(`SELECT setval(pg_get_serial_sequence('"AI"."${table}"', 'id'), $1)`, [maxId])
  }

  const count = await pool.query('SELECT COUNT(*) AS c FROM "AI"."TI_PMO_USUARIOS"')
  console.log('Total de usuarios em Postgres agora:', count.rows[0].c)

  await pool.end()
  sqlite.close()
}

main().catch(e => { console.error(e); process.exit(1) })
