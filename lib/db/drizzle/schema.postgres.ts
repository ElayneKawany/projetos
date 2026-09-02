/**
 * Schema PostgreSQL — Migração SQLite → PostgreSQL, Fase 1 (GERADO)
 *
 * Gerado por scripts/gen-schema-postgres.js a partir do snapshot real do banco
 * (lib/db/drizzle/migrations/meta/0000_snapshot.json, via `npx drizzle-kit pull`).
 * NÃO editar à mão — editar as listas de override em gen-schema-postgres.js e
 * rodar `node scripts/gen-schema-postgres.js` de novo.
 *
 * Ainda não aplicado a nenhum banco (nem teste, nem produção) — revisar antes.
 * Ver seção "REVISAR" no final do arquivo para colunas de classificação incerta.
 */
import { pgSchema, integer, text, boolean, jsonb, date, timestamp, numeric, foreignKey, unique, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const ai = pgSchema('AI')

export const perfis = ai.table('TI_PMO_PERFIS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  nome: text().notNull(),
  descricao: text(),
  permissoes: jsonb().notNull().default('{}'),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const diretorias = ai.table('TI_PMO_DIRETORIAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  nome: text().notNull(),
  sigla: text().notNull(),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
  descricao: text(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  diretorResponsavelId: integer('diretor_responsavel_id'),
  ordem: integer().default(99),
})

export const areas = ai.table('TI_PMO_AREAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  diretoriaId: integer('diretoria_id').notNull(),
  codigo: text().notNull().unique(),
  nome: text().notNull(),
  sigla: text().notNull(),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
  descricao: text(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.diretoriaId], foreignColumns: [diretorias.id], name: 'fk_areas_diretoria' }),
])

export const usuarios = ai.table('TI_PMO_USUARIOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cpf: text().notNull().unique(),
  nome: text().notNull(),
  email: text().notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  cargo: text(),
  diretoriaId: integer('diretoria_id'),
  areaId: integer('area_id'),
  perfilId: integer('perfil_id').notNull(),
  ativo: boolean().notNull().default(true),
  ultimoLogin: text('ultimo_login'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.perfilId], foreignColumns: [perfis.id], name: 'fk_usuarios_perfil' }),
  foreignKey({ columns: [table.areaId], foreignColumns: [areas.id], name: 'fk_usuarios_area' }),
  foreignKey({ columns: [table.diretoriaId], foreignColumns: [diretorias.id], name: 'fk_usuarios_diretoria' }),
])

export const projetos = ai.table('TI_PMO_PROJETOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  nome: text().notNull(),
  solicitanteId: integer('solicitante_id').notNull(),
  diretoriaId: integer('diretoria_id').notNull(),
  areaId: integer('area_id').notNull(),
  pontoFocal: text('ponto_focal'),
  contato: text(),
  objetivo: text().notNull(),
  descricao: text(),
  beneficios: text(),
  status: text().notNull().default('PROPOSTA'),
  classificacao: text(),
  complexidade: text(),
  prioridade: text().default('MEDIA'),
  gerenteId: integer('gerente_id'),
  capexAprovado: numeric('capex_aprovado').default('0'),
  opexAprovado: numeric('opex_aprovado').default('0'),
  dataInicioPrev: date('data_inicio_prev'),
  dataFimPrev: date('data_fim_prev'),
  dataGolive: date('data_golive'),
  ativo: boolean().notNull().default(true),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  justificativa: text(),
  dataConclusaoReal: timestamp('data_conclusao_real', { withTimezone: true }),
  horaConclusao: text('hora_conclusao'),
  responsavelConclusao: text('responsavel_conclusao'),
  motivoConclusao: text('motivo_conclusao'),
  checklistConclusao: jsonb('checklist_conclusao'),
  projetoMigrado: boolean('projeto_migrado').default(false),
  motivoPausaId: integer('motivo_pausa_id'),
  pmoResponsavel: text('pmo_responsavel'),
  tipoBeneficio: text('tipo_beneficio'),
  cronogramaPendente: boolean('cronograma_pendente').default(false),
  migradoEm: timestamp('migrado_em', { withTimezone: true }),
  migradoPor: integer('migrado_por'),
  dataPausa: timestamp('data_pausa', { withTimezone: true }),
  usuarioPausa: integer('usuario_pausa'),
  pmoResponsavelId: integer('pmo_responsavel_id'),
  origemDados: text('origem_dados'),
  arquivoOrigem: text('arquivo_origem'),
  dataBaseEntrega: timestamp('data_base_entrega', { withTimezone: true }),
  dataBaseEntregaDefinidaEm: timestamp('data_base_entrega_definida_em', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_projetos_created_by' }),
  foreignKey({ columns: [table.gerenteId], foreignColumns: [usuarios.id], name: 'fk_projetos_gerente' }),
  foreignKey({ columns: [table.areaId], foreignColumns: [areas.id], name: 'fk_projetos_area' }),
  foreignKey({ columns: [table.diretoriaId], foreignColumns: [diretorias.id], name: 'fk_projetos_diretoria' }),
  foreignKey({ columns: [table.solicitanteId], foreignColumns: [usuarios.id], name: 'fk_projetos_solicitante' }),
  index('idx_projetos_gerente').on(table.gerenteId),
  index('idx_projetos_diretoria').on(table.diretoriaId),
  index('idx_projetos_status').on(table.status),
])

export const aprovacoes = ai.table('TI_PMO_APROVACOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  tipo: text().notNull(),
  referenciaId: integer('referencia_id'),
  referenciaTipo: text('referencia_tipo'),
  status: text().default('PENDENTE'),
  solicitanteId: integer('solicitante_id').notNull(),
  aprovadorId: integer('aprovador_id'),
  observacaoReq: text('observacao_req'),
  observacaoApr: text('observacao_apr'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  prazo: date(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.aprovadorId], foreignColumns: [usuarios.id], name: 'fk_aprovacoes_aprovador' }),
  foreignKey({ columns: [table.solicitanteId], foreignColumns: [usuarios.id], name: 'fk_aprovacoes_solicitante' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_aprovacoes_projeto' }),
  index('idx_aprovacoes_status').on(table.status, table.aprovadorId),
])

export const auditoria = ai.table('TI_PMO_AUDITORIA', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  acao: text().notNull(),
  entidade: text().notNull(),
  entidadeId: integer('entidade_id'),
  projetoId: integer('projeto_id'),
  descricao: text().notNull(),
  dadosAntes: jsonb('dados_antes'),
  dadosDepois: jsonb('dados_depois'),
  ip: text(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_auditoria_projeto' }),
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_auditoria_usuario' }),
  index('idx_auditoria_usuario').on(table.usuarioId),
  index('idx_auditoria_projeto').on(table.projetoId),
  index('idx_auditoria_entidade').on(table.entidade, table.entidadeId),
])

export const comites = ai.table('TI_PMO_COMITES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  titulo: text().notNull(),
  tipo: text().notNull().default('IDEIAS'),
  dataRealizacao: timestamp('data_realizacao', { withTimezone: true }).notNull(),
  local: text(),
  pauta: text(),
  decisaoGeral: text('decisao_geral'),
  status: text().default('AGENDADO'),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  hora: text(),
  periodoInicio: text('periodo_inicio'),
  periodoFim: text('periodo_fim'),
  descricao: text(),
  resumoExecutivoIa: text('resumo_executivo_ia'),
  resumoIaGeradoEm: timestamp('resumo_ia_gerado_em', { withTimezone: true }),
  resumoExecutivoIaJson: jsonb('resumo_executivo_ia_json'),
  diretoriasIds: text('diretorias_ids'),
  observacoes: text(),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_comites_created_by' }),
])

export const comiteAta = ai.table('TI_PMO_COMITE_ATA', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull().unique(),
  conteudo: text(),
  versao: integer().default(1),
  geradoPorIa: boolean('gerado_por_ia').default(false),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  transcricao: text(),
  conteudoJson: jsonb('conteudo_json'),
  status: text().default('RASCUNHO'),
  horaInicio: text('hora_inicio'),
  horaFim: text('hora_fim'),
  duracaoMin: integer('duracao_min'),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_comite_ata_created_by' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_ata_comite' }),
])

export const comiteAtaHistorico = ai.table('TI_PMO_COMITE_ATA_HISTORICO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull(),
  ataId: integer('ata_id').notNull(),
  versao: integer().notNull(),
  conteudoSnap: text('conteudo_snap'),
  acao: text().notNull(),
  usuarioId: integer('usuario_id').notNull(),
  usuarioNome: text('usuario_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_comite_ata_historico_usuario' }),
  foreignKey({ columns: [table.ataId], foreignColumns: [comiteAta.id], name: 'fk_comite_ata_historico_ata' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_ata_historico_comite' }),
])

export const comiteDecisoes = ai.table('TI_PMO_COMITE_DECISOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull(),
  projetoId: integer('projeto_id'),
  tipo: text().notNull().default('PENDENTE'),
  descricao: text().notNull(),
  responsavelNome: text('responsavel_nome'),
  prazo: text(),
  status: text().default('PENDENTE'),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_comite_decisoes_created_by' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_comite_decisoes_projeto' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_decisoes_comite' }),
])

export const comiteDocumentos = ai.table('TI_PMO_COMITE_DOCUMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull(),
  nome: text().notNull(),
  caminho: text().notNull(),
  tipo: text(),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_comite_documentos_created_by' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_documentos_comite' }),
])

export const comiteParticipantes = ai.table('TI_PMO_COMITE_PARTICIPANTES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull(),
  usuarioId: integer('usuario_id'),
  nomeExterno: text('nome_externo'),
  cargo: text(),
  presente: boolean().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }),
  confirmado: boolean().default(false),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_comite_participantes_usuario' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_participantes_comite' }),
])

export const comitePendencias = ai.table('TI_PMO_COMITE_PENDENCIAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull(),
  projetoId: integer('projeto_id'),
  descricao: text().notNull(),
  responsavelNome: text('responsavel_nome'),
  prazo: text(),
  status: text().default('ABERTA'),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: integer('resolved_by'),
}, (table) => [
  foreignKey({ columns: [table.resolvedBy], foreignColumns: [usuarios.id], name: 'fk_comite_pendencias_resolved_by' }),
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_comite_pendencias_created_by' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_comite_pendencias_projeto' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_pendencias_comite' }),
])

export const comiteProjetos = ai.table('TI_PMO_COMITE_PROJETOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  comiteId: integer('comite_id').notNull(),
  projetoId: integer('projeto_id').notNull(),
  pautaItem: text('pauta_item'),
  decisao: text(),
  observacoes: text(),
  snapPrioridade: text('snap_prioridade'),
  snapComplexidade: text('snap_complexidade'),
  snapInvestimento: numeric('snap_investimento'),
  snapRoi: numeric('snap_roi'),
  snapPayback: numeric('snap_payback'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  ordemPauta: integer('ordem_pauta').default(0),
  tempoPrevisto: integer('tempo_previsto'),
}, (table) => [
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_comite_projetos_projeto' }),
  foreignKey({ columns: [table.comiteId], foreignColumns: [comites.id], name: 'fk_comite_projetos_comite' }),
])

export const configCentrosCusto = ai.table('TI_PMO_CONFIG_CENTROS_CUSTO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  descricao: text().notNull(),
  empresa: text(),
  filial: text(),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const configChecklistConclusao = ai.table('TI_PMO_CONFIG_CHECKLIST_CONCLUSAO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  label: text().notNull(),
  obrigatorio: boolean().notNull().default(false),
  ordem: integer().notNull().default(0),
  ativo: boolean().notNull().default(true),
})

export const configContasContabeis = ai.table('TI_PMO_CONFIG_CONTAS_CONTABEIS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  descricao: text().notNull(),
  tipo: text().notNull().default('CAPEX_ATIVO'),
  empresa: text(),
  filial: text(),
  integracaoCodigo: text('integracao_codigo'),
  ativo: boolean().notNull().default(true),
  dataInicio: date('data_inicio'),
  dataFim: date('data_fim'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const configCronogramaCriticidades = ai.table('TI_PMO_CONFIG_CRONOGRAMA_CRITICIDADES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  label: text().notNull(),
  cor: text().default('#6B7280'),
  ordem: integer().default(0),
  ativo: boolean().notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const configCronogramaTipos = ai.table('TI_PMO_CONFIG_CRONOGRAMA_TIPOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  label: text().notNull(),
  ordem: integer().default(0),
  ativo: boolean().notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const configGlobal = ai.table('TI_PMO_CONFIG_GLOBAL', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  chave: text().notNull().unique(),
  valor: text().notNull(),
  descricao: text(),
  updatedBy: integer('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const configMotivosPausa = ai.table('TI_PMO_CONFIG_MOTIVOS_PAUSA', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  nome: text().notNull(),
  descricao: text(),
  ordem: integer().notNull().default(0),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const configStatusProjeto = ai.table('TI_PMO_CONFIG_STATUS_PROJETO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  label: text().notNull(),
  descricao: text(),
  cor: text().default('#6B7280'),
  ordem: integer().default(0),
  ativo: boolean().default(true),
  isInitial: boolean('is_initial').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const cronogramaResponsaveis = ai.table('TI_PMO_CRONOGRAMA_RESPONSAVEIS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cronogramaTarefaId: integer('cronograma_tarefa_id').notNull(),
  usuarioId: integer('usuario_id'),
  usuarioNomeExt: text('usuario_nome_ext'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const cronogramas = ai.table('TI_PMO_CRONOGRAMAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  versao: integer().notNull().default(1),
  label: text().notNull(),
  isBaseline: boolean('is_baseline').default(false),
  status: text().default('ATIVO'),
  motivoReplano: text('motivo_replano'),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  fonteImportacao: text('fonte_importacao').default('MANUAL'),
  arquivoOrigem: text('arquivo_origem'),
  modo: text().notNull().default('CENTRALIZADO'),
  ativo: boolean().default(true),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  arquivado: boolean().default(false),
  arquivadoPor: integer('arquivado_por'),
  arquivadoEm: timestamp('arquivado_em', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.arquivadoPor], foreignColumns: [usuarios.id], name: 'fk_cronogramas_arquivado_por' }),
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_cronogramas_criado_por' }),
  foreignKey({ columns: [table.aprovadoPor], foreignColumns: [usuarios.id], name: 'fk_cronogramas_aprovado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_cronogramas_projeto' }),
  uniqueIndex('idx_cronogramas_projeto_versao').on(table.projetoId, table.versao),
  index('idx_cronograma_projeto').on(table.projetoId),
])

export const cronogramaTarefas = ai.table('TI_PMO_CRONOGRAMA_TAREFAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cronogramaId: integer('cronograma_id').notNull(),
  parentId: integer('parent_id'),
  nivel: integer().default(1),
  ordem: integer().default(0),
  codigo: text(),
  nome: text().notNull(),
  responsavelId: integer('responsavel_id'),
  dataInicio: date('data_inicio'),
  dataFim: date('data_fim'),
  duracaoDias: integer('duracao_dias'),
  dependencias: jsonb(),
  percentual: integer().default(0),
  bloqueio: boolean().default(false),
  motivoBloqueio: text('motivo_bloqueio'),
  status: text().default('NAO_INICIADA'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  areaId: integer('area_id'),
  tipo: text().default('TAREFA'),
  criticidade: text().default('NORMAL'),
  observacoes: text(),
  motivoAtraso: text('motivo_atraso'),
  dependenciaId: integer('dependencia_id'),
  peso: numeric().default('1'),
  alteradoPor: integer('alterado_por'),
  alteradoEm: timestamp('alterado_em', { withTimezone: true }),
  executorId: integer('executor_id'),
  criadoPor: integer('criado_por'),
  descricao: text(),
  dataConclusao: timestamp('data_conclusao', { withTimezone: true }),
  concluidoPor: integer('concluido_por'),
  prazoStatus: text('prazo_status'),
  responsavelNomeExt: text('responsavel_nome_ext'),
  executorNomeExt: text('executor_nome_ext'),
  ativo: boolean().default(true),
  tipoMacro: text('tipo_macro').default('OUTRO'),
  dataFimBaseline: timestamp('data_fim_baseline', { withTimezone: true }),
  dataInicioBaseline: timestamp('data_inicio_baseline', { withTimezone: true }),
  naturezaTarefa: text('natureza_tarefa').default('NORMAL'),
}, (table) => [
  foreignKey({ columns: [table.responsavelId], foreignColumns: [usuarios.id], name: 'fk_cronograma_tarefas_responsavel' }),
  foreignKey({ columns: [table.parentId], foreignColumns: [table.id], name: 'fk_cronograma_tarefas_parent' }),
  foreignKey({ columns: [table.cronogramaId], foreignColumns: [cronogramas.id], name: 'fk_cronograma_tarefas_cronograma' }),
])

export const cronogramaTarefaPagamento = ai.table('TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cronogramaTarefaId: integer('cronograma_tarefa_id').notNull().unique(),
  beneficiario: text(),
  valorTotal: numeric('valor_total').notNull(),
  qtdParcelas: integer('qtd_parcelas').notNull(),
  periodicidade: text().notNull().default('MENSAL'),
  dataPrimeiraParcela: timestamp('data_primeira_parcela', { withTimezone: true }).notNull(),
  financeiroPagamentoId: integer('financeiro_pagamento_id'),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_cronograma_tarefa_pagamento_criado_por' }),
  foreignKey({ columns: [table.cronogramaTarefaId], foreignColumns: [cronogramaTarefas.id], name: 'fk_cronograma_tarefa_pagamento_cronograma_tarefa' }),
])

export const cronogramaTarefaParcelas = ai.table('TI_PMO_CRONOGRAMA_TAREFA_PARCELAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cronogramaTarefaId: integer('cronograma_tarefa_id').notNull(),
  numero: integer().notNull(),
  valor: numeric().notNull(),
  dataVencimento: timestamp('data_vencimento', { withTimezone: true }).notNull(),
  dataVencimentoBaseline: timestamp('data_vencimento_baseline', { withTimezone: true }),
  status: text().notNull().default('PENDENTE'),
  dataPagamento: timestamp('data_pagamento', { withTimezone: true }),
  pagoPor: integer('pago_por'),
  financeiroPagamentoId: integer('financeiro_pagamento_id'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.pagoPor], foreignColumns: [usuarios.id], name: 'fk_cronograma_tarefa_parcelas_pago_por' }),
  foreignKey({ columns: [table.cronogramaTarefaId], foreignColumns: [cronogramaTarefas.id], name: 'fk_cronograma_tarefa_parcelas_cronograma_tarefa' }),
])

export const cronogramaTarefaParcelasHistorico = ai.table('TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  parcelaId: integer('parcela_id').notNull(),
  cronogramaTarefaId: integer('cronograma_tarefa_id').notNull(),
  projetoId: integer('projeto_id').notNull(),
  campo: text().notNull(),
  valorAnterior: text('valor_anterior'),
  valorNovo: text('valor_novo'),
  justificativa: text(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_cronograma_tarefa_parcelas_historico_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_cronograma_tarefa_parcelas_historico_projeto' }),
  foreignKey({ columns: [table.cronogramaTarefaId], foreignColumns: [cronogramaTarefas.id], name: 'fk_cronograma_tarefa_parcelas_historico_cronograma_tarefa' }),
  foreignKey({ columns: [table.parcelaId], foreignColumns: [cronogramaTarefaParcelas.id], name: 'fk_cronograma_tarefa_parcelas_historico_parcela' }),
])

export const documentoAprovadores = ai.table('TI_PMO_DOCUMENTO_APROVADORES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tipoDocumento: text('tipo_documento').notNull(),
  usuarioId: integer('usuario_id').notNull(),
  ordem: integer().default(1),
  obrigatorio: boolean().default(true),
  ativo: boolean().default(true),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_documento_aprovadores_created_by' }),
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_documento_aprovadores_usuario' }),
  index('idx_doc_aprovadores_tipo').on(table.tipoDocumento, table.ativo),
])

export const documentos = ai.table('TI_PMO_DOCUMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id'),
  tipo: text().notNull(),
  titulo: text().notNull(),
  descricao: text(),
  versao: integer().notNull().default(1),
  status: text().default('RASCUNHO'),
  geradoAuto: boolean('gerado_auto').default(false),
  caminho: text(),
  conteudoJson: jsonb('conteudo_json'),
  criadoPor: integer('criado_por').notNull(),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  publicadoEm: timestamp('publicado_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.aprovadoPor], foreignColumns: [usuarios.id], name: 'fk_documentos_aprovado_por' }),
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_documentos_criado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_documentos_projeto' }),
])

export const documentosVersoes = ai.table('TI_PMO_DOCUMENTOS_VERSOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  documentoId: integer('documento_id').notNull(),
  versao: integer().notNull(),
  status: text(),
  caminho: text(),
  conteudoJson: jsonb('conteudo_json'),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_documentos_versoes_criado_por' }),
  foreignKey({ columns: [table.documentoId], foreignColumns: [documentos.id], name: 'fk_documentos_versoes_documento' }),
])

export const encerramentos = ai.table('TI_PMO_ENCERRAMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull().unique(),
  licoesAprendidas: text('licoes_aprendidas'),
  roiPrevisto: numeric('roi_previsto'),
  roiRealizado: numeric('roi_realizado'),
  paybackPrevisto: numeric('payback_previsto'),
  paybackRealizado: numeric('payback_realizado'),
  capexPrevisto: numeric('capex_previsto'),
  capexRealizado: numeric('capex_realizado'),
  opexPrevisto: numeric('opex_previsto'),
  opexRealizado: numeric('opex_realizado'),
  economiaPrevista: numeric('economia_prevista'),
  economiaRealizada: numeric('economia_realizada'),
  avaliacaoGeral: text('avaliacao_geral'),
  recomendacoes: text(),
  criadoPor: integer('criado_por').notNull(),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.aprovadoPor], foreignColumns: [usuarios.id], name: 'fk_encerramentos_aprovado_por' }),
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_encerramentos_criado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_encerramentos_projeto' }),
])

export const estruturacao = ai.table('TI_PMO_ESTRUTURACAO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull().unique(),
  gerenteId: integer('gerente_id'),
  patrocinadorId: integer('patrocinador_id'),
  metodologia: text(),
  escopoDetalhado: text('escopo_detalhado'),
  entregas: jsonb(),
  observacoes: text(),
  concluida: boolean().default(false),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_estruturacao_created_by' }),
  foreignKey({ columns: [table.patrocinadorId], foreignColumns: [usuarios.id], name: 'fk_estruturacao_patrocinador' }),
  foreignKey({ columns: [table.gerenteId], foreignColumns: [usuarios.id], name: 'fk_estruturacao_gerente' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_estruturacao_projeto' }),
])

export const execucaoAtualizacoes = ai.table('TI_PMO_EXECUCAO_ATUALIZACOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  tarefaId: integer('tarefa_id'),
  tipo: text().notNull(),
  descricao: text().notNull(),
  percentual: integer(),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_execucao_atualizacoes_criado_por' }),
  foreignKey({ columns: [table.tarefaId], foreignColumns: [cronogramaTarefas.id], name: 'fk_execucao_atualizacoes_tarefa' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_execucao_atualizacoes_projeto' }),
])

export const execucaoArquivos = ai.table('TI_PMO_EXECUCAO_ARQUIVOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  atualizacaoId: integer('atualizacao_id').notNull(),
  nome: text().notNull(),
  caminho: text().notNull(),
  tipoMime: text('tipo_mime'),
  tamanhoBytes: integer('tamanho_bytes'),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_execucao_arquivos_criado_por' }),
  foreignKey({ columns: [table.atualizacaoId], foreignColumns: [execucaoAtualizacoes.id], name: 'fk_execucao_arquivos_atualizacao' }),
])

export const financeiroLancamentos = ai.table('TI_PMO_FINANCEIRO_LANCAMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  tipo: text().notNull(),
  categoria: text().notNull(),
  descricao: text().notNull(),
  fornecedor: text(),
  numeroDoc: text('numero_doc'),
  valor: numeric().notNull(),
  dataLancamento: date('data_lancamento').notNull(),
  competencia: text(),
  observacoes: text(),
  arquivoPath: text('arquivo_path'),
  criadoPor: integer('criado_por').notNull(),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  status: text().default('PENDENTE'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  itemId: integer('item_id'),
}, (table) => [
  foreignKey({ columns: [table.aprovadoPor], foreignColumns: [usuarios.id], name: 'fk_financeiro_lancamentos_aprovado_por' }),
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_financeiro_lancamentos_criado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_financeiro_lancamentos_projeto' }),
  index('idx_lancamentos_projeto').on(table.projetoId, table.tipo),
])

export const financeiroAnexos = ai.table('TI_PMO_FINANCEIRO_ANEXOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  lancamentoId: integer('lancamento_id').notNull(),
  nome: text().notNull(),
  caminho: text().notNull(),
  tipoMime: text('tipo_mime'),
  tamanhoBytes: integer('tamanho_bytes'),
  tipoAnexo: text('tipo_anexo').default('NF'),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_financeiro_anexos_criado_por' }),
  foreignKey({ columns: [table.lancamentoId], foreignColumns: [financeiroLancamentos.id], name: 'fk_financeiro_anexos_lancamento' }),
  index('idx_financeiro_anexos').on(table.lancamentoId),
])

export const financeiroContratos = ai.table('TI_PMO_FINANCEIRO_CONTRATOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  numeroContrato: text('numero_contrato'),
  contratado: text().notNull(),
  tipoContrato: text('tipo_contrato').notNull().default('SERVICO'),
  descricaoServico: text('descricao_servico'),
  valorAprovado: numeric('valor_aprovado').notNull().default('0'),
  status: text().notNull().default('ATIVO'),
  observacoes: text(),
  ativo: boolean().notNull().default(true),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  observacao: text(),
  naturezaFinanceira: text('natureza_financeira').notNull().default('CAPEX'),
  categoria: text(),
  tipoProjecao: text('tipo_projecao').default('NENHUMA'),
})

export const financeiroContratoProjecaoParcelas = ai.table('TI_PMO_FINANCEIRO_CONTRATO_PROJECAO_PARCELAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  contratoId: integer('contrato_id').notNull(),
  numero: integer().notNull(),
  competencia: text().notNull(),
  valorProjetado: numeric('valor_projetado').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.contratoId], foreignColumns: [financeiroContratos.id], name: 'fk_financeiro_contrato_projecao_parcelas_contrato' }),
])

export const financeiroEnquadramentoHistorico = ai.table('TI_PMO_FINANCEIRO_ENQUADRAMENTO_HISTORICO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  pagamentoId: integer('pagamento_id').notNull(),
  projetoId: integer('projeto_id').notNull(),
  contratoIdAnterior: integer('contrato_id_anterior'),
  contratoIdNovo: integer('contrato_id_novo'),
  tipoAcao: text('tipo_acao').notNull(),
  regraUtilizada: text('regra_utilizada'),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const financeiroMovimentos = ai.table('TI_PMO_FINANCEIRO_MOVIMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  itemId: integer('item_id'),
  tipoMovimento: text('tipo_movimento').notNull().default('NF'),
  numeroDoc: text('numero_doc'),
  fornecedor: text(),
  valorTotal: numeric('valor_total').notNull().default('0'),
  dataEmissao: date('data_emissao'),
  dataVencimento: date('data_vencimento'),
  status: text().notNull().default('PENDENTE'),
  observacoes: text(),
  arquivoPath: text('arquivo_path'),
  criadoPor: integer('criado_por').notNull(),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const financeiroPagamentos = ai.table('TI_PMO_FINANCEIRO_PAGAMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  movimentoId: integer('movimento_id').notNull(),
  projetoId: integer('projeto_id').notNull(),
  valorPago: numeric('valor_pago').notNull(),
  dataPagamento: timestamp('data_pagamento', { withTimezone: true }).notNull(),
  observacoes: text(),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  contratoId: integer('contrato_id'),
  numeroDocumento: text('numero_documento'),
  tipoDocumento: text('tipo_documento').default('NF'),
  notaFiscal: text('nota_fiscal'),
  competencia: text(),
  arquivoPath: text('arquivo_path'),
  ativo: boolean().default(true),
  observacao: text(),
  comprovante: text(),
  enquadramentoStatus: text('enquadramento_status'),
  contratosCandidatos: jsonb('contratos_candidatos'),
  fornecedor: text(),
})

export const notificacoes = ai.table('TI_PMO_NOTIFICACOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  usuarioId: integer('usuario_id').notNull(),
  projetoId: integer('projeto_id'),
  tipo: text().notNull(),
  titulo: text().notNull(),
  mensagem: text().notNull(),
  lida: boolean().default(false),
  lidaEm: timestamp('lida_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_notificacoes_projeto' }),
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_notificacoes_usuario' }),
  index('idx_notificacoes_usuario').on(table.usuarioId, table.lida),
])

export const orcamentoGrupos = ai.table('TI_PMO_ORCAMENTO_GRUPOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  viabilidadeId: integer('viabilidade_id'),
  tipo: text().notNull().default('CAPEX_ATIVO'),
  nome: text().notNull(),
  cor: text(),
  icone: text(),
  ordem: integer().notNull().default(0),
  ativo: boolean().notNull().default(true),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const orcamentoItens = ai.table('TI_PMO_ORCAMENTO_ITENS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  grupoId: integer('grupo_id').notNull(),
  projetoId: integer('projeto_id').notNull(),
  nome: text().notNull(),
  descricao: text(),
  contaContabilId: integer('conta_contabil_id'),
  centroCustoId: integer('centro_custo_id'),
  valorAprovado: numeric('valor_aprovado').notNull().default('0'),
  valorRevisado: numeric('valor_revisado'),
  status: text().notNull().default('ATIVO'),
  prioridade: text().notNull().default('MEDIA'),
  responsavelUsuarioId: integer('responsavel_usuario_id'),
  ordem: integer().notNull().default(0),
  ativo: boolean().notNull().default(true),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const paybackCompetencias = ai.table('TI_PMO_PAYBACK_COMPETENCIAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  ano: integer().notNull(),
  mes: integer().notNull(),
  receita: numeric().notNull().default('0'),
  economia: numeric().notNull().default('0'),
  capex: numeric().notNull().default('0'),
  opex: numeric().notNull().default('0'),
  fluxo: numeric().notNull().default('0'),
  observacao: text(),
  status: text().notNull().default('RASCUNHO'),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  unique('ux_payback_competencias_projeto_id_ano_mes').on(table.projetoId, table.ano, table.mes),
])

export const paybackLancamentos = ai.table('TI_PMO_PAYBACK_LANCAMENTOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  competencia: text().notNull(),
  dataLancamento: timestamp('data_lancamento', { withTimezone: true }).notNull(),
  investimentoPeriodo: numeric('investimento_periodo').notNull().default('0'),
  beneficioPeriodo: numeric('beneficio_periodo').notNull().default('0'),
  observacao: text(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  tipoBeneficio: text('tipo_beneficio'),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_payback_lancamentos_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_payback_lancamentos_projeto' }),
])

export const paybackRegistros = ai.table('TI_PMO_PAYBACK_REGISTROS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  data: date().notNull(),
  valorReal: numeric('valor_real').notNull(),
  origem: text().notNull().default('manual'),
  observacao: text(),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const projetoAreas = ai.table('TI_PMO_PROJETO_AREAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  areaId: integer('area_id').notNull(),
  responsavelId: integer('responsavel_id'),
  papel: text(),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.responsavelId], foreignColumns: [usuarios.id], name: 'fk_projeto_areas_responsavel' }),
  foreignKey({ columns: [table.areaId], foreignColumns: [areas.id], name: 'fk_projeto_areas_area' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_projeto_areas_projeto' }),
])

export const projetoFasePrazo = ai.table('TI_PMO_PROJETO_FASE_PRAZO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  status: text().notNull(),
  dataLimite: timestamp('data_limite', { withTimezone: true }),
  usuarioId: integer('usuario_id'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  dataBaseline: timestamp('data_baseline', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_projeto_fase_prazo_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_projeto_fase_prazo_projeto' }),
  unique('ux_projeto_fase_prazo_projeto_id_status').on(table.projetoId, table.status),
])

export const projetoFasePrazoHistorico = ai.table('TI_PMO_PROJETO_FASE_PRAZO_HISTORICO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  status: text().notNull(),
  dataAnterior: timestamp('data_anterior', { withTimezone: true }).notNull(),
  novaData: text('nova_data').notNull(),
  justificativa: text().notNull(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_projeto_fase_prazo_historico_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_projeto_fase_prazo_historico_projeto' }),
])

export const projetoHistoricoAlteracoes = ai.table('TI_PMO_PROJETO_HISTORICO_ALTERACOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  campo: text().notNull(),
  valorAnterior: text('valor_anterior'),
  valorNovo: text('valor_novo'),
  acao: text().default('UPDATE'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const projetoPrioridadeHistorico = ai.table('TI_PMO_PROJETO_PRIORIDADE_HISTORICO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  prioridadeDe: text('prioridade_de').notNull(),
  prioridadePara: text('prioridade_para').notNull(),
  motivo: text(),
  usuarioId: integer('usuario_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_projeto_prioridade_historico_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_projeto_prioridade_historico_projeto' }),
])

export const projetoSnapshotFinal = ai.table('TI_PMO_PROJETO_SNAPSHOT_FINAL', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull().unique(),
  roiPrevisto: numeric('roi_previsto'),
  roiAtual: numeric('roi_atual'),
  capexPrevisto: numeric('capex_previsto'),
  capexExecutado: numeric('capex_executado'),
  opexPrevisto: numeric('opex_previsto'),
  opexExecutado: numeric('opex_executado'),
  economiaPrevista: numeric('economia_prevista'),
  economiaRealizada: numeric('economia_realizada'),
  dataFimPrev: timestamp('data_fim_prev', { withTimezone: true }),
  dataConclusaoReal: timestamp('data_conclusao_real', { withTimezone: true }),
  diasDesvio: integer('dias_desvio'),
  responsavel: text(),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const projetoStatusHistorico = ai.table('TI_PMO_PROJETO_STATUS_HISTORICO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  statusDe: text('status_de').notNull(),
  statusPara: text('status_para').notNull(),
  motivo: text(),
  usuarioId: integer('usuario_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_projeto_status_historico_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_projeto_status_historico_projeto' }),
])

export const projetoTimeline = ai.table('TI_PMO_PROJETO_TIMELINE', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  modulo: text().notNull(),
  artefato: text().notNull(),
  evento: text().notNull(),
  origem: text().notNull().default('MANUAL'),
  titulo: text().notNull(),
  descricao: text(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  referenciaId: integer('referencia_id'),
  referenciaTipo: text('referencia_tipo'),
  dadosJson: jsonb('dados_json'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const roiAcompanhamento = ai.table('TI_PMO_ROI_ACOMPANHAMENTO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  competencia: text().notNull(),
  receitaReal: numeric('receita_real').default('0'),
  custoReal: numeric('custo_real').default('0'),
  economiaReal: numeric('economia_real').default('0'),
  observacoes: text(),
  criadoPor: integer('criado_por').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_roi_acompanhamento_criado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_roi_acompanhamento_projeto' }),
])

export const sessoes = ai.table('TI_PMO_SESSOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  usuarioId: integer('usuario_id').notNull(),
  token: text().notNull().unique(),
  ip: text(),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_sessoes_usuario' }),
])

export const tapVersoes = ai.table('TI_PMO_TAP_VERSOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  versao: integer().notNull(),
  label: text().notNull(),
  faseOrigem: text('fase_origem').notNull(),
  escopoInicial: text('escopo_inicial'),
  escopoFora: text('escopo_fora'),
  beneficiosTap: text('beneficios_tap'),
  areasImpactadas: jsonb('areas_impactadas'),
  objetivoDetalhado: text('objetivo_detalhado'),
  descricaoSolucao: text('descricao_solucao'),
  premissas: text(),
  restricoes: text(),
  riscosIniciais: text('riscos_iniciais'),
  investimentoTotal: numeric('investimento_total'),
  roiPrevisto: numeric('roi_previsto'),
  vpl: numeric(),
  tir: numeric(),
  paybackMeses: numeric('payback_meses'),
  criadoPor: integer('criado_por').notNull(),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  status: text().default('RASCUNHO'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  situacaoAtual: text('situacao_atual'),
  escopoFisico: text('escopo_fisico'),
  escopoSistemico: text('escopo_sistemico'),
  escopoProcesso: text('escopo_processo'),
  setoresEnvolvidos: text('setores_envolvidos'),
  etapasProjeto: text('etapas_projeto'),
  entregaveis: text(),
  pontosAtencao: text('pontos_atencao'),
  pontosDefinir: text('pontos_definir'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  dataLimiteTap: timestamp('data_limite_tap', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.aprovadoPor], foreignColumns: [usuarios.id], name: 'fk_tap_versoes_aprovado_por' }),
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_tap_versoes_criado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_tap_versoes_projeto' }),
  index('idx_tap_projeto').on(table.projetoId, table.versao),
])

export const tiPrioridades = ai.table('TI_PMO_TI_PRIORIDADES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  atividadeId: integer('atividade_id').notNull(),
  fonte: text().notNull().default('dev2026'),
  prioridade: integer(),
  confirmada: boolean().notNull().default(false),
  confirmadaEm: timestamp('confirmada_em', { withTimezone: true }),
  confirmadaPor: integer('confirmada_por'),
  confirmadaPorNome: text('confirmada_por_nome'),
  confirmadaComiteId: integer('confirmada_comite_id'),
  solicitacaoAlteracao: boolean('solicitacao_alteracao').notNull().default(false),
  solicitacaoPor: integer('solicitacao_por'),
  solicitacaoPorNome: text('solicitacao_por_nome'),
  solicitacaoEm: timestamp('solicitacao_em', { withTimezone: true }),
  solicitacaoMotivo: text('solicitacao_motivo'),
  solicitacaoNovaPrioridade: integer('solicitacao_nova_prioridade'),
  workflowId: integer('workflow_id'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  projetoId: integer('projeto_id'),
  projetoCodigo: text('projeto_codigo'),
  projetoNome: text('projeto_nome'),
}, (table) => [
  unique('ux_ti_prioridades_atividade_id_fonte').on(table.atividadeId, table.fonte),
])

export const triagens = ai.table('TI_PMO_TRIAGENS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull().unique(),
  escopoInicial: text('escopo_inicial'),
  escopoFora: text('escopo_fora'),
  beneficios: text(),
  areasImpactadas: jsonb('areas_impactadas'),
  classificacao: text(),
  complexidade: text(),
  prioridade: text(),
  observacoes: text(),
  responsavelId: integer('responsavel_id'),
  concluida: boolean().default(false),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.createdBy], foreignColumns: [usuarios.id], name: 'fk_triagens_created_by' }),
  foreignKey({ columns: [table.responsavelId], foreignColumns: [usuarios.id], name: 'fk_triagens_responsavel' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_triagens_projeto' }),
])

export const viabilidade = ai.table('TI_PMO_VIABILIDADE', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  versao: integer().notNull().default(1),
  selic: numeric(),
  taxaDesconto: numeric('taxa_desconto'),
  inflacao: numeric(),
  investimentoTotal: numeric('investimento_total'),
  receitasPrevistas: jsonb('receitas_previstas'),
  custosPrevistos: jsonb('custos_previstos'),
  economiaPrevista: jsonb('economia_prevista'),
  roi: numeric(),
  vpl: numeric(),
  tir: numeric(),
  paybackMeses: numeric('payback_meses'),
  impactoOperacional: text('impacto_operacional'),
  recursosNecessarios: text('recursos_necessarios'),
  mudancaProcesso: text('mudanca_processo'),
  tecnologias: text(),
  integrações: text(),
  infraestrutura: text(),
  riscos: jsonb(),
  impactos: jsonb(),
  dataInicioPrev: date('data_inicio_prev'),
  dataFimPrev: date('data_fim_prev'),
  marcos: jsonb(),
  status: text().default('RASCUNHO'),
  criadoPor: integer('criado_por').notNull(),
  aprovadoPor: integer('aprovado_por'),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  resumoExecutivo: text('resumo_executivo'),
  sistemasEnvolvidos: text('sistemas_envolvidos'),
  dependenciaFornecedores: text('dependencia_fornecedores'),
  recomendacao: text(),
  justificativaRecomendacao: text('justificativa_recomendacao'),
  conclusao: text(),
  capex: numeric(),
  opex: numeric(),
  opexPeriodicidade: text('opex_periodicidade').default('MENSAL'),
  economiaEstimada: numeric('economia_estimada'),
  economiaPeriodicidade: text('economia_periodicidade').default('MENSAL'),
  tipoPayback: text('tipo_payback').default('QUALITATIVO'),
  paybackInformado: numeric('payback_informado'),
  paybackUnidade: text('payback_unidade').default('MESES'),
  condicoesAprovacao: text('condicoes_aprovacao'),
  complexidadeTecnica: text('complexidade_tecnica'),
  tipoPaybackQuantitativo: boolean('tipo_payback_quantitativo'),
  tipoPaybackQualitativo: boolean('tipo_payback_qualitativo'),
  beneficiosEsperados: text('beneficios_esperados'),
  baselineValor: numeric('baseline_valor'),
  metaValor: numeric('meta_valor'),
  tipoIndicador: text('tipo_indicador').default('ABSOLUTO'),
  economiaMensalEsperada: numeric('economia_mensal_esperada'),
  ganhoTarefaAtivo: boolean('ganho_tarefa_ativo').default(false),
  ganhoTarefaSalario: numeric('ganho_tarefa_salario'),
  ganhoTarefaHorasAntes: numeric('ganho_tarefa_horas_antes'),
  ganhoTarefaHorasDepois: numeric('ganho_tarefa_horas_depois'),
  ganhoTarefaFreqMensal: numeric('ganho_tarefa_freq_mensal').default('1'),
  hcAtivo: boolean('hc_ativo').default(false),
  hcQuantidade: integer('hc_quantidade').default(1),
  hcSalarioMensal: numeric('hc_salario_mensal'),
  hcEncargosPct: numeric('hc_encargos_pct'),
  hcBeneficiosMensais: numeric('hc_beneficios_mensais'),
  hcOutrosMensais: numeric('hc_outros_mensais'),
  horasAnalistasAtivo: boolean('horas_analistas_ativo').default(false),
  horasAnalistasJson: jsonb('horas_analistas_json'),
  horasAnalistasTotal: numeric('horas_analistas_total'),
}, (table) => [
  foreignKey({ columns: [table.aprovadoPor], foreignColumns: [usuarios.id], name: 'fk_viabilidade_aprovado_por' }),
  foreignKey({ columns: [table.criadoPor], foreignColumns: [usuarios.id], name: 'fk_viabilidade_criado_por' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_viabilidade_projeto' }),
])

export const viabilidadeCapexProjecoes = ai.table('TI_PMO_VIABILIDADE_CAPEX_PROJECOES', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  viabilidadeId: integer('viabilidade_id').notNull(),
  projetoId: integer('projeto_id').notNull(),
  periodoRef: text('periodo_ref').notNull(),
  valor: numeric().notNull(),
  descricao: text().notNull(),
  usuarioId: integer('usuario_id'),
  usuarioNome: text('usuario_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.usuarioId], foreignColumns: [usuarios.id], name: 'fk_viabilidade_capex_projecoes_usuario' }),
  foreignKey({ columns: [table.projetoId], foreignColumns: [projetos.id], name: 'fk_viabilidade_capex_projecoes_projeto' }),
  foreignKey({ columns: [table.viabilidadeId], foreignColumns: [viabilidade.id], name: 'fk_viabilidade_capex_projecoes_viabilidade' }),
])

export const workflowAprovacao = ai.table('TI_PMO_WORKFLOW_APROVACAO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  projetoId: integer('projeto_id').notNull(),
  tipo: text().notNull(),
  referenciaId: integer('referencia_id').notNull(),
  etapaAtual: integer('etapa_atual').default(1),
  status: text().default('EM_ANDAMENTO'),
  criadoPor: integer('criado_por'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  modeloId: integer('modelo_id'),
})

export const workflowEtapas = ai.table('TI_PMO_WORKFLOW_ETAPAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  workflowId: integer('workflow_id').notNull(),
  ordem: integer().notNull(),
  usuarioId: integer('usuario_id').notNull(),
  usuarioNome: text('usuario_nome').notNull(),
  tipo: text().notNull(),
  status: text().default('PENDENTE'),
  observacao: text(),
  respondidoEm: timestamp('respondido_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const workflowModeloEtapas = ai.table('TI_PMO_WORKFLOW_MODELO_ETAPAS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  modeloId: integer('modelo_id').notNull(),
  ordem: integer().notNull(),
  usuarioId: integer('usuario_id').notNull(),
  usuarioNome: text('usuario_nome').notNull(),
  tipo: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const workflowModelos = ai.table('TI_PMO_WORKFLOW_MODELOS', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  nome: text().notNull(),
  descricao: text(),
  ativo: boolean().default(true),
  criadoPor: integer('criado_por'),
  criadoPorNome: text('criado_por_nome'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const workflowTiposParticipacao = ai.table('TI_PMO_WORKFLOW_TIPOS_PARTICIPACAO', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  nome: text().notNull(),
  codigo: text().notNull().unique(),
  descricao: text(),
  ativo: boolean().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

// ─── REVISAR ANTES DE APLICAR ─────────────────────────────────────────────
// Colunas classificadas como timestamptz só pelo nome (_at/_em/data_*), sem
// estar em nenhuma lista de override — conferir cada uma contra o uso real
// antes de rodar isso contra qualquer banco:
// - perfis.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - diretorias.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - diretorias.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - areas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - areas.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - usuarios.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - usuarios.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.data_conclusao_real — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.migrado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.data_pausa — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.data_base_entrega — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projetos.data_base_entrega_definida_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - aprovacoes.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - aprovacoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - auditoria.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comites.data_realizacao — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comites.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comites.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comites.resumo_ia_gerado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_ata.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_ata.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_ata_historico.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_decisoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_decisoes.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_documentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_participantes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_pendencias.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_pendencias.resolved_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - comite_projetos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_centros_custo.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_centros_custo.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_contas_contabeis.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_contas_contabeis.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_cronograma_criticidades.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_cronograma_tipos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_global.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_motivos_pausa.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_motivos_pausa.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_status_projeto.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - config_status_projeto.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_responsaveis.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronogramas.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronogramas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronogramas.deleted_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronogramas.arquivado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefas.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefas.alterado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefas.data_conclusao — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefas.data_fim_baseline — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefas.data_inicio_baseline — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_pagamento.data_primeira_parcela — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_pagamento.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_parcelas.data_vencimento — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_parcelas.data_vencimento_baseline — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_parcelas.data_pagamento — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_parcelas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_parcelas.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - cronograma_tarefa_parcelas_historico.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - documento_aprovadores.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - documentos.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - documentos.publicado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - documentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - documentos_versoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - encerramentos.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - encerramentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - estruturacao.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - estruturacao.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - execucao_atualizacoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - execucao_arquivos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_lancamentos.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_lancamentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_anexos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_contratos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_contratos.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_contrato_projecao_parcelas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_enquadramento_historico.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_movimentos.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_movimentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_movimentos.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_pagamentos.data_pagamento — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - financeiro_pagamentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - notificacoes.lida_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - notificacoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - orcamento_grupos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - orcamento_grupos.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - orcamento_itens.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - orcamento_itens.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - payback_competencias.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - payback_competencias.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - payback_lancamentos.data_lancamento — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - payback_lancamentos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - payback_lancamentos.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - payback_registros.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_areas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_fase_prazo.data_limite — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_fase_prazo.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_fase_prazo.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_fase_prazo.data_baseline — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_fase_prazo_historico.data_anterior — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_fase_prazo_historico.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_historico_alteracoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_prioridade_historico.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_snapshot_final.data_fim_prev — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_snapshot_final.data_conclusao_real — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_snapshot_final.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_status_historico.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - projeto_timeline.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - roi_acompanhamento.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - sessoes.expires_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - sessoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - tap_versoes.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - tap_versoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - tap_versoes.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - tap_versoes.data_limite_tap — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - ti_prioridades.confirmada_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - ti_prioridades.solicitacao_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - ti_prioridades.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - ti_prioridades.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - triagens.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - triagens.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - viabilidade.aprovado_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - viabilidade.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - viabilidade.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - viabilidade_capex_projecoes.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_aprovacao.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_etapas.respondido_em — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_etapas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_modelo_etapas.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_modelos.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_modelos.updated_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
// - workflow_tipos_participacao.created_at — classificada como timestamptz por nome; conferir se é data pura antes de aplicar
