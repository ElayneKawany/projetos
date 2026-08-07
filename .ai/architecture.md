# Arquitetura do Sistema

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 App Router |
| Linguagem | TypeScript 5 |
| Banco de dados | SQLite via better-sqlite3 |
| Autenticação | JWT (jose) — cookie HttpOnly `megag_pmo_session` (8h) |
| Estilo | Tailwind CSS 3 + design system customizado |
| Logging | pino + pino-pretty |
| Testes | Jest + ts-jest |
| CI | GitHub Actions (.github/workflows/ci.yml) |
| Container | Docker multi-stage (deps → builder → runner) |
| IaC | Terraform (infra/main.tf) |

---

## Estrutura de Camadas

```
API Route (app/api/**/route.ts)
  ↓ getSession() + validação de permissão
  ↓ chama Service
Service (lib/financeiro.ts, lib/projetos.ts, lib/financeiro/*)
  ↓ regras de negócio, cálculos, validações
  ↓ chama Repository
Repository (lib/repositories/*.ts)
  ↓ SELECT / INSERT / UPDATE / DELETE
  ↓ usa DatabaseClient
Database (lib/db/index.ts → getDb())
  ↓ singleton SQLite
  ↓ executa schema.sql + runMigrations()
```

**Regra de ouro:** Nenhuma camada pode chamar a camada superior.
`getDb()` direto fora de Repository é **proibido** no padrão atual.

---

## Páginas (Server Components + Client Components)

```
app/(dashboard)/[módulo]/page.tsx         ← Server Component
  └─ busca dados direto do DB (sem fetch de API)
  └─ passa props para *Client.tsx

app/(dashboard)/[módulo]/*Client.tsx      ← Client Component ('use client')
  └─ estado local, interações, chamadas fetch para /api/*
```

---

## Autenticação

- `middleware.ts` — intercepts all routes exceto `/login`, `/api/auth/login`, `/_next/*`, `/favicon.ico`
- `lib/auth.ts` — `getSession()`, `criarJWT()`, `temPermissao()`
- JWT payload: `{ id, nome, email, perfil, perfil_id, diretorias_id, area_id }`
- Hierarquia: `ADMIN(100) > PMO(80) > CEO(70) > DIRETOR(60) > GESTOR(40) > SOLICITANTE(20)`

---

## Banco de Dados

- Arquivo único: `data/megag-pmo.db`
- Acesso exclusivo via `getDb()` em `lib/db/index.ts`
- Schema declarado em `lib/db/schema.sql` (idempotente — `CREATE TABLE IF NOT EXISTS`)
- Novas colunas via `runMigrations()` (ALTER TABLE — erros silenciosos por coluna já existente)
- **Nunca deletar registros** — usar `ativo = 0` ou `deleted_at`
- Preparado para migração futura para PostgreSQL

---

## Ciclo de Vida dos Projetos

13 fases em `STATUS_ORDER` (`types/index.ts`):
```
PROPOSTA → TRIAGEM → COMITE_IDEIAS → VIABILIDADE → COMPLEMENTACAO_TAP →
APROVACAO → ESTRUTURACAO → CRONOGRAMA → EXECUCAO → PROJETO_CONCLUIDO →
PAYBACK_ACOMPANHAMENTO → PAYBACK_ENCERRADO → PROJETO_ENCERRADO
```

Transições geridas por `atualizarStatusProjeto()` em `lib/projetos.ts`.
Auto-criação de artefatos na transição (ex.: entrar em VIABILIDADE cria Estudo de Viabilidade V1).

---

## Artefatos e Workflow

Fluxo padrão de artefatos (TAP, Viabilidade, Cronograma):
```
RASCUNHO → PENDENTE_APROVACAO → APROVADO
                              ↘ EM_REVISAO → RASCUNHO
```

Aprovações sempre via módulo `/api/aprovacoes`. Nenhum artefato tem lógica própria de aprovação.

---

## Rastreabilidade

Dois mecanismos paralelos:

| Mecanismo | Tabela | Uso |
|---|---|---|
| Auditoria imutável | `auditoria` | Compliance, admin — registra CREATE/UPDATE/APPROVE/REJECT com JSON antes/depois |
| Histórico por campo | `projeto_historico_alteracoes` | UI Timeline — campo, valor anterior, valor novo, usuário |

Sempre chamar **ambos** em operações significativas.

---

## Design System

Classes Tailwind customizadas (`tailwind.config.ts` + `app/globals.css`):

| Categoria | Classes |
|---|---|
| Botões | `btn-primary`, `btn-secondary`, `btn-ghost` |
| Cards | `card`, `card-header`, `card-title` |
| Badges | `badge`, `badge-proposta`, `badge-execucao`, ... |
| Formulários | `input`, `input-label` |
| Tabelas | `table-megag` |
| Timeline | `timeline-item`, `timeline-dot` |
| Tabs | `tab-list`, `tab-item` |

Cores da marca: `megag-azul` (#003087), `megag-dourado` (gold).
**Nunca** usar overrides inline de cor do Tailwind.
