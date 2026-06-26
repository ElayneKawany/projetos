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
  | 'GOLIVE'
  | 'ROI'
  | 'ENCERRAMENTO'
  | 'CANCELADO'
  | 'SUSPENSO'

export type Complexidade = 'BAIXA' | 'MEDIA' | 'ALTA'
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA'
export type Classificacao = 'PROJETO' | 'MELHORIA_CONTINUA'
export type PerfilUsuario = 'ADMIN' | 'PMO' | 'DIRETOR' | 'GESTOR' | 'SOLICITANTE' | 'CEO'

export const STATUS_LABELS: Record<StatusProjeto, string> = {
  PROPOSTA: 'Proposta / Ideia',
  TRIAGEM: 'Triagem / TAP Inicial',
  COMITE_IDEIAS: 'Comitê de Ideias',
  VIABILIDADE: 'Estudo de Viabilidade',
  COMPLEMENTACAO_TAP: 'Complementação TAP',
  APROVACAO: 'Fluxo de Aprovação',
  ESTRUTURACAO: 'Estruturação',
  CRONOGRAMA: 'Cronograma Oficial',
  EXECUCAO: 'Execução',
  GOLIVE: 'Go Live',
  ROI: 'Acompanhamento ROI',
  ENCERRAMENTO: 'Encerramento',
  CANCELADO: 'Cancelado',
  SUSPENSO: 'Suspenso',
}

export const STATUS_ORDER: StatusProjeto[] = [
  'PROPOSTA','TRIAGEM','COMITE_IDEIAS','VIABILIDADE',
  'COMPLEMENTACAO_TAP','APROVACAO','ESTRUTURACAO','CRONOGRAMA',
  'EXECUCAO','GOLIVE','ROI','ENCERRAMENTO',
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
  data_fim_prev?: string
  data_golive?: string
  ativo: number
  created_by: number
  created_at: string
  updated_at: string
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
  ativo: number
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
  vpl?: number
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
  local?: string
  pauta?: string
  decisao_geral?: string
  status: string
  created_by: number
  created_at: string
}

export interface CronogramaTarefa {
  id: number
  cronograma_id: number
  parent_id?: number
  nivel: number
  ordem: number
  codigo?: string
  nome: string
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

export interface DashboardPMOData {
  total_projetos: number
  projetos_ativos: number
  projetos_atrasados: number
  aprovacoes_pendentes: number
  roi_medio: number
  payback_medio: number
  proximos_comites: Comite[]
  por_status: { status: StatusProjeto; total: number }[]
  por_prioridade: { prioridade: Prioridade; total: number }[]
  investimento_total: number
}
