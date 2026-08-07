# Modelo do Banco de Dados

**Arquivo:** `data/megag-pmo.db` (SQLite)
**Schema:** `lib/db/schema.sql` (CREATE TABLE IF NOT EXISTS — idempotente)
**Migrações:** `lib/db/index.ts → runMigrations()` (ALTER TABLE ADD COLUMN — idempotente)

---

## Princípios

- **Nunca deletar registros** — usar `ativo = 0` ou `deleted_at`
- **Preparado para Oracle/PostgreSQL** — sem funções SQLite-específicas no schema base
- **Foreign keys ativas** — `PRAGMA foreign_keys = ON`
- **WAL mode** — `PRAGMA journal_mode = WAL`

---

## Tabelas por Grupo

### Configurações Globais
| Tabela | Descrição |
|---|---|
| `config_global` | Chave-valor de configurações do sistema |
| `config_status_projeto` | Labels e ordem dos status (seed automático) |

### Organização
| Tabela | Descrição |
|---|---|
| `diretorias` | Diretorias da empresa |
| `areas` | Áreas por diretoria |

### Usuários e Acesso
| Tabela | Descrição |
|---|---|
| `perfis` | Perfis com JSON de permissões |
| `usuarios` | Usuários do sistema |
| `sessoes` | Sessões JWT (não usadas ativamente — auth via cookie) |

### Projetos
| Tabela | Descrição |
|---|---|
| `projetos` | Projetos com ciclo de vida completo |
| `projeto_status_historico` | Histórico de transições de status |
| `projeto_prioridade_historico` | Histórico de mudanças de prioridade |
| `projeto_areas` | Áreas participantes do projeto |
| `projeto_historico_alteracoes` | Histórico de alterações por campo (Timeline) |

### TAP
| Tabela | Descrição |
|---|---|
| `tap_versoes` | Versões do TAP com todos os campos |
| `tap_workflow` | Etapas de workflow do TAP |
| `tap_aprovacoes` | Aprovações registradas do TAP |

### Viabilidade
| Tabela | Descrição |
|---|---|
| `viabilidade_versoes` | Versões do Estudo de Viabilidade |
| `viabilidade_workflow` | Etapas de workflow |
| `viabilidade_aprovacoes` | Aprovações registradas |

### Cronograma
| Tabela | Descrição |
|---|---|
| `cronogramas` | Versões do cronograma |
| `cronograma_tarefas` | Tarefas/WBS |
| `cronograma_workflow` | Etapas de workflow |
| `cronograma_aprovacoes` | Aprovações registradas |
| `config_tipos_tarefa` | Tipos de tarefa configuráveis |

### Financeiro
| Tabela | Descrição |
|---|---|
| `financeiro_lancamentos` | Lançamentos avulsos (CAPEX/OPEX) |
| `financeiro_movimentos` | Documentos financeiros (NF, contratos, etc.) |
| `financeiro_contratos` | Contratos com fornecedores |
| `financeiro_pagamentos` | Pagamentos contra contratos |
| `orcamento_grupos` | Grupos de orçamento |
| `orcamento_itens` | Itens de orçamento |

### Comitês
| Tabela | Descrição |
|---|---|
| `comites` | Reuniões de comitê |
| `comite_participantes` | Participantes de cada comitê |
| `comite_decisoes` | Decisões tomadas |
| `comite_pendencias` | Pendências abertas |
| `comite_projetos` | Projetos pautados em cada comitê |
| `comite_ata` | Ata da reunião |
| `comite_ata_historico` | Versões anteriores da ata |

### Workflow e Aprovações
| Tabela | Descrição |
|---|---|
| `aprovacoes` | Fila global de aprovações |
| `aprovacao_etapas` | Etapas individuais de cada aprovação |
| `aprovadores_config` | Aprovadores padrão por tipo |
| `workflow_modelos` | Modelos reutilizáveis de workflow |
| `workflow_modelo_etapas` | Etapas dos modelos |

### Auditoria
| Tabela | Descrição |
|---|---|
| `auditoria` | Log imutável de todas as operações |

---

## Colunas Adicionadas via Migrations (runMigrations)

Colunas notáveis adicionadas após o schema inicial:

| Tabela | Coluna | Tipo | Motivo |
|---|---|---|---|
| `projetos` | `pmo_responsavel_id` | INTEGER | PMO responsável |
| `projetos` | `data_conclusao_real` | DATE | Conclusão efetiva |
| `projetos` | `motivo_pausa_id` | INTEGER | Rastreamento de pausas |
| `financeiro_pagamentos` | `contrato_id` | INTEGER | Link com novo módulo de contratos |
| `financeiro_pagamentos` | `numero_documento` | TEXT | Identificação do documento |
| `financeiro_pagamentos` | `tipo_documento` | TEXT | Tipo (NF, Comprovante, etc.) |
| `financeiro_pagamentos` | `ativo` | INTEGER | Soft-delete |
| `financeiro_contratos` | (tabela inteira) | — | Criada via `CREATE TABLE IF NOT EXISTS` em migration |

---

## Notas de Compatibilidade com PostgreSQL

Riscos de migração identificados (auditoria Item 4):

| Risco | Severidade | Ocorrências |
|---|---|---|
| API síncrona (better-sqlite3) | 🔴 Alto | Toda a aplicação |
| `.lastInsertRowid` | 🔴 Alto | 35+ locais |
| Named params `@param` | 🔴 Alto | 30+ locais |
| `julianday()` | 🔴 Alto | 2 locais |
| `datetime('now')` / `date('now')` | 🟡 Médio | ~50 locais |
| `INSERT OR IGNORE` | 🟡 Médio | ~12 locais |
| `AUTOINCREMENT` | 🟡 Médio | 60 tabelas |
| `PRAGMA` | 🟢 Baixo | 4 locais |
