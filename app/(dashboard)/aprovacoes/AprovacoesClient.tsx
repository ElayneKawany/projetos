'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckSquare, Clock, Filter, ExternalLink } from 'lucide-react'
import { WorkflowExpandido } from '@/components/projeto/WorkflowStatusPanel'
import type { WorkflowInfo } from '@/components/projeto/WorkflowStatusPanel'

function tabParaTipo(tipo: string): string {
  if (tipo === 'VIABILIDADE') return 'viabilidade'
  if (tipo === 'CRONOGRAMA') return 'cronograma'
  return 'TAP'
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WorkflowItem {
  id: number
  tipo: string
  referencia_id: number
  etapa_atual: number
  workflow_status: string
  modelo_id: number | null
  workflow_criado_em: string
  modelo_nome: string | null
  projeto_id: number
  projeto_nome: string
  projeto_codigo: string
  versao: string | number
  documentoLabel: string
  etapas: WorkflowInfo['etapas']
}

interface Props {
  workflows: WorkflowItem[]
  sessionUser: { id: number; nome: string; perfil: string }
}

// ─── Filtro de status ─────────────────────────────────────────────────────────

const STATUS_FILTROS = [
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'CONCLUIDO',    label: 'Concluídos'   },
  { value: 'REJEITADO',    label: 'Rejeitados'   },
  { value: 'CANCELADO',    label: 'Cancelados'   },
  { value: 'todos',        label: 'Todos'        },
] as const

type FiltroStatus = typeof STATUS_FILTROS[number]['value']

// ─── Componente ──────────────────────────────────────────────────────────────

export default function AprovacoesClient({ workflows, sessionUser }: Props) {
  const [filtro, setFiltro] = useState<FiltroStatus>('EM_ANDAMENTO')
  const [busca, setBusca] = useState('')

  const emAndamento = workflows.filter(w => w.workflow_status === 'EM_ANDAMENTO')
  const minhasEtapas = emAndamento.filter(w =>
    w.etapas.find(e => e.ordem === w.etapa_atual && e.usuario_id === sessionUser.id)
  )

  const filtradas = workflows.filter(w => {
    const statusOk = filtro === 'todos' || w.workflow_status === filtro
    if (!statusOk) return false
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      w.projeto_nome.toLowerCase().includes(q) ||
      w.projeto_codigo.toLowerCase().includes(q) ||
      w.documentoLabel.toLowerCase().includes(q)
    )
  })

  return (
    <div className="animate-fade-in">
      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Aprovações</h1>
          <p className="page-subtitle">
            {emAndamento.length > 0
              ? <span className="text-amber-600 font-medium">{emAndamento.length} em andamento</span>
              : 'Nenhum workflow em andamento'}
          </p>
        </div>
      </div>

      {/* Banner: aguardando minha ação */}
      {minhasEtapas.length > 0 && (
        <div className="mb-5 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Clock size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {minhasEtapas.length} documento{minhasEtapas.length !== 1 ? 's' : ''} aguardando sua ação.
            Acesse o projeto para aprovar ou solicitar revisão.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter size={14} />
          <span>Filtrar:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtro === f.value
                  ? 'bg-megag-azul text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {f.value !== 'todos' && (
                <span className="ml-1.5 opacity-70">
                  ({workflows.filter(w => w.workflow_status === f.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Buscar projeto…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input ml-auto w-52 text-sm"
        />
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <CheckSquare size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum workflow{filtro !== 'todos' ? ` com status "${filtro.replace('_', ' ').toLowerCase()}"` : ''} encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtradas.map(w => {
            const aguardandoMinha = w.workflow_status === 'EM_ANDAMENTO' &&
              w.etapas.find(e => e.ordem === w.etapa_atual && e.usuario_id === sessionUser.id)
            return (
              <div key={w.id}>
                <WorkflowExpandido
                  projeto={{ id: w.projeto_id, nome: w.projeto_nome, codigo: w.projeto_codigo }}
                  documento={w.documentoLabel}
                  versao={w.versao}
                  modeloNome={w.modelo_nome}
                  workflow={{
                    id: w.id,
                    etapa_atual: w.etapa_atual,
                    status: w.workflow_status,
                    modelo_id: w.modelo_id,
                    etapas: w.etapas,
                  }}
                />
                <div className="flex justify-end mt-2">
                  <Link
                    href={`/projetos/${w.projeto_id}?tab=${tabParaTipo(w.tipo)}`}
                    className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      aguardandoMinha
                        ? 'bg-megag-azul text-white hover:bg-megag-azul/90'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <ExternalLink size={13} />
                    {aguardandoMinha ? 'Abrir e aprovar' : 'Abrir documento'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
