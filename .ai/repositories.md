# Mapa dos Repositories

Todos em `lib/repositories/`. Padrão: classe estática, métodos síncronos, `getDb()` interno.

---

## ProjetosRepository (`lib/repositories/projetos.ts`) ✅

Cobre: projetos, TAP, Viabilidade, históricos, status, aprovações de artefatos.

| Método | Operação |
|---|---|
| `findAll(filtros)` | SELECT projetos com filtros |
| `findById(id)` | SELECT projeto por ID |
| `create(dados, userId)` | INSERT projeto |
| `update(id, dados)` | UPDATE campos do projeto |
| `findTapVersoes(projetoId)` | SELECT versões TAP |
| `findTapVersao(tapId)` | SELECT TAP por ID |
| `createTapVersao(dados)` | INSERT TAP |
| `updateTapVersao(tapId, dados)` | UPDATE TAP |
| `findViabilidadeVersoes(projetoId)` | SELECT versões Viabilidade |
| `findViabilidadeVersao(vid)` | SELECT Viabilidade por ID |
| `createViabilidadeVersao(dados)` | INSERT Viabilidade |
| `updateViabilidadeVersao(vid, dados)` | UPDATE Viabilidade |
| `registrarHistoricoAlteracao(dados)` | INSERT histórico de campo |
| `registrarStatusHistorico(dados)` | INSERT histórico de status |
| `findStatusHistorico(projetoId)` | SELECT histórico de status |
| `findHistoricoAlteracoes(projetoId)` | SELECT histórico de campos |

---

## UsuariosRepository (`lib/repositories/usuarios.ts`) ✅

| Método | Operação |
|---|---|
| `findAll(opts)` | SELECT usuários ativos |
| `findById(id)` | SELECT por ID |
| `findRawById(id)` | SELECT sem joins |
| `findByEmail(email)` | SELECT por e-mail |
| `checkCpfDuplicado(cpf, exceptId?)` | SELECT verificação unicidade CPF |
| `checkEmailDuplicado(email, exceptId?)` | SELECT verificação unicidade e-mail |
| `findPerfilById(id)` | SELECT perfil |
| `create(dados)` | INSERT usuário |
| `updateFull(id, campos)` | UPDATE com allowlist |
| `checkDependencias(id)` | SELECT conta projetos vinculados |
| `hardDelete(id)` | DELETE físico (comportamento legado) |

---

## CronogramaRepository (`lib/repositories/cronograma.ts`) ✅

| Método | Operação |
|---|---|
| `findByProjetoId(id)` | SELECT cronograma ativo |
| `findById(cronId)` | SELECT por ID |
| `create(dados)` | INSERT cronograma |
| `update(cronId, dados)` | UPDATE cronograma |
| `findTarefas(cronId)` | SELECT tarefas |
| `upsertTarefas(cronId, tarefas)` | DELETE + INSERT bulk tarefas |
| `findTarefa(tarefaId)` | SELECT tarefa por ID |
| `updateTarefa(tarefaId, dados)` | UPDATE tarefa |
| `findConfiguracoes()` | SELECT config cronograma global |
| `findTiposTarefa()` | SELECT tipos de tarefa |
| `upsertTipoTarefa(dados)` | INSERT OR REPLACE tipo tarefa |

---

## FinanceiroRepository (`lib/repositories/financeiro.ts`) ✅

| Método | Operação |
|---|---|
| `findLancamentos(filtros)` | SELECT lançamentos |
| `createLancamento(dados)` | INSERT lançamento avulso |
| `findContratos(projetoId)` | SELECT contratos ativos |
| `findContratoById(id)` | SELECT contrato por ID |
| `createContrato(dados)` | INSERT contrato |
| `updateContrato(id, dados)` | UPDATE contrato |
| `desativarContrato(id)` | UPDATE ativo=0 |
| `findPagamentos(contratoId)` | SELECT pagamentos ativos |
| `findPagamentoById(id)` | SELECT pagamento por ID |
| `createPagamento(dados)` | INSERT pagamento |
| `updatePagamento(id, dados)` | UPDATE pagamento |
| `desativarPagamento(id)` | UPDATE ativo=0 |
| `findMovimentos(projetoId)` | SELECT movimentos |
| `createMovimento(dados)` | INSERT movimento |
| `updateMovimentoStatus(id, dados)` | UPDATE status movimento |
| `findOrcamentoGrupos(projetoId)` | SELECT grupos + itens |
| `createGrupo(dados)` | INSERT grupo orçamento |
| `createItem(dados)` | INSERT item orçamento |
| `updateItem(id, dados)` | UPDATE item |
| `desativarItem(id)` | UPDATE ativo=0 |
| `desativarGrupo(id)` | UPDATE ativo=0 |

---

## ComitesRepository (`lib/repositories/comites.ts`) ✅

Maior repositório — ~35 métodos.

Grupos de métodos:
- **Comitê base:** `findAll`, `findRaw`, `findById`, `create`, `updateFull`, `deleteCascade`
- **Participantes:** `findParticipantes`, `insertParticipante`, `updatePresencaBulk`, `deleteParticipante`
- **Decisões:** `insertDecisao`, `findDecisao`, `updateDecisao`, `deleteDecisao`
- **Pendências:** `insertPendencia`, `findPendencia`, `updatePendencia`, `deletePendencia`
- **Projetos do comitê:** `insertComiteProjeto`, `findComiteProjeto`, `updateComiteProjeto`
- **Ata:** `findAta`, `insertAta`, `updateAta`, `insertAtaHistorico`
- **Contexto IA:** `findPortfolioAtivoParaIA`, `findTotalFinanceiroPago`, `findDecisoesPendentes`, `findComiteAnterior`, `findMovimentosRecentes`
- **Exportação:** `findProjetosParaExportacao`, `findDecisoesParaExportacao`, `findPendenciasParaExportacao`

---

## Repositories Pendentes (Sprint 9+)

| Módulo | Estimativa |
|---|---|
| Configurações (diretorias, áreas, perfis, motivos) | ~40 métodos |
| Aprovações | ~10 métodos |
| Workflow (modelos, etapas) | ~8 métodos |
| Orçamento (grupos, itens) | ~10 métodos |
| Dashboard | ~5 métodos |
| Payback | a definir |
