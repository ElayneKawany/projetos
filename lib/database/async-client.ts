/**
 * Interface assíncrona de acesso ao banco de dados.
 *
 * Esta interface define o contrato que QUALQUER driver (SQLite ou PostgreSQL)
 * deve implementar para ser usado na camada de repositórios.
 *
 * Estado atual:
 *   - AsyncSqliteAdapter (lib/database/sqlite.ts) implementa esta interface
 *     envolvendo as operações síncronas do better-sqlite3 em Promise.resolve().
 *
 * Migração futura:
 *   - PostgresClient (lib/database/postgres.ts) implementará esta interface
 *     usando node-postgres (pg) com I/O assíncrono real.
 *   - A troca ocorre em lib/database/index.ts — sem alterar repositories ou services.
 *
 * Diferenças em relação ao DatabaseClient síncrono:
 *   1. Todos os métodos retornam Promise<>
 *   2. execute() retorna AsyncExecuteResult com insertedId (não lastInsertRowid)
 *   3. transaction() aceita callback assíncrono
 *
 * Para PostgreSQL — atenção ao implementar:
 *   - insertedId deve ser preenchido via cláusula RETURNING id na query
 *   - Parâmetros nomeados @param precisam ser convertidos para $1, $2, ...
 *   - Connection pooling deve ser configurado no PostgresClient
 */

import type { DbParams } from './client'
export type { DbParams }

export interface AsyncExecuteResult {
  /** Número de linhas afetadas pelo comando (INSERT/UPDATE/DELETE). */
  changes: number

  /**
   * ID da linha inserida.
   *
   * SQLite:     lastInsertRowid convertido para number.
   * PostgreSQL: valor retornado por RETURNING id na query.
   * null:       quando não aplicável (UPDATE/DELETE sem INSERT).
   */
  insertedId: number | null
}

export interface AsyncDatabaseClient {
  /** Retorna um único registro ou undefined se não encontrado. */
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: DbParams
  ): Promise<T | undefined>

  /** Retorna zero ou mais registros. */
  queryMany<T = Record<string, unknown>>(
    sql: string,
    params?: DbParams
  ): Promise<T[]>

  /**
   * INSERT / UPDATE / DELETE.
   * Retorna linhas afetadas e ID inserido (null se não aplicável).
   */
  execute(sql: string, params?: DbParams): Promise<AsyncExecuteResult>

  /**
   * Executa bloco como transação atômica.
   *
   * O callback pode ser assíncrono — compatível com ambos SQLite e PostgreSQL.
   * Em caso de exceção o rollback é executado automaticamente.
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>

  /**
   * Executa SQL bruto (schema, migrations).
   * Não usar em queries normais — apenas para DDL e scripts de migração.
   */
  exec(sql: string): Promise<void>
}
