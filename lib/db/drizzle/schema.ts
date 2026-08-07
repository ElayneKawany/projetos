/**
 * Drizzle ORM Schema — MegaG PMO
 *
 * Espelha as tabelas definidas em lib/db/schema.sql e as migrations em lib/db/index.ts.
 * Este arquivo é a fonte de verdade para geração de migrations via drizzle-kit.
 *
 * Para gerar migrations: npx drizzle-kit generate
 * Para inspecionar o banco:  npx drizzle-kit studio
 *
 * Nota: o banco atual usa better-sqlite3 diretamente nos repositories (legado).
 * A migração gradual para Drizzle acontece substituindo repositories individualmente.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Utilitário ───────────────────────────────────────────────────────────────

const timestamps = {
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}

// ─── Configurações ────────────────────────────────────────────────────────────

export const configGlobal = sqliteTable('config_global', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  chave:      text('chave').notNull().unique(),
  valor:      text('valor').notNull(),
  descricao:  text('descricao'),
  updated_by: integer('updated_by'),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Estrutura Organizacional ─────────────────────────────────────────────────

export const diretorias = sqliteTable('diretorias', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  codigo:    text('codigo').notNull().unique(),
  nome:      text('nome').notNull(),
  sigla:     text('sigla').notNull(),
  ativo:     integer('ativo').notNull().default(1),
  ...timestamps,
})

export const areas = sqliteTable('areas', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  diretoria_id: integer('diretoria_id').notNull().references(() => diretorias.id),
  codigo:       text('codigo').notNull().unique(),
  nome:         text('nome').notNull(),
  sigla:        text('sigla').notNull(),
  ativo:        integer('ativo').notNull().default(1),
  created_at:   text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Usuários e Perfis ────────────────────────────────────────────────────────

export const perfis = sqliteTable('perfis', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  codigo:      text('codigo').notNull().unique(),
  nome:        text('nome').notNull(),
  descricao:   text('descricao'),
  permissoes:  text('permissoes').notNull().default('{}'),
  ativo:       integer('ativo').notNull().default(1),
  created_at:  text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const usuarios = sqliteTable('usuarios', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  cpf:          text('cpf').notNull().unique(),
  nome:         text('nome').notNull(),
  email:        text('email').notNull().unique(),
  senha_hash:   text('senha_hash').notNull(),
  cargo:        text('cargo'),
  diretoria_id: integer('diretoria_id').references(() => diretorias.id),
  area_id:      integer('area_id').references(() => areas.id),
  perfil_id:    integer('perfil_id').notNull().references(() => perfis.id),
  ativo:        integer('ativo').notNull().default(1),
  ultimo_login: text('ultimo_login'),
  ...timestamps,
})

// ─── Projetos ─────────────────────────────────────────────────────────────────

export const projetos = sqliteTable('projetos', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  codigo:           text('codigo').notNull().unique(),
  nome:             text('nome').notNull(),
  solicitante_id:   integer('solicitante_id').notNull().references(() => usuarios.id),
  diretoria_id:     integer('diretoria_id').notNull().references(() => diretorias.id),
  area_id:          integer('area_id').notNull().references(() => areas.id),
  ponto_focal:      text('ponto_focal'),
  contato:          text('contato'),
  objetivo:         text('objetivo').notNull(),
  descricao:        text('descricao'),
  beneficios:       text('beneficios'),
  status:           text('status').notNull().default('PROPOSTA'),
  classificacao:    text('classificacao'),
  complexidade:     text('complexidade'),
  prioridade:       text('prioridade').default('MEDIA'),
  gerente_id:       integer('gerente_id').references(() => usuarios.id),
  capex_aprovado:   real('capex_aprovado').default(0),
  opex_aprovado:    real('opex_aprovado').default(0),
  data_inicio_prev: text('data_inicio_prev'),
  data_fim_prev:    text('data_fim_prev'),
  data_golive:      text('data_golive'),
  ativo:            integer('ativo').notNull().default(1),
  created_by:       integer('created_by').notNull().references(() => usuarios.id),
  ...timestamps,
})

export const projetoStatusHistorico = sqliteTable('projeto_status_historico', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  projeto_id: integer('projeto_id').notNull().references(() => projetos.id),
  status_de:  text('status_de').notNull(),
  status_para: text('status_para').notNull(),
  motivo:     text('motivo'),
  usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── TAP ──────────────────────────────────────────────────────────────────────

export const tapVersoes = sqliteTable('tap_versoes', {
  id:                 integer('id').primaryKey({ autoIncrement: true }),
  projeto_id:         integer('projeto_id').notNull().references(() => projetos.id),
  versao:             integer('versao').notNull().default(1),
  label:              text('label').notNull(),
  status:             text('status').notNull().default('RASCUNHO'),
  fase_origem:        text('fase_origem').notNull(),
  escopo_inicial:     text('escopo_inicial'),
  escopo_fora:        text('escopo_fora'),
  beneficios_tap:     text('beneficios_tap'),
  areas_impactadas:   text('areas_impactadas'),
  objetivo_detalhado: text('objetivo_detalhado'),
  descricao_solucao:  text('descricao_solucao'),
  premissas:          text('premissas'),
  restricoes:         text('restricoes'),
  riscos_iniciais:    text('riscos_iniciais'),
  investimento_total: real('investimento_total'),
  roi_previsto:       real('roi_previsto'),
  payback_meses:      integer('payback_meses'),
  criado_por:         integer('criado_por').notNull().references(() => usuarios.id),
  aprovado_por:       integer('aprovado_por').references(() => usuarios.id),
  created_at:         text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at:         text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Estudo de Viabilidade ────────────────────────────────────────────────────

export const viabilidadeVersoes = sqliteTable('viabilidade_versoes', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  projeto_id:  integer('projeto_id').notNull().references(() => projetos.id),
  versao:      integer('versao').notNull().default(1),
  label:       text('label').notNull(),
  status:      text('status').notNull().default('RASCUNHO'),
  capex:       real('capex'),
  opex:        real('opex'),
  roi:         real('roi'),
  tir:         real('tir'),
  vpl:         real('vpl'),
  payback_informado: real('payback_informado'),
  payback_unidade:   text('payback_unidade'),
  criado_por:  integer('criado_por').notNull().references(() => usuarios.id),
  created_at:  text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at:  text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Cronograma ───────────────────────────────────────────────────────────────

export const cronogramas = sqliteTable('cronogramas', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  projeto_id: integer('projeto_id').notNull().references(() => projetos.id),
  versao:     integer('versao').notNull().default(1),
  label:      text('label').notNull(),
  status:     text('status').notNull().default('RASCUNHO'),
  criado_por: integer('criado_por').notNull().references(() => usuarios.id),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const cronogramaTarefas = sqliteTable('cronograma_tarefas', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  cronograma_id:   integer('cronograma_id').notNull().references(() => cronogramas.id),
  parent_id:       integer('parent_id'),
  nivel:           text('nivel').notNull().default('TAREFA'),
  nome:            text('nome').notNull(),
  tipo:            text('tipo'),
  responsavel_id:  integer('responsavel_id').references(() => usuarios.id),
  data_inicio:     text('data_inicio'),
  data_fim:        text('data_fim'),
  duracao_dias:    integer('duracao_dias'),
  percentual:      real('percentual').default(0),
  status:          text('status').default('PENDENTE'),
  ordem:           integer('ordem').default(0),
  criado_por:      integer('criado_por').references(() => usuarios.id),
  created_at:      text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at:      text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Financeiro ───────────────────────────────────────────────────────────────

export const financeiroContratos = sqliteTable('financeiro_contratos', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  projeto_id:          integer('projeto_id').notNull().references(() => projetos.id),
  numero_contrato:     text('numero_contrato'),
  contratado:          text('contratado').notNull(),
  tipo_contrato:       text('tipo_contrato'),
  descricao_servico:   text('descricao_servico'),
  valor_aprovado:      real('valor_aprovado').default(0),
  natureza_financeira: text('natureza_financeira'),
  status:              text('status').default('ATIVO'),
  observacao:          text('observacao'),
  ativo:               integer('ativo').default(1),
  criado_por:          integer('criado_por').references(() => usuarios.id),
  ...timestamps,
})

export const financeiroPagamentos = sqliteTable('financeiro_pagamentos', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  contrato_id:      integer('contrato_id').references(() => financeiroContratos.id),
  numero_documento: text('numero_documento'),
  tipo_documento:   text('tipo_documento').default('NF'),
  nota_fiscal:      text('nota_fiscal'),
  data_pagamento:   text('data_pagamento'),
  competencia:      text('competencia'),
  valor_pago:       real('valor_pago').notNull(),
  observacao:       text('observacao'),
  arquivo_path:     text('arquivo_path'),
  ativo:            integer('ativo').default(1),
  criado_por:       integer('criado_por').references(() => usuarios.id),
  created_at:       text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Orçamento ────────────────────────────────────────────────────────────────

export const orcamentoGrupos = sqliteTable('orcamento_grupos', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  projeto_id:    integer('projeto_id').notNull().references(() => projetos.id),
  tipo:          text('tipo').notNull(),
  nome:          text('nome').notNull(),
  viabilidade_id: integer('viabilidade_id'),
  cor:           text('cor'),
  icone:         text('icone'),
  ordem:         integer('ordem'),
  ativo:         integer('ativo').default(1),
  created_at:    text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const orcamentoItens = sqliteTable('orcamento_itens', {
  id:                     integer('id').primaryKey({ autoIncrement: true }),
  grupo_id:               integer('grupo_id').notNull().references(() => orcamentoGrupos.id),
  projeto_id:             integer('projeto_id').notNull().references(() => projetos.id),
  nome:                   text('nome').notNull(),
  descricao:              text('descricao'),
  valor_aprovado:         real('valor_aprovado').notNull().default(0),
  conta_contabil_id:      integer('conta_contabil_id'),
  centro_custo_id:        integer('centro_custo_id'),
  prioridade:             text('prioridade'),
  responsavel_usuario_id: integer('responsavel_usuario_id').references(() => usuarios.id),
  ordem:                  integer('ordem'),
  ativo:                  integer('ativo').default(1),
  created_at:             text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Comitês ──────────────────────────────────────────────────────────────────

export const comites = sqliteTable('comites', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  titulo:            text('titulo').notNull(),
  tipo:              text('tipo'),
  status:            text('status').default('AGENDADO'),
  data_realizacao:   text('data_realizacao'),
  hora:              text('hora'),
  local:             text('local'),
  pauta:             text('pauta'),
  decisao_geral:     text('decisao_geral'),
  periodo_inicio:    text('periodo_inicio'),
  periodo_fim:       text('periodo_fim'),
  diretorias_ids:    text('diretorias_ids'),
  resumo_executivo_ia: text('resumo_executivo_ia'),
  resumo_ia_gerado_em: text('resumo_ia_gerado_em'),
  criado_por:        integer('criado_por').references(() => usuarios.id),
  ...timestamps,
})

export const comiteParticipantes = sqliteTable('comite_participantes', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  comite_id:     integer('comite_id').notNull().references(() => comites.id),
  usuario_id:    integer('usuario_id').references(() => usuarios.id),
  nome_externo:  text('nome_externo'),
  cargo:         text('cargo'),
  presente:      integer('presente').default(0),
  confirmado:    integer('confirmado').default(0),
  created_at:    text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const comiteDecisoes = sqliteTable('comite_decisoes', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  comite_id:        integer('comite_id').notNull().references(() => comites.id),
  projeto_id:       integer('projeto_id').references(() => projetos.id),
  tipo:             text('tipo').default('PENDENTE'),
  descricao:        text('descricao').notNull(),
  responsavel_nome: text('responsavel_nome'),
  prazo:            text('prazo'),
  status:           text('status').default('PENDENTE'),
  created_at:       text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at:       text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const comitePendencias = sqliteTable('comite_pendencias', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  comite_id:        integer('comite_id').notNull().references(() => comites.id),
  projeto_id:       integer('projeto_id').references(() => projetos.id),
  descricao:        text('descricao').notNull(),
  responsavel_nome: text('responsavel_nome'),
  prazo:            text('prazo'),
  status:           text('status').default('ABERTA'),
  resolved_at:      text('resolved_at'),
  resolved_by:      integer('resolved_by').references(() => usuarios.id),
  created_at:       text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at:       text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Aprovações ───────────────────────────────────────────────────────────────

export const aprovacoes = sqliteTable('aprovacoes', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  projeto_id:      integer('projeto_id').notNull().references(() => projetos.id),
  tipo_documento:  text('tipo_documento').notNull(),
  documento_id:    integer('documento_id').notNull(),
  aprovador_id:    integer('aprovador_id').notNull().references(() => usuarios.id),
  ordem:           integer('ordem').default(1),
  tipo:            text('tipo').default('APROVACAO'),
  status:          text('status').default('PENDENTE'),
  observacao_apr:  text('observacao_apr'),
  data_decisao:    text('data_decisao'),
  ...timestamps,
})

// ─── Auditoria ────────────────────────────────────────────────────────────────

export const auditoria = sqliteTable('auditoria', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  entidade:     text('entidade').notNull(),
  entidade_id:  integer('entidade_id'),
  acao:         text('acao').notNull(),
  dados_antes:  text('dados_antes'),
  dados_depois: text('dados_depois'),
  usuario_id:   integer('usuario_id').references(() => usuarios.id),
  usuario_nome: text('usuario_nome'),
  ip:           text('ip'),
  created_at:   text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// ─── Payback ──────────────────────────────────────────────────────────────────

export const paybackLancamentos = sqliteTable('payback_lancamentos', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  projeto_id:          integer('projeto_id').notNull().references(() => projetos.id),
  competencia:         text('competencia').notNull(),
  data_lancamento:     text('data_lancamento').notNull(),
  investimento_periodo: real('investimento_periodo'),
  beneficio_periodo:   real('beneficio_periodo'),
  tipo_beneficio:      text('tipo_beneficio'),
  observacao:          text('observacao'),
  criado_por:          integer('criado_por').references(() => usuarios.id),
  created_at:          text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at:          text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const paybackRegistros = sqliteTable('payback_registros', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  projeto_id: integer('projeto_id').notNull().references(() => projetos.id),
  data:       text('data').notNull(),
  valor_real: real('valor_real').notNull(),
  origem:     text('origem').default('manual'),
  observacao: text('observacao'),
  criado_por: integer('criado_por').references(() => usuarios.id),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const paybackCompetencias = sqliteTable('payback_competencias', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  projeto_id: integer('projeto_id').notNull().references(() => projetos.id),
  ano:        integer('ano').notNull(),
  mes:        integer('mes').notNull(),
  receita:    real('receita').default(0),
  economia:   real('economia').default(0),
  capex:      real('capex').default(0),
  opex:       real('opex').default(0),
  observacao: text('observacao'),
  criado_por: integer('criado_por').references(() => usuarios.id),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})
