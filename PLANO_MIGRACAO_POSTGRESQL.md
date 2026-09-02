# Plano de Migração — SQLite → PostgreSQL

Detalhamento do item 1 do [Relatório de Conformidade — Padrão IA Champions](#) (2026-09-02): o megag-pmo usa SQLite (`better-sqlite3`), e o padrão oficial exige PostgreSQL. Este documento é só o **plano** — nenhuma alteração de código foi feita. Implementação começa apenas com autorização explícita, por fases, e cada fase é validada antes de avançar para a próxima.

## 1. Por que isso é uma migração grande (não uma troca de driver)

Levantamento real no código, não estimativa:

| Métrica | Valor |
|---|---|
| Tabelas no schema atual | 32 (`lib/db/schema.sql`) |
| Chamadas `db.prepare(...)` (SQL cru, síncrono) | 245, em 55 arquivos |
| Usos de `.lastInsertRowid` | 62 |
| Usos de `db.transaction(...)` | 19 |
| Usos de `datetime('now')` (sintaxe SQLite) | 63 |
| Usos de `INSERT OR IGNORE` / `OR REPLACE` (sintaxe SQLite) | 14 |
| `FOREIGN KEY` declaradas no schema | 0 — relacionamento hoje é só convenção de nome de coluna |

Três características do SQLite que a aplicação inteira assume hoje, e que mudam com Postgres:

1. **API síncrona → assíncrona.** `better-sqlite3` é síncrono (`.get()`/`.all()`/`.run()` retornam na hora). Qualquer driver Postgres (`pg`, `postgres-js`) é baseado em Promises. Os 245 call sites precisam de `await` — mecanicamente simples (Server Components e API routes do Next.js já são `async`), mas é um `await` por chamada, revisado um a um, não um find-and-replace cego.
2. **Tipos.** SQLite não tem `BOOLEAN` (o projeto usa `INTEGER` com 0/1 pra `ativo`), não tem `JSONB` (usa `TEXT` com JSON serializado manualmente em ~10 colunas, ex. `permissoes`, `riscos`, `marcos`), datas são `TEXT`/`DATETIME` sem timezone. Postgres tem os três nativamente — vale usar os tipos certos na migração, não só replicar `TEXT`.
3. **Geração de ID.** `INTEGER PRIMARY KEY AUTOINCREMENT` (33 ocorrências) + leitura de `lastInsertRowid` depois do insert. Em Postgres o equivalente é `GENERATED ALWAYS AS IDENTITY` + `RETURNING id` — muda a forma de escrever o insert, não só o tipo da coluna.

## 2. Uma frente de trabalho já existe parcialmente — aproveitar, não recomeçar

`lib/database/drizzle.ts` e `lib/db/drizzle/schema.ts` já existem no repositório, com um comentário explícito descrevendo uma migração gradual de SQL cru para Drizzle ORM: `lib/repositories/configuracoes.ts` e `lib/repositories/usuarios.ts` já foram convertidos. Hoje o dialect configurado é `sqlite` (`drizzle-orm/better-sqlite3`), mas o Drizzle suporta Postgres com a mesma API de query builder (`drizzle-orm/node-postgres`) — trocar o dialect nos repositórios **já migrados para Drizzle** é uma mudança pequena; o trabalho real está nos 55 arquivos que ainda fazem `db.prepare()` direto.

**Decisão que isso implica no plano:** usar Drizzle ORM como camada final de acesso a dados (não voltar a escrever SQL cru para Postgres), e tratar a conversão como "terminar a migração para Drizzle que já começou", com Postgres como o dialect de destino desde o início — evita migrar SQLite→Drizzle/SQLite e depois Drizzle/SQLite→Drizzle/Postgres em dois passos.

## 3. Fases

### Fase 0 — Decisões e ambiente (sem tocar em código de produção)

Decisões que precisam de resposta sua antes de eu escrever qualquer coisa:

- **Onde o Postgres vai rodar**: container Docker (mesmo host, adicionar serviço ao `docker-compose.yml` e volume próprio) vs. serviço gerenciado (RDS, Cloud SQL, Azure Database for PostgreSQL) — muda o que entra no Terraform (`infra/*.tf`) e no manual de instalação.
- **Janela de corte**: a aplicação é interna (poucos usuários simultâneos, perfil de uso não é 24/7) — dá pra planejar uma janela de manutenção curta (parar a aplicação, migrar os dados, subir de novo) em vez de dupla-escrita/replicação online, que é bem mais complexa de implementar e validar. Confirmar se esse modelo é aceitável.
- **Ambiente de homologação**: existe algum ambiente de teste separado de produção onde a migração completa pode ser ensaiada antes do corte real? Se não existir, faz parte do plano criar um (mesmo que temporário) — nunca ensaiar pela primeira vez em produção.

Sem ambiente de homologação e sem essas três respostas, não faz sentido eu começar a Fase 1.

### Fase 1 — Modelagem do schema Postgres

- Criar `AI.TI_PMO_<TABELA>` para as 32 tabelas (prefixo confirmado na auditoria), com:
  - `ativo` como `BOOLEAN` em vez de `INTEGER`.
  - `permissoes`, `riscos`, `impactos`, `marcos`, `entregas`, `areas_impactadas`, `receitas_previstas`, `custos_previstos`, `economia_prevista` (colunas hoje `TEXT` com JSON serializado — 10 colunas identificadas) como `JSONB`.
  - Datas/timestamps como `TIMESTAMPTZ` (não `TEXT`).
  - IDs como `GENERATED ALWAYS AS IDENTITY`.
  - `FOREIGN KEY` reais e nomeadas em português (ex. `fk_cronograma_tarefas_projeto`) para toda coluna `*_id` que hoje só existe por convenção — junto disso, decidir explicitamente `ON DELETE` de cada uma (o projeto nunca apaga linha, só usa `ativo`/`deleted_at` — então provavelmente `ON DELETE RESTRICT` em tudo, mas isso precisa ser conferido tabela a tabela, não presumido).
- Escrever esse schema como schema Drizzle (`lib/db/drizzle/schema.ts`, dialect Postgres) — vira a fonte da verdade, e o Drizzle Kit gera as migrations formais a partir dele (resolve também o item "ORM/Migrations = Não conforme" do relatório).
- Revisar com você antes de aplicar em qualquer banco real — esse é o desenho que fica definitivo.

### Fase 2 — Camada de acesso a dados

- Trocar `drizzle-orm/better-sqlite3` → `drizzle-orm/node-postgres` (ou `postgres-js`) em `lib/database/drizzle.ts`.
- Migrar os 55 arquivos com `db.prepare()` cru para o query builder do Drizzle, um repositório por vez (não tudo de uma vez — cada arquivo migrado é testável isoladamente). Ordem sugerida: começar pelos repositórios menores/menos críticos (ex. `lib/repositories/cronograma.ts` só depois de validar o padrão em 2-3 arquivos simples), guardando `CronogramaRepository` (peça central desta sessão, com a lógica de Nova Versão já corrigida) para o fim, com testes manuais extras.
- Cada `await` novo precisa ser conferido: função que chama esse repositório também precisa virar/já ser `async`, e cada `catch`/tratamento de erro precisa ser revisado (driver Postgres lança erros com formato diferente do SQLite — ex. `SQLITE_CONSTRAINT` vira `23505`/`23503`, códigos usados hoje em pelo menos duas rotas desta sessão, como o guard de `UNIQUE constraint failed` no `nova-versao/route.ts`).

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
