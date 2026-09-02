import type { Config } from 'drizzle-kit'

/**
 * Config drizzle-kit para o Postgres de TESTE local (PGlite via scripts/dev-postgres-teste.js).
 * Usado só durante a migração (Fase 2 em diante) para aplicar lib/db/drizzle/schema.postgres.ts
 * num banco real e validar antes de tocar em qualquer repositório de produção.
 *
 * Uso: npx drizzle-kit push --config=drizzle.config.postgres.ts
 * (com scripts/dev-postgres-teste.js rodando)
 */
export default {
  schema: './lib/db/drizzle/schema.postgres.ts',
  out: './lib/db/drizzle/migrations-postgres',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://postgres:postgres@localhost:15432/postgres',
  },
} satisfies Config
