import getDb from '@/lib/db'
import type { DatabaseClient, DbParams, ExecuteResult } from './client'
import type { AsyncDatabaseClient, AsyncExecuteResult } from './async-client'

function spreadParams(params: DbParams): unknown[] | [Record<string, unknown>] {
  return Array.isArray(params) ? params : [params]
}

class SqliteClient implements DatabaseClient {
  queryOne<T = Record<string, unknown>>(sql: string, params: DbParams = []): T | undefined {
    const p = spreadParams(params)
    return getDb().prepare(sql).get(...(p as [])) as T | undefined
  }

  queryMany<T = Record<string, unknown>>(sql: string, params: DbParams = []): T[] {
    const p = spreadParams(params)
    return getDb().prepare(sql).all(...(p as [])) as T[]
  }

  execute(sql: string, params: DbParams = []): ExecuteResult {
    const p = spreadParams(params)
    const result = getDb().prepare(sql).run(...(p as []))
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
  }

  transaction<T>(fn: () => T): T {
    return getDb().transaction(fn)()
  }

  exec(sql: string): void {
    getDb().exec(sql)
  }
}

// Singleton — uma instância por processo, assim como getDb()
export const sqliteClient = new SqliteClient()

// ── Adapter assíncrono ────────────────────────────────────────────────────────
//
// AsyncSqliteAdapter envolve SqliteClient (síncrono) na interface AsyncDatabaseClient.
//
// Por que isso é seguro:
//   - better-sqlite3 é bloqueante — as operações completam antes do retorno
//   - Promise.resolve(valorSíncrono) apenas "empacota" o resultado na interface Promise
//   - Não há I/O assíncrono real — o event loop não cede entre as operações
//
// Para transaction():
//   - Usamos BEGIN/COMMIT/ROLLBACK manual para aceitar callbacks assíncronos
//   - É seguro porque: (a) SQLite é single-threaded; (b) Node.js é single-threaded;
//     (c) todas as operações dentro da transação completam sincronamente
//   - Restrição: não aninhar transações — o SQLite rejeitará "cannot start a transaction
//     within a transaction"
//
// Quando PostgresClient for criado (lib/database/postgres.ts), bastará:
//   1. Criar a classe PostgresClient implements AsyncDatabaseClient
//   2. Em lib/database/index.ts: trocar asyncSqliteClient por postgresClient no export asyncDb

class AsyncSqliteAdapter implements AsyncDatabaseClient {
  private readonly sync = sqliteClient

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: DbParams
  ): Promise<T | undefined> {
    return this.sync.queryOne<T>(sql, params)
  }

  async queryMany<T = Record<string, unknown>>(
    sql: string,
    params?: DbParams
  ): Promise<T[]> {
    return this.sync.queryMany<T>(sql, params)
  }

  async execute(sql: string, params?: DbParams): Promise<AsyncExecuteResult> {
    const r = this.sync.execute(sql, params)
    return {
      changes: r.changes,
      insertedId: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null,
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = getDb()
    db.exec('BEGIN')
    try {
      const result = await fn()
      db.exec('COMMIT')
      return result
    } catch (e) {
      try { db.exec('ROLLBACK') } catch { /* silencioso se já fez rollback */ }
      throw e
    }
  }

  async exec(sql: string): Promise<void> {
    this.sync.exec(sql)
  }
}

// Singleton do adapter assíncrono
export const asyncSqliteClient = new AsyncSqliteAdapter()
