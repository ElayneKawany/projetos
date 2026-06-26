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
  GOLIVE: 'GL',
  ROI: 'RO',
  ENCERRAMENTO: 'EN',
}

const PHASE_LABELS: Record<string, string> = {
  PROPOSTA: 'Proposta / Ideia',
  TRIAGEM: 'Triagem / TAP',
  COMITE_IDEIAS: 'Comitê de Ideias',
  VIABILIDADE: 'Viabilidade',
  COMPLEMENTACAO_TAP: 'Complementação TAP',
  APROVACAO: 'Aprovação',
  ESTRUTURACAO: 'Estruturação',
  CRONOGRAMA: 'Cronograma',
  EXECUCAO: 'Execução',
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

export default function ProjectTimeline({ statusAtual, historicoStatus }: Props) {
  const isCancelado = statusAtual === 'CANCELADO'
  const isSuspenso = statusAtual === 'SUSPENSO'
  const isSpecial = isCancelado || isSuspenso

  const currentIndex = STATUS_ORDER.indexOf(statusAtual as any)
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
                const isCompleted = !isSpecial && idx < currentIndex
                const isCurrent = !isSpecial && phase === statusAtual
                const isFuture = isSpecial || idx > currentIndex
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
                          {isCompleted ? '✓' : SHORT_LABELS[phase] ?? idx + 1}
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
                      {entryDate && (
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
                {isSpecial ? statusAtual : (PHASE_LABELS[statusAtual] ?? statusAtual)}
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
