# Roadmap MegaG PMO

## Visão Geral

Portal corporativo de governança de projetos do PMO da MegaG Alimentos.
Stack: Next.js 15 · TypeScript · SQLite (better-sqlite3) · JWT · Tailwind CSS

---

## Fase 1 — Fundação (CONCLUÍDA) ✅

| Item | Status |
|---|---|
| Estrutura Next.js 15 App Router | ✅ |
| Banco SQLite com schema completo | ✅ |
| Autenticação JWT (jose) + middleware | ✅ |
| Sistema de perfis e permissões | ✅ |
| Módulos: Projetos, TAP, Viabilidade, Cronograma, Financeiro, Comitês | ✅ |
| Design system Tailwind customizado | ✅ |

---

## Fase 2 — Qualidade e Conformidade IA Champions (EM ANDAMENTO) 🔄

| Item | Sprint | Status |
|---|---|---|
| Gestão de segredos (JWT_SECRET fail-fast) | Auditoria 1 | ✅ |
| Containerização Docker multi-stage | Auditoria 2 | ✅ |
| CI/CD GitHub Actions | Auditoria 3 | ✅ |
| Análise compatibilidade SQLite→PostgreSQL | Auditoria 4 | ✅ |
| Interface async para PostgreSQL (AsyncDatabaseClient) | Auditoria 5 | ✅ |
| Logging estruturado (pino) | Auditoria 6 | ✅ |
| Suite de testes Jest (financeiro, auth, status) | Auditoria 7 | ✅ |
| Infraestrutura como Código (Terraform) | Auditoria 8 | ✅ |
| OpenAPI 3.1 — Sprint 1 (Projetos/TAP/Viabilidade) | OpenAPI 1 | ✅ |
| OpenAPI 3.1 — Sprint 2 (Cronograma) | OpenAPI 2 | ✅ |
| OpenAPI 3.1 — Sprint 3 (Auth/Usuários/Workflow) | OpenAPI 3 | ✅ |
| OpenAPI 3.1 — Sprint 4 (Financeiro/Contratos/Orçamento) | OpenAPI 4 | ✅ |
| Repository Pattern — Projetos, Usuários, Cronograma | Sprints 1–6 | ✅ |
| Repository Pattern — Financeiro | Sprint 7 | ✅ |
| Repository Pattern — Comitês | Sprint 8 | ✅ |
| Repository Pattern — Configurações, Aprovações, Workflow | Sprint 9+ | 🔴 Pendente |
| OpenAPI 3.1 — Sprint 5 (Comitês, Dashboard, Payback) | OpenAPI 5 | 🔴 Pendente |
| Módulo Payback completo | Sprint 9 | 🔴 Pendente |

---

## Fase 3 — Migração para PostgreSQL (FUTURA) 📋

| Item | Estimativa |
|---|---|
| ORM formal (Prisma ou Drizzle) | Sprint PG-1 |
| Adaptar 35+ locais de `lastInsertRowid` | Sprint PG-1 |
| Converter 30+ named params `@param` | Sprint PG-1 |
| Substituir `datetime('now')` (~50 ocorrências) | Sprint PG-2 |
| Converter API síncrona → async/await | Sprint PG-2 |
| Testes de integração com PostgreSQL real | Sprint PG-3 |
| Deploy em ambiente com PostgreSQL | Sprint PG-3 |

**Estimativa total:** 18–27 dias úteis (3 sprints)
**Pré-requisito:** Isenção formal do Comitê IA Champions para stack Node.js

---

## Conformidade IA Champions

**Score atual:** 10/13 (77%)

| Categoria | Status |
|---|---|
| Linguagem (Python) | ⚠️ Não conforme — isenção pendente |
| Banco (PostgreSQL) | ⚠️ Não conforme — migração mapeada |
| ORM formal | ⚠️ Parcial — migrations próprias funcionais |
| Demais 10 categorias | ✅ OK |
