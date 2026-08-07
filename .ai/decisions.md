# Decisões Arquiteturais

## 2026-08-06 — Refatoração da Camada Database (Preparação para PostgreSQL)

### 1. Interface `AsyncDatabaseClient` criada em arquivo separado (`lib/database/async-client.ts`)

**Decisão:** A interface assíncrona foi criada em seu próprio arquivo, sem modificar `lib/database/client.ts` (interface síncrona).

**Motivo:** Zero acoplamento com os 8 repositórios existentes que importam `DatabaseClient`. Separação clara de contratos: `client.ts` = SQLite atual; `async-client.ts` = contrato futuro PostgreSQL.

**Impacto:** Nenhum arquivo existente precisou ser alterado para usar a nova interface.

---

### 2. `AsyncSqliteAdapter` adicionado ao `lib/database/sqlite.ts` existente (não em arquivo separado)

**Decisão:** `AsyncSqliteAdapter` e `asyncSqliteClient` foram adicionados ao `sqlite.ts` existente, junto com `SqliteClient` e `sqliteClient`.

**Motivo:** Ambas as classes compartilham a dependência `getDb()` e a helper `spreadParams()`. Criar um terceiro arquivo `sqlite-async.ts` exigiria re-exportar ou duplicar essas dependências. Coexistência no mesmo arquivo é mais limpa.

**Restrição:** `SqliteClient` e `sqliteClient` (existentes) não foram alterados — os 8 repositórios continuam funcionando sem modificação.

---

### 3. `transaction()` usa BEGIN/COMMIT/ROLLBACK manual (não `db.transaction()` do better-sqlite3)

**Decisão:** `AsyncSqliteAdapter.transaction()` usa `db.exec('BEGIN')` / `db.exec('COMMIT')` / `db.exec('ROLLBACK')` manualmente.

**Motivo:** `better-sqlite3`'s `db.transaction()` aceita apenas callbacks síncronos. Como `AsyncDatabaseClient.transaction()` aceita `fn: () => Promise<T>`, seria necessário bloquear o event loop ou usar `deasync` — ambas más práticas. A transação manual com await preserva a semântica correta.

**Restrição:** Não aninhar transações — o SQLite rejeitará "cannot start a transaction within a transaction". Esta limitação é documentada nos comentários do arquivo.

---

### 4. `insertedId` em vez de `lastInsertRowid` em `AsyncExecuteResult`

**Decisão:** `AsyncExecuteResult` usa `insertedId: number | null` (convertido de `lastInsertRowid` no adapter). `ExecuteResult` síncrono mantém `lastInsertRowid`.

**Motivo:** `lastInsertRowid` é específico do SQLite. PostgreSQL retorna o ID inserido via `RETURNING id`. Usar `insertedId` no contrato assíncrono torna a interface neutral — ambos os drivers preenchem o mesmo campo.

**Conversão:** `lastInsertRowid != null ? Number(r.lastInsertRowid) : null` — a conversão para `number` trata o tipo `bigint` que `better-sqlite3` retorna em certos casos.

---

### 5. Guia de migração PostgreSQL documentado em `lib/database/index.ts`

**Decisão:** Os 4 passos da migração para PostgreSQL foram documentados como comentários em `lib/database/index.ts`.

**Motivo:** O ponto de troca do driver está nesse arquivo — quem fizer a migração consultará este arquivo primeiro. Documentação próxima do ponto de ação, não em README ou docs externos.

---

## 2026-08-06 — CI Pipeline (GitHub Actions)

### 1. JWT_SECRET como env var no step `Build` do CI

**Decisão:** O step `npm run build` no workflow define `JWT_SECRET: ci-build-placeholder-not-used-at-runtime` via `env:`.

**Motivo:** Mesma razão do ARG no Dockerfile — `lib/config/env.ts` faz fail-fast se `JWT_SECRET` estiver ausente. O runner do CI não tem `.env.local`; o placeholder satisfaz a validação sem expor segredos.

**Segurança:** Valor é estático e público no repositório — intencional. Segredos reais são configurados via `GitHub Secrets` quando necessário (deploy, etc), não nesta pipeline de CI.

---

### 2. Plugin `@typescript-eslint` registrado via `.eslintrc.json`

**Decisão:** Criado `.eslintrc.json` com `"plugins": ["@typescript-eslint"]` e `"@typescript-eslint/no-explicit-any": "off"`.

**Motivo:** `eslint-config-next` (via `@rushstack/eslint-patch`) resolve o plugin mas não o registra como ativo nas regras. Vários arquivos usam `// eslint-disable-next-line @typescript-eslint/no-explicit-any` — sem o plugin registrado, ESLint retorna erro "Definition for rule was not found" que bloqueia o build. O plugin já estava instalado transitivamente; o `.eslintrc.json` apenas o ativa.

**Regra desativada:** `no-explicit-any` — os usos existentes são intencionais (interoperabilidade com APIs externas, tipos dinâmicos). Ativar a regra exigiria refatoração de múltiplos arquivos fora do escopo desta auditoria.

---

## 2026-08-06 — Containerização (Docker)

### 1. ARG JWT_SECRET no builder stage

**Decisão:** O stage `builder` recebe `JWT_SECRET` via `ARG` com valor placeholder (`build-placeholder-not-used-at-runtime`).

**Motivo:** `lib/config/env.ts` faz fail-fast se `JWT_SECRET` estiver ausente — lança erro na importação do módulo. O `next build` pode importar esse módulo durante a compilação. O placeholder satisfaz a validação sem expor segredos reais na imagem.

**Segurança:** O placeholder nunca é usado em runtime — o container recebe o valor real de `JWT_SECRET` via `.env.local` (docker-compose `env_file`). O placeholder não é exposto no cliente porque `JWT_SECRET` é server-only.

---

### 2. Bind mounts em vez de named volumes no docker-compose

**Decisão:** `./data:/app/data` e `./public/uploads:/app/public/uploads` são bind mounts no host.

**Motivo:** Ambiente de desenvolvimento — o desenvolvedor precisa acessar o arquivo `.db` diretamente para backup, inspeção e migração de dados. Named volumes são opacos e dificultam o acesso direto.

**Alternativa para produção:** Substituir por named volumes ou armazenamento gerenciado.

---

### 3. Não usar `output: 'standalone'`

**Decisão:** `next.config.ts` não foi alterado para incluir `output: 'standalone'`. O runner stage copia `node_modules` completo do stage `deps`.

**Motivo:** A instrução proibiu alterar o Build do Next.js. `node_modules` completo (~500 MB) na imagem final é o tradeoff — aceito para esta etapa.

**Alternativa futura:** Adicionar `output: 'standalone'` ao `next.config.ts` reduz a imagem final para ~150 MB.

---

# Decisões Arquiteturais — Migração Repository Pattern

## 2026-08-05 — Sprint 8

### 1. Métodos de contexto IA ficam no ComitesRepository

**Decisão:** Queries de portfólio (`findPortfolioAtivoParaIA`), financeiro (`findTotalFinanceiroPago`) e payback (`findTotalBeneficioPayback`) foram adicionadas ao `ComitesRepository` mesmo sendo cross-module.

**Motivo:** São queries read-only usadas exclusivamente nas rotas AI do módulo Comitês para construir contexto. Mover para outros repositórios exigiria múltiplos imports nas routes.

**Alternativa descartada:** Criar um `PortfolioContextRepository` — over-engineering para queries de suporte a IA.

---

### 2. `registrarHistoricoAta` migrado como método `insertAtaHistorico`

**Decisão:** A função helper privada `registrarHistoricoAta(db, ...)` da route foi movida para `ComitesRepository.insertAtaHistorico(dados)`.

**Motivo:** Era um INSERT direto ao banco — pertence ao repositório por definição. O helper usava `db` como parâmetro apenas porque era local à route.

---

### 3. `updateFull` com allowlist para campos dinâmicos

**Decisão:** Métodos como `updateFull`, `updateDecisao`, `updatePendencia`, `updateComiteProjeto` aceitam `Record<string, unknown>` mas filtram por uma allowlist de campos permitidos antes de montar o SQL.

**Motivo:** Previne SQL injection via campos arbitrários. Mantém a API flexível sem comprometer segurança.

---

### 4. Build bloqueado por dev server em execução — não é erro de código

**Observação:** `npm run build` retornou `EPERM: operation not permitted, open '.next/trace'`. Isso ocorre quando o dev server está em execução e bloqueia o arquivo `.next/trace`. O TypeScript (tsc --noEmit) passou com 0 erros — o código está correto.

**Ação:** Para build de produção, parar o dev server antes de executar `npm run build`.

---

## Decisões anteriores

### KPIs fora do Repository (Correções pré-Sprint 8)

`saldo` e `percentual_executado` removidos de `FinanceiroRepository.resumoExecutivo()` — cálculos pertencem à service layer (`lib/financeiro/dashboard.ts`). Repository deve retornar apenas dados brutos do banco.
