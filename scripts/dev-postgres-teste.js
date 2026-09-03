/**
 * Postgres de desenvolvimento local — Migração SQLite → PostgreSQL
 *
 * Sobe um PGlite (Postgres real, compilado para WASM, sem instalação no sistema)
 * atrás de um servidor com o protocolo de rede real do Postgres (pglite-socket),
 * pra que `pg.Pool`/drizzle-kit se conectem nele como se fosse um Postgres normal.
 *
 * Persistente em disco (data/pglite-dev/, já ignorado pelo git) — precisa estar
 * rodando sempre que `npm run dev` for usado, porque os repositórios já migrados
 * (ver PLANO_MIGRACAO_POSTGRESQL.md) exigem PG_DATABASE_URL definida, sem fallback
 * pro SQLite (decisão explícita: nenhum ambiente roda sem Postgres configurado).
 *
 * Uso: node scripts/dev-postgres-teste.js
 * Connection string (mesma de PG_DATABASE_URL no .env.local): postgresql://postgres:postgres@localhost:15432/postgres
 *
 * Só para desenvolvimento local desta migração — nunca aponta pra dados reais
 * de produção. Não faz parte do build de produção nem do pacote de deploy.
 */
'use strict'

const path = require('path')
const { PGlite } = require('@electric-sql/pglite')
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket')

const PORT = 15432
const DATA_DIR = path.join(__dirname, '..', 'data', 'pglite-dev')

async function main() {
  const db = new PGlite(DATA_DIR)
  const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 5 })
  await server.start()
  console.log(`Postgres de dev (PGlite, dados em ${DATA_DIR}) ouvindo em postgresql://postgres:postgres@localhost:${PORT}/postgres`)
  console.log('Ctrl+C para encerrar.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
