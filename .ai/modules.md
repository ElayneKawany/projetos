# Inventário de Módulos

## Módulos de Negócio

| Módulo | Page | API principal | Repository | Service | Status |
|---|---|---|---|---|---|
| Projetos | `/projetos` | `/api/projetos` | `lib/repositories/projetos.ts` | `lib/projetos.ts` | ✅ Completo |
| TAP | (sub-aba de projeto) | `/api/projetos/[id]/tap` | `lib/repositories/projetos.ts` | `lib/projetos.ts` | ✅ Completo |
| Viabilidade | (sub-aba de projeto) | `/api/projetos/[id]/viabilidade` | `lib/repositories/projetos.ts` | `lib/projetos.ts` | ✅ Completo |
| Cronograma | (sub-aba de projeto) | `/api/projetos/[id]/cronograma` | `lib/repositories/cronograma.ts` | `lib/cronograma.ts` | ✅ Completo |
| Financeiro | (sub-aba de projeto) | `/api/projetos/[id]/financeiro` | `lib/repositories/financeiro.ts` | `lib/financeiro/` | ✅ Completo |
| Orçamento | (sub-aba de projeto) | `/api/projetos/[id]/orcamento` | (pendente Repository) | — | ⚠️ API OK, Repository pendente |
| Comitês | `/comites` | `/api/comites` | `lib/repositories/comites.ts` | — (lógica na route) | ✅ Completo |
| Aprovações | `/aprovacoes` | `/api/aprovacoes` | (pendente Repository) | — | ⚠️ API OK, Repository pendente |
| Usuários | (configurações) | `/api/usuarios` | `lib/repositories/usuarios.ts` | — | ✅ Completo |
| Workflow | (aprovações) | `/api/workflow` | (pendente Repository) | — | ⚠️ API OK, Repository pendente |
| Dashboard | `/dashboard` | `/api/dashboard` | — (query direta) | — | ⚠️ Sem Repository |
| Auditoria | `/auditoria` | — | `lib/db/auditoria.ts` | — | ✅ Completo |
| Configurações | `/configuracoes` | `/api/configuracoes/*` | (pendente Repository) | — | ⚠️ ~80 chamadas getDb() diretas |
| Payback | — | — | — | — | 🔴 Não implementado |

---

## Componentes de Projeto (sub-abas)

Todos renderizados dentro de `app/(dashboard)/projetos/[id]/ProjetoDetalheClient.tsx`:

| Componente | Arquivo | Função |
|---|---|---|
| TapEditor | `components/projeto/TapEditor.tsx` | Edição/visualização TAP + workflow |
| ViabilidadeEditor | `components/projeto/ViabilidadeEditor.tsx` | Estudo de Viabilidade |
| CronogramaEditor | `components/projeto/CronogramaEditor.tsx` | WBS, milestones, importação Excel |
| FinanceiroTab | `components/projeto/FinanceiroTab.tsx` | Contratos, pagamentos, orçamento |
| ProjectTimeline | `components/projeto/ProjectTimeline.tsx` | Timeline visual do ciclo de vida |

---

## Módulos de Infraestrutura

| Módulo | Arquivo | Função |
|---|---|---|
| Auth | `lib/auth.ts` | JWT, sessão, permissões |
| Database | `lib/db/index.ts` | Singleton SQLite, schema, migrations |
| Auditoria | `lib/db/auditoria.ts` | `registrarAuditoria()` — log imutável |
| Logger | `lib/logger.ts` | Loggers pino por módulo (auth, api, db, cronograma) |
| Config/Env | `lib/config/env.ts` | Fail-fast para variáveis de ambiente obrigatórias |
| Financeiro service | `lib/financeiro.ts` | ROI, VPL, TIR, Payback calculations |
| Financeiro/dashboard | `lib/financeiro/dashboard.ts` | KPIs executivos |
| Financeiro/contratos | `lib/financeiro/contratos.ts` | CRUD contratos |
| Financeiro/pagamentos | `lib/financeiro/pagamentos.ts` | CRUD pagamentos |
| Financeiro/importador | `lib/financeiro/importador.ts` | Importação Excel contratos |
| AsyncDB | `lib/database/async-client.ts` | Interface futura para PostgreSQL |

---

## Páginas do Dashboard

| Rota | Descrição |
|---|---|
| `/dashboard` | Painel executivo do portfolio |
| `/projetos` | Lista de projetos com filtros |
| `/projetos/[id]` | Detalhe do projeto (abas: Visão Geral, TAP, Viabilidade, Cronograma, Financeiro, Timeline) |
| `/aprovacoes` | Fila de aprovações do usuário logado |
| `/comites` | Lista de comitês |
| `/comites/[id]` | Detalhe do comitê (ata, decisões, pendências) |
| `/cronogramas` | Visão cross-projeto de cronogramas |
| `/financeiro` | Dashboard financeiro do portfolio |
| `/configuracoes` | Configurações globais (diretorias, áreas, tipos, etc.) |
| `/auditoria` | Log de auditoria (ADMIN/PMO) |
