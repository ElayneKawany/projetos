import { relations } from "drizzle-orm/relations";
import { diretorias, areas, perfis, usuarios, sessoes, projetos, projetoStatusHistorico, projetoPrioridadeHistorico, projetoAreas, tapVersoes, triagens, comites, comiteParticipantes, comiteProjetos, comiteDocumentos, viabilidade, financeiroLancamentos, roiAcompanhamento, estruturacao, cronogramas, cronogramaTarefas, execucaoAtualizacoes, execucaoArquivos, notificacoes, aprovacoes, documentos, documentosVersoes, encerramentos, auditoria, documentoAprovadores, financeiroAnexos, paybackLancamentos, comiteDecisoes, comitePendencias, comiteAta, comiteAtaHistorico, projetoFasePrazo, projetoFasePrazoHistorico, viabilidadeCapexProjecoes, cronogramaTarefaPagamento, cronogramaTarefaParcelas, cronogramaTarefaParcelasHistorico, financeiroContratos, financeiroContratoProjecaoParcelas } from "./schema";

export const areasRelations = relations(areas, ({one, many}) => ({
	diretoria: one(diretorias, {
		fields: [areas.diretoriaId],
		references: [diretorias.id]
	}),
	usuarios: many(usuarios),
	projetos: many(projetos),
	projetoAreas: many(projetoAreas),
}));

export const diretoriasRelations = relations(diretorias, ({many}) => ({
	areas: many(areas),
	usuarios: many(usuarios),
	projetos: many(projetos),
}));

export const usuariosRelations = relations(usuarios, ({one, many}) => ({
	perfi: one(perfis, {
		fields: [usuarios.perfilId],
		references: [perfis.id]
	}),
	area: one(areas, {
		fields: [usuarios.areaId],
		references: [areas.id]
	}),
	diretoria: one(diretorias, {
		fields: [usuarios.diretoriaId],
		references: [diretorias.id]
	}),
	sessoes: many(sessoes),
	projetos_createdBy: many(projetos, {
		relationName: "projetos_createdBy_usuarios_id"
	}),
	projetos_gerenteId: many(projetos, {
		relationName: "projetos_gerenteId_usuarios_id"
	}),
	projetos_solicitanteId: many(projetos, {
		relationName: "projetos_solicitanteId_usuarios_id"
	}),
	projetoStatusHistoricos: many(projetoStatusHistorico),
	projetoPrioridadeHistoricos: many(projetoPrioridadeHistorico),
	projetoAreas: many(projetoAreas),
	tapVersoes_aprovadoPor: many(tapVersoes, {
		relationName: "tapVersoes_aprovadoPor_usuarios_id"
	}),
	tapVersoes_criadoPor: many(tapVersoes, {
		relationName: "tapVersoes_criadoPor_usuarios_id"
	}),
	triagens_createdBy: many(triagens, {
		relationName: "triagens_createdBy_usuarios_id"
	}),
	triagens_responsavelId: many(triagens, {
		relationName: "triagens_responsavelId_usuarios_id"
	}),
	comites: many(comites),
	comiteParticipantes: many(comiteParticipantes),
	comiteDocumentos: many(comiteDocumentos),
	viabilidades_aprovadoPor: many(viabilidade, {
		relationName: "viabilidade_aprovadoPor_usuarios_id"
	}),
	viabilidades_criadoPor: many(viabilidade, {
		relationName: "viabilidade_criadoPor_usuarios_id"
	}),
	financeiroLancamentos_aprovadoPor: many(financeiroLancamentos, {
		relationName: "financeiroLancamentos_aprovadoPor_usuarios_id"
	}),
	financeiroLancamentos_criadoPor: many(financeiroLancamentos, {
		relationName: "financeiroLancamentos_criadoPor_usuarios_id"
	}),
	roiAcompanhamentos: many(roiAcompanhamento),
	estruturacaos_createdBy: many(estruturacao, {
		relationName: "estruturacao_createdBy_usuarios_id"
	}),
	estruturacaos_patrocinadorId: many(estruturacao, {
		relationName: "estruturacao_patrocinadorId_usuarios_id"
	}),
	estruturacaos_gerenteId: many(estruturacao, {
		relationName: "estruturacao_gerenteId_usuarios_id"
	}),
	cronogramas_arquivadoPor: many(cronogramas, {
		relationName: "cronogramas_arquivadoPor_usuarios_id"
	}),
	cronogramas_criadoPor: many(cronogramas, {
		relationName: "cronogramas_criadoPor_usuarios_id"
	}),
	cronogramas_aprovadoPor: many(cronogramas, {
		relationName: "cronogramas_aprovadoPor_usuarios_id"
	}),
	cronogramaTarefas: many(cronogramaTarefas),
	execucaoAtualizacoes: many(execucaoAtualizacoes),
	execucaoArquivos: many(execucaoArquivos),
	notificacoes: many(notificacoes),
	aprovacoes_aprovadorId: many(aprovacoes, {
		relationName: "aprovacoes_aprovadorId_usuarios_id"
	}),
	aprovacoes_solicitanteId: many(aprovacoes, {
		relationName: "aprovacoes_solicitanteId_usuarios_id"
	}),
	documentos_aprovadoPor: many(documentos, {
		relationName: "documentos_aprovadoPor_usuarios_id"
	}),
	documentos_criadoPor: many(documentos, {
		relationName: "documentos_criadoPor_usuarios_id"
	}),
	documentosVersoes: many(documentosVersoes),
	encerramentos_aprovadoPor: many(encerramentos, {
		relationName: "encerramentos_aprovadoPor_usuarios_id"
	}),
	encerramentos_criadoPor: many(encerramentos, {
		relationName: "encerramentos_criadoPor_usuarios_id"
	}),
	auditorias: many(auditoria),
	documentoAprovadores_createdBy: many(documentoAprovadores, {
		relationName: "documentoAprovadores_createdBy_usuarios_id"
	}),
	documentoAprovadores_usuarioId: many(documentoAprovadores, {
		relationName: "documentoAprovadores_usuarioId_usuarios_id"
	}),
	financeiroAnexos: many(financeiroAnexos),
	paybackLancamentos: many(paybackLancamentos),
	comiteDecisoes: many(comiteDecisoes),
	comitePendencias_resolvedBy: many(comitePendencias, {
		relationName: "comitePendencias_resolvedBy_usuarios_id"
	}),
	comitePendencias_createdBy: many(comitePendencias, {
		relationName: "comitePendencias_createdBy_usuarios_id"
	}),
	comiteAtas: many(comiteAta),
	comiteAtaHistoricos: many(comiteAtaHistorico),
	projetoFasePrazos: many(projetoFasePrazo),
	projetoFasePrazoHistoricos: many(projetoFasePrazoHistorico),
	viabilidadeCapexProjecoes: many(viabilidadeCapexProjecoes),
	cronogramaTarefaPagamentos: many(cronogramaTarefaPagamento),
	cronogramaTarefaParcelas: many(cronogramaTarefaParcelas),
	cronogramaTarefaParcelasHistoricos: many(cronogramaTarefaParcelasHistorico),
}));

export const perfisRelations = relations(perfis, ({many}) => ({
	usuarios: many(usuarios),
}));

export const sessoesRelations = relations(sessoes, ({one}) => ({
	usuario: one(usuarios, {
		fields: [sessoes.usuarioId],
		references: [usuarios.id]
	}),
}));

export const projetosRelations = relations(projetos, ({one, many}) => ({
	usuario_createdBy: one(usuarios, {
		fields: [projetos.createdBy],
		references: [usuarios.id],
		relationName: "projetos_createdBy_usuarios_id"
	}),
	usuario_gerenteId: one(usuarios, {
		fields: [projetos.gerenteId],
		references: [usuarios.id],
		relationName: "projetos_gerenteId_usuarios_id"
	}),
	area: one(areas, {
		fields: [projetos.areaId],
		references: [areas.id]
	}),
	diretoria: one(diretorias, {
		fields: [projetos.diretoriaId],
		references: [diretorias.id]
	}),
	usuario_solicitanteId: one(usuarios, {
		fields: [projetos.solicitanteId],
		references: [usuarios.id],
		relationName: "projetos_solicitanteId_usuarios_id"
	}),
	projetoStatusHistoricos: many(projetoStatusHistorico),
	projetoPrioridadeHistoricos: many(projetoPrioridadeHistorico),
	projetoAreas: many(projetoAreas),
	tapVersoes: many(tapVersoes),
	triagens: many(triagens),
	comiteProjetos: many(comiteProjetos),
	viabilidades: many(viabilidade),
	financeiroLancamentos: many(financeiroLancamentos),
	roiAcompanhamentos: many(roiAcompanhamento),
	estruturacaos: many(estruturacao),
	cronogramas: many(cronogramas),
	execucaoAtualizacoes: many(execucaoAtualizacoes),
	notificacoes: many(notificacoes),
	aprovacoes: many(aprovacoes),
	documentos: many(documentos),
	encerramentos: many(encerramentos),
	auditorias: many(auditoria),
	paybackLancamentos: many(paybackLancamentos),
	comiteDecisoes: many(comiteDecisoes),
	comitePendencias: many(comitePendencias),
	projetoFasePrazos: many(projetoFasePrazo),
	projetoFasePrazoHistoricos: many(projetoFasePrazoHistorico),
	viabilidadeCapexProjecoes: many(viabilidadeCapexProjecoes),
	cronogramaTarefaParcelasHistoricos: many(cronogramaTarefaParcelasHistorico),
}));

export const projetoStatusHistoricoRelations = relations(projetoStatusHistorico, ({one}) => ({
	usuario: one(usuarios, {
		fields: [projetoStatusHistorico.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [projetoStatusHistorico.projetoId],
		references: [projetos.id]
	}),
}));

export const projetoPrioridadeHistoricoRelations = relations(projetoPrioridadeHistorico, ({one}) => ({
	usuario: one(usuarios, {
		fields: [projetoPrioridadeHistorico.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [projetoPrioridadeHistorico.projetoId],
		references: [projetos.id]
	}),
}));

export const projetoAreasRelations = relations(projetoAreas, ({one}) => ({
	usuario: one(usuarios, {
		fields: [projetoAreas.responsavelId],
		references: [usuarios.id]
	}),
	area: one(areas, {
		fields: [projetoAreas.areaId],
		references: [areas.id]
	}),
	projeto: one(projetos, {
		fields: [projetoAreas.projetoId],
		references: [projetos.id]
	}),
}));

export const tapVersoesRelations = relations(tapVersoes, ({one}) => ({
	usuario_aprovadoPor: one(usuarios, {
		fields: [tapVersoes.aprovadoPor],
		references: [usuarios.id],
		relationName: "tapVersoes_aprovadoPor_usuarios_id"
	}),
	usuario_criadoPor: one(usuarios, {
		fields: [tapVersoes.criadoPor],
		references: [usuarios.id],
		relationName: "tapVersoes_criadoPor_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [tapVersoes.projetoId],
		references: [projetos.id]
	}),
}));

export const triagensRelations = relations(triagens, ({one}) => ({
	usuario_createdBy: one(usuarios, {
		fields: [triagens.createdBy],
		references: [usuarios.id],
		relationName: "triagens_createdBy_usuarios_id"
	}),
	usuario_responsavelId: one(usuarios, {
		fields: [triagens.responsavelId],
		references: [usuarios.id],
		relationName: "triagens_responsavelId_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [triagens.projetoId],
		references: [projetos.id]
	}),
}));

export const comitesRelations = relations(comites, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [comites.createdBy],
		references: [usuarios.id]
	}),
	comiteParticipantes: many(comiteParticipantes),
	comiteProjetos: many(comiteProjetos),
	comiteDocumentos: many(comiteDocumentos),
	comiteDecisoes: many(comiteDecisoes),
	comitePendencias: many(comitePendencias),
	comiteAtas: many(comiteAta),
	comiteAtaHistoricos: many(comiteAtaHistorico),
}));

export const comiteParticipantesRelations = relations(comiteParticipantes, ({one}) => ({
	usuario: one(usuarios, {
		fields: [comiteParticipantes.usuarioId],
		references: [usuarios.id]
	}),
	comite: one(comites, {
		fields: [comiteParticipantes.comiteId],
		references: [comites.id]
	}),
}));

export const comiteProjetosRelations = relations(comiteProjetos, ({one}) => ({
	projeto: one(projetos, {
		fields: [comiteProjetos.projetoId],
		references: [projetos.id]
	}),
	comite: one(comites, {
		fields: [comiteProjetos.comiteId],
		references: [comites.id]
	}),
}));

export const comiteDocumentosRelations = relations(comiteDocumentos, ({one}) => ({
	usuario: one(usuarios, {
		fields: [comiteDocumentos.createdBy],
		references: [usuarios.id]
	}),
	comite: one(comites, {
		fields: [comiteDocumentos.comiteId],
		references: [comites.id]
	}),
}));

export const viabilidadeRelations = relations(viabilidade, ({one, many}) => ({
	usuario_aprovadoPor: one(usuarios, {
		fields: [viabilidade.aprovadoPor],
		references: [usuarios.id],
		relationName: "viabilidade_aprovadoPor_usuarios_id"
	}),
	usuario_criadoPor: one(usuarios, {
		fields: [viabilidade.criadoPor],
		references: [usuarios.id],
		relationName: "viabilidade_criadoPor_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [viabilidade.projetoId],
		references: [projetos.id]
	}),
	viabilidadeCapexProjecoes: many(viabilidadeCapexProjecoes),
}));

export const financeiroLancamentosRelations = relations(financeiroLancamentos, ({one, many}) => ({
	usuario_aprovadoPor: one(usuarios, {
		fields: [financeiroLancamentos.aprovadoPor],
		references: [usuarios.id],
		relationName: "financeiroLancamentos_aprovadoPor_usuarios_id"
	}),
	usuario_criadoPor: one(usuarios, {
		fields: [financeiroLancamentos.criadoPor],
		references: [usuarios.id],
		relationName: "financeiroLancamentos_criadoPor_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [financeiroLancamentos.projetoId],
		references: [projetos.id]
	}),
	financeiroAnexos: many(financeiroAnexos),
}));

export const roiAcompanhamentoRelations = relations(roiAcompanhamento, ({one}) => ({
	usuario: one(usuarios, {
		fields: [roiAcompanhamento.criadoPor],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [roiAcompanhamento.projetoId],
		references: [projetos.id]
	}),
}));

export const estruturacaoRelations = relations(estruturacao, ({one}) => ({
	usuario_createdBy: one(usuarios, {
		fields: [estruturacao.createdBy],
		references: [usuarios.id],
		relationName: "estruturacao_createdBy_usuarios_id"
	}),
	usuario_patrocinadorId: one(usuarios, {
		fields: [estruturacao.patrocinadorId],
		references: [usuarios.id],
		relationName: "estruturacao_patrocinadorId_usuarios_id"
	}),
	usuario_gerenteId: one(usuarios, {
		fields: [estruturacao.gerenteId],
		references: [usuarios.id],
		relationName: "estruturacao_gerenteId_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [estruturacao.projetoId],
		references: [projetos.id]
	}),
}));

export const cronogramasRelations = relations(cronogramas, ({one, many}) => ({
	usuario_arquivadoPor: one(usuarios, {
		fields: [cronogramas.arquivadoPor],
		references: [usuarios.id],
		relationName: "cronogramas_arquivadoPor_usuarios_id"
	}),
	usuario_criadoPor: one(usuarios, {
		fields: [cronogramas.criadoPor],
		references: [usuarios.id],
		relationName: "cronogramas_criadoPor_usuarios_id"
	}),
	usuario_aprovadoPor: one(usuarios, {
		fields: [cronogramas.aprovadoPor],
		references: [usuarios.id],
		relationName: "cronogramas_aprovadoPor_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [cronogramas.projetoId],
		references: [projetos.id]
	}),
	cronogramaTarefas: many(cronogramaTarefas),
}));

export const cronogramaTarefasRelations = relations(cronogramaTarefas, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [cronogramaTarefas.responsavelId],
		references: [usuarios.id]
	}),
	cronogramaTarefa: one(cronogramaTarefas, {
		fields: [cronogramaTarefas.parentId],
		references: [cronogramaTarefas.id],
		relationName: "cronogramaTarefas_parentId_cronogramaTarefas_id"
	}),
	cronogramaTarefas: many(cronogramaTarefas, {
		relationName: "cronogramaTarefas_parentId_cronogramaTarefas_id"
	}),
	cronograma: one(cronogramas, {
		fields: [cronogramaTarefas.cronogramaId],
		references: [cronogramas.id]
	}),
	execucaoAtualizacoes: many(execucaoAtualizacoes),
	cronogramaTarefaPagamentos: many(cronogramaTarefaPagamento),
	cronogramaTarefaParcelas: many(cronogramaTarefaParcelas),
	cronogramaTarefaParcelasHistoricos: many(cronogramaTarefaParcelasHistorico),
}));

export const execucaoAtualizacoesRelations = relations(execucaoAtualizacoes, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [execucaoAtualizacoes.criadoPor],
		references: [usuarios.id]
	}),
	cronogramaTarefa: one(cronogramaTarefas, {
		fields: [execucaoAtualizacoes.tarefaId],
		references: [cronogramaTarefas.id]
	}),
	projeto: one(projetos, {
		fields: [execucaoAtualizacoes.projetoId],
		references: [projetos.id]
	}),
	execucaoArquivos: many(execucaoArquivos),
}));

export const execucaoArquivosRelations = relations(execucaoArquivos, ({one}) => ({
	usuario: one(usuarios, {
		fields: [execucaoArquivos.criadoPor],
		references: [usuarios.id]
	}),
	execucaoAtualizacoe: one(execucaoAtualizacoes, {
		fields: [execucaoArquivos.atualizacaoId],
		references: [execucaoAtualizacoes.id]
	}),
}));

export const notificacoesRelations = relations(notificacoes, ({one}) => ({
	projeto: one(projetos, {
		fields: [notificacoes.projetoId],
		references: [projetos.id]
	}),
	usuario: one(usuarios, {
		fields: [notificacoes.usuarioId],
		references: [usuarios.id]
	}),
}));

export const aprovacoesRelations = relations(aprovacoes, ({one}) => ({
	usuario_aprovadorId: one(usuarios, {
		fields: [aprovacoes.aprovadorId],
		references: [usuarios.id],
		relationName: "aprovacoes_aprovadorId_usuarios_id"
	}),
	usuario_solicitanteId: one(usuarios, {
		fields: [aprovacoes.solicitanteId],
		references: [usuarios.id],
		relationName: "aprovacoes_solicitanteId_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [aprovacoes.projetoId],
		references: [projetos.id]
	}),
}));

export const documentosRelations = relations(documentos, ({one, many}) => ({
	usuario_aprovadoPor: one(usuarios, {
		fields: [documentos.aprovadoPor],
		references: [usuarios.id],
		relationName: "documentos_aprovadoPor_usuarios_id"
	}),
	usuario_criadoPor: one(usuarios, {
		fields: [documentos.criadoPor],
		references: [usuarios.id],
		relationName: "documentos_criadoPor_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [documentos.projetoId],
		references: [projetos.id]
	}),
	documentosVersoes: many(documentosVersoes),
}));

export const documentosVersoesRelations = relations(documentosVersoes, ({one}) => ({
	usuario: one(usuarios, {
		fields: [documentosVersoes.criadoPor],
		references: [usuarios.id]
	}),
	documento: one(documentos, {
		fields: [documentosVersoes.documentoId],
		references: [documentos.id]
	}),
}));

export const encerramentosRelations = relations(encerramentos, ({one}) => ({
	usuario_aprovadoPor: one(usuarios, {
		fields: [encerramentos.aprovadoPor],
		references: [usuarios.id],
		relationName: "encerramentos_aprovadoPor_usuarios_id"
	}),
	usuario_criadoPor: one(usuarios, {
		fields: [encerramentos.criadoPor],
		references: [usuarios.id],
		relationName: "encerramentos_criadoPor_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [encerramentos.projetoId],
		references: [projetos.id]
	}),
}));

export const auditoriaRelations = relations(auditoria, ({one}) => ({
	projeto: one(projetos, {
		fields: [auditoria.projetoId],
		references: [projetos.id]
	}),
	usuario: one(usuarios, {
		fields: [auditoria.usuarioId],
		references: [usuarios.id]
	}),
}));

export const documentoAprovadoresRelations = relations(documentoAprovadores, ({one}) => ({
	usuario_createdBy: one(usuarios, {
		fields: [documentoAprovadores.createdBy],
		references: [usuarios.id],
		relationName: "documentoAprovadores_createdBy_usuarios_id"
	}),
	usuario_usuarioId: one(usuarios, {
		fields: [documentoAprovadores.usuarioId],
		references: [usuarios.id],
		relationName: "documentoAprovadores_usuarioId_usuarios_id"
	}),
}));

export const financeiroAnexosRelations = relations(financeiroAnexos, ({one}) => ({
	usuario: one(usuarios, {
		fields: [financeiroAnexos.criadoPor],
		references: [usuarios.id]
	}),
	financeiroLancamento: one(financeiroLancamentos, {
		fields: [financeiroAnexos.lancamentoId],
		references: [financeiroLancamentos.id]
	}),
}));

export const paybackLancamentosRelations = relations(paybackLancamentos, ({one}) => ({
	usuario: one(usuarios, {
		fields: [paybackLancamentos.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [paybackLancamentos.projetoId],
		references: [projetos.id]
	}),
}));

export const comiteDecisoesRelations = relations(comiteDecisoes, ({one}) => ({
	usuario: one(usuarios, {
		fields: [comiteDecisoes.createdBy],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [comiteDecisoes.projetoId],
		references: [projetos.id]
	}),
	comite: one(comites, {
		fields: [comiteDecisoes.comiteId],
		references: [comites.id]
	}),
}));

export const comitePendenciasRelations = relations(comitePendencias, ({one}) => ({
	usuario_resolvedBy: one(usuarios, {
		fields: [comitePendencias.resolvedBy],
		references: [usuarios.id],
		relationName: "comitePendencias_resolvedBy_usuarios_id"
	}),
	usuario_createdBy: one(usuarios, {
		fields: [comitePendencias.createdBy],
		references: [usuarios.id],
		relationName: "comitePendencias_createdBy_usuarios_id"
	}),
	projeto: one(projetos, {
		fields: [comitePendencias.projetoId],
		references: [projetos.id]
	}),
	comite: one(comites, {
		fields: [comitePendencias.comiteId],
		references: [comites.id]
	}),
}));

export const comiteAtaRelations = relations(comiteAta, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [comiteAta.createdBy],
		references: [usuarios.id]
	}),
	comite: one(comites, {
		fields: [comiteAta.comiteId],
		references: [comites.id]
	}),
	comiteAtaHistoricos: many(comiteAtaHistorico),
}));

export const comiteAtaHistoricoRelations = relations(comiteAtaHistorico, ({one}) => ({
	usuario: one(usuarios, {
		fields: [comiteAtaHistorico.usuarioId],
		references: [usuarios.id]
	}),
	comiteAta: one(comiteAta, {
		fields: [comiteAtaHistorico.ataId],
		references: [comiteAta.id]
	}),
	comite: one(comites, {
		fields: [comiteAtaHistorico.comiteId],
		references: [comites.id]
	}),
}));

export const projetoFasePrazoRelations = relations(projetoFasePrazo, ({one}) => ({
	usuario: one(usuarios, {
		fields: [projetoFasePrazo.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [projetoFasePrazo.projetoId],
		references: [projetos.id]
	}),
}));

export const projetoFasePrazoHistoricoRelations = relations(projetoFasePrazoHistorico, ({one}) => ({
	usuario: one(usuarios, {
		fields: [projetoFasePrazoHistorico.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [projetoFasePrazoHistorico.projetoId],
		references: [projetos.id]
	}),
}));

export const viabilidadeCapexProjecoesRelations = relations(viabilidadeCapexProjecoes, ({one}) => ({
	usuario: one(usuarios, {
		fields: [viabilidadeCapexProjecoes.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [viabilidadeCapexProjecoes.projetoId],
		references: [projetos.id]
	}),
	viabilidade: one(viabilidade, {
		fields: [viabilidadeCapexProjecoes.viabilidadeId],
		references: [viabilidade.id]
	}),
}));

export const cronogramaTarefaPagamentoRelations = relations(cronogramaTarefaPagamento, ({one}) => ({
	usuario: one(usuarios, {
		fields: [cronogramaTarefaPagamento.criadoPor],
		references: [usuarios.id]
	}),
	cronogramaTarefa: one(cronogramaTarefas, {
		fields: [cronogramaTarefaPagamento.cronogramaTarefaId],
		references: [cronogramaTarefas.id]
	}),
}));

export const cronogramaTarefaParcelasRelations = relations(cronogramaTarefaParcelas, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [cronogramaTarefaParcelas.pagoPor],
		references: [usuarios.id]
	}),
	cronogramaTarefa: one(cronogramaTarefas, {
		fields: [cronogramaTarefaParcelas.cronogramaTarefaId],
		references: [cronogramaTarefas.id]
	}),
	cronogramaTarefaParcelasHistoricos: many(cronogramaTarefaParcelasHistorico),
}));

export const cronogramaTarefaParcelasHistoricoRelations = relations(cronogramaTarefaParcelasHistorico, ({one}) => ({
	usuario: one(usuarios, {
		fields: [cronogramaTarefaParcelasHistorico.usuarioId],
		references: [usuarios.id]
	}),
	projeto: one(projetos, {
		fields: [cronogramaTarefaParcelasHistorico.projetoId],
		references: [projetos.id]
	}),
	cronogramaTarefa: one(cronogramaTarefas, {
		fields: [cronogramaTarefaParcelasHistorico.cronogramaTarefaId],
		references: [cronogramaTarefas.id]
	}),
	cronogramaTarefaParcela: one(cronogramaTarefaParcelas, {
		fields: [cronogramaTarefaParcelasHistorico.parcelaId],
		references: [cronogramaTarefaParcelas.id]
	}),
}));

export const financeiroContratoProjecaoParcelasRelations = relations(financeiroContratoProjecaoParcelas, ({one}) => ({
	financeiroContrato: one(financeiroContratos, {
		fields: [financeiroContratoProjecaoParcelas.contratoId],
		references: [financeiroContratos.id]
	}),
}));

export const financeiroContratosRelations = relations(financeiroContratos, ({many}) => ({
	financeiroContratoProjecaoParcelas: many(financeiroContratoProjecaoParcelas),
}));