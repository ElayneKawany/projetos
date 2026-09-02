-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `config_global` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`chave` text NOT NULL,
	`valor` text NOT NULL,
	`descricao` text,
	`updated_by` integer,
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `diretorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`nome` text NOT NULL,
	`sigla` text NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`descricao` text,
	`updated_at` numeric,
	`diretor_responsavel_id` integer,
	`ordem` integer DEFAULT 99
);
--> statement-breakpoint
CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`diretoria_id` integer NOT NULL,
	`codigo` text NOT NULL,
	`nome` text NOT NULL,
	`sigla` text NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`descricao` text,
	`updated_at` numeric,
	FOREIGN KEY (`diretoria_id`) REFERENCES `diretorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `perfis` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`permissoes` text DEFAULT '{}' NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cpf` text NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`cargo` text,
	`diretoria_id` integer,
	`area_id` integer,
	`perfil_id` integer NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`ultimo_login` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`perfil_id`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`diretoria_id`) REFERENCES `diretorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`usuario_id` integer NOT NULL,
	`token` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`expires_at` numeric NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projetos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`nome` text NOT NULL,
	`solicitante_id` integer NOT NULL,
	`diretoria_id` integer NOT NULL,
	`area_id` integer NOT NULL,
	`ponto_focal` text,
	`contato` text,
	`objetivo` text NOT NULL,
	`descricao` text,
	`beneficios` text,
	`status` text DEFAULT 'PROPOSTA' NOT NULL,
	`classificacao` text,
	`complexidade` text,
	`prioridade` text DEFAULT 'MEDIA',
	`gerente_id` integer,
	`capex_aprovado` real DEFAULT 0,
	`opex_aprovado` real DEFAULT 0,
	`data_inicio_prev` numeric,
	`data_fim_prev` numeric,
	`data_golive` numeric,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`justificativa` text,
	`data_conclusao_real` text,
	`hora_conclusao` text,
	`responsavel_conclusao` text,
	`motivo_conclusao` text,
	`checklist_conclusao` text,
	`projeto_migrado` integer DEFAULT 0,
	`motivo_pausa_id` integer,
	`pmo_responsavel` text,
	`tipo_beneficio` text,
	`cronograma_pendente` integer DEFAULT 0,
	`migrado_em` text,
	`migrado_por` integer,
	`data_pausa` text,
	`usuario_pausa` integer,
	`pmo_responsavel_id` integer,
	`origem_dados` text,
	`arquivo_origem` text,
	`data_base_entrega` text,
	`data_base_entrega_definida_em` text,
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gerente_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`diretoria_id`) REFERENCES `diretorias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_projetos_gerente` ON `projetos` (`gerente_id`);--> statement-breakpoint
CREATE INDEX `idx_projetos_diretoria` ON `projetos` (`diretoria_id`);--> statement-breakpoint
CREATE INDEX `idx_projetos_status` ON `projetos` (`status`);--> statement-breakpoint
CREATE TABLE `projeto_status_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`status_de` text NOT NULL,
	`status_para` text NOT NULL,
	`motivo` text,
	`usuario_id` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projeto_prioridade_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`prioridade_de` text NOT NULL,
	`prioridade_para` text NOT NULL,
	`motivo` text,
	`usuario_id` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projeto_areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`area_id` integer NOT NULL,
	`responsavel_id` integer,
	`papel` text,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tap_versoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`versao` integer NOT NULL,
	`label` text NOT NULL,
	`fase_origem` text NOT NULL,
	`escopo_inicial` text,
	`escopo_fora` text,
	`beneficios_tap` text,
	`areas_impactadas` text,
	`objetivo_detalhado` text,
	`descricao_solucao` text,
	`premissas` text,
	`restricoes` text,
	`riscos_iniciais` text,
	`investimento_total` real,
	`roi_previsto` real,
	`vpl` real,
	`tir` real,
	`payback_meses` real,
	`criado_por` integer NOT NULL,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`status` text DEFAULT 'RASCUNHO',
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`situacao_atual` text,
	`escopo_fisico` text,
	`escopo_sistemico` text,
	`escopo_processo` text,
	`setores_envolvidos` text,
	`etapas_projeto` text,
	`entregaveis` text,
	`pontos_atencao` text,
	`pontos_definir` text,
	`updated_at` numeric,
	`data_limite_tap` text,
	FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tap_projeto` ON `tap_versoes` (`projeto_id`,`versao`);--> statement-breakpoint
CREATE TABLE `triagens` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`escopo_inicial` text,
	`escopo_fora` text,
	`beneficios` text,
	`areas_impactadas` text,
	`classificacao` text,
	`complexidade` text,
	`prioridade` text,
	`observacoes` text,
	`responsavel_id` integer,
	`concluida` integer DEFAULT 0,
	`created_by` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comites` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`titulo` text NOT NULL,
	`tipo` text DEFAULT 'IDEIAS' NOT NULL,
	`data_realizacao` numeric NOT NULL,
	`local` text,
	`pauta` text,
	`decisao_geral` text,
	`status` text DEFAULT 'AGENDADO',
	`created_by` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`hora` text,
	`periodo_inicio` text,
	`periodo_fim` text,
	`descricao` text,
	`resumo_executivo_ia` text,
	`resumo_ia_gerado_em` text,
	`resumo_executivo_ia_json` text,
	`diretorias_ids` text,
	`observacoes` text,
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_participantes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`usuario_id` integer,
	`nome_externo` text,
	`cargo` text,
	`presente` integer DEFAULT 0,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`confirmado` integer DEFAULT 0,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_projetos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`projeto_id` integer NOT NULL,
	`pauta_item` text,
	`decisao` text,
	`observacoes` text,
	`snap_prioridade` text,
	`snap_complexidade` text,
	`snap_investimento` real,
	`snap_roi` real,
	`snap_payback` real,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`ordem_pauta` integer DEFAULT 0,
	`tempo_previsto` integer,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_documentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`nome` text NOT NULL,
	`caminho` text NOT NULL,
	`tipo` text,
	`created_by` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `viabilidade` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`versao` integer DEFAULT 1 NOT NULL,
	`selic` real,
	`taxa_desconto` real,
	`inflacao` real,
	`investimento_total` real,
	`receitas_previstas` text,
	`custos_previstos` text,
	`economia_prevista` text,
	`roi` real,
	`vpl` real,
	`tir` real,
	`payback_meses` real,
	`impacto_operacional` text,
	`recursos_necessarios` text,
	`mudanca_processo` text,
	`tecnologias` text,
	`integrações` text,
	`infraestrutura` text,
	`riscos` text,
	`impactos` text,
	`data_inicio_prev` numeric,
	`data_fim_prev` numeric,
	`marcos` text,
	`status` text DEFAULT 'RASCUNHO',
	`criado_por` integer NOT NULL,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`resumo_executivo` text,
	`sistemas_envolvidos` text,
	`dependencia_fornecedores` text,
	`recomendacao` text,
	`justificativa_recomendacao` text,
	`conclusao` text,
	`capex` real,
	`opex` real,
	`opex_periodicidade` text DEFAULT 'MENSAL',
	`economia_estimada` real,
	`economia_periodicidade` text DEFAULT 'MENSAL',
	`tipo_payback` text DEFAULT 'QUALITATIVO',
	`payback_informado` real,
	`payback_unidade` text DEFAULT 'MESES',
	`condicoes_aprovacao` text,
	`complexidade_tecnica` text,
	`tipo_payback_quantitativo` integer,
	`tipo_payback_qualitativo` integer,
	`beneficios_esperados` text,
	`baseline_valor` real,
	`meta_valor` real,
	`tipo_indicador` text DEFAULT 'ABSOLUTO',
	`economia_mensal_esperada` real,
	`ganho_tarefa_ativo` integer DEFAULT 0,
	`ganho_tarefa_salario` real,
	`ganho_tarefa_horas_antes` real,
	`ganho_tarefa_horas_depois` real,
	`ganho_tarefa_freq_mensal` real DEFAULT 1,
	`hc_ativo` integer DEFAULT 0,
	`hc_quantidade` integer DEFAULT 1,
	`hc_salario_mensal` real,
	`hc_encargos_pct` real,
	`hc_beneficios_mensais` real,
	`hc_outros_mensais` real,
	`horas_analistas_ativo` integer DEFAULT 0,
	`horas_analistas_json` text,
	`horas_analistas_total` real,
	FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `financeiro_lancamentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`categoria` text NOT NULL,
	`descricao` text NOT NULL,
	`fornecedor` text,
	`numero_doc` text,
	`valor` real NOT NULL,
	`data_lancamento` numeric NOT NULL,
	`competencia` text,
	`observacoes` text,
	`arquivo_path` text,
	`criado_por` integer NOT NULL,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`status` text DEFAULT 'PENDENTE',
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`item_id` integer,
	FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lancamentos_projeto` ON `financeiro_lancamentos` (`projeto_id`,`tipo`);--> statement-breakpoint
CREATE TABLE `roi_acompanhamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`competencia` text NOT NULL,
	`receita_real` real DEFAULT 0,
	`custo_real` real DEFAULT 0,
	`economia_real` real DEFAULT 0,
	`observacoes` text,
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `estruturacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`gerente_id` integer,
	`patrocinador_id` integer,
	`metodologia` text,
	`escopo_detalhado` text,
	`entregas` text,
	`observacoes` text,
	`concluida` integer DEFAULT 0,
	`created_by` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patrocinador_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gerente_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cronogramas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`versao` integer DEFAULT 1 NOT NULL,
	`label` text NOT NULL,
	`is_baseline` integer DEFAULT 0,
	`status` text DEFAULT 'ATIVO',
	`motivo_replano` text,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`fonte_importacao` text DEFAULT 'MANUAL',
	`arquivo_origem` text,
	`modo` text DEFAULT 'CENTRALIZADO' NOT NULL,
	`ativo` integer DEFAULT 1,
	`deleted_at` text,
	`arquivado` integer DEFAULT 0,
	`arquivado_por` integer,
	`arquivado_em` text,
	FOREIGN KEY (`arquivado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cronogramas_projeto_versao` ON `cronogramas` (`projeto_id`,`versao`);--> statement-breakpoint
CREATE INDEX `idx_cronograma_projeto` ON `cronogramas` (`projeto_id`);--> statement-breakpoint
CREATE TABLE `cronograma_tarefas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cronograma_id` integer NOT NULL,
	`parent_id` integer,
	`nivel` integer DEFAULT 1,
	`ordem` integer DEFAULT 0,
	`codigo` text,
	`nome` text NOT NULL,
	`responsavel_id` integer,
	`data_inicio` numeric,
	`data_fim` numeric,
	`duracao_dias` integer,
	`dependencias` text,
	`percentual` integer DEFAULT 0,
	`bloqueio` integer DEFAULT 0,
	`motivo_bloqueio` text,
	`status` text DEFAULT 'NAO_INICIADA',
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`area_id` integer,
	`tipo` text DEFAULT 'TAREFA',
	`criticidade` text DEFAULT 'NORMAL',
	`observacoes` text,
	`motivo_atraso` text,
	`dependencia_id` integer,
	`peso` real DEFAULT 1,
	`alterado_por` integer,
	`alterado_em` text,
	`executor_id` integer,
	`criado_por` integer,
	`descricao` text,
	`data_conclusao` text,
	`concluido_por` integer,
	`prazo_status` text,
	`responsavel_nome_ext` text,
	`executor_nome_ext` text,
	`ativo` integer DEFAULT 1,
	`tipo_macro` text DEFAULT 'OUTRO',
	`data_fim_baseline` text,
	`data_inicio_baseline` text,
	`natureza_tarefa` text DEFAULT 'NORMAL',
	FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `cronograma_tarefas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cronograma_id`) REFERENCES `cronogramas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `execucao_atualizacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`tarefa_id` integer,
	`tipo` text NOT NULL,
	`descricao` text NOT NULL,
	`percentual` integer,
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tarefa_id`) REFERENCES `cronograma_tarefas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `execucao_arquivos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`atualizacao_id` integer NOT NULL,
	`nome` text NOT NULL,
	`caminho` text NOT NULL,
	`tipo_mime` text,
	`tamanho_bytes` integer,
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`atualizacao_id`) REFERENCES `execucao_atualizacoes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notificacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`usuario_id` integer NOT NULL,
	`projeto_id` integer,
	`tipo` text NOT NULL,
	`titulo` text NOT NULL,
	`mensagem` text NOT NULL,
	`lida` integer DEFAULT 0,
	`lida_em` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notificacoes_usuario` ON `notificacoes` (`usuario_id`,`lida`);--> statement-breakpoint
CREATE TABLE `aprovacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`referencia_id` integer,
	`referencia_tipo` text,
	`status` text DEFAULT 'PENDENTE',
	`solicitante_id` integer NOT NULL,
	`aprovador_id` integer,
	`observacao_req` text,
	`observacao_apr` text,
	`aprovado_em` numeric,
	`prazo` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`aprovador_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_aprovacoes_status` ON `aprovacoes` (`status`,`aprovador_id`);--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer,
	`tipo` text NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`versao` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'RASCUNHO',
	`gerado_auto` integer DEFAULT 0,
	`caminho` text,
	`conteudo_json` text,
	`criado_por` integer NOT NULL,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`publicado_em` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documentos_versoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`documento_id` integer NOT NULL,
	`versao` integer NOT NULL,
	`status` text,
	`caminho` text,
	`conteudo_json` text,
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `encerramentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`licoes_aprendidas` text,
	`roi_previsto` real,
	`roi_realizado` real,
	`payback_previsto` real,
	`payback_realizado` real,
	`capex_previsto` real,
	`capex_realizado` real,
	`opex_previsto` real,
	`opex_realizado` real,
	`economia_prevista` real,
	`economia_realizada` real,
	`avaliacao_geral` text,
	`recomendacoes` text,
	`criado_por` integer NOT NULL,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `auditoria` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`usuario_id` integer,
	`usuario_nome` text,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` integer,
	`projeto_id` integer,
	`descricao` text NOT NULL,
	`dados_antes` text,
	`dados_depois` text,
	`ip` text,
	`user_agent` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_auditoria_usuario` ON `auditoria` (`usuario_id`);--> statement-breakpoint
CREATE INDEX `idx_auditoria_projeto` ON `auditoria` (`projeto_id`);--> statement-breakpoint
CREATE INDEX `idx_auditoria_entidade` ON `auditoria` (`entidade`,`entidade_id`);--> statement-breakpoint
CREATE TABLE `documento_aprovadores` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`tipo_documento` text NOT NULL,
	`usuario_id` integer NOT NULL,
	`ordem` integer DEFAULT 1,
	`obrigatorio` integer DEFAULT 1,
	`ativo` integer DEFAULT 1,
	`created_by` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_doc_aprovadores_tipo` ON `documento_aprovadores` (`tipo_documento`,`ativo`);--> statement-breakpoint
CREATE TABLE `financeiro_anexos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`lancamento_id` integer NOT NULL,
	`nome` text NOT NULL,
	`caminho` text NOT NULL,
	`tipo_mime` text,
	`tamanho_bytes` integer,
	`tipo_anexo` text DEFAULT 'NF',
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lancamento_id`) REFERENCES `financeiro_lancamentos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_financeiro_anexos` ON `financeiro_anexos` (`lancamento_id`);--> statement-breakpoint
CREATE TABLE `config_status_projeto` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`label` text NOT NULL,
	`descricao` text,
	`cor` text DEFAULT '#6B7280',
	`ordem` integer DEFAULT 0,
	`ativo` integer DEFAULT 1,
	`is_initial` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `projeto_historico_alteracoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`usuario_id` integer,
	`usuario_nome` text,
	`campo` text NOT NULL,
	`valor_anterior` text,
	`valor_novo` text,
	`acao` text DEFAULT 'UPDATE',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `workflow_aprovacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`referencia_id` integer NOT NULL,
	`etapa_atual` integer DEFAULT 1,
	`status` text DEFAULT 'EM_ANDAMENTO',
	`criado_por` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`modelo_id` integer
);
--> statement-breakpoint
CREATE TABLE `workflow_etapas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`workflow_id` integer NOT NULL,
	`ordem` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`usuario_nome` text NOT NULL,
	`tipo` text NOT NULL,
	`status` text DEFAULT 'PENDENTE',
	`observacao` text,
	`respondido_em` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `workflow_tipos_participacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nome` text NOT NULL,
	`codigo` text NOT NULL,
	`descricao` text,
	`ativo` integer DEFAULT 1,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `workflow_modelos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nome` text NOT NULL,
	`descricao` text,
	`ativo` integer DEFAULT 1,
	`criado_por` integer,
	`criado_por_nome` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `workflow_modelo_etapas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`modelo_id` integer NOT NULL,
	`ordem` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`usuario_nome` text NOT NULL,
	`tipo` text NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `config_contas_contabeis` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`descricao` text NOT NULL,
	`tipo` text DEFAULT 'CAPEX_ATIVO' NOT NULL,
	`empresa` text,
	`filial` text,
	`integracao_codigo` text,
	`ativo` integer DEFAULT 1 NOT NULL,
	`data_inicio` numeric,
	`data_fim` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `config_centros_custo` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`descricao` text NOT NULL,
	`empresa` text,
	`filial` text,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `orcamento_grupos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`viabilidade_id` integer,
	`tipo` text DEFAULT 'CAPEX_ATIVO' NOT NULL,
	`nome` text NOT NULL,
	`cor` text,
	`icone` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`criado_por` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `orcamento_itens` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`grupo_id` integer NOT NULL,
	`projeto_id` integer NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`conta_contabil_id` integer,
	`centro_custo_id` integer,
	`valor_aprovado` real DEFAULT 0 NOT NULL,
	`valor_revisado` real,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`prioridade` text DEFAULT 'MEDIA' NOT NULL,
	`responsavel_usuario_id` integer,
	`ordem` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`criado_por` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `financeiro_movimentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`item_id` integer,
	`tipo_movimento` text DEFAULT 'NF' NOT NULL,
	`numero_doc` text,
	`fornecedor` text,
	`valor_total` real DEFAULT 0 NOT NULL,
	`data_emissao` numeric,
	`data_vencimento` numeric,
	`status` text DEFAULT 'PENDENTE' NOT NULL,
	`observacoes` text,
	`arquivo_path` text,
	`criado_por` integer NOT NULL,
	`aprovado_por` integer,
	`aprovado_em` numeric,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `financeiro_pagamentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`movimento_id` integer NOT NULL,
	`projeto_id` integer NOT NULL,
	`valor_pago` real NOT NULL,
	`data_pagamento` numeric NOT NULL,
	`observacoes` text,
	`criado_por` integer NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`contrato_id` integer,
	`numero_documento` text,
	`tipo_documento` text DEFAULT 'NF',
	`nota_fiscal` text,
	`competencia` text,
	`arquivo_path` text,
	`ativo` integer DEFAULT 1,
	`observacao` text,
	`comprovante` text,
	`enquadramento_status` text,
	`contratos_candidatos` text,
	`fornecedor` text
);
--> statement-breakpoint
CREATE TABLE `projeto_timeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`modulo` text NOT NULL,
	`artefato` text NOT NULL,
	`evento` text NOT NULL,
	`origem` text DEFAULT 'MANUAL' NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`usuario_id` integer,
	`usuario_nome` text,
	`referencia_id` integer,
	`referencia_tipo` text,
	`dados_json` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `config_cronograma_tipos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`label` text NOT NULL,
	`ordem` integer DEFAULT 0,
	`ativo` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `config_cronograma_criticidades` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`label` text NOT NULL,
	`cor` text DEFAULT '#6B7280',
	`ordem` integer DEFAULT 0,
	`ativo` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `financeiro_contratos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`numero_contrato` text,
	`contratado` text NOT NULL,
	`tipo_contrato` text DEFAULT 'SERVICO' NOT NULL,
	`descricao_servico` text,
	`valor_aprovado` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`observacoes` text,
	`ativo` integer DEFAULT 1 NOT NULL,
	`criado_por` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`observacao` text,
	`natureza_financeira` text DEFAULT 'CAPEX' NOT NULL,
	`categoria` text,
	`tipo_projecao` text DEFAULT 'NENHUMA'
);
--> statement-breakpoint
CREATE TABLE `projeto_snapshot_final` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`roi_previsto` real,
	`roi_atual` real,
	`capex_previsto` real,
	`capex_executado` real,
	`opex_previsto` real,
	`opex_executado` real,
	`economia_prevista` real,
	`economia_realizada` real,
	`data_fim_prev` text,
	`data_conclusao_real` text,
	`dias_desvio` integer,
	`responsavel` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `config_checklist_conclusao` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`codigo` text NOT NULL,
	`label` text NOT NULL,
	`obrigatorio` integer DEFAULT 0 NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payback_competencias` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`ano` integer NOT NULL,
	`mes` integer NOT NULL,
	`receita` real DEFAULT 0 NOT NULL,
	`economia` real DEFAULT 0 NOT NULL,
	`capex` real DEFAULT 0 NOT NULL,
	`opex` real DEFAULT 0 NOT NULL,
	`fluxo` real DEFAULT 0 NOT NULL,
	`observacao` text,
	`status` text DEFAULT 'RASCUNHO' NOT NULL,
	`criado_por` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `config_motivos_pausa` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nome` text NOT NULL,
	`descricao` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `cronograma_responsaveis` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cronograma_tarefa_id` integer NOT NULL,
	`usuario_id` integer,
	`usuario_nome_ext` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `payback_registros` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`data` text NOT NULL,
	`valor_real` real NOT NULL,
	`origem` text DEFAULT 'manual' NOT NULL,
	`observacao` text,
	`criado_por` integer,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `payback_lancamentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`competencia` text NOT NULL,
	`data_lancamento` text NOT NULL,
	`investimento_periodo` real DEFAULT 0 NOT NULL,
	`beneficio_periodo` real DEFAULT 0 NOT NULL,
	`observacao` text,
	`usuario_id` integer,
	`usuario_nome` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`tipo_beneficio` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_decisoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`projeto_id` integer,
	`tipo` text DEFAULT 'PENDENTE' NOT NULL,
	`descricao` text NOT NULL,
	`responsavel_nome` text,
	`prazo` text,
	`status` text DEFAULT 'PENDENTE',
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_pendencias` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`projeto_id` integer,
	`descricao` text NOT NULL,
	`responsavel_nome` text,
	`prazo` text,
	`status` text DEFAULT 'ABERTA',
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`resolved_at` text,
	`resolved_by` integer,
	FOREIGN KEY (`resolved_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_ata` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`conteudo` text,
	`versao` integer DEFAULT 1,
	`gerado_por_ia` integer DEFAULT 0,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`transcricao` text,
	`conteudo_json` text,
	`status` text DEFAULT 'RASCUNHO',
	`hora_inicio` text,
	`hora_fim` text,
	`duracao_min` integer,
	FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comite_ata_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`comite_id` integer NOT NULL,
	`ata_id` integer NOT NULL,
	`versao` integer NOT NULL,
	`conteudo_snap` text,
	`acao` text NOT NULL,
	`usuario_id` integer NOT NULL,
	`usuario_nome` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ata_id`) REFERENCES `comite_ata`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comite_id`) REFERENCES `comites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ti_prioridades` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`atividade_id` integer NOT NULL,
	`fonte` text DEFAULT 'dev2026' NOT NULL,
	`prioridade` integer,
	`confirmada` integer DEFAULT 0 NOT NULL,
	`confirmada_em` text,
	`confirmada_por` integer,
	`confirmada_por_nome` text,
	`confirmada_comite_id` integer,
	`solicitacao_alteracao` integer DEFAULT 0 NOT NULL,
	`solicitacao_por` integer,
	`solicitacao_por_nome` text,
	`solicitacao_em` text,
	`solicitacao_motivo` text,
	`solicitacao_nova_prioridade` integer,
	`workflow_id` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`projeto_id` integer,
	`projeto_codigo` text,
	`projeto_nome` text
);
--> statement-breakpoint
CREATE TABLE `projeto_fase_prazo` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`status` text NOT NULL,
	`data_limite` text,
	`usuario_id` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`data_baseline` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projeto_fase_prazo_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`projeto_id` integer NOT NULL,
	`status` text NOT NULL,
	`data_anterior` text NOT NULL,
	`nova_data` text NOT NULL,
	`justificativa` text NOT NULL,
	`usuario_id` integer,
	`usuario_nome` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `viabilidade_capex_projecoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`viabilidade_id` integer NOT NULL,
	`projeto_id` integer NOT NULL,
	`periodo_ref` text NOT NULL,
	`valor` real NOT NULL,
	`descricao` text NOT NULL,
	`usuario_id` integer,
	`usuario_nome` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`viabilidade_id`) REFERENCES `viabilidade`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `financeiro_enquadramento_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pagamento_id` integer NOT NULL,
	`projeto_id` integer NOT NULL,
	`contrato_id_anterior` integer,
	`contrato_id_novo` integer,
	`tipo_acao` text NOT NULL,
	`regra_utilizada` text,
	`usuario_id` integer,
	`usuario_nome` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `cronograma_tarefa_pagamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cronograma_tarefa_id` integer NOT NULL,
	`beneficiario` text,
	`valor_total` real NOT NULL,
	`qtd_parcelas` integer NOT NULL,
	`periodicidade` text DEFAULT 'MENSAL' NOT NULL,
	`data_primeira_parcela` text NOT NULL,
	`financeiro_pagamento_id` integer,
	`criado_por` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cronograma_tarefa_id`) REFERENCES `cronograma_tarefas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cronograma_tarefa_parcelas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cronograma_tarefa_id` integer NOT NULL,
	`numero` integer NOT NULL,
	`valor` real NOT NULL,
	`data_vencimento` text NOT NULL,
	`data_vencimento_baseline` text,
	`status` text DEFAULT 'PENDENTE' NOT NULL,
	`data_pagamento` text,
	`pago_por` integer,
	`financeiro_pagamento_id` integer,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`pago_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cronograma_tarefa_id`) REFERENCES `cronograma_tarefas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cronograma_tarefa_parcelas_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`parcela_id` integer NOT NULL,
	`cronograma_tarefa_id` integer NOT NULL,
	`projeto_id` integer NOT NULL,
	`campo` text NOT NULL,
	`valor_anterior` text,
	`valor_novo` text,
	`justificativa` text,
	`usuario_id` integer,
	`usuario_nome` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cronograma_tarefa_id`) REFERENCES `cronograma_tarefas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parcela_id`) REFERENCES `cronograma_tarefa_parcelas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `financeiro_contrato_projecao_parcelas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`contrato_id` integer NOT NULL,
	`numero` integer NOT NULL,
	`competencia` text NOT NULL,
	`valor_projetado` real NOT NULL,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`contrato_id`) REFERENCES `financeiro_contratos`(`id`) ON UPDATE no action ON DELETE no action
);

*/