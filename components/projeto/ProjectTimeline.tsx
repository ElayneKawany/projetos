'use client'

import { STATUS_ORDER, STATUS_LABELS } from '@/types'

interface HistoricoItem {
  status_de: string
  status_para: string
  created_at: string
}

interface Props {
  statusAtual: string
  historicoStatus: HistoricoItem[]
  temCronogramaAprovado?: boolean
  temViabilidadeAprovada?: boolean
  temTapAprovado?: boolean
  /** Início/fim reais da execução, derivados do cronograma vigente (não da data de entrada no status). */
  execucaoRange?: { inicio: string; fim: string } | null
}

const SHORT_LABELS: Record<string, string> = {
  PROPOSTA: 'PR',
  TRIAGEM: 'TR',
  COMITE_IDEIAS: 'CI',
  VIABILIDADE: 'VB',
  COMPLEMENTACAO_TAP: 'CT',
  APROVACAO: 'AP',
  ESTRUTURACAO: 'ES',
  CRONOGRAMA: 'CR',
  EXECUCAO: 'EX',
  PROJETO_CONCLUIDO: 'PC',
  PAYBACK_ACOMPANHAMENTO: 'PA',
  PAYBACK_ENCERRADO: 'PE',
  PROJETO_ENCERRADO: 'EN',
  GOLIVE: 'GL',
  ROI: 'RO',
  ENCERRAMENTO: 'EC',
}

const PHASE_ICONS: Record<string, string> = {
  PROPOSTA: '💡',
  TRIAGEM: '📄',
  COMITE_IDEIAS: '🤝',
  VIABILIDADE: '📊',
  COMPLEMENTACAO_TAP: '📄',
  APROVACAO: '✅',
  ESTRUTURACAO: '🏗️',
  CRONOGRAMA: '📅',
  EXECUCAO: '🚀',
  PROJETO_CONCLUIDO: '✅',
  PAYBACK_ACOMPANHAMENTO: '💰',
  PAYBACK_ENCERRADO: '💰',
  PROJETO_ENCERRADO: '🏁',
  GOLIVE: '🚀',
  ROI: '📈',
  ENCERRAMENTO: '🏁',
}

const PHASE_LABELS: Record<string, string> = {
  PROPOSTA: 'Proposta / Ideia',
  TRIAGEM: 'Triagem / TAP',
  COMITE_IDEIAS: 'Comitê de Projetos',
  VIABILIDADE: 'Viabilidade',
  COMPLEMENTACAO_TAP: 'Complementação TAP',
  APROVACAO: 'Aprovação',
  ESTRUTURACAO: 'Estruturação',
  CRONOGRAMA: 'Cronograma',
  EXECUCAO: 'Execução',
  PROJETO_CONCLUIDO: 'Projeto Concluído',
  PAYBACK_ACOMPANHAMENTO: 'Payback',
  PAYBACK_ENCERRADO: 'Payback Encerrado',
  PROJETO_ENCERRADO: 'Projeto Encerrado',
  GOLIVE: 'Go Live',
  ROI: 'Acompanhamento ROI',
  ENCERRAMENTO: 'Encerramento',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return ''
  }
}

export default function ProjectTimeline({ statusAtual, historicoStatus, temCronogramaAprovado, temViabilidadeAprovada, temTapAprovado, execucaoRange }: Props) {
  const isCancelado = statusAtual === 'CANCELADO'
  const isSuspenso = statusAtual === 'SUSPENSO'
  const isPausado = statusAtual === 'PAUSADO'
  const isSpecial = isCancelado || isSuspenso

  // Infere o status efetivo mais avançado com base nos marcos já atingidos.
  // Garante que a Timeline nunca fique "para trás" do que os artefatos indicam.
  function inferirStatusEfetivo(status: string): string {
    const idx = (s: string) => STATUS_ORDER.indexOf(s as never)
    let efetivo = status

    if (temTapAprovado && idx(efetivo) < idx('TRIAGEM')) efetivo = 'TRIAGEM'
    if (temViabilidadeAprovada && idx(efetivo) < idx('VIABILIDADE')) efetivo = 'VIABILIDADE'
    if (temCronogramaAprovado && idx(efetivo) < idx('CRONOGRAMA')) efetivo = 'CRONOGRAMA'
    // Se já há cronograma aprovado e o status ainda está antes de EXECUCAO, avança para EXECUCAO
    if (temCronogramaAprovado && idx(efetivo) === idx('CRONOGRAMA') && idx(status) >= idx('EXECUCAO')) {
      efetivo = status
    }

    return efetivo
  }

  const statusEfetivo = isSpecial || isPausado ? statusAtual : inferirStatusEfetivo(statusAtual)
  const currentIndex = STATUS_ORDER.indexOf(statusEfetivo as never)

  // Mapa de conclusão explícita por artefato:
  // garante que TAP, Viabilidade e Cronograma mostrem como concluídos
  // sempre que o artefato correspondente estiver aprovado E o status já tiver avançado.
  const ARTEFATO_CONCLUIDO: Partial<Record<string, boolean>> = {
    TRIAGEM:     !!temTapAprovado          && currentIndex > STATUS_ORDER.indexOf('TRIAGEM'     as never),
    VIABILIDADE: !!temViabilidadeAprovada  && currentIndex > STATUS_ORDER.indexOf('VIABILIDADE' as never),
    CRONOGRAMA:  !!temCronogramaAprovado   && currentIndex > STATUS_ORDER.indexOf('CRONOGRAMA'  as never),
  }

  const completedCount = isSpecial ? 0 : Math.max(0, currentIndex)
  const totalPhases = STATUS_ORDER.length

  // Build a map: phase -> entry date (when it became that status)
  const entryDates: Record<string, string> = {}
  for (const h of historicoStatus) {
    if (h.status_para && !entryDates[h.status_para]) {
      entryDates[h.status_para] = h.created_at
    }
  }

  const percentComplete = isSpecial ? 0 : Math.round((completedCount / (totalPhases - 1)) * 100)
  const remaining = isSpecial ? totalPhases : Math.max(0, totalPhases - 1 - currentIndex)

  return (
    <div className="space-y-6">
      {/* Special status badges */}
      {isSpecial && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${isCancelado ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${isCancelado ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {isCancelado ? '✕ Cancelado' : '⏸ Suspenso'}
          </span>
          <span className="text-sm text-gray-600">
            {isCancelado ? 'Este projeto foi cancelado.' : 'Este projeto está suspenso temporariamente.'}
          </span>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Linha do Tempo do Projeto</h3>
        </div>
        <div className="p-4 overflow-x-auto">
          <div className="min-w-max">
            <div className="flex items-start">
              {STATUS_ORDER.map((phase, idx) => {
                const isCompleted = !isSpecial && (idx < currentIndex || !!ARTEFATO_CONCLUIDO[phase])
                const isCurrent = !isSpecial && phase === statusEfetivo
                const isFuture = isSpecial || (!isCompleted && !isCurrent)
                const entryDate = entryDates[phase]
                const isLast = idx === STATUS_ORDER.length - 1

                return (
                  <div key={phase} className="flex items-start">
                    {/* Node + label */}
                    <div className="flex flex-col items-center" style={{ minWidth: '72px' }}>
                      {/* Circle */}
                      <div className="relative flex items-center justify-center">
                        {isCurrent && (
                          <span
                            className="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping"
                            style={{ backgroundColor: '#C8A84B' }}
                          />
                        )}
                        <div
                          className="relative flex items-center justify-center rounded-full text-xs font-bold select-none"
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: isCompleted
                              ? '#003087'
                              : isCurrent
                              ? '#C8A84B'
                              : 'transparent',
                            border: isFuture ? '2px solid #D1D5DB' : 'none',
                            color: isCompleted || isCurrent ? '#fff' : '#9CA3AF',
                          }}
                        >
                          {isCompleted ? (PHASE_ICONS[phase] ?? '✓') : SHORT_LABELS[phase] ?? idx + 1}
                        </div>
                      </div>
                      {/* Phase name */}
                      <span
                        className="mt-2 text-center leading-tight"
                        style={{
                          fontSize: '10px',
                          maxWidth: '64px',
                          color: isCompleted ? '#003087' : isCurrent ? '#C8A84B' : '#9CA3AF',
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      >
                        {PHASE_LABELS[phase]}
                      </span>
                      {/* Entry date */}
                      {phase === 'EXECUCAO' && execucaoRange ? (
                        <span className="mt-1 text-center" style={{ fontSize: '9px', color: '#6B7280' }}>
                          {formatDate(execucaoRange.inicio + 'T12:00:00')} → {formatDate(execucaoRange.fim + 'T12:00:00')}
                        </span>
                      ) : entryDate && (
                        <span className="mt-1 text-center" style={{ fontSize: '9px', color: '#6B7280' }}>
                          {formatDate(entryDate)}
                        </span>
                      )}
                    </div>

                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className="mt-5 flex-shrink-0"
                        style={{
                          height: '2px',
                          width: '24px',
                          backgroundColor: isCompleted ? '#003087' : '#E5E7EB',
                          alignSelf: 'flex-start',
                          marginTop: '19px',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Journey summary card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Jornada do Projeto</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-blue-50">
              <div className="text-2xl font-bold" style={{ color: '#003087' }}>
                {completedCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">Etapas concluídas</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-50">
              <div className="text-lg font-bold" style={{ color: '#C8A84B' }}>
                {isSpecial ? statusAtual : (PHASE_LABELS[statusEfetivo] ?? statusEfetivo)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Fase atual</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold text-gray-400">{remaining}</div>
              <div className="text-xs text-gray-500 mt-1">Etapas restantes</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold text-gray-700">{percentComplete}%</div>
              <div className="text-xs text-gray-500 mt-1">Concluído</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${percentComplete}%`,
                background: isSpecial
                  ? '#EF4444'
                  : `linear-gradient(90deg, #003087 0%, #C8A84B 100%)`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">Início</span>
            <span className="text-xs text-gray-400">{percentComplete}% concluído</span>
            <span className="text-xs text-gray-400">Encerramento</span>
          </div>
        </div>
      </div>
    </div>
  )
}
