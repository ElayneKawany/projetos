'use client'

import { Check, Clock, X, Eye, ChevronRight } from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface WorkflowEtapaInfo {
  id: number
  ordem: number
  usuario_id: number
  usuario_nome: string
  tipo: string
  status: string
  observacao: string | null
  respondido_em: string | null
}

export interface WorkflowInfo {
  id: number
  etapa_atual: number
  status: string
  modelo_id: number | null
  etapas: WorkflowEtapaInfo[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(dt: string | null) {
  if (!dt) return null
  try {
    return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dt }
}

function EtapaStatus({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  if (status === 'APROVADO') return (
    <span className="flex items-center gap-1 text-xs font-medium text-green-700">
      <Check size={12} className="shrink-0" /> Aprovado
    </span>
  )
  if (status === 'CIENTE') return (
    <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
      <Eye size={12} className="shrink-0" /> Ciente
    </span>
  )
  if (status === 'REJEITADO') return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-600">
      <X size={12} className="shrink-0" /> Rejeitado
    </span>
  )
  if (isCurrent) return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
      <Clock size={12} className="shrink-0 animate-pulse" /> Aguardando
    </span>
  )
  return <span className="text-xs text-gray-400">Pendente</span>
}

function etapaDot(status: string, isCurrent: boolean): string {
  if (status === 'APROVADO' || status === 'CIENTE') return 'bg-green-500'
  if (status === 'REJEITADO') return 'bg-red-500'
  if (isCurrent) return 'bg-amber-400 ring-2 ring-amber-200'
  return 'bg-gray-300'
}

// ─── Componente ──────────────────────────────────────────────────────────────

interface Props {
  workflow: WorkflowInfo
  sessionId: number
  /** Labels para os tipos de etapa (ex: { APROVACAO: 'Aprovação', CIENCIA: 'Ciência' }) */
  tiposLabel?: Record<string, string>
  /** Botões de ação renderizados abaixo do painel (Aprovar / Solicitar Revisão) */
  actions?: React.ReactNode
  compact?: boolean
}

export default function WorkflowStatusPanel({
  workflow, tiposLabel = {}, actions, compact = false,
}: Props) {
  const TIPOS_DEFAULT: Record<string, string> = {
    APROVACAO: 'Aprovação',
    CIENCIA:   'Ciência',
    ...tiposLabel,
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-600 animate-pulse" />
          <span className="text-sm font-semibold text-amber-800">Em aprovação</span>
        </div>
        <span className="text-xs text-amber-600">
          Etapa {workflow.etapa_atual} de {workflow.etapas.length}
        </span>
      </div>

      {/* Timeline de etapas */}
      <div className="px-4 py-3">
        <div className="space-y-0">
          {workflow.etapas.map((e, idx) => {
            const isCurrent = e.ordem === workflow.etapa_atual
            const isLast = idx === workflow.etapas.length - 1
            return (
              <div key={e.id} className="flex gap-3">
                {/* Linha vertical + dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${etapaDot(e.status, isCurrent)}`} />
                  {!isLast && <div className="w-px flex-1 bg-gray-200 my-0.5" />}
                </div>

                {/* Conteúdo */}
                <div className={`pb-3 flex-1 min-w-0 ${isLast ? '' : ''}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isCurrent ? 'text-amber-800' : 'text-gray-700'}`}>
                        {e.usuario_nome}
                      </p>
                      <p className="text-xs text-gray-400">
                        {TIPOS_DEFAULT[e.tipo] ?? e.tipo}
                        {e.respondido_em && (
                          <> · <time>{fmt(e.respondido_em)}</time></>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <EtapaStatus status={e.status} isCurrent={isCurrent} />
                    </div>
                  </div>

                  {e.observacao && (
                    <p className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                      {e.observacao}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ações do aprovador atual */}
      {actions && (
        <div className="flex gap-2 px-4 pb-3">
          {actions}
        </div>
      )}
    </div>
  )
}

// ─── Versão expandida (para Tela de Aprovações) ───────────────────────────────

interface ExpandedProps {
  projeto: { id: number; nome: string; codigo: string }
  documento: string
  versao: string | number
  modeloNome?: string | null
  workflow: WorkflowInfo
  tiposLabel?: Record<string, string>
}

export function WorkflowExpandido({
  projeto, documento, versao, modeloNome, workflow, tiposLabel = {},
}: ExpandedProps) {
  const TIPOS_DEFAULT: Record<string, string> = {
    APROVACAO: 'Aprovação',
    CIENCIA: 'Ciência',
    ...tiposLabel,
  }

  const statusCores: Record<string, string> = {
    EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
    CONCLUIDO:    'bg-green-100 text-green-700',
    REJEITADO:    'bg-red-100 text-red-700',
    CANCELADO:    'bg-gray-100 text-gray-500',
  }
  const statusLabels: Record<string, string> = {
    EM_ANDAMENTO: 'Em andamento',
    CONCLUIDO:    'Concluído',
    REJEITADO:    'Rejeitado',
    CANCELADO:    'Cancelado',
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>{projeto.codigo}</span>
            <ChevronRight size={12} />
            <span>{documento}</span>
            <ChevronRight size={12} />
            <span>Versão {versao}</span>
          </div>
          <p className="font-semibold text-gray-900">{projeto.nome}</p>
          {modeloNome && (
            <p className="text-xs text-gray-400 mt-0.5">Modelo: {modeloNome}</p>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusCores[workflow.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {statusLabels[workflow.status] ?? workflow.status}
        </span>
      </div>

      {/* Timeline completa */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">
          Participantes · {workflow.etapas.length} etapa(s)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">#</th>
                <th className="text-left pb-2 font-medium">Participante</th>
                <th className="text-left pb-2 font-medium">Tipo</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">Data / Hora</th>
                <th className="text-left pb-2 font-medium">Observação</th>
              </tr>
            </thead>
            <tbody>
              {workflow.etapas.map(e => {
                const isCurrent = e.ordem === workflow.etapa_atual && workflow.status === 'EM_ANDAMENTO'
                return (
                  <tr key={e.id} className={`border-b border-gray-50 ${isCurrent ? 'bg-amber-50' : ''}`}>
                    <td className="py-2 pr-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${etapaDot(e.status, isCurrent)}`}>
                        {e.ordem}
                      </div>
                    </td>
                    <td className="py-2 pr-4 font-medium text-gray-800">{e.usuario_nome}</td>
                    <td className="py-2 pr-4">
                      <span className="badge bg-gray-100 text-gray-600 text-xs">
                        {TIPOS_DEFAULT[e.tipo] ?? e.tipo}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <EtapaStatus status={e.status} isCurrent={isCurrent} />
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {fmt(e.respondido_em) ?? '—'}
                    </td>
                    <td className="py-2 text-xs text-gray-500">{e.observacao ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
