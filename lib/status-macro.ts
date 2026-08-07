import type { StatusProjeto } from '@/types'

export type StatusMacro =
  | 'MACRO_PROPOSTA'
  | 'MACRO_VIABILIDADE'
  | 'MACRO_ESTRUTURACAO'
  | 'MACRO_EXECUCAO'
  | 'MACRO_PAUSADO'
  | 'MACRO_CANCELADO'
  | 'MACRO_CONCLUIDO'
  | 'MACRO_PAYBACK'

export const STATUS_MACRO_LABELS: Record<StatusMacro, string> = {
  MACRO_PROPOSTA:      'Proposta / Ideia',
  MACRO_VIABILIDADE:   'Estudo de Viabilidade',
  MACRO_ESTRUTURACAO:  'Estruturação',
  MACRO_EXECUCAO:      'Execução',
  MACRO_PAUSADO:       'Pausado',
  MACRO_CANCELADO:     'Cancelado',
  MACRO_CONCLUIDO:     'Concluído',
  MACRO_PAYBACK:       'Payback',
}

// Mapeamento operacional → macro (não alterar os status existentes)
const STATUS_PARA_MACRO: Record<StatusProjeto, StatusMacro> = {
  PROPOSTA:               'MACRO_PROPOSTA',
  TRIAGEM:                'MACRO_PROPOSTA',
  COMITE_IDEIAS:          'MACRO_PROPOSTA',
  VIABILIDADE:            'MACRO_VIABILIDADE',
  COMPLEMENTACAO_TAP:     'MACRO_VIABILIDADE',
  APROVACAO:              'MACRO_VIABILIDADE',
  ESTRUTURACAO:           'MACRO_ESTRUTURACAO',
  CRONOGRAMA:             'MACRO_EXECUCAO',
  EXECUCAO:               'MACRO_EXECUCAO',
  GOLIVE:                 'MACRO_EXECUCAO',
  ROI:                    'MACRO_PAYBACK',
  ENCERRAMENTO:           'MACRO_CONCLUIDO',
  PAUSADO:                'MACRO_PAUSADO',
  SUSPENSO:               'MACRO_PAUSADO',
  CANCELADO:              'MACRO_CANCELADO',
  PROJETO_CONCLUIDO:      'MACRO_CONCLUIDO',
  PROJETO_ENCERRADO:      'MACRO_CONCLUIDO',
  PAYBACK_ACOMPANHAMENTO: 'MACRO_PAYBACK',
  PAYBACK_ENCERRADO:      'MACRO_PAYBACK',
}

/** Retorna o StatusMacro de um status operacional. */
export function getStatusMacro(status: StatusProjeto): StatusMacro {
  return STATUS_PARA_MACRO[status] ?? 'MACRO_PROPOSTA'
}

/** Retorna todos os StatusProjeto que pertencem a um StatusMacro (para uso no filtro). */
export function getStatusOperacionais(macro: StatusMacro): StatusProjeto[] {
  return (Object.entries(STATUS_PARA_MACRO) as [StatusProjeto, StatusMacro][])
    .filter(([, m]) => m === macro)
    .map(([s]) => s)
}

export const STATUS_MACRO_BADGES: Record<StatusMacro, string> = {
  MACRO_PROPOSTA:      'badge-proposta',
  MACRO_VIABILIDADE:   'badge-viabilidade',
  MACRO_ESTRUTURACAO:  'badge-estruturacao',
  MACRO_EXECUCAO:      'badge-execucao',
  MACRO_PAUSADO:       'badge-suspenso',
  MACRO_CANCELADO:     'badge-cancelado',
  MACRO_CONCLUIDO:     'badge-concluido',
  MACRO_PAYBACK:       'badge-payback',
}

/** Ordem de exibição dos status macro no select. */
export const STATUS_MACRO_ORDER: StatusMacro[] = [
  'MACRO_PROPOSTA',
  'MACRO_VIABILIDADE',
  'MACRO_ESTRUTURACAO',
  'MACRO_EXECUCAO',
  'MACRO_PAUSADO',
  'MACRO_CANCELADO',
  'MACRO_CONCLUIDO',
  'MACRO_PAYBACK',
]
