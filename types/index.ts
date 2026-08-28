// ============================================================
// TIPOS PMO MEGAG
// ============================================================

export type StatusProjeto =
  | 'PROPOSTA'
  | 'TRIAGEM'
  | 'COMITE_IDEIAS'
  | 'VIABILIDADE'
  | 'COMPLEMENTACAO_TAP'
  | 'APROVACAO'
  | 'ESTRUTURACAO'
  | 'CRONOGRAMA'
  | 'EXECUCAO'
  | 'PROJETO_CONCLUIDO'
  | 'PAYBACK_ACOMPANHAMENTO'
  | 'PAYBACK_ENCERRADO'
  | 'PROJETO_ENCERRADO'
  | 'GOLIVE'
  | 'ROI'
  | 'ENCERRAMENTO'
  | 'CANCELADO'
  | 'SUSPENSO'
  | 'PAUSADO'

export type Complexidade = 'BAIXA' | 'MEDIA' | 'ALTA'

export type TipoMacro =
  | 'INICIACAO'
  | 'PLANEJAMENTO'
  | 'ESTRUTURACAO'
  | 'DESENVOLVIMENTO'
  | 'IMPLANTACAO'
  | 'GO_LIVE'
  | 'ENCERRAMENTO'
  | 'OUTRO'
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA'
export type Classificacao = 'PROJETO' | 'MELHORIA_CONTINUA'
export type PerfilUsuario = 'ADMIN' | 'PMO' | 'DIRETOR' | 'GESTOR' | 'SOLICITANTE' | 'CEO'

export const STATUS_LABELS: Record<StatusProjeto, string> = {
  PROPOSTA: 'Proposta / Ideia',
  TRIAGEM: 'Triagem / TAP Inicial',
  COMITE_IDEIAS: 'Comitê de Projetos',
  VIABILIDADE: 'Estudo de Viabilidade',
  COMPLEMENTACAO_TAP: 'Complementação TAP',
  APROVACAO: 'Fluxo de Aprovação',
  ESTRUTURACAO: 'Estruturação',
  CRONOGRAMA: 'Cronograma Oficial',
  EXECUCAO: 'Execução em andamento',
  PROJETO_CONCLUIDO: 'Projeto Concluído',
  PAYBACK_ACOMPANHAMENTO: 'Payback em acompanhamento',
  PAYBACK_ENCERRADO: 'Payback Encerrado',
  PROJETO_ENCERRADO: 'Projeto Encerrado',
  GOLIVE: 'Go Live',
  ROI: 'Acompanhamento ROI',
  ENCERRAMENTO: 'Encerramento',
  CANCELADO: 'Cancelado',
  SUSPENSO: 'Suspenso',
  PAUSADO: 'Pausado',
}

export const STATUS_ORDER: StatusProjeto[] = [
  'PROPOSTA','TRIAGEM','COMITE_IDEIAS','VIABILIDADE',
  'COMPLEMENTACAO_TAP','APROVACAO','ESTRUTURACAO','CRONOGRAMA',
  'EXECUCAO','PROJETO_CONCLUIDO','PAYBACK_ACOMPANHAMENTO','PAYBACK_ENCERRADO','PROJETO_ENCERRADO',
]

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta',
}
export const COMPLEXIDADE_LABELS: Record<Complexidade, string> = {
  BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta',
}

export interface Projeto {
  id: number
  codigo: string
  nome: string
  solicitante_id: number
  solicitante_nome?: string
  diretoria_id: number
  diretoria_nome?: string
  area_id: number
  area_nome?: string
  ponto_focal?: string
  contato?: string
  objetivo: string
  justificativa?: string
  descricao?: string
  beneficios?: string
  status: StatusProjeto
  classificacao?: Classificacao
  complexidade?: Complexidade
  prioridade: Prioridade
  gerente_id?: number
  gerente_nome?: string
  capex_aprovado: number
  opex_aprovado: number
  data_inicio_prev?: string
  /** @deprecated LEGADO — NÃO usar para prazo, status ou KPI. Use data_fim_efetiva. */
  data_fim_prev?: string
  /** Fonte oficial de prazo/atraso (ver DATA_FIM_EFETIVA_SQL): Data Base de Entrega (imutável,
   *  travada na 1ª aprovação de Cronograma) quando existir; senão a Data limite da macro fase
   *  atual (projeto_fase_prazo). */
  data_fim_efetiva?: string | null
  /** Imutável — travada uma única vez na aprovação do 1º Cronograma. Nunca sobrescrita depois. */
  data_base_entrega?: string | null
  data_base_entrega_definida_em?: string | null
  data_golive?: string
  data_conclusao_real?: string | null
  hora_conclusao?: string | null
  responsavel_conclusao?: string | null
  motivo_conclusao?: string | null
  checklist_conclusao?: string | null
  // Campos de migração histórica
  projeto_migrado?: number
  migrado_em?: string | null
  migrado_por?: number | null
  origem_dados?: string | null
  arquivo_origem?: string | null
  motivo_pausa_id?: number | null
  motivo_pausa_nome?: string | null
  data_pausa?: string | null
  usuario_pausa?: number | null
  pmo_responsavel_id?: number | null
  pmo_responsavel_nome?: string | null
  pmo_responsavel?: string | null
  tipo_beneficio?: string | null
  cronograma_pendente?: number
  has_cronograma?: number
  tarefas_atrasadas?: number
  tem_revisao_pendente?: number
  ativo: number
  created_by: number
  created_at: string
  updated_at: string
}

export interface MotivoPausa {
  id: number
  nome: string
  descricao: string | null
  ordem: number
  ativo: number
}

export interface Usuario {
  id: number
  cpf: string
  nome: string
  email: string
  cargo?: string
  diretoria_id?: number
  diretoria_nome?: string
  area_id?: number
  area_nome?: string
  perfil_id: number
  perfil: string
  ativo: number
  ultimo_login?: string
  created_at: string
}

export interface Diretoria {
  id: number
  codigo: string
  nome: string
  sigla: string
  descricao: string | null
  ativo: number
  created_at: string
  updated_at: string | null
  projeto_count?: number
}

export interface Area {
  id: number
  diretoria_id: number
  diretoria_nome?: string
  codigo: string
  nome: string
  sigla: string
  ativo: number
}

export interface TapVersao {
  id: number
  projeto_id: number
  versao: number
  label: string
  fase_origem: string
  escopo_inicial?: string
  escopo_fora?: string
  beneficios_tap?: string
  areas_impactadas?: string
  objetivo_detalhado?: string
  descricao_solucao?: string
  premissas?: string
  restricoes?: string
  riscos_iniciais?: string
  investimento_total?: number
  roi_previsto?: number
  tir?: number
  payback_meses?: number
  criado_por: number
  aprovado_por?: number
  aprovado_em?: string
  status: string
  created_at: string
}

export interface Comite {
  id: number
  titulo: string
  tipo: string
  data_realizacao: string
  hora?: string
  local?: string
  pauta?: string
  descricao?: string
  decisao_geral?: string
  status: string
  periodo_inicio?: string
  periodo_fim?: string
  resumo_executivo_ia?: string
  resumo_executivo_ia_json?: string
  resumo_ia_gerado_em?: string
  created_by: number
  created_at: string
  updated_at?: string
}

export interface ComiteParticipante {
  id: number
  comite_id: number
  usuario_id?: number
  usuario_nome?: string
  nome_externo?: string
  cargo?: string
  presente: number
  confirmado: number
  created_at: string
}

export interface ComiteProjetoItem {
  id: number
  comite_id: number
  projeto_id: number
  pauta_item?: string
  decisao?: string
  observacoes?: string
  ordem_pauta: number
  tempo_previsto?: number
  snap_prioridade?: string
  snap_complexidade?: string
  snap_investimento?: number
  snap_roi?: number
  snap_payback?: number
  created_at: string
  // joined
  projeto_codigo?: string
  projeto_nome?: string
  projeto_status?: string
  projeto_diretoria?: string
}

export interface ComiteDecisao {
  id: number
  comite_id: number
  projeto_id?: number
  tipo: string
  descricao: string
  responsavel_nome?: string
  prazo?: string
  status: string
  created_by: number
  created_at: string
  // joined
  projeto_nome?: string
  projeto_codigo?: string
}

export interface ComitePendencia {
  id: number
  comite_id: number
  projeto_id?: number
  descricao: string
  responsavel_nome?: string
  prazo?: string
  status: string
  created_by: number
  created_at: string
  resolved_at?: string
  resolved_by?: number
  // joined
  projeto_nome?: string
  projeto_codigo?: string
}

export interface ComiteAta {
  id: number
  comite_id: number
  transcricao?: string
  conteudo?: string
  conteudo_json?: string
  versao: number
  gerado_por_ia: number
  status: 'RASCUNHO' | 'PENDENTE_APROVACAO' | 'APROVADO'
  hora_inicio?: string
  hora_fim?: string
  duracao_min?: number
  created_by: number
  created_at: string
  updated_at: string
}

export interface ComiteAtaHistorico {
  id: number
  comite_id: number
  ata_id: number
  versao: number
  acao: string
  usuario_id: number
  usuario_nome?: string
  created_at: string
}

export interface AtaConteudoJson {
  resumo?: string
  projetos_discutidos?: { nome: string; status?: string; pontos: string; problemas?: string; decisoes?: string }[]
  decisoes?: { descricao: string; responsavel?: string; prazo?: string }[]
  pendencias?: { descricao: string; responsavel?: string; prazo?: string }[]
  plano_acao?: { acao: string; responsavel: string; prazo: string; status: string }[]
  riscos?: string[]
  observacoes?: string
  participantes_identificados?: string[]
  ausentes?: string[]
}

export interface CronogramaTarefa {
  id: number
  cronograma_id: number
  parent_id?: number
  nivel: number
  ordem: number
  codigo?: string
  nome: string
  tipo_macro?: TipoMacro | null
  responsavel_id?: number
  responsavel_nome?: string
  data_inicio?: string
  data_fim?: string
  duracao_dias?: number
  dependencias?: string
  percentual: number
  bloqueio: number
  motivo_bloqueio?: string
  status: string
  subtarefas?: CronogramaTarefa[]
}

export interface FinanceiroLancamento {
  id: number
  projeto_id: number
  tipo: 'CAPEX' | 'OPEX'
  categoria: string
  descricao: string
  fornecedor?: string
  numero_doc?: string
  valor: number
  data_lancamento: string
  competencia?: string
  observacoes?: string
  arquivo_path?: string
  criado_por: number
  status: string
  created_at: string
}

export interface Documento {
  id: number
  projeto_id?: number
  tipo: string
  titulo: string
  descricao?: string
  versao: number
  status: string
  gerado_auto: number
  caminho?: string
  criado_por: number
  aprovado_por?: number
  aprovado_em?: string
  publicado_em?: string
  created_at: string
}

export interface Notificacao {
  id: number
  usuario_id: number
  projeto_id?: number
  projeto_codigo?: string
  projeto_nome?: string
  tipo: string
  titulo: string
  mensagem: string
  lida: number
  lida_em?: string
  created_at: string
}

export interface Aprovacao {
  id: number
  projeto_id: number
  projeto_codigo?: string
  projeto_nome?: string
  tipo: string
  referencia_id?: number
  referencia_tipo?: string
  status: string
  solicitante_id: number
  solicitante_nome?: string
  aprovador_id?: number
  observacao_req?: string
  observacao_apr?: string
  aprovado_em?: string
  prazo?: string
  created_at: string
}

export interface AuditoriaLog {
  id: number
  usuario_id?: number
  usuario_nome?: string
  acao: string
  entidade: string
  entidade_id?: number
  projeto_id?: number
  descricao: string
  dados_antes?: string
  dados_depois?: string
  ip?: string
  created_at: string
}

// ─── Módulo Financeiro — Contratos ───────────────────────────────────────────

export type TipoContrato = 'SERVICO' | 'FORNECIMENTO' | 'OBRA' | 'OUTRO'
export type StatusContrato = 'ATIVO' | 'SUSPENSO' | 'ENCERRADO' | 'CANCELADO'
export type TipoDocumentoFinanceiro = 'NF' | 'BOLETO' | 'TED' | 'PIX' | 'CHEQUE' | 'OUTRO'
export type NaturezaFinanceira = 'CAPEX' | 'OPEX'

/** Resultado do enquadramento de um lançamento a um contrato. null = lançamento anterior à feature, nunca reavaliado. */
export type EnquadramentoStatus = 'AUTOMATICO' | 'AGUARDANDO_ANALISE' | 'SEM_CONTRATO' | 'MANUAL'

export interface FinanceiroContrato {
  id: number
  projeto_id: number
  numero_contrato: string | null
  contratado: string
  tipo_contrato: TipoContrato
  natureza_financeira: NaturezaFinanceira
  descricao_servico: string | null
  /** Critério de enquadramento (ex.: "Aço e Cordoalha"). null = contrato sem restrição de categoria. */
  categoria: string | null
  valor_aprovado: number
  status: StatusContrato
  observacao: string | null
  ativo: number
  criado_por: number | null
  created_at: string
  updated_at: string
}

export interface FinanceiroContratoPagamento {
  id: number
  contrato_id: number | null
  projeto_id: number
  numero_documento: string | null
  tipo_documento: TipoDocumentoFinanceiro
  nota_fiscal: string | null
  data_pagamento: string | null
  competencia: string | null
  valor_pago: number
  observacao: string | null
  arquivo_path: string | null
  ativo: number
  criado_por: number | null
  created_at: string
  /** Fornecedor que emitiu este lançamento — null em registros anteriores à feature de enquadramento (usar o `contratado` do contrato vinculado como fallback de exibição). */
  fornecedor: string | null
  enquadramento_status: EnquadramentoStatus | null
  /** Ids dos contratos compatíveis encontrados na avaliação (só populado quando AGUARDANDO_ANALISE). */
  contratos_candidatos: number[] | null
}

/** Uma entrada do histórico de enquadramento de um pagamento — nunca alterado/apagado (append-only). */
export interface FinanceiroEnquadramentoHistorico {
  id: number
  pagamento_id: number
  projeto_id: number
  contrato_id_anterior: number | null
  contrato_id_novo: number | null
  tipo_acao: 'AUTOMATICO' | 'MANUAL' | 'CORRECAO_MANUAL'
  regra_utilizada: string | null
  usuario_id: number | null
  usuario_nome: string | null
  created_at: string
}

export interface FinanceiroContratoCompleto extends FinanceiroContrato {
  pagamentos: FinanceiroContratoPagamento[]
  valor_pago_total: number
  saldo: number
  percentual: number
}

export interface FinanceiroResumoExecutivo {
  capex_viabilidade: number
  opex_viabilidade: number
  capex_executado: number
  opex_executado: number
  saldo_capex: number
  saldo_opex: number
  total_planejado: number
  total_executado: number
  saldo: number
  percentual_executado: number
  quantidade_contratos: number
}

export interface FinanceiroInconsistencia {
  tipo: string
  descricao: string
  contrato_id?: number
  contratado?: string
  severidade: 'CRITICA' | 'ALTA' | 'MEDIA'
}

/** Dados agregados consumidos pelo módulo de Acompanhamento de Payback. */
export interface FinanceiroCardsPayback {
  resumo: FinanceiroResumoExecutivo
  /** Distribuição mensal de pagamentos com acumulado — base para a curva de Payback. */
  distribuicao_mensal: {
    competencia: string
    valor_pago: number
    acumulado: number
  }[]
  /** Distribuição por natureza financeira (CAPEX/OPEX) — consumida diretamente pelo Payback. */
  por_natureza: {
    natureza: NaturezaFinanceira
    valor_planejado: number
    valor_executado: number
    saldo: number
    percentual: number
  }[]
  /** Distribuição por tipo de contrato (SERVICO/FORNECIMENTO/OBRA/OUTRO). */
  por_tipo_contrato: {
    tipo_contrato: TipoContrato
    valor_aprovado: number
    valor_pago: number
    percentual: number
  }[]
}

/** Snapshot imutável gerado no momento da conclusão oficial do projeto. */
export interface ProjetoSnapshotFinal {
  id: number
  projeto_id: number
  roi_previsto: number | null
  roi_atual: number | null
  capex_previsto: number | null
  capex_executado: number | null
  opex_previsto: number | null
  opex_executado: number | null
  economia_prevista: number | null
  economia_realizada: number | null
  data_fim_prev: string | null
  data_conclusao_real: string | null
  dias_desvio: number | null
  responsavel: string | null
  created_at: string
}

// ============================================================
// MÓDULO PAYBACK — Interfaces de dados
// ============================================================

export type StatusCompetencia = 'RASCUNHO' | 'APROVADO'

export type TipoRelatorioPayback =
  | 'RESUMO_EXECUTIVO'
  | 'FINANCEIRO'
  | 'ROI'
  | 'TIR'
  | 'FLUXO_CAIXA'
  | 'COMPETENCIAS'
  | 'HISTORICO'
  | 'PDF'
  | 'EXCEL'

/** Lançamento mensal de benefícios e custos realizados no período de Payback. */
export interface PaybackCompetencia {
  id: number
  projeto_id: number
  ano: number
  mes: number
  receita: number
  economia: number
  capex: number
  opex: number
  fluxo: number
  observacao: string | null
  status: StatusCompetencia
  criado_por: number | null
  created_at: string
  updated_at: string
}

/** Fluxo de caixa mensal calculado a partir das competências. */
export interface PaybackFluxo {
  periodo: string        // 'YYYY-MM'
  ano: number
  mes: number
  receita: number
  economia: number
  despesa_capex: number
  despesa_opex: number
  fluxo_liquido: number
  fluxo_acumulado: number
}

/** Conjunto completo de indicadores financeiros planejados e realizados. */
export interface PaybackIndicadores {
  roi_previsto: number | null
  roi_atual: number | null
  roi_final: number | null
  tir_prevista: number | null
  tir_atual: number | null
  tir_final: number | null
  capex_planejado: number | null
  capex_executado: number | null
  opex_planejado: number | null
  opex_executado: number | null
  economia_prevista: number | null
  economia_real: number | null
  fluxo_acumulado: number | null
  saldo: number | null
}

/** Resumo executivo do módulo de Payback para um projeto. */
export interface PaybackResumo {
  projeto_id: number
  status_payback: string
  data_inicio_payback: string | null
  data_previsao_encerramento: string | null
  data_encerramento_real: string | null
  meses_decorridos: number
  meses_previstos: number | null
  indicadores: PaybackIndicadores
  total_competencias: number
  ultima_competencia: string | null
}

/** Entrada de auditoria / histórico do módulo Payback. */
export interface PaybackHistorico {
  id: number
  projeto_id: number
  acao: string
  descricao: string
  usuario_id: number | null
  usuario_nome: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string
}

/** Metadados de relatório gerado pelo módulo Payback. */
export interface PaybackRelatorio {
  tipo: TipoRelatorioPayback
  titulo: string
  projeto_id: number
  gerado_em: string
  gerado_por: string
}

/**
 * Snapshot pontual do Payback (criado em revisões ou encerramento).
 * Diferente de ProjetoSnapshotFinal — este captura o estado durante o acompanhamento.
 */
export interface PaybackSnapshot {
  projeto_id: number
  data_referencia: string
  indicadores: PaybackIndicadores
  competencias: PaybackFluxo[]
  observacoes: string | null
  criado_por: string
  created_at: string
}

/** Cards do Dashboard Executivo do Payback. */
export interface PaybackDashboardCard {
  label: string
  valor: number | null
  unidade: string
  tendencia: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO' | null
  percentual: number | null
}

export type StatusCronograma = 'NO_PRAZO' | 'ATENCAO' | 'ATRASADO' | 'SEM_CRONOGRAMA'

export const STATUS_CRONOGRAMA_LABELS: Record<StatusCronograma, string> = {
  NO_PRAZO: 'No Prazo',
  ATENCAO: 'Atenção',
  ATRASADO: 'Atrasado',
  SEM_CRONOGRAMA: 'Sem Cronograma',
}

export type TipoBeneficioPayback =
  | 'ECONOMIA_OPERACIONAL'
  | 'AUMENTO_RECEITA'
  | 'REDUCAO_PERDAS'
  | 'RECUPERACAO_TRIBUTARIA'
  | 'REDUCAO_CUSTOS'
  | 'OUTRO'

export interface PaybackLancamento {
  id: number
  projeto_id: number
  competencia: string
  data_lancamento: string
  investimento_periodo: number
  beneficio_periodo: number
  tipo_beneficio?: TipoBeneficioPayback | null
  observacao?: string | null
  usuario_id?: number | null
  usuario_nome?: string | null
  created_at: string
  updated_at: string
}

export type PaybackStatus = 'SEM_LANCAMENTOS' | 'EM_ANDAMENTO' | 'CONCLUIDO'

export interface PaybackLancamentosResumo {
  capex_aprovado: number
  opex_aprovado: number
  custo_desenvolvimento_interno: number
  investimento_aprovado: number
  beneficio_previsto: number | null
  payback_previsto_meses: number | null
  data_golive: string | null
  investimento_realizado: number
  beneficio_acumulado: number
  saldo_financeiro: number
  percentual_recuperado: number
  valor_restante: number
  payback_real_meses: number | null
  status: PaybackStatus
  lancamentos: PaybackLancamento[]
}

export interface DiretoriaDashboard {
  diretoria_id: number
  diretoria_nome: string
  diretoria_sigla: string
  total: number
  ativos: number
  atrasados: number
  pausados: number
  concluidos: number
  encerrados: number
  sem_cronograma: number
  aprovacoes_pendentes: number
  investimento_previsto: number
  investimento_realizado: number
  roi_medio: number | null
  status_counts: Record<string, number>
}

export interface DashboardPMOData {
  total_projetos: number
  projetos_ativos: number
  projetos_atrasados: number
  aprovacoes_pendentes: number
  payback_medio: number
  proximos_comites: Comite[]
  por_status: { status: StatusProjeto; total: number }[]
  por_prioridade: { prioridade: Prioridade; total: number }[]
  investimento_total: number
  projetos_no_prazo: number
  projetos_atencao: number
  projetos_atrasados_prazo: number
  projetos_sem_cronograma: number
  projetos_pausados: number
  projetos_concluidos: number
  projetos_encerrados: number
  por_diretoria: DiretoriaDashboard[]
  beneficio_realizado: number
}
