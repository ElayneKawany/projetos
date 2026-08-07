/**
 * Abstração de acesso ao banco de dados.
 *
 * Toda query deve passar por DatabaseClient — nunca por getDb() diretamente.
 * A implementação atual é SQLite (SqliteClient). Para migrar para PostgreSQL,
 * basta trocar a implementação sem alterar os repositórios.
 */
export interface ExecuteResult {
  changes: number
  lastInsertRowid: number | bigint
}

/** Parâmetros aceitos: array posicional `?` ou objeto de named params `@name`. */
export type DbParams = unknown[] | Record<string, unknown>

export interface DatabaseClient {
  /** Retorna um único registro ou undefined se não encontrado. */
  queryOne<T = Record<string, unknown>>(sql: string, params?: DbParams): T | undefined

  /** Retorna zero ou mais registros. */
  queryMany<T = Record<string, unknown>>(sql: string, params?: DbParams): T[]

  /** INSERT / UPDATE / DELETE — retorna linhas afetadas e último id inserido. */
  execute(sql: string, params?: DbParams): ExecuteResult

  /** Executa bloco como transação atômica. */
  transaction<T>(fn: () => T): T

  /** Executa SQL bruto (schema, migrations). Não use em queries normais. */
  exec(sql: string): void
}
