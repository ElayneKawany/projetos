# Status da Cobertura OpenAPI

**Arquivo:** `openapi.yml`
**Versão:** OpenAPI 3.1.0
**Última atualização:** 2026-08-06 (Sprint 4)

---

## Resumo

| Métrica | Valor |
|---|---|
| Total de paths | 57 |
| Total de schemas | 72 |
| Total de parameters | 12 |
| Total de responses | 7 |
| Cobertura estimada | ~58% (~57/98 endpoints totais) |

---

## Cobertura por Módulo

| Módulo | Sprint | Paths | Status |
|---|---|---|---|
| Projetos | Sprint 1 | 8 | ✅ Completo |
| TAP | Sprint 1 | 8 | ✅ Completo |
| Viabilidade | Sprint 1 | 8 | ✅ Completo |
| Cronograma | Sprint 2 | 13 | ✅ Completo |
| Configurações Cronograma | Sprint 2 | 5 | ✅ Completo |
| Autenticação | Sprint 3 | 2 | ✅ Completo |
| Usuários | Sprint 3 | 5 | ✅ Completo |
| Workflow | Sprint 3 | 3 | ✅ Completo |
| Aprovações | Sprint 3 | 5 | ✅ Completo |
| Financeiro global | Sprint 4 | 1 | ✅ Completo |
| Configurações Financeiro | Sprint 4 | 1 | ✅ Completo |
| Financeiro do projeto | Sprint 4 | 2 | ✅ Completo |
| Movimentos financeiros | Sprint 4 | 3 operações | ✅ Completo |
| Contratos | Sprint 4 | 9 operações | ✅ Completo |
| Pagamentos | Sprint 4 | 3 operações | ✅ Completo |
| Orçamento | Sprint 4 | 4 operações | ✅ Completo |
| Dashboard | — | 0 | 🔴 Pendente |
| Comitês | — | 0 | 🔴 Pendente |
| Payback | — | 0 | 🔴 Pendente |
| Auditoria | — | 0 | 🔴 Pendente |

---

## Components Reutilizáveis

### Parameters (12)
`projetoId`, `tapId`, `viabilidadeId`, `cronogramaId`, `tarefaId`, `tipoTarefaId`,
`aprovacaoId`, `usuarioId`, `modeloId`, `contId`, `pagId`, `grupoId`

### Responses (7)
`NaoAutenticado`, `SemPermissao`, `NaoEncontrado`, `DadosInvalidos`,
`EntidadeNaoProcessavel`, `ErroInterno`, `Sucesso`

### Security Schemes (1)
`cookieAuth` — apiKey in cookie `megag_pmo_session`

---

## Observações Registradas (não corrigidas)

### Sprint 1
1. `GET /api/projetos/{id}/tap/{tapId}` não tem rota GET dedicada — lido junto com o projeto
2. Status HTTP 204 não utilizado — todos retornam 200 com corpo
3. `POST /tap/.../aprovar` aceita corpo vazio mas alguns clientes enviam `{}`

### Sprint 2
1. Marcos são tarefas com `tipo=MARCO` — sem endpoint dedicado `/marcos`
2. Subtarefas sem CRUD próprio — criadas via `PUT /tarefas` ou `POST /nova-atividade`
3. Dependências entre tarefas não existem como entidade na API
4. `POST /cronograma` retorna HTTP 200 (não 201) para criação
5. `/api/configuracoes/cronograma` é rota dupla — também serve tipos de tarefa

### Sprint 3
1. `POST /api/auth/logout` retorna HTTP 302 (redirect), não JSON
2. `DELETE /api/usuarios/{id}` realiza hard delete, não soft delete
3. `DELETE /api/aprovadores` usa query param `id` em vez de path param
4. Sem módulo `/api/perfis/` independente
5. Sem endpoint `GET /api/usuarios/{id}`

### Sprint 4
1. `GET /financeiro` e `GET /contratos` retornam a mesma resposta `DashboardFinanceiro`
2. `PATCH /movimentos` usa `movimentoId` no corpo (não no path)
3. `DELETE /orcamento/grupos/{grupoId}/itens` tem duplo comportamento (item vs grupo)
4. `POST /financeiro` retorna HTTP 200 em vez de 201
5. Criação de orçamento bloqueada com 403 quando Viabilidade está `APROVADO`

---

## Próxima Sprint (Sprint 5)

Módulos pendentes: **Dashboard, Comitês, Payback, Auditoria**

Endpoints estimados: ~20–25
Schemas estimados: ~10–15 novos
