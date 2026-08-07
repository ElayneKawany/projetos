# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000

# Database
node scripts/seed.js            # Create tables + seed initial data (required on first run)
node scripts/import-portfolio.js # Import portfolio from scripts/portfolio-data.json (stop server first)

# Production
npm run build && npm start

# Lint
npm run lint
```

No test suite exists. TypeScript compilation errors surface via `npm run build` or the dev server.

---

## Architecture

### Stack

Next.js 15 App Router · TypeScript · SQLite (better-sqlite3) · Tailwind CSS · JWT auth via `jose`

### Database

Single SQLite file at `data/megag-pmo.db`. Access exclusively through `lib/db/index.ts → getDb()`, which is a singleton that:

1. Runs `lib/db/schema.sql` (idempotent `CREATE TABLE IF NOT EXISTS`)
2. Runs `runMigrations()` — additive `ALTER TABLE ADD COLUMN` calls that catch errors silently (column already exists). **All new columns must be added here, not in schema.sql.**
3. Seeds `config_status_projeto` on first boot if empty.

Never delete rows. Use soft-delete flags (`ativo = 0`, `deleted_at`). Schema is designed for future Oracle migration.

### Authentication

JWT stored in `megag_pmo_session` cookie (8h). `middleware.ts` enforces auth on all routes except `/login`, `/api/auth/login`, and static assets. In Server Components and API routes call `getSession()` from `lib/auth.ts` — it decodes the cookie and returns `SessionUser` (id, nome, email, perfil, etc.).

Perfis and their hierarchy (`temPermissao`): `ADMIN(100) > PMO(80) > CEO(70) > DIRETOR(60) > GESTOR(40) > SOLICITANTE(20)`.

### Page / API pattern

Pages under `app/(dashboard)/` are **Server Components** — they fetch data directly from the DB, then pass it as props to a `*Client.tsx` file marked `'use client'`. Never fetch from APIs inside Server Components; query the DB directly.

API routes under `app/api/` are thin: they call `getSession()`, validate, then call service functions from `lib/`. They never contain business logic inline.

### Core services

| File | Responsibility |
|---|---|
| `lib/projetos.ts` | Project CRUD, status/priority transitions, `projeto_historico_alteracoes`, `config_status_projeto` queries |
| `lib/auth.ts` | JWT, session, `temPermissao` |
| `lib/financeiro.ts` | ROI, VPL, TIR, Payback calculations |
| `lib/db/auditoria.ts` | `registrarAuditoria()` — immutable audit log, never fails silently |

### Audit vs. History

Two separate tracking mechanisms:

- **`auditoria`** — immutable system-wide log (`registrarAuditoria()`). Records every CREATE/UPDATE/APPROVE/REJECT with `dados_antes`/`dados_depois` JSON. Never query this for UI; use for compliance/admin only.
- **`projeto_historico_alteracoes`** — field-level change log per project (`registrarHistoricoAlteracao()`). Stores `campo`, `valor_anterior`, `valor_novo`, `usuario_nome`. This is what the Timeline tab displays.

Always call **both** when making meaningful changes.

### Project lifecycle

12-phase status order defined in `types/index.ts → STATUS_ORDER`. Transitions are saved in `projeto_status_historico`. The function `atualizarStatusProjeto()` in `lib/projetos.ts` handles status change + auto-creates the next artefact (e.g., entering `VIABILIDADE` auto-creates Estudo de Viabilidade V1).

### Artefact status flow

TAP and Viabilidade follow: `RASCUNHO → PENDENTE_APROVACAO → APROVADO`. Approval routes live at `app/api/projetos/[id]/tap/[tapId]/aprovar/` and `/revisao/`. On TAP approval: project advances to `VIABILIDADE` and Estudo de Viabilidade V1 is auto-created. On Viabilidade approval (not yet implemented): project should advance to `ESTRUTURACAO`.

### Component structure

Reusable project-tab components live in `components/projeto/`:

- `TapEditor.tsx` — edit/view TAP, triggers approve/revisao API calls
- `ViabilidadeEditor.tsx` — Estudo de Viabilidade
- `CronogramaEditor.tsx` — schedule (manual entry + Excel import), versioning
- `FinanceiroTab.tsx` — CAPEX/OPEX releases
- `ProjectTimeline.tsx` — visual lifecycle + status history

All are rendered inside `app/(dashboard)/projetos/[id]/ProjetoDetalheClient.tsx`, which owns the tab state and passes `canEdit` / `canApprove` / `onRefresh` props.

### Design system

Tailwind custom classes defined in `tailwind.config.ts` and `app/globals.css`:
- `btn-primary`, `btn-secondary`, `btn-ghost`
- `card`, `card-header`, `card-title`
- `badge`, `badge-proposta`, `badge-execucao`, etc.
- `input`, `input-label`
- `table-megag`, `timeline-item`, `timeline-dot`
- `tab-list`, `tab-item`

Brand colours: `megag-azul` (#003087), `megag-dourado` (gold). Always use these classes — never inline Tailwind colour overrides.

---

## Project-specific rules (from `.ai/CLAUDE.md`)

- Read existing code before implementing. Understand current behaviour first.
- Never remove functionality without explicit authorisation.
- Implement only what is in scope. Do not touch other modules.
- Before creating any component, check if one already exists.
- Structural DB changes (new tables, columns) → present proposal first, then implement using the `runMigrations` pattern.
- If a change affects other modules, report the impact before touching code.
