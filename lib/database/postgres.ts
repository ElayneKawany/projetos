/**
 * Cliente PostgreSQL — implementa AsyncDatabaseClient (lib/database/async-client.ts).
 *
 * Segue o roteiro já documentado em lib/database/index.ts e async-client.ts.
 * Usado hoje só pelos repositórios já migrados para `asyncDb` — os demais
 * continuam em SqliteClient (`db`), sem qualquer mudança de comportamento.
 *
 * Conexão: variável de ambiente PG_DATABASE_URL (não reaproveita DATABASE_URL —
 * essa já é usada por lib/db/index.ts como caminho do arquivo SQLite; manter os
 * dois bancos endereçáveis em paralelo durante a migração gradual).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { Pool, type PoolClient, types as pgTypes } from 'pg'
import type { AsyncDatabaseClient, AsyncExecuteResult, DbParams } from './async-client'

// node-postgres devolve NUMERIC como string por padrão (evita perda de precisão
// arbitrária) — mas o SQLite sempre devolveu REAL como number, e o app inteiro
// (cálculos de ROI, payback, financeiro) espera number. Sem isso, `soma += valor`
// vira concatenação de string em vez de soma (bug real encontrado testando esta
// migração: roi_medio por diretoria em fetchDashboard virava NaN).
pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (v: string) => parseFloat(v))

let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.PG_DATABASE_URL
    if (!connectionString) {
      throw new Error('PG_DATABASE_URL não definida — necessária para lib/database/postgres.ts')
    }
    _pool = new Pool({ connectionString })
  }
  return _pool
}

/**
 * Carrega o client de conexão ativo de uma transação em andamento, por contexto
 * assíncrono — não uma variável de módulo. Necessário porque `postgresClient` é
 * singleton e o Next.js atende requisições concorrentes: duas transações ao
 * mesmo tempo não podem compartilhar/disputar qual conexão está "ativa" agora.
 * Fora de uma transaction(), fica vazio e as queries usam o pool normalmente.
 */
const transactionContext = new AsyncLocalStorage<PoolClient>()

function getExecutor(): Pool | PoolClient {
  return transactionContext.getStore() ?? getPool()
}

/**
 * Traduz `?` posicional e `@nome` nomeado (formato aceito por DbParams) para
 * $1, $2, ... do node-postgres. Cada ocorrência de `?`/`@nome` no texto vira um
 * placeholder próprio, na ordem em que aparece — inclusive repetições do mesmo
 * `@nome`, que duplicam o valor no array (sempre correto para o pg, mesmo que
 * gere parâmetros redundantes).
 */
function toPgQuery(sql: string, params: DbParams = []): { text: string; values: unknown[] } {
  const values: unknown[] = []
  let n = 0

  if (Array.isArray(params)) {
    const text = sql.replace(/\?/g, () => {
      values.push(params[n])
      n += 1
      return `$${n}`
    })
    return { text, values }
  }

  const namedParams = params
  const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    values.push(namedParams[name])
    n += 1
    return `$${n}`
  })
  return { text, values }
}

async function runQuery<T>(sql: string, params?: DbParams): Promise<{ rows: T[]; rowCount: number; insertedId: number | null }> {
  const { text, values } = toPgQuery(sql, params)
  const result = await getExecutor().query(text, values)
  const insertedId = (result.rows[0] as Record<string, unknown> | undefined)?.id
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? 0,
    insertedId: typeof insertedId === 'number' ? insertedId : null,
  }
}

class PostgresClient implements AsyncDatabaseClient {
  async queryOne<T = Record<string, unknown>>(sql: string, params?: DbParams): Promise<T | undefined> {
    const { rows } = await runQuery<T>(sql, params)
    return rows[0]
  }

  async queryMany<T = Record<string, unknown>>(sql: string, params?: DbParams): Promise<T[]> {
    const { rows } = await runQuery<T>(sql, params)
    return rows
  }

  async execute(sql: string, params?: DbParams): Promise<AsyncExecuteResult> {
    // INSERT sem RETURNING não preenche insertedId — cada repositório migrado
    // precisa acrescentar `RETURNING id` explicitamente quando precisar do id
    // gerado (o adapter SQLite conseguia isso de graça via lastInsertRowid;
    // em Postgres é uma decisão explícita por query, documentada em async-client.ts).
    const { rowCount, insertedId } = await runQuery(sql, params)
    return { changes: rowCount, insertedId }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client: PoolClient = await getPool().connect()
    try {
      await client.query('BEGIN')
      try {
        // Todo queryOne/queryMany/execute chamado (direta ou indiretamente) de
        // dentro de fn() usa este client via transactionContext — mesma conexão,
        // isolado por contexto assíncrono, seguro sob requisições concorrentes.
        const result = await transactionContext.run(client, fn)
        await client.query('COMMIT')
        return result
      } catch (e) {
        try { await client.query('ROLLBACK') } catch { /* já em rollback */ }
        throw e
      }
    } finally {
      client.release()
    }
  }

  async exec(sql: string): Promise<void> {
    await getExecutor().query(sql)
  }
}

export const postgresClient = new PostgresClient()
