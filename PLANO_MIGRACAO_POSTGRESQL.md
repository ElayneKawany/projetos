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

**Segunda fatia concluída (2026-09-02): `tap_versoes` migrada por completo, não só o arquivo do repositório.**

Migrar só `lib/repositories/tap.ts` teria deixado a tabela dividida: achei 4 outros arquivos que liam/escreviam `tap_versoes` direto — `lib/artefatos.ts`, `lib/repositories/projetos.ts` (2 métodos simples + 2 queries complexas), `lib/payback.ts` (2 funções), `lib/repositories/comites.ts` (1 método). Todos migrados nesta fatia — ver tabela de escopo e desenho completo no histórico do plano de trabalho desta sessão. Pontos que valem registrar para as próximas fatias:

- **Transação cruzando dois bancos não existe.** `lib/artefatos.ts → submeterArtefato()` fazia um `UPDATE tap_versoes` dentro da mesma transação SQLite que grava Viabilidade/Cronograma (função genérica pros 3 artefatos). Como `tap_versoes` já está em Postgres, o UPDATE desse caso saiu da transação SQLite e roda depois dela confirmar — se o Postgres falhar depois, o erro sobe pro caller em vez de mascarar um efeito colateral não registrado. Padrão a repetir sempre que uma função escrever em tabelas dos dois bancos na mesma "transação lógica".
- **JOIN/subquery correlacionada entre bancos não existe.** Três consultas (`findAllComplexo` — listagem de projetos, `fetchDashboard` — `roiPorDir`, `findPortfolioAtivoParaIA` — Resumo Executivo IA) faziam JOIN/EXISTS/subquery direto contra `tap_versoes` dentro de uma query maior sobre `projetos` (SQLite). Reescritas como: query SQLite sem o trecho de `tap_versoes` → busca em lote no Postgres (3 métodos novos em `TapRepository`: `findRascunhoIds`, `findRoiPrevistoTodos`, `findLatestRoiPrevistoPorProjetos`) → merge em JS. Nenhuma paginação/filtro/ordenação existente mudou.
- **Bug real encontrado e corrigido**: `node-postgres` devolve colunas `NUMERIC` como `string`, não `number` (evita perda de precisão arbitrária) — sem tratar isso, `soma += roi_previsto` virava concatenação de string e o ROI médio por diretoria no dashboard dava `NaN`. Corrigido globalmente em `lib/database/postgres.ts` com `pg.types.setTypeParser(1700, parseFloat)` — vale para toda coluna `numeric` migrada daqui pra frente, não só `roi_previsto`.
- **Bug pré-existente encontrado, não corrigido (fora de escopo)**: `ComitesRepository.findPortfolioAtivoParaIA()` já selecionava `p.responsavel_nome, p.gestor_nome` — colunas que **não existem** em `projetos` (nem em `schema.sql`, nem em `runMigrations()`). A função já quebrava com "no such column" antes desta migração, independente do Postgres. Não mexi nisso — quem usar o Resumo Executivo IA vai precisar desse fix à parte.
- Também removida 1 query morta (`buscarResumoPayback` fazia um `SELECT` em `tap_versoes` cujo resultado nunca era lido, só `void tap` pra silenciar o linter) — não migrada, eliminada.

Testado de ponta a ponta contra Postgres real (PGlite): `findRascunhoIds`, `findRoiPrevistoTodos`, `findLatestRoiPrevistoPorProjetos`, `findTapAprovado`, `findAllComplexo` (com um caso real de revisão pendente de TAP), `fetchDashboard` (payback médio e ROI por diretoria batendo com o cálculo manual), `submeterArtefato` (status muda em Postgres só depois da transação SQLite confirmar). `tsc`, `lint` e `npm run build` limpos.

**Bloqueio de ambiente corrigido (2026-09-02, commit `c89fc71`):** `PG_DATABASE_URL` é obrigatória sem fallback (decisão explícita) — isso quebrava `npm run dev` local sem um Postgres real no ar. `scripts/dev-postgres-teste.js` passou a persistir em disco (`data/pglite-dev/`, ignorado pelo git) em vez de rodar só em memória, e `.env.local`/`.env.example` documentam `PG_DATABASE_URL` apontando pra ele. Esse Postgres de dev precisa estar rodando sempre que o app rodar localmente.

**Terceira fatia concluída (2026-09-03): `viabilidade` migrada por completo — escopo maior que `tap_versoes` (11 arquivos externos, não 4).**

Achado que se repetiu e generalizou: `lib/repositories/financeiro.ts` tinha 6 métodos acessando `viabilidade` **por um caminho totalmente separado** do `ViabilidadeRepository` (`findViabilidadeRascunho`, `maxVersaoViabilidade`, `updateViabilidade`, `insertViabilidade`, `resumoExecutivo`, `findViabilidadeCapexOpex`) — mesma tabela, dois donos diferentes no código. Migrados os dois.

- **`submeterArtefato()`** — mesmo padrão da fatia anterior, agora excluindo `'tap_versoes'` E `'viabilidade'` da transação SQLite (Cronograma é o único artefato que ainda fica só em SQLite).
- **2 casos de transação mista com dependência de dado** (mais delicados que o simples "status muda depois"): `viabilidade/[vid]/nova-versao/route.ts` fazia `insertCopia` (agora Postgres) **dentro** de uma transação SQLite que também copiava `orcamento_grupos`/`orcamento_itens` usando o id recém-criado — reordenado pra Postgres primeiro (fora da transação), SQLite depois, usando o id já resolvido. `tap/[tapId]/revisao/route.ts` tinha o mesmo problema com o cancelamento em cascata de Viabilidades ativas quando uma TAP volta pra revisão — separado em: leitura antes da transação, efeitos SQLite dentro, `updateStatus` (Postgres) depois.
- **3 queries difíceis** (mesmo padrão de merge em JS já usado com `tap_versoes`): `findAllComplexo` (ramo VIABILIDADE do `tem_revisao_pendente`, generalizado pra cobrir TAP+VIABILIDADE juntos numa única leitura de `aprovacoes`), `fetchDashboard→investimentoTotal` (`LEFT JOIN` correlacionado virou busca em lote + soma em JS), `lib/meu-trabalho.ts→buscarMeusDocumentos` (sem nenhum caller hoje — tratado com menos rigor; achei de brinde outro bug pré-existente não relacionado: o bloco de TAP dessa função referencia uma tabela `tap` que não existe, deveria ser `tap_versoes` — não corrigido, fora de escopo).
- 2 novos métodos em `ViabilidadeRepository`: `findRascunhoIds`, `findLatestAprovadoCapexOpexPorProjetos` (mesmo padrão dos equivalentes em `TapRepository`).
- Removida mais 1 query morta (`buscarResumoPayback` também tinha um `SELECT` em `viabilidade` cujo resultado nunca era lido).
- **Risco real evitado, não introduzido pela migração**: `app/api/projetos/[id]/financeiro/contratos/route.ts` juntava 4 chamadas (2 recém-async) num array literal comum em vez de `Promise.all` — o TypeScript não acusa isso (o body do `NextResponse.json` aceita qualquer tipo), teria serializado `Promise` como JSON silenciosamente em produção. Corrigido para `Promise.all`. **Lição pra próximas fatias**: `tsc` limpo não é prova suficiente depois de converter uma função pra `async` — greppar manualmente por `if (fn(...))` e `[fn1(), fn2()]` sem `Promise.all` em volta das funções tocadas, não confiar só no compilador.

Testado de ponta a ponta contra o Postgres de dev persistente: `findRascunhoIds`, `findLatestAprovadoCapexOpexPorProjetos`, `findAllComplexo` (revisão pendente de Viabilidade), `fetchDashboard` (investimento total batendo com soma manual), `submeterArtefato` tipo VIABILIDADE. `tsc`, `lint` e `npm run build` limpos.

**Quarta fatia concluída (2026-09-03): `usuarios` migrada por completo — a maior até agora, escopo real de 77 arquivos (não os ~19 estimados na investigação inicial).**

Decisão do usuário: fazer tudo numa fatia só (repositório + login + todos os pontos de exibição de nome), em vez de separar "core" de "JOINs de exibição" — mesmo raciocínio das fatias anteriores (deixar JOINs pra trás cria divergência silenciosa), mas aqui o risco extra é que `usuarios` alimenta o próprio login.

- **Achado de método, não só de escopo**: a investigação inicial (grep em repositórios + rotas de API) encontrou ~19 arquivos. Durante a execução, um grep amplo por `usuarios` em **todo** o projeto (incluindo `app/(dashboard)/**/page.tsx`, os Server Components que buscam dados direto do banco — ver `CLAUDE.md`, seção "Page / API pattern") revelou **9 páginas inteiras** fazendo `db.prepare()` cru contra `usuarios` que a varredura original não pegou. Essas mesmas 9 páginas nunca tinham sido checadas nas fatias 2 e 3 também (ver achado abaixo). **Lição de método para qualquer fatia futura**: sempre incluir `app/(dashboard)/**/page.tsx` na varredura de "quem toca essa tabela" — não só repositórios e `app/api/**/route.ts`.
- **Bug novo de tipo, gravado aqui pela primeira vez**: SQLite representa boolean como `INTEGER` (0/1); o schema Postgres gerado (Fase 1) usa `boolean` nativo pra toda coluna `ativo`. Um literal `WHERE ativo = 1` embutido direto no texto do SQL (não como parâmetro `?`) quebra em Postgres com `operator does not exist: boolean = integer` — o parser já fixa o tipo do literal `1` como `integer` antes de saber que vai comparar com uma coluna `boolean`. Achado rodando o smoke test de login (ver abaixo), não pelo `tsc` nem pelo lint — nenhum dos dois pega isso. Encontrado e corrigido em ~25 ocorrências, espalhadas por `lib/repositories/usuarios.ts`, `lib/repositories/cronograma.ts`, `lib/notificacoes.ts` e 8 rotas/páginas. **Regra nova para as próximas fatias**: em toda tabela cuja coluna `ativo` (ou qualquer outra boolean) vá pra Postgres, usar `ativo = true`/`ativo = false` explicitamente no SQL — nunca `1`/`0` literais — e testar com uma chamada real, não só compilar.
- **Dados reais precisaram ser copiados — diferente das fatias anteriores.** Em `tap_versoes`/`viabilidade`, o Postgres de teste só precisava de algumas linhas sintéticas pra satisfazer FK. Aqui não: `usuarios` é a tabela de login, e testar de verdade exige os usuários reais. O Postgres de dev só tinha 3 linhas (sobra de seed de FK das fatias 2/3); o SQLite real tem 25. Escrito `scripts/migrar-usuarios-postgres.ts` (idempotente, `ON CONFLICT DO UPDATE`) que copia `perfis`→`diretorias`→`areas`→`usuarios` nessa ordem (as três primeiras só existem em Postgres pra satisfazer as FKs de `usuarios`, que a introspecção da Fase 1 já tinha gerado). **Rodar esse script é pré-requisito em qualquer ambiente** (dev de outro desenvolvedor, homologação, produção) antes de usar o código desta fatia — sem isso, login e toda tela que resolve nome de usuário só enxergam quem já estiver em Postgres.
- **Helper único, pra não repetir o merge em JS ~50 vezes**: `UsuariosRepository.findNomesPorIds(ids): Promise<Map<number, {nome, cargo}>>` — usado tanto dentro do próprio repositório (`findAll`, `findAllWithPerfil`, `findAprovadores`) quanto por todo arquivo externo. Mesma ideia dos `findRascunhoIds`/`findLatestAprovadoCapexOpexPorProjetos` das fatias 2/3, generalizada.
- **3 métodos usavam Drizzle (SQLite dialect) direto** (`create`, `updateSenha`, `softDelete`) em vez de `db.prepare()` — reescritos como SQL parametrizado via `asyncDb`, mesmo padrão do resto do repositório (decisão já tomada na Fase 2: Drizzle só pra schema, não como camada de query em Postgres).
- **Código morto convertido com menos rigor** (sem caller real, confirmado via grep): `UsuariosRepository.findAll/findById/findByCpf/findByEmail/create/update/updateSenha/softDelete`, `ProjetosRepository.findAll` (base), `indicadoresCronograma` (`lib/meu-trabalho.ts`), `lib/permissoes.ts→buscarProjetosVisiveis`, o bloco de TAP em `buscarMeusDocumentos` (mesmo bug pré-existente da fatia 3, `FROM tap` em vez de `tap_versoes` — continua não corrigido, fora de escopo).
- **Paralelizado em 3 agentes em background** (sem sobreposição de arquivo): um para `lib/repositories/cronograma.ts` (8 métodos, ~29 call sites em `app/api/projetos/[id]/cronograma/**`), um para `comites.ts`/`financeiro.ts`/`auditoria.ts`/`orcamento.ts`/`notificacoes.ts` e seus 14 call sites, um para 9 rotas de API isoladas (`aprovacoes`, `financeiro`, `payback/dados`, `configuracoes/{areas,cronograma,diretorias}`, `visao-geral`, `permissoes.ts`). A sessão principal tratou `usuarios.ts`, `auth.ts`, `projetos.ts` (repositório + `lib/projetos.ts`), `meu-trabalho.ts` e as 9 páginas Server Component.
- **Achado sério, fora do escopo desta fatia, não corrigido — reportado para decisão separada**: `app/(dashboard)/aprovacoes/page.tsx`, `app/(dashboard)/comites/[id]/page.tsx` e `app/(dashboard)/projetos/[id]/page.tsx` fazem `FROM tap_versoes`/`FROM viabilidade` direto no SQLite — a mesma lacuna de método que gerou o achado de página acima, só que nas fatias 2 e 3. Como essas tabelas já migraram pra Postgres, essas 3 páginas mostram uma cópia **congelada** desde então (TAP/Viabilidade criadas ou atualizadas depois da migração não aparecem ali) — dado errado numa tela real, não um risco teórico. Não corrigido aqui porque é sobre `tap_versoes`/`viabilidade`, não `usuarios`; recomendo tratar como uma fatia de correção dedicada, com prioridade alta.

Testado de ponta a ponta contra o Postgres de dev persistente (depois do backfill de dados reais): `findByCpfForLogin` + `login()` (senha errada rejeitada sem exceção — não deu pra testar senha certa sem saber um hash real, mas o caminho todo executa sem erro), `findAllWithPerfil` (25 usuários, nomes/perfil/diretoria corretos), `findNomesPorIds`, `ProjetosRepository.findById`/`findByIdComplexo` (gerente/solicitante/PMO responsável resolvidos corretamente). `tsc --noEmit` e `npm run lint` limpos no repositório inteiro (77 arquivos alterados).

**Correção do achado acima (2026-09-03): as 3 páginas com `tap_versoes`/`viabilidade` congeladas foram corrigidas.**

`app/(dashboard)/aprovacoes/page.tsx`, `app/(dashboard)/comites/[id]/page.tsx` e `app/(dashboard)/projetos/[id]/page.tsx` passaram a buscar TAP/Viabilidade via `TapRepository`/`ViabilidadeRepository` (Postgres), não mais via `db.prepare()` contra a cópia congelada em SQLite.

- 2 métodos novos, reaproveitáveis (mesmo padrão dos `findRascunhoIds`/`findLatestAprovadoCapexOpexPorProjetos` já existentes): `findLatestPorProjetos(ids)` — `DISTINCT ON (projeto_id) ... ORDER BY projeto_id, versao DESC`, a versão mais recente **de qualquer status** por projeto (as telas de portfólio do Comitê precisam do TAP/Viabilidade mais recente independente de aprovação, diferente do `findLatestAprovadoCapexOpexPorProjetos` que já existia e só olha `APROVADO`) — e `findByIds(ids)`, busca direta por id exato (usado onde já se tem a `referencia_id`, como a tela de Aprovações). Adicionados em `TapRepository` e `ViabilidadeRepository`.
- `TapVersao` (interface) ganhou 2 campos que já existiam na tabela real mas não estavam modelados: `roi_previsto`, `data_limite_tap`.
- `app/(dashboard)/comites/[id]/page.tsx` tinha **4 queries diferentes** com subconsultas correlacionadas contra `tap_versoes`/`viabilidade` (`todosProjetos`, e as 3 telas de "Detalhe" por status de portfólio — Viabilidade, Proposta, Execução). Como `todosProjetos` já busca todo projeto ativo (sem filtro de status) e as outras 3 são subconjuntos por status, bastou **uma chamada** de `findLatestPorProjetos` para TAP e outra para Viabilidade (com a lista de ids de `todosProjetos`), reaproveitada nas 4 — em vez de repetir a busca em Postgres 4 vezes.
- `app/(dashboard)/projetos/[id]/page.tsx`: trocado por `TapRepository.findAllByProjectId`/`ViabilidadeRepository.findLatestByProjectId`, que já existiam e já tinham o merge de `aprovador_nome` — só faltava `criador_nome` (usuario), adicionado em JS como de costume.
- `app/(dashboard)/aprovacoes/page.tsx`: o `.map()` por linha de workflow fazia uma consulta síncrona por linha (N+1, já pré-existente); virou uma busca em lote (`findByIds`) antes do loop, motivo a mais além de só trocar SQLite por Postgres.

Testado contra o Postgres de dev persistente: `findAllByProjectId`, `findLatestByProjectId`, `findLatestPorProjetos`, `findByIds` — todos retornando dados reais (ROI, payback, capex/opex) em vez da cópia congelada. `tsc --noEmit` e `npm run lint` limpos.

Para as próximas fatias (repositórios restantes — nenhuma tabela de `comites.ts`/`cronograma.ts`/`financeiro.ts` foi migrada de fato nesta fatia, só os JOINs delas com `usuarios` foram corrigidos): mesmo padrão — trocar `db`→`asyncDb`, ajustar nomes de tabela pro schema Postgres real, checar se a tabela é tocada por outros arquivos fora do repositório **e por outros repositórios**, **e por `app/(dashboard)/**/page.tsx`** (lição desta fatia), propagar `await`, conferir manualmente arrays/`if` sem `await` (tsc não pega), usar `= true`/`= false` explícito em toda coluna boolean (tsc também não pega isso), copiar/backfillar dados reais se a tabela alimentar login ou outra tela crítica de teste, testar contra o Postgres de dev antes de qualquer commit.

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
