/**
 * Instância Drizzle ORM — MegaG PMO
 *
 * Singleton que compartilha a mesma conexão better-sqlite3 gerenciada por getDb().
 * Repositórios novos devem importar `drizzleDb()` daqui para usar o query builder.
 * Repositórios legados continuam usando `db` de @/lib/database (SqliteClient).
 *
 * Migração gradual:
 *   1. Importar drizzleDb() e tabelas do schema
 *   2. Substituir raw SQL por query builder (eq, insert, update...)
 *   3. Remover o import de `db` quando todos os métodos estiverem migrados
 */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/drizzle/schema'
import getDb from '@/lib/db'

type DrizzleInstance = ReturnType<typeof drizzle<typeof schema>>

let _instance: DrizzleInstance | null = null

export function drizzleDb(): DrizzleInstance {
  if (!_instance) {
    _instance = drizzle(getDb(), { schema })
  }
  return _instance
}
