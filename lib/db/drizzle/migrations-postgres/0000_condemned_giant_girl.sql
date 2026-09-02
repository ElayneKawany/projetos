CREATE SCHEMA "AI";
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_APROVACOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_APROVACOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"referencia_id" integer,
	"referencia_tipo" text,
	"status" text DEFAULT 'PENDENTE',
	"solicitante_id" integer NOT NULL,
	"aprovador_id" integer,
	"observacao_req" text,
	"observacao_apr" text,
	"aprovado_em" timestamp with time zone,
	"prazo" date,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_AREAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_AREAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"diretoria_id" integer NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"sigla" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	"descricao" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_AREAS_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_AUDITORIA" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_AUDITORIA_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"usuario_id" integer,
	"usuario_nome" text,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" integer,
	"projeto_id" integer,
	"descricao" text NOT NULL,
	"dados_antes" jsonb,
	"dados_depois" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_ATA" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_ATA_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"conteudo" text,
	"versao" integer DEFAULT 1,
	"gerado_por_ia" boolean DEFAULT false,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"transcricao" text,
	"conteudo_json" jsonb,
	"status" text DEFAULT 'RASCUNHO',
	"hora_inicio" text,
	"hora_fim" text,
	"duracao_min" integer,
	CONSTRAINT "TI_PMO_COMITE_ATA_comite_id_unique" UNIQUE("comite_id")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_ATA_HISTORICO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_ATA_HISTORICO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"ata_id" integer NOT NULL,
	"versao" integer NOT NULL,
	"conteudo_snap" text,
	"acao" text NOT NULL,
	"usuario_id" integer NOT NULL,
	"usuario_nome" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_DECISOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_DECISOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"projeto_id" integer,
	"tipo" text DEFAULT 'PENDENTE' NOT NULL,
	"descricao" text NOT NULL,
	"responsavel_nome" text,
	"prazo" text,
	"status" text DEFAULT 'PENDENTE',
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_DOCUMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_DOCUMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"nome" text NOT NULL,
	"caminho" text NOT NULL,
	"tipo" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_PARTICIPANTES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_PARTICIPANTES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"usuario_id" integer,
	"nome_externo" text,
	"cargo" text,
	"presente" boolean DEFAULT false,
	"created_at" timestamp with time zone,
	"confirmado" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_PENDENCIAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_PENDENCIAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"projeto_id" integer,
	"descricao" text NOT NULL,
	"responsavel_nome" text,
	"prazo" text,
	"status" text DEFAULT 'ABERTA',
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" integer
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITE_PROJETOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITE_PROJETOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comite_id" integer NOT NULL,
	"projeto_id" integer NOT NULL,
	"pauta_item" text,
	"decisao" text,
	"observacoes" text,
	"snap_prioridade" text,
	"snap_complexidade" text,
	"snap_investimento" numeric,
	"snap_roi" numeric,
	"snap_payback" numeric,
	"created_at" timestamp with time zone,
	"ordem_pauta" integer DEFAULT 0,
	"tempo_previsto" integer
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_COMITES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_COMITES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titulo" text NOT NULL,
	"tipo" text DEFAULT 'IDEIAS' NOT NULL,
	"data_realizacao" timestamp with time zone NOT NULL,
	"local" text,
	"pauta" text,
	"decisao_geral" text,
	"status" text DEFAULT 'AGENDADO',
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"hora" text,
	"periodo_inicio" text,
	"periodo_fim" text,
	"descricao" text,
	"resumo_executivo_ia" text,
	"resumo_ia_gerado_em" timestamp with time zone,
	"resumo_executivo_ia_json" jsonb,
	"diretorias_ids" text,
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_CENTROS_CUSTO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_CENTROS_CUSTO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"descricao" text NOT NULL,
	"empresa" text,
	"filial" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CONFIG_CENTROS_CUSTO_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_CHECKLIST_CONCLUSAO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_CHECKLIST_CONCLUSAO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"label" text NOT NULL,
	"obrigatorio" boolean DEFAULT false NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "TI_PMO_CONFIG_CHECKLIST_CONCLUSAO_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_CONTAS_CONTABEIS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_CONTAS_CONTABEIS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"descricao" text NOT NULL,
	"tipo" text DEFAULT 'CAPEX_ATIVO' NOT NULL,
	"empresa" text,
	"filial" text,
	"integracao_codigo" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"data_inicio" date,
	"data_fim" date,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CONFIG_CONTAS_CONTABEIS_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_CRONOGRAMA_CRITICIDADES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_CRONOGRAMA_CRITICIDADES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"label" text NOT NULL,
	"cor" text DEFAULT '#6B7280',
	"ordem" integer DEFAULT 0,
	"ativo" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CONFIG_CRONOGRAMA_CRITICIDADES_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_CRONOGRAMA_TIPOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_CRONOGRAMA_TIPOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"label" text NOT NULL,
	"ordem" integer DEFAULT 0,
	"ativo" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CONFIG_CRONOGRAMA_TIPOS_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_GLOBAL" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_GLOBAL_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chave" text NOT NULL,
	"valor" text NOT NULL,
	"descricao" text,
	"updated_by" integer,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CONFIG_GLOBAL_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_MOTIVOS_PAUSA" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_MOTIVOS_PAUSA_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nome" text NOT NULL,
	"descricao" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CONFIG_STATUS_PROJETO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CONFIG_STATUS_PROJETO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"label" text NOT NULL,
	"descricao" text,
	"cor" text DEFAULT '#6B7280',
	"ordem" integer DEFAULT 0,
	"ativo" boolean DEFAULT true,
	"is_initial" boolean DEFAULT false,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CONFIG_STATUS_PROJETO_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CRONOGRAMA_RESPONSAVEIS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CRONOGRAMA_RESPONSAVEIS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cronograma_tarefa_id" integer NOT NULL,
	"usuario_id" integer,
	"usuario_nome_ext" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cronograma_tarefa_id" integer NOT NULL,
	"beneficiario" text,
	"valor_total" numeric NOT NULL,
	"qtd_parcelas" integer NOT NULL,
	"periodicidade" text DEFAULT 'MENSAL' NOT NULL,
	"data_primeira_parcela" timestamp with time zone NOT NULL,
	"financeiro_pagamento_id" integer,
	"criado_por" integer,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO_cronograma_tarefa_id_unique" UNIQUE("cronograma_tarefa_id")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cronograma_tarefa_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"valor" numeric NOT NULL,
	"data_vencimento" timestamp with time zone NOT NULL,
	"data_vencimento_baseline" timestamp with time zone,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"data_pagamento" timestamp with time zone,
	"pago_por" integer,
	"financeiro_pagamento_id" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"parcela_id" integer NOT NULL,
	"cronograma_tarefa_id" integer NOT NULL,
	"projeto_id" integer NOT NULL,
	"campo" text NOT NULL,
	"valor_anterior" text,
	"valor_novo" text,
	"justificativa" text,
	"usuario_id" integer,
	"usuario_nome" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CRONOGRAMA_TAREFAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cronograma_id" integer NOT NULL,
	"parent_id" integer,
	"nivel" integer DEFAULT 1,
	"ordem" integer DEFAULT 0,
	"codigo" text,
	"nome" text NOT NULL,
	"responsavel_id" integer,
	"data_inicio" date,
	"data_fim" date,
	"duracao_dias" integer,
	"dependencias" jsonb,
	"percentual" integer DEFAULT 0,
	"bloqueio" boolean DEFAULT false,
	"motivo_bloqueio" text,
	"status" text DEFAULT 'NAO_INICIADA',
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"area_id" integer,
	"tipo" text DEFAULT 'TAREFA',
	"criticidade" text DEFAULT 'NORMAL',
	"observacoes" text,
	"motivo_atraso" text,
	"dependencia_id" integer,
	"peso" numeric DEFAULT '1',
	"alterado_por" integer,
	"alterado_em" timestamp with time zone,
	"executor_id" integer,
	"criado_por" integer,
	"descricao" text,
	"data_conclusao" timestamp with time zone,
	"concluido_por" integer,
	"prazo_status" text,
	"responsavel_nome_ext" text,
	"executor_nome_ext" text,
	"ativo" boolean DEFAULT true,
	"tipo_macro" text DEFAULT 'OUTRO',
	"data_fim_baseline" timestamp with time zone,
	"data_inicio_baseline" timestamp with time zone,
	"natureza_tarefa" text DEFAULT 'NORMAL'
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_CRONOGRAMAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_CRONOGRAMAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"is_baseline" boolean DEFAULT false,
	"status" text DEFAULT 'ATIVO',
	"motivo_replano" text,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone,
	"fonte_importacao" text DEFAULT 'MANUAL',
	"arquivo_origem" text,
	"modo" text DEFAULT 'CENTRALIZADO' NOT NULL,
	"ativo" boolean DEFAULT true,
	"deleted_at" timestamp with time zone,
	"arquivado" boolean DEFAULT false,
	"arquivado_por" integer,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_DIRETORIAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_DIRETORIAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"sigla" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	"descricao" text,
	"updated_at" timestamp with time zone,
	"diretor_responsavel_id" integer,
	"ordem" integer DEFAULT 99,
	CONSTRAINT "TI_PMO_DIRETORIAS_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_DOCUMENTO_APROVADORES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_DOCUMENTO_APROVADORES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tipo_documento" text NOT NULL,
	"usuario_id" integer NOT NULL,
	"ordem" integer DEFAULT 1,
	"obrigatorio" boolean DEFAULT true,
	"ativo" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_DOCUMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_DOCUMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"versao" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'RASCUNHO',
	"gerado_auto" boolean DEFAULT false,
	"caminho" text,
	"conteudo_json" jsonb,
	"criado_por" integer NOT NULL,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"publicado_em" timestamp with time zone,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_DOCUMENTOS_VERSOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_DOCUMENTOS_VERSOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"documento_id" integer NOT NULL,
	"versao" integer NOT NULL,
	"status" text,
	"caminho" text,
	"conteudo_json" jsonb,
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_ENCERRAMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_ENCERRAMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"licoes_aprendidas" text,
	"roi_previsto" numeric,
	"roi_realizado" numeric,
	"payback_previsto" numeric,
	"payback_realizado" numeric,
	"capex_previsto" numeric,
	"capex_realizado" numeric,
	"opex_previsto" numeric,
	"opex_realizado" numeric,
	"economia_prevista" numeric,
	"economia_realizada" numeric,
	"avaliacao_geral" text,
	"recomendacoes" text,
	"criado_por" integer NOT NULL,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_ENCERRAMENTOS_projeto_id_unique" UNIQUE("projeto_id")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_ESTRUTURACAO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_ESTRUTURACAO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"gerente_id" integer,
	"patrocinador_id" integer,
	"metodologia" text,
	"escopo_detalhado" text,
	"entregas" jsonb,
	"observacoes" text,
	"concluida" boolean DEFAULT false,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_ESTRUTURACAO_projeto_id_unique" UNIQUE("projeto_id")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_EXECUCAO_ARQUIVOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_EXECUCAO_ARQUIVOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"atualizacao_id" integer NOT NULL,
	"nome" text NOT NULL,
	"caminho" text NOT NULL,
	"tipo_mime" text,
	"tamanho_bytes" integer,
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_EXECUCAO_ATUALIZACOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_EXECUCAO_ATUALIZACOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"tarefa_id" integer,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"percentual" integer,
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_ANEXOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_ANEXOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lancamento_id" integer NOT NULL,
	"nome" text NOT NULL,
	"caminho" text NOT NULL,
	"tipo_mime" text,
	"tamanho_bytes" integer,
	"tipo_anexo" text DEFAULT 'NF',
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_CONTRATO_PROJECAO_PARCELAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_CONTRATO_PROJECAO_PARCELAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contrato_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"competencia" text NOT NULL,
	"valor_projetado" numeric NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_CONTRATOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_CONTRATOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"numero_contrato" text,
	"contratado" text NOT NULL,
	"tipo_contrato" text DEFAULT 'SERVICO' NOT NULL,
	"descricao_servico" text,
	"valor_aprovado" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'ATIVO' NOT NULL,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"observacao" text,
	"natureza_financeira" text DEFAULT 'CAPEX' NOT NULL,
	"categoria" text,
	"tipo_projecao" text DEFAULT 'NENHUMA'
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_ENQUADRAMENTO_HISTORICO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_ENQUADRAMENTO_HISTORICO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pagamento_id" integer NOT NULL,
	"projeto_id" integer NOT NULL,
	"contrato_id_anterior" integer,
	"contrato_id_novo" integer,
	"tipo_acao" text NOT NULL,
	"regra_utilizada" text,
	"usuario_id" integer,
	"usuario_nome" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text NOT NULL,
	"descricao" text NOT NULL,
	"fornecedor" text,
	"numero_doc" text,
	"valor" numeric NOT NULL,
	"data_lancamento" date NOT NULL,
	"competencia" text,
	"observacoes" text,
	"arquivo_path" text,
	"criado_por" integer NOT NULL,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"status" text DEFAULT 'PENDENTE',
	"created_at" timestamp with time zone,
	"item_id" integer
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_MOVIMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_MOVIMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"item_id" integer,
	"tipo_movimento" text DEFAULT 'NF' NOT NULL,
	"numero_doc" text,
	"fornecedor" text,
	"valor_total" numeric DEFAULT '0' NOT NULL,
	"data_emissao" date,
	"data_vencimento" date,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"observacoes" text,
	"arquivo_path" text,
	"criado_por" integer NOT NULL,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_FINANCEIRO_PAGAMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_FINANCEIRO_PAGAMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"movimento_id" integer NOT NULL,
	"projeto_id" integer NOT NULL,
	"valor_pago" numeric NOT NULL,
	"data_pagamento" timestamp with time zone NOT NULL,
	"observacoes" text,
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone,
	"contrato_id" integer,
	"numero_documento" text,
	"tipo_documento" text DEFAULT 'NF',
	"nota_fiscal" text,
	"competencia" text,
	"arquivo_path" text,
	"ativo" boolean DEFAULT true,
	"observacao" text,
	"comprovante" text,
	"enquadramento_status" text,
	"contratos_candidatos" jsonb,
	"fornecedor" text
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_NOTIFICACOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_NOTIFICACOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"usuario_id" integer NOT NULL,
	"projeto_id" integer,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"lida" boolean DEFAULT false,
	"lida_em" timestamp with time zone,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_ORCAMENTO_GRUPOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_ORCAMENTO_GRUPOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"viabilidade_id" integer,
	"tipo" text DEFAULT 'CAPEX_ATIVO' NOT NULL,
	"nome" text NOT NULL,
	"cor" text,
	"icone" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_ORCAMENTO_ITENS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_ORCAMENTO_ITENS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grupo_id" integer NOT NULL,
	"projeto_id" integer NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"conta_contabil_id" integer,
	"centro_custo_id" integer,
	"valor_aprovado" numeric DEFAULT '0' NOT NULL,
	"valor_revisado" numeric,
	"status" text DEFAULT 'ATIVO' NOT NULL,
	"prioridade" text DEFAULT 'MEDIA' NOT NULL,
	"responsavel_usuario_id" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PAYBACK_COMPETENCIAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PAYBACK_COMPETENCIAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"receita" numeric DEFAULT '0' NOT NULL,
	"economia" numeric DEFAULT '0' NOT NULL,
	"capex" numeric DEFAULT '0' NOT NULL,
	"opex" numeric DEFAULT '0' NOT NULL,
	"fluxo" numeric DEFAULT '0' NOT NULL,
	"observacao" text,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"criado_por" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "ux_payback_competencias_projeto_id_ano_mes" UNIQUE("projeto_id","ano","mes")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PAYBACK_LANCAMENTOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PAYBACK_LANCAMENTOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"competencia" text NOT NULL,
	"data_lancamento" timestamp with time zone NOT NULL,
	"investimento_periodo" numeric DEFAULT '0' NOT NULL,
	"beneficio_periodo" numeric DEFAULT '0' NOT NULL,
	"observacao" text,
	"usuario_id" integer,
	"usuario_nome" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"tipo_beneficio" text
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PAYBACK_REGISTROS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PAYBACK_REGISTROS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"data" date NOT NULL,
	"valor_real" numeric NOT NULL,
	"origem" text DEFAULT 'manual' NOT NULL,
	"observacao" text,
	"criado_por" integer,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PERFIS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PERFIS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"permissoes" jsonb DEFAULT '{}' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_PERFIS_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_AREAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_AREAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"area_id" integer NOT NULL,
	"responsavel_id" integer,
	"papel" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_FASE_PRAZO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_FASE_PRAZO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"status" text NOT NULL,
	"data_limite" timestamp with time zone,
	"usuario_id" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"data_baseline" timestamp with time zone,
	CONSTRAINT "ux_projeto_fase_prazo_projeto_id_status" UNIQUE("projeto_id","status")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_FASE_PRAZO_HISTORICO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_FASE_PRAZO_HISTORICO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"status" text NOT NULL,
	"data_anterior" timestamp with time zone NOT NULL,
	"nova_data" text NOT NULL,
	"justificativa" text NOT NULL,
	"usuario_id" integer,
	"usuario_nome" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_HISTORICO_ALTERACOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_HISTORICO_ALTERACOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"usuario_id" integer,
	"usuario_nome" text,
	"campo" text NOT NULL,
	"valor_anterior" text,
	"valor_novo" text,
	"acao" text DEFAULT 'UPDATE',
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_PRIORIDADE_HISTORICO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_PRIORIDADE_HISTORICO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"prioridade_de" text NOT NULL,
	"prioridade_para" text NOT NULL,
	"motivo" text,
	"usuario_id" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_SNAPSHOT_FINAL" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_SNAPSHOT_FINAL_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"roi_previsto" numeric,
	"roi_atual" numeric,
	"capex_previsto" numeric,
	"capex_executado" numeric,
	"opex_previsto" numeric,
	"opex_executado" numeric,
	"economia_prevista" numeric,
	"economia_realizada" numeric,
	"data_fim_prev" timestamp with time zone,
	"data_conclusao_real" timestamp with time zone,
	"dias_desvio" integer,
	"responsavel" text,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_PROJETO_SNAPSHOT_FINAL_projeto_id_unique" UNIQUE("projeto_id")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_STATUS_HISTORICO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_STATUS_HISTORICO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"status_de" text NOT NULL,
	"status_para" text NOT NULL,
	"motivo" text,
	"usuario_id" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETO_TIMELINE" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETO_TIMELINE_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"modulo" text NOT NULL,
	"artefato" text NOT NULL,
	"evento" text NOT NULL,
	"origem" text DEFAULT 'MANUAL' NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"usuario_id" integer,
	"usuario_nome" text,
	"referencia_id" integer,
	"referencia_tipo" text,
	"dados_json" jsonb,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_PROJETOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_PROJETOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"solicitante_id" integer NOT NULL,
	"diretoria_id" integer NOT NULL,
	"area_id" integer NOT NULL,
	"ponto_focal" text,
	"contato" text,
	"objetivo" text NOT NULL,
	"descricao" text,
	"beneficios" text,
	"status" text DEFAULT 'PROPOSTA' NOT NULL,
	"classificacao" text,
	"complexidade" text,
	"prioridade" text DEFAULT 'MEDIA',
	"gerente_id" integer,
	"capex_aprovado" numeric DEFAULT '0',
	"opex_aprovado" numeric DEFAULT '0',
	"data_inicio_prev" date,
	"data_fim_prev" date,
	"data_golive" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"justificativa" text,
	"data_conclusao_real" timestamp with time zone,
	"hora_conclusao" text,
	"responsavel_conclusao" text,
	"motivo_conclusao" text,
	"checklist_conclusao" jsonb,
	"projeto_migrado" boolean DEFAULT false,
	"motivo_pausa_id" integer,
	"pmo_responsavel" text,
	"tipo_beneficio" text,
	"cronograma_pendente" boolean DEFAULT false,
	"migrado_em" timestamp with time zone,
	"migrado_por" integer,
	"data_pausa" timestamp with time zone,
	"usuario_pausa" integer,
	"pmo_responsavel_id" integer,
	"origem_dados" text,
	"arquivo_origem" text,
	"data_base_entrega" timestamp with time zone,
	"data_base_entrega_definida_em" timestamp with time zone,
	CONSTRAINT "TI_PMO_PROJETOS_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_ROI_ACOMPANHAMENTO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_ROI_ACOMPANHAMENTO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"competencia" text NOT NULL,
	"receita_real" numeric DEFAULT '0',
	"custo_real" numeric DEFAULT '0',
	"economia_real" numeric DEFAULT '0',
	"observacoes" text,
	"criado_por" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_SESSOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_SESSOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"usuario_id" integer NOT NULL,
	"token" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_SESSOES_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_TAP_VERSOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_TAP_VERSOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"versao" integer NOT NULL,
	"label" text NOT NULL,
	"fase_origem" text NOT NULL,
	"escopo_inicial" text,
	"escopo_fora" text,
	"beneficios_tap" text,
	"areas_impactadas" jsonb,
	"objetivo_detalhado" text,
	"descricao_solucao" text,
	"premissas" text,
	"restricoes" text,
	"riscos_iniciais" text,
	"investimento_total" numeric,
	"roi_previsto" numeric,
	"vpl" numeric,
	"tir" numeric,
	"payback_meses" numeric,
	"criado_por" integer NOT NULL,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"status" text DEFAULT 'RASCUNHO',
	"created_at" timestamp with time zone,
	"situacao_atual" text,
	"escopo_fisico" text,
	"escopo_sistemico" text,
	"escopo_processo" text,
	"setores_envolvidos" text,
	"etapas_projeto" text,
	"entregaveis" text,
	"pontos_atencao" text,
	"pontos_definir" text,
	"updated_at" timestamp with time zone,
	"data_limite_tap" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_TI_PRIORIDADES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_TI_PRIORIDADES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"atividade_id" integer NOT NULL,
	"fonte" text DEFAULT 'dev2026' NOT NULL,
	"prioridade" integer,
	"confirmada" boolean DEFAULT false NOT NULL,
	"confirmada_em" timestamp with time zone,
	"confirmada_por" integer,
	"confirmada_por_nome" text,
	"confirmada_comite_id" integer,
	"solicitacao_alteracao" boolean DEFAULT false NOT NULL,
	"solicitacao_por" integer,
	"solicitacao_por_nome" text,
	"solicitacao_em" timestamp with time zone,
	"solicitacao_motivo" text,
	"solicitacao_nova_prioridade" integer,
	"workflow_id" integer,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"projeto_id" integer,
	"projeto_codigo" text,
	"projeto_nome" text,
	CONSTRAINT "ux_ti_prioridades_atividade_id_fonte" UNIQUE("atividade_id","fonte")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_TRIAGENS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_TRIAGENS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"escopo_inicial" text,
	"escopo_fora" text,
	"beneficios" text,
	"areas_impactadas" jsonb,
	"classificacao" text,
	"complexidade" text,
	"prioridade" text,
	"observacoes" text,
	"responsavel_id" integer,
	"concluida" boolean DEFAULT false,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_TRIAGENS_projeto_id_unique" UNIQUE("projeto_id")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_USUARIOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_USUARIOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cpf" text NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"cargo" text,
	"diretoria_id" integer,
	"area_id" integer,
	"perfil_id" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_login" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_USUARIOS_cpf_unique" UNIQUE("cpf"),
	CONSTRAINT "TI_PMO_USUARIOS_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_VIABILIDADE" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_VIABILIDADE_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"selic" numeric,
	"taxa_desconto" numeric,
	"inflacao" numeric,
	"investimento_total" numeric,
	"receitas_previstas" jsonb,
	"custos_previstos" jsonb,
	"economia_prevista" jsonb,
	"roi" numeric,
	"vpl" numeric,
	"tir" numeric,
	"payback_meses" numeric,
	"impacto_operacional" text,
	"recursos_necessarios" text,
	"mudanca_processo" text,
	"tecnologias" text,
	"integrações" text,
	"infraestrutura" text,
	"riscos" jsonb,
	"impactos" jsonb,
	"data_inicio_prev" date,
	"data_fim_prev" date,
	"marcos" jsonb,
	"status" text DEFAULT 'RASCUNHO',
	"criado_por" integer NOT NULL,
	"aprovado_por" integer,
	"aprovado_em" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"resumo_executivo" text,
	"sistemas_envolvidos" text,
	"dependencia_fornecedores" text,
	"recomendacao" text,
	"justificativa_recomendacao" text,
	"conclusao" text,
	"capex" numeric,
	"opex" numeric,
	"opex_periodicidade" text DEFAULT 'MENSAL',
	"economia_estimada" numeric,
	"economia_periodicidade" text DEFAULT 'MENSAL',
	"tipo_payback" text DEFAULT 'QUALITATIVO',
	"payback_informado" numeric,
	"payback_unidade" text DEFAULT 'MESES',
	"condicoes_aprovacao" text,
	"complexidade_tecnica" text,
	"tipo_payback_quantitativo" boolean,
	"tipo_payback_qualitativo" boolean,
	"beneficios_esperados" text,
	"baseline_valor" numeric,
	"meta_valor" numeric,
	"tipo_indicador" text DEFAULT 'ABSOLUTO',
	"economia_mensal_esperada" numeric,
	"ganho_tarefa_ativo" boolean DEFAULT false,
	"ganho_tarefa_salario" numeric,
	"ganho_tarefa_horas_antes" numeric,
	"ganho_tarefa_horas_depois" numeric,
	"ganho_tarefa_freq_mensal" numeric DEFAULT '1',
	"hc_ativo" boolean DEFAULT false,
	"hc_quantidade" integer DEFAULT 1,
	"hc_salario_mensal" numeric,
	"hc_encargos_pct" numeric,
	"hc_beneficios_mensais" numeric,
	"hc_outros_mensais" numeric,
	"horas_analistas_ativo" boolean DEFAULT false,
	"horas_analistas_json" jsonb,
	"horas_analistas_total" numeric
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_VIABILIDADE_CAPEX_PROJECOES" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_VIABILIDADE_CAPEX_PROJECOES_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"viabilidade_id" integer NOT NULL,
	"projeto_id" integer NOT NULL,
	"periodo_ref" text NOT NULL,
	"valor" numeric NOT NULL,
	"descricao" text NOT NULL,
	"usuario_id" integer,
	"usuario_nome" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_WORKFLOW_APROVACAO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_WORKFLOW_APROVACAO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"projeto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"referencia_id" integer NOT NULL,
	"etapa_atual" integer DEFAULT 1,
	"status" text DEFAULT 'EM_ANDAMENTO',
	"criado_por" integer,
	"created_at" timestamp with time zone,
	"modelo_id" integer
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_WORKFLOW_ETAPAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_WORKFLOW_ETAPAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workflow_id" integer NOT NULL,
	"ordem" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"usuario_nome" text NOT NULL,
	"tipo" text NOT NULL,
	"status" text DEFAULT 'PENDENTE',
	"observacao" text,
	"respondido_em" timestamp with time zone,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_WORKFLOW_MODELO_ETAPAS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_WORKFLOW_MODELO_ETAPAS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"modelo_id" integer NOT NULL,
	"ordem" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"usuario_nome" text NOT NULL,
	"tipo" text NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_WORKFLOW_MODELOS" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_WORKFLOW_MODELOS_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nome" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true,
	"criado_por" integer,
	"criado_por_nome" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "AI"."TI_PMO_WORKFLOW_TIPOS_PARTICIPACAO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "AI"."TI_PMO_WORKFLOW_TIPOS_PARTICIPACAO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nome" text NOT NULL,
	"codigo" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true,
	"created_at" timestamp with time zone,
	CONSTRAINT "TI_PMO_WORKFLOW_TIPOS_PARTICIPACAO_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_APROVACOES" ADD CONSTRAINT "fk_aprovacoes_aprovador" FOREIGN KEY ("aprovador_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_APROVACOES" ADD CONSTRAINT "fk_aprovacoes_solicitante" FOREIGN KEY ("solicitante_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_APROVACOES" ADD CONSTRAINT "fk_aprovacoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_AREAS" ADD CONSTRAINT "fk_areas_diretoria" FOREIGN KEY ("diretoria_id") REFERENCES "AI"."TI_PMO_DIRETORIAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_AUDITORIA" ADD CONSTRAINT "fk_auditoria_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_AUDITORIA" ADD CONSTRAINT "fk_auditoria_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_ATA" ADD CONSTRAINT "fk_comite_ata_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_ATA" ADD CONSTRAINT "fk_comite_ata_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_ATA_HISTORICO" ADD CONSTRAINT "fk_comite_ata_historico_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_ATA_HISTORICO" ADD CONSTRAINT "fk_comite_ata_historico_ata" FOREIGN KEY ("ata_id") REFERENCES "AI"."TI_PMO_COMITE_ATA"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_ATA_HISTORICO" ADD CONSTRAINT "fk_comite_ata_historico_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_DECISOES" ADD CONSTRAINT "fk_comite_decisoes_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_DECISOES" ADD CONSTRAINT "fk_comite_decisoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_DECISOES" ADD CONSTRAINT "fk_comite_decisoes_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_DOCUMENTOS" ADD CONSTRAINT "fk_comite_documentos_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_DOCUMENTOS" ADD CONSTRAINT "fk_comite_documentos_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PARTICIPANTES" ADD CONSTRAINT "fk_comite_participantes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PARTICIPANTES" ADD CONSTRAINT "fk_comite_participantes_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PENDENCIAS" ADD CONSTRAINT "fk_comite_pendencias_resolved_by" FOREIGN KEY ("resolved_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PENDENCIAS" ADD CONSTRAINT "fk_comite_pendencias_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PENDENCIAS" ADD CONSTRAINT "fk_comite_pendencias_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PENDENCIAS" ADD CONSTRAINT "fk_comite_pendencias_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PROJETOS" ADD CONSTRAINT "fk_comite_projetos_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITE_PROJETOS" ADD CONSTRAINT "fk_comite_projetos_comite" FOREIGN KEY ("comite_id") REFERENCES "AI"."TI_PMO_COMITES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_COMITES" ADD CONSTRAINT "fk_comites_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO" ADD CONSTRAINT "fk_cronograma_tarefa_pagamento_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO" ADD CONSTRAINT "fk_cronograma_tarefa_pagamento_cronograma_tarefa" FOREIGN KEY ("cronograma_tarefa_id") REFERENCES "AI"."TI_PMO_CRONOGRAMA_TAREFAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS" ADD CONSTRAINT "fk_cronograma_tarefa_parcelas_pago_por" FOREIGN KEY ("pago_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS" ADD CONSTRAINT "fk_cronograma_tarefa_parcelas_cronograma_tarefa" FOREIGN KEY ("cronograma_tarefa_id") REFERENCES "AI"."TI_PMO_CRONOGRAMA_TAREFAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO" ADD CONSTRAINT "fk_cronograma_tarefa_parcelas_historico_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO" ADD CONSTRAINT "fk_cronograma_tarefa_parcelas_historico_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO" ADD CONSTRAINT "fk_cronograma_tarefa_parcelas_historico_cronograma_tarefa" FOREIGN KEY ("cronograma_tarefa_id") REFERENCES "AI"."TI_PMO_CRONOGRAMA_TAREFAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO" ADD CONSTRAINT "fk_cronograma_tarefa_parcelas_historico_parcela" FOREIGN KEY ("parcela_id") REFERENCES "AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFAS" ADD CONSTRAINT "fk_cronograma_tarefas_responsavel" FOREIGN KEY ("responsavel_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFAS" ADD CONSTRAINT "fk_cronograma_tarefas_parent" FOREIGN KEY ("parent_id") REFERENCES "AI"."TI_PMO_CRONOGRAMA_TAREFAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMA_TAREFAS" ADD CONSTRAINT "fk_cronograma_tarefas_cronograma" FOREIGN KEY ("cronograma_id") REFERENCES "AI"."TI_PMO_CRONOGRAMAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMAS" ADD CONSTRAINT "fk_cronogramas_arquivado_por" FOREIGN KEY ("arquivado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMAS" ADD CONSTRAINT "fk_cronogramas_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMAS" ADD CONSTRAINT "fk_cronogramas_aprovado_por" FOREIGN KEY ("aprovado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_CRONOGRAMAS" ADD CONSTRAINT "fk_cronogramas_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTO_APROVADORES" ADD CONSTRAINT "fk_documento_aprovadores_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTO_APROVADORES" ADD CONSTRAINT "fk_documento_aprovadores_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTOS" ADD CONSTRAINT "fk_documentos_aprovado_por" FOREIGN KEY ("aprovado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTOS" ADD CONSTRAINT "fk_documentos_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTOS" ADD CONSTRAINT "fk_documentos_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTOS_VERSOES" ADD CONSTRAINT "fk_documentos_versoes_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_DOCUMENTOS_VERSOES" ADD CONSTRAINT "fk_documentos_versoes_documento" FOREIGN KEY ("documento_id") REFERENCES "AI"."TI_PMO_DOCUMENTOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ENCERRAMENTOS" ADD CONSTRAINT "fk_encerramentos_aprovado_por" FOREIGN KEY ("aprovado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ENCERRAMENTOS" ADD CONSTRAINT "fk_encerramentos_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ENCERRAMENTOS" ADD CONSTRAINT "fk_encerramentos_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ESTRUTURACAO" ADD CONSTRAINT "fk_estruturacao_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ESTRUTURACAO" ADD CONSTRAINT "fk_estruturacao_patrocinador" FOREIGN KEY ("patrocinador_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ESTRUTURACAO" ADD CONSTRAINT "fk_estruturacao_gerente" FOREIGN KEY ("gerente_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ESTRUTURACAO" ADD CONSTRAINT "fk_estruturacao_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_EXECUCAO_ARQUIVOS" ADD CONSTRAINT "fk_execucao_arquivos_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_EXECUCAO_ARQUIVOS" ADD CONSTRAINT "fk_execucao_arquivos_atualizacao" FOREIGN KEY ("atualizacao_id") REFERENCES "AI"."TI_PMO_EXECUCAO_ATUALIZACOES"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_EXECUCAO_ATUALIZACOES" ADD CONSTRAINT "fk_execucao_atualizacoes_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_EXECUCAO_ATUALIZACOES" ADD CONSTRAINT "fk_execucao_atualizacoes_tarefa" FOREIGN KEY ("tarefa_id") REFERENCES "AI"."TI_PMO_CRONOGRAMA_TAREFAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_EXECUCAO_ATUALIZACOES" ADD CONSTRAINT "fk_execucao_atualizacoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_FINANCEIRO_ANEXOS" ADD CONSTRAINT "fk_financeiro_anexos_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_FINANCEIRO_ANEXOS" ADD CONSTRAINT "fk_financeiro_anexos_lancamento" FOREIGN KEY ("lancamento_id") REFERENCES "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_FINANCEIRO_CONTRATO_PROJECAO_PARCELAS" ADD CONSTRAINT "fk_financeiro_contrato_projecao_parcelas_contrato" FOREIGN KEY ("contrato_id") REFERENCES "AI"."TI_PMO_FINANCEIRO_CONTRATOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS" ADD CONSTRAINT "fk_financeiro_lancamentos_aprovado_por" FOREIGN KEY ("aprovado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS" ADD CONSTRAINT "fk_financeiro_lancamentos_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS" ADD CONSTRAINT "fk_financeiro_lancamentos_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_NOTIFICACOES" ADD CONSTRAINT "fk_notificacoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_NOTIFICACOES" ADD CONSTRAINT "fk_notificacoes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PAYBACK_LANCAMENTOS" ADD CONSTRAINT "fk_payback_lancamentos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PAYBACK_LANCAMENTOS" ADD CONSTRAINT "fk_payback_lancamentos_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_AREAS" ADD CONSTRAINT "fk_projeto_areas_responsavel" FOREIGN KEY ("responsavel_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_AREAS" ADD CONSTRAINT "fk_projeto_areas_area" FOREIGN KEY ("area_id") REFERENCES "AI"."TI_PMO_AREAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_AREAS" ADD CONSTRAINT "fk_projeto_areas_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_FASE_PRAZO" ADD CONSTRAINT "fk_projeto_fase_prazo_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_FASE_PRAZO" ADD CONSTRAINT "fk_projeto_fase_prazo_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_FASE_PRAZO_HISTORICO" ADD CONSTRAINT "fk_projeto_fase_prazo_historico_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_FASE_PRAZO_HISTORICO" ADD CONSTRAINT "fk_projeto_fase_prazo_historico_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_PRIORIDADE_HISTORICO" ADD CONSTRAINT "fk_projeto_prioridade_historico_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_PRIORIDADE_HISTORICO" ADD CONSTRAINT "fk_projeto_prioridade_historico_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_STATUS_HISTORICO" ADD CONSTRAINT "fk_projeto_status_historico_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETO_STATUS_HISTORICO" ADD CONSTRAINT "fk_projeto_status_historico_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETOS" ADD CONSTRAINT "fk_projetos_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETOS" ADD CONSTRAINT "fk_projetos_gerente" FOREIGN KEY ("gerente_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETOS" ADD CONSTRAINT "fk_projetos_area" FOREIGN KEY ("area_id") REFERENCES "AI"."TI_PMO_AREAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETOS" ADD CONSTRAINT "fk_projetos_diretoria" FOREIGN KEY ("diretoria_id") REFERENCES "AI"."TI_PMO_DIRETORIAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_PROJETOS" ADD CONSTRAINT "fk_projetos_solicitante" FOREIGN KEY ("solicitante_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ROI_ACOMPANHAMENTO" ADD CONSTRAINT "fk_roi_acompanhamento_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_ROI_ACOMPANHAMENTO" ADD CONSTRAINT "fk_roi_acompanhamento_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_SESSOES" ADD CONSTRAINT "fk_sessoes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_TAP_VERSOES" ADD CONSTRAINT "fk_tap_versoes_aprovado_por" FOREIGN KEY ("aprovado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_TAP_VERSOES" ADD CONSTRAINT "fk_tap_versoes_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_TAP_VERSOES" ADD CONSTRAINT "fk_tap_versoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_TRIAGENS" ADD CONSTRAINT "fk_triagens_created_by" FOREIGN KEY ("created_by") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_TRIAGENS" ADD CONSTRAINT "fk_triagens_responsavel" FOREIGN KEY ("responsavel_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_TRIAGENS" ADD CONSTRAINT "fk_triagens_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_USUARIOS" ADD CONSTRAINT "fk_usuarios_perfil" FOREIGN KEY ("perfil_id") REFERENCES "AI"."TI_PMO_PERFIS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_USUARIOS" ADD CONSTRAINT "fk_usuarios_area" FOREIGN KEY ("area_id") REFERENCES "AI"."TI_PMO_AREAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_USUARIOS" ADD CONSTRAINT "fk_usuarios_diretoria" FOREIGN KEY ("diretoria_id") REFERENCES "AI"."TI_PMO_DIRETORIAS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_VIABILIDADE" ADD CONSTRAINT "fk_viabilidade_aprovado_por" FOREIGN KEY ("aprovado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_VIABILIDADE" ADD CONSTRAINT "fk_viabilidade_criado_por" FOREIGN KEY ("criado_por") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_VIABILIDADE" ADD CONSTRAINT "fk_viabilidade_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_VIABILIDADE_CAPEX_PROJECOES" ADD CONSTRAINT "fk_viabilidade_capex_projecoes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "AI"."TI_PMO_USUARIOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_VIABILIDADE_CAPEX_PROJECOES" ADD CONSTRAINT "fk_viabilidade_capex_projecoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "AI"."TI_PMO_PROJETOS"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AI"."TI_PMO_VIABILIDADE_CAPEX_PROJECOES" ADD CONSTRAINT "fk_viabilidade_capex_projecoes_viabilidade" FOREIGN KEY ("viabilidade_id") REFERENCES "AI"."TI_PMO_VIABILIDADE"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aprovacoes_status" ON "AI"."TI_PMO_APROVACOES" USING btree ("status","aprovador_id");--> statement-breakpoint
CREATE INDEX "idx_auditoria_usuario" ON "AI"."TI_PMO_AUDITORIA" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_auditoria_projeto" ON "AI"."TI_PMO_AUDITORIA" USING btree ("projeto_id");--> statement-breakpoint
CREATE INDEX "idx_auditoria_entidade" ON "AI"."TI_PMO_AUDITORIA" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cronogramas_projeto_versao" ON "AI"."TI_PMO_CRONOGRAMAS" USING btree ("projeto_id","versao");--> statement-breakpoint
CREATE INDEX "idx_cronograma_projeto" ON "AI"."TI_PMO_CRONOGRAMAS" USING btree ("projeto_id");--> statement-breakpoint
CREATE INDEX "idx_doc_aprovadores_tipo" ON "AI"."TI_PMO_DOCUMENTO_APROVADORES" USING btree ("tipo_documento","ativo");--> statement-breakpoint
CREATE INDEX "idx_financeiro_anexos" ON "AI"."TI_PMO_FINANCEIRO_ANEXOS" USING btree ("lancamento_id");--> statement-breakpoint
CREATE INDEX "idx_lancamentos_projeto" ON "AI"."TI_PMO_FINANCEIRO_LANCAMENTOS" USING btree ("projeto_id","tipo");--> statement-breakpoint
CREATE INDEX "idx_notificacoes_usuario" ON "AI"."TI_PMO_NOTIFICACOES" USING btree ("usuario_id","lida");--> statement-breakpoint
CREATE INDEX "idx_projetos_gerente" ON "AI"."TI_PMO_PROJETOS" USING btree ("gerente_id");--> statement-breakpoint
CREATE INDEX "idx_projetos_diretoria" ON "AI"."TI_PMO_PROJETOS" USING btree ("diretoria_id");--> statement-breakpoint
CREATE INDEX "idx_projetos_status" ON "AI"."TI_PMO_PROJETOS" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tap_projeto" ON "AI"."TI_PMO_TAP_VERSOES" USING btree ("projeto_id","versao");