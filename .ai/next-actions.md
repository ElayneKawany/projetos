# Próximos Passos

Atualizado em: 2026-08-06

---

## Imediato (próxima Sprint)

### Opção A — Sprint OpenAPI 5

**Escopo:** Documentar módulos restantes em `openapi.yml`

Módulos pendentes: Dashboard, Comitês, Payback, Auditoria

Estimativa: ~20–25 endpoints, ~10–15 novos schemas

Entregável: `openapi.yml` com ~75+ paths, ~85+ schemas. Cobertura ~100%.

---

### Opção B — Sprint 9 — Repository Pattern: Configurações

**Escopo:** Migrar módulo Configurações para Repository Pattern

Arquivos afetados: ~28 arquivos em `app/api/configuracoes/**`
Estimativa: ~80 chamadas `getDb()` removidas
Repositório: `lib/repositories/configuracoes.ts` (novo)

---

### Opção C — Sprint 9 — Módulo Payback

**Escopo:** Implementar módulo de Acompanhamento de Payback

Pré-requisito: Sprint 8 (Comitês) — ✅ concluída
Status atual: não implementado
Entregável: interface, API, serviço, repository, testes

---

## Curto Prazo (2–4 Sprints)

| Ação | Prioridade | Dependência |
|---|---|---|
| Repository Pattern — Aprovações, Workflow | Alta | — |
| Repository Pattern — Orçamento | Alta | — |
| Repository Pattern — Dashboard | Média | — |
| Expansão de testes (>80% cobertura) | Alta | — |
| Módulo Payback completo | Alta | Sprint 8 ✅ |

---

## Médio Prazo (1–3 meses)

| Ação | Prioridade | Dependência |
|---|---|---|
| Adoção de ORM (Prisma ou Drizzle) | Alta | Aprovação técnica |
| Migração SQLite → PostgreSQL Sprint 1 | Alta | ORM adotado |
| Migração SQLite → PostgreSQL Sprint 2 | Alta | PG Sprint 1 |
| Migração SQLite → PostgreSQL Sprint 3 | Alta | PG Sprint 2 |
| Isenção formal Comitê IA Champions (Node.js) | Média | Gestão |

---

## Backlog Docker (baixa prioridade)

Ver detalhes em `.ai/backlog.md`:

1. Separar devDeps de produção no Docker (reduz ~150 MB)
2. Habilitar `output: 'standalone'` no Next.js (reduz ~70%)
3. Endpoint `/api/health` para healthcheck
4. Named volumes para produção

---

## Critério de Priorização

1. **Bloqueante para conformidade IA Champions** → prioridade máxima
2. **Risco de segurança** → prioridade alta
3. **Dívida técnica que cresce** (getDb() diretos) → prioridade alta
4. **Funcionalidade de negócio pendente** (Payback) → prioridade média
5. **Otimizações não bloqueantes** (Docker, etc.) → backlog
