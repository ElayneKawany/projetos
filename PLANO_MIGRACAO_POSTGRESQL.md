# Plano de Migração — SQLite → PostgreSQL

Detalhamento do item 1 do [Relatório de Conformidade — Padrão IA Champions](#) (2026-09-02): o megag-pmo usa SQLite (`better-sqlite3`), e o padrão oficial exige PostgreSQL. Este documento é só o **plano** — nenhuma alteração de código foi feita. Implementação começa apenas com autorização explícita, por fases, e cada fase é validada antes de avançar para a próxima.

## 1. Por que isso é uma migração grande (não uma troca de driver)

Levantamento real no código, não estimativa:

| Métrica | Valor |
|---|---|
| Tabelas no schema real | **69** — corrigido em 2026-09-02 (ver nota abaixo; a contagem original de 32 vinha só de `lib/db/schema.sql`) |
| Chamadas `db.prepare(...)` (SQL cru, síncrono) | 245, em 55 arquivos |
| Usos de `.lastInsertRowid` | 62 |
| Usos de `db.transaction(...)` | 19 |
| Usos de `datetime('now')` (sintaxe SQLite) | 63 |
| Usos de `INSERT OR IGNORE` / `OR REPLACE` (sintaxe SQLite) | 14 |
| Foreign keys reais | **103** — corrigido em 2026-09-02 (ver nota abaixo; SQLite as declara inline via `coluna REFERENCES tabela(id)`, sem a palavra `FOREIGN KEY`, por isso a varredura original não achou nenhuma) |

> **Correção de escopo (2026-09-02):** a Fase 1 (schema) foi executada e revelou que a contagem inicial estava errada em dois pontos. `lib/db/schema.sql` só define a base original (32 tabelas) — `lib/db/index.ts → runMigrations()` cria **mais 38 tabelas** direto em código (`db.exec('CREATE TABLE IF NOT EXISTS ...')`) mais de 100 `ALTER TABLE ADD COLUMN`, então o banco real tem **69 tabelas**. E as FKs não são zero: `npx drizzle-kit pull` (introspecção contra o banco real) encontrou **103 foreign keys** — elas já existem, só usam a sintaxe inline do SQLite (`coluna INTEGER REFERENCES tabela(id)`), que não contém a palavra `FOREIGN KEY` e por isso não apareceu na varredura textual original. O resto das métricas (245 call sites, 55 arquivos, etc.) segue confirmado.

Três características do SQLite que a aplicação inteira assume hoje, e que mudam com Postgres:

1. **API síncrona → assíncrona.** `better-sqlite3` é síncrono (`.get()`/`.all()`/`.run()` retornam na hora). Qualquer driver Postgres (`pg`, `postgres-js`) é baseado em Promises. Os 245 call sites precisam de `await` — mecanicamente simples (Server Components e API routes do Next.js já são `async`), mas é um `await` por chamada, revisado um a um, não um find-and-replace cego.
2. **Tipos.** SQLite não tem `BOOLEAN` (o projeto usa `INTEGER` com 0/1 pra `ativo`), não tem `JSONB` (usa `TEXT` com JSON serializado manualmente em ~10 colunas, ex. `permissoes`, `riscos`, `marcos`), datas são `TEXT`/`DATETIME` sem timezone. Postgres tem os três nativamente — vale usar os tipos certos na migração, não só replicar `TEXT`.
3. **Geração de ID.** `INTEGER PRIMARY KEY AUTOINCREMENT` (33 ocorrências) + leitura de `lastInsertRowid` depois do insert. Em Postgres o equivalente é `GENERATED ALWAYS AS IDENTITY` + `RETURNING id` — muda a forma de escrever o insert, não só o tipo da coluna.

## 2. Uma frente de trabalho já existe parcialmente — aproveitar, não recomeçar

`lib/database/drizzle.ts` e `lib/db/drizzle/schema.ts` já existem no repositório, com um comentário explícito descrevendo uma migração gradual de SQL cru para Drizzle ORM: `lib/repositories/configuracoes.ts` e `lib/repositories/usuarios.ts` já foram convertidos. Hoje o dialect configurado é `sqlite` (`drizzle-orm/better-sqlite3`), mas o Drizzle suporta Postgres com a mesma API de query builder (`drizzle-orm/node-postgres`) — trocar o dialect nos repositórios **já migrados para Drizzle** é uma mudança pequena; o trabalho real está nos 55 arquivos que ainda fazem `db.prepare()` direto.

**Decisão que isso implica no plano:** usar Drizzle ORM como camada final de acesso a dados (não voltar a escrever SQL cru para Postgres), e tratar a conversão como "terminar a migração para Drizzle que já começou", com Postgres como o dialect de destino desde o início — evita migrar SQLite→Drizzle/SQLite e depois Drizzle/SQLite→Drizzle/Postgres em dois passos.

> **Correção (2026-09-02):** essa "frente já existente" é mais frágil do que parecia. Conferindo quem de fato importa `lib/db/drizzle/schema.ts`, só **2 tabelas estão em uso real** (`usuarios` em `lib/repositories/usuarios.ts`, `configGlobal` em `lib/repositories/configuracoes.ts`) — as outras ~30 definições no arquivo nunca são importadas em lugar nenhum, e pelo menos uma está **errada**: modela uma tabela `viabilidade_versoes` que não existe no banco real (a tabela é `viabilidade`), e modela `aprovacoes` com colunas (`tipo_documento`, `documento_id` NOT NULL) que não batem com as colunas reais (`referencia_id`, `referencia_tipo`, `solicitante_id`). `npx drizzle-kit pull` contra o banco real já gerou a versão correta e completa (69 tabelas) em `lib/db/drizzle/migrations/schema.ts` — mas **trocar o `lib/db/drizzle/schema.ts` live por essa versão quebra a compilação** dos 2 repositórios em uso, porque a introspecção usa nomes de propriedade camelCase (`senhaHash`, `updatedAt`) e o arquivo antigo usava snake_case (`senha_hash`, `updated_at`) direto. Confirmado com `tsc --noEmit`. Por isso a troca do arquivo live foi **deixada para a Fase 2** (que já ia tocar nesses repositórios de qualquer forma) — nesta rodada o schema correto ficou disponível só para revisão, sem substituir o que está em produção.

## 3. Fases

### Fase 0 — Decisões e ambiente (sem tocar em código de produção)

Decisões que precisam de resposta sua antes de eu escrever qualquer coisa:

- **Onde o Postgres vai rodar**: container Docker (mesmo host, adicionar serviço ao `docker-compose.yml` e volume próprio) vs. serviço gerenciado (RDS, Cloud SQL, Azure Database for PostgreSQL) — muda o que entra no Terraform (`infra/*.tf`) e no manual de instalação.
- **Janela de corte**: a aplicação é interna (poucos usuários simultâneos, perfil de uso não é 24/7) — dá pra planejar uma janela de manutenção curta (parar a aplicação, migrar os dados, subir de novo) em vez de dupla-escrita/replicação online, que é bem mais complexa de implementar e validar. Confirmar se esse modelo é aceitável.
- **Ambiente de homologação**: existe algum ambiente de teste separado de produção onde a migração completa pode ser ensaiada antes do corte real? Se não existir, faz parte do plano criar um (mesmo que temporário) — nunca ensaiar pela primeira vez em produção.

Sem ambiente de homologação e sem essas três respostas, não faz sentido eu começar a Fase 1.

### Fase 1 — Modelagem do schema Postgres ✅ concluída em 2026-09-02, aguardando sua revisão

Entregáveis (nenhum aplicado a banco algum ainda — nem teste, nem produção; arquivo `lib/db/drizzle/schema.ts`, o que os repositórios realmente usam, **não foi tocado**):

- `lib/db/drizzle/migrations/schema.ts` — schema SQLite gerado por `npx drizzle-kit pull` direto do banco real (69 tabelas, 892 colunas, 103 FKs, 21 índices) — substitui a suposição por fato; é o schema antigo (`lib/db/drizzle/schema.ts`) que estava errado, não este.
- `scripts/gen-schema-postgres.js` — gerador que lê o snapshot da introspecção (`lib/db/drizzle/migrations/meta/0000_snapshot.json`) e escreve o schema Postgres, com as regras de conversão documentadas no topo do próprio arquivo (não escondidas em código): `AI.TI_PMO_<TABELA>`, `boolean`/`jsonb`/`date` só por lista de override revisada manualmente (não por nome parecido), `timestamp with time zone` por padrão pro resto, IDs como `generatedAlwaysAsIdentity()`, FKs nomeadas em português via `foreignKey()` (as 103 já detectadas pela introspecção — nenhuma inventada).
- `lib/db/drizzle/schema.postgres.ts` — o resultado, gerado (não editar à mão — reeditar as listas no gerador e rodar de novo). Compila limpo (`tsc --noEmit`). Termina com uma seção `REVISAR` (134 colunas classificadas como timestamp só pelo nome, sem estar em nenhuma lista de override — candidatas a `date` que podem ter passado batido).
- `ON DELETE` das FKs: **ainda não decidido** — o gerador não define nenhuma política (fica no padrão `NO ACTION` do Postgres). Fica para quando a Fase 2 tocar cada repositório e puder confirmar tabela a tabela, como já estava previsto aqui.

> **Correção (encontrada testando o 1º repositório migrado, Fase 2 — 2026-09-02):** `npx drizzle-kit pull` captura certo os índices **nomeados** do SQLite, mas **descarta os índices únicos implícitos** que o SQLite cria sozinho pra toda coluna com `UNIQUE` inline (ex. `chave TEXT NOT NULL UNIQUE`) — confirmado batendo o snapshot da introspecção contra `pragma_index_list` do banco real. Isso incluía o `idx_cronogramas_projeto_versao` (a trava contra duplicação de versão do Cronograma, corrigida nesta mesma sessão) só por sorte de já ser um índice nomeado explícito — mas 21 colunas `UNIQUE` inline (`usuarios.cpf`, `usuarios.email`, `projetos.codigo`, `config_global.chave`, etc.) e 3 `UNIQUE(...)` compostos de tabela ficaram de fora do `schema.postgres.ts` original. Corrigido em `scripts/gen-schema-postgres.js` (listas `UNIQUE_COLUMNS`/`UNIQUE_COMPOSITE`, mais emissão de todo `table.indexes` do snapshot) e revalidado: aplicado num Postgres de teste real, `ON CONFLICT` funcionando, 24 constraints únicas + 14 índices nomeados confirmados via `pg_constraint`/`pg_indexes`.

### Fase 2 — Camada de acesso a dados

> **Correção de abordagem (2026-09-02):** a decisão original desta seção ("usar Drizzle ORM como camada final") estava errada. Investigando os repositórios de verdade, descobri que **nenhum dos 245 `db.prepare()` crus está em `lib/repositories/`** — os 9 arquivos ali (`configuracoes.ts`, `tap.ts`, `viabilidade.ts`, `usuarios.ts`, `comites.ts`, `projetos.ts`, `cronograma.ts`, `financeiro.ts`, mais o barrel `index.ts`) já passam por uma abstração pronta pra essa migração, `lib/database/{client.ts, async-client.ts, sqlite.ts, index.ts}`, com um roteiro de 4 passos já documentado em comentário no próprio código. Os repositórios usam SQL parametrizado (`db.queryOne(sql, params)`), não o query builder do Drizzle — então a conversão real é trocar a implementação por trás (`db`→`asyncDb`), não reescrever cada query. Drizzle fica só para schema/migrations (Fase 1). Os 55 arquivos com `db.prepare()` cru (a maioria em `app/api/**/route.ts`, mais ~11 em `lib/*.ts`) continuam fora da abstração — tratamento deles é decisão futura, fora desta fase.

**Primeira fatia concluída (2026-09-02):** prova de conceito ponta a ponta, validada contra um Postgres real (PGlite local, `scripts/dev-postgres-teste.js` — máquina de dev sem Docker/Postgres nativo).

- `lib/database/postgres.ts` (novo) — `PostgresClient implements AsyncDatabaseClient`: `pg.Pool`, tradução `?`/`@nome` → `$1,$2,...`, `RETURNING id` pro `insertedId`, transação via `AsyncLocalStorage` (não uma variável de módulo — isolamento correto entre transações concorrentes, já que `postgresClient` é singleton e o Next.js atende requisições em paralelo).
- `lib/repositories/configuracoes.ts` migrado de `db` (sync) para `asyncDb` (async) — todos os 8 métodos. As 2 tabelas de fato usadas (`config_global`, `config_status_projeto`) tiveram o SQL ajustado pros nomes reais do Postgres (`"AI"."TI_PMO_CONFIG_GLOBAL"` etc. — achado importante: **o SQL dos repositórios precisa referenciar as tabelas com schema/nome novos, não só trocar o driver** — isso vale pra cada repositório futuro também). As 3 outras (`tipos_tarefa`, `criticidades`, `config_financeiro`) são código morto pré-existente (nenhuma chamada em todo o projeto) — não corrigido, fora de escopo.
- `lib/database/index.ts`: `asyncDb` agora aponta pra `postgresClient` (só `configuracoes.ts` usa `asyncDb` hoje, então o impacto ficou isolado).
- Ondulação de `await` propagada e testada: `lib/projetos.ts` (`buscarConfigStatus`, `criarProjeto`) → `app/(dashboard)/projetos/[id]/page.tsx` e `app/api/projetos/route.ts` (POST) — os 2 únicos call sites reais, ambos já dentro de funções `async` (Server Component / API route), mudança trivial.
- Testado contra Postgres real: `findConfigStatusAll`, `findStatusInicial`, `upsert` (insert e update via `ON CONFLICT`), `findByKey`, `findAll` — todos corretos. `tsc --noEmit`, `lint` e `npm run build` limpos.
- `npm install pg @types/pg` (dependência real, produção) e `@electric-sql/pglite`/`@electric-sql/pglite-socket` (devDependencies, só pro Postgres de teste local).

Para as próximas fatias (repositórios restantes): mesmo padrão — trocar `db`→`asyncDb`, ajustar nomes de tabela pro schema Postgres real, propagar `await`, testar contra o Postgres de teste antes de qualquer commit. Ordem sugerida mantida: repositórios menores primeiro, `cronograma.ts` (mais crítico, tem a lógica de Nova Versão corrigida nesta sessão) por último, com testes manuais extras.

### Fase 3 — Tradução de sintaxe SQLite-específica

Lista concreta do que precisa mudar, não genérica:

| SQLite (atual) | Postgres (destino) | Onde |
|---|---|---|
| `datetime('now')` | `now()` / `CURRENT_TIMESTAMP` | 63 ocorrências |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | 14 ocorrências |
| `INSERT OR REPLACE` | `INSERT ... ON CONFLICT DO UPDATE SET ...` | incluída nas 14 |
| `.lastInsertRowid` | `INSERT ... RETURNING id` | 62 ocorrências |
| `PRAGMA foreign_keys = ON` / `= OFF` (usado no cleanup de dados de teste desta sessão) | Postgres sempre valida FK — desabilitar exige `SET CONSTRAINTS ... DEFERRED` dentro de uma transação, não um pragma global | localizar todo uso de `PRAGMA foreign_keys` |
| `journal_mode = WAL` | Não aplicável (Postgres tem seu próprio WAL, não configurável por essa via) | `lib/db/index.ts` |

### Fase 4 — Migração dos dados existentes

- Script único (`scripts/migrar-dados-postgres.js`, roda uma vez), que lê o `data/megag-pmo.db` atual e escreve no Postgres novo, **preservando os IDs exatamente como estão** — os `*_id` já estão referenciados em colunas de histórico, JSON de auditoria (`dados_antes`/`dados_depois`) e em relatórios já gerados; trocar os IDs quebraria rastreabilidade.
- Conversão de tipo por coluna durante a cópia: `0/1` → `true/false`, `TEXT` com JSON → `JSONB` real (parse + reinsert), strings de data → `TIMESTAMPTZ`.
- Backup automático do `.db` antes de rodar (mesmo padrão já usado em `scripts/import-portfolio.js`), e validação pós-carga: contagem de linhas por tabela igual em origem e destino, para cada tabela.
- Ensaiar essa migração de dados no ambiente de homologação (Fase 0) pelo menos uma vez, cronometrando o tempo real, antes de definir a duração da janela de corte em produção.

### Fase 5 — Corte

- Janela de manutenção: parar a aplicação → rodar o script da Fase 4 contra o banco de produção real → trocar `DATABASE_URL` para a connection string Postgres → subir a aplicação apontando para Postgres → smoke test (login, abrir um projeto, ver Cronograma/TAP/Financeiro — mesmo roteiro da seção 8 do `MANUAL_INSTALACAO.md`).
- Manter o `data/megag-pmo.db` original intocado por um período de segurança após o corte (não apagar) — é o plano de rollback caso algo passe despercebido na validação inicial.

### Fase 6 — Infraestrutura e documentação

- `docker-compose.yml`: adicionar serviço `postgres` (ou apontar `DATABASE_URL` para o serviço gerenciado escolhido na Fase 0), com volume próprio para os dados do Postgres.
- `infra/*.tf`: estender o Terraform existente (`infra/main.tf` já provisiona rede/volumes/container via provider Docker) com o recurso de banco escolhido.
- `.env.example`: `DATABASE_URL` passa a documentar uma connection string Postgres (`postgresql://usuario:senha@host:5432/megag_pmo`) em vez de caminho de arquivo.
- Atualizar `MANUAL_INSTALACAO.md`, `DOCKER.md`, `COMO_EXECUTAR.md` e `CLAUDE.md` — todos citam SQLite/`better-sqlite3` hoje como fonte de verdade da arquitetura.

## 4. O que fica fora deste plano

Sem mudança de comportamento de negócio em nenhuma fase — é puramente troca de camada de persistência. Nenhuma regra de status, prazo, capacidade, aprovação etc. muda. `next.config.ts` perde a entrada `better-sqlite3` de `serverExternalPackages` e ganha o driver Postgres equivalente, sem outro impacto de build.

## 5. Ordem de decisão

Esse plano só vira trabalho de código depois de, nessa ordem: (1) resposta às 3 perguntas da Fase 0, (2) revisão do schema da Fase 1 antes de aplicar em qualquer lugar, (3) validação completa do ciclo Fase 2–5 em homologação antes de tocar produção. Nenhum passo pula pra produção sem ter rodado antes em homologação.
