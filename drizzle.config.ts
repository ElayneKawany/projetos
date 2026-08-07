import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/drizzle/schema.ts',
  out: './lib/db/drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/megag-pmo.db',
  },
} satisfies Config
