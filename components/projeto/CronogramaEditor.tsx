'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import AlertaValidacao from './AlertaValidacao'
import { validarCronograma, type ErroValidacao } from '@/lib/validacoes-artefatos'
import WorkflowStatusPanel, { type WorkflowInfo } from './WorkflowStatusPanel'
import EnviarAprovacaoModal, { type EtapaInput } from './EnviarAprovacaoModal'
import { formatarData, calcularDuracao, normalizarData } from '@/lib/utils/date'

// ── Constantes estáticas de UI ────────────────────────────────────────────────

type Modo = 'CENTRALIZADO' | 'COLABORATIVO' | 'IMPORTADO'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ConfigItem { id: number; codigo: string; label: string }

interface ResponsavelItem {
  id?: number | null
  nome: string
}

interface CronogramaTarefa {
  id?: number
  cronograma_id?: number
  parent_id?: number | null
  codigo?: string
  nome: string
  nivel: 'FASE' | 'TAREFA' | 'SUBTAREFA'
  tipo?: string
  criticidade?: string
  tipo_macro?: string | null
  data_inicio?: string
  data_fim?: string
  duracao_dias?: number | null
  responsavel_id?: number | null
  responsavel_nome?: string
  area_id?: number | null
  ordem: number
  status?: string
  percentual?: number
  observacoes?: string
  motivo_atraso?: string
  peso?: number
  data_conclusao?: string | null
  concluido_por?: number | null
  prazo_status?: string | null
  /** Data início original preservada quando a tarefa é reprogramada. null = sem reprogramação. */
  data_inicio_baseline?: string | null
  /** Data fim original preservada quando a tarefa é reprogramada. null = sem reprogramação. */
  data_fim_baseline?: string | null
  /** Múltiplos responsáveis — preenchido pelo GET (tabela cronograma_responsaveis) */
  responsaveis?: ResponsavelItem[] | null
}

interface Cronograma {
  id: number
  projeto_id: number
  versao: number
  label: string
  modo: Modo
  fonte_importacao: string
  status: string
  is_baseline: number
  aprovado_por?: number
  aprovado_em?: string
  aprovado_nome?: string
  created_at: string
}

interface VersaoCronograma {
  id: number
  versao: number
  label: string
  status: string
  is_baseline: number
  created_at: string
}

interface Props {
  projetoId: number
  canEdit: boolean
  canApprove: boolean
  canSubmit: boolean
  workflow: WorkflowInfo | null
  sessionUser: { id: number; nome: string }
  usuarios: { id: number; nome: string }[]
  projetoMigrado?: boolean
  onRefresh: () => void
}

interface NovaLinha {
  nome: string
  nivel: 'FASE' | 'TAREFA'
  tipo: string
  criticidade: string
  tipo_macro: string
  data_inicio: string
  data_fim: string
  responsavel_id: string  // kept for compat — first selected
  responsavel_ids: number[] // multi-select
  _responsaveis?: ResponsavelItem[] // transient: carries selected items to API payload
}

interface NovaAtividadeForm {
  macro_id: string
  nome: string
  tipo: string
  criticidade: string
  responsavel_id: string  // required
  data_inicio: string
  data_fim: string
  observacoes: string
  responsaveis?: ResponsavelItem[] // optional multi-select
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// calcularDuracao e formatarData importados de lib/utils/date (shared, correto com datas SQLite)
const calcDuracao = calcularDuracao
const formatDate  = formatarData

/** Converte ISO (YYYY-MM-DD) para exibição em modo de edição (DD/MM/AAAA). Retorna '' para nulo. */
function isoToDisplayEdit(iso?: string | null): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// ── AutocompleteUsuario ────────────────────────────────────────────────────────

function AutocompleteUsuario({
  value,
  usuarios,
  placeholder,
  onChange,
}: {
  value: string
  usuarios: { id: number; nome: string }[]
  placeholder?: string
  onChange: (nome: string, id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  useEffect(() => { setQuery(value) }, [value])

  const filtered = usuarios
    .filter(u => !query.trim() || u.nome.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10)

  return (
    <div className="relative">
      <input
        type="text"
        className="input text-xs py-1 w-full"
        value={query}
        placeholder={placeholder ?? 'Nome'}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value, null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 top-full mt-0.5 w-56 max-h-44 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg text-xs">
          {filtered.map(u => (
            <li
              key={u.id}
              className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer"
              onMouseDown={() => {
                setQuery(u.nome)
                onChange(u.nome, u.id)
                setOpen(false)
              }}
            >
              {u.nome}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Displays multiple responsáveis compactly with +N overflow */
function ResponsaveisDisplay({
  responsaveis,
  fallback,
  className,
}: {
  responsaveis?: ResponsavelItem[] | null
  fallback?: string
  className?: string
}) {
  const nomes = responsaveis?.length ? responsaveis.map(r => r.nome) : fallback ? [fallback] : []
  if (!nomes.length) return <span className="text-gray-300">—</span>
  const MAX = 2
  return (
    <span className={className ?? 'text-gray-600 text-xs'} title={nomes.join(', ')}>
      {nomes.slice(0, MAX).join(', ')}
      {nomes.length > MAX && (
        <span className="text-gray-400 ml-0.5 font-medium">+{nomes.length - MAX}</span>
      )}
    </span>
  )
}

/** Multi-select dropdown for responsáveis (registered users + free text) */
function MultiSelectUsuario({
  value,
  usuarios,
  placeholder,
  onChange,
}: {
  value: ResponsavelItem[]
  usuarios: { id: number; nome: string }[]
  placeholder?: string
  onChange: (selected: ResponsavelItem[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const selectedIds = new Set(value.filter(v => v.id).map(v => v.id))
  const filtered = usuarios
    .filter(u => !query || u.nome.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 15)

  function toggle(u: { id: number; nome: string }) {
    if (selectedIds.has(u.id)) onChange(value.filter(v => v.id !== u.id))
    else onChange([...value, { id: u.id, nome: u.nome }])
  }

  function addExterno() {
    const q = query.trim()
    if (!q) return
    if (value.some(v => v.nome.toLowerCase() === q.toLowerCase())) { setQuery(''); return }
    const match = usuarios.find(u => u.nome.toLowerCase() === q.toLowerCase())
    if (match) toggle(match)
    else onChange([...value, { nome: q }])
    setQuery('')
  }

  function remove(idx: number) { onChange(value.filter((_, i) => i !== idx)) }

  const MAX_SHOW = 2
  return (
    <div className="relative" ref={containerRef}>
      <div
        className="input text-xs py-0.5 w-full cursor-pointer min-h-[26px] flex flex-wrap gap-0.5 items-center pr-1"
        onClick={() => { setOpen(o => !o) }}
      >
        {value.length === 0 ? (
          <span className="text-gray-400 text-[11px] px-0.5">{placeholder ?? 'Responsável(eis)'}</span>
        ) : (
          <>
            {value.slice(0, MAX_SHOW).map((r, i) => (
              <span key={i} className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 rounded px-1 py-0 text-[10px]">
                {r.nome}
                <span className="cursor-pointer hover:text-red-600 leading-none"
                  onMouseDown={e => { e.stopPropagation(); remove(value.indexOf(r)) }}>×</span>
              </span>
            ))}
            {value.length > MAX_SHOW && (
              <span className="text-[10px] text-gray-500">+{value.length - MAX_SHOW}</span>
            )}
          </>
        )}
      </div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-0.5 w-64 bg-white border border-gray-200 rounded shadow-lg text-xs" style={{ minWidth: '200px' }}>
          <div className="p-1.5 border-b border-gray-100">
            <input
              type="text"
              className="input text-xs py-0.5 w-full"
              placeholder="Buscar ou digitar nome…"
              value={query}
              autoFocus
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExterno() } }}
            />
          </div>
          <ul className="max-h-40 overflow-y-auto">
            {filtered.map(u => (
              <li key={u.id}
                className={`px-2 py-1.5 cursor-pointer flex items-center gap-2 ${selectedIds.has(u.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onMouseDown={e => { e.preventDefault(); toggle(u) }}>
                <input type="checkbox" readOnly checked={selectedIds.has(u.id)} className="pointer-events-none accent-blue-600" />
                <span className="text-gray-700">{u.nome}</span>
              </li>
            ))}
            {query.trim() && !usuarios.find(u => u.nome.toLowerCase() === query.trim().toLowerCase()) && (
              <li className="px-2 py-1.5 cursor-pointer text-gray-500 italic hover:bg-gray-50 flex items-center gap-1"
                onMouseDown={e => { e.preventDefault(); addExterno() }}>
                <span className="text-green-600 font-bold">+</span> Adicionar &quot;{query.trim()}&quot;
              </li>
            )}
            {filtered.length === 0 && !query && (
              <li className="px-2 py-2 text-gray-400 text-[11px]">Nenhum usuário cadastrado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Gera WBS client-side para preview no formulário.
 * O servidor recalcula oficialmente antes de persistir.
 */
function calcWBSPreview(linhas: NovaLinha[]): string[] {
  let faseCount = 0
  let tarefaCount = 0
  let itemCount = 0
  return linhas.map(l => {
    if (l.nivel === 'FASE') {
      faseCount++; tarefaCount = 0
      return String(faseCount)
    }
    if (faseCount > 0) { tarefaCount++; return `${faseCount}.${tarefaCount}` }
    itemCount++; return String(itemCount)
  })
}

/**
 * Gera WBS client-side incluindo SUBTAREFAS (usada no modo de edição inline).
 */
function recalcWBSFull(lista: CronogramaTarefa[]): CronogramaTarefa[] {
  let faseCount = 0; let tarefaCount = 0; let subCount = 0; let rootCount = 0
  return lista.map(t => {
    if (t.nivel === 'FASE') {
      faseCount++; tarefaCount = 0; subCount = 0
      return { ...t, codigo: String(faseCount) }
    }
    if (t.nivel === 'SUBTAREFA') {
      subCount++
      const code = faseCount > 0 && tarefaCount > 0
        ? `${faseCount}.${tarefaCount}.${subCount}`
        : tarefaCount > 0 ? `${tarefaCount}.${subCount}` : `${rootCount}.${subCount}`
      return { ...t, codigo: code }
    }
    // TAREFA
    subCount = 0
    if (faseCount > 0) { tarefaCount++; return { ...t, codigo: `${faseCount}.${tarefaCount}` } }
    rootCount++; return { ...t, codigo: String(rootCount) }
  })
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'PENDENTE' || status === 'NAO_INICIADA')
    return <span className="text-xs text-gray-400">—</span>
  if (status === 'CONCLUIDA')    return <span className="text-xs text-green-600 font-medium">Concluída</span>
  if (status === 'EM_ANDAMENTO') return <span className="text-xs text-blue-600 font-medium">Em andamento</span>
  if (status === 'ATRASADA')     return <span className="text-xs text-red-600 font-medium">Atrasada</span>
  if (status === 'BLOQUEADA')    return <span className="text-xs text-orange-600 font-medium">Bloqueada</span>
  return <span className="text-xs text-gray-500">{status}</span>
}

type StatusAuto = 'PENDENTE' | 'PROXIMO_DO_VENCIMENTO' | 'ATRASADO' | 'CONCLUIDO' | 'CONCLUIDO_NO_PRAZO' | 'CONCLUIDO_COM_ATRASO'

// Converte string de data (YYYY-MM-DD ou DD/MM/YYYY) para Date local sem desvio de fuso
function parseDateLocal(s: string): Date {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const parts = s.split('T')[0].split(' ')[0].split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function calcStatusAuto(t: CronogramaTarefa): StatusAuto {
  // Tarefa concluída: data_conclusao definida, status CONCLUIDA, ou percentual 100
  if (t.data_conclusao || t.status === 'CONCLUIDA' || (t.percentual ?? 0) >= 100) {
    if (t.data_conclusao && t.data_fim) {
      const dc = parseDateLocal(t.data_conclusao)
      const df = parseDateLocal(t.data_fim)
      return dc > df ? 'CONCLUIDO_COM_ATRASO' : 'CONCLUIDO_NO_PRAZO'
    }
    // Sem data_conclusao real para comparar: usa prazo_status gravado
    if (t.prazo_status === 'FORA_DO_PRAZO') return 'CONCLUIDO_COM_ATRASO'
    return 'CONCLUIDO'
  }
  if (!t.data_fim) return 'PENDENTE'
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const fim  = parseDateLocal(t.data_fim)
  const dias = Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000)
  if (dias < 0)  return 'ATRASADO'
  if (dias <= 3) return 'PROXIMO_DO_VENCIMENTO'
  return 'PENDENTE'
}

function calcDiasFaltando(dataFim?: string, concluida?: boolean): string {
  if (concluida || !dataFim) return '—'
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const fim  = new Date(dataFim); fim.setHours(0, 0, 0, 0)
  const d = Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000)
  if (d === 0) return 'Vence hoje'
  if (d > 0)   return `Restam ${d} dia${d === 1 ? '' : 's'}`
  const abs = Math.abs(d)
  return `Atrasado ${abs} dia${abs === 1 ? '' : 's'}`
}

function StatusAutoBadge({ status }: { status: StatusAuto }) {
  const map: Record<StatusAuto, { label: string; cls: string }> = {
    PENDENTE:              { label: 'Pendente',              cls: 'text-gray-400' },
    PROXIMO_DO_VENCIMENTO: { label: 'Próximo ao vencimento', cls: 'text-amber-600 font-medium' },
    ATRASADO:              { label: 'Atrasada',              cls: 'text-red-600 font-medium' },
    CONCLUIDO:             { label: '✓ Concluída',           cls: 'text-green-600 font-medium' },
    CONCLUIDO_NO_PRAZO:    { label: '✓ Concluída no prazo',  cls: 'text-green-600 font-medium' },
    CONCLUIDO_COM_ATRASO:  { label: '⚠ Concluída c/ atraso', cls: 'text-orange-600 font-medium' },
  }
  const { label, cls } = map[status]
  return <span className={`text-xs ${cls}`}>{label}</span>
}

// ── Paleta de cores das Macro Fases ──────────────────────────────────────────
// Cor determinada exclusivamente pelo campo tipo_macro — zero processamento de texto.
// Arquitetura preparada para configuração futura via tela de Configurações.

export type TipoMacro =
  | 'INICIACAO' | 'PLANEJAMENTO' | 'ESTRUTURACAO' | 'DESENVOLVIMENTO'
  | 'IMPLANTACAO' | 'GO_LIVE' | 'ENCERRAMENTO' | 'OUTRO'

export interface MacroFaseConfig {
  codigo:     TipoMacro
  nome:       string
  icone:      string
  background: string
  border:     string
  text:       string
  progress:   string
}

export const MACRO_FASES: Record<TipoMacro, MacroFaseConfig> = {
  INICIACAO:      { codigo: 'INICIACAO',      nome: 'Iniciação',      icone: '🚀', background: '#EFF6FF', border: '#2563EB', text: '#2563EB', progress: '#2563EB' },
  PLANEJAMENTO:   { codigo: 'PLANEJAMENTO',   nome: 'Planejamento',   icone: '📋', background: '#FEFCE8', border: '#CA8A04', text: '#CA8A04', progress: '#CA8A04' },
  ESTRUTURACAO:   { codigo: 'ESTRUTURACAO',   nome: 'Estruturação',   icone: '🏗',  background: '#F3E8FF', border: '#7C3AED', text: '#7C3AED', progress: '#7C3AED' },
  DESENVOLVIMENTO:{ codigo: 'DESENVOLVIMENTO', nome: 'Desenvolvimento', icone: '💻', background: '#FFF7ED', border: '#EA580C', text: '#EA580C', progress: '#EA580C' },
  IMPLANTACAO:    { codigo: 'IMPLANTACAO',    nome: 'Implantação',    icone: '🚚', background: '#F0FDF4', border: '#16A34A', text: '#16A34A', progress: '#16A34A' },
  GO_LIVE:        { codigo: 'GO_LIVE',        nome: 'Go Live',        icone: '🚀', background: '#FEF2F2', border: '#DC2626', text: '#DC2626', progress: '#DC2626' },
  ENCERRAMENTO:   { codigo: 'ENCERRAMENTO',   nome: 'Encerramento',   icone: '✅', background: '#F9FAFB', border: '#374151', text: '#374151', progress: '#374151' },
  OUTRO:          { codigo: 'OUTRO',          nome: 'Outro',          icone: '📁', background: '#F3F4F6', border: '#9CA3AF', text: '#6B7280', progress: '#9CA3AF' },
}

/** Lookup puro — nenhum processamento de string. null/undefined → OUTRO. */
export function getMacroFase(tipoMacro?: string | null): MacroFaseConfig {
  return MACRO_FASES[(tipoMacro as TipoMacro) ?? 'OUTRO'] ?? MACRO_FASES.OUTRO
}

// ── Fase summary (Summary Task — tipo MS Project) ────────────────────────────

type FaseStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'ATRASADA' | 'CONCLUIDA'

function FaseStatusBadge({ status }: { status: FaseStatus }) {
  const MAP: Record<FaseStatus, { label: string; cls: string }> = {
    PENDENTE:     { label: 'Pendente',     cls: 'text-gray-400' },
    EM_ANDAMENTO: { label: 'Em andamento', cls: 'text-blue-600 font-medium' },
    ATRASADA:     { label: 'Atrasada',     cls: 'text-red-600 font-medium' },
    CONCLUIDA:    { label: 'Concluída',    cls: 'text-green-600 font-medium' },
  }
  const { label, cls } = MAP[status]
  return <span className={`text-xs ${cls}`}>{label}</span>
}

interface FaseSummary {
  data_inicio:  string   // formatado para exibição
  data_fim:     string
  dias:         string
  percentual:   number
  status:       FaseStatus
  totalFilhos:  number
}

/**
 * Calcula o resumo automático da FASE a partir das tarefas filhas na lista.
 * Filhos = todos os itens do tipo TAREFA que aparecem imediatamente após a FASE
 * (até a próxima FASE ou fim da lista).
 * editMode = true: datas nas filhas estão em DD/MM/AAAA — converte antes de comparar.
 */
function calcFaseSummaryFromList(
  faseIdx: number,
  lista: CronogramaTarefa[],
  editMode = false
): FaseSummary {
  const EMPTY: FaseSummary = {
    data_inicio: '—', data_fim: '—', dias: '—', percentual: 0, status: 'PENDENTE', totalFilhos: 0,
  }

  const fase = lista[faseIdx]
  const filhos: CronogramaTarefa[] = []
  for (let i = faseIdx + 1; i < lista.length; i++) {
    if (lista[i].nivel === 'FASE') break
    if (lista[i].nivel === 'TAREFA') filhos.push(lista[i])
  }
  if (!filhos.length) {
    // Fase sem filhos visíveis: usa datas e status gravados no DB.
    const dbStatus = fase?.status?.toUpperCase()
    const faseStatus: FaseStatus = (dbStatus === 'CONCLUIDA' || !!fase?.data_conclusao) ? 'CONCLUIDA'
      : dbStatus === 'EM_ANDAMENTO'                         ? 'EM_ANDAMENTO'
      : dbStatus === 'ATRASADA'                             ? 'ATRASADA'
      : 'PENDENTE'
    const dbInicio = fase?.data_inicio ? fase.data_inicio.slice(0, 10) : null
    const dbFim    = fase?.data_fim    ? fase.data_fim.slice(0, 10)    : null
    const diasNum  = dbInicio && dbFim
      ? (Math.round(
          (new Date(dbFim + 'T12:00:00').getTime() - new Date(dbInicio + 'T12:00:00').getTime())
          / 86400000
        ) + 1)
      : null
    return {
      data_inicio: dbInicio ? formatarData(dbInicio) : '—',
      data_fim:    dbFim    ? formatarData(dbFim)    : '—',
      dias:        diasNum  ? `${diasNum}d`          : '—',
      percentual:  0,
      status:      faseStatus,
      totalFilhos: 0,
    }
  }

  // Converter datas para ISO
  const toISO = (d: string | undefined): string | null => {
    if (!d) return null
    return editMode ? normalizarData(d) : d.slice(0, 10)
  }

  const starts = filhos.map(t => toISO(t.data_inicio)).filter((d): d is string => !!d).sort()
  const ends   = filhos.map(t => toISO(t.data_fim)).filter((d): d is string => !!d).sort()

  const isoInicio = starts[0] ?? null
  const isoFim    = ends[ends.length - 1] ?? null

  // Dias inclusivos: (fim - inicio) em dias + 1
  const diasNum = isoInicio && isoFim
    ? (Math.round(
        (new Date(isoFim + 'T12:00:00').getTime() - new Date(isoInicio + 'T12:00:00').getTime())
        / 86400000
      ) + 1)
    : null

  const data_inicio = isoInicio
    ? (editMode ? isoToDisplayEdit(isoInicio) : formatarData(isoInicio))
    : '—'
  const data_fim = isoFim
    ? (editMode ? isoToDisplayEdit(isoFim) : formatarData(isoFim))
    : '—'

  // Status da fase (view only; em edit mode sempre PENDENTE)
  let status: FaseStatus = 'PENDENTE'
  if (!editMode) {
    const sts = filhos.map(f => calcStatusAuto(f))
    const isConcl = (s: StatusAuto) => s === 'CONCLUIDO' || s === 'CONCLUIDO_NO_PRAZO' || s === 'CONCLUIDO_COM_ATRASO'
    if (sts.every(isConcl))              status = 'CONCLUIDA'
    else if (sts.some(s => s === 'ATRASADO')) status = 'ATRASADA'
    else if (sts.some(isConcl))          status = 'EM_ANDAMENTO'
  }

  // Percentual: tarefas concluídas / total
  const concluidas = editMode ? 0 : filhos.filter(f => {
    const s = calcStatusAuto(f)
    return s === 'CONCLUIDO' || s === 'CONCLUIDO_NO_PRAZO' || s === 'CONCLUIDO_COM_ATRASO'
  }).length
  const percentual = filhos.length > 0 ? Math.round((concluidas / filhos.length) * 100) : 0

  return {
    data_inicio,
    data_fim,
    dias: diasNum != null ? `${diasNum}d` : '—',
    percentual,
    status,
    totalFilhos: filhos.length,
  }
}

const emptyLinha = (): NovaLinha => ({
  nome: '', nivel: 'TAREFA', tipo: 'TAREFA', criticidade: 'NORMAL', tipo_macro: 'OUTRO',
  data_inicio: '', data_fim: '', responsavel_id: '', responsavel_ids: [],
})

const emptyNovaAtividade = (): NovaAtividadeForm => ({
  macro_id: '', nome: '', tipo: 'TAREFA', criticidade: 'NORMAL',
  responsavel_id: '', data_inicio: '', data_fim: '', observacoes: '',
  responsaveis: [],
})

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardCronograma({ tarefas, cronogramaStatus }: { tarefas: CronogramaTarefa[]; cronogramaStatus?: string }) {
  const tasks = tarefas.filter(t => t.nivel === 'TAREFA')
  const total = tasks.length
  const concl = tasks.filter(t => { const s = calcStatusAuto(t); return s === 'CONCLUIDO' || s === 'CONCLUIDO_NO_PRAZO' || s === 'CONCLUIDO_COM_ATRASO' }).length
  const pend  = total - concl
  const crits = tasks.filter(t => t.criticidade === 'CRITICA').length
  const pct   = total > 0 ? Math.round((concl / total) * 100) : 0
  const fases = tarefas.filter(t => t.nivel === 'FASE')

  const statusLabel: Record<string, { label: string; color: string }> = {
    RASCUNHO:                  { label: 'Rascunho',                  color: 'text-gray-600'    },
    PENDENTE_APROVACAO:        { label: 'Em Aprovação',               color: 'text-amber-700'  },
    APROVADO:                  { label: 'Aprovado',                   color: 'text-green-700'  },
    EM_EXECUCAO:               { label: 'Em Execução',                color: 'text-blue-700'   },
    PRONTO_PARA_ENCERRAMENTO:  { label: 'Pronto p/ Encerramento',     color: 'text-emerald-700'},
    ENCERRADO:                 { label: 'Encerrado',                  color: 'text-gray-500'   },
  }

  return (
    <div className="card">
      <div className="card-header pb-2 flex items-center justify-between">
        <h3 className="card-title text-sm">Resumo do Cronograma</h3>
        {cronogramaStatus && statusLabel[cronogramaStatus] && (
          <span className={`text-xs font-semibold ${statusLabel[cronogramaStatus].color}`}>
            Status: {statusLabel[cronogramaStatus].label}
          </span>
        )}
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: total, color: 'text-gray-800' },
            { label: 'Concluídas', value: concl,  color: 'text-green-700' },
            { label: 'Pendentes',  value: pend,   color: pend > 0 ? 'text-amber-700' : 'text-gray-400' },
            { label: 'Críticas',   value: crits,  color: 'text-red-600' },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progresso geral</span>
            <span className="text-xs font-semibold text-gray-700">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#003087' }} />
          </div>
        </div>

        {fases.length > 0 && (
          <div className="space-y-2">
            {fases.map(fase => {
              const filhos = tarefas.filter(t => t.nivel === 'TAREFA' && t.parent_id === fase.id)
              const tot  = filhos.length
              const conc = filhos.filter(t => { const s = calcStatusAuto(t); return s === 'CONCLUIDO' || s === 'CONCLUIDO_NO_PRAZO' || s === 'CONCLUIDO_COM_ATRASO' }).length
              const p    = tot > 0 ? Math.round((conc / tot) * 100) : 0
              return (
                <div key={fase.id ?? fase.ordem}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-600 truncate max-w-[70%]">{getMacroFase(fase.tipo_macro).icone} {fase.nome}</span>
                    <span className="text-xs text-gray-500">{p}% · {tot} tarefa(s)</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: getMacroFase(fase.tipo_macro).progress }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CronogramaEditor({
  projetoId, canEdit, canApprove, canSubmit, workflow, sessionUser, usuarios, projetoMigrado, onRefresh,
}: Props) {
  const [cronograma, setCronograma]   = useState<Cronograma | null>(null)
  const [tarefas, setTarefas]         = useState<CronogramaTarefa[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'MANUAL' | 'EXCEL'>('MANUAL')
  const [modo, setModo]               = useState<Modo>('CENTRALIZADO')
  const [linhas, setLinhas]           = useState<NovaLinha[]>([emptyLinha()])
  const [label, setLabel]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [approving, setApproving]     = useState(false)
  const [importing, setImporting]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<string | null>(null)
  const fileRef                       = useRef<HTMLInputElement>(null)

  // Tipos e Criticidades carregados dinamicamente da tabela de configuração
  const [tiposList, setTiposList]           = useState<ConfigItem[]>([])
  const [criticidadesList, setCriticidadesList] = useState<ConfigItem[]>([])

  const [validacaoErros, setValidacaoErros]     = useState<ErroValidacao[]>([])
  const [validacaoSucesso, setValidacaoSucesso] = useState(false)
  const [showEnviarModal, setShowEnviarModal]   = useState(false)
  const [submitting, setSubmitting]             = useState(false)
  const [showRevisaoModal, setShowRevisaoModal] = useState(false)
  const [revisaoObs, setRevisaoObs]             = useState('')
  const [showNovaAtividade, setShowNovaAtividade] = useState(false)
  const [novaAtividade, setNovaAtividade]         = useState<NovaAtividadeForm>(emptyNovaAtividade())
  const [savingAtividade, setSavingAtividade]     = useState(false)

  // Seletor de fase para nova tarefa em RASCUNHO (usa índice no array editandoTarefas)
  const [showFaseSelector, setShowFaseSelector]     = useState(false)
  const [faseSelecionadaIdx, setFaseSelecionadaIdx] = useState<number | 'sem_fase'>('sem_fase')

  // Modal de importação duplicada
  const [showDupModal, setShowDupModal]   = useState(false)
  const [pendingFile, setPendingFile]     = useState<File | null>(null)
  const [creatingNovaVersao, setCreatingNovaVersao] = useState(false)

  // Fluxo de subtarefas
  const [showSubtarefaDialog, setShowSubtarefaDialog] = useState(false)
  const [subtarefaDialogTarefa, setSubtarefaDialogTarefa] = useState<{ id: number; nome: string } | null>(null)
  const [showManualSubtarefa, setShowManualSubtarefa] = useState(false)
  const [novaSubtarefaForm, setNovaSubtarefaForm] = useState<{
    nome: string; descricao: string; responsavel_id: string; data_inicio: string; data_fim: string; criticidade: string; responsaveis: ResponsavelItem[]
  }>({
    nome: '', descricao: '', responsavel_id: '', data_inicio: '', data_fim: '', criticidade: 'NORMAL', responsaveis: [],
  })
  const [savingSubtarefa, setSavingSubtarefa] = useState(false)
  const [gerandoSubtarefas, setGerandoSubtarefas] = useState(false)
  const [subtarefasGeradas, setSubtarefasGeradas] = useState<{ nome: string; descricao: string; selecionada: boolean }[]>([])
  const [showSubtarefasGeradas, setShowSubtarefasGeradas] = useState(false)
  const [salvandoSubtarefasGeradas, setSalvandoSubtarefasGeradas] = useState(false)

  // Modo de edição — apenas ativo quando cronograma está em RASCUNHO
  const [editando, setEditando]           = useState(false)
  const [concluindoId, setConcluindoId]   = useState<number | null>(null)
  const [editandoTarefas, setEditandoTarefas] = useState<CronogramaTarefa[]>([])

  // Edição inline de Observação (funciona mesmo com cronograma aprovado)
  const [editObsId, setEditObsId]   = useState<number | null>(null)
  const [editObsVal, setEditObsVal] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  // Reprogramação de data por tarefa (modo view)
  const [reprogramarId, setReprogramarId]           = useState<number | null>(null)
  const [novaDataInicioRepr, setNovaDataInicioRepr] = useState('')
  const [novaDataRepr, setNovaDataRepr]             = useState('')
  const [salvandoRepr, setSalvandoRepr]             = useState(false)

  // Erros detalhados por tarefa — recalculado dinamicamente conforme campos são preenchidos
  const tarefasComErroDetalhado = useMemo(() => {
    if (!validacaoErros.length) return []
    const temErroInicio = validacaoErros.some(e => e.campo === 'data_inicio')
    const temErroFim    = validacaoErros.some(e => e.campo === 'data_fim')
    const temErroVazio  = validacaoErros.some(e => e.campo === 'tarefas')
    if (temErroVazio) return []
    const lista = editando ? editandoTarefas : tarefas
    const resultado: Array<{ id: number; nome: string; codigo?: string; campo: 'data_inicio' | 'data_fim' }> = []
    for (const t of lista) {
      if (t.nivel === 'FASE') continue   // FASEs têm datas calculadas, não validadas
      if (!t.nome?.trim()) continue
      if (temErroInicio && !t.data_inicio?.trim() && t.id != null)
        resultado.push({ id: t.id, nome: t.nome, codigo: t.codigo, campo: 'data_inicio' })
      if (temErroFim && !t.data_fim?.trim() && t.id != null)
        resultado.push({ id: t.id, nome: t.nome, codigo: t.codigo, campo: 'data_fim' })
    }
    return resultado
  }, [validacaoErros, tarefas, editandoTarefas, editando])

  const tarefasComErro = useMemo(
    () => new Set(tarefasComErroDetalhado.map(e => e.id)),
    [tarefasComErroDetalhado]
  )

  function scrollParaTarefa(id: number) {
    const el = document.querySelector(`[data-tarefa-id="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const [salvandoEdicao, setSalvandoEdicao]   = useState(false)
  const [collapsedFases, setCollapsedFases]   = useState<Set<string>>(new Set())
  const [versoes, setVersoes]                 = useState<VersaoCronograma[]>([])
  const [versaoVendoId, setVersaoVendoId]     = useState<number | null>(null)

  // Undo / Redo — pilhas de snapshots de editandoTarefas
  const [undoStack, setUndoStack] = useState<CronogramaTarefa[][]>([])
  const [redoStack, setRedoStack] = useState<CronogramaTarefa[][]>([])
  // Confirmação de exclusão
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)

  async function fetchCronograma(cronogramaId?: number) {
    setLoading(true)
    try {
      const url = cronogramaId
        ? `/api/projetos/${projetoId}/cronograma?cronogramaId=${cronogramaId}`
        : `/api/projetos/${projetoId}/cronograma`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setCronograma(data.cronograma)
        setTarefas(data.tarefas ?? [])
        if (data.versoes) setVersoes(data.versoes)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function handleSelecionarVersao(id: number | null) {
    setVersaoVendoId(id)
    setEditando(false)
    setEditandoTarefas([])
    fetchCronograma(id ?? undefined)
  }

  useEffect(() => {
    fetchCronograma()
    // Carrega tipos e criticidades da configuração
    fetch('/api/configuracoes/tipos-tarefa')
      .then(r => r.ok ? r.json() : [])
      .then(setTiposList)
    fetch('/api/configuracoes/criticidades')
      .then(r => r.ok ? r.json() : [])
      .then(setCriticidadesList)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId])

  function addLinha()  { setLinhas(p => [...p, emptyLinha()]) }
  function removeLinha(idx: number) { setLinhas(p => p.filter((_, i) => i !== idx)) }
  function updateLinha(idx: number, field: keyof NovaLinha, value: string) {
    setLinhas(p => p.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: value }
      return updated
    }))
  }

  function updateLinhaResponsaveis(idx: number, selected: ResponsavelItem[]) {
    setLinhas(p => p.map((l, i) => {
      if (i !== idx) return l
      return {
        ...l,
        responsavel_ids: selected.map(r => r.id ?? 0).filter(Boolean),
        responsavel_id: selected[0]?.id ? String(selected[0].id) : '',
        _responsaveis: selected,
      }
    }))
  }

  async function handleSalvarManual() {
    const validadas = linhas.filter(l => l.nome.trim())
    if (!validadas.length) { setError('Adicione ao menos uma tarefa com nome.'); return }

    // Validação de responsável no frontend (a API também valida)
    const semResp = validadas.find(l => !l.responsavel_id && !l._responsaveis?.length)
    if (semResp) { setError(`A tarefa "${semResp.nome}" precisa de um responsável.`); return }

    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label:            label || undefined,
          modo,
          fonte_importacao: 'MANUAL',
          tarefas: validadas.map((l, i) => ({
            // WBS NÃO enviado — o servidor calcula oficialmente
            nome:           l.nome,
            nivel:          l.nivel,
            tipo:           l.tipo,
            criticidade:    l.criticidade,
            tipo_macro:     l.nivel === 'FASE' ? (l.tipo_macro || 'OUTRO') : null,
            data_inicio:    l.data_inicio || undefined,
            data_fim:       l.data_fim    || undefined,
            duracao_dias:   calcDuracao(l.data_inicio, l.data_fim),
            responsavel_id: l._responsaveis?.length ? (l._responsaveis[0].id ?? undefined) : (l.responsavel_id ? Number(l.responsavel_id) : undefined),
            responsaveis_nomes: l._responsaveis?.map(r => r.nome) ?? (l.responsavel_id ? [usuarios.find(u => u.id === Number(l.responsavel_id))?.nome ?? ''] : []),
            ordem:          i + 1,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setSuccess('Cronograma criado com sucesso!')
      setLinhas([emptyLinha()]); setLabel('')
      await fetchCronograma(); onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function executarImportacao(file: File, acao: 'NOVA_VERSAO' | 'SUBSTITUIR' = 'NOVA_VERSAO') {
    setImporting(true); setError(null); setSuccess(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', label || '')
      formData.append('acao', acao)
      if (acao === 'SUBSTITUIR' && cronograma?.id) {
        formData.append('cronogramaId', String(cronograma.id))
      }
      const res = await fetch(`/api/projetos/${projetoId}/cronograma`, { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        // Monta mensagem de erro detalhada
        const partes: string[] = [data.error ?? 'Erro ao importar']
        if (data.linhasLidas !== undefined)
          partes.push(`Linhas lidas: ${data.linhasLidas}`)
        if (data.ignoradas !== undefined)
          partes.push(`Linhas ignoradas: ${data.ignoradas}`)
        if (Array.isArray(data.erros) && data.erros.length) {
          const detalhes = (data.erros as { linha: number; coluna: string; erro: string }[])
            .map(e => `Linha ${e.linha} (${e.coluna}): ${e.erro}`)
          partes.push(...detalhes)
        } else if (Array.isArray(data.detalhes) && data.detalhes.length) {
          partes.push(...(data.detalhes as string[]))
        }
        throw new Error(partes.join('\n'))
      }

      if (!data.tarefasSalvas || data.tarefasSalvas === 0) {
        throw new Error('Importação processada mas nenhuma tarefa foi persistida.')
      }

      // Resumo
      const partesSucesso = [
        `Arquivo: ${data.arquivo ?? file.name}`,
        `V${data.versao}`,
        `Linhas lidas: ${data.linhasLidas ?? 0}`,
        `Fases: ${data.fasesCriadas ?? 0}`,
        `Tarefas: ${data.tarefasCriadas ?? 0}`,
      ]
      if (data.tarefasDescartadas > 0)
        partesSucesso.push(`Ignoradas: ${data.tarefasDescartadas}`)

      let msg = `Cronograma importado com sucesso! ${partesSucesso.join(' · ')}.`

      if (data.warnings?.length) {
        msg += `\n⚠️ ${data.warnings.length} aviso(s):\n` +
          (data.warnings as string[]).map((w: string) => `• ${w}`).join('\n')
      }

      // Erros por linha presentes mas importação parcial foi feita
      const errosPorLinha = data.errosPorLinha as { linha: number; coluna: string; erro: string }[] | undefined
      if (errosPorLinha?.length) {
        msg += `\n\n⚠️ ${errosPorLinha.length} linha(s) ignorada(s) por erro:\n` +
          errosPorLinha.map(e => `• Linha ${e.linha} (${e.coluna}): ${e.erro}`).join('\n')
      }

      if (fileRef.current) fileRef.current.value = ''
      setLabel('')
      await fetchCronograma(); onRefresh()
      setSuccess(msg)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao importar')
    } finally { setImporting(false) }
  }

  async function handleImportarExcel() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Selecione um arquivo Excel.'); return }

    // Se já existe cronograma ativo - perguntar como proceder
    if (cronograma) {
      setPendingFile(file)
      setShowDupModal(true)
      return
    }

    await executarImportacao(file)
  }

  async function handleDupConfirm(acao: 'NOVA_VERSAO' | 'SUBSTITUIR') {
    setShowDupModal(false)
    if (!pendingFile) return
    await executarImportacao(pendingFile, acao)
    setPendingFile(null)
  }

  async function handleNovaVersao() {
    if (!cronograma) return
    setCreatingNovaVersao(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/nova-versao`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar nova versão.')
      await fetchCronograma(); onRefresh()
      setSuccess(`Cronograma V${data.versao} criado como rascunho. Edite e submeta para aprovação.`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar nova versão.')
    } finally { setCreatingNovaVersao(false) }
  }

  async function handleConcluirTarefa(tarefaId: number) {
    if (!cronograma) return
    setConcluindoId(tarefaId); setError(null)
    try {
      const res = await fetch(
        `/api/projetos/${projetoId}/cronograma/${cronograma.id}/tarefas/${tarefaId}/concluir`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao concluir atividade')
      await fetchCronograma()
      const label = data.is_subtarefa ? 'Subtarefa' : 'Atividade'
      const foraDoPrazo = data.prazo_status === 'FORA_DO_PRAZO'
      const dias: number = data.dias_atraso ?? 0
      let msg = foraDoPrazo
        ? `⚠ ${label} concluída com atraso de ${dias} dia${dias !== 1 ? 's' : ''}.`
        : `✅ ${label} concluída dentro do prazo.`
      if (data.tarefa_pai_auto_completada)
        msg += `\n✅ Atividade "${data.tarefa_pai_nome}" concluída automaticamente — todas as subtarefas finalizadas.`
      if (data.fase_auto_completada)
        msg += `\n✅ Fase "${data.fase_nome}" concluída automaticamente — todas as atividades finalizadas.`
      if (data.cronograma_concluido)
        msg += `\n🎉 Cronograma concluído — pronto para encerramento.`
      setSuccess(msg)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir atividade')
    } finally { setConcluindoId(null) }
  }

  // ── Reprogramação de data por tarefa ────────────────────────────────────────

  async function handleReprogramar(tarefaId: number) {
    const isoFim    = novaDataRepr       ? normalizarData(novaDataRepr)       : null
    const isoInicio = novaDataInicioRepr ? normalizarData(novaDataInicioRepr) : null
    if (novaDataRepr && !isoFim)          { setError('Nova data de término inválida. Use DD/MM/AAAA.'); return }
    if (novaDataInicioRepr && !isoInicio) { setError('Nova data de início inválida. Use DD/MM/AAAA.'); return }
    if (!isoFim && !isoInicio)            { setError('Informe pelo menos uma das datas no formato DD/MM/AAAA.'); return }
    setSalvandoRepr(true); setError(null)
    try {
      const body: Record<string, string> = {}
      if (isoFim)    body.nova_data        = isoFim
      if (isoInicio) body.nova_data_inicio = isoInicio
      const res = await fetch(
        `/api/projetos/${projetoId}/cronograma/${cronograma!.id}/tarefas/${tarefaId}/reprogramar`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro ao reprogramar.') }
      setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('')
      await fetchCronograma()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao reprogramar.')
    } finally { setSalvandoRepr(false) }
  }

  // ── Edição inline ──────────────────────────────────────────────────────────

  function recalcWBSInline(lista: CronogramaTarefa[]): CronogramaTarefa[] {
    return recalcWBSFull(lista)
  }

  function handleIniciarEdicao() {
    setEditandoTarefas(tarefas.map(t => ({
      ...t,
      data_inicio:            isoToDisplayEdit(t.data_inicio),
      data_inicio_baseline:   t.data_inicio_baseline ?? null,
      data_fim:               isoToDisplayEdit(t.data_fim),
      data_fim_baseline:      t.data_fim_baseline ?? null,
    })))
    setUndoStack([])
    setRedoStack([])
    setEditando(true)
  }

  function handleCancelarEdicao() {
    setEditandoTarefas([])
    setUndoStack([])
    setRedoStack([])
    setConfirmDeleteIdx(null)
    setEditando(false)
    setError(null)
  }

  async function handleSalvarEdicao() {
    const invalidas = editandoTarefas.filter(t => !t.nome.trim())
    if (invalidas.length) { setError('Todas as linhas precisam de um nome.'); return }
    setSalvandoEdicao(true); setError(null)
    try {
      const payload = editandoTarefas.map((t, i) => ({
        ...(t.id ? { id: t.id } : {}),
        nome:                 t.nome.trim(),
        nivel:                t.nivel,
        ordem:                i + 1,
        tipo_macro:           t.nivel === 'FASE' ? (t.tipo_macro ?? 'OUTRO') : null,
        responsavel_id:       t.responsaveis?.length ? (t.responsaveis[0].id ?? null) : (t.responsavel_id ?? null),
        responsavel_nome_ext: t.responsaveis?.length ? (!t.responsaveis[0].id ? t.responsaveis[0].nome : null) : (t.responsavel_nome ?? null),
        responsaveis:         t.responsaveis ?? undefined,
        data_inicio:          normalizarData(t.data_inicio),
        data_inicio_baseline: t.data_inicio_baseline ?? null,
        data_fim:             normalizarData(t.data_fim),
        data_fim_baseline:    t.data_fim_baseline    ?? null,
        tipo:                 t.tipo                 ?? 'TAREFA',
        criticidade:          t.criticidade          ?? 'NORMAL',
        observacoes:          t.observacoes          ?? null,
      }))
      const url = cronograma
        ? `/api/projetos/${projetoId}/cronograma/${cronograma.id}/tarefas`
        : `/api/projetos/${projetoId}/cronograma`
      const body = cronograma
        ? { tarefas: payload }
        : { modo: 'CENTRALIZADO', tarefas: payload }
      const res = await fetch(url, {
        method: cronograma ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      await fetchCronograma()
      setEditando(false); setEditandoTarefas([])
      setUndoStack([]); setRedoStack([])
      setSuccess('Cronograma salvo com sucesso.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSalvandoEdicao(false) }
  }

  function handleAdicionarFase() {
    pushUndo(editandoTarefas)
    const nova: CronogramaTarefa = {
      nome: '', nivel: 'FASE', ordem: editandoTarefas.length + 1,
      responsavel_id: null,
    }
    setEditandoTarefas(prev => recalcWBSInline([...prev, nova]))
  }

  function handleAdicionarTarefa(faseArrIdx?: number) {
    pushUndo(editandoTarefas)
    if (faseArrIdx != null) {
      // Insere após o último filho da fase no array
      setEditandoTarefas(prev => {
        const fase = prev[faseArrIdx]
        let insertIdx = faseArrIdx + 1
        while (insertIdx < prev.length && prev[insertIdx].nivel !== 'FASE') insertIdx++
        const nova: CronogramaTarefa = {
          nome: '', nivel: 'TAREFA', ordem: insertIdx + 1,
          responsavel_id: null,
          parent_id: fase?.id ?? null,
        }
        const next = [...prev.slice(0, insertIdx), nova, ...prev.slice(insertIdx)]
        return recalcWBSInline(next)
      })
    } else {
      const nova: CronogramaTarefa = {
        nome: '', nivel: 'TAREFA', ordem: editandoTarefas.length + 1,
        responsavel_id: null,
      }
      setEditandoTarefas(prev => recalcWBSInline([...prev, nova]))
    }
  }

  function handleAbrirFaseSelector() {
    const fasesExistentes = editandoTarefas
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.nivel === 'FASE')
    if (fasesExistentes.length === 0) {
      handleAdicionarTarefa()
    } else {
      setFaseSelecionadaIdx(fasesExistentes[0].i)
      setShowFaseSelector(true)
    }
  }

  function handleConfirmarFaseSelector() {
    setShowFaseSelector(false)
    if (faseSelecionadaIdx === 'sem_fase') {
      handleAdicionarTarefa()
    } else {
      handleAdicionarTarefa(faseSelecionadaIdx as number)
    }
  }

  function handleRemoverItem(idx: number) {
    setConfirmDeleteIdx(idx)
  }

  function handleConfirmarExclusao() {
    const idx = confirmDeleteIdx
    if (idx === null) return
    setConfirmDeleteIdx(null)
    pushUndo(editandoTarefas)
    setEditandoTarefas(prev => {
      const target = prev[idx]
      if (target.nivel === 'FASE') {
        const childIdxs = new Set<number>()
        for (let i = idx + 1; i < prev.length; i++) {
          if (prev[i].nivel === 'FASE') break
          childIdxs.add(i)
        }
        return recalcWBSInline(prev.filter((_, i) => i !== idx && !childIdxs.has(i)))
      }
      return recalcWBSInline(prev.filter((_, i) => i !== idx))
    })
  }

  function handleAtualizarCamposInline(idx: number, updates: Partial<CronogramaTarefa>) {
    setUndoStack(prev => [...prev.slice(-49), editandoTarefas])
    setRedoStack([])
    setEditandoTarefas(prev => prev.map((t, i) => i === idx ? { ...t, ...updates } : t))
  }

  function handleAtualizarCampoInline(idx: number, campo: string, valor: unknown) {
    setUndoStack(prev => [...prev.slice(-49), editandoTarefas])
    setRedoStack([])
    setEditandoTarefas(prev => prev.map((t, i) => i === idx ? { ...t, [campo]: valor } : t))
  }

  // ── Observação inline (independente do modo editando) ─────────────────────

  async function handleSalvarObservacao(tarefaId: number) {
    if (!cronograma) return
    setSalvandoObs(true)
    try {
      const res = await fetch(
        `/api/projetos/${projetoId}/cronograma/${cronograma.id}/tarefas/${tarefaId}/observacao`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacao: editObsVal }) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Erro ao salvar observação.')
        return
      }
      // Atualiza a lista local sem recarregar tudo
      setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, observacoes: editObsVal || undefined } : t))
      setEditObsId(null)
    } catch {
      alert('Erro de rede ao salvar observação.')
    } finally {
      setSalvandoObs(false)
    }
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  function pushUndo(snapshot: CronogramaTarefa[]) {
    setUndoStack(prev => [...prev.slice(-49), snapshot])
    setRedoStack([])
  }

  function handleUndo() {
    if (undoStack.length === 0) return
    const anterior = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setRedoStack(r => [...r.slice(-49), editandoTarefas])
    setEditandoTarefas(anterior)
  }

  function handleRedo() {
    if (redoStack.length === 0) return
    const proximo = redoStack[redoStack.length - 1]
    setRedoStack(r => r.slice(0, -1))
    setUndoStack(s => [...s.slice(-49), editandoTarefas])
    setEditandoTarefas(proximo)
  }

  // Atalhos Ctrl+Z / Ctrl+Y (somente em modo de edição)
  useEffect(() => {
    if (!editando) return
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, undoStack, redoStack, editandoTarefas])

  function handleEnviarParaAprovacao() {
    setValidacaoErros([]); setValidacaoSucesso(false)
    // FASEs sem filhos comportam-se como tarefas diretas — incluí-las na validação.
    // FASEs com filhos são excluídas (datas calculadas dos filhos).
    const fasesSemFilhos = tarefas.filter((t, i) => {
      if (t.nivel !== 'FASE') return false
      const proximo = tarefas[i + 1]
      return !proximo || proximo.nivel === 'FASE'
    })
    const tarefasParaValidar = [...tarefas.filter(t => t.nivel !== 'FASE'), ...fasesSemFilhos]
    const erros = validarCronograma(tarefasParaValidar)
    if (erros.length) { setValidacaoErros(erros) } else { setShowEnviarModal(true) }
  }

  async function handleConfirmarWorkflow(etapas: EtapaInput[], modeloId?: number, novoModelo?: { nome: string }) {
    if (!cronograma) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/submeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapas, modeloId, novoModelo }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao enviar')
      setShowEnviarModal(false)
      await fetchCronograma(); onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar para aprovação')
    } finally { setSubmitting(false) }
  }

  async function handleAprovarWorkflow() {
    if (!cronograma) return
    setApproving(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/aprovar`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao aprovar')
      await fetchCronograma(); onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao processar')
    } finally { setApproving(false) }
  }

  async function handleSolicitarRevisao() {
    if (!cronograma || !revisaoObs.trim()) return
    setApproving(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/revisao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: revisaoObs }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao solicitar revisão')
      setShowRevisaoModal(false); setRevisaoObs('')
      await fetchCronograma(); onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao solicitar revisão')
    } finally { setApproving(false) }
  }

  async function handleSalvarNovaAtividade() {
    if (!cronograma || !novaAtividade.nome.trim()) return
    if (!novaAtividade.responsavel_id && !novaAtividade.responsaveis?.length) { setError('Responsável é obrigatório.'); return }
    setSavingAtividade(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/nova-atividade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          macro_id:           novaAtividade.macro_id     ? Number(novaAtividade.macro_id)     : null,
          nome:               novaAtividade.nome.trim(),
          tipo:               novaAtividade.tipo,
          criticidade:        novaAtividade.criticidade,
          responsavel_id:     novaAtividade.responsaveis?.length ? (novaAtividade.responsaveis[0].id ?? undefined) : (novaAtividade.responsavel_id ? Number(novaAtividade.responsavel_id) : undefined),
          responsaveis_nomes: novaAtividade.responsaveis?.length ? novaAtividade.responsaveis.map(r => r.nome) : (novaAtividade.responsavel_id ? [usuarios.find(u => u.id === Number(novaAtividade.responsavel_id))?.nome ?? ''] : []),
          data_inicio:        novaAtividade.data_inicio  || undefined,
          data_fim:           novaAtividade.data_fim     || undefined,
          duracao_dias:       calcDuracao(novaAtividade.data_inicio, novaAtividade.data_fim),
          observacoes:        novaAtividade.observacoes  || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar atividade')
      setShowNovaAtividade(false)
      const tarefaNome = novaAtividade.nome.trim()
      const tarefaId   = data.id as number
      setNovaAtividade(emptyNovaAtividade())
      await fetchCronograma(); onRefresh()
      // Pergunta sobre subtarefas logo após criar a tarefa
      setSubtarefaDialogTarefa({ id: tarefaId, nome: tarefaNome })
      setShowSubtarefaDialog(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao adicionar atividade')
    } finally { setSavingAtividade(false) }
  }

  async function handleSalvarManualSubtarefa() {
    if (!cronograma || !subtarefaDialogTarefa || !novaSubtarefaForm.nome.trim()) return
    if (!novaSubtarefaForm.responsavel_id && !novaSubtarefaForm.responsaveis.length) { setError('Responsável é obrigatório.'); return }
    setSavingSubtarefa(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/nova-atividade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivel:              'SUBTAREFA',
          parent_id:          subtarefaDialogTarefa.id,
          nome:               novaSubtarefaForm.nome.trim(),
          descricao:          novaSubtarefaForm.descricao || undefined,
          criticidade:        novaSubtarefaForm.criticidade,
          responsavel_id:     novaSubtarefaForm.responsaveis.length ? (novaSubtarefaForm.responsaveis[0].id ?? undefined) : (novaSubtarefaForm.responsavel_id ? Number(novaSubtarefaForm.responsavel_id) : undefined),
          responsaveis_nomes: novaSubtarefaForm.responsaveis.length ? novaSubtarefaForm.responsaveis.map(r => r.nome) : (novaSubtarefaForm.responsavel_id ? [usuarios.find(u => u.id === Number(novaSubtarefaForm.responsavel_id))?.nome ?? ''] : []),
          data_inicio:        novaSubtarefaForm.data_inicio || undefined,
          data_fim:           novaSubtarefaForm.data_fim    || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao adicionar subtarefa')
      setNovaSubtarefaForm({ nome: '', descricao: '', responsavel_id: '', data_inicio: '', data_fim: '', criticidade: 'NORMAL', responsaveis: [] })
      setSuccess('Subtarefa adicionada.')
      await fetchCronograma()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao adicionar subtarefa')
    } finally { setSavingSubtarefa(false) }
  }

  async function handleGerarSubtarefas() {
    if (!cronograma || !subtarefaDialogTarefa) return
    setGerandoSubtarefas(true); setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/gerar-subtarefas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarefa_id: subtarefaDialogTarefa.id, tarefa_nome: subtarefaDialogTarefa.nome }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar subtarefas')
      const lista = (data.subtarefas as { nome: string; descricao: string }[]).map(s => ({ ...s, selecionada: true }))
      setSubtarefasGeradas(lista)
      setShowSubtarefaDialog(false)
      setShowSubtarefasGeradas(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar subtarefas')
    } finally { setGerandoSubtarefas(false) }
  }

  async function handleSalvarSubtarefasGeradas() {
    if (!cronograma || !subtarefaDialogTarefa) return
    const selecionadas = subtarefasGeradas.filter(s => s.selecionada)
    if (!selecionadas.length) { setShowSubtarefasGeradas(false); return }
    setSalvandoSubtarefasGeradas(true); setError(null)
    try {
      for (const s of selecionadas) {
        await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/nova-atividade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nivel:          'SUBTAREFA',
            parent_id:      subtarefaDialogTarefa.id,
            nome:           s.nome,
            descricao:      s.descricao || undefined,
            responsavel_id: null,
          }),
        })
      }
      setShowSubtarefasGeradas(false)
      setSubtarefasGeradas([])
      setSubtarefaDialogTarefa(null)
      setSuccess(`${selecionadas.length} subtarefa(s) adicionada(s). Defina os responsáveis no cronograma.`)
      await fetchCronograma(); onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar subtarefas')
    } finally { setSalvandoSubtarefasGeradas(false) }
  }

  function handleAdicionarSubtarefaInline(tarefaIdx: number) {
    pushUndo(editandoTarefas)
    const nova: CronogramaTarefa = {
      nome: '', nivel: 'SUBTAREFA', ordem: editandoTarefas.length + 1,
      parent_id: editandoTarefas[tarefaIdx].id ?? null,
      responsavel_id: null,
    }
    setEditandoTarefas(prev => {
      const next = [...prev]
      next.splice(tarefaIdx + 1, 0, nova)
      return recalcWBSFull(next)
    })
  }

  function limparValidacao() { setValidacaoErros([]); setValidacaoSucesso(false) }

  function toggleFaseCollapse(key: string) {
    setCollapsedFases(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const etapaAtual    = workflow?.etapas.find(e => e.ordem === workflow.etapa_atual)
  const isEtapaAtual  = Number(etapaAtual?.usuario_id) === Number(sessionUser.id)
  // Determina se o usuário está visualizando uma versão histórica (não a mais recente)
  const latestVersaoId = versoes.length > 0 ? versoes[0].id : cronograma?.id
  const isVersaoHistorica = versaoVendoId !== null && versaoVendoId !== latestVersaoId

  if (loading) {
    return <div className="card p-6 text-center text-sm text-gray-500">Carregando cronograma…</div>
  }

  const isBaseline = cronograma?.is_baseline === 1
  const fases      = tarefas.filter(t => t.nivel === 'FASE')
  const wbsPreview = calcWBSPreview(linhas)

  return (
    <div className="space-y-4">
      {/* Erros de validação detalhados por atividade */}
      {validacaoErros.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-semibold">
              Não é possível enviar para aprovação. Corrija os itens abaixo:
            </p>
            <button
              onClick={limparValidacao}
              className="text-amber-600 hover:text-amber-900 font-bold text-base leading-none shrink-0"
            >
              ×
            </button>
          </div>
          {/* Erro genérico: cronograma vazio */}
          {validacaoErros.some(e => e.campo === 'tarefas') && (
            <p className="text-amber-800">⚠️ {validacaoErros.find(e => e.campo === 'tarefas')?.label}</p>
          )}
          {/* Erros por atividade — clicável para navegar */}
          {tarefasComErroDetalhado.length > 0 && (
            <ul className="space-y-1 text-amber-800 mt-1">
              {tarefasComErroDetalhado.map((e, idx) => (
                <li key={`${e.id}-${e.campo}-${idx}`} className="flex items-center gap-1.5">
                  <span className="text-orange-500 shrink-0">⚠️</span>
                  <button
                    type="button"
                    className="text-left underline decoration-dotted hover:text-amber-600 transition-colors"
                    onClick={() => scrollParaTarefa(e.id)}
                  >
                    {e.codigo && <span className="font-mono mr-1 text-xs">[{e.codigo}]</span>}
                    Atividade &ldquo;{e.nome}&rdquo; sem {e.campo === 'data_inicio' ? 'data de início' : 'data de fim'}.
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* Sucesso de validação */}
      <AlertaValidacao erros={[]} sucesso={validacaoSucesso} onFechar={limparValidacao} />

      {/* Workflow em aprovação */}
      {workflow && cronograma?.status === 'PENDENTE_APROVACAO' && (
        <WorkflowStatusPanel
          workflow={workflow}
          sessionId={sessionUser.id}
          actions={isEtapaAtual ? (
            <>
              <button className="btn-primary text-sm" disabled={approving} onClick={handleAprovarWorkflow}>
                {etapaAtual?.tipo === 'CIENCIA'
                  ? (approving ? 'Processando…' : 'Confirmar Ciência')
                  : (approving ? 'Aprovando…' : 'Aprovar')}
              </button>
              {etapaAtual?.tipo === 'APROVACAO' && (
                <button className="btn-secondary text-sm" disabled={approving} onClick={() => setShowRevisaoModal(true)}>
                  Solicitar Revisão
                </button>
              )}
            </>
          ) : undefined}
        />
      )}

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">{success}</div>}

      {/* Banner — Cronograma ENCERRADO */}
      {cronograma?.status === 'ENCERRADO' && (
        <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-4 flex items-start gap-3">
          <span className="text-2xl shrink-0">🔒</span>
          <div>
            <p className="font-semibold text-gray-800">Cronograma encerrado</p>
            <div className="text-sm text-gray-600 mt-1 space-y-0.5">
              <p>Versão utilizada: <strong>V{cronograma.versao}</strong> — {cronograma.label}</p>
              {cronograma.aprovado_em && (
                <p>Data de aprovação: <strong>{new Date(cronograma.aprovado_em).toLocaleDateString('pt-BR')}</strong>
                   {' às '}{new Date(cronograma.aprovado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {cronograma.aprovado_nome && (
                <p>Responsável pela aprovação: <strong>{cronograma.aprovado_nome}</strong></p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Edição, exclusão, importação e nova versão estão bloqueados.</p>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {cronograma && tarefas.length > 0 && <DashboardCronograma tarefas={tarefas} cronogramaStatus={cronograma.status} />}

      {/* ── Tabela de visualização (MS Project layout) ── */}
      {cronograma && (
        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <h3 className="card-title">Cronograma</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isVersaoHistorica
                    ? <span className="text-amber-600 font-medium">Visualizando versão histórica</span>
                    : <>Criado em {formatDate(cronograma.created_at)} · {tarefas.length} item(ns)</>
                  }
                </p>
              </div>

              {/* Seletor de versão — visível quando há mais de uma versão */}
              {versoes.length > 1 && (
                <select
                  className="input text-xs py-1 pr-6 w-auto"
                  value={versaoVendoId ?? (cronograma?.id ?? '')}
                  onChange={e => handleSelecionarVersao(Number(e.target.value))}
                  title="Selecionar versão do cronograma"
                >
                  {versoes.map(v => (
                    <option key={v.id} value={v.id}>
                      V{v.versao}
                      {v.label && v.label !== `Versão ${v.versao}` ? ` — ${v.label}` : ''}
                      {' '}({v.status === 'APROVADO' ? '✓ Aprovado' : v.status === 'PENDENTE_APROVACAO' ? '⏳ Em aprovação' : 'Rascunho'})
                      {v.id === latestVersaoId ? ' · atual' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
                  {/* Badge de status */}
                  {cronograma.status === 'APROVADO' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      ✓ Aprovado
                    </span>
                  )}
                  {cronograma.status === 'PENDENTE_APROVACAO' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      ⏳ Em Aprovação
                    </span>
                  )}
                  {cronograma.status === 'RASCUNHO' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      Rascunho
                    </span>
                  )}
                  {cronograma.status === 'EM_EXECUCAO' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      ▶ Em Execução
                    </span>
                  )}
                  {cronograma.status === 'PRONTO_PARA_ENCERRAMENTO' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      ✅ Pronto para Encerramento
                    </span>
                  )}
                  {cronograma.status === 'ENCERRADO' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                      🔒 Encerrado
                    </span>
                  )}

                  {/* Exportar Excel — disponível em qualquer status */}
                  <a
                    href={`/api/projetos/${projetoId}/cronograma/exportar`}
                    download
                    className="btn-secondary text-sm inline-flex items-center gap-1.5"
                  >
                    📤 Exportar
                  </a>

                  {/* Botões de edição — ocultos quando cronograma está ENCERRADO */}
                  {cronograma.status !== 'ENCERRADO' && (
                    <>
                      {/* APROVADO / EM_EXECUCAO / PRONTO_PARA_ENCERRAMENTO - Nova Tarefa + Nova Versão */}
                      {['APROVADO','EM_EXECUCAO','PRONTO_PARA_ENCERRAMENTO'].includes(cronograma.status) && canEdit && !isVersaoHistorica && (
                        <>
                          <button
                            className="btn-secondary text-sm"
                            onClick={() => setShowNovaAtividade(true)}
                          >
                            + Nova Tarefa
                          </button>
                          <button
                            className="btn-primary text-sm"
                            disabled={creatingNovaVersao}
                            onClick={handleNovaVersao}
                          >
                            {creatingNovaVersao ? 'Criando…' : 'Nova Versão'}
                          </button>
                        </>
                      )}

                      {/* RASCUNHO - Salvar/Cancelar (editando) ou Editar/Enviar */}
                      {cronograma.status === 'RASCUNHO' && !isVersaoHistorica && (
                        <>
                          {editando ? (
                            <>
                              {/* Desfazer / Refazer */}
                              <button
                                title="Desfazer (Ctrl+Z)"
                                disabled={undoStack.length === 0}
                                onClick={handleUndo}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-600"
                              >
                                ↶
                              </button>
                              <button
                                title="Refazer (Ctrl+Y)"
                                disabled={redoStack.length === 0}
                                onClick={handleRedo}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-600"
                              >
                                ↷
                              </button>
                              <div className="w-px h-5 bg-gray-200 mx-1" />
                              <button className="btn-secondary text-sm" onClick={handleCancelarEdicao}>
                                Cancelar
                              </button>
                              <button
                                className="btn-primary text-sm"
                                onClick={handleSalvarEdicao}
                                disabled={salvandoEdicao}
                              >
                                {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                              </button>
                            </>
                          ) : (
                            <>
                              {canEdit && (
                                <button className="btn-ghost text-sm" onClick={handleIniciarEdicao}>
                                  ✏️ Editar Cronograma
                                </button>
                              )}
                              {canSubmit && (
                                <button className="btn-primary text-sm" onClick={handleEnviarParaAprovacao}>
                                  Enviar para Aprovação
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                      {/* PENDENTE_APROVACAO - sem botões (workflow panel exibe aprovação) */}
                    </>
                  )}
            </div>
          </div>

          {(editando ? editandoTarefas : tarefas).length > 0 || editando ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-20">WBS</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Nome</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-28">Responsável</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-24">Início</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-24">Fim</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs w-16">Dias</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-28">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-40">Observação</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const lista = editando ? editandoTarefas : tarefas
                    const rows: React.ReactNode[] = []
                    let lastFaseCor: MacroFaseConfig | null = null

                    lista.forEach((t, i) => {
                      const faseKey     = t.id != null ? `fase-${t.id}` : `faseidx-${i}`
                      const isConcluindo = concluindoId === t.id

                      if (t.nivel === 'FASE') {
                        const cor   = getMacroFase(t.tipo_macro)
                        lastFaseCor = cor
                        const summary    = calcFaseSummaryFromList(i, lista, editando)
                        const isExpanded = !collapsedFases.has(faseKey)

                        rows.push(
                          <tr key={t.id ?? `new-${i}`} style={{ backgroundColor: cor.background, borderBottom: `2px solid ${cor.border}` }}>
                            {/* WBS + toggle */}
                            <td className="px-3 py-2 w-20">
                              <div className="flex items-center gap-1">
                                {!editando && (
                                  <button
                                    type="button"
                                    className="w-4 text-xs leading-none select-none transition-colors"
                                    style={{ color: cor.text }}
                                    onClick={() => toggleFaseCollapse(faseKey)}
                                    title={isExpanded ? 'Recolher' : 'Expandir'}
                                  >
                                    {isExpanded ? '▼' : '▶'}
                                  </button>
                                )}
                                <span className="font-mono text-xs" style={{ color: cor.text }}>{t.codigo ?? '—'}</span>
                              </div>
                            </td>

                            {/* Nome */}
                            <td className="px-3 py-2">
                              {editando ? (
                                <input
                                  type="text"
                                  className="input w-full text-sm py-1 font-semibold"
                                  value={t.nome}
                                  placeholder="Nome da fase"
                                  onChange={e => handleAtualizarCampoInline(i, 'nome', e.target.value)}
                                />
                              ) : (
                                <span className="font-semibold" style={{ color: cor.text }}>{t.nome}</span>
                              )}
                            </td>

                            {/* Responsável */}
                            <td className="px-3 py-2 text-xs w-32">
                              {editando ? (
                                <MultiSelectUsuario
                                  value={t.responsaveis?.length ? (t.responsaveis as ResponsavelItem[]) : (t.responsavel_nome ? [{ id: t.responsavel_id ?? undefined, nome: t.responsavel_nome }] : [])}
                                  usuarios={usuarios}
                                  placeholder="Responsável"
                                  onChange={sel => handleAtualizarCamposInline(i, {
                                    responsaveis: sel,
                                    responsavel_id: sel[0]?.id ?? null,
                                    responsavel_nome: sel[0]?.nome,
                                  })}
                                />
                              ) : (
                                <ResponsaveisDisplay responsaveis={t.responsaveis} fallback={t.responsavel_nome} />
                              )}
                            </td>

                            {/* Início */}
                            <td className="px-3 py-2 text-xs w-24">
                              {!editando && summary.totalFilhos === 0 && reprogramarId === t.id ? (
                                <input
                                  type="text"
                                  className="input text-xs py-0.5 w-full"
                                  value={novaDataInicioRepr}
                                  placeholder="DD/MM/AAAA"
                                  maxLength={10}
                                  onChange={e => setNovaDataInicioRepr(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Escape') { setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('') }
                                  }}
                                />
                              ) : (
                                editando
                                  ? <span className="text-gray-400 italic">{summary.data_inicio}</span>
                                  : <span className="text-gray-600">{summary.data_inicio}</span>
                              )}
                            </td>

                            {/* Fim */}
                            <td className="px-3 py-2 text-xs w-24">
                              {!editando && summary.totalFilhos === 0 && reprogramarId === t.id ? (
                                <div className="flex flex-col gap-1">
                                  <input
                                    type="text"
                                    className="input text-xs py-0.5 w-full"
                                    value={novaDataRepr}
                                    placeholder="DD/MM/AAAA"
                                    maxLength={10}
                                    autoFocus
                                    onChange={e => setNovaDataRepr(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleReprogramar(t.id!)
                                      if (e.key === 'Escape') { setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('') }
                                    }}
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      className="text-[10px] text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50 disabled:opacity-50"
                                      disabled={salvandoRepr}
                                      onClick={() => handleReprogramar(t.id!)}
                                    >{salvandoRepr ? '…' : 'OK'}</button>
                                    <button
                                      type="button"
                                      className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-50"
                                      onClick={() => { setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('') }}
                                    >✕</button>
                                  </div>
                                </div>
                              ) : (
                                editando
                                  ? <span className="text-gray-400 italic">{summary.data_fim}</span>
                                  : (
                                    <div>
                                      <span className="text-gray-600">{summary.data_fim}</span>
                                      {t.data_fim_baseline && (
                                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                          Base: {formatarData(t.data_fim_baseline.slice(0, 10))}
                                        </p>
                                      )}
                                    </div>
                                  )
                              )}
                            </td>

                            {/* Dias */}
                            <td className="px-3 py-2 text-right text-xs w-16 text-gray-500 font-medium">
                              {summary.dias}
                            </td>

                            {/* Status / Tipo Macro (edit mode) */}
                            <td className="px-3 py-2 w-28">
                              {editando ? (
                                <select
                                  className="input text-xs py-1 w-full"
                                  value={t.tipo_macro ?? 'OUTRO'}
                                  onChange={e => handleAtualizarCampoInline(i, 'tipo_macro', e.target.value)}
                                  title="Tipo da Macro Fase"
                                >
                                  {(Object.values(MACRO_FASES) as MacroFaseConfig[]).map(f => (
                                    <option key={f.codigo} value={f.codigo}>{f.icone} {f.nome}</option>
                                  ))}
                                </select>
                              ) : (
                                <FaseStatusBadge status={summary.status} />
                              )}
                            </td>

                            {/* Observação */}
                            <td className="px-3 py-2 w-40">
                              {editando ? (
                                <input
                                  type="text"
                                  className="input w-full text-xs py-1"
                                  placeholder="Observação…"
                                  value={t.observacoes ?? ''}
                                  onChange={e => handleAtualizarCampoInline(i, 'observacoes', e.target.value)}
                                />
                              ) : editObsId === t.id && t.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    className="input text-xs py-0.5 w-full"
                                    value={editObsVal}
                                    onChange={e => setEditObsVal(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSalvarObservacao(t.id!)
                                      if (e.key === 'Escape') setEditObsId(null)
                                    }}
                                  />
                                  <button type="button" disabled={salvandoObs} onClick={() => handleSalvarObservacao(t.id!)} className="text-[10px] text-green-700 border border-green-300 rounded px-1 py-0.5 hover:bg-green-50 shrink-0">{salvandoObs ? '…' : '✓'}</button>
                                  <button type="button" onClick={() => setEditObsId(null)} className="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5 hover:bg-gray-50 shrink-0">✕</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 group">
                                  <span className="text-xs text-gray-500 truncate max-w-[120px]" title={t.observacoes ?? ''}>
                                    {t.observacoes || <span className="text-gray-300">—</span>}
                                  </span>
                                  {canEdit && t.id && !isVersaoHistorica && (
                                    <button type="button" title="Editar observação" onClick={() => { setEditObsId(t.id!); setEditObsVal(t.observacoes ?? '') }} className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 hover:text-blue-700 shrink-0">✏</button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="px-3 py-2 text-right w-20">
                              {editando && (
                                <button
                                  type="button"
                                  className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-1.5 py-0.5"
                                  title="Remover fase e suas tarefas"
                                  onClick={() => handleRemoverItem(i)}
                                >
                                  ✕
                                </button>
                              )}
                              {!editando && summary.totalFilhos === 0 && canEdit && t.id && (
                                <div className="flex flex-col items-end gap-1">
                                  {summary.status !== 'CONCLUIDA' && (
                                    <button
                                      type="button"
                                      className="text-xs text-green-600 hover:text-green-800 border border-green-300 rounded px-1.5 py-0.5"
                                      title="Concluir fase"
                                      onClick={() => handleConcluirTarefa(t.id!)}
                                    >
                                      ✓
                                    </button>
                                  )}
                                  {summary.status !== 'CONCLUIDA' && reprogramarId !== t.id && (
                                    <button
                                      type="button"
                                      className="text-[10px] text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 hover:bg-orange-50"
                                      title="Reprogramar datas da fase (mantém linha de base)"
                                      onClick={() => { setReprogramarId(t.id!); setNovaDataRepr(''); setNovaDataInicioRepr('') }}
                                    >Reprog.</button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      } else if (t.nivel === 'SUBTAREFA') {
                        // SUBTAREFA — ocultar quando fase ou tarefa pai estiver recolhida
                        if (!editando) {
                          let faseKey: string | null = null
                          for (let j = i - 1; j >= 0; j--) {
                            if (lista[j].nivel === 'FASE') {
                              const pf = lista[j]
                              faseKey = pf.id != null ? `fase-${pf.id}` : `faseidx-${j}`
                              break
                            }
                          }
                          if (faseKey && collapsedFases.has(faseKey)) return
                        }

                        const temErroSub = t.id != null && tarefasComErro.has(t.id)
                        const subStyle = {
                          ...(lastFaseCor ? { borderLeft: `3px solid ${lastFaseCor.border}`, paddingLeft: '0' } : {}),
                          ...(temErroSub ? { backgroundColor: '#FFFBEB', borderLeft: '3px solid #F97316' } : {}),
                        }

                        {
                          const subConcluida  = !!t.data_conclusao
                          const subStatusAuto = calcStatusAuto(t)
                          const isConcluindoSub = concluindoId === t.id

                          rows.push(
                            <tr key={t.id ?? `new-sub-${i}`} data-tarefa-id={t.id} className="border-b border-gray-100 bg-gray-50/40" style={subStyle}>
                              <td className="px-3 py-1.5 w-20">
                                <span className="font-mono text-xs text-gray-300 pl-10">{t.codigo ?? '—'}</span>
                              </td>
                              <td className="px-3 py-1.5">
                                {editando ? (
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1"
                                    style={{ paddingLeft: '3rem' }}
                                    value={t.nome}
                                    placeholder="Nome da subtarefa"
                                    onChange={e => handleAtualizarCampoInline(i, 'nome', e.target.value)}
                                  />
                                ) : (
                                  <span className="pl-10 text-xs text-gray-500">
                                    {temErroSub && <span className="mr-1 text-orange-500" title="Campo obrigatório não preenchido">⚠️</span>}
                                    ↳ {t.nome}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-xs w-32">
                                {editando ? (
                                  <MultiSelectUsuario
                                    value={t.responsaveis?.length ? (t.responsaveis as ResponsavelItem[]) : (t.responsavel_nome ? [{ id: t.responsavel_id ?? undefined, nome: t.responsavel_nome }] : [])}
                                    usuarios={usuarios}
                                    placeholder="Responsável"
                                    onChange={sel => handleAtualizarCamposInline(i, {
                                      responsaveis: sel,
                                      responsavel_id: sel[0]?.id ?? null,
                                      responsavel_nome: sel[0]?.nome,
                                    })}
                                  />
                                ) : (
                                  <ResponsaveisDisplay responsaveis={t.responsaveis} fallback={t.responsavel_nome} />
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-gray-500 text-xs w-24">
                                {editando ? (
                                  <div>
                                    <input type="text" className="input text-xs py-1 w-full" value={t.data_inicio ?? ''}
                                      placeholder="DD/MM/AAAA" maxLength={10}
                                      onChange={e => handleAtualizarCampoInline(i, 'data_inicio', e.target.value)} />
                                    {t.data_inicio_baseline && (
                                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">Base: {formatDate(t.data_inicio_baseline)}</p>
                                    )}
                                  </div>
                                ) : (
                                  t.data_inicio_baseline ? (
                                    <>
                                      <span className="text-gray-700">{formatDate(t.data_inicio)}</span>
                                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Base: {formatDate(t.data_inicio_baseline)}</p>
                                    </>
                                  ) : formatDate(t.data_inicio)
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-gray-500 text-xs w-24">
                                {editando ? (
                                  <div>
                                    <input type="text" className="input text-xs py-1 w-full" value={t.data_fim ?? ''}
                                      placeholder="DD/MM/AAAA" maxLength={10}
                                      onChange={e => handleAtualizarCampoInline(i, 'data_fim', e.target.value)} />
                                    {t.data_fim_baseline && (
                                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">Base: {formatDate(t.data_fim_baseline)}</p>
                                    )}
                                  </div>
                                ) : (
                                  t.data_fim_baseline ? (
                                    <>
                                      <span className="text-gray-700">{formatDate(t.data_fim)}</span>
                                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Base: {formatDate(t.data_fim_baseline)}</p>
                                    </>
                                  ) : formatDate(t.data_fim)
                                )}
                              </td>
                              {/* Dias — vazio para subtarefas */}
                              <td className="px-3 py-1.5 text-right text-xs w-16 text-gray-400">—</td>
                              {/* Status */}
                              <td className="px-3 py-1.5 w-28">
                                {!editando && <StatusAutoBadge status={subStatusAuto} />}
                              </td>
                              {/* Observação */}
                              <td className="px-3 py-1.5 w-40">
                                {editando ? (
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1"
                                    placeholder="Observação…"
                                    value={t.observacoes ?? ''}
                                    onChange={e => handleAtualizarCampoInline(i, 'observacoes', e.target.value)}
                                  />
                                ) : editObsId === t.id && t.id ? (
                                  <div className="flex items-center gap-1">
                                    <input type="text" autoFocus className="input text-xs py-0.5 w-full" value={editObsVal} onChange={e => setEditObsVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSalvarObservacao(t.id!); if (e.key === 'Escape') setEditObsId(null) }} />
                                    <button type="button" disabled={salvandoObs} onClick={() => handleSalvarObservacao(t.id!)} className="text-[10px] text-green-700 border border-green-300 rounded px-1 py-0.5 hover:bg-green-50 shrink-0">{salvandoObs ? '…' : '✓'}</button>
                                    <button type="button" onClick={() => setEditObsId(null)} className="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5 hover:bg-gray-50 shrink-0">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 group">
                                    <span className="text-xs text-gray-500 truncate max-w-[110px]" title={t.observacoes ?? ''}>
                                      {t.observacoes || <span className="text-gray-300">—</span>}
                                    </span>
                                    {canEdit && t.id && !isVersaoHistorica && (
                                      <button type="button" title="Editar observação" onClick={() => { setEditObsId(t.id!); setEditObsVal(t.observacoes ?? '') }} className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 hover:text-blue-700 shrink-0">✏</button>
                                    )}
                                  </div>
                                )}
                              </td>
                              {/* Ações */}
                              <td className="px-3 py-1.5 text-right w-20">
                                {editando ? (
                                  <button type="button"
                                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-1.5 py-0.5"
                                    onClick={() => handleRemoverItem(i)}>✕</button>
                                ) : (
                                  !subConcluida && (
                                    <div className="flex flex-col items-end gap-1">
                                      <button
                                        className="text-xs text-green-700 border border-green-200 rounded px-2 py-0.5 hover:bg-green-50 disabled:opacity-50"
                                        disabled={isConcluindoSub || !t.id}
                                        onClick={() => t.id && handleConcluirTarefa(t.id)}
                                      >
                                        {isConcluindoSub ? '…' : 'Concluir'}
                                      </button>
                                      {canEdit && t.id && reprogramarId !== t.id && (
                                        <button
                                          type="button"
                                          className="text-[10px] text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 hover:bg-orange-50"
                                          title="Informar nova data de entrega"
                                          onClick={() => { setReprogramarId(t.id!); setNovaDataRepr('') }}
                                        >Reprog.</button>
                                      )}
                                    </div>
                                  )
                                )}
                              </td>
                            </tr>
                          )
                        }
                      } else {
                        // TAREFA — verificar se fase pai está recolhida (só no modo visualização)
                        if (!editando) {
                          let parentKey: string | null = null
                          for (let j = i - 1; j >= 0; j--) {
                            if (lista[j].nivel === 'FASE') {
                              const pf = lista[j]
                              parentKey = pf.id != null ? `fase-${pf.id}` : `faseidx-${j}`
                              break
                            }
                          }
                          if (parentKey && collapsedFases.has(parentKey)) return
                        }

                        const concluida  = !!t.data_conclusao
                        const statusAuto = calcStatusAuto(t)

                        // Dias = duração real da tarefa (Fim - Início, inclusivo)
                        const diasTarefa = (() => {
                          const iso1 = editando ? normalizarData(t.data_inicio) : t.data_inicio?.slice(0, 10)
                          const iso2 = editando ? normalizarData(t.data_fim)    : t.data_fim?.slice(0, 10)
                          if (!iso1 || !iso2) return '—'
                          const d = calcDuracao(iso1, iso2)
                          return d != null ? `${d}d` : '—'
                        })()

                        const temErroTarefa = t.id != null && tarefasComErro.has(t.id)
                        const tarefaStyle = {
                          ...(lastFaseCor ? { borderLeft: `3px solid ${lastFaseCor.border}` } : {}),
                          ...(temErroTarefa ? { backgroundColor: '#FFFBEB', borderLeft: '3px solid #F97316' } : {}),
                        }

                        rows.push(
                          <tr key={t.id ?? `new-${i}`} data-tarefa-id={t.id} className="border-b border-gray-100 hover:bg-gray-50" style={tarefaStyle}>
                            {/* WBS */}
                            <td className="px-3 py-2 w-20">
                              <span className="font-mono text-xs text-gray-400 pl-5">{t.codigo ?? '—'}</span>
                            </td>

                            {/* Nome */}
                            <td className="px-3 py-2">
                              {editando ? (
                                <input
                                  type="text"
                                  className="input w-full text-sm py-1"
                                  style={{ paddingLeft: '1.5rem' }}
                                  value={t.nome}
                                  placeholder="Nome da tarefa"
                                  onChange={e => handleAtualizarCampoInline(i, 'nome', e.target.value)}
                                />
                              ) : (
                                <span className="pl-4 text-gray-700">
                                  {temErroTarefa && <span className="mr-1 text-orange-500" title="Campo obrigatório não preenchido">⚠️</span>}
                                  {t.nome}
                                </span>
                              )}
                            </td>

                            {/* Responsável */}
                            <td className="px-3 py-2 text-xs w-32">
                              {editando ? (
                                <MultiSelectUsuario
                                  value={t.responsaveis?.length ? (t.responsaveis as ResponsavelItem[]) : (t.responsavel_nome ? [{ id: t.responsavel_id ?? undefined, nome: t.responsavel_nome }] : [])}
                                  usuarios={usuarios}
                                  placeholder="Responsável"
                                  onChange={sel => handleAtualizarCamposInline(i, {
                                    responsaveis: sel,
                                    responsavel_id: sel[0]?.id ?? null,
                                    responsavel_nome: sel[0]?.nome,
                                  })}
                                />
                              ) : (
                                <ResponsaveisDisplay responsaveis={t.responsaveis} fallback={t.responsavel_nome} />
                              )}
                            </td>

                            {/* Início */}
                            <td className="px-3 py-2 text-gray-600 text-xs w-24">
                              {editando ? (
                                <div>
                                  <input
                                    type="text"
                                    className="input text-xs py-1 w-full"
                                    value={t.data_inicio ?? ''}
                                    placeholder="DD/MM/AAAA"
                                    maxLength={10}
                                    onChange={e => handleAtualizarCampoInline(i, 'data_inicio', e.target.value)}
                                  />
                                  {t.data_inicio_baseline && (
                                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                      Base: {formatDate(t.data_inicio_baseline)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                t.data_inicio_baseline ? (
                                  <div>
                                    <span className="text-gray-700">{formatDate(t.data_inicio)}</span>
                                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                      Base: {formatDate(t.data_inicio_baseline)}
                                    </p>
                                  </div>
                                ) : formatDate(t.data_inicio)
                              )}
                            </td>

                            {/* Fim */}
                            <td className="px-3 py-2 text-gray-600 text-xs w-24">
                              {editando ? (
                                <div>
                                  <input
                                    type="text"
                                    className="input text-xs py-1 w-full"
                                    value={t.data_fim ?? ''}
                                    placeholder="DD/MM/AAAA"
                                    maxLength={10}
                                    onChange={e => handleAtualizarCampoInline(i, 'data_fim', e.target.value)}
                                  />
                                  {t.data_fim_baseline && (
                                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                      Base: {formatDate(t.data_fim_baseline)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {reprogramarId === t.id ? (
                                    <div className="flex flex-col gap-1">
                                      <p className="text-[10px] text-gray-400 font-medium">Nova data início:</p>
                                      <input
                                        type="text"
                                        className="input text-xs py-0.5 w-full"
                                        value={novaDataInicioRepr}
                                        placeholder="DD/MM/AAAA"
                                        maxLength={10}
                                        onChange={e => setNovaDataInicioRepr(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Escape') { setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('') }
                                        }}
                                      />
                                      <p className="text-[10px] text-gray-400 font-medium">Nova data término:</p>
                                      <input
                                        type="text"
                                        className="input text-xs py-0.5 w-full"
                                        value={novaDataRepr}
                                        placeholder="DD/MM/AAAA"
                                        maxLength={10}
                                        autoFocus
                                        onChange={e => setNovaDataRepr(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleReprogramar(t.id!)
                                          if (e.key === 'Escape') { setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('') }
                                        }}
                                      />
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          className="text-[10px] text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50 disabled:opacity-50"
                                          disabled={salvandoRepr}
                                          onClick={() => handleReprogramar(t.id!)}
                                        >{salvandoRepr ? '…' : 'OK'}</button>
                                        <button
                                          type="button"
                                          className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-50"
                                          onClick={() => { setReprogramarId(null); setNovaDataRepr(''); setNovaDataInicioRepr('') }}
                                        >✕</button>
                                      </div>
                                    </div>
                                  ) : t.data_fim_baseline ? (
                                    <>
                                      <span className="text-gray-700">{formatDate(t.data_fim)}</span>
                                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                        Base: {formatDate(t.data_fim_baseline)}
                                      </p>
                                    </>
                                  ) : formatDate(t.data_fim)}
                                </div>
                              )}
                            </td>

                            {/* Dias */}
                            <td className={`px-3 py-2 text-right text-xs w-16 ${
                              !editando && !concluida
                                ? statusAuto === 'ATRASADO'              ? 'text-red-600 font-medium'
                                  : statusAuto === 'PROXIMO_DO_VENCIMENTO' ? 'text-amber-600 font-medium'
                                  : 'text-gray-500'
                                : 'text-gray-400'
                            }`}>
                              {diasTarefa}
                            </td>

                            {/* Status */}
                            <td className="px-3 py-2 w-28">
                              {!editando && <StatusAutoBadge status={statusAuto} />}
                            </td>

                            {/* Observação */}
                            <td className="px-3 py-2 w-40">
                              {editando ? (
                                <input
                                  type="text"
                                  className="input w-full text-xs py-1"
                                  placeholder="Observação…"
                                  value={t.observacoes ?? ''}
                                  onChange={e => handleAtualizarCampoInline(i, 'observacoes', e.target.value)}
                                />
                              ) : editObsId === t.id && t.id ? (
                                <div className="flex items-center gap-1">
                                  <input type="text" autoFocus className="input text-xs py-0.5 w-full" value={editObsVal} onChange={e => setEditObsVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSalvarObservacao(t.id!); if (e.key === 'Escape') setEditObsId(null) }} />
                                  <button type="button" disabled={salvandoObs} onClick={() => handleSalvarObservacao(t.id!)} className="text-[10px] text-green-700 border border-green-300 rounded px-1 py-0.5 hover:bg-green-50 shrink-0">{salvandoObs ? '…' : '✓'}</button>
                                  <button type="button" onClick={() => setEditObsId(null)} className="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5 hover:bg-gray-50 shrink-0">✕</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 group">
                                  <span className="text-xs text-gray-500 truncate max-w-[120px]" title={t.observacoes ?? ''}>
                                    {t.observacoes || <span className="text-gray-300">—</span>}
                                  </span>
                                  {canEdit && t.id && !isVersaoHistorica && (
                                    <button type="button" title="Editar observação" onClick={() => { setEditObsId(t.id!); setEditObsVal(t.observacoes ?? '') }} className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 hover:text-blue-700 shrink-0">✏</button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="px-3 py-2 text-right w-20">
                              {editando ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-1.5 py-0.5"
                                    title="Adicionar subtarefa"
                                    onClick={() => handleAdicionarSubtarefaInline(i)}
                                  >
                                    +Sub
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-1.5 py-0.5"
                                    title="Remover tarefa"
                                    onClick={() => handleRemoverItem(i)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  {canEdit && t.id && !isVersaoHistorica && (
                                    <button
                                      type="button"
                                      className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-1.5 py-0.5"
                                      title="Adicionar subtarefa a esta tarefa"
                                      onClick={() => { setSubtarefaDialogTarefa({ id: t.id!, nome: t.nome }); setShowSubtarefaDialog(true) }}
                                    >
                                      + Sub
                                    </button>
                                  )}
                                  {!concluida && (
                                    <>
                                      <button
                                        className="text-xs text-green-700 border border-green-200 rounded px-2 py-0.5 hover:bg-green-50 disabled:opacity-50"
                                        disabled={isConcluindo || !t.id}
                                        onClick={() => t.id && handleConcluirTarefa(t.id)}
                                      >
                                        {isConcluindo ? '…' : 'Concluir'}
                                      </button>
                                      {canEdit && t.id && reprogramarId !== t.id && (
                                        <button
                                          type="button"
                                          className="text-[10px] text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 hover:bg-orange-50"
                                          title="Informar nova data de entrega (mantém linha de base)"
                                          onClick={() => { setReprogramarId(t.id!); setNovaDataRepr('') }}
                                        >
                                          Reprog.
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      }
                    })

                    if (editando) {
                      rows.push(
                        <tr key="add-buttons" className="border-b border-gray-100 bg-gray-50/50">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                className="text-sm font-medium hover:underline"
                                style={{ color: '#003087' }}
                                onClick={handleAdicionarFase}
                              >
                                + Nova Fase
                              </button>
                              <button
                                type="button"
                                className="text-sm font-medium hover:underline"
                                style={{ color: '#003087' }}
                                onClick={handleAbrirFaseSelector}
                              >
                                + Nova Tarefa
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return rows
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-gray-400">Nenhuma tarefa cadastrada.</div>
          )}
        </div>
      )}

      {/* ── Importar Excel (quando cronograma existe em rascunho e não está editando) ── */}
      {cronograma && cronograma.status === 'RASCUNHO' && canEdit && !isBaseline && !editando && (
        <div className="card">
          <div className="card-header flex items-center justify-between gap-2">
            <h3 className="card-title">Importar do Excel</h3>
            <div className="flex items-center gap-2">
              <a
                href={`/api/projetos/${projetoId}/cronograma/exportar`}
                download
                className="btn-secondary text-sm inline-flex items-center gap-1.5"
              >
                📤 Exportar Excel
              </a>
              <a
                href={`/api/projetos/${projetoId}/cronograma/modelo`}
                download
                className="btn-secondary text-sm inline-flex items-center gap-1.5"
              >
                📥 Baixar Modelo
              </a>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500">
              Substitua o cronograma atual importando uma planilha no formato oficial Mega G.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <button type="button" className="btn-primary text-sm" onClick={handleImportarExcel} disabled={importing}>
                {importing ? 'Processando…' : 'Importar Excel'}
              </button>
            </div>
            {importing && <p className="text-xs text-gray-400 animate-pulse">Processando arquivo…</p>}
          </div>
        </div>
      )}

      {/* ── Formulário de criação inicial (somente quando não há cronograma) ── */}
      {canEdit && !isBaseline && !cronograma && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{cronograma ? 'Nova Versão do Cronograma' : 'Criar Cronograma'}</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex-1 min-w-48">
                <label className="input-label">Rótulo (opcional)</label>
                <input type="text" className="input w-full" placeholder="Ex.: Versão inicial"
                  value={label} onChange={e => setLabel(e.target.value)} />
              </div>

              <div>
                <label className="input-label">Modo</label>
                <div className="flex flex-wrap gap-4 mt-1.5">
                  {([
                    ['CENTRALIZADO', 'Centralizado',         false],
                    ['COLABORATIVO', 'Colaborativo',         false],
                    ['IMPORTADO',    'Importado (Em breve)', true],
                  ] as const).map(([val, lbl, disabled]) => (
                    <label key={val} className={`flex items-center gap-1.5 text-sm cursor-pointer ${disabled ? 'text-gray-400 cursor-not-allowed' : ''}`}>
                      <input type="radio" name="modo" value={val}
                        checked={modo === val} disabled={disabled}
                        onChange={() => setModo(val as Modo)} />
                      {lbl}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {modo === 'COLABORATIVO' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                O modo colaborativo será habilitado na próxima Sprint. Utilize o modo Centralizado por enquanto.
              </div>
            )}

            {/* Tabs: Manual / Excel */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {(['MANUAL', 'EXCEL'] as const).map(t => (
                <button key={t}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t ? 'border-megag-azul text-megag-azul' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  style={tab === t ? { borderBottomColor: '#003087', color: '#003087' } : {}}
                  onClick={() => setTab(t)}
                >
                  {t === 'MANUAL' ? 'Manual' : 'Importar Excel'}
                </button>
              ))}
            </div>

            {tab === 'MANUAL' && (
              <div>
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-400 w-12">WBS</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Nome *</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-24">Nível</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-32">Tipo Fase</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-32">Tipo</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-28">Criticidade</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-36">Responsável *</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-28">Início</th>
                        <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-28">Fim</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((linha, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          {/* WBS — read-only preview calculado no cliente */}
                          <td className="px-2 py-1">
                            <span className="font-mono text-xs text-gray-400">{wbsPreview[idx]}</span>
                          </td>
                          <td className="px-2 py-1">
                            <input type="text" className="input w-full text-xs" placeholder="Nome da tarefa"
                              value={linha.nome} onChange={e => updateLinha(idx, 'nome', e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-2 flex-wrap">
                              {(['FASE', 'TAREFA'] as const).map(n => (
                                <label key={n} className="flex items-center gap-1 cursor-pointer">
                                  <input type="radio" name={`nivel_${idx}`} value={n}
                                    checked={linha.nivel === n} onChange={() => updateLinha(idx, 'nivel', n)} />
                                  <span className="text-xs">{n === 'FASE' ? 'Fase' : 'Tarefa'}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            {linha.nivel === 'FASE' ? (
                              <select
                                className="input w-full text-xs py-1"
                                value={linha.tipo_macro}
                                onChange={e => updateLinha(idx, 'tipo_macro', e.target.value)}
                              >
                                {(Object.values(MACRO_FASES) as MacroFaseConfig[]).map(f => (
                                  <option key={f.codigo} value={f.codigo}>{f.icone} {f.nome}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-300 px-2">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <select className="input w-full text-xs py-1"
                              value={linha.tipo} onChange={e => updateLinha(idx, 'tipo', e.target.value)}>
                              {tiposList.map(t => <option key={t.codigo} value={t.codigo}>{t.label}</option>)}
                              {tiposList.length === 0 && <option value="TAREFA">Tarefa</option>}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select className="input w-full text-xs py-1"
                              value={linha.criticidade} onChange={e => updateLinha(idx, 'criticidade', e.target.value)}>
                              {criticidadesList.map(c => <option key={c.codigo} value={c.codigo}>{c.label}</option>)}
                              {criticidadesList.length === 0 && <option value="NORMAL">Normal</option>}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <MultiSelectUsuario
                              value={linha._responsaveis ?? (linha.responsavel_id ? [{ id: Number(linha.responsavel_id), nome: usuarios.find(u => u.id === Number(linha.responsavel_id))?.nome ?? '' }] : [])}
                              usuarios={usuarios}
                              placeholder="Responsável *"
                              onChange={sel => updateLinhaResponsaveis(idx, sel)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input type="date" className="input w-full text-xs"
                              value={linha.data_inicio} onChange={e => updateLinha(idx, 'data_inicio', e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <input type="date" className="input w-full text-xs"
                              value={linha.data_fim} onChange={e => updateLinha(idx, 'data_fim', e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            {linhas.length > 1 && (
                              <button type="button" className="text-red-400 hover:text-red-600 text-xs"
                                onClick={() => removeLinha(idx)} title="Remover">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className="btn-secondary text-sm" onClick={addLinha}>
                    + Adicionar tarefa
                  </button>
                  <button type="button" className="btn-primary text-sm"
                    onClick={handleSalvarManual}
                    disabled={saving || modo === 'COLABORATIVO'}>
                    {saving ? 'Salvando…' : 'Salvar Cronograma'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'EXCEL' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-gray-500">
                    Utilize o modelo oficial Mega G. Baixe, preencha e importe.
                  </p>
                  <a
                    href={`/api/projetos/${projetoId}/cronograma/modelo`}
                    download
                    className="btn-secondary text-sm inline-flex items-center gap-1.5"
                  >
                    📥 Baixar Modelo
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept=".xlsx,.xls"
                    className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
                  <button type="button" className="btn-primary text-sm"
                    onClick={handleImportarExcel} disabled={importing}>
                    {importing ? 'Processando…' : 'Importar Excel'}
                  </button>
                </div>
                {importing && <p className="text-xs text-gray-400 animate-pulse">Processando arquivo…</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {!cronograma && projetoMigrado && (
        <div className="mb-4 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-blue-500 text-lg shrink-0">📋</span>
          <div>
            <p className="text-sm font-semibold text-blue-800">Este projeto foi migrado e ainda não possui cronograma cadastrado.</p>
            <p className="text-xs text-blue-700 mt-0.5">
              {canEdit
                ? 'Você pode criar um novo cronograma manualmente ou importar uma planilha Excel usando os botões acima.'
                : 'O PMO responsável deverá criar ou importar o cronograma para este projeto.'}
            </p>
          </div>
        </div>
      )}

      {!cronograma && !canEdit && !projetoMigrado && (
        <div className="card p-6 text-center text-sm text-gray-400">
          Nenhum cronograma cadastrado para este projeto.
        </div>
      )}

      {/* Modal: Importação Duplicada */}
      {/* ── Modal de Confirmação de Exclusão ──────────────────────────────── */}
      {confirmDeleteIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-600 mb-1">
              {editandoTarefas[confirmDeleteIdx]?.nivel === 'FASE'
                ? 'Tem certeza que deseja excluir esta macro atividade e todas as suas atividades filhas?'
                : 'Tem certeza que deseja excluir esta atividade?'}
            </p>
            <p className="text-xs text-gray-400 mb-5">
              <strong className="text-gray-600">{editandoTarefas[confirmDeleteIdx]?.nome || 'Sem nome'}</strong>
              {' '}· Você poderá recuperá-la clicando em Desfazer (↶ ou Ctrl+Z).
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmDeleteIdx(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
                onClick={handleConfirmarExclusao}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showDupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-2">Cronograma existente</h3>
            <p className="text-sm text-gray-600 mb-1">
              Já existe o <strong>Cronograma V{cronograma?.versao}</strong> neste projeto. Como deseja prosseguir?
            </p>
            <div className="mt-4 space-y-2">
              <button
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                onClick={() => handleDupConfirm('NOVA_VERSAO')}
              >
                <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                  Criar Nova Versão (V{(cronograma?.versao ?? 0) + 1})
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  A versão atual permanece no histórico. Recomendado.
                </p>
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-colors group"
                onClick={() => handleDupConfirm('SUBSTITUIR')}
              >
                <p className="text-sm font-medium text-gray-800 group-hover:text-amber-700">
                  Sobrepor versão atual (V{cronograma?.versao})
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Substitui as tarefas da versão atual pela planilha. Irreversível.
                </p>
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <button className="btn-ghost text-sm text-gray-400"
                onClick={() => { setShowDupModal(false); setPendingFile(null) }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Solicitar Revisão */}
      {showRevisaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-3">Solicitar Revisão</h3>
            <p className="text-sm text-gray-500 mb-4">O cronograma retornará para RASCUNHO.</p>
            <textarea className="input w-full min-h-[100px] resize-y" placeholder="Observação obrigatória…"
              value={revisaoObs} onChange={e => setRevisaoObs(e.target.value)} />
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn-secondary text-sm"
                onClick={() => { setShowRevisaoModal(false); setRevisaoObs('') }}>Cancelar</button>
              <button className="btn-primary text-sm" disabled={!revisaoObs.trim() || approving}
                onClick={handleSolicitarRevisao}>
                {approving ? 'Enviando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selecionar Fase para Nova Tarefa (RASCUNHO) */}
      {showFaseSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Selecionar Fase</h3>
            <div className="space-y-2">
              {editandoTarefas.map((t, i) => t.nivel === 'FASE' ? (
                <label key={i} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    name="fase_selector"
                    checked={faseSelecionadaIdx === i}
                    onChange={() => setFaseSelecionadaIdx(i)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-800">{t.nome || '(Fase sem nome)'}</span>
                </label>
              ) : null)}
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  name="fase_selector"
                  checked={faseSelecionadaIdx === 'sem_fase'}
                  onChange={() => setFaseSelecionadaIdx('sem_fase')}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-500 italic">Sem fase (adicionar ao final)</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setShowFaseSelector(false)}>
                Cancelar
              </button>
              <button className="btn-primary text-sm" onClick={handleConfirmarFaseSelector}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Atividade (pós-aprovação) */}
      {showNovaAtividade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold text-gray-900 mb-4">Nova Atividade</h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Fase (Macro)</label>
                <select className="input w-full" value={novaAtividade.macro_id}
                  onChange={e => setNovaAtividade(a => ({ ...a, macro_id: e.target.value }))}>
                  <option value="">— Selecione uma fase —</option>
                  {fases.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Nome da atividade *</label>
                <input type="text" className="input w-full" placeholder="Descreva a atividade"
                  value={novaAtividade.nome}
                  onChange={e => setNovaAtividade(a => ({ ...a, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Tipo</label>
                  <select className="input w-full" value={novaAtividade.tipo}
                    onChange={e => setNovaAtividade(a => ({ ...a, tipo: e.target.value }))}>
                    {tiposList.map(t => <option key={t.codigo} value={t.codigo}>{t.label}</option>)}
                    {tiposList.length === 0 && <option value="TAREFA">Tarefa</option>}
                  </select>
                </div>
                <div>
                  <label className="input-label">Criticidade</label>
                  <select className="input w-full" value={novaAtividade.criticidade}
                    onChange={e => setNovaAtividade(a => ({ ...a, criticidade: e.target.value }))}>
                    {criticidadesList.map(c => <option key={c.codigo} value={c.codigo}>{c.label}</option>)}
                    {criticidadesList.length === 0 && <option value="NORMAL">Normal</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Responsável *</label>
                  <MultiSelectUsuario
                    value={novaAtividade.responsaveis ?? []}
                    usuarios={usuarios}
                    placeholder="— Selecione —"
                    onChange={sel => setNovaAtividade(a => ({
                      ...a,
                      responsaveis: sel,
                      responsavel_id: sel[0]?.id ? String(sel[0].id) : '',
                    }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Data de início</label>
                  <input type="date" className="input w-full" value={novaAtividade.data_inicio}
                    onChange={e => setNovaAtividade(a => ({ ...a, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Data de fim</label>
                  <input type="date" className="input w-full" value={novaAtividade.data_fim}
                    onChange={e => setNovaAtividade(a => ({ ...a, data_fim: e.target.value }))} />
                </div>
              </div>
              {novaAtividade.data_inicio && novaAtividade.data_fim && (
                <p className="text-xs text-gray-500">
                  Duração calculada: {calcDuracao(novaAtividade.data_inicio, novaAtividade.data_fim) ?? '—'} dia(s)
                </p>
              )}
              <div>
                <label className="input-label">Observações</label>
                <textarea className="input w-full min-h-[60px] resize-y" placeholder="Contexto desta inclusão…"
                  value={novaAtividade.observacoes}
                  onChange={e => setNovaAtividade(a => ({ ...a, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn-secondary text-sm"
                onClick={() => { setShowNovaAtividade(false); setNovaAtividade(emptyNovaAtividade()) }}>
                Cancelar
              </button>
              <button className="btn-primary text-sm"
                disabled={!novaAtividade.nome.trim() || (!novaAtividade.responsavel_id && !novaAtividade.responsaveis?.length) || savingAtividade}
                onClick={handleSalvarNovaAtividade}>
                {savingAtividade ? 'Salvando…' : 'Salvar e Enviar Ciência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar para Aprovação */}
      <EnviarAprovacaoModal
        isOpen={showEnviarModal}
        onClose={() => setShowEnviarModal(false)}
        onConfirm={handleConfirmarWorkflow}
        sessionUser={sessionUser}
        usuarios={usuarios}
        submitting={submitting}
      />

      {/* Dialog: Esta tarefa não possui subtarefas */}
      {showSubtarefaDialog && subtarefaDialogTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-2">Subtarefas</h3>
            <p className="text-sm text-gray-600 mb-1">
              A tarefa <strong className="text-gray-800">&ldquo;{subtarefaDialogTarefa.nome}&rdquo;</strong> não possui subtarefas.
            </p>
            <p className="text-sm text-gray-500 mb-5">Deseja criá-las agora?</p>
            <div className="flex flex-col gap-2">
              <button
                className="btn-primary text-sm"
                disabled={gerandoSubtarefas}
                onClick={handleGerarSubtarefas}
              >
                {gerandoSubtarefas ? '⏳ Gerando com IA…' : '✨ Gerar automaticamente (IA)'}
              </button>
              <button
                className="btn-secondary text-sm"
                onClick={() => { setShowSubtarefaDialog(false); setShowManualSubtarefa(true) }}
              >
                Sim, adicionar manualmente
              </button>
              <button
                className="btn-ghost text-sm text-gray-500"
                onClick={() => { setShowSubtarefaDialog(false); setSubtarefaDialogTarefa(null) }}
              >
                Não, obrigado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar subtarefa manualmente */}
      {showManualSubtarefa && subtarefaDialogTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold text-gray-900 mb-1">Adicionar Subtarefa</h3>
            <p className="text-xs text-gray-400 mb-4">Tarefa pai: {subtarefaDialogTarefa.nome}</p>
            <div className="space-y-3">
              <div>
                <label className="input-label">Nome *</label>
                <input type="text" className="input w-full" placeholder="Nome da subtarefa"
                  value={novaSubtarefaForm.nome}
                  onChange={e => setNovaSubtarefaForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Descrição</label>
                <input type="text" className="input w-full" placeholder="Descrição opcional"
                  value={novaSubtarefaForm.descricao}
                  onChange={e => setNovaSubtarefaForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Responsável *</label>
                  <MultiSelectUsuario
                    value={novaSubtarefaForm.responsaveis}
                    usuarios={usuarios}
                    placeholder="— Selecione —"
                    onChange={sel => setNovaSubtarefaForm(f => ({
                      ...f,
                      responsaveis: sel,
                      responsavel_id: sel[0]?.id ? String(sel[0].id) : '',
                    }))}
                  />
                </div>
                <div>
                  <label className="input-label">Criticidade</label>
                  <select className="input w-full" value={novaSubtarefaForm.criticidade}
                    onChange={e => setNovaSubtarefaForm(f => ({ ...f, criticidade: e.target.value }))}>
                    {criticidadesList.map(c => <option key={c.codigo} value={c.codigo}>{c.label}</option>)}
                    {criticidadesList.length === 0 && <option value="NORMAL">Normal</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Data início</label>
                  <input type="date" className="input w-full" value={novaSubtarefaForm.data_inicio}
                    onChange={e => setNovaSubtarefaForm(f => ({ ...f, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Data fim</label>
                  <input type="date" className="input w-full" value={novaSubtarefaForm.data_fim}
                    onChange={e => setNovaSubtarefaForm(f => ({ ...f, data_fim: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-between">
              <button className="btn-ghost text-sm text-gray-400"
                onClick={() => { setShowManualSubtarefa(false); setSubtarefaDialogTarefa(null) }}>
                Fechar
              </button>
              <div className="flex gap-2">
                <button className="btn-secondary text-sm"
                  disabled={!novaSubtarefaForm.nome.trim() || savingSubtarefa}
                  onClick={handleSalvarManualSubtarefa}>
                  {savingSubtarefa ? 'Salvando…' : '+ Adicionar mais'}
                </button>
                <button className="btn-primary text-sm"
                  disabled={!novaSubtarefaForm.nome.trim() || savingSubtarefa}
                  onClick={async () => {
                    await handleSalvarManualSubtarefa()
                    setShowManualSubtarefa(false)
                    setSubtarefaDialogTarefa(null)
                  }}>
                  {savingSubtarefa ? 'Salvando…' : 'Salvar e fechar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Subtarefas geradas por IA */}
      {showSubtarefasGeradas && subtarefaDialogTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold text-gray-900 mb-1">Subtarefas geradas pela IA</h3>
            <p className="text-xs text-gray-400 mb-4">
              Tarefa: {subtarefaDialogTarefa.nome} · Selecione as que deseja incluir
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {subtarefasGeradas.map((s, idx) => (
                <label key={idx} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:bg-blue-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={s.selecionada}
                    onChange={e => setSubtarefasGeradas(prev =>
                      prev.map((item, i) => i === idx ? { ...item, selecionada: e.target.checked } : item)
                    )}
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      className="input w-full text-sm py-0.5"
                      value={s.nome}
                      onChange={e => setSubtarefasGeradas(prev =>
                        prev.map((item, i) => i === idx ? { ...item, nome: e.target.value } : item)
                      )}
                    />
                    {s.descricao && (
                      <p className="text-xs text-gray-400 mt-0.5 pl-1">{s.descricao}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-amber-600 mb-3">
              As subtarefas serão adicionadas sem responsável. Defina-os editando o cronograma.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm"
                onClick={() => { setShowSubtarefasGeradas(false); setSubtarefaDialogTarefa(null) }}>
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                disabled={salvandoSubtarefasGeradas || !subtarefasGeradas.some(s => s.selecionada)}
                onClick={handleSalvarSubtarefasGeradas}
              >
                {salvandoSubtarefasGeradas ? 'Salvando…' : `Adicionar ${subtarefasGeradas.filter(s => s.selecionada).length} subtarefa(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
