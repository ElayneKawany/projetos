'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Monitor, User, Calendar, Clock, AlertTriangle, CheckCircle2, Circle,
  Loader2, ChevronDown, ChevronRight, ExternalLink, Info, Edit3,
  LayoutGrid, List, Table2, ArrowUpDown,
} from 'lucide-react'
import type { Dev2026Atividade } from '@/lib/ti/dev2026-data'
import type { SessionUser } from '@/lib/auth'
import { calcularCapacidadeMes, mesesTocados, type PeriodoOcupado } from '@/lib/ti/capacidade'
import { calcStatusAuto } from '@/lib/cronograma/resumo-fase'

interface TarefaCronograma {
  id: number
  nome: string
  nivel: string
  percentual: number
  data_inicio: string | null
  data_inicio_baseline?: string | null
  data_fim: string | null
  data_fim_baseline?: string | null
  data_conclusao: string | null
  analista: string
  responsavel_nome_ext: string | null
  observacoes: string | null
  prazo_status: string | null
  bloqueio: number | null
  projeto_id: number
  projeto_codigo: string
  projeto_nome: string
  projeto_status: string
  diretoria: string | null
}

interface UsuarioInfo {
  nome: string
  cargo: string
  perfil: string
  perfil_nome: string
  diretoria: string
}

interface TiPrioridadeDB {
  id: number
  atividade_id: number
  fonte: string
  prioridade: number | null
  confirmada: number
  confirmada_em: string | null
  confirmada_por_nome: string | null
  confirmada_comite_id: number | null
  solicitacao_alteracao: number
  solicitacao_nova_prioridade: number | null
  solicitacao_motivo: string | null
  projeto_id?: number | null
  projeto_codigo?: string | null
  projeto_nome?: string | null
}

interface ProjetoDisponivel {
  id: number
  codigo: string
  nome: string
  status: string
}

interface Props {
  tarefasCronograma: TarefaCronograma[]
  dev2026: Dev2026Atividade[]
  tiPrioridadesDB: TiPrioridadeDB[]
  usuariosInfo: UsuarioInfo[]
  cargosDistinct: string[]
  perfisDistinct: { codigo: string; nome: string }[]
  diretoriasDistinct: string[]
  projetosDisponiveis: ProjetoDisponivel[]
  session: SessionUser
}

type ViewMode = 'agenda' | 'kanban' | 'prazos'

const ANALISTAS_TI = ['Michel Cardero', 'Divonzi Barbosa', 'Plinio Souza']

const COR_ANALISTA: Record<string, string> = {
  'Michel Cardero': '#003087',
  'Divonzi Barbosa': '#059669',
  'Plinio Souza': '#7C3AED',
}

// ── Colunas Kanban ────────────────────────────────────────────────────────────
type KanbanColunaId =
  | 'definir_prioridade'
  | 'aguardando'
  | 'em_desenvolvimento'
  | 'em_validacao'
  | 'treinamento'
  | 'acompanhamento'
  | 'concluido'
  | 'sem_projeto'

const KANBAN_COLUNAS: { id: KanbanColunaId; label: string; cor: string; icon: string }[] = [
  { id: 'definir_prioridade',  label: 'Definir Prioridade',          cor: '#6B7280', icon: '🎯' },
  { id: 'aguardando',          label: 'Aguardando Desenvolvimento',   cor: '#F59E0B', icon: '⏳' },
  { id: 'em_desenvolvimento',  label: 'Em Desenvolvimento',           cor: '#3B82F6', icon: '💻' },
  { id: 'em_validacao',        label: 'Em Validação e Testes',        cor: '#8B5CF6', icon: '🔍' },
  { id: 'treinamento',         label: 'Treinamento',                  cor: '#0EA5E9', icon: '📚' },
  { id: 'acompanhamento',      label: 'Acompanhamento',               cor: '#F97316', icon: '👁️' },
  { id: 'concluido',           label: 'Concluído',                    cor: '#059669', icon: '✅' },
  { id: 'sem_projeto',         label: 'Sem Projeto Vinculado',        cor: '#DC2626', icon: '🔗' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizarAnalista(nome: string): string {
  const n = nome.toLowerCase()
  if (n.includes('michel')) return 'Michel Cardero'
  if (n.includes('divonzi')) return 'Divonzi Barbosa'
  if (n.includes('plinio') || n.includes('plínio')) return 'Plinio Souza'
  return nome
}

function diasEntre(ini: string, fim: string): number {
  const a = new Date(ini + 'T00:00:00'), b = new Date(fim + 'T00:00:00')
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / 86400000))
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function statusIcon(progresso: Dev2026Atividade['progresso'], pct?: number) {
  if (progresso === 'Concluído' || pct === 100)
    return <CheckCircle2 size={14} className="text-green-600 shrink-0" />
  if (progresso === 'Em andamento')
    return <Loader2 size={14} className="text-blue-600 shrink-0 animate-spin" />
  return <Circle size={14} className="text-gray-400 shrink-0" />
}

function badgeProgresso(p: Dev2026Atividade['progresso']) {
  const base = 'text-xs font-semibold px-2 py-0.5 rounded-full'
  if (p === 'Concluído')    return <span className={`${base} bg-green-100 text-green-700`}>Concluído</span>
  if (p === 'Em andamento') return <span className={`${base} bg-blue-100 text-blue-700`}>Em andamento</span>
  return <span className={`${base} bg-gray-100 text-gray-500`}>Não iniciado</span>
}

function badgeTarefaPct(pct: number) {
  const cor = pct === 100 ? 'bg-green-100 text-green-700' : pct > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>{pct}%</span>
}

// ── Detecção de conflito ──────────────────────────────────────────────────────
interface Periodo { analista: string; inicio: string; fim: string; nome: string }

function detectarConflitos(periodos: Periodo[]): Set<string> {
  const conflitos = new Set<string>()
  for (let i = 0; i < periodos.length; i++) {
    for (let j = i + 1; j < periodos.length; j++) {
      const a = periodos[i], b = periodos[j]
      if (a.analista !== b.analista) continue
      if (!a.inicio || !b.inicio || !a.fim || !b.fim) continue
      if (a.inicio <= b.fim && b.inicio <= a.fim) {
        conflitos.add(`${a.analista}::${a.nome}`)
        conflitos.add(`${a.analista}::${b.nome}`)
      }
    }
  }
  return conflitos
}

// ── Atribuição de coluna Kanban ───────────────────────────────────────────────
interface ItemKanban {
  id: string
  nome: string
  analista: string
  projetoId?: number   // id numérico do projeto (usado no link /projetos/:id)
  projetoCodigo?: string
  projetoNome?: string
  fonte: 'cronograma' | 'dev2026'
  inicio: string | null
  fim: string | null
  /** Data original (antes da reprogramação) — só para tarefas de Cronograma que já foram reprogramadas. */
  fimBaseline?: string | null
  duracao: number | null
  progresso: Dev2026Atividade['progresso'] | null
  pct: number | null
  prioridade: number | ''
  statusTexto: string
  dataConclusao: string | null
  observacoes: string | null
  // Campos de controle de prioridade (DEV2026)
  confirmada?: boolean
  prioridadeDB_id?: number
  solicitacaoAlteracao?: boolean
  requisito?: string
  devId?: number  // id numérico da atividade DEV2026 (para vincular projeto)
}

function obterColunaKanban(item: ItemKanban): KanbanColunaId {
  const st = (item.statusTexto || '').toLowerCase()
  const obs = (item.observacoes || '').toLowerCase()
  const texto = st + ' ' + obs

  if (item.fonte === 'dev2026') {
    // DEV2026 sem projeto vinculado → coluna especial
    if (!item.projetoCodigo) return 'sem_projeto'
    if (item.progresso === 'Concluído') return 'concluido'
    if (item.progresso === 'Não iniciado') {
      return item.prioridade === '' ? 'definir_prioridade' : 'aguardando'
    }
    // Em andamento
    if (texto.includes('validação') || texto.includes('validacao') || texto.includes('testes') || texto.includes('teste'))
      return 'em_validacao'
    if (texto.includes('treinamento')) return 'treinamento'
    if (texto.includes('acompanhamento')) return 'acompanhamento'
    return 'em_desenvolvimento'
  } else {
    // cronograma
    const pct = item.pct ?? 0
    if (pct === 100 || item.dataConclusao) return 'concluido'
    if (pct > 0) {
      if (texto.includes('validação') || texto.includes('validacao') || texto.includes('teste')) return 'em_validacao'
      if (texto.includes('treinamento')) return 'treinamento'
      if (texto.includes('acompanhamento')) return 'acompanhamento'
      return 'em_desenvolvimento'
    }
    return 'aguardando'
  }
}

// ── Card de atividade (visão Agenda) ──────────────────────────────────────────
function CardAtividade({
  titulo, analista, inicio, fim, fimBaseline, duracao, progresso, pct,
  projetoId, projetoCodigo, projetoNome, fonte, statusTexto, conflito, semDatas,
  observacoes, prioridade, requisito, confirmada, atrasada, podeEditar, onOpen, onVincular,
}: {
  titulo: string; analista: string; inicio: string | null; fim: string | null
  fimBaseline?: string | null
  duracao: number | null; progresso?: Dev2026Atividade['progresso']
  pct?: number; projetoId?: number; projetoCodigo?: string; projetoNome?: string; fonte: 'cronograma' | 'dev2026'
  statusTexto?: string; conflito: boolean; semDatas: boolean
  observacoes?: string | null; prioridade?: number | ''; requisito?: string; confirmada?: boolean
  /** Tarefa não concluída com data fim (ou linha de base) já vencida — mesma regra de atraso já usada no sistema. */
  atrasada?: boolean
  /** Permissão do usuário logado pra editar (mesma regra de `podeGerenciar` já usada na página do projeto). */
  podeEditar?: boolean
  onOpen?: () => void
  onVincular?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cor = COR_ANALISTA[analista] ?? '#6B7280'
  const handleClick = onOpen ? onOpen : () => setExpanded(e => !e)
  const temNovaData = !!fimBaseline && fimBaseline.slice(0, 10) !== (fim ?? '').slice(0, 10)
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md cursor-pointer ${
        atrasada ? 'border-red-400 ring-1 ring-red-300' : conflito ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-100'
      }`}
      onClick={handleClick}
    >
      <div className="h-1" style={{ background: atrasada ? '#DC2626' : cor }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            {progresso !== undefined ? statusIcon(progresso, pct) : badgeTarefaPct(pct ?? 0)}
            <span className="font-semibold text-sm text-gray-900 leading-snug">{titulo}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {atrasada && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">🔴 ATRASADA</span>
            )}
            {confirmada && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">✓ Confirmada</span>}
            {conflito && <span title="Conflito de agenda detectado"><AlertTriangle size={13} className="text-amber-500" /></span>}
            {prioridade !== '' && prioridade !== undefined && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-megag-azul text-white">P{prioridade}</span>
            )}
            {fonte === 'dev2026' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium border border-purple-100">DEV2026</span>
            )}
            {fonte === 'cronograma' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100">Cronograma</span>
            )}
            {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </div>
        </div>

        {projetoCodigo ? (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <ExternalLink size={11} className="text-gray-400 shrink-0" />
            <a href={projetoId ? `/projetos/${projetoId}` : '#'} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-megag-azul hover:underline truncate font-medium">
              {projetoCodigo} — {projetoNome}
            </a>
            {fonte === 'cronograma' && podeEditar && projetoId && (
              <a
                href={`/projetos/${projetoId}?tab=cronograma`}
                onClick={e => e.stopPropagation()}
                className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                title="Editar no Cronograma do projeto"
              >
                <Edit3 size={11} /> Editar
              </a>
            )}
          </div>
        ) : fonte === 'dev2026' ? (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <Info size={11} className="text-amber-500 shrink-0" />
            <span className="text-xs text-amber-600 font-medium">Projeto não encontrado</span>
            {onVincular && (
              <button
                onClick={e => { e.stopPropagation(); onVincular() }}
                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 font-semibold ml-1"
              >
                Vincular Projeto
              </button>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 mb-3">
          <User size={12} className="shrink-0" style={{ color: cor }} />
          <span className="text-xs font-semibold" style={{ color: cor }}>{analista}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg px-2 py-1.5">
            <p className="text-xs text-gray-400 mb-0.5">Início</p>
            <p className="text-xs font-semibold text-gray-700">{fmtDate(inicio)}</p>
          </div>
          <div className={`rounded-lg px-2 py-1.5 ${temNovaData ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-400 mb-0.5">{temNovaData ? 'Nova Data' : 'Fim'}</p>
            <p className={`text-xs font-semibold ${temNovaData ? 'text-amber-700' : 'text-gray-700'}`}>{fmtDate(fim)}</p>
            {temNovaData && <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Original: {fmtDate(fimBaseline)}</p>}
          </div>
          <div className="bg-gray-50 rounded-lg px-2 py-1.5">
            <p className="text-xs text-gray-400 mb-0.5">Duração</p>
            <p className="text-xs font-semibold text-gray-700">
              {semDatas ? 'N/D' : duracao !== null ? `${duracao}d` : '—'}
            </p>
          </div>
        </div>

        {progresso !== undefined && (
          <div className="mt-2 flex items-center justify-between">
            {badgeProgresso(progresso)}
            {statusTexto && <span className="text-xs text-gray-500 truncate ml-2 max-w-[160px]" title={statusTexto}>{statusTexto}</span>}
          </div>
        )}

        {semDatas && fonte === 'dev2026' && (
          <p className="mt-2 text-xs text-gray-400 italic">Período ainda não definido</p>
        )}

        {/* Detalhes expandidos */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
            {statusTexto && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
                <p className="text-xs text-gray-700">{statusTexto}</p>
              </div>
            )}
            {observacoes && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Observações</p>
                <p className="text-xs text-gray-700">{observacoes}</p>
              </div>
            )}
            {prioridade !== undefined && prioridade !== '' && (
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Prioridade</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">P{prioridade}</span>
                {confirmada && <span className="text-[10px] text-green-600 font-semibold">✓ Confirmada no Comitê</span>}
              </div>
            )}
            {requisito && (
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Requisito de Projeto</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${requisito === 'SIM' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{requisito}</span>
              </div>
            )}
            {projetoCodigo && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Projeto</p>
                <a href={projetoId ? `/projetos/${projetoId}` : '#'} target="_blank" rel="noreferrer"
                  className="text-xs text-megag-azul hover:underline">
                  {projetoCodigo} — {projetoNome}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card Kanban (compacto, expansível) ───────────────────────────────────────
function KanbanCard({ item, onOpen }: { item: ItemKanban; onOpen?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const cor = COR_ANALISTA[item.analista] ?? '#6B7280'
  const prioLabel = item.prioridade !== '' ? `P${item.prioridade}` : null
  const handleClick = onOpen ? onOpen : () => setExpanded(e => !e)
  return (
    <div
      className="bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
      onClick={handleClick}
    >
      <div className="h-0.5" style={{ background: cor }} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">{item.nome}</span>
          <div className="flex items-center gap-1 shrink-0">
            {item.confirmada && <span className="text-[9px] font-bold px-1 py-0.5 rounded-full bg-green-100 text-green-700">✓</span>}
            {prioLabel && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{prioLabel}</span>
            )}
            {item.fonte === 'dev2026'
              ? <span className="text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">DEV</span>
              : <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">CRO</span>
            }
          </div>
        </div>

        {item.projetoCodigo ? (
          <div className="flex items-center gap-1 mb-1.5">
            <ExternalLink size={10} className="text-gray-400 shrink-0" />
            <a href={item.projetoId ? `/projetos/${item.projetoId}` : '#'} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-megag-azul hover:underline truncate">{item.projetoCodigo}</a>
          </div>
        ) : null}

        <div className="flex items-center gap-1 mb-2">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
            style={{ background: cor }}>{item.analista.charAt(0)}</div>
          <span className="text-[10px] font-semibold truncate" style={{ color: cor }}>{item.analista}</span>
        </div>

        <div className="flex gap-1 text-[10px] text-gray-500">
          <span className="bg-gray-50 rounded px-1.5 py-0.5">{fmtDate(item.inicio)}</span>
          <span>→</span>
          <span className="bg-gray-50 rounded px-1.5 py-0.5">{fmtDate(item.fim)}</span>
          {item.duracao !== null && <span className="bg-gray-50 rounded px-1.5 py-0.5 ml-auto">{item.duracao}d</span>}
        </div>

        {/* Detalhes expandidos */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5" onClick={e => e.stopPropagation()}>
            {item.projetoNome && (
              <p className="text-[10px] text-gray-600 font-medium leading-snug">{item.projetoNome}</p>
            )}
            {item.progresso && badgeProgresso(item.progresso)}
            {item.pct !== null && badgeTarefaPct(item.pct)}
            {item.statusTexto && (
              <p className="text-[10px] text-gray-500 leading-snug">{item.statusTexto}</p>
            )}
            {item.observacoes && (
              <p className="text-[10px] text-gray-500 leading-snug italic">{item.observacoes}</p>
            )}
            {item.dataConclusao && (
              <p className="text-[10px] text-green-600 font-semibold">Concluído em {fmtDate(item.dataConclusao)}</p>
            )}
            {item.confirmada && (
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Prioridade Confirmada no Comitê</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal: Vincular Projeto ───────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  PROPOSTA: 'Proposta / Ideia', TRIAGEM: 'Triagem', VIABILIDADE: 'Estudo de Viabilidade',
  ESTRUTURACAO: 'Estruturação', EXECUCAO: 'Execução', GOLIVE: 'Go-Live',
  PAYBACK: 'Payback', CONCLUIDO: 'Concluído', PAUSADO: 'Pausado', CANCELADO: 'Cancelado',
}

function VincularProjetoModal({
  atividadeId, atividadeNome, projetos, onClose, onVincular,
}: {
  atividadeId: number
  atividadeNome: string
  projetos: ProjetoDisponivel[]
  onClose: () => void
  onVincular: (projetoCodigo: string, projetoNome: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const statusOptions = ['TODOS', ...Array.from(new Set(projetos.map(p => p.status))).sort()]

  const projetosFiltrados = projetos.filter(p => {
    if (filtroStatus !== 'TODOS' && p.status !== filtroStatus) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      if (!p.nome.toLowerCase().includes(q) && !p.codigo.toLowerCase().includes(q)) return false
    }
    return true
  })

  async function handleVincular(p: ProjetoDisponivel) {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/ti/prioridades/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atividade_id: atividadeId, projeto_id: p.id, projeto_codigo: p.codigo, projeto_nome: p.nome }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao vincular.'); setLoading(false); return }
      onVincular(data.projeto_codigo, data.projeto_nome)
      onClose()
    } catch {
      setErro('Erro de rede.'); setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 bg-amber-500" />
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-base text-gray-900">Vincular Projeto</h2>
              <p className="text-xs text-gray-500 mt-0.5">Atividade: <span className="font-medium text-gray-700">{atividadeNome}</span></p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg font-bold">✕</button>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              autoFocus
            />
            <select className="input w-40" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              {statusOptions.map(s => (
                <option key={s} value={s}>{s === 'TODOS' ? 'Todos os status' : (STATUS_LABELS[s] ?? s)}</option>
              ))}
            </select>
          </div>

          {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}

          {/* Lista de projetos */}
          <div className="overflow-y-auto max-h-72 border border-gray-100 rounded-xl divide-y divide-gray-100">
            {projetosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Nenhum projeto encontrado.</div>
            ) : projetosFiltrados.map(p => (
              <button
                key={p.id}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center justify-between gap-3"
                onClick={() => handleVincular(p)}
                disabled={loading}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.nome}</p>
                  <p className="text-xs text-gray-500">{p.codigo}</p>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">{projetosFiltrados.length} projeto{projetosFiltrados.length !== 1 ? 's' : ''} encontrado{projetosFiltrados.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  )
}

// ── Modal de detalhe de card TI ───────────────────────────────────────────────
function TICardModal({ item, onClose, onVincular, projetos }: {
  item: ItemKanban
  onClose: () => void
  onVincular?: () => void
  projetos?: ProjetoDisponivel[]
}) {
  const cor = COR_ANALISTA[item.analista] ?? '#6B7280'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5" style={{ background: cor }} />
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-2 min-w-0">
              {item.progresso !== undefined && item.progresso !== null
                ? statusIcon(item.progresso, item.pct ?? undefined)
                : badgeTarefaPct(item.pct ?? 0)}
              <div className="min-w-0">
                <h2 className="font-bold text-base text-gray-900 leading-snug">{item.nome}</h2>
                {item.projetoCodigo ? (
                  <a href={item.projetoId ? `/projetos/${item.projetoId}` : '#'} target="_blank" rel="noreferrer"
                    className="text-xs text-megag-azul hover:underline mt-0.5 block">
                    {item.projetoCodigo} — {item.projetoNome}
                  </a>
                ) : item.fonte === 'dev2026' ? (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-amber-600 font-medium">Projeto não encontrado</span>
                    {onVincular && (
                      <button
                        onClick={onVincular}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 font-semibold"
                      >
                        Vincular Projeto
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition shrink-0 text-lg font-bold">✕</button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {item.fonte === 'dev2026'
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium border border-purple-200">DEV2026</span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium border border-blue-200">Cronograma</span>}
            {item.confirmada && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-semibold">✓ Prioridade Confirmada</span>}
            {item.prioridade !== '' && item.prioridade !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-bold">
                P{item.prioridade}
              </span>
            )}
            {item.prioridade === '' && item.fonte === 'dev2026' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-semibold">Aguardando Prioridade</span>
            )}
          </div>

          {/* Analista */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: cor }}>{item.analista.charAt(0)}</div>
            <span className="text-sm font-semibold" style={{ color: cor }}>{item.analista}</span>
          </div>

          {/* Datas e Duração */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Início</p>
              <p className="text-sm font-semibold text-gray-700">{fmtDate(item.inicio)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Fim</p>
              <p className="text-sm font-semibold text-gray-700">{fmtDate(item.fim)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Duração</p>
              <p className="text-sm font-semibold text-gray-700">
                {item.duracao !== null ? `${item.duracao}d` : '—'}
              </p>
            </div>
          </div>

          {/* Progresso / Status */}
          {item.progresso && (
            <div className="flex items-center gap-2 mb-3">
              {badgeProgresso(item.progresso)}
              {item.statusTexto && <span className="text-sm text-gray-600">{item.statusTexto}</span>}
            </div>
          )}
          {item.pct !== null && item.progresso === undefined && badgeTarefaPct(item.pct)}

          {/* Observações */}
          {item.observacoes && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Observações</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{item.observacoes}</p>
            </div>
          )}

          {/* Requisito */}
          {item.requisito && (
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Requisito de Projeto</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.requisito === 'SIM' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{item.requisito}</span>
            </div>
          )}

          {/* Conclusão */}
          {item.dataConclusao && (
            <p className="text-sm text-green-600 font-semibold mt-1">Concluído em {fmtDate(item.dataConclusao)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Visão Kanban ──────────────────────────────────────────────────────────────
function KanbanView({ itens, onOpen }: { itens: ItemKanban[]; onOpen: (item: ItemKanban) => void }) {
  const colunas = useMemo(() => {
    const map: Record<KanbanColunaId, ItemKanban[]> = {
      definir_prioridade: [], aguardando: [], em_desenvolvimento: [],
      em_validacao: [], treinamento: [], acompanhamento: [], concluido: [], sem_projeto: [],
    }
    itens.forEach(item => {
      const col = obterColunaKanban(item)
      map[col].push(item)
    })
    // Ordenar "Aguardando" por prioridade (0 primeiro)
    map.aguardando.sort((a, b) => {
      const pa = a.prioridade === '' ? 999 : Number(a.prioridade)
      const pb = b.prioridade === '' ? 999 : Number(b.prioridade)
      return pa - pb
    })
    return map
  }, [itens])

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {KANBAN_COLUNAS.map(col => {
          const items = colunas[col.id]
          return (
            <div key={col.id} className="flex flex-col w-64 shrink-0">
              {/* Cabeçalho da coluna */}
              <div className="rounded-t-xl px-3 py-2.5 flex items-center justify-between"
                style={{ background: col.cor + '18', borderBottom: `2px solid ${col.cor}` }}>
                <div className="flex items-center gap-1.5">
                  <span>{col.icon}</span>
                  <span className="text-xs font-bold" style={{ color: col.cor }}>{col.label}</span>
                </div>
                <span className="text-xs font-black px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: col.cor }}>{items.length}</span>
              </div>

              {/* Cards da coluna */}
              <div className="bg-gray-50 rounded-b-xl flex-1 p-2 space-y-2 min-h-[200px]">
                {items.length === 0 ? (
                  <div className="text-center text-xs text-gray-400 italic py-8">Vazio</div>
                ) : (
                  items.map(item => <KanbanCard key={item.id} item={item} onOpen={() => onOpen(item)} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Visão Projetos e Prazos ───────────────────────────────────────────────────
type PrazosSort = 'nome' | 'analista' | 'inicio' | 'fim' | 'duracao' | 'status'

function PrazosView({ itens }: { itens: ItemKanban[] }) {
  const [sortBy, setSortBy] = useState<PrazosSort>('inicio')
  const [sortAsc, setSortAsc] = useState(true)

  const toggleSort = (col: PrazosSort) => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(true) }
  }

  const sorted = useMemo(() => {
    const getValue = (item: ItemKanban) => {
      switch (sortBy) {
        case 'nome': return item.nome.toLowerCase()
        case 'analista': return item.analista.toLowerCase()
        case 'inicio': return item.inicio ?? 'zzzz'
        case 'fim': return item.fim ?? 'zzzz'
        case 'duracao': return item.duracao ?? -1
        case 'status': return item.progresso ?? ''
      }
    }
    return [...itens].sort((a, b) => {
      const va = getValue(a), vb = getValue(b)
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') cmp = va.localeCompare(vb)
      else if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      return sortAsc ? cmp : -cmp
    })
  }, [itens, sortBy, sortAsc])

  function ThSort({ col, label }: { col: PrazosSort; label: string }) {
    const active = sortBy === col
    return (
      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
        onClick={() => toggleSort(col)}>
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown size={11} className={active ? 'text-megag-azul' : 'text-gray-300'} />
          {active && <span className="text-[10px] text-megag-azul">{sortAsc ? '↑' : '↓'}</span>}
        </span>
      </th>
    )
  }

  const statusStr = (item: ItemKanban) => {
    if (item.fonte === 'dev2026') return item.progresso ?? '—'
    const pct = item.pct ?? 0
    if (pct === 100) return 'Concluído'
    if (pct > 0) return `Em andamento (${pct}%)`
    return 'Não iniciado'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Projetos e Prazos — {sorted.length} item{sorted.length !== 1 ? 's' : ''}</p>
        <p className="text-xs text-gray-400">Ordenar clicando nos cabeçalhos</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <ThSort col="nome" label="Atividade / Projeto" />
              <ThSort col="analista" label="Analista" />
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 whitespace-nowrap">Fonte</th>
              <ThSort col="inicio" label="Início" />
              <ThSort col="fim" label="Fim" />
              <ThSort col="duracao" label="Duração" />
              <ThSort col="status" label="Status" />
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 whitespace-nowrap">Projeto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(item => {
              const cor = COR_ANALISTA[item.analista] ?? '#6B7280'
              const st = statusStr(item)
              const stCor = st === 'Concluído' ? 'bg-green-100 text-green-700' : st === 'Não iniciado' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 max-w-[240px]">
                    <span className="text-sm font-medium text-gray-900 line-clamp-2">{item.nome}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ background: cor }}>{item.analista.charAt(0)}</div>
                      <span className="text-xs font-semibold" style={{ color: cor }}>{item.analista}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {item.fonte === 'dev2026'
                      ? <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">DEV2026</span>
                      : <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">Cronograma</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDate(item.inicio)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDate(item.fim)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                    {item.duracao !== null ? `${item.duracao}d` : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stCor}`}>{st}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    {item.projetoCodigo ? (
                      <a href={item.projetoId ? `/projetos/${item.projetoId}` : '#'} target="_blank" rel="noreferrer"
                        className="text-xs text-megag-azul hover:underline flex items-center gap-1">
                        <ExternalLink size={10} className="shrink-0" />
                        <span className="truncate">{item.projetoCodigo}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Sem projeto</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">Nenhum item encontrado com os filtros selecionados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TIAgendaClient({
  tarefasCronograma, dev2026, tiPrioridadesDB,
  usuariosInfo, cargosDistinct, perfisDistinct, diretoriasDistinct,
  projetosDisponiveis, session,
}: Props) {
  // Mesma regra de permissão já usada pra editar artefatos do projeto (ProjetoDetalheClient.tsx) —
  // reaproveitada aqui, não uma regra de acesso nova.
  const podeGerenciar = ['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)
  const [viewMode, setViewMode] = useState<ViewMode>('agenda')
  const [filtroAnalista, setFiltroAnalista] = useState<string>('TODOS')
  const [filtroFonte, setFiltroFonte] = useState<'TODOS' | 'cronograma' | 'dev2026'>('TODOS')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'Em andamento' | 'Não iniciado' | 'Concluído'>('TODOS')
  const [filtroVinculo, setFiltroVinculo] = useState<'TODOS' | 'vinculado' | 'sem_projeto'>('TODOS')
  const [filtroCargo, setFiltroCargo] = useState<string>('TODOS')
  const [filtroPerfil, setFiltroPerfil] = useState<string>('TODOS')
  const [filtroDiretoria, setFiltroDiretoria] = useState<string>('TODOS')
  const [agruparAnalista, setAgruparAnalista] = useState(true)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [modalItem, setModalItem] = useState<ItemKanban | null>(null)
  const [vincularModal, setVincularModal] = useState<{ devId: number; nome: string } | null>(null)
  const router = useRouter()

  const usuarioMap = useMemo(() => {
    const m: Record<string, UsuarioInfo> = {}
    usuariosInfo.forEach(u => { m[u.nome] = u })
    return m
  }, [usuariosInfo])

  const tarefasNormalizadas = useMemo(() => {
    return tarefasCronograma.map(t => {
      const analista = normalizarAnalista(t.analista || t.responsavel_nome_ext || '')
      const duracao = (t.data_inicio && t.data_fim) ? diasEntre(t.data_inicio, t.data_fim) : null
      // Mesma regra de atraso já usada no Cronograma/Dashboard (lib/cronograma/resumo-fase.ts) —
      // não recalculada aqui, só reaproveitada.
      const atrasada = calcStatusAuto(t) === 'ATRASADO'
      return { ...t, analistaNorm: analista, duracao, atrasada }
    })
  }, [tarefasCronograma])

  // Mapa de prioridades do DB: atividade_id → registro
  const priMap = useMemo(() => {
    const m = new Map<number, TiPrioridadeDB>()
    tiPrioridadesDB.forEach(p => m.set(p.atividade_id, p))
    return m
  }, [tiPrioridadesDB])

  const dev2026Normalizadas = useMemo(() => {
    return dev2026.map(a => {
      const resp = a.responsavel.toLowerCase()
      const analista = resp.includes('michel') ? 'Michel Cardero' : a.responsavel || 'Não atribuído'
      const ehAnalistaTI = ANALISTAS_TI.includes(analista)
      const duracao = (a.inicio_dev && a.fim_dev) ? diasEntre(a.inicio_dev, a.fim_dev) : null
      const semDatas = !a.inicio_dev && !a.fim_dev
      const concluida = a.progresso === 'Concluído'
      // Mesma regra de atraso (fim vencido + não concluída) já usada no restante do sistema.
      const atrasada = !concluida && !!a.fim_dev && new Date(a.fim_dev + 'T00:00:00') < new Date()
      // Merge prioridade do DB (override a estática)
      const dbPrio = priMap.get(a.id)
      const prioridade: number | '' = dbPrio && dbPrio.prioridade !== null ? dbPrio.prioridade : a.prioridade
      const projetoCodigoFinal = dbPrio?.projeto_codigo ?? a.projeto_codigo
      const projetoNomeFinal = dbPrio?.projeto_nome ?? a.projeto_nome
      const projetoIdFinal: number | null = dbPrio?.projeto_id ?? null
      return {
        ...a,
        prioridade,
        projeto_codigo: projetoCodigoFinal,
        projeto_nome: projetoNomeFinal,
        projeto_id_num: projetoIdFinal,
        analistaNorm: analista, ehAnalistaTI, duracao, semDatas, concluida, atrasada,
        prioridade_confirmada: dbPrio?.confirmada === 1,
        prioridade_db_id: dbPrio?.id,
        solicitacao_alteracao: dbPrio?.solicitacao_alteracao === 1,
      }
    })
  }, [dev2026, priMap])

  const conflitos = useMemo(() => {
    const periodos: Periodo[] = []
    tarefasNormalizadas.forEach(t => {
      if (t.data_inicio && t.data_fim && t.percentual < 100 && ANALISTAS_TI.includes(t.analistaNorm))
        periodos.push({ analista: t.analistaNorm, inicio: t.data_inicio, fim: t.data_fim, nome: t.nome })
    })
    dev2026Normalizadas.forEach(a => {
      if (a.inicio_dev && a.fim_dev && !a.concluida && ANALISTAS_TI.includes(a.analistaNorm))
        periodos.push({ analista: a.analistaNorm, inicio: a.inicio_dev, fim: a.fim_dev, nome: a.nome })
    })
    return detectarConflitos(periodos)
  }, [tarefasNormalizadas, dev2026Normalizadas])

  const passaFiltroUsuario = useMemo(() => {
    return (nomeAnalista: string): boolean => {
      const temFiltroAtivo = filtroCargo !== 'TODOS' || filtroPerfil !== 'TODOS' || filtroDiretoria !== 'TODOS'
      if (!temFiltroAtivo) return true
      const u = usuarioMap[nomeAnalista]
      if (!u) return false
      if (filtroCargo !== 'TODOS' && u.cargo !== filtroCargo) return false
      if (filtroPerfil !== 'TODOS' && u.perfil !== filtroPerfil) return false
      if (filtroDiretoria !== 'TODOS' && u.diretoria !== filtroDiretoria) return false
      return true
    }
  }, [filtroCargo, filtroPerfil, filtroDiretoria, usuarioMap])

  const tarefasFiltradas = useMemo(() => {
    return tarefasNormalizadas.filter(t => {
      if (!passaFiltroUsuario(t.analistaNorm)) return false
      if (filtroAnalista !== 'TODOS' && t.analistaNorm !== filtroAnalista) return false
      if (filtroFonte === 'dev2026') return false
      if (filtroStatus !== 'TODOS') {
        const prog = t.percentual === 100 ? 'Concluído' : t.percentual > 0 ? 'Em andamento' : 'Não iniciado'
        if (prog !== filtroStatus) return false
      }
      if (filtroVinculo === 'sem_projeto') return false
      return true
    })
  }, [tarefasNormalizadas, filtroAnalista, filtroFonte, filtroStatus, filtroVinculo, passaFiltroUsuario])

  const dev2026Filtradas = useMemo(() => {
    return dev2026Normalizadas.filter(a => {
      if (!passaFiltroUsuario(a.analistaNorm)) return false
      if (filtroFonte === 'cronograma') return false
      if (filtroAnalista !== 'TODOS' && a.analistaNorm !== filtroAnalista) return false
      if (filtroStatus !== 'TODOS' && a.progresso !== filtroStatus) return false
      if (filtroVinculo === 'vinculado' && !a.projeto_codigo) return false
      if (filtroVinculo === 'sem_projeto' && a.projeto_codigo) return false
      return true
    })
  }, [dev2026Normalizadas, filtroAnalista, filtroFonte, filtroStatus, filtroVinculo, passaFiltroUsuario])

  // Unificados para Kanban e Prazos
  const itensUnificados = useMemo((): ItemKanban[] => {
    const tItems: ItemKanban[] = tarefasFiltradas.map(t => ({
      id: `c-${t.id}`,
      nome: t.nome,
      analista: t.analistaNorm,
      projetoId: t.projeto_id,
      projetoCodigo: t.projeto_codigo,
      projetoNome: t.projeto_nome,
      fonte: 'cronograma' as const,
      inicio: t.data_inicio,
      fim: t.data_fim,
      fimBaseline: t.data_fim_baseline,
      duracao: t.duracao,
      progresso: null,
      pct: t.percentual,
      prioridade: '' as const,
      statusTexto: t.observacoes || '',
      dataConclusao: t.data_conclusao,
      observacoes: t.observacoes,
    }))
    const dItems: ItemKanban[] = dev2026Filtradas.map(a => ({
      id: `d-${a.id}`,
      nome: a.nome,
      analista: a.analistaNorm,
      projetoId: (a as any).projeto_id_num ?? undefined,
      projetoCodigo: a.projeto_codigo,
      projetoNome: a.projeto_nome,
      fonte: 'dev2026' as const,
      inicio: a.inicio_dev || null,
      fim: a.fim_dev || null,
      duracao: a.duracao,
      progresso: a.progresso,
      pct: null,
      prioridade: a.prioridade,
      statusTexto: a.status,
      dataConclusao: a.concluido_em || null,
      observacoes: null,
      confirmada: a.prioridade_confirmada,
      prioridadeDB_id: a.prioridade_db_id,
      solicitacaoAlteracao: a.solicitacao_alteracao,
      requisito: a.requisito,
      devId: a.id,
    }))
    return [...tItems, ...dItems]
  }, [tarefasFiltradas, dev2026Filtradas])

  const grupos = useMemo(() => {
    const map: Record<string, { tarefas: typeof tarefasFiltradas; dev: typeof dev2026Filtradas }> = {}
    const addAnalista = (a: string) => { if (!map[a]) map[a] = { tarefas: [], dev: [] } }
    tarefasFiltradas.forEach(t => { addAnalista(t.analistaNorm); map[t.analistaNorm].tarefas.push(t) })
    dev2026Filtradas.forEach(a => { addAnalista(a.analistaNorm); map[a.analistaNorm].dev.push(a) })
    return Object.entries(map).sort(([a], [b]) => {
      const ia = ANALISTAS_TI.indexOf(a), ib = ANALISTAS_TI.indexOf(b)
      if (ia >= 0 && ib >= 0) return ia - ib
      if (ia >= 0) return -1
      if (ib >= 0) return 1
      return a.localeCompare(b)
    })
  }, [tarefasFiltradas, dev2026Filtradas])

  const totalItens = tarefasFiltradas.length + dev2026Filtradas.length
  const totalConflitos = conflitos.size / 2

  const resumoAnalistas = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
    const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    return ANALISTAS_TI.map(nome => {
      const tCron = tarefasNormalizadas.filter(t => t.analistaNorm === nome && t.percentual < 100)
      const tDev = dev2026Normalizadas.filter(a => a.analistaNorm === nome && !a.concluida)
      const emAndamento = tCron.filter(t => t.percentual > 0).length + tDev.filter(a => a.progresso === 'Em andamento').length
      const naoConcluidas = tCron.length + tDev.length

      // Fonte única de capacidade/alocação — mesma regra de dias úteis usada no
      // Dashboard (lib/utils/dias-uteis.ts), centralizada em lib/ti/capacidade.ts.
      const periodos: PeriodoOcupado[] = [
        ...tCron.filter(t => t.data_inicio && t.data_fim).map(t => ({ inicio: t.data_inicio as string, fim: t.data_fim as string })),
        ...tDev.filter(a => a.inicio_dev && a.fim_dev).map(a => ({ inicio: a.inicio_dev as string, fim: a.fim_dev as string })),
      ]
      const meses = mesesTocados(periodos, mesAtual)
      const porMes = meses.map(({ ano, mes }) => ({
        ano, mes,
        label: `${MESES_LABEL[mes - 1]}/${ano}`,
        ...calcularCapacidadeMes(ano, mes, periodos, hoje),
      }))

      return { nome, emAndamento, naoConcluidas, porMes, cor: COR_ANALISTA[nome] }
    })
  }, [tarefasNormalizadas, dev2026Normalizadas])

  const toggleGrupo = (g: string) => setExpandidos(e => ({ ...e, [g]: !e[g] }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-megag-azul flex items-center justify-center">
            <Monitor size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-title flex items-center gap-2">
              TI / Agenda dos Analistas
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">BETA</span>
            </h1>
            <p className="page-subtitle">Consolidação de atividades de TI — Cronogramas + DEV2026</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 text-right">
          <p>{tarefasNormalizadas.length} tarefas nos cronogramas</p>
          <p>{dev2026.length} atividades DEV2026</p>
          {totalConflitos > 0 && (
            <p className="text-amber-600 font-semibold mt-0.5">⚠ {totalConflitos} conflito{totalConflitos > 1 ? 's' : ''} detectado{totalConflitos > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Cards dos analistas TI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {resumoAnalistas.map(a => (
          <div key={a.nome} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            style={{ borderTopWidth: 3, borderTopColor: a.cor }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: a.cor }}>{a.nome.charAt(0)}</div>
              <p className="font-semibold text-sm text-gray-800">{a.nome}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center mb-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-black" style={{ color: a.cor }}>{a.emAndamento}</p>
                <p className="text-xs text-gray-500">Em andamento</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-black text-gray-700">{a.naoConcluidas}</p>
                <p className="text-xs text-gray-500">Pendentes</p>
              </div>
            </div>

            {/* Capacidade por mês — mês atual sempre aparece; meses seguintes só
                aparecem se alguma tarefa do analista se estender até lá. */}
            <div className="flex flex-col gap-2">
              {a.porMes.map(m => {
                const sobrecarregado = m.sobrecargaDias > 0
                return (
                  <div key={`${m.ano}-${m.mes}`}
                    className={`rounded-lg border p-2.5 ${sobrecarregado ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50/60'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-600">{m.label}</span>
                      {sobrecarregado && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                          🔴 SOBRECARGA
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div>
                        <p className="text-sm font-black text-gray-700">{m.capacidadeDias}d</p>
                        <p className="text-[10px] text-gray-500">Capacidade</p>
                      </div>
                      <div>
                        <p className={`text-sm font-black ${sobrecarregado ? 'text-red-600' : 'text-orange-600'}`}>{m.alocadoDias}d</p>
                        <p className="text-[10px] text-gray-500">Alocado</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-green-600">{m.disponivelDias}d</p>
                        <p className="text-[10px] text-gray-500">Disponível</p>
                      </div>
                    </div>
                    {sobrecarregado && (
                      <p className="text-[11px] text-red-700 font-medium mt-1.5 text-center">
                        {m.sobrecargaDias} dia{m.sobrecargaDias !== 1 ? 's' : ''} acima da capacidade
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {([
          { id: 'agenda', label: 'Agenda', icon: List },
          { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
          { id: 'prazos', label: 'Projetos e Prazos', icon: Table2 },
        ] as { id: ViewMode; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setViewMode(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              viewMode === id
                ? 'bg-white text-megag-azul border-gray-200 border-b-white -mb-px z-10'
                : 'bg-gray-50 text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <User size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">Analista:</span>
            <div className="flex gap-1">
              {['TODOS', ...ANALISTAS_TI].map(a => (
                <button key={a} onClick={() => setFiltroAnalista(a)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${filtroAnalista === a ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={filtroAnalista === a ? { background: COR_ANALISTA[a] ?? '#003087' } : {}}>
                  {a === 'TODOS' ? 'Todos' : a.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Fonte:</span>
            {([['TODOS', 'Todas'], ['cronograma', 'Cronograma'], ['dev2026', 'DEV2026']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFiltroFonte(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${filtroFonte === v ? 'bg-megag-azul text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Status:</span>
            {([['TODOS', 'Todos'], ['Em andamento', 'Andamento'], ['Não iniciado', 'Não iniciado'], ['Concluído', 'Concluído']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFiltroStatus(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${filtroStatus === v ? 'bg-megag-azul text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Projeto:</span>
            {([['TODOS', 'Todos'], ['vinculado', 'Vinculado'], ['sem_projeto', 'Sem projeto']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFiltroVinculo(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${filtroVinculo === v ? 'bg-megag-azul text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>

          {viewMode === 'agenda' && (
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={agruparAnalista} onChange={e => setAgruparAnalista(e.target.checked)}
                  className="w-3.5 h-3.5 accent-megag-azul" />
                <span className="text-xs text-gray-600">Agrupar por analista</span>
              </label>
            </div>
          )}
        </div>

        {/* Segunda linha: Cargo | Perfil | Diretoria */}
        <div className="flex flex-wrap gap-3 items-center mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Cargo:</span>
            <select value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-megag-azul cursor-pointer">
              <option value="TODOS">Todos</option>
              {cargosDistinct.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Perfil:</span>
            <select value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-megag-azul cursor-pointer">
              <option value="TODOS">Todos</option>
              {perfisDistinct.map(p => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Diretoria:</span>
            <select value={filtroDiretoria} onChange={e => setFiltroDiretoria(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-megag-azul cursor-pointer">
              <option value="TODOS">Todas</option>
              {diretoriasDistinct.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {(filtroCargo !== 'TODOS' || filtroPerfil !== 'TODOS' || filtroDiretoria !== 'TODOS') && (
            <button
              onClick={() => { setFiltroCargo('TODOS'); setFiltroPerfil('TODOS'); setFiltroDiretoria('TODOS') }}
              className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition">
              ✕ Limpar filtros de usuário
            </button>
          )}

          <div className="ml-auto text-xs text-gray-400">
            {(filtroCargo !== 'TODOS' || filtroPerfil !== 'TODOS' || filtroDiretoria !== 'TODOS') && (
              <span className="text-amber-600 font-medium mr-2">⚠ Analistas externos (sem cadastro) são ocultados quando filtros de usuário estão ativos.</span>
            )}
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-400">{totalItens} item{totalItens !== 1 ? 's' : ''} exibido{totalItens !== 1 ? 's' : ''}</div>
      </div>

      {/* Aviso conflitos */}
      {totalConflitos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {totalConflitos} conflito{totalConflitos > 1 ? 's' : ''} de agenda detectado{totalConflitos > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Atividades com sobreposição de datas para o mesmo analista. Nenhuma tarefa foi bloqueada — apenas sinalização para gestão da capacidade.
            </p>
          </div>
        </div>
      )}

      {/* ── Visão Agenda ─────────────────────────────────────────────────────── */}
      {viewMode === 'agenda' && (
        agruparAnalista ? (
          <div className="space-y-6">
            {grupos.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                Nenhuma atividade encontrada com os filtros selecionados.
              </div>
            )}
            {grupos.map(([analista, { tarefas, dev }]) => {
              const cor = COR_ANALISTA[analista] ?? '#6B7280'
              const ehTI = ANALISTAS_TI.includes(analista)
              const expanded = expandidos[analista] !== false
              const total = tarefas.length + dev.length
              return (
                <div key={analista} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button onClick={() => toggleGrupo(analista)}
                    className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: cor }}>{analista.charAt(0)}</div>
                      <div className="text-left">
                        <p className="font-semibold text-sm text-gray-900">{analista}</p>
                        <p className="text-xs text-gray-500">{total} atividade{total !== 1 ? 's' : ''} · {tarefas.length} cronograma · {dev.length} DEV2026</p>
                      </div>
                      {!ehTI && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Externo</span>}
                    </div>
                    {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </button>
                  {expanded && (
                    <div className="p-4">
                      {tarefas.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">📋 Cronograma de Projetos ({tarefas.length})</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {tarefas.map(t => (
                              <CardAtividade key={`c-${t.id}`}
                                titulo={t.nome} analista={t.analistaNorm}
                                inicio={t.data_inicio} fim={t.data_fim} fimBaseline={t.data_fim_baseline}
                                duracao={t.duracao}
                                pct={t.percentual}
                                projetoId={t.projeto_id} projetoCodigo={t.projeto_codigo} projetoNome={t.projeto_nome}
                                fonte="cronograma"
                                observacoes={t.observacoes}
                                conflito={conflitos.has(`${analista}::${t.nome}`)}
                                atrasada={t.atrasada}
                                podeEditar={podeGerenciar}
                                semDatas={!t.data_inicio && !t.data_fim}
                                onOpen={() => setModalItem({ id: `c-${t.id}`, nome: t.nome, analista: t.analistaNorm, projetoId: t.projeto_id, projetoCodigo: t.projeto_codigo, projetoNome: t.projeto_nome, fonte: 'cronograma', inicio: t.data_inicio, fim: t.data_fim, duracao: t.duracao, progresso: null, pct: t.percentual ?? null, prioridade: '', statusTexto: '', dataConclusao: null, observacoes: t.observacoes ?? null })}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {dev.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-3">🗂 DEV2026 ({dev.length})</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {dev.map(a => (
                              <CardAtividade key={`d-${a.id}`}
                                titulo={a.nome} analista={a.analistaNorm}
                                inicio={a.inicio_dev || null} fim={a.fim_dev || null}
                                duracao={a.duracao} progresso={a.progresso}
                                projetoId={(a as any).projeto_id_num ?? undefined} projetoCodigo={a.projeto_codigo} projetoNome={a.projeto_nome}
                                fonte="dev2026" statusTexto={a.status}
                                prioridade={a.prioridade}
                                requisito={a.requisito}
                                confirmada={a.prioridade_confirmada}
                                conflito={conflitos.has(`${a.analistaNorm}::${a.nome}`)}
                                atrasada={a.atrasada}
                                semDatas={a.semDatas}
                                onOpen={() => setModalItem({ id: `d-${a.id}`, nome: a.nome, analista: a.analistaNorm, projetoId: (a as any).projeto_id_num ?? undefined, projetoCodigo: a.projeto_codigo, projetoNome: a.projeto_nome, fonte: 'dev2026', inicio: a.inicio_dev || null, fim: a.fim_dev || null, duracao: a.duracao, progresso: a.progresso, pct: null, prioridade: a.prioridade, statusTexto: a.status || '', dataConclusao: null, observacoes: null, confirmada: a.prioridade_confirmada, requisito: a.requisito, devId: a.id })}
                                onVincular={!a.projeto_codigo ? () => setVincularModal({ devId: a.id, nome: a.nome }) : undefined}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {grupos.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                Nenhuma atividade encontrada com os filtros selecionados.
              </div>
            )}
            {grupos.flatMap(([analista, { tarefas, dev }]) => [
              ...tarefas.map(t => (
                <CardAtividade key={`c-${t.id}`}
                  titulo={t.nome} analista={t.analistaNorm}
                  inicio={t.data_inicio} fim={t.data_fim} fimBaseline={t.data_fim_baseline} duracao={t.duracao}
                  pct={t.percentual}
                  projetoId={t.projeto_id} projetoCodigo={t.projeto_codigo} projetoNome={t.projeto_nome}
                  fonte="cronograma" conflito={conflitos.has(`${analista}::${t.nome}`)}
                  atrasada={t.atrasada}
                  podeEditar={podeGerenciar}
                  observacoes={t.observacoes}
                  semDatas={!t.data_inicio && !t.data_fim}
                  onOpen={() => setModalItem({ id: `c-${t.id}`, nome: t.nome, analista: t.analistaNorm, projetoId: t.projeto_id, projetoCodigo: t.projeto_codigo, projetoNome: t.projeto_nome, fonte: 'cronograma', inicio: t.data_inicio, fim: t.data_fim, duracao: t.duracao, progresso: null, pct: t.percentual ?? null, prioridade: '', statusTexto: '', dataConclusao: null, observacoes: t.observacoes ?? null })}
                />
              )),
              ...dev.map(a => (
                <CardAtividade key={`d-${a.id}`}
                  titulo={a.nome} analista={a.analistaNorm}
                  inicio={a.inicio_dev || null} fim={a.fim_dev || null}
                  duracao={a.duracao} progresso={a.progresso}
                  projetoId={(a as any).projeto_id_num ?? undefined} projetoCodigo={a.projeto_codigo} projetoNome={a.projeto_nome}
                  fonte="dev2026" statusTexto={a.status}
                  prioridade={a.prioridade}
                  requisito={a.requisito}
                  confirmada={a.prioridade_confirmada}
                  conflito={conflitos.has(`${a.analistaNorm}::${a.nome}`)}
                  atrasada={a.atrasada}
                  semDatas={a.semDatas}
                  onOpen={() => setModalItem({ id: `d-${a.id}`, nome: a.nome, analista: a.analistaNorm, projetoId: (a as any).projeto_id_num ?? undefined, projetoCodigo: a.projeto_codigo, projetoNome: a.projeto_nome, fonte: 'dev2026', inicio: a.inicio_dev || null, fim: a.fim_dev || null, duracao: a.duracao, progresso: a.progresso, pct: null, prioridade: a.prioridade, statusTexto: a.status || '', dataConclusao: null, observacoes: null, confirmada: a.prioridade_confirmada, requisito: a.requisito, devId: a.id })}
                  onVincular={!a.projeto_codigo ? () => setVincularModal({ devId: a.id, nome: a.nome }) : undefined}
                />
              )),
            ])}
          </div>
        )
      )}

      {/* ── Visão Kanban ────────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            <div>
              <strong>Regra de prioridade:</strong> Itens em <strong>Definir Prioridade</strong> não possuem prioridade atribuída.
              Após definir (0 = maior prioridade → 4 = menor), passam para <strong>Aguardando Desenvolvimento</strong> ordenados pela prioridade.
              DEV2026 já inclui o campo prioridade da planilha original.
            </div>
          </div>
          <KanbanView itens={itensUnificados} onOpen={item => setModalItem(item)} />
        </div>
      )}

      {/* ── Visão Projetos e Prazos ─────────────────────────────────────────── */}
      {viewMode === 'prazos' && <PrazosView itens={itensUnificados} />}

      {/* Modal de detalhes */}
      {modalItem && (
        <TICardModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          projetos={projetosDisponiveis}
          onVincular={modalItem.fonte === 'dev2026' && !modalItem.projetoCodigo && modalItem.devId !== undefined
            ? () => { setModalItem(null); setVincularModal({ devId: modalItem.devId!, nome: modalItem.nome }) }
            : undefined}
        />
      )}

      {/* Modal: Vincular Projeto */}
      {vincularModal && (
        <VincularProjetoModal
          atividadeId={vincularModal.devId}
          atividadeNome={vincularModal.nome}
          projetos={projetosDisponiveis}
          onClose={() => setVincularModal(null)}
          onVincular={() => { setVincularModal(null); router.refresh() }}
        />
      )}

      {/* Legenda */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-xs text-gray-500">
        <p className="font-semibold text-gray-700 mb-2">Legenda — Visão BETA</p>
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100 text-xs">Cronograma</span>
            Tarefas dos cronogramas de projeto (Michel, Divonzi, Plinio)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium border border-purple-100 text-xs">DEV2026</span>
            Atividades da planilha DEV2026 (exportada em 24/04/2026)
          </span>
          <span className="flex items-center gap-1.5"><Info size={11} className="text-amber-500" /> Atividade sem projeto cadastrado no sistema</span>
          <span className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-amber-500" /> Sobreposição de datas para o mesmo analista</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">P0</span>
            Prioridade (0 = maior, 4 = menor) — usado na fila Kanban
          </span>
        </div>
      </div>
    </div>
  )
}
