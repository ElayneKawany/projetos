# Convenções de Código

## Nomenclatura

| Contexto | Convenção | Exemplo |
|---|---|---|
| Arquivos de componente React | PascalCase | `ProjetosClient.tsx` |
| Arquivos de route | `route.ts` | `app/api/projetos/route.ts` |
| Arquivos de lib/service | camelCase | `lib/projetos.ts` |
| Arquivos de repository | camelCase | `lib/repositories/projetos.ts` |
| Variáveis/funções | camelCase | `buscarProjetos`, `criarContrato` |
| Tipos TypeScript | PascalCase | `StatusProjeto`, `TapVersao` |
| Constantes | UPPER_SNAKE_CASE | `STATUS_ORDER`, `STATUS_LABELS` |
| Colunas do banco | snake_case | `projeto_id`, `created_at` |
| Variáveis de ambiente | UPPER_SNAKE_CASE | `JWT_SECRET` |

---

## Padrão de API Routes

```typescript
// Estrutura padrão de toda route.ts
export async function GET(req: NextRequest, { params }: { params: ... }) {
  // 1. Autenticação
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // 2. Permissão (quando aplicável)
  if (!temPermissao(session.perfil, 'permissao:necessaria')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  // 3. Validação de entrada
  // 4. Chamada ao Service/Repository
  // 5. Retorno
}
```

---

## Padrão de Repository

```typescript
// lib/repositories/exemplo.ts
import { getDb } from '@/lib/db'

export class ExemploRepository {
  // Somente SELECT, INSERT, UPDATE, DELETE
  // Nenhuma regra de negócio
  // Nenhum cálculo de KPI
  // Sem Workflow, IA, Aprovações

  static findById(id: number) {
    const db = getDb()
    return db.prepare('SELECT * FROM tabela WHERE id = ?').get(id)
  }
}
```

---

## Logging

Nunca usar `console.log`, `console.error` ou `console.warn` no backend.

```typescript
import { apiLogger, authLogger, dbLogger } from '@/lib/logger'

// Correto
apiLogger.error({ erro, contexto }, 'Mensagem do erro')
authLogger.info({ userId }, 'Login realizado')

// Proibido
console.log('algo')
console.error(err)
```

Loggers disponíveis em `lib/logger.ts`: `apiLogger`, `authLogger`, `dbLogger`, `cronogramaLogger`.

---

## Banco de Dados

```typescript
// Correto — via Repository
import { ProjetosRepository } from '@/lib/repositories/projetos'
const projeto = ProjetosRepository.findById(id)

// Proibido — acesso direto fora de Repository
import { getDb } from '@/lib/db'
const db = getDb()
db.prepare('SELECT ...').get(id) // ❌
```

Exceção: `lib/db/auditoria.ts` acessa `getDb()` diretamente (é a própria camada Database).

---

## Soft Delete

Nunca deletar registros fisicamente.

```typescript
// Correto
db.prepare('UPDATE tabela SET ativo = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)

// Proibido
db.prepare('DELETE FROM tabela WHERE id = ?').run(id) // ❌ (exceto hard delete de usuário — comportamento legado documentado)
```

---

## Variáveis de Ambiente

```typescript
// Correto — via lib/config/env.ts com fail-fast
import { env } from '@/lib/config/env'
const secret = env.JWT_SECRET

// Proibido — acesso direto ou hardcoded
process.env.JWT_SECRET                          // ❌ sem fail-fast
const secret = 'megag-pmo-secret-hardcoded'    // ❌
```

---

## Migrações de Banco

Novas colunas **sempre** via `runMigrations()` em `lib/db/index.ts`:

```typescript
// Correto — additive, idempotente
function addCol(table: string, col: string, type: string) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`) }
  catch {} // coluna já existe — silencioso
}
addCol('projetos', 'nova_coluna', 'TEXT')

// Proibido — alterar schema.sql para adicionar coluna em tabela existente
// (schema.sql só para CREATE TABLE IF NOT EXISTS)
```

---

## Componentes React

- Server Components: buscam dados direto do DB (sem `fetch`)
- Client Components: marcados com `'use client'`; consomem `/api/*`
- Nunca fazer `fetch('/api/...')` dentro de Server Component
- Props padrão de componentes de projeto: `projetoId`, `canEdit`, `canApprove`, `onRefresh`

---

## Commits

Padrão Conventional Commits:

```
feat: adiciona módulo de payback
fix: corrige cálculo TIR quando fluxo é zero
docs: atualiza openapi.yml — Sprint 4
chore: atualiza dependências
refactor: migra FinanceiroRepository para padrão async
```
