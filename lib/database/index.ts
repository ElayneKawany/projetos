/**
 * Ponto único de acesso ao banco de dados.
 *
 * Todos os repositórios importam daqui — nunca de lib/db diretamente.
 *
 * ── Exports disponíveis ───────────────────────────────────────────────────────
 *
 * db       → SqliteClient (síncrono)
 *            Usado pelos repositories atuais. Não alterar sem migrar os consumers.
 *
 * asyncDb  → AsyncSqliteAdapter (assíncrono, envolve SqliteClient)
 *            Pronto para uso em novos repositories async.
 *            Na migração para PostgreSQL: trocar apenas o export abaixo.
 *
 * ── Guia de Migração para PostgreSQL ─────────────────────────────────────────
 *
 * PASSO 1 — Criar lib/database/postgres.ts:
 *   import { Pool } from 'pg'
 *   class PostgresClient implements AsyncDatabaseClient { ... }
 *   export const postgresClient = new PostgresClient()
 *
 * PASSO 2 — Trocar o export asyncDb aqui:
 *   - export { asyncSqliteClient as asyncDb } from './sqlite'   ← remover
 *   + export { postgresClient as asyncDb } from './postgres'    ← adicionar
 *
 * PASSO 3 — Migrar repositories gradualmente:
 *   Mudar de:  import { db } from '@/lib/database'             (síncrono)
 *   Para:      import { asyncDb } from '@/lib/database'        (assíncrono)
 *   Converter os métodos do repository para async/await.
 *
 * PASSO 4 — Quando todos os repositories estiverem migrados:
 *   Remover o export db (síncrono) e renomear asyncDb → db.
 *
 * Nenhuma alteração em Services, APIs ou regras de negócio é necessária
 * durante os passos 1–3.
 */

// ── Driver síncrono (SQLite atual) — NÃO alterar sem migrar os repositories ──
export { sqliteClient as db } from './sqlite'
export type { DatabaseClient, ExecuteResult } from './client'

// ── Driver assíncrono — pronto para PostgreSQL ───────────────────────────────
export { asyncSqliteClient as asyncDb } from './sqlite'
export type { AsyncDatabaseClient, AsyncExecuteResult } from './async-client'

// ── Drizzle ORM — query builder type-safe ────────────────────────────────────
// Novos repositories e migrações devem importar drizzleDb() daqui.
export { drizzleDb } from './drizzle'
