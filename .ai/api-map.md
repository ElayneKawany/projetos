# Mapa das APIs

Todos os endpoints estão sob `app/api/`. Autenticação via cookie `megag_pmo_session` (JWT).

---

## Autenticação

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Login — gera JWT |
| POST | `/api/auth/logout` | Autenticado | Logout — remove cookie (redireciona 302) |

---

## Usuários

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/usuarios` | PMO+ | Listar usuários |
| POST | `/api/usuarios` | ADMIN | Criar usuário |
| PATCH | `/api/usuarios/{id}` | ADMIN | Atualizar usuário |
| DELETE | `/api/usuarios/{id}` | ADMIN | Hard delete usuário |

---

## Aprovações

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/aprovacoes` | Autenticado | Aprovações pendentes do usuário |
| GET | `/api/aprovacoes/{id}` | Autenticado | Detalhe de uma aprovação |
| PATCH | `/api/aprovacoes/{id}` | Autenticado | Registrar decisão (APROVADO/REJEITADO) |
| GET | `/api/aprovadores` | PMO+ | Listar aprovadores padrão |
| POST | `/api/aprovadores` | PMO+ | Adicionar aprovador padrão |
| DELETE | `/api/aprovadores?id=N` | PMO+ | Remover aprovador padrão |

---

## Workflow

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/workflow/modelos` | PMO+ | Listar modelos de workflow |
| POST | `/api/workflow/modelos` | PMO+ | Criar modelo |
| PATCH | `/api/workflow/modelos/{id}` | PMO+ | Atualizar/inativar modelo |

---

## Projetos

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/projetos` | Autenticado | Listar projetos |
| POST | `/api/projetos` | GESTOR+ | Criar projeto |
| GET | `/api/projetos/{id}` | Autenticado | Detalhe do projeto |
| PATCH | `/api/projetos/{id}` | GESTOR+ | Atualizar projeto |
| GET | `/api/projetos/{id}/dashboard` | Autenticado | Dashboard do projeto |
| PATCH | `/api/projetos/{id}/visao-geral` | GESTOR+ | Atualizar visão geral |
| POST | `/api/projetos/{id}/concluir` | GESTOR+ | Marcar projeto concluído |
| POST | `/api/projetos/{id}/encerrar` | PMO+ | Encerrar projeto |

---

## TAP

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/projetos/{id}/tap/{tapId}` | Autenticado | Buscar TAP |
| PATCH | `/api/projetos/{id}/tap/{tapId}` | GESTOR+ | Atualizar TAP |
| POST | `/api/projetos/{id}/tap/{tapId}/submeter` | PMO+ | Submeter para aprovação |
| POST | `/api/projetos/{id}/tap/{tapId}/aprovar` | Aprovador | Aprovar TAP |
| POST | `/api/projetos/{id}/tap/{tapId}/revisao` | Aprovador | Solicitar revisão |
| POST | `/api/projetos/{id}/tap/{tapId}/nova-versao` | PMO+ | Criar nova versão |
| GET | `/api/projetos/{id}/tap/{tapId}/exportar-modelo` | Autenticado | Download template Word |
| POST | `/api/projetos/{id}/tap/{tapId}/importar` | PMO+ | Importar de Word |

---

## Viabilidade

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/projetos/{id}/viabilidade/{vid}` | Autenticado | Buscar Estudo de Viabilidade |
| PATCH | `/api/projetos/{id}/viabilidade/{vid}` | GESTOR+ | Atualizar |
| POST | `/api/projetos/{id}/viabilidade/{vid}/submeter` | PMO+ | Submeter |
| POST | `/api/projetos/{id}/viabilidade/{vid}/aprovar` | Aprovador | Aprovar |
| POST | `/api/projetos/{id}/viabilidade/{vid}/revisao` | Aprovador | Revisão |
| POST | `/api/projetos/{id}/viabilidade/{vid}/nova-versao` | PMO+ | Nova versão |
| GET | `/api/projetos/{id}/viabilidade/{vid}/exportar-modelo` | Autenticado | Download template |
| POST | `/api/projetos/{id}/viabilidade/{vid}/importar` | PMO+ | Importar |

---

## Cronograma

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/projetos/{id}/cronograma` | Autenticado | Buscar cronograma |
| POST | `/api/projetos/{id}/cronograma` | PMO+ | Criar/importar cronograma |
| GET | `/api/projetos/{id}/cronograma/exportar` | Autenticado | Download xlsx |
| GET | `/api/projetos/{id}/cronograma/modelo` | Autenticado | Download template xlsx |
| PUT | `/api/projetos/{id}/cronograma/{cronId}/tarefas` | PMO+ | Salvar WBS completa |
| POST | `/api/projetos/{id}/cronograma/{cronId}/nova-atividade` | GESTOR+ | Adicionar atividade |
| POST | `/api/projetos/{id}/cronograma/{cronId}/submeter` | PMO+ | Submeter |
| POST | `/api/projetos/{id}/cronograma/{cronId}/aprovar` | Aprovador | Aprovar |
| POST | `/api/projetos/{id}/cronograma/{cronId}/revisao` | Aprovador | Revisão |
| POST | `/api/projetos/{id}/cronograma/{cronId}/nova-versao` | PMO+ | Nova versão |
| POST | `/api/projetos/{id}/cronograma/{cronId}/gerar-subtarefas` | PMO+ | IA gera subtarefas |
| POST | `/api/projetos/{id}/cronograma/{cronId}/tarefas/{tId}/concluir` | GESTOR+ | Concluir tarefa |

---

## Financeiro

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/financeiro` | Autenticado | Lançamentos globais do portfolio |
| GET | `/api/projetos/{id}/financeiro` | Autenticado | Dashboard financeiro do projeto |
| POST | `/api/projetos/{id}/financeiro` | GESTOR+ | Lançamento avulso |
| GET | `/api/projetos/{id}/financeiro/movimentos` | Autenticado | Listar movimentos |
| POST | `/api/projetos/{id}/financeiro/movimentos` | GESTOR+ | Criar movimento |
| PATCH | `/api/projetos/{id}/financeiro/movimentos` | DIRETOR+ | Atualizar status movimento |
| GET | `/api/projetos/{id}/financeiro/contratos` | Autenticado | Listar contratos |
| POST | `/api/projetos/{id}/financeiro/contratos` | GESTOR+ | Criar contrato |
| GET | `/api/projetos/{id}/financeiro/contratos/exportar` | Autenticado | Export xlsx |
| POST | `/api/projetos/{id}/financeiro/contratos/importar` | GESTOR+ | Import xlsx |
| PATCH | `/api/projetos/{id}/financeiro/contratos/{contId}` | GESTOR+ | Atualizar contrato |
| DELETE | `/api/projetos/{id}/financeiro/contratos/{contId}` | GESTOR+ | Soft-delete contrato |
| POST | `/api/projetos/{id}/financeiro/contratos/{contId}/pagamentos` | GESTOR+ | Criar pagamento |
| PATCH | `/api/projetos/{id}/financeiro/contratos/{contId}/pagamentos/{pagId}` | GESTOR+ | Atualizar pagamento |
| DELETE | `/api/projetos/{id}/financeiro/contratos/{contId}/pagamentos/{pagId}` | GESTOR+ | Soft-delete pagamento |

---

## Orçamento

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/projetos/{id}/orcamento` | Autenticado | Grupos e itens do orçamento |
| POST | `/api/projetos/{id}/orcamento` | GESTOR+ | Criar grupo |
| POST | `/api/projetos/{id}/orcamento/grupos/{grupoId}/itens` | GESTOR+ | Criar item |
| PATCH | `/api/projetos/{id}/orcamento/grupos/{grupoId}/itens` | GESTOR+ | Atualizar item |
| DELETE | `/api/projetos/{id}/orcamento/grupos/{grupoId}/itens?itemId=N` | PMO+ | Deletar item ou grupo |

---

## Configurações

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET/POST | `/api/configuracoes/tipos-tarefa` | PMO+ | Tipos de tarefa do cronograma |
| PATCH | `/api/configuracoes/tipos-tarefa/{id}` | PMO+ | Atualizar tipo |
| GET/PATCH | `/api/configuracoes/cronograma` | PMO+ | Configurações globais do cronograma |
| PATCH | `/api/configuracoes/financeiro` | PMO+ | Premissas SELIC/taxa_desconto/inflação |

---

## Dashboard e Comitês

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/dashboard` | Autenticado | KPIs executivos do portfolio |
| GET | `/api/comites` | Autenticado | Listar comitês |
| POST | `/api/comites` | PMO+ | Criar comitê |
| GET/PATCH/DELETE | `/api/comites/{id}` | PMO+ | CRUD comitê |
| … | `/api/comites/{id}/participantes` | PMO+ | Participantes |
| … | `/api/comites/{id}/decisoes` | PMO+ | Decisões |
| … | `/api/comites/{id}/pendencias` | PMO+ | Pendências |
| … | `/api/comites/{id}/ata` | PMO+ | Ata |
| … | `/api/comites/{id}/ata/gerar` | PMO+ | Gerar ata com IA |
| … | `/api/comites/{id}/exportar` | PMO+ | Export Word/PDF |
