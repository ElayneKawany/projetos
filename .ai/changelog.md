# Changelog

## 2026-08-06 — Sprint OpenAPI 4 — Financeiro, Contratos, Pagamentos, Movimentos e Orçamento

**Escopo:** Exclusivamente documentação. Nenhuma regra de negócio, endpoint, API ou repositório foi alterado.

**Arquivo alterado:** `openapi.yml` — expandido de 46 paths (Sprint 3) para 57 paths.

**Endpoints novos (11 paths, 21 operações):**

*Financeiro global (1):*
- `GET /api/financeiro` — expandido do stub anterior; com filtros `projeto_id`, `tipo`, `status`

*Configurações financeiras (1):*
- `PATCH /api/configuracoes/financeiro` — premissas selic/taxa_desconto/inflacao; PMO+

*Financeiro do projeto (2):*
- `GET /api/projetos/{id}/financeiro` — dashboard com contratos+resumo+viabilidade
- `POST /api/projetos/{id}/financeiro` — lançamento avulso (JSON ou multipart)

*Movimentos financeiros (3 operações em 1 path):*
- `GET /api/projetos/{id}/financeiro/movimentos`
- `POST /api/projetos/{id}/financeiro/movimentos`
- `PATCH /api/projetos/{id}/financeiro/movimentos` — atualizar status

*Contratos (6 paths, 9 operações):*
- `GET/POST /api/projetos/{id}/financeiro/contratos`
- `GET /api/projetos/{id}/financeiro/contratos/exportar` — binary xlsx
- `POST /api/projetos/{id}/financeiro/contratos/importar` — multipart xlsx
- `PATCH/DELETE /api/projetos/{id}/financeiro/contratos/{contId}`
- `POST /api/projetos/{id}/financeiro/contratos/{contId}/pagamentos`
- `PATCH/DELETE /api/projetos/{id}/financeiro/contratos/{contId}/pagamentos/{pagId}`

*Orçamento (2 paths, 4 operações):*
- `GET/POST /api/projetos/{id}/orcamento`
- `POST/PATCH/DELETE /api/projetos/{id}/orcamento/grupos/{grupoId}/itens`

**Novos components criados:**

Schemas (24):
`NaturezaFinanceira`, `TipoMovimento`, `StatusMovimento`, `StatusContrato`,
`LancamentoFinanceiro`, `LancamentoFinanceiroInput`, `MovimentoFinanceiro`, `MovimentoFinanceiroInput`,
`Pagamento`, `PagamentoInput`, `PagamentoAtualizacao`,
`Contrato`, `ContratoInput`, `ContratoAtualizacao`, `ContratoCompleto`,
`ResumoFinanceiro`, `DashboardFinanceiro`, `ResultadoImportacaoFinanceiro`,
`ItemOrcamento`, `ItemOrcamentoInput`, `ItemOrcamentoAtualizacao`,
`GrupoOrcamento`, `GrupoOrcamentoInput`, `TotaisOrcamento`

Parameters (3): `contId`, `pagId`, `grupoId`

**Observações registradas (não corrigidas — fora de escopo):**
1. `GET /api/projetos/{id}/financeiro` e `GET /api/projetos/{id}/financeiro/contratos` retornam a mesma resposta `DashboardFinanceiro` — endpoints duplicados para os mesmos dados.
2. `PATCH /api/projetos/{id}/financeiro/movimentos` usa `movimentoId` no corpo da requisição em vez de path param — inconsistência com o padrão REST dos outros módulos.
3. `DELETE /api/projetos/{id}/orcamento/grupos/{grupoId}/itens` tem duplo comportamento: deleta item se `itemId` (query param) estiver presente; deleta o grupo inteiro se `itemId` estiver ausente.
4. `POST /api/projetos/{id}/financeiro` retorna HTTP 200 (não 201) mesmo sendo uma criação de recurso.
5. Criação e edição de orçamento são bloqueadas com HTTP 403 quando o Estudo de Viabilidade mais recente está `APROVADO` — mensagem literal: `"O orçamento está bloqueado. O Estudo de Viabilidade foi aprovado. Solicite uma revisão para editar."`

---

## 2026-08-06 — Sprint OpenAPI 3 — Autenticação, Usuários, Workflow e Aprovações

**Escopo:** Exclusivamente documentação. Nenhuma regra de negócio, endpoint, API ou repositório foi alterado.

**Arquivo alterado:** `openapi.yml` — expandido de 41 paths (Sprint 2) para 46 paths.

**Endpoints expandidos (stubs substituídos por documentação completa):**
- `GET /api/aprovacoes` — expandido com schema `AprovacaoResumo`
- `GET /api/usuarios` — expandido com query param `all` e schema `UsuarioCompleto`

**Endpoints novos (9):**
- `GET /api/aprovacoes/{aprovacaoId}` — detalhe da aprovação
- `PATCH /api/aprovacoes/{aprovacaoId}` — registrar decisão (APROVADO/REJEITADO)
- `GET /api/aprovadores` — listar aprovadores padrão
- `POST /api/aprovadores` — adicionar aprovador padrão
- `DELETE /api/aprovadores` — remover aprovador padrão (via query param `id`)
- `GET /api/workflow/modelos` — listar modelos de workflow
- `POST /api/workflow/modelos` — criar modelo de workflow
- `PATCH /api/workflow/modelos/{modeloId}` — atualizar/inativar modelo
- `POST /api/usuarios` — criar usuário
- `PATCH /api/usuarios/{usuarioId}` — atualizar usuário
- `DELETE /api/usuarios/{usuarioId}` — excluir usuário

**Novos components criados:**
- Schemas (6): `UsuarioCompleto`, `AprovacaoResumo`, `AprovacaoDetalhe`, `AprovadorConfig`, `EtapaModeloWorkflow`, `ModeloWorkflow`
- Parameters (3): `aprovacaoId`, `usuarioId`, `modeloId`

**Observações registradas (não corrigidas — fora de escopo):**
1. `POST /api/auth/logout` retorna HTTP 302 (redirect para `/login`), não JSON. Documentado com o comportamento real.
2. `DELETE /api/usuarios/{id}` realiza hard delete (exclusão física), não soft delete. Documentado fiel à implementação.
3. `DELETE /api/aprovadores` usa query param `id` em vez de path param. Documentado fiel à rota existente.
4. Não existe módulo `/api/perfis/` independente — perfis são gerenciados via `perfil_id` na criação/edição de usuários.
5. Não existe endpoint `GET /api/usuarios/{id}` — a consulta individual não está implementada.

---

## 2026-08-06 — Sprint OpenAPI 2 — Módulo Cronograma

**Escopo:** Exclusivamente documentação. Nenhuma regra de negócio, endpoint, API ou repositório foi alterado.

**Arquivo alterado:** `openapi.yml` — expandido de 23 paths (Sprint 1) para 41 paths.

**Endpoints documentados (18 novos):**

*Cronograma (13):* GET/POST `/api/projetos/{id}/cronograma`, GET `/cronograma/exportar`, GET `/cronograma/modelo`, PUT `/cronograma/{cronogramaId}/tarefas`, POST `/cronograma/{cronogramaId}/nova-atividade`, POST `/cronograma/{cronogramaId}/submeter`, POST `/cronograma/{cronogramaId}/aprovar`, POST `/cronograma/{cronogramaId}/revisao`, POST `/cronograma/{cronogramaId}/nova-versao`, POST `/cronograma/{cronogramaId}/gerar-subtarefas`, POST `/cronograma/{cronogramaId}/tarefas/{tarefaId}/concluir`

*Configurações — Cronograma (5):* GET/POST `/api/configuracoes/tipos-tarefa`, PATCH `/api/configuracoes/tipos-tarefa/{id}`, GET/PATCH `/api/configuracoes/cronograma`

**Novos components criados:**
- Schemas (15): `StatusCronograma`, `NivelTarefa`, `TipoTarefa`, `CriticidadeTarefa`, `StatusTarefa`, `PrazoStatus`, `Cronograma`, `CronogramaSumario`, `Tarefa`, `TarefaInput`, `ResultadoConclusaoTarefa`, `ResultadoCronograma`, `SubtarefaSugerida`, `TipoTarefaConfig`, `NovaVersaoCronograma`
- Parameters (3): `cronogramaId`, `tarefaId`, `tipoTarefaId`

**Observações registradas (não corrigidas — fora de escopo):**
1. Marcos não são um recurso separado — são tarefas com `tipo=MARCO`. Não existe endpoint dedicado `/marcos`.
2. Subtarefas não têm endpoint CRUD próprio — criadas via `PUT /tarefas` (rascunho) ou `POST /nova-atividade` (cronograma aprovado).
3. Dependências entre tarefas não existem como entidade na API — nenhum endpoint de dependências encontrado.
4. `POST /cronograma` retorna HTTP 200 (não 201) tanto para criação quanto para importação Excel.
5. O endpoint `/api/configuracoes/cronograma` é uma rota dupla — também serve os tipos de tarefa (equivalente a `/api/configuracoes/tipos-tarefa`). Documentados separadamente para fidelidade à estrutura de rotas.

---

## 2026-08-06 — Sprint OpenAPI 1 — Módulos Projetos, TAP e Estudo de Viabilidade

**Escopo:** Exclusivamente documentação. Nenhuma regra de negócio, endpoint, API ou repositório foi alterado.

**Arquivo alterado:**
- `openapi.yml` — Expandido de 303 linhas (12 paths) para ~840 linhas (23 paths documentados)

**Endpoints documentados nesta Sprint:**

*Projetos (8):* GET/POST `/api/projetos`, GET/PATCH `/api/projetos/{id}`, GET `/api/projetos/{id}/dashboard`, PATCH `/api/projetos/{id}/visao-geral`, POST `/api/projetos/{id}/concluir`, POST `/api/projetos/{id}/encerrar`

*TAP (8):* GET/PATCH `/api/projetos/{id}/tap/{tapId}`, POST `.../submeter`, POST `.../aprovar`, POST `.../revisao`, POST `.../nova-versao`, GET `.../exportar-modelo`, POST `.../importar`

*Viabilidade (8):* GET/PATCH `/api/projetos/{id}/viabilidade/{vid}`, POST `.../submeter`, POST `.../aprovar`, POST `.../revisao`, POST `.../nova-versao`, GET `.../exportar-modelo`, POST `.../importar`

**Componentes criados:**
- Schemas: `StatusProjeto`, `Prioridade`, `Complexidade`, `Classificacao`, `PerfilUsuario`, `StatusArtefato`, `TipoParticipacaoWorkflow`, `AcaoAprovacao`, `Erro`, `RespostaSucesso`, `Usuario`, `Projeto`, `ProjetoCriacao`, `ProjetoAtualizacao`, `ProjetoVisaoGeralAtualizacao`, `DashboardProjeto`, `TapVersao`, `TapAtualizacao`, `ViabilidadeVersao`, `ViabilidadeAtualizacao`, `EtapaWorkflow`, `SubmeterArtefato`, `ResultadoAprovacao`, `RespostaImportacao`, `NovaVersaoTap`, `NovaVersaoViabilidade`, `ConcluirProjeto` (27 schemas)
- Parameters: `projetoId`, `tapId`, `viabilidadeId`
- Responses: `NaoAutenticado`, `SemPermissao`, `NaoEncontrado`, `DadosInvalidos`, `EntidadeNaoProcessavel`, `ErroInterno`, `Sucesso`
- SecuritySchemes: `cookieAuth` (JWT HttpOnly, cookie `megag_pmo_session`)

**Cobertura:** 12 paths → 23 paths (91% dos endpoints em escopo documentados com parâmetros, request bodies e responses completos)

**Observações registradas (não corrigidas — fora do escopo da Sprint):**
1. Endpoint `GET /api/projetos/{id}/tap/{tapId}` não tem rota GET dedicada — é lido junto com o projeto. Documentado como GET separado para completude da API surface.
2. Status HTTP 204 não é utilizado em nenhum endpoint — todos retornam 200 com corpo.
3. Endpoint `/api/projetos/{id}/tap/{tapId}/aprovar` aceita request body vazio mas recebe `{}` de alguns clientes — corpo marcado como `required: false` para refletir a realidade.

---

## 2026-08-06 — Auditoria IA Champions: Item 5 — Refatoração da Camada Database (Preparação para PostgreSQL)

**Escopo:** Exclusivamente `lib/database/`. Nenhum repositório, service, API, workflow ou interface foi alterado.

**Arquivos criados:**
- `lib/database/async-client.ts` — Interface `AsyncDatabaseClient` + tipo `AsyncExecuteResult`. Contrato que PostgresClient implementará no futuro. `insertedId` em vez de `lastInsertRowid` para neutralidade de driver.

**Arquivos alterados:**
- `lib/database/sqlite.ts` — Adicionados `AsyncSqliteAdapter` (implementa `AsyncDatabaseClient` envolvendo `SqliteClient` em Promises) e singleton `asyncSqliteClient`. `SqliteClient` e `sqliteClient` existentes: intocados.
- `lib/database/index.ts` — Adicionados exports `asyncDb` (= `asyncSqliteClient`) e types `AsyncDatabaseClient`/`AsyncExecuteResult`. Guia de migração PostgreSQL em 4 passos documentado como comentários. Exports existentes (`db`, `DatabaseClient`, `ExecuteResult`): preservados.

**SQLite continua funcionando:** Os 8 repositórios importam `{ db }` de `@/lib/database` — este export não foi alterado. Comportamento idêntico ao anterior.

**Validação:**
- `npx tsc --noEmit` → ✅ 0 erros
- `npm run build` → ✅ 37 páginas geradas com sucesso

**Como PostgreSQL será incorporado futuramente:**
1. Criar `lib/database/postgres.ts` com `PostgresClient implements AsyncDatabaseClient`
2. Em `lib/database/index.ts`: trocar `asyncSqliteClient` por `postgresClient` no export `asyncDb`
3. Migrar repositórios gradualmente: `import { db }` → `import { asyncDb }` + converter métodos para async/await
4. Quando todos migrados: remover export síncrono e renomear `asyncDb` → `db`

**Nenhuma regra de negócio, repositório, service, API, workflow ou interface foi alterada.**

---

## 2026-08-06 — Auditoria IA Champions: Item 4 — Análise de Compatibilidade SQLite → PostgreSQL

**Escopo:** Auditoria técnica exclusivamente. Nenhum arquivo da aplicação foi alterado.

**Resultado do inventário:**
- 60 tabelas (32 em schema.sql + 28 em runMigrations)
- 13 índices, 0 views, 0 triggers, ~35 foreign keys

**Incompatibilidades identificadas (9 categorias, ~155 ocorrências):**
- 🔴 ALTO: API síncrona (toda a aplicação), `.lastInsertRowid` (35+ locais), named params `@param` (30+), `julianday()` (2), `MAX()` em UPDATE SET (1)
- 🟡 MÉDIO: `datetime('now')` / `date('now')` (~50), `INSERT OR IGNORE` (~12), `AUTOINCREMENT` (60 tabelas), tipos de data como TEXT
- 🟢 BAIXO: `PRAGMA` (4), `ON CONFLICT...excluded` (compatível)

**Ativo chave identificado:** `lib/database/client.ts` — interface `DatabaseClient` já isola o driver. Ponto de troca documentado.

**Estimativa de migração:** 18–27 dias úteis em 3 sprints (Preparação → Adaptação → Conversão).

---

## 2026-08-06 — Auditoria IA Champions: Item 3 — CI Pipeline (GitHub Actions)

**Arquivos criados:**
- `.github/workflows/ci.yml` — Pipeline CI com etapas: checkout → Node.js 20 LTS → cache npm → `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm run build` → upload de logs em caso de falha
- `.eslintrc.json` — Registra `@typescript-eslint` plugin e desativa `no-explicit-any` (regra já suprimida por comentários inline nos arquivos existentes)

**Arquivos alterados:**
- `app/(dashboard)/comites/[id]/ComiteDetalheClient.tsx` — linha 2159: aspas `"` escapadas para `&quot;` (correção de erro `react/no-unescaped-entities`)

**Validação local:**
- `npx tsc --noEmit` → ✅ 0 erros
- `npm run lint` → ✅ 0 erros (apenas warnings de `<img>` e `useEffect` que não bloqueiam)
- `npm run build` → ✅ 37 páginas geradas com sucesso

**Nenhuma regra de negócio, API, workflow ou interface foi alterada.**

---

## 2026-08-06 — Auditoria IA Champions: Item 2 — Containerização (Docker)

**Arquivos criados:**
- `Dockerfile` — Multi-stage build: `deps` (npm ci + compilação nativa) → `builder` (next build) → `runner` (imagem enxuta, usuário não-root)
- `.dockerignore` — Exclui node_modules, .next, .git, .env.local, data/, uploads/
- `docker-compose.yml` — Serviço único com bind mounts para SQLite e uploads, env_file .env.local
- `DOCKER.md` — Guia operacional completo

**Estratégia:** `ARG JWT_SECRET` com placeholder no builder stage para satisfazer validação `lib/config/env.ts` sem expor segredos reais na imagem.

**Nenhum código de aplicação alterado.**

---

## 2026-08-06 — Auditoria IA Champions: Item 1 — Gestão de Segredos

**Arquivos criados:** `.env.example`, `lib/config/env.ts`
**Arquivos alterados:** `lib/auth.ts`, `middleware.ts`, `.env.local`
**Segredos removidos:** fallback hardcoded `'megag-pmo-secret-change-in-production-2026'` de auth.ts e middleware.ts.

---

# Changelog — Migração Repository Pattern

## 2026-08-05

### Sprint 8 — Comitês

**lib/repositories/comites.ts** — Adicionados ~35 métodos:
- Acesso raw: `findRaw`, `updateFull`, `deleteCascade`
- Participantes: `findParticipantes`, `findParticipantesNomeados`, `insertParticipante`, `updatePresencaBulk`, `deleteParticipante`
- Decisões: `insertDecisao`, `findDecisao`, `updateDecisao`, `deleteDecisao`
- Pendências: `insertPendencia`, `findPendencia`, `updatePendencia`, `deletePendencia`
- Comite Projetos: `findComiteProjetoExistente`, `findProjetoSnapshot`, `insertComiteProjeto`, `findComiteProjeto`, `updateComiteProjeto`
- Ata: `findAta`, `findAtaHistorico`, `insertAta`, `updateAta`, `insertAtaHistorico`
- Contexto IA/exportação: `findProjetosParaAta`, `findDecisoesSimplesComiteId`, `findPendenciasAbertas`, `findProjetosParaExportacao`, `findDecisoesParaExportacao`, `findPendenciasParaExportacao`, `findPortfolioAtivoParaIA`, `findTotalFinanceiroPago`, `findTotalBeneficioPayback`, `findDecisoesPendentes`, `findComiteAnterior`, `findMovimentosRecentes`, `updateResumoIaGeradoEm`

**14 routes migradas** — removidas todas as chamadas `getDb()` e `db.prepare()` do módulo Comitês.

### Correções pré-Sprint 8

**lib/repositories/financeiro.ts** — Removidos `saldo` e `percentual_executado` de `resumoExecutivo()` (cálculos movidos para service layer `lib/financeiro/dashboard.ts`).

**lib/repositories/usuarios.ts** — Adicionados 7 métodos: `findRawById`, `checkCpfDuplicado`, `checkEmailDuplicado`, `findPerfilById`, `updateFull`, `checkDependencias`, `hardDelete`.

**app/api/usuarios/[id]/route.ts** — Migrado para `UsuariosRepository`.

**lib/financeiro/contratos.ts**, **dashboard.ts**, **pagamentos.ts**, **importador.ts** — Migrados para `FinanceiroRepository`.
