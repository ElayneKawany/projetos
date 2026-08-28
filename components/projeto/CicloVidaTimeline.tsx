'use client'

import { Check } from 'lucide-react'
import type { StatusProjeto } from '@/types'

const LIFECYCLE_ORDER: StatusProjeto[] = [
  'PROPOSTA', 'TRIAGEM', 'COMITE_IDEIAS', 'VIABILIDADE',
  'COMPLEMENTACAO_TAP', 'APROVACAO', 'ESTRUTURACAO', 'CRONOGRAMA',
  'EXECUCAO', 'PROJETO_CONCLUIDO', 'PAYBACK_ACOMPANHAMENTO', 'PAYBACK_ENCERRADO', 'PROJETO_ENCERRADO',
]

interface Stage {
  label: string
  icon: string
  doneFromStatus: StatusProjeto
  activeStatus: StatusProjeto
  // Status que marca a entrada nesta etapa (para buscar data/user no histórico)
  triggerStatus: StatusProjeto
}

const STAGES: Stage[] = [
  { label: 'TAP',               icon: '📄', doneFromStatus: 'COMITE_IDEIAS',         activeStatus: 'TRIAGEM',                triggerStatus: 'COMITE_IDEIAS' },
  { label: 'Viabilidade',       icon: '📊', doneFromStatus: 'APROVACAO',             activeStatus: 'VIABILIDADE',            triggerStatus: 'APROVACAO' },
  { label: 'Cronograma',        icon: '📅', doneFromStatus: 'EXECUCAO',              activeStatus: 'CRONOGRAMA',             triggerStatus: 'EXECUCAO' },
  { label: 'Execução',          icon: '🚀', doneFromStatus: 'PROJETO_CONCLUIDO',     activeStatus: 'EXECUCAO',               triggerStatus: 'PROJETO_CONCLUIDO' },
  { label: 'Concluído',         icon: '✅', doneFromStatus: 'PROJETO_CONCLUIDO',     activeStatus: 'PROJETO_CONCLUIDO',      triggerStatus: 'PROJETO_CONCLUIDO' },
  { label: 'Payback',           icon: '💰', doneFromStatus: 'PAYBACK_ACOMPANHAMENTO',activeStatus: 'PAYBACK_ACOMPANHAMENTO', triggerStatus: 'PAYBACK_ACOMPANHAMENTO' },
  { label: 'Encerrado',         icon: '🏁', doneFromStatus: 'PROJETO_ENCERRADO',     activeStatus: 'PROJETO_ENCERRADO',      triggerStatus: 'PROJETO_ENCERRADO' },
]

interface HistoricoItem {
  status_de: string
  status_para: string
  usuario_nome: string
  created_at: string
}

interface Props {
  statusAtual: string
  historicoStatus?: HistoricoItem[]
  temViabilidadeAprovada?: boolean
  temCronogramaAprovado?: boolean
  /** Início/fim reais da execução, derivados do cronograma vigente (não da data de entrada no status). */
  execucaoRange?: { inicio: string; fim: string } | null
}

function formatDateISO(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return '' }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function CicloVidaTimeline({ statusAtual, historicoStatus = [], temViabilidadeAprovada, temCronogramaAprovado, execucaoRange }: Props) {
  const currentIdx = LIFECYCLE_ORDER.indexOf(statusAtual as StatusProjeto)

  // Para cada etapa, encontra a entrada histórica que marcou sua conclusão
  function getStageInfo(stage: Stage): { date: string; time: string; user: string } | null {
    const triggerIdx = LIFECYCLE_ORDER.indexOf(stage.triggerStatus)
    const entry = historicoStatus.find(h => {
      const paraIdx = LIFECYCLE_ORDER.indexOf(h.status_para as StatusProjeto)
      return paraIdx >= triggerIdx
    })
    if (!entry) return null
    return {
      date: formatDate(entry.created_at),
      time: formatTime(entry.created_at),
      user: entry.usuario_nome,
    }
  }

  return (
    <div className="card mb-4">
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex items-start min-w-max gap-0">
          {STAGES.map((stage, i) => {
            const doneIdx   = LIFECYCLE_ORDER.indexOf(stage.doneFromStatus)
            const artefatoAprovado =
              (stage.activeStatus === 'VIABILIDADE' && !!temViabilidadeAprovada) ||
              (stage.activeStatus === 'CRONOGRAMA'  && !!temCronogramaAprovado)
            const isDone    = currentIdx >= doneIdx || artefatoAprovado
            const isActive  = !isDone && statusAtual === stage.activeStatus
            const info      = isDone ? getStageInfo(stage) : null

            let dotBg     = 'bg-gray-200'
            let dotBorder = 'border-gray-300'
            let textColor = 'text-gray-400'
            let labelWeight = 'font-normal'

            if (isDone) {
              dotBg     = 'bg-green-500'
              dotBorder = 'border-green-500'
              textColor = 'text-green-700'
            } else if (isActive) {
              dotBg     = 'bg-megag-azul'
              dotBorder = 'border-megag-azul'
              textColor = 'text-megag-azul'
              labelWeight = 'font-semibold'
            }

            return (
              <div key={stage.label} className="flex items-start">
                {/* Conector */}
                {i > 0 && (
                  <div
                    className={`h-0.5 w-8 shrink-0 mt-3.5 ${
                      LIFECYCLE_ORDER.indexOf(STAGES[i - 1].doneFromStatus) <= currentIdx
                        ? 'bg-green-400'
                        : 'bg-gray-200'
                    }`}
                  />
                )}

                {/* Nó + label + info */}
                <div className="flex flex-col items-center gap-0.5 min-w-[72px]">
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${dotBg} ${dotBorder}`}
                  >
                    {isDone ? (
                      <Check size={14} className="text-white" strokeWidth={3} />
                    ) : isActive ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span className={`text-xs whitespace-nowrap ${textColor} ${labelWeight}`}>
                    {stage.icon} {stage.label}
                  </span>
                  {info && (
                    <div className="text-center mt-0.5 space-y-0">
                      <p className="text-[10px] text-gray-500 leading-tight whitespace-nowrap">{info.date}</p>
                      <p className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">{info.time}</p>
                      <p className="text-[10px] text-gray-400 leading-tight whitespace-nowrap max-w-[72px] truncate">{info.user}</p>
                    </div>
                  )}
                  {stage.label === 'Execução' && execucaoRange && (
                    <p className="text-[10px] text-megag-azul leading-tight whitespace-nowrap font-medium mt-0.5">
                      {formatDateISO(execucaoRange.inicio)} → {formatDateISO(execucaoRange.fim)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
