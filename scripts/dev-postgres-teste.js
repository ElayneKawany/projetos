/**
 * Servidor Postgres de teste local — Migração SQLite → PostgreSQL
 *
 * Sobe um PGlite (Postgres real, compilado para WASM, sem instalação no sistema)
 * atrás de um servidor com o protocolo de rede real do Postgres (pglite-socket),
 * pra que `pg.Pool`/drizzle-kit se conectem nele como se fosse um Postgres normal.
 *
 * Uso: node scripts/dev-postgres-teste.js
 * Connection string: postgresql://postgres:postgres@localhost:15432/postgres
 *
 * Só para testes locais desta migração (Fase 2 em diante) — nunca aponta pra
 * dados reais, os dados ficam em memória e somem quando o processo termina.
 * Não faz parte do build de produção nem do pacote de deploy.
 */
'use strict'

const { PGlite } = require('@electric-sql/pglite')
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket')

const PORT = 15432

async function main() {
  const db = new PGlite()
  const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 5 })
  await server.start()
  console.log(`Postgres de teste (PGlite) ouvindo em postgresql://postgres:postgres@localhost:${PORT}/postgres`)
  console.log('Ctrl+C para encerrar.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
