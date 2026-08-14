'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit, Trash2, X, Plus, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Download, FileText, Table, Presentation,
  Users, Calendar, MapPin, CheckCircle, Clock, AlertCircle,
  TrendingUp, DollarSign, BarChart2, Layers, FileCheck, History,
  Sparkles, Check, Ban, Pause, Play, Loader2, RefreshCw,
  Building2, User, Briefcase, Target, ShieldAlert, Lightbulb,
  Banknote, Tags, ScanText, Wallet, Monitor, ChevronDown, ExternalLink,
  Lock, ShieldCheck,
} from 'lucide-react'
import type { SessionUser, temPermissao as TPermissao } from '@/lib/auth'
import type {
  Comite, ComiteParticipante, ComiteProjetoItem,
  ComiteDecisao, ComitePendencia, ComiteAta, ComiteAtaHistorico,
} from '@/types'
import GravacaoAta from '@/components/projeto/GravacaoAta'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjetoResumo {
  id: number; codigo: string; nome: string; status: string; prioridade?: string
  complexidade?: string; investimento?: number; roi_previsto?: number
  data_inicio_prevista?: string; data_fim_prevista?: string
  diretoria?: string; area?: string; gerente_nome?: string
}

interface ProjetoPropostaDetalhe {
  id: number
  objetivo?: string
  beneficios?: string
  descricao?: string
  solicitante_nome?: string
  triagem_beneficios?: string
  triagem_observacoes?: string
  triagem_areas_json?: string
  riscos_iniciais?: string
  payback_meses?: number | null
  beneficios_tap?: string
  areas_envolvidas?: string
}

interface ProjetoViabilidadeDetalhe {
  id: number
  objetivo?: string
  descricao?: string
  solicitante_nome?: string
  situacao_atual?: string
  cenario_atual?: string
  beneficios_esperados?: string
  riscos_json?: string
  payback_meses?: number | null
  capex?: number | null
  opex?: number | null
  investimento_total?: number | null
}

interface ProjetoExecucaoDetalhe {
  id: number
  codigo?: string
  nome?: string
  diretoria?: string
  area?: string
  gerente_nome?: string
  data_inicio_prev?: string
  data_fim_prev?: string
  capex_aprovado?: number | null
  opex_aprovado?: number | null
  total_contratado?: number | null
  total_pago?: number | null
  capex_executado?: number | null
  opex_executado?: number | null
  economia_mensal_esperada?: number | null
  payback_informado?: number | null
  payback_meses?: number | null
  payback_unidade?: string | null
}

interface MacroTarefa {
  id: number
  cronograma_id: number
  projeto_id: number
  nome: string
  nivel?: string
  codigo?: string
  percentual?: number
  data_inicio?: string
  data_fim?: string
  data_conclusao?: string
  bloqueio?: number
  motivo_bloqueio?: string
  motivo_atraso?: string
  criticidade?: string
  observacoes?: string
  prazo_status?: string
  ordem?: number
  responsavel_nome?: string
}

interface HistoricoComite {
  id: number; titulo: string; tipo: string; data_realizacao: string
  status: string; num_projetos: number
}

interface TIAtividadeComite {
  id: number; nome: string; progresso: string; requisito: string
  responsavel: string; status: string; concluido_em: string
  inicio_dev: string; fim_dev: string
  prioridade: number | ''
  prioridade_db_id: number | null
  prioridade_confirmada: boolean
  confirmada_por_nome: string | null
  confirmada_comite_id: number | null
  solicitacao_alteracao: boolean
  solicitacao_nova_prioridade: number | null
  solicitacao_motivo: string | null
  projeto_codigo?: string; projeto_nome?: string
}

interface TITarefaCronogramaComite {
  id: number; nome: string; percentual: number
  data_inicio: string | null; data_fim: string | null; data_conclusao: string | null
  observacoes: string | null; prazo_status: string | null
  analista: string; projeto_codigo: string; projeto_nome: string
  cronograma_id: number; projeto_id: number
}

interface Props {
  comite: Comite & { criador_nome?: string }
  participantes: (ComiteParticipante & { nome_exibicao?: string })[]
  comiteProjetos: ComiteProjetoItem[]
  decisoes: ComiteDecisao[]
  pendencias: ComitePendencia[]
  ata: ComiteAta | null
  ataHistorico?: ComiteAtaHistorico[]
  todosProjetos: ProjetoResumo[]
  projetosViabilidadeDetalhe: ProjetoViabilidadeDetalhe[]
  projetosPropostaDetalhe: ProjetoPropostaDetalhe[]
  projetosExecucaoDetalhe: ProjetoExecucaoDetalhe[]
  macroTarefasExecucao: MacroTarefa[]
  usuarios: { id: number; nome: string; cargo?: string }[]
  diretorias: { id: number; nome: string }[]
  projetosLista: { id: number; codigo: string; nome: string }[]
  historico: HistoricoComite[]
  tiEmDesenvolvimento: TIAtividadeComite[]
  tiAguardandoPrioridade: TIAtividadeComite[]
  tiTarefasCronograma: TITarefaCronogramaComite[]
  comiteId: number
  session: SessionUser
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SLIDES = [
  { id: 'abertura',           label: 'Abertura',            icon: Presentation },
  { id: 'resumo',             label: 'Resumo Executivo',    icon: TrendingUp },
  { id: 'logistica',          label: 'Dir. Logística',      icon: Building2 },
  { id: 'financeira',         label: 'Dir. Financeira',     icon: Building2 },
  { id: 'comercial',          label: 'Dir. Comercial',      icon: Building2 },
  { id: 'marketing',          label: 'MKT e Novos Neg.',    icon: Building2 },
  { id: 'ti_desenvolvimento', label: 'TI – Desenvolvimento',icon: Monitor },
  { id: 'ti_prioridades',     label: 'TI – Prioridades',    icon: Target },
  { id: 'decisoes',           label: 'Decisões',            icon: CheckCircle },
  { id: 'pendencias',         label: 'Pendências',          icon: Clock },
  { id: 'ata',                label: 'Ata Automática',      icon: FileCheck },
  { id: 'historico',          label: 'Histórico',           icon: History },
] as const

type SlideId = (typeof SLIDES)[number]['id']

type CapaId =
  | 'capa_financeira' | 'capa_comercial'
  | 'capa_marketing'  | 'capa_logistica'

type AnySlideId = SlideId | CapaId

const CAPA_PARA_SLIDE: Record<CapaId, SlideId> = {
  capa_financeira: 'financeira',
  capa_comercial:  'comercial',
  capa_marketing:  'marketing',
  capa_logistica:  'logistica',
}

interface CapaConfig {
  capaId: CapaId
  titulo: string
  subtitulo: string
  rotulo?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  cor: string
}

const CAPA_CONFIGS: CapaConfig[] = [
  { capaId: 'capa_financeira', titulo: 'Diretoria Financeira',    subtitulo: 'Projetos da Diretoria Financeira',       rotulo: 'Diretoria', icon: Building2, cor: '#003087' },
  { capaId: 'capa_comercial',  titulo: 'Diretoria Comercial',     subtitulo: 'Projetos da Diretoria Comercial',        rotulo: 'Diretoria', icon: Building2, cor: '#0891B2' },
  { capaId: 'capa_marketing',  titulo: 'MKT e Novos Negócios',    subtitulo: 'Projetos de Marketing e Novos Negócios', rotulo: 'Diretoria', icon: Building2, cor: '#7C3AED' },
  { capaId: 'capa_logistica',  titulo: 'Diretoria Logística',     subtitulo: 'Projetos da Diretoria Logística',        rotulo: 'Diretoria', icon: Building2, cor: '#059669' },
]

const DIRETORIA_NOMES: Record<'financeira' | 'comercial' | 'marketing' | 'logistica', string> = {
  financeira: 'Diretoria Financeira',
  comercial:  'Diretoria Comercial',
  marketing:  'MKT e Novos Negócios',
  logistica:  'Diretoria Logística',
}

function getAnySlideLabel(id?: AnySlideId): string | undefined {
  if (!id) return undefined
  if (id in CAPA_PARA_SLIDE) return CAPA_CONFIGS.find(c => c.capaId === (id as CapaId))?.titulo
  return SLIDES.find(s => s.id === (id as SlideId))?.label
}

const STATUS_GRUPOS: Record<string, { label: string; cor: string; bg: string }> = {
  PROPOSTA:           { label: 'Proposta',       cor: 'text-slate-700',   bg: 'bg-slate-100' },
  TRIAGEM:            { label: 'Triagem',        cor: 'text-blue-700',    bg: 'bg-blue-100' },
  COMITE_IDEIAS:      { label: 'Comitê de Projetos', cor: 'text-indigo-700',  bg: 'bg-indigo-100' },
  VIABILIDADE:        { label: 'Viabilidade',    cor: 'text-purple-700',  bg: 'bg-purple-100' },
  COMPLEMENTACAO_TAP: { label: 'Compl. TAP',     cor: 'text-fuchsia-700', bg: 'bg-fuchsia-100' },
  APROVACAO:          { label: 'Aprovação',      cor: 'text-amber-700',   bg: 'bg-amber-100' },
  ESTRUTURACAO:       { label: 'Estruturação',   cor: 'text-orange-700',  bg: 'bg-orange-100' },
  CRONOGRAMA:         { label: 'Cronograma',     cor: 'text-yellow-700',  bg: 'bg-yellow-100' },
  EXECUCAO:           { label: 'Execução',       cor: 'text-emerald-700', bg: 'bg-emerald-100' },
  GOLIVE:             { label: 'Go Live',        cor: 'text-teal-700',    bg: 'bg-teal-100' },
  ROI:                { label: 'ROI',            cor: 'text-cyan-700',    bg: 'bg-cyan-100' },
  ENCERRAMENTO:       { label: 'Encerramento',   cor: 'text-green-700',   bg: 'bg-green-100' },
  CANCELADO:          { label: 'Cancelado',      cor: 'text-red-700',     bg: 'bg-red-100' },
  SUSPENSO:           { label: 'Suspenso',       cor: 'text-gray-700',    bg: 'bg-gray-200' },
}

const DECISAO_BADGE: Record<string, string> = {
  APROVADO:  'bg-green-100 text-green-700',
  REPROVADO: 'bg-red-100 text-red-700',
  PENDENTE:  'bg-amber-100 text-amber-700',
  REVISAR:   'bg-purple-100 text-purple-700',
  PAUSAR:    'bg-gray-100 text-gray-700',
  RETOMAR:   'bg-teal-100 text-teal-700',
  CANCELAR:  'bg-red-100 text-red-800',
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtR = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
const fmtDate = (s?: string) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : ''

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComiteDetalheClient({
  comite: comiteInicial, participantes: partInicial, comiteProjetos: cpInicial,
  decisoes: decInicial, pendencias: pedInicial, ata: ataInicial,
  ataHistorico: ataHistoricoInicial = [],
  todosProjetos, projetosViabilidadeDetalhe, projetosPropostaDetalhe,
  projetosExecucaoDetalhe, macroTarefasExecucao,
  usuarios, diretorias, projetosLista, historico,
  tiEmDesenvolvimento, tiAguardandoPrioridade, tiTarefasCronograma,
  comiteId, session,
}: Props) {
  const router = useRouter()
  const [comite, setComite] = useState(comiteInicial)
  const [participantes, setParticipantes] = useState(partInicial)
  const [comiteProjetos, setComiteProjetos] = useState(cpInicial)
  const [decisoes, setDecisoes] = useState(decInicial)
  const [pendencias, setPendencias] = useState(pedInicial)
  const [ata, setAta] = useState(ataInicial)
  const [ataHistorico, setAtaHistorico] = useState<ComiteAtaHistorico[]>(ataHistoricoInicial)

  const [activeSlide, setActiveSlide] = useState<AnySlideId>('abertura')
  const [presentMode, setPresentMode] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditarComite, setShowEditarComite] = useState(false)
  const [showAddProjeto, setShowAddProjeto] = useState(false)
  const [showAddDecisao, setShowAddDecisao] = useState(false)
  const [showAddPendencia, setShowAddPendencia] = useState(false)
  const [erro, setErro] = useState('')

  const podeGerenciar = ['ADMIN','PMO'].includes(session.perfil)
  const podeDirigir = podeGerenciar || session.perfil === 'DIRETOR' || session.perfil === 'CEO'

  async function refresh() {
    const res = await fetch(`/api/comites/${comite.id}`)
    if (!res.ok) return
    const data = await res.json()
    setComite(data.comite)
    setParticipantes(data.participantes)
    setComiteProjetos(data.comiteProjetos)
    setDecisoes(data.decisoes)
    setPendencias(data.pendencias)
    setAta(data.ata)
  }

  async function salvarEdicao(campo: string, valor: unknown) {
    setLoading(true)
    try {
      const res = await fetch(`/api/comites/${comite.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor }),
      })
      if (!res.ok) { const d = await res.json(); setErro(d.error || 'Erro'); return }
      await refresh()
    } finally { setLoading(false) }
  }

  async function excluirComite() {
    setLoading(true)
    try {
      const res = await fetch(`/api/comites/${comite.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setErro(d.error || 'Erro'); return }
      router.push('/comites')
    } finally { setLoading(false) }
  }


  async function exportarExcel() {
    window.location.href = `/api/comites/${comite.id}/exportar`
  }

  async function exportarPDF() {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(18)
    doc.text(`Comitê Executivo — ${comite.titulo}`, 14, 20)
    doc.setFontSize(11)
    doc.text(`Data: ${fmtDate(comite.data_realizacao)}  |  Tipo: ${comite.tipo}  |  Status: ${comite.status}`, 14, 30)

    if (comiteProjetos.length > 0) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text('Projetos Pautados', 14, 20)
      autoTable(doc, {
        startY: 28,
        head: [['Código', 'Nome', 'Diretoria', 'Status', 'Decisão']],
        body: comiteProjetos.map(p => [
          p.projeto_codigo || '', p.projeto_nome || '', p.projeto_diretoria || '',
          p.projeto_status || '', p.decisao || 'Pendente',
        ]),
      })
    }

    if (decisoes.length > 0) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text('Decisões', 14, 20)
      autoTable(doc, {
        startY: 28,
        head: [['Tipo', 'Descrição', 'Responsável', 'Prazo', 'Status']],
        body: decisoes.map(d => [d.tipo, d.descricao, d.responsavel_nome || '', d.prazo || '', d.status]),
      })
    }

    if (pendencias.length > 0) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text('Pendências', 14, 20)
      autoTable(doc, {
        startY: 28,
        head: [['Descrição', 'Projeto', 'Responsável', 'Prazo', 'Status']],
        body: pendencias.map(p => [p.descricao, p.projeto_nome || '', p.responsavel_nome || '', p.prazo || '', p.status]),
      })
    }

    const titulo = comite.titulo.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    doc.save(`comite-${titulo}.pdf`)
  }

  async function exportarPPTX() {
    window.location.href = `/api/comites/${comite.id}/exportar?formato=pptx`
  }

  // ── Grouped project stats ────────────────────────────────────────────────
  const porDiretoria = todosProjetos.reduce<Record<string, ProjetoResumo[]>>((acc, p) => {
    const dir = p.diretoria || 'Sem Diretoria'
    acc[dir] = [...(acc[dir] || []), p]
    return acc
  }, {})

  // Map de slide → lista de projetos para calcular capas
  const slideProjetosMap: Record<SlideId, ProjetoResumo[]> = {
    abertura:           [],
    resumo:             [],
    ti_desenvolvimento: [],
    ti_prioridades:     [],
    financeira: porDiretoria['Diretoria Financeira'] || [],
    comercial:  porDiretoria['Diretoria Comercial']  || [],
    marketing:  porDiretoria['MKT e Novos Negócios']  || [],
    logistica:  porDiretoria['Diretoria Logística']  || [],
    decisoes:   [],
    pendencias: [],
    ata:        [],
    historico:  [],
  }

  // Lista dinâmica de slides com capas inseridas antes de cada diretoria que tem projetos
  const computedSlides = React.useMemo(() => {
    const list: AnySlideId[] = []
    for (const slide of SLIDES) {
      list.push(slide.id)
    }
    return list
  }, [])

  const computedSlideIdx = computedSlides.indexOf(activeSlide)
  // O slide "pai" da capa ou do próprio slide (para highlight da sidebar)
  const activeMainSlideId: SlideId = (activeSlide in CAPA_PARA_SLIDE)
    ? CAPA_PARA_SLIDE[activeSlide as CapaId]
    : (activeSlide as SlideId)

  // Keyboard navigation
  useEffect(() => {
    if (!presentMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setActiveSlide(computedSlides[Math.min(computedSlideIdx + 1, computedSlides.length - 1)])
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setActiveSlide(computedSlides[Math.max(computedSlideIdx - 1, 0)])
      } else if (e.key === 'Escape') {
        setPresentMode(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [presentMode, computedSlideIdx, computedSlides])

  // ── Slide content ────────────────────────────────────────────────────────

  function renderSlide(id: AnySlideId) {
    // Capas
    if (id in CAPA_PARA_SLIDE) {
      const capaId = id as CapaId
      const cfg = CAPA_CONFIGS.find(c => c.capaId === capaId)!
      const targetSlideId = CAPA_PARA_SLIDE[capaId]
      const projsDaCapa = slideProjetosMap[targetSlideId] || []
      const diretoriasCount = new Set(projsDaCapa.map(p => p.diretoria).filter(Boolean)).size
      const nextId = computedSlides[computedSlideIdx + 1]
      return (
        <SlideCapa
          cfg={cfg}
          projetosCount={projsDaCapa.length}
          diretoriasCount={diretoriasCount}
          comiteData={comite.data_realizacao}
          onNext={nextId ? () => setActiveSlide(nextId) : undefined}
        />
      )
    }

    const slideId = id as SlideId
    switch (slideId) {
      case 'abertura': return (
        <SlideAbertura
          comite={comite}
          participantes={participantes}
          todosProjetos={todosProjetos}
          comiteProjetos={comiteProjetos}
          diretorias={diretorias}
          presentMode={presentMode}
          onIniciarApresentacao={() => setPresentMode(true)}
        />
      )
      case 'resumo': return (
        <SlideResumo
          comite={comite}
          todosProjetos={todosProjetos}
          diretorias={diretorias}
        />
      )
      case 'decisoes': return (
        <SlideDecisoes
          comiteProjetos={comiteProjetos} decisoes={decisoes}
          podeDirigir={podeDirigir} comiteId={comite.id}
          projetosLista={projetosLista}
          showAdd={showAddDecisao} setShowAdd={setShowAddDecisao}
          onRefresh={refresh}
        />
      )
      case 'financeira':
      case 'comercial':
      case 'marketing':
      case 'logistica': {
        const dirNome = DIRETORIA_NOMES[slideId as keyof typeof DIRETORIA_NOMES]
        const nextIdx = computedSlideIdx + 1
        const nextId = computedSlides[nextIdx]
        const nextLabel = nextId ? getAnySlideLabel(nextId) : undefined
        return (
          <SlideDiretoria
            key={slideId}
            diretoriaNome={dirNome}
            projetos={slideProjetosMap[slideId]}
            projetosPropostaDetalhe={projetosPropostaDetalhe}
            projetosViabilidadeDetalhe={projetosViabilidadeDetalhe}
            projetosExecucaoDetalhe={projetosExecucaoDetalhe}
            macroTarefasExecucao={macroTarefasExecucao}
            diretorias={diretorias}
            pendencias={pendencias}
            decisoes={decisoes}
            comiteId={comite.id}
            podeGerenciar={podeGerenciar}
            onRefresh={refresh}
            onNextSlide={nextId ? () => setActiveSlide(nextId) : undefined}
            nextSlideLabel={nextLabel}
            comiteData={comite.data_realizacao}
          />
        )
      }
      case 'ti_desenvolvimento': return (
        <SlideTIDesenvolvimento
          atividades={tiEmDesenvolvimento}
          tarefasCronograma={tiTarefasCronograma}
        />
      )
      case 'ti_prioridades': return (
        <SlideTIPrioridades
          atividades={tiAguardandoPrioridade}
          comiteId={comiteId}
          podeConfirmar={podeGerenciar || podeDirigir}
          onRefresh={refresh}
          session={session}
        />
      )
      case 'pendencias': return (
        <SlidePendencias
          pendencias={pendencias} podeGerenciar={podeGerenciar}
          comiteId={comite.id} projetosLista={projetosLista}
          showAdd={showAddPendencia} setShowAdd={setShowAddPendencia}
          onRefresh={refresh}
        />
      )
      case 'ata': return (
        <div>
          <h2 className="text-xl font-bold text-[#003087] mb-4">Ata Automática</h2>
          <GravacaoAta
            comiteId={comite.id}
            ata={ata}
            historico={ataHistorico}
            podeGerenciar={podeGerenciar}
            onRefresh={refresh}
          />
        </div>
      )
      case 'historico': return <SlideHistorico historico={historico} />
    }
  }

  // ─── Presentation Mode Overlay ──────────────────────────────────────────

  if (presentMode) {
    return (
      <div className="fixed inset-0 z-50 bg-[#001855] flex flex-col" style={{ fontFamily: 'inherit' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-black/30 text-white">
          <span className="text-sm opacity-70">{comite.titulo}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-50">{computedSlideIdx + 1} / {computedSlides.length}</span>
            <button onClick={() => setPresentMode(false)} className="p-1 hover:bg-white/10 rounded">
              <Minimize2 size={18} />
            </button>
          </div>
        </div>

        {/* Slide */}
        <div className="flex-1 overflow-auto bg-white mx-6 my-4 rounded-xl shadow-2xl">
          <div className="h-full p-8 overflow-auto">
            {renderSlide(activeSlide)}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => setActiveSlide(computedSlides[Math.max(computedSlideIdx - 1, 0)])}
            disabled={computedSlideIdx === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-30 transition"
          >
            <ChevronLeft size={20} /> Anterior
          </button>

          <div className="flex gap-1 flex-wrap justify-center max-w-md">
            {computedSlides.map((sid, i) => {
              const isCapa = sid in CAPA_PARA_SLIDE
              return (
                <button
                  key={sid}
                  onClick={() => setActiveSlide(sid)}
                  className={`rounded-full transition ${
                    isCapa ? 'w-1.5 h-1.5' : 'w-2 h-2'
                  } ${i === computedSlideIdx ? 'bg-yellow-400' : isCapa ? 'bg-white/20 hover:bg-white/40' : 'bg-white/30 hover:bg-white/50'}`}
                />
              )
            })}
          </div>

          <button
            onClick={() => setActiveSlide(computedSlides[Math.min(computedSlideIdx + 1, computedSlides.length - 1)])}
            disabled={computedSlideIdx === computedSlides.length - 1}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-30 transition"
          >
            Próximo <ChevronRight size={20} />
          </button>
        </div>
      </div>
    )
  }

  // ─── Normal Mode ──────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/comites')} className="btn-ghost p-2">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{comite.titulo}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Calendar size={14} />{fmtDate(comite.data_realizacao)}{comite.hora ? ` às ${comite.hora}` : ''}</span>
              {comite.local && <span className="flex items-center gap-1"><MapPin size={14} />{comite.local}</span>}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${comite.status === 'REALIZADO' ? 'bg-green-100 text-green-700' : comite.status === 'CANCELADO' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {comite.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {podeGerenciar && (
            <>
              <button onClick={() => setShowEditarComite(true)} className="btn-primary flex items-center gap-2">
                <Edit size={16} /> Editar Comitê
              </button>
              <button onClick={() => setPresentMode(true)} className="btn-secondary flex items-center gap-2">
                <Maximize2 size={16} /> Apresentar
              </button>
              <button onClick={exportarPDF} className="btn-ghost flex items-center gap-2 text-sm">
                <FileText size={15} /> PDF
              </button>
              <button onClick={exportarExcel} className="btn-ghost flex items-center gap-2 text-sm">
                <Table size={15} /> Excel
              </button>
              <button onClick={exportarPPTX} className="btn-ghost flex items-center gap-2 text-sm">
                <Download size={15} /> PPTX
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-ghost text-red-600 hover:bg-red-50 flex items-center gap-1 text-sm"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {erro}
          <button onClick={() => setErro('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Participants summary bar */}
      <div className="mb-4 flex items-center gap-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        <Users size={16} />
        <span>{participantes.length} participantes</span>
        <span>·</span>
        <span>{participantes.filter(p => p.presente).length} presentes</span>
        <span>·</span>
        <span>{comiteProjetos.length} projetos pautados</span>
        {comite.periodo_inicio && (
          <>
            <span>·</span>
            <span>Período: {fmtDate(comite.periodo_inicio)} a {fmtDate(comite.periodo_fim)}</span>
          </>
        )}
      </div>

      {/* Tab + Content layout */}
      <div className="flex gap-4" style={{ minHeight: '600px' }}>
        {/* Sidebar tabs */}
        <div className="w-48 shrink-0">
          <nav className="flex flex-col gap-0.5">
            {SLIDES.map((slide) => {
              const Icon = slide.icon
              const destino: AnySlideId = slide.id
              return (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlide(destino)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${
                    activeMainSlideId === slide.id
                      ? 'bg-[#003087] text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{slide.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 card p-6 overflow-auto">
          {renderSlide(activeSlide)}
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <Modal title="Excluir Comitê" onClose={() => setShowDeleteConfirm(false)}>
          <p className="text-sm text-gray-600 mb-4">Tem certeza? Esta ação removerá o comitê e todos os dados associados (participantes, projetos, decisões, pendências, ata).</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={excluirComite} disabled={loading} className="btn-primary bg-red-600 hover:bg-red-700">
              {loading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </Modal>
      )}

      {/* Editar Comitê */}
      {showEditarComite && (
        <EditarComiteModal
          comite={comite}
          participantes={participantes}
          usuarios={usuarios}
          diretorias={diretorias}
          isAdmin={session.perfil === 'ADMIN'}
          onClose={() => setShowEditarComite(false)}
          onSave={refresh}
        />
      )}
    </div>
  )
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Slide: Abertura ──────────────────────────────────────────────────────────

function SlideAbertura({ comite, participantes, todosProjetos, comiteProjetos, diretorias, presentMode, onIniciarApresentacao }: {
  comite: Comite & { criador_nome?: string }
  participantes: any[]
  todosProjetos: ProjetoResumo[]
  comiteProjetos: ComiteProjetoItem[]
  diretorias: any[]
  presentMode: boolean
  onIniciarApresentacao: () => void
}) {
  const AZUL     = '#003087'
  const AZUL_MED = '#0050A0'
  const OURO     = '#C9A227'
  const OURO_CLR = '#E8C84A'

  // ── KPIs ──────────────────────────────────────────────────────
  const totalProjetos     = todosProjetos.length
  const diretoriasSet     = new Set(todosProjetos.map(p => p.diretoria).filter(Boolean))
  const emExecucao        = todosProjetos.filter(p => p.status === 'EXECUCAO').length
  const exigemDecisao     = todosProjetos.filter(p => ['APROVACAO','VIABILIDADE','COMPLEMENTACAO_TAP'].includes(p.status)).length

  // ── Período formatado ──────────────────────────────────────────
  const periodoLabel = React.useMemo(() => {
    const base = comite.periodo_inicio || comite.data_realizacao
    if (!base) return ''
    // suporta YYYY-MM-DD e DD/MM/YYYY
    let iso = base
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(base)) {
      const [d, m, y] = base.split('/')
      iso = `${y}-${m}-${d}`
    }
    const dt = new Date(iso + 'T12:00:00')
    if (isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^./, c => c.toUpperCase())
  }, [comite.periodo_inicio, comite.data_realizacao])

  // ── Tipo label ────────────────────────────────────────────────
  const tipoLabel: Record<string, string> = {
    IDEIAS: 'Comitê de Projetos', PROJETOS: 'Comitê de Projetos',
    ESTRATEGICO: 'Comitê Estratégico', REVISAO: 'Comitê de Revisão',
    EXTRAORDINARIO: 'Comitê Extraordinário',
  }
  const tipoExibido = tipoLabel[comite.tipo] ?? comite.tipo

  // ── Participantes ─────────────────────────────────────────────
  const nomes = participantes
    .map(p => p.nome_exibicao || p.usuario_nome || p.nome_externo || '')
    .filter(Boolean)
  const MAX_AVATARES = 7
  const avataresMostrados = nomes.slice(0, MAX_AVATARES)
  const restantes = Math.max(0, nomes.length - MAX_AVATARES)

  function iniciais(nome: string) {
    const w = nome.trim().split(/\s+/)
    return w.length === 1 ? nome.substring(0, 2).toUpperCase()
      : (w[0][0] + w[w.length - 1][0]).toUpperCase()
  }

  const CORES_AVATAR = ['#003087','#0050A0','#1E40AF','#1D4ED8','#2563EB','#3B82F6','#60A5FA']

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{
      background: `linear-gradient(160deg, ${AZUL} 0%, ${AZUL_MED} 45%, #0066CC 100%)`,
      minHeight: presentMode ? '82vh' : '70vh',
    }}>
      {/* ── Decoração geométrica de fundo ── */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }} aria-hidden>
        <circle cx="90%" cy="10%" r="280" fill="white" />
        <circle cx="10%" cy="85%" r="200" fill="white" />
        <circle cx="50%" cy="50%" r="400" stroke="white" strokeWidth="1" fill="none" />
        <circle cx="50%" cy="50%" r="300" stroke="white" strokeWidth="0.5" fill="none" />
      </svg>

      {/* ── Faixa dourada superior ── */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${OURO}, ${OURO_CLR}, ${OURO})` }} />

      <div className="relative z-10 flex flex-col" style={{ padding: presentMode ? '3rem 3.5rem 2.5rem' : '2rem 2.5rem 2rem' }}>

        {/* ── Topo: Logo + Badge tipo ── */}
        <div className="flex items-start justify-between mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/megag/logo.png"
            alt="MegaG Alimentos"
            style={{ height: presentMode ? '72px' : '52px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            onError={(e) => {
              const t = e.currentTarget as HTMLImageElement
              t.style.display = 'none'
              const fb = document.createElement('div')
              fb.style.cssText = `font-size:${presentMode?'28':'20'}px;font-weight:900;color:white;letter-spacing:-1px`
              fb.textContent = 'MegaG'
              t.parentNode?.insertBefore(fb, t)
            }}
          />
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border"
            style={{ color: OURO_CLR, borderColor: `${OURO}80`, background: `${OURO}15` }}>
            {tipoExibido}
          </span>
        </div>

        {/* ── Título central ── */}
        <div className="text-center mb-8">
          <p className="font-semibold uppercase tracking-[0.3em] mb-2"
            style={{ color: OURO_CLR, fontSize: presentMode ? '0.85rem' : '0.7rem' }}>
            Sistema de Gestão de Projetos
          </p>
          <h1 className="font-black text-white leading-tight mb-3"
            style={{ fontSize: presentMode ? '2.6rem' : '1.8rem', textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
            COMITÊ EXECUTIVO<br />DE PROJETOS
          </h1>
          {periodoLabel && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{ background: `${OURO}25`, border: `1px solid ${OURO}60` }}>
              <Calendar size={14} style={{ color: OURO_CLR }} />
              <span className="font-semibold" style={{ color: OURO_CLR, fontSize: presentMode ? '1rem' : '0.8rem' }}>
                {periodoLabel}
              </span>
            </div>
          )}
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total de Projetos',       valor: totalProjetos,      icon: Briefcase, cor: '#60A5FA' },
            { label: 'Diretorias Participantes', valor: diretoriasSet.size, icon: Building2, cor: OURO_CLR  },
            { label: 'Em Execução',              valor: emExecucao,         icon: Play,      cor: '#34D399' },
          ].map(({ label, valor, icon: Icon, cor }) => (
            <div key={label} className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <Icon size={20} style={{ color: cor, margin: '0 auto 6px' }} />
              <p className="font-black text-white" style={{ fontSize: presentMode ? '2rem' : '1.4rem', lineHeight: 1 }}>{valor}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Info + Participantes ── */}
        <div className="grid grid-cols-5 gap-4 mb-7">

          {/* Detalhes do comitê (3 cols) */}
          <div className="col-span-3 rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: OURO_CLR }}>
              Informações da Reunião
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: OURO_CLR, flexShrink: 0 }} />
                <div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Data</p>
                  <p className="text-sm font-semibold text-white">{fmtDate(comite.data_realizacao)}</p>
                </div>
              </div>
              {comite.hora && (
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: OURO_CLR, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Horário</p>
                    <p className="text-sm font-semibold text-white">{comite.hora}</p>
                  </div>
                </div>
              )}
              {comite.local && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: OURO_CLR, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Local</p>
                    <p className="text-sm font-semibold text-white">{comite.local}</p>
                  </div>
                </div>
              )}
              {comite.criador_nome && (
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: OURO_CLR, flexShrink: 0 }} />
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>PMO Responsável</p>
                    <p className="text-sm font-semibold text-white">{comite.criador_nome}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Participantes (2 cols) */}
          <div className="col-span-2 rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: OURO_CLR }}>
              Participantes · {nomes.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {avataresMostrados.map((nome, i) => (
                <div key={i} title={nome}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: CORES_AVATAR[i % CORES_AVATAR.length], border: '2px solid rgba(255,255,255,0.2)', fontSize: '10px' }}>
                  {iniciais(nome)}
                </div>
              ))}
              {restantes > 0 && (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.2)', fontSize: '10px' }}>
                  +{restantes}
                </div>
              )}
            </div>
            {nomes.length === 0 && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum participante cadastrado.</p>
            )}
          </div>
        </div>

        {/* ── CTA Botão ── */}
        {!presentMode && (
          <div className="flex justify-center mb-6">
            <button
              onClick={onIniciarApresentacao}
              className="flex items-center gap-3 px-8 py-3.5 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${OURO}, ${OURO_CLR})`,
                color: AZUL,
                boxShadow: `0 4px 20px ${OURO}60`,
              }}>
              <Maximize2 size={18} />
              Iniciar Apresentação
            </button>
          </div>
        )}

        {/* ── Rodapé ── */}
        <div className="flex items-center justify-between pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Sistema de Gestão de Projetos · MegaG Atacadista
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>

      </div>

      {/* ── Faixa dourada inferior ── */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${OURO}, transparent)` }} />
    </div>
  )
}

// ─── Slide: Resumo Executivo — Visão Macro por Diretoria ─────────────────────

const GRUPOS_ETAPA = [
  { label: 'Proposta / Ideia',      statuses: ['PROPOSTA','TRIAGEM','COMITE_IDEIAS'],                                    cor: '#2563EB' },
  { label: 'Est. de Viabilidade',   statuses: ['VIABILIDADE','COMPLEMENTACAO_TAP','APROVACAO'],                         cor: '#7C3AED' },
  { label: 'Estruturação',          statuses: ['ESTRUTURACAO','CRONOGRAMA'],                                            cor: '#D97706' },
  { label: 'Execução',              statuses: ['EXECUCAO','GOLIVE','PROJETO_CONCLUIDO'],                                cor: '#059669' },
  { label: 'Payback',               statuses: ['ROI','PAYBACK_ACOMPANHAMENTO','PAYBACK_ENCERRADO','PROJETO_ENCERRADO'], cor: '#0891B2' },
  { label: 'Pausado',               statuses: ['PAUSADO'],                                                              cor: '#6B7280' },
]

const SIGLAS_OFICIAIS: Record<string, string> = {
  'Diretoria Financeira': 'DF',
  'Diretoria Comercial': 'DC',
  'MKT e Novos Negócios': 'DMN',
  'Diretoria Logística': 'DL',
}

function getSigla(nome: string): string {
  if (SIGLAS_OFICIAIS[nome]) return SIGLAS_OFICIAIS[nome]
  const sem = nome.replace(/^Diretoria\s+/i, '').trim()
  const words = sem.split(/\s+/)
  if (words.length === 1) return sem.substring(0, 2).toUpperCase()
  return words.map(w => w[0]).join('').substring(0, 3).toUpperCase()
}

function SlideResumo({ todosProjetos, comite, diretorias }: any) {
  const [dirSelecionada, setDirSelecionada] = React.useState<string | null>(null)

  // Filter by selected diretorias when configured
  const dirIds: number[] = React.useMemo(() => {
    try { return JSON.parse(comite?.diretorias_ids || '[]') } catch { return [] }
  }, [comite?.diretorias_ids])

  const dirNomesAtivas: Set<string> | null = React.useMemo(() => {
    if (!dirIds.length) return null
    const nomes = (diretorias as { id: number; nome: string }[])
      .filter(d => dirIds.includes(d.id))
      .map(d => d.nome)
    return new Set(nomes)
  }, [dirIds, diretorias])

  const projetosExibidos = dirNomesAtivas
    ? (todosProjetos as ProjetoResumo[]).filter(p => dirNomesAtivas.has(p.diretoria || 'Sem Diretoria'))
    : (todosProjetos as ProjetoResumo[])

  const porDiretoria = projetosExibidos.reduce<Record<string, ProjetoResumo[]>>((acc, p) => {
    const dir = p.diretoria || 'Sem Diretoria'
    acc[dir] = [...(acc[dir] || []), p]
    return acc
  }, {})
  // "projetosDirSelecionada" uses the unfiltered porDiretoria equivalent
  const porDiretoriaTodos = (todosProjetos as ProjetoResumo[]).reduce<Record<string, ProjetoResumo[]>>((acc, p) => {
    const dir = p.diretoria || 'Sem Diretoria'
    acc[dir] = [...(acc[dir] || []), p]
    return acc
  }, {})

  const dbDirNomes = (diretorias as { id: number; nome: string }[]).map(d => d.nome)
  const diretoriasOrdenadas = [
    ...dbDirNomes.filter(n => porDiretoria[n]).map(n => [n, porDiretoria[n]] as [string, ProjetoResumo[]]),
    ...Object.entries(porDiretoria).filter(([n]) => !dbDirNomes.includes(n)),
  ]
  const projetosDirSelecionada = dirSelecionada ? (porDiretoriaTodos[dirSelecionada] || []) : []

  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-5">Resumo Executivo</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {diretoriasOrdenadas.map(([dir, projs]) => {
          const cntPorStatus = projs.reduce<Record<string, number>>((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1
            return acc
          }, {})
          const sigla = getSigla(dir)

          return (
            <div
              key={dir}
              onClick={() => setDirSelecionada(dir)}
              className="bg-white rounded-xl p-5 flex flex-col cursor-pointer border border-gray-200 hover:border-[#0F3D91]/50 hover:shadow-xl shadow-sm transition-all duration-200"
            >
              {/* Card header — sigla + nome */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#E5E7EB]">
                <div className="w-12 h-12 rounded-xl bg-[#003087] flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white font-black text-base tracking-wider leading-none">{sigla}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest leading-none mb-1">{sigla}</p>
                  <h3 className="font-bold text-[#0F3D91] leading-snug" style={{ fontSize: '17px' }}>{dir}</h3>
                </div>
              </div>

              {/* Total de projetos */}
              <div className="text-center mb-4">
                <span className="font-black text-[#003087] leading-none" style={{ fontSize: '48px' }}>{projs.length}</span>
                <p className="font-semibold text-[#374151] mt-0.5" style={{ fontSize: '16px' }}>Projetos</p>
              </div>

              {/* Lista de etapas com indicador colorido */}
              <div className="space-y-2.5 flex-1">
                {GRUPOS_ETAPA.map(grupo => {
                  const count = grupo.statuses.reduce((s, st) => s + (cntPorStatus[st] || 0), 0)
                  const ativo = count > 0
                  return (
                    <div key={grupo.label} className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ativo ? grupo.cor : '#E5E7EB' }}
                      />
                      <span
                        className="flex-1 leading-snug"
                        style={{ fontSize: '15px', fontWeight: 500, color: ativo ? '#374151' : '#9CA3AF' }}
                      >
                        {grupo.label}
                      </span>
                      <span
                        className="font-bold tabular-nums shrink-0"
                        style={{ fontSize: '15px', color: ativo ? grupo.cor : '#D1D5DB' }}
                      >
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: projetos da diretoria selecionada */}
      {dirSelecionada && (
        <Modal title={dirSelecionada} onClose={() => setDirSelecionada(null)}>
          <p className="text-xs text-gray-500 mb-3">{projetosDirSelecionada.length} projeto(s) encontrado(s)</p>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {projetosDirSelecionada.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum projeto</p>
            ) : (
              projetosDirSelecionada
                .sort((a, b) => {
                  const ia = GRUPOS_ETAPA.findIndex(g => g.statuses.includes(a.status))
                  const ib = GRUPOS_ETAPA.findIndex(g => g.statuses.includes(b.status))
                  return ia - ib
                })
                .map(p => {
                  const grupo = GRUPOS_ETAPA.find(g => g.statuses.includes(p.status))
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: grupo?.cor || '#9CA3AF' }} />
                      <span className="text-xs font-mono text-gray-400 shrink-0 w-28 truncate">{p.codigo}</span>
                      <span className="text-sm text-gray-900 flex-1 truncate">{p.nome}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                        style={{ backgroundColor: (grupo?.cor || '#9CA3AF') + '18', color: grupo?.cor || '#6B7280' }}
                      >
                        {grupo?.label || STATUS_GRUPOS[p.status]?.label || p.status}
                      </span>
                    </div>
                  )
                })
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Modal: Editar Comitê ─────────────────────────────────────────────────────

const CARGOS_PARTICIPANTE = ['PRESIDENTE', 'PMO', 'DIRETOR', 'GERENTE', 'CONVIDADO']
const TIPOS_COMITE = [
  { value: 'IDEIAS',    label: 'Comitê de Projetos' },
  { value: 'APROVACAO', label: 'Aprovação' },
  { value: 'REVISAO',   label: 'Revisão' },
]

function EditarComiteModal({ comite, participantes: partInicial, usuarios, diretorias, isAdmin, onClose, onSave }: {
  comite: any; participantes: any[]; usuarios: any[]; diretorias: any[]
  isAdmin: boolean; onClose: () => void; onSave: () => void
}) {
  const isFinalizado = comite.status === 'REALIZADO' && !isAdmin

  const [aba, setAba] = useState<'basico' | 'diretorias' | 'participantes'>('basico')
  const [form, setForm] = useState({
    titulo: comite.titulo || '',
    tipo: comite.tipo || 'IDEIAS',
    data_realizacao: comite.data_realizacao || '',
    hora: comite.hora || '',
    local: comite.local || '',
    periodo_inicio: comite.periodo_inicio || '',
    periodo_fim: comite.periodo_fim || '',
    pauta: comite.pauta || '',
  })
  const [dirsSelecionadas, setDirsSelecionadas] = useState<number[]>(() => {
    try { return JSON.parse(comite.diretorias_ids || '[]') } catch { return [] }
  })
  const [parts, setParts] = useState<any[]>(partInicial)
  const [novoP, setNovoP] = useState({ usuario_id: '', nome_externo: '', cargo: 'CONVIDADO' })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function validar() {
    const e: Record<string, string> = {}
    if (!form.titulo.trim()) e.titulo = 'Nome do Comitê é obrigatório.'
    if (!form.data_realizacao) e.data_realizacao = 'Data é obrigatória.'
    return e
  }

  async function salvar() {
    const e = validar()
    if (Object.keys(e).length > 0) { setErros(e); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/comites/${comite.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, diretorias_ids: JSON.stringify(dirsSelecionadas) }),
      })
      if (!res.ok) { const d = await res.json(); setErros({ _geral: d.error || 'Erro ao salvar.' }); return }
      onSave()
      onClose()
    } finally { setLoading(false) }
  }

  async function reabrir() {
    setLoading(true)
    try {
      await fetch(`/api/comites/${comite.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'AGENDADO' }),
      })
      onSave()
      onClose()
    } finally { setLoading(false) }
  }

  async function reloadParts() {
    const r = await fetch(`/api/comites/${comite.id}/participantes`)
    const d = await r.json()
    setParts(d.participantes)
  }

  async function addParticipante() {
    if (!novoP.usuario_id && !novoP.nome_externo.trim()) return
    await fetch(`/api/comites/${comite.id}/participantes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: novoP.usuario_id ? parseInt(novoP.usuario_id) : null,
        nome_externo: novoP.nome_externo || null,
        cargo: novoP.cargo,
      }),
    })
    await reloadParts()
    setNovoP({ usuario_id: '', nome_externo: '', cargo: 'CONVIDADO' })
  }

  async function removerParticipante(id: number) {
    await fetch(`/api/comites/${comite.id}/participantes?participante_id=${id}`, { method: 'DELETE' })
    setParts(p => p.filter((x: any) => x.id !== id))
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-lg text-[#003087]">Editar Comitê</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {(['basico','diretorias','participantes'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${aba === a ? 'border-[#003087] text-[#003087]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a === 'basico' ? 'Dados Básicos' : a === 'diretorias' ? 'Diretorias' : `Participantes (${parts.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isFinalizado && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              Comitê finalizado. Somente Administradores podem editar.
              {isAdmin && (
                <button onClick={reabrir} className="ml-auto text-xs font-semibold text-[#003087] hover:underline shrink-0">
                  Reabrir
                </button>
              )}
            </div>
          )}

          {erros._geral && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erros._geral}</div>
          )}

          {/* ── Dados Básicos ── */}
          {aba === 'basico' && (
            <>
              <div>
                <label className="input-label">Nome do Comitê *</label>
                <input className={`input ${erros.titulo ? 'border-red-400' : ''}`} value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} disabled={isFinalizado} />
                {erros.titulo && <p className="text-xs text-red-500 mt-1">{erros.titulo}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Tipo *</label>
                  <select className="input" value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} disabled={isFinalizado}>
                    {TIPOS_COMITE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Local</label>
                  <input className="input" value={form.local}
                    onChange={e => setForm(f => ({ ...f, local: e.target.value }))} disabled={isFinalizado} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Data *</label>
                  <input type="date" className={`input ${erros.data_realizacao ? 'border-red-400' : ''}`}
                    value={form.data_realizacao}
                    onChange={e => setForm(f => ({ ...f, data_realizacao: e.target.value }))} disabled={isFinalizado} />
                  {erros.data_realizacao && <p className="text-xs text-red-500 mt-1">{erros.data_realizacao}</p>}
                </div>
                <div>
                  <label className="input-label">Hora</label>
                  <input type="time" className="input" value={form.hora}
                    onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} disabled={isFinalizado} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Período — Início</label>
                  <input type="date" className="input" value={form.periodo_inicio}
                    onChange={e => setForm(f => ({ ...f, periodo_inicio: e.target.value }))} disabled={isFinalizado} />
                </div>
                <div>
                  <label className="input-label">Período — Fim</label>
                  <input type="date" className="input" value={form.periodo_fim}
                    onChange={e => setForm(f => ({ ...f, periodo_fim: e.target.value }))} disabled={isFinalizado} />
                </div>
              </div>

              <div>
                <label className="input-label">Objetivo / Pauta</label>
                <textarea className="input" rows={3} value={form.pauta}
                  onChange={e => setForm(f => ({ ...f, pauta: e.target.value }))} disabled={isFinalizado} />
              </div>

            </>
          )}

          {/* ── Diretorias ── */}
          {aba === 'diretorias' && (
            <>
              <p className="text-sm text-gray-500">
                Selecione as Diretorias participantes. Quando nenhuma for selecionada, todas as Diretorias serão exibidas no Resumo Executivo.
              </p>
              <div className="space-y-2">
                {diretorias.map((dir: any) => (
                  <label key={dir.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                    <input type="checkbox" className="w-4 h-4 accent-[#003087]"
                      checked={dirsSelecionadas.includes(dir.id)}
                      disabled={isFinalizado}
                      onChange={e => {
                        if (e.target.checked) setDirsSelecionadas(d => [...d, dir.id])
                        else setDirsSelecionadas(d => d.filter(x => x !== dir.id))
                      }} />
                    <span className="text-sm font-medium text-gray-900">{dir.nome}</span>
                  </label>
                ))}
                {diretorias.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma Diretoria cadastrada.</p>
                )}
              </div>
            </>
          )}

          {/* ── Participantes ── */}
          {aba === 'participantes' && (
            <>
              {!isFinalizado && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Adicionar Participante</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Usuário do sistema</label>
                      <select className="input" value={novoP.usuario_id}
                        onChange={e => setNovoP(p => ({ ...p, usuario_id: e.target.value, nome_externo: '' }))}>
                        <option value="">— Externo —</option>
                        {usuarios.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Ou nome externo</label>
                      <input className="input" placeholder="Nome do convidado"
                        value={novoP.nome_externo}
                        onChange={e => setNovoP(p => ({ ...p, nome_externo: e.target.value, usuario_id: '' }))} />
                    </div>
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="input-label">Função</label>
                      <select className="input" value={novoP.cargo}
                        onChange={e => setNovoP(p => ({ ...p, cargo: e.target.value }))}>
                        {CARGOS_PARTICIPANTE.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={addParticipante} className="btn-primary text-sm shrink-0">
                      <Plus size={14} className="inline mr-1" /> Adicionar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {parts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum participante cadastrado.</p>
                ) : parts.map((p: any) => {
                  const nome = p.nome_exibicao || p.usuario_nome || p.nome_externo || '?'
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-[#003087] flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{nome[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
                        <p className="text-xs text-gray-500">{p.cargo || 'Sem função'}</p>
                      </div>
                      {!isFinalizado && (
                        <button onClick={() => removerParticipante(p.id)}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          {!isFinalizado && (
            <button onClick={salvar} disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Slide: Carteira por Diretoria ────────────────────────────────────────────

function SlideCarteira({ porDiretoria }: { porDiretoria: Record<string, ProjetoResumo[]> }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4">Carteira por Diretoria</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(porDiretoria).map(([dir, projs]) => {
          const porStatus = projs.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a }, {})
          const inv = projs.reduce((s, p) => s + (p.investimento || 0), 0)
          return (
            <div key={dir} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">{dir}</h3>
                <span className="text-xs text-gray-500">{projs.length} projetos</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {Object.entries(porStatus).map(([status, count]) => {
                  const s = STATUS_GRUPOS[status]
                  return s ? (
                    <span key={status} className={`px-2 py-0.5 rounded text-xs ${s.bg} ${s.cor}`}>
                      {count} {s.label}
                    </span>
                  ) : null
                })}
              </div>
              {inv > 0 && <p className="text-xs text-gray-500">Investimento: {fmtR(inv)}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Slide: Decisões ─────────────────────────────────────────────────────────

function SlideDecisoes({ comiteProjetos, decisoes, podeDirigir, comiteId, projetosLista, showAdd, setShowAdd, onRefresh }: any) {
  const [form, setForm] = useState({ tipo: 'APROVADO', descricao: '', responsavel_nome: '', prazo: '', projeto_id: '' })
  const [loading, setLoading] = useState(false)

  async function addDecisao(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/comites/${comiteId}/decisoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, projeto_id: form.projeto_id ? parseInt(form.projeto_id) : null }),
      })
      if (res.ok) { setShowAdd(false); setForm({ tipo: 'APROVADO', descricao: '', responsavel_nome: '', prazo: '', projeto_id: '' }); onRefresh() }
    } finally { setLoading(false) }
  }

  async function updateDecisaoProjeto(projetoId: number, decisao: string) {
    await fetch(`/api/comites/${comiteId}/projetos/${projetoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao }),
    })
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#003087]">Decisões</h2>
        {podeDirigir && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={14} /> Nova Decisão
          </button>
        )}
      </div>

      {comiteProjetos.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-700 mb-2 text-sm">Decisões por Projeto</h3>
          <div className="overflow-x-auto">
            <table className="table-megag">
              <thead><tr><th>Código</th><th>Projeto</th><th>Diretoria</th><th>Decisão</th><th>Observações</th></tr></thead>
              <tbody>
                {comiteProjetos.map((p: ComiteProjetoItem) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.projeto_codigo}</td>
                    <td>{p.projeto_nome}</td>
                    <td>{p.projeto_diretoria}</td>
                    <td>
                      {podeDirigir ? (
                        <select
                          value={p.decisao || ''}
                          onChange={e => updateDecisaoProjeto(p.projeto_id, e.target.value)}
                          className="input text-xs py-1 px-2"
                        >
                          <option value="">Pendente</option>
                          {Object.keys(DECISAO_BADGE).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs ${DECISAO_BADGE[p.decisao || ''] || 'bg-gray-100 text-gray-600'}`}>
                          {p.decisao || 'Pendente'}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500">{p.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {decisoes.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-700 mb-2 text-sm">Encaminhamentos Formais</h3>
          <div className="space-y-2">
            {decisoes.map((d: ComiteDecisao) => (
              <div key={d.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${DECISAO_BADGE[d.tipo] || 'bg-gray-100 text-gray-700'}`}>{d.tipo}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{d.descricao}</p>
                  {d.projeto_nome && <p className="text-xs text-gray-500 mt-0.5">Projeto: {d.projeto_nome}</p>}
                  {(d.responsavel_nome || d.prazo) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.responsavel_nome && `Resp: ${d.responsavel_nome}`}
                      {d.responsavel_nome && d.prazo && ' · '}
                      {d.prazo && `Prazo: ${fmtDate(d.prazo)}`}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${d.status === 'CUMPRIDA' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {decisoes.length === 0 && comiteProjetos.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">Nenhuma decisão registrada</p>
      )}

      {showAdd && (
        <Modal title="Nova Decisão" onClose={() => setShowAdd(false)}>
          <form onSubmit={addDecisao} className="space-y-3">
            <div>
              <label className="input-label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {['APROVADO','REPROVADO','PENDENTE','REVISAR','PAUSAR','RETOMAR','CANCELAR'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Descrição *</label>
              <textarea className="input" rows={2} required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Responsável</label>
                <input className="input" value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Prazo</label>
                <input type="date" className="input" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="input-label">Projeto (opcional)</label>
              <select className="input" value={form.projeto_id} onChange={e => setForm(f => ({ ...f, projeto_id: e.target.value }))}>
                <option value="">— Geral —</option>
                {projetosLista.map((p: any) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Slide: Atenção ───────────────────────────────────────────────────────────

function SlideAtencao({ projetos }: { projetos: ProjetoResumo[] }) {
  const atencao = projetos.filter(p => {
    if (['CANCELADO','SUSPENSO','ENCERRAMENTO'].includes(p.status)) return false
    const hoje = new Date()
    if (p.data_fim_prevista) {
      const fim = new Date(p.data_fim_prevista + 'T00:00:00')
      if (fim < hoje) return true
    }
    return p.complexidade === 'ALTA' || p.prioridade === 'CRITICA'
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4">Projetos em Atenção</h2>
      {atencao.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <p>Nenhum projeto requer atenção especial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {atencao.map(p => {
            const atrasado = p.data_fim_prevista && new Date(p.data_fim_prevista + 'T00:00:00') < new Date()
            return (
              <div key={p.id} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.codigo} — {p.nome}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.diretoria} · {STATUS_GRUPOS[p.status]?.label || p.status}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {atrasado && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Atrasado (prazo: {fmtDate(p.data_fim_prevista)})</span>}
                    {p.complexidade === 'ALTA' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Alta Complexidade</span>}
                    {p.prioridade === 'CRITICA' && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Prioridade Crítica</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Slide: Proposta / Ideia — um projeto por página com decisão ──────────────

type TipoDecisaoComite = 'APROVAR' | 'AJUSTES' | 'REJEITAR'

function parseBeneficiosList(d: ProjetoPropostaDetalhe): string[] {
  const raw = d.beneficios_tap || d.triagem_beneficios || d.beneficios || ''
  if (!raw) return []
  return raw.split(/[\n;]+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
}

function parseRiscosList(d: ProjetoPropostaDetalhe): string[] {
  const raw = d.riscos_iniciais || ''
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.map((r: any) => r.descricao || String(r)).filter(Boolean)
  } catch { /* plain text */ }
  return raw.split(/[\n;]+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
}

function getAreasEnvolvidas(p: ProjetoResumo, d: ProjetoPropostaDetalhe): string[] {
  if (d.areas_envolvidas) return d.areas_envolvidas.split(',').map(s => s.trim()).filter(Boolean)
  if (p.area) return [p.area]
  return []
}

function SlidePropostasDetalhe({
  projetos, detalhe, diretorias, comiteId, decisoes, podeGerenciar, onRefresh,
  onNextSlide, nextSlideLabel,
}: {
  projetos: ProjetoResumo[]
  detalhe: ProjetoPropostaDetalhe[]
  diretorias: { id: number; nome: string }[]
  comiteId: number
  decisoes: ComiteDecisao[]
  podeGerenciar: boolean
  onRefresh: () => Promise<void>
  onNextSlide?: () => void
  nextSlideLabel?: string
}) {
  type PropPage =
    | { kind: 'dir'; nome: string; projetos: ProjetoResumo[] }
    | { kind: 'proj'; projeto: ProjetoResumo }

  const pages = React.useMemo((): PropPage[] => {
    const dirNomes = diretorias.map(d => d.nome)
    const grouped: Record<string, ProjetoResumo[]> = {}
    for (const p of projetos) {
      const dir = p.diretoria || 'Sem Diretoria'
      grouped[dir] = grouped[dir] || []
      grouped[dir].push(p)
    }
    const orderedDirs = [
      ...dirNomes.filter(d => grouped[d]?.length),
      ...Object.keys(grouped).filter(d => !dirNomes.includes(d) && grouped[d]?.length),
    ]
    const result: PropPage[] = []
    for (const dir of orderedDirs) {
      result.push({ kind: 'dir', nome: dir, projetos: grouped[dir] })
      for (const p of grouped[dir]) result.push({ kind: 'proj', projeto: p })
    }
    return result
  }, [projetos, diretorias])

  const detalheMap = React.useMemo(() => {
    const m: Record<number, ProjetoPropostaDetalhe> = {}
    detalhe.forEach(d => { m[d.id] = d })
    return m
  }, [detalhe])

  // Decisions per project
  const decisoesMap = React.useMemo(() => {
    const m: Record<number, ComiteDecisao> = {}
    decisoes.forEach(d => { if (d.projeto_id) m[d.projeto_id] = d })
    return m
  }, [decisoes])

  const [currentIdx, setCurrentIdx] = useState(0)
  const [modalTipo, setModalTipo] = useState<TipoDecisaoComite | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [obsComite, setObsComite] = useState('')
  const [saving, setSaving] = useState(false)
  const [erroModal, setErroModal] = useState('')

  // Keyboard navigation — capture phase so it runs before the main slide handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modalTipo) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      if (e.key === 'ArrowRight') {
        e.stopPropagation()
        if (currentIdx >= pages.length - 1) { onNextSlide?.() } else { setCurrentIdx(i => i + 1) }
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation()
        setCurrentIdx(i => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [modalTipo, pages.length, currentIdx, onNextSlide])

  if (projetos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="w-3 h-3 rounded-full bg-[#2563EB]" />
        <p className="text-gray-400 text-sm">Nenhum projeto em Proposta / Ideia</p>
      </div>
    )
  }

  const safeIdx = Math.min(currentIdx, pages.length - 1)
  const page = pages[safeIdx]
  const COR_PROP = '#2563EB'

  if (page.kind === 'dir') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COR_PROP}15`, border: `1px solid ${COR_PROP}30` }}>
              <Lightbulb size={16} style={{ color: COR_PROP }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: COR_PROP }}>Proposta / Ideia</p>
              <p className="text-xs text-gray-500">{projetos.length} projetos · {pages.filter(p => p.kind === 'dir').length} diretorias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-600">{safeIdx + 1} / {pages.length}</span>
            <button onClick={() => setCurrentIdx(Math.min(pages.length - 1, safeIdx + 1))} disabled={safeIdx === pages.length - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {pages.length > 1 && (
          <div className="flex gap-1 justify-center mb-2 flex-wrap">
            {pages.map((p, i) => (
              <button key={i} onClick={() => setCurrentIdx(i)} className="rounded-full transition"
                style={{ width: i === safeIdx ? '20px' : p.kind === 'dir' ? '10px' : '8px', height: p.kind === 'dir' ? '10px' : '8px', background: i === safeIdx ? COR_PROP : p.kind === 'dir' ? '#6B7280' : '#D1D5DB' }} />
            ))}
          </div>
        )}
        <div className="relative flex flex-col items-center justify-center min-h-[480px] rounded-2xl"
          style={{ background: `${COR_PROP}08`, border: `2px solid ${COR_PROP}25` }}>
          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={{ background: COR_PROP }} />
          <div className="flex flex-col items-center gap-5 px-8 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: `${COR_PROP}18`, border: `2px solid ${COR_PROP}40` }}>
              <Lightbulb size={40} style={{ color: COR_PROP }} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: COR_PROP }}>Proposta / Ideia</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{getSigla(page.nome)}</p>
              <h2 className="font-black text-gray-900 leading-tight" style={{ fontSize: '32px' }}>{page.nome}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black" style={{ fontSize: '52px', color: COR_PROP, lineHeight: 1 }}>{page.projetos.length}</span>
              <span className="text-lg font-medium text-gray-500 text-left leading-snug">
                {page.projetos.length === 1 ? 'Projeto em\nProposta' : 'Projetos em\nProposta'}
              </span>
            </div>
            <div className="w-full max-w-sm space-y-1.5 mt-1">
              {page.projetos.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-gray-600 px-3 py-1.5 rounded-lg bg-white/60">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.prioridade === 'ALTA' ? 'bg-red-400' : p.prioridade === 'MEDIA' ? 'bg-amber-400' : 'bg-green-400'}`} />
                  <span className="truncate font-medium">{p.nome}</span>
                  {p.prioridade && <span className="ml-auto text-xs text-gray-400 shrink-0">{p.prioridade}</span>}
                </div>
              ))}
            </div>
            <button onClick={() => setCurrentIdx(safeIdx + 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md hover:opacity-90 transition"
              style={{ background: COR_PROP }}>
              Ver Projetos <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const proj = page.projeto
  const d = detalheMap[proj.id] || {} as ProjetoPropostaDetalhe
  const decisaoExistente = decisoesMap[proj.id]
  const beneficios = parseBeneficiosList(d)
  const riscos = parseRiscosList(d)
  const areas = getAreasEnvolvidas(proj, d)
  const payback = d.payback_meses

  const currentDir = proj.diretoria || 'Sem Diretoria'
  const projsDirPage = pages.find(p => p.kind === 'dir' && p.nome === currentDir) as { kind: 'dir'; nome: string; projetos: ProjetoResumo[] } | undefined
  const idxWithinDir = projsDirPage ? projsDirPage.projetos.findIndex(p => p.id === proj.id) + 1 : 1
  const dirCount = projsDirPage ? projsDirPage.projetos.length : 1

  function abrirModal(tipo: TipoDecisaoComite) {
    setModalTipo(tipo)
    setJustificativa('')
    setObsComite('')
    setErroModal('')
  }

  async function registrarDecisao() {
    if (!modalTipo) return
    const precisaJustificativa = modalTipo === 'AJUSTES' || modalTipo === 'REJEITAR'
    if (precisaJustificativa && !justificativa.trim()) {
      setErroModal('Justificativa é obrigatória.')
      return
    }
    setSaving(true)
    setErroModal('')

    try {
      const tipoDecisao = modalTipo === 'APROVAR' ? 'APROVADO' : modalTipo === 'REJEITAR' ? 'REPROVADO' : 'REVISAR'
      const descDecisao = modalTipo === 'APROVAR'
        ? `Proposta aprovada para Estudo de Viabilidade.${obsComite ? ` ${obsComite}` : ''}`
        : modalTipo === 'AJUSTES'
          ? `Ajustes solicitados: ${justificativa}${obsComite ? `. ${obsComite}` : ''}`
          : `Proposta rejeitada: ${justificativa}${obsComite ? `. ${obsComite}` : ''}`

      // 1. Register decision in comitê
      const resDecisao = await fetch(`/api/comites/${comiteId}/decisoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto_id: proj.id, tipo: tipoDecisao, descricao: descDecisao }),
      })
      if (!resDecisao.ok) { setErroModal('Erro ao registrar decisão.'); setSaving(false); return }

      // 2. Change project status
      if (modalTipo === 'APROVAR') {
        await fetch(`/api/projetos/${proj.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'VIABILIDADE', motivo: descDecisao }),
        })
      } else if (modalTipo === 'REJEITAR') {
        await fetch(`/api/projetos/${proj.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELADO', motivo: justificativa }),
        })
      }

      // 3. Create pendência for "Solicitar Ajustes"
      if (modalTipo === 'AJUSTES') {
        await fetch(`/api/comites/${comiteId}/pendencias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projeto_id: proj.id,
            descricao: `Ajustes solicitados na proposta: ${justificativa}`,
            responsavel_nome: d.solicitante_nome || '',
          }),
        })
      }

      setModalTipo(null)
      await onRefresh()

      // Auto-advance to next page
      if (currentIdx < pages.length - 1) {
        setTimeout(() => setCurrentIdx(i => i + 1), 350)
      }
    } finally {
      setSaving(false)
    }
  }

  const DECISAO_CONFIG = {
    APROVADO:  { label: 'Aprovado para Viabilidade', bg: 'bg-green-50', border: 'border-green-200', cor: 'text-green-700', dot: 'bg-green-500' },
    REPROVADO: { label: 'Proposta Rejeitada',         bg: 'bg-red-50',   border: 'border-red-200',   cor: 'text-red-700',   dot: 'bg-red-500' },
    REVISAR:   { label: 'Ajustes Solicitados',        bg: 'bg-amber-50', border: 'border-amber-200', cor: 'text-amber-700', dot: 'bg-amber-500' },
  } as const

  return (
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb (contexto) ── */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
        <span className="font-semibold text-[#003087]">Proposta / Ideia</span>
        <span className="text-gray-300">›</span>
        <span>{currentDir}</span>
        <span className="text-gray-300">›</span>
        <span>{idxWithinDir} de {dirCount}</span>
      </div>

      {/* ── Navigation bar ── */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        {/* Anterior */}
        {safeIdx === 0 ? (
          <div className="w-36 flex-shrink-0" />
        ) : (
          <button
            onClick={() => setCurrentIdx(i => i - 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[#003087] hover:bg-white rounded-lg transition-colors flex-shrink-0"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
        )}

        {/* Indicador central */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">
            {safeIdx + 1} / {pages.length}
          </span>
          <div className="flex gap-1 flex-wrap justify-center">
            {pages.map((p, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                title={p.kind === 'proj' ? p.projeto.nome : p.nome}
                className={`rounded-full transition-all ${
                  i === safeIdx ? 'scale-125' : ''
                }`}
                style={{
                  width: p.kind === 'dir' ? '10px' : '8px',
                  height: p.kind === 'dir' ? '10px' : '8px',
                  background: i === safeIdx ? COR_PROP : p.kind === 'dir' ? '#6B7280' : p.kind === 'proj' && decisoesMap[p.projeto.id] ? '#4ade80' : '#D1D5DB',
                }}
              />
            ))}
          </div>
        </div>

        {/* Próximo / Avançar / Finalizar */}
        {safeIdx < pages.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => i + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[#003087] hover:bg-white rounded-lg transition-colors flex-shrink-0"
          >
            Próximo <ChevronRight size={16} />
          </button>
        ) : onNextSlide ? (
          <button
            onClick={onNextSlide}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-[#003087] hover:bg-[#002060] rounded-lg transition-colors flex-shrink-0 shadow-sm"
          >
            {nextSlideLabel ? `Avançar para ${nextSlideLabel}` : 'Próxima Etapa'} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => {/* last slide — do nothing, presentation ends */}}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex-shrink-0 shadow-sm"
          >
            <Check size={16} /> Finalizar Apresentação
          </button>
        )}
      </div>

      {/* ── Project header ── */}
      <div className="border-b border-gray-100 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#003087] leading-tight">{proj.nome}</h2>
            <div className="font-mono text-xs text-gray-400 mt-1">{proj.codigo}</div>
          </div>
          <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_GRUPOS[proj.status]?.bg || 'bg-gray-100'} ${STATUS_GRUPOS[proj.status]?.cor || 'text-gray-700'}`}>
            {STATUS_GRUPOS[proj.status]?.label || proj.status}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { icon: Building2, label: 'Diretoria',         value: proj.diretoria },
            { icon: Layers,    label: 'Área',              value: proj.area },
            { icon: User,      label: 'Solicitante',       value: d.solicitante_nome },
            { icon: Briefcase, label: 'Gerente do Projeto',value: proj.gerente_nome },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#003087]/5 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-[#003087]" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">{label}</div>
                <div className="text-sm font-semibold text-gray-800 leading-snug truncate">{value || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Info cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Objetivo */}
        <div className="col-span-full bg-white rounded-xl border border-gray-100 border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3">
            <Target size={13} className="flex-shrink-0" /><span>Objetivo</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{d.objetivo || <span className="italic text-gray-400">Não informado.</span>}</p>
          {d.descricao && d.descricao !== d.objetivo && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{d.descricao}</p>
          )}
        </div>

        {/* Benefícios */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-green-500 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-600 mb-3">
            <Lightbulb size={13} className="flex-shrink-0" /><span>Benefícios Esperados</span>
          </div>
          {beneficios.length > 0 ? (
            <ul className="space-y-2">
              {beneficios.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* Riscos */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-red-400 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-500 mb-3">
            <ShieldAlert size={13} className="flex-shrink-0" /><span>Principais Riscos</span>
          </div>
          {riscos.length > 0 ? (
            <ul className="space-y-2">
              {riscos.slice(0, 4).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400 italic">Nenhum risco informado.</p>}
        </div>

        {/* Payback */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-blue-400 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-500 mb-3">
            <TrendingUp size={13} className="flex-shrink-0" /><span>Payback Estimado</span>
          </div>
          {payback != null && payback > 0 ? (
            <div>
              <p className="text-2xl font-black text-[#003087]">
                {payback < 12 ? `${payback} meses` : `${(payback / 12).toFixed(1).replace('.', ',')} anos`}
              </p>
              {payback >= 12 && <p className="text-xs text-gray-400 mt-0.5">{payback} meses</p>}
            </div>
          ) : <p className="text-sm text-gray-400 italic">A definir no Estudo de Viabilidade.</p>}
        </div>

        {/* Áreas Envolvidas */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-blue-300 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-500 mb-3">
            <Tags size={13} className="flex-shrink-0" /><span>Áreas Envolvidas</span>
          </div>
          {areas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-medium">{a}</span>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* Observações */}
        {d.triagem_observacoes && (
          <div className="col-span-full bg-gray-50 rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              <ScanText size={13} className="flex-shrink-0" /><span>Observações do Solicitante</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-600 italic leading-relaxed">&quot;{d.triagem_observacoes}&quot;</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Decisão já registrada ── */}
      {decisaoExistente && (() => {
        const cfg = DECISAO_CONFIG[decisaoExistente.tipo as keyof typeof DECISAO_CONFIG]
        return cfg ? (
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${cfg.bg} ${cfg.border}`}>
            <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div>
              <div className={`font-semibold text-sm ${cfg.cor}`}>{cfg.label}</div>
              {decisaoExistente.descricao && <p className="text-sm text-gray-600 mt-1">{decisaoExistente.descricao}</p>}
            </div>
          </div>
        ) : null
      })()}

      {/* ── Painel de Decisão ── */}
      {podeGerenciar && (
        <div className="rounded-xl border border-[#003087]/15 bg-gradient-to-br from-[#003087]/5 via-white to-blue-50/30 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#003087] flex items-center justify-center flex-shrink-0">
              <CheckCircle size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[#003087] uppercase tracking-wide">Decisão do Comitê</span>
          </div>
          {decisaoExistente && (
            <p className="text-xs text-gray-400 italic mb-3">Decisão já registrada. Registre abaixo para atualizar.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => abrirModal('APROVAR')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <Check size={15} /> Aprovar para Estudo de Viabilidade
            </button>
            <button onClick={() => abrirModal('AJUSTES')} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <RefreshCw size={15} /> Solicitar Ajustes
            </button>
            <button onClick={() => abrirModal('REJEITAR')} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <Ban size={15} /> Rejeitar Proposta
            </button>
            <button
              disabled={saving}
              onClick={async () => {
                if (!confirm('Pausar este projeto por decisão do Comitê? O projeto poderá ser retomado posteriormente.')) return
                setSaving(true)
                try {
                  await fetch(`/api/comites/${comiteId}/decisoes`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projeto_id: proj.id, tipo: 'SUSPENSO', descricao: 'Projeto pausado por decisão do Comitê' }),
                  })
                  await fetch(`/api/projetos/${proj.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'PAUSADO', motivo: 'Projeto pausado por decisão do Comitê' }),
                  })
                  await onRefresh()
                } finally { setSaving(false) }
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              ⏸ Pausar Projeto
            </button>
          </div>
        </div>
      )}


      {/* ── Decision Modal ── */}
      {modalTipo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal header */}
            <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between ${
              modalTipo === 'APROVAR' ? 'bg-green-600' : modalTipo === 'REJEITAR' ? 'bg-red-600' : 'bg-amber-500'
            }`}>
              <div>
                <div className="text-white font-bold text-base">
                  {modalTipo === 'APROVAR' ? '✓ Aprovar para Estudo de Viabilidade'
                    : modalTipo === 'AJUSTES' ? '↺ Solicitar Ajustes'
                    : '✕ Rejeitar Proposta'}
                </div>
                <div className="text-white/80 text-xs mt-0.5">{proj.nome}</div>
              </div>
              <button onClick={() => setModalTipo(null)} className="text-white/70 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Justificativa */}
              {(modalTipo === 'AJUSTES' || modalTipo === 'REJEITAR') && (
                <div>
                  <label className="input-label">
                    Justificativa <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className={`input ${erroModal ? 'border-red-400' : ''}`}
                    rows={3}
                    placeholder={modalTipo === 'AJUSTES' ? 'Descreva os ajustes necessários...' : 'Justifique a rejeição...'}
                    value={justificativa}
                    onChange={e => { setJustificativa(e.target.value); setErroModal('') }}
                  />
                  {erroModal && <p className="text-xs text-red-500 mt-1">{erroModal}</p>}
                </div>
              )}

              {/* Observações do Comitê */}
              <div>
                <label className="input-label">Observações do Comitê</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Observações adicionais (opcional)..."
                  value={obsComite}
                  onChange={e => setObsComite(e.target.value)}
                />
              </div>

              {/* Confirmação */}
              {modalTipo === 'APROVAR' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  O status do projeto será alterado para <strong>Estudo de Viabilidade</strong> e a decisão será registrada na Ata do Comitê.
                </div>
              )}
              {modalTipo === 'REJEITAR' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  O status do projeto será alterado para <strong>Cancelado</strong>. Esta ação não pode ser desfeita facilmente.
                </div>
              )}
              {modalTipo === 'AJUSTES' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  O projeto permanece em <strong>Proposta / Ideia</strong> e uma pendência será criada para o solicitante.
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button onClick={() => setModalTipo(null)} className="btn-ghost" disabled={saving}>Cancelar</button>
              <button
                onClick={registrarDecisao}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm text-white transition-colors disabled:opacity-60 ${
                  modalTipo === 'APROVAR' ? 'bg-green-600 hover:bg-green-700'
                    : modalTipo === 'REJEITAR' ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {modalTipo === 'APROVAR' ? 'Confirmar Aprovação' : modalTipo === 'REJEITAR' ? 'Confirmar Rejeição' : 'Confirmar Ajustes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Slide: Estudo de Viabilidade — um projeto por página com decisão ────────

function parseRiscosViabilidade(riscos_json?: string): string[] {
  if (!riscos_json) return []
  try {
    const arr = JSON.parse(riscos_json)
    if (Array.isArray(arr)) return arr.map((r: any) => r.descricao || String(r)).filter(Boolean)
  } catch { /* plain text */ }
  return riscos_json.split(/[\n;]+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
}

function parseBeneficiosViabilidade(raw?: string): string[] {
  if (!raw) return []
  return raw.split(/[\n;]+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
}

function SlideViabilidadeDetalhe({
  projetos, detalhe, diretorias, comiteId, decisoes, podeGerenciar, onRefresh,
  onNextSlide, nextSlideLabel,
}: {
  projetos: ProjetoResumo[]
  detalhe: ProjetoViabilidadeDetalhe[]
  diretorias: { id: number; nome: string }[]
  comiteId: number
  decisoes: ComiteDecisao[]
  podeGerenciar: boolean
  onRefresh: () => Promise<void>
  onNextSlide?: () => void
  nextSlideLabel?: string
}) {
  type ViaPage =
    | { kind: 'dir'; nome: string; projetos: ProjetoResumo[] }
    | { kind: 'proj'; projeto: ProjetoResumo }

  const pages = React.useMemo((): ViaPage[] => {
    const dirNomes = diretorias.map(d => d.nome)
    const grouped: Record<string, ProjetoResumo[]> = {}
    for (const p of projetos) {
      const dir = p.diretoria || 'Sem Diretoria'
      grouped[dir] = grouped[dir] || []
      grouped[dir].push(p)
    }
    const orderedDirs = [
      ...dirNomes.filter(d => grouped[d]?.length),
      ...Object.keys(grouped).filter(d => !dirNomes.includes(d) && grouped[d]?.length),
    ]
    const result: ViaPage[] = []
    for (const dir of orderedDirs) {
      result.push({ kind: 'dir', nome: dir, projetos: grouped[dir] })
      for (const p of grouped[dir]) result.push({ kind: 'proj', projeto: p })
    }
    return result
  }, [projetos, diretorias])

  const detalheMap = React.useMemo(() => {
    const m: Record<number, ProjetoViabilidadeDetalhe> = {}
    detalhe.forEach(d => { m[d.id] = d })
    return m
  }, [detalhe])

  const decisoesMap = React.useMemo(() => {
    const m: Record<number, ComiteDecisao> = {}
    decisoes.forEach(d => { if (d.projeto_id) m[d.projeto_id] = d })
    return m
  }, [decisoes])

  const [currentIdx, setCurrentIdx] = useState(0)
  const [modalTipo, setModalTipo] = useState<TipoDecisaoComite | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [obsComite, setObsComite] = useState('')
  const [saving, setSaving] = useState(false)
  const [erroModal, setErroModal] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modalTipo) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      if (e.key === 'ArrowRight') { e.stopPropagation(); if (currentIdx >= pages.length - 1) { onNextSlide?.() } else { setCurrentIdx(i => i + 1) } }
      else if (e.key === 'ArrowLeft') { e.stopPropagation(); setCurrentIdx(i => Math.max(0, i - 1)) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [modalTipo, pages.length, currentIdx, onNextSlide])

  if (projetos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="w-3 h-3 rounded-full bg-[#7C3AED]" />
        <p className="text-gray-400 text-sm">Nenhum projeto em Estudo de Viabilidade</p>
      </div>
    )
  }

  const safeIdx = Math.min(currentIdx, pages.length - 1)
  const page = pages[safeIdx]
  const COR_VIA = '#7C3AED'

  if (page.kind === 'dir') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COR_VIA}15`, border: `1px solid ${COR_VIA}30` }}>
              <Layers size={16} style={{ color: COR_VIA }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: COR_VIA }}>Estudo de Viabilidade</p>
              <p className="text-xs text-gray-500">{projetos.length} projetos · {pages.filter(p => p.kind === 'dir').length} diretorias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-600">{safeIdx + 1} / {pages.length}</span>
            <button onClick={() => setCurrentIdx(Math.min(pages.length - 1, safeIdx + 1))} disabled={safeIdx === pages.length - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {pages.length > 1 && (
          <div className="flex gap-1 justify-center mb-2 flex-wrap">
            {pages.map((p, i) => (
              <button key={i} onClick={() => setCurrentIdx(i)} className="rounded-full transition"
                style={{ width: i === safeIdx ? '20px' : p.kind === 'dir' ? '10px' : '8px', height: p.kind === 'dir' ? '10px' : '8px', background: i === safeIdx ? COR_VIA : p.kind === 'dir' ? '#6B7280' : '#D1D5DB' }} />
            ))}
          </div>
        )}
        <div className="relative flex flex-col items-center justify-center min-h-[480px] rounded-2xl"
          style={{ background: `${COR_VIA}08`, border: `2px solid ${COR_VIA}25` }}>
          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={{ background: COR_VIA }} />
          <div className="flex flex-col items-center gap-5 px-8 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: `${COR_VIA}18`, border: `2px solid ${COR_VIA}40` }}>
              <Layers size={40} style={{ color: COR_VIA }} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: COR_VIA }}>Estudo de Viabilidade</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{getSigla(page.nome)}</p>
              <h2 className="font-black text-gray-900 leading-tight" style={{ fontSize: '32px' }}>{page.nome}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black" style={{ fontSize: '52px', color: COR_VIA, lineHeight: 1 }}>{page.projetos.length}</span>
              <span className="text-lg font-medium text-gray-500 text-left leading-snug">
                {page.projetos.length === 1 ? 'Projeto em\nViabilidade' : 'Projetos em\nViabilidade'}
              </span>
            </div>
            <div className="w-full max-w-sm space-y-1.5 mt-1">
              {page.projetos.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-gray-600 px-3 py-1.5 rounded-lg bg-white/60">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.prioridade === 'ALTA' ? 'bg-red-400' : p.prioridade === 'MEDIA' ? 'bg-amber-400' : 'bg-green-400'}`} />
                  <span className="truncate font-medium">{p.nome}</span>
                  {p.prioridade && <span className="ml-auto text-xs text-gray-400 shrink-0">{p.prioridade}</span>}
                </div>
              ))}
            </div>
            <button onClick={() => setCurrentIdx(safeIdx + 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md hover:opacity-90 transition"
              style={{ background: COR_VIA }}>
              Ver Projetos <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const proj = page.projeto
  const d = detalheMap[proj.id] || {} as ProjetoViabilidadeDetalhe
  const decisaoExistente = decisoesMap[proj.id]
  const beneficios = parseBeneficiosViabilidade(d.beneficios_esperados)
  const riscos = parseRiscosViabilidade(d.riscos_json)
  const cenario = d.cenario_atual || d.situacao_atual || d.objetivo || d.descricao
  const capex = d.capex ?? 0
  const opex = d.opex ?? 0
  const invTotal = d.investimento_total ?? (capex + opex)

  const currentDir = proj.diretoria || 'Sem Diretoria'
  const projsDirPageVia = pages.find(p => p.kind === 'dir' && p.nome === currentDir) as { kind: 'dir'; nome: string; projetos: ProjetoResumo[] } | undefined
  const idxWithinDir = projsDirPageVia ? projsDirPageVia.projetos.findIndex(p => p.id === proj.id) + 1 : 1
  const dirCount = projsDirPageVia ? projsDirPageVia.projetos.length : 1

  function abrirModal(tipo: TipoDecisaoComite) {
    setModalTipo(tipo)
    setJustificativa('')
    setObsComite('')
    setErroModal('')
  }

  async function registrarDecisao() {
    if (!modalTipo) return
    const precisaJustificativa = modalTipo === 'AJUSTES' || modalTipo === 'REJEITAR'
    if (precisaJustificativa && !justificativa.trim()) { setErroModal('Justificativa é obrigatória.'); return }
    setSaving(true)
    setErroModal('')
    try {
      const tipoDecisao = modalTipo === 'APROVAR' ? 'APROVADO' : modalTipo === 'REJEITAR' ? 'REPROVADO' : 'REVISAR'
      const descDecisao = modalTipo === 'APROVAR'
        ? `Viabilidade aprovada para Estruturação.${obsComite ? ` ${obsComite}` : ''}`
        : modalTipo === 'AJUSTES'
          ? `Ajustes solicitados na viabilidade: ${justificativa}${obsComite ? `. ${obsComite}` : ''}`
          : `Viabilidade reprovada: ${justificativa}${obsComite ? `. ${obsComite}` : ''}`

      const resDecisao = await fetch(`/api/comites/${comiteId}/decisoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto_id: proj.id, tipo: tipoDecisao, descricao: descDecisao }),
      })
      if (!resDecisao.ok) { setErroModal('Erro ao registrar decisão.'); setSaving(false); return }

      if (modalTipo === 'APROVAR') {
        await fetch(`/api/projetos/${proj.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ESTRUTURACAO', motivo: descDecisao }),
        })
      } else if (modalTipo === 'REJEITAR') {
        await fetch(`/api/projetos/${proj.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELADO', motivo: justificativa }),
        })
      }

      if (modalTipo === 'AJUSTES') {
        await fetch(`/api/comites/${comiteId}/pendencias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projeto_id: proj.id,
            descricao: `Ajustes solicitados na viabilidade: ${justificativa}`,
            responsavel_nome: d.solicitante_nome || '',
          }),
        })
      }

      setModalTipo(null)
      await onRefresh()
      if (currentIdx < pages.length - 1) setTimeout(() => setCurrentIdx(i => i + 1), 350)
    } finally { setSaving(false) }
  }

  const DECISAO_CONFIG_VIA = {
    APROVADO:  { label: 'Aprovado para Estruturação', bg: 'bg-green-50', border: 'border-green-200', cor: 'text-green-700', dot: 'bg-green-500' },
    REPROVADO: { label: 'Viabilidade Reprovada',      bg: 'bg-red-50',   border: 'border-red-200',   cor: 'text-red-700',   dot: 'bg-red-500' },
    REVISAR:   { label: 'Ajustes Solicitados',         bg: 'bg-amber-50', border: 'border-amber-200', cor: 'text-amber-700', dot: 'bg-amber-500' },
  } as const

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
        <span className="font-semibold text-[#003087]">Estudo de Viabilidade</span>
        <span className="text-gray-300">›</span>
        <span>{currentDir}</span>
        <span className="text-gray-300">›</span>
        <span>{idxWithinDir} de {dirCount}</span>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        {safeIdx === 0 ? (
          <div className="w-36 flex-shrink-0" />
        ) : (
          <button
            onClick={() => setCurrentIdx(i => i - 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[#003087] hover:bg-white rounded-lg transition-colors flex-shrink-0"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
        )}

        <div className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">{safeIdx + 1} / {pages.length}</span>
          <div className="flex gap-1 flex-wrap justify-center">
            {pages.map((p, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                title={p.kind === 'proj' ? p.projeto.nome : p.nome}
                className={`rounded-full transition-all ${i === safeIdx ? 'scale-125' : ''}`}
                style={{
                  width: p.kind === 'dir' ? '10px' : '8px',
                  height: p.kind === 'dir' ? '10px' : '8px',
                  background: i === safeIdx ? COR_VIA : p.kind === 'dir' ? '#6B7280' : p.kind === 'proj' && decisoesMap[p.projeto.id] ? '#4ade80' : '#D1D5DB',
                }}
              />
            ))}
          </div>
        </div>

        {safeIdx < pages.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => i + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[#003087] hover:bg-white rounded-lg transition-colors flex-shrink-0"
          >
            Próximo <ChevronRight size={16} />
          </button>
        ) : onNextSlide ? (
          <button
            onClick={onNextSlide}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-[#003087] hover:bg-[#002060] rounded-lg transition-colors flex-shrink-0 shadow-sm"
          >
            {nextSlideLabel ? `Avançar para ${nextSlideLabel}` : 'Próxima Etapa'} <ChevronRight size={16} />
          </button>
        ) : (
          <button className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex-shrink-0 shadow-sm">
            <Check size={16} /> Finalizar Apresentação
          </button>
        )}
      </div>

      {/* Project header */}
      <div className="border-b border-gray-100 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#003087] leading-tight">{proj.nome}</h2>
            <div className="font-mono text-xs text-gray-400 mt-1">{proj.codigo}</div>
          </div>
          <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_GRUPOS[proj.status]?.bg || 'bg-gray-100'} ${STATUS_GRUPOS[proj.status]?.cor || 'text-gray-700'}`}>
            {STATUS_GRUPOS[proj.status]?.label || proj.status}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { icon: Building2, label: 'Diretoria',          value: proj.diretoria },
            { icon: Layers,    label: 'Área',               value: proj.area },
            { icon: User,      label: 'Solicitante',        value: d.solicitante_nome },
            { icon: Briefcase, label: 'Gerente do Projeto', value: proj.gerente_nome },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#003087]/5 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-[#003087]" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">{label}</div>
                <div className="text-sm font-semibold text-gray-800 leading-snug truncate">{value || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cenário Atual */}
        <div className="col-span-full bg-white rounded-xl border border-gray-100 border-t-4 border-t-purple-500 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-600 mb-3">
            <Target size={13} className="flex-shrink-0" /><span>Cenário Atual</span>
          </div>
          {cenario
            ? <p className="text-sm text-gray-800 leading-relaxed">{cenario}</p>
            : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* Benefícios */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-green-500 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-600 mb-3">
            <Lightbulb size={13} className="flex-shrink-0" /><span>Benefícios Esperados</span>
          </div>
          {beneficios.length > 0 ? (
            <ul className="space-y-2">
              {beneficios.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* Riscos */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-red-400 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-500 mb-3">
            <ShieldAlert size={13} className="flex-shrink-0" /><span>Principais Riscos</span>
          </div>
          {riscos.length > 0 ? (
            <ul className="space-y-2">
              {riscos.slice(0, 5).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400 italic">Nenhum risco informado.</p>}
        </div>

        {/* CAPEX */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-purple-400 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-500 mb-3">
            <Banknote size={13} className="flex-shrink-0" /><span>CAPEX Aprovado</span>
          </div>
          {capex > 0
            ? <p className="text-2xl font-black text-[#003087]">{fmtR(capex)}</p>
            : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* OPEX */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-purple-300 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">
            <Wallet size={13} className="flex-shrink-0" /><span>OPEX Aprovado</span>
          </div>
          {opex > 0
            ? <p className="text-2xl font-black text-[#003087]">{fmtR(opex)}</p>
            : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* Investimento Total */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-purple-600 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700 mb-3">
            <DollarSign size={13} className="flex-shrink-0" /><span>Investimento Total</span>
          </div>
          {invTotal > 0 ? (
            <div>
              <p className="text-2xl font-black text-[#003087]">{fmtR(invTotal)}</p>
              {capex > 0 && opex > 0 && (
                <p className="text-xs text-gray-400 mt-1">CAPEX {fmtR(capex)} + OPEX {fmtR(opex)}</p>
              )}
            </div>
          ) : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>

        {/* Payback */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 border-t-cyan-500 shadow-sm hover:shadow-md transition-shadow p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-600 mb-3">
            <TrendingUp size={13} className="flex-shrink-0" /><span>Payback Previsto</span>
          </div>
          {d.payback_meses != null && d.payback_meses > 0 ? (
            <div>
              <p className="text-2xl font-black text-[#003087]">
                {d.payback_meses < 12
                  ? `${d.payback_meses} meses`
                  : `${(d.payback_meses / 12).toFixed(1).replace('.', ',')} anos`}
              </p>
              {d.payback_meses >= 12 && (
                <p className="text-xs text-gray-400 mt-0.5">{d.payback_meses} meses</p>
              )}
            </div>
          ) : <p className="text-sm text-gray-400 italic">Não informado.</p>}
        </div>
      </div>

      {/* Decisão já registrada */}
      {decisaoExistente && (() => {
        const cfg = DECISAO_CONFIG_VIA[decisaoExistente.tipo as keyof typeof DECISAO_CONFIG_VIA]
        return cfg ? (
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${cfg.bg} ${cfg.border}`}>
            <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div>
              <div className={`font-semibold text-sm ${cfg.cor}`}>{cfg.label}</div>
              {decisaoExistente.descricao && <p className="text-sm text-gray-600 mt-1">{decisaoExistente.descricao}</p>}
            </div>
          </div>
        ) : null
      })()}

      {/* Painel de Decisão */}
      {podeGerenciar && (
        <div className="rounded-xl border border-[#7C3AED]/15 bg-gradient-to-br from-[#7C3AED]/5 via-white to-purple-50/30 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center flex-shrink-0">
              <CheckCircle size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[#7C3AED] uppercase tracking-wide">Decisão do Comitê</span>
          </div>
          {decisaoExistente && (
            <p className="text-xs text-gray-400 italic mb-3">Decisão já registrada. Registre abaixo para atualizar.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => abrirModal('APROVAR')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <Check size={15} /> Aprovar para Estruturação
            </button>
            <button onClick={() => abrirModal('AJUSTES')} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <RefreshCw size={15} /> Solicitar Ajustes
            </button>
            <button onClick={() => abrirModal('REJEITAR')} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <Ban size={15} /> Reprovar Viabilidade
            </button>
            <button
              disabled={saving}
              onClick={async () => {
                if (!confirm('Pausar este projeto por decisão do Comitê? O projeto poderá ser retomado posteriormente.')) return
                setSaving(true)
                try {
                  await fetch(`/api/comites/${comiteId}/decisoes`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projeto_id: proj.id, tipo: 'SUSPENSO', descricao: 'Projeto pausado por decisão do Comitê' }),
                  })
                  await fetch(`/api/projetos/${proj.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'PAUSADO', motivo: 'Projeto pausado por decisão do Comitê' }),
                  })
                  await onRefresh()
                } finally { setSaving(false) }
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              ⏸ Pausar Projeto
            </button>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {modalTipo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between ${
              modalTipo === 'APROVAR' ? 'bg-green-600' : modalTipo === 'REJEITAR' ? 'bg-red-600' : 'bg-amber-500'
            }`}>
              <div>
                <div className="text-white font-bold text-base">
                  {modalTipo === 'APROVAR' ? '✓ Aprovar para Estruturação'
                    : modalTipo === 'AJUSTES' ? '↺ Solicitar Ajustes'
                    : '✕ Reprovar Viabilidade'}
                </div>
                <div className="text-white/80 text-xs mt-0.5">{proj.nome}</div>
              </div>
              <button onClick={() => setModalTipo(null)} className="text-white/70 hover:text-white p-1"><X size={20} /></button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {(modalTipo === 'AJUSTES' || modalTipo === 'REJEITAR') && (
                <div>
                  <label className="input-label">Justificativa <span className="text-red-500">*</span></label>
                  <textarea
                    className={`input ${erroModal ? 'border-red-400' : ''}`}
                    rows={3}
                    placeholder={modalTipo === 'AJUSTES' ? 'Descreva os ajustes necessários...' : 'Justifique a reprovação...'}
                    value={justificativa}
                    onChange={e => { setJustificativa(e.target.value); setErroModal('') }}
                  />
                  {erroModal && <p className="text-xs text-red-500 mt-1">{erroModal}</p>}
                </div>
              )}
              <div>
                <label className="input-label">Observações do Comitê</label>
                <textarea className="input" rows={2} placeholder="Observações adicionais (opcional)..." value={obsComite} onChange={e => setObsComite(e.target.value)} />
              </div>
              {modalTipo === 'APROVAR' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  O status do projeto será alterado para <strong>Estruturação</strong> e a decisão será registrada na Ata do Comitê.
                </div>
              )}
              {modalTipo === 'REJEITAR' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  O status do projeto será alterado para <strong>Cancelado</strong>. Esta ação não pode ser desfeita facilmente.
                </div>
              )}
              {modalTipo === 'AJUSTES' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  O projeto permanece em <strong>Estudo de Viabilidade</strong> e uma pendência será criada para o responsável.
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button onClick={() => setModalTipo(null)} className="btn-ghost" disabled={saving}>Cancelar</button>
              <button
                onClick={registrarDecisao}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm text-white transition-colors disabled:opacity-60 ${
                  modalTipo === 'APROVAR' ? 'bg-green-600 hover:bg-green-700'
                    : modalTipo === 'REJEITAR' ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {modalTipo === 'APROVAR' ? 'Confirmar Aprovação' : modalTipo === 'REJEITAR' ? 'Confirmar Reprovação' : 'Confirmar Ajustes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Slide: Lista de Projetos (genérico) ──────────────────────────────────────

function SlideProjetosPorDiretoria({
  titulo, projetos, cor, diretorias, onNextSlide, nextSlideLabel,
}: {
  titulo: string
  projetos: ProjetoResumo[]
  cor: string
  diretorias: { id: number; nome: string }[]
  onNextSlide?: () => void
  nextSlideLabel?: string
}) {
  // Build ordered diretoria list (from DB order), skip those with no projects in this stage
  const porDir = projetos.reduce<Record<string, ProjetoResumo[]>>((acc, p) => {
    const d = p.diretoria || 'Sem Diretoria'
    acc[d] = [...(acc[d] || []), p]
    return acc
  }, {})

  // Follow DB ordering; append "Sem Diretoria" at end if present
  const dbOrder = diretorias.map(d => d.nome).filter(n => porDir[n])
  if (porDir['Sem Diretoria']) dbOrder.push('Sem Diretoria')

  return (
    <div>
      {/* Stage header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cor + '18' }}>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#003087]">{titulo}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{projetos.length} projeto{projetos.length !== 1 ? 's' : ''} nesta etapa</p>
        </div>
        <span className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-full border" style={{ color: cor, borderColor: cor + '40', backgroundColor: cor + '0f' }}>
          {projetos.length} projeto{projetos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {projetos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="w-4 h-4 rounded-full opacity-30" style={{ backgroundColor: cor }} />
          <p className="text-gray-400 text-sm">Nenhum projeto nesta etapa</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dbOrder.map(dirNome => (
            <div key={dirNome}>
              {/* Diretoria section header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{dirNome}</h3>
                <span className="text-xs text-gray-400 font-medium ml-1">· {porDir[dirNome].length} projeto{porDir[dirNome].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="table-megag">
                  <thead>
                    <tr style={{ borderTop: `3px solid ${cor}` }}>
                      <th>Projeto</th>
                      <th>Área Responsável</th>
                      <th>Gerente</th>
                      <th>Status</th>
                      <th>Data Prevista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDir[dirNome].map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td>
                          <div className="font-semibold text-sm text-gray-900">{p.nome}</div>
                          <div className="font-mono text-xs text-gray-400 mt-0.5">{p.codigo}</div>
                        </td>
                        <td className="text-sm text-gray-600">{p.area || '—'}</td>
                        <td className="text-sm text-gray-600">{p.gerente_nome || '—'}</td>
                        <td>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_GRUPOS[p.status]?.bg || 'bg-gray-100'} ${STATUS_GRUPOS[p.status]?.cor || 'text-gray-700'}`}>
                            {STATUS_GRUPOS[p.status]?.label || p.status}
                          </span>
                        </td>
                        <td className="text-xs text-gray-500 font-medium">
                          {p.data_fim_prevista ? fmtDate(p.data_fim_prevista) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      {onNextSlide && (
        <div className="flex justify-end mt-6">
          <button
            onClick={onNextSlide}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-[#003087] hover:bg-[#002060] rounded-lg transition-colors shadow-sm"
          >
            {nextSlideLabel ? `Avançar para ${nextSlideLabel}` : 'Próxima Fase'} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Slide: Financeiro ────────────────────────────────────────────────────────

function SlideFinanceiro({ projetos }: { projetos: ProjetoResumo[] }) {
  const ativos = projetos.filter(p => !['CANCELADO','SUSPENSO'].includes(p.status))
  const totalInv = ativos.reduce((s, p) => s + (p.investimento || 0), 0)
  const comRoi = ativos.filter(p => p.roi_previsto && p.roi_previsto > 0)
  const roiMedio = comRoi.length > 0 ? comRoi.reduce((s, p) => s + (p.roi_previsto || 0), 0) / comRoi.length : 0

  const porDiretoria = ativos.reduce<Record<string, number>>((acc, p) => {
    const dir = p.diretoria || 'Sem Diretoria'
    acc[dir] = (acc[dir] || 0) + (p.investimento || 0)
    return acc
  }, {})

  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4">Financeiro do Portfólio</h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <DollarSign size={20} className="mx-auto mb-2 text-blue-600" />
          <div className="text-2xl font-bold">{fmtR(totalInv)}</div>
          <div className="text-xs text-gray-500">Investimento Total</div>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp size={20} className="mx-auto mb-2 text-emerald-600" />
          <div className="text-2xl font-bold">{roiMedio.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">ROI Médio Previsto</div>
        </div>
        <div className="card p-4 text-center">
          <Layers size={20} className="mx-auto mb-2 text-amber-600" />
          <div className="text-2xl font-bold">{ativos.length}</div>
          <div className="text-xs text-gray-500">Projetos Ativos</div>
        </div>
      </div>
      <div>
        <h3 className="font-medium text-gray-700 mb-2 text-sm">Investimento por Diretoria</h3>
        {Object.entries(porDiretoria)
          .sort((a, b) => b[1] - a[1])
          .map(([dir, val]) => {
            const pct = totalInv > 0 ? (val / totalInv) * 100 : 0
            return (
              <div key={dir} className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{dir}</span>
                  <span>{fmtR(val)} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-[#003087] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

// ─── Slide: Payback ───────────────────────────────────────────────────────────

function SlidePayback({ projetos, onNextSlide, nextSlideLabel }: {
  projetos: ProjetoResumo[]
  onNextSlide?: () => void
  nextSlideLabel?: string
}) {
  const comPayback = projetos.filter(p => !['CANCELADO','SUSPENSO'].includes(p.status))
  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4">Acompanhamento de Payback</h2>
      <div className="overflow-x-auto">
        <table className="table-megag">
          <thead><tr><th>Código</th><th>Projeto</th><th>Diretoria</th><th>Investimento</th><th>ROI Previsto</th><th>Status</th></tr></thead>
          <tbody>
            {comPayback.filter(p => p.investimento && p.investimento > 0).map(p => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.codigo}</td>
                <td className="text-sm">{p.nome}</td>
                <td className="text-sm text-gray-600">{p.diretoria || '—'}</td>
                <td className="text-sm">{p.investimento ? fmtR(p.investimento) : '—'}</td>
                <td className="text-sm">{p.roi_previsto ? `${p.roi_previsto.toFixed(1)}%` : '—'}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_GRUPOS[p.status]?.bg || 'bg-gray-100'} ${STATUS_GRUPOS[p.status]?.cor || ''}`}>
                    {STATUS_GRUPOS[p.status]?.label || p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onNextSlide && (
        <div className="flex justify-end mt-6">
          <button onClick={onNextSlide} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-[#003087] hover:bg-[#002060] rounded-lg transition-colors shadow-sm">
            {nextSlideLabel ? `Avançar para ${nextSlideLabel}` : 'Próxima Fase'} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Slide: Riscos ────────────────────────────────────────────────────────────

function SlideRiscos({ projetos }: { projetos: ProjetoResumo[] }) {
  const riscos = projetos.filter(p =>
    !['CANCELADO','SUSPENSO','ENCERRAMENTO'].includes(p.status) &&
    (p.complexidade === 'ALTA' || p.prioridade === 'CRITICA' || p.prioridade === 'ALTA')
  )
  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4">Gestão de Riscos</h2>
      {riscos.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <p className="text-gray-400">Nenhum projeto em situação de risco elevado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {riscos.map(p => (
            <div key={p.id} className="p-3 border border-orange-100 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{p.codigo} — {p.nome}</span>
                <div className="flex gap-1">
                  {p.complexidade === 'ALTA' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Alta Complexidade</span>}
                  {(p.prioridade === 'CRITICA' || p.prioridade === 'ALTA') && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{p.prioridade}</span>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{p.diretoria} · {STATUS_GRUPOS[p.status]?.label || p.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Slide: Pendências ────────────────────────────────────────────────────────

function SlidePendencias({ pendencias, podeGerenciar, comiteId, projetosLista, showAdd, setShowAdd, onRefresh }: any) {
  const [form, setForm] = useState({ descricao: '', responsavel_nome: '', prazo: '', projeto_id: '' })
  const [loading, setLoading] = useState(false)
  const abertas = pendencias.filter((p: ComitePendencia) => p.status === 'ABERTA')
  const resolvidas = pendencias.filter((p: ComitePendencia) => p.status === 'RESOLVIDA')

  async function addPendencia(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/comites/${comiteId}/pendencias`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, projeto_id: form.projeto_id ? parseInt(form.projeto_id) : null }),
      })
      if (res.ok) { setShowAdd(false); setForm({ descricao: '', responsavel_nome: '', prazo: '', projeto_id: '' }); onRefresh() }
    } finally { setLoading(false) }
  }

  async function resolver(id: number) {
    await fetch(`/api/comites/${comiteId}/pendencias/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVIDA' }),
    })
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#003087]">Pendências</h2>
        {podeGerenciar && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={14} /> Nova Pendência
          </button>
        )}
      </div>

      {abertas.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-700 mb-2 text-sm">Abertas ({abertas.length})</h3>
          <div className="space-y-2">
            {abertas.map((p: ComitePendencia) => (
              <div key={p.id} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{p.descricao}</p>
                  {p.projeto_nome && <p className="text-xs text-gray-500">Projeto: {p.projeto_nome}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.responsavel_nome && `Resp: ${p.responsavel_nome}`}
                    {p.responsavel_nome && p.prazo && ' · '}
                    {p.prazo && `Prazo: ${fmtDate(p.prazo)}`}
                  </p>
                </div>
                {podeGerenciar && (
                  <button onClick={() => resolver(p.id)} className="text-xs text-green-600 hover:text-green-700 font-medium shrink-0">
                    Resolver
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvidas.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-500 mb-2 text-sm">Resolvidas ({resolvidas.length})</h3>
          <div className="space-y-1">
            {resolvidas.map((p: ComitePendencia) => (
              <div key={p.id} className="flex items-center gap-2 p-2 text-sm text-gray-400 line-through">
                <CheckCircle size={14} className="text-green-400 shrink-0" />
                {p.descricao}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendencias.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Nenhuma pendência registrada</p>}

      {showAdd && (
        <Modal title="Nova Pendência" onClose={() => setShowAdd(false)}>
          <form onSubmit={addPendencia} className="space-y-3">
            <div>
              <label className="input-label">Descrição *</label>
              <textarea className="input" rows={2} required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Responsável</label>
                <input className="input" value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Prazo</label>
                <input type="date" className="input" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="input-label">Projeto (opcional)</label>
              <select className="input" value={form.projeto_id} onChange={e => setForm(f => ({ ...f, projeto_id: e.target.value }))}>
                <option value="">— Geral —</option>
                {projetosLista.map((p: any) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Slide: Histórico ─────────────────────────────────────────────────────────

// ── SlideExecucaoDetalhe ─────────────────────────────────────────────────────

const STATUS_TAREFA_CFG = {
  nao_iniciada: { label: 'Não iniciada', color: '#9CA3AF', dot: '⚪' },
  em_andamento: { label: 'Em andamento', color: '#3B82F6', dot: '🔵' },
  concluida:    { label: 'Concluída',    color: '#059669', dot: '🟢' },
  atencao:      { label: 'Atenção',      color: '#D97706', dot: '🟡' },
  atrasada:     { label: 'Atrasada',     color: '#DC2626', dot: '🔴' },
  bloqueada:    { label: 'Bloqueada',    color: '#7C3AED', dot: '🟣' },
} as const
type TStatusTarefa = keyof typeof STATUS_TAREFA_CFG

function calcStatusTarefa(t: MacroTarefa, today: Date): TStatusTarefa {
  if ((t.percentual ?? 0) >= 100 || t.data_conclusao) return 'concluida'
  if (t.bloqueio) return 'bloqueada'
  if (t.data_fim) {
    const df = new Date(t.data_fim + 'T00:00:00')
    const dias = Math.ceil((df.getTime() - today.getTime()) / 86400000)
    if (dias < 0 && (t.percentual ?? 0) < 100) return 'atrasada'
    if (dias <= 7 && (t.percentual ?? 0) < 100) return 'atencao'
  }
  if ((t.percentual ?? 0) > 0) return 'em_andamento'
  return 'nao_iniciada'
}

function SlideExecucaoDetalhe({
  projetos, detalhe, tarefas, pendencias, diretorias, comiteId,
  decisoes, podeGerenciar, onRefresh, onNextSlide, nextSlideLabel,
}: {
  projetos: ProjetoResumo[]
  detalhe: ProjetoExecucaoDetalhe[]
  tarefas: MacroTarefa[]
  pendencias: ComitePendencia[]
  diretorias: { id: number; nome: string }[]
  comiteId: number
  decisoes: ComiteDecisao[]
  podeGerenciar: boolean
  onRefresh: () => void
  onNextSlide?: () => void
  nextSlideLabel?: string
}) {
  const COR = '#059669'
  const [idx, setIdx] = useState(0)
  const [decisaoLoading, setDecisaoLoading] = useState(false)
  const [decisaoErro, setDecisaoErro] = useState('')
  const [reprogramarId, setReprogramarId] = useState<number | null>(null)
  const [novaDataFim, setNovaDataFim] = useState('')
  const [reprogramandoLoading, setReprogramandoLoading] = useState(false)

  // Reset reprogramação ao navegar entre projetos
  useEffect(() => { setReprogramarId(null); setNovaDataFim('') }, [idx])

  type ExecPage =
    | { kind: 'dir'; nome: string; projetos: ProjetoResumo[] }
    | { kind: 'proj'; projeto: ProjetoResumo }

  // Build pages: capa por diretoria → projetos ordenados por prioridade
  const pages = React.useMemo((): ExecPage[] => {
    const PRIO: Record<string, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 }
    const dirNomes = diretorias.map(d => d.nome)
    const grouped: Record<string, ProjetoResumo[]> = {}
    for (const p of projetos) {
      const dir = p.diretoria || 'Sem Diretoria'
      grouped[dir] = grouped[dir] || []
      grouped[dir].push(p)
    }
    for (const dir in grouped) {
      grouped[dir].sort((a, b) => (PRIO[a.prioridade ?? 'MEDIA'] ?? 1) - (PRIO[b.prioridade ?? 'MEDIA'] ?? 1))
    }
    const orderedDirs = [
      ...dirNomes.filter(d => grouped[d]?.length),
      ...Object.keys(grouped).filter(d => !dirNomes.includes(d) && grouped[d]?.length),
    ]
    const result: ExecPage[] = []
    for (const dir of orderedDirs) {
      result.push({ kind: 'dir', nome: dir, projetos: grouped[dir] })
      for (const p of grouped[dir]) result.push({ kind: 'proj', projeto: p })
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos, diretorias])

  // Keyboard navigation — capture phase, same pattern as SlidePropostasDetalhe
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      if (e.key === 'ArrowRight') { e.stopPropagation(); if (idx >= pages.length - 1) { onNextSlide?.() } else { setIdx(i => i + 1) } }
      else if (e.key === 'ArrowLeft') { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [pages.length, idx, onNextSlide])

  if (projetos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Play size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">Nenhum projeto em execução</p>
        {onNextSlide && (
          <button onClick={onNextSlide} className="mt-6 flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
            {nextSlideLabel} <ChevronRight size={16} />
          </button>
        )}
      </div>
    )
  }

  const safeIdx = Math.min(idx, pages.length - 1)
  const page = pages[safeIdx]
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // ── Capa de Diretoria ────────────────────────────────────────────
  if (page.kind === 'dir') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COR}15`, border: `1px solid ${COR}30` }}>
              <Play size={16} style={{ color: COR }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: COR }}>Em Execução</p>
              <p className="text-xs text-gray-500">{projetos.length} projetos · {Math.round((pages.length - projetos.length))} diretorias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-600">{safeIdx + 1} / {pages.length}</span>
            <button onClick={() => setIdx(Math.min(pages.length - 1, safeIdx + 1))} disabled={safeIdx === pages.length - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {pages.length > 1 && (
          <div className="flex gap-1 justify-center mb-5 flex-wrap">
            {pages.map((p, i) => (
              <button key={i} onClick={() => setIdx(i)} className="rounded-full transition"
                style={{ width: i === safeIdx ? '20px' : p.kind === 'dir' ? '10px' : '8px', height: p.kind === 'dir' ? '10px' : '8px', background: i === safeIdx ? COR : p.kind === 'dir' ? '#6B7280' : '#D1D5DB' }} />
            ))}
          </div>
        )}
        {/* Dir capa card */}
        <div className="relative flex flex-col items-center justify-center min-h-[480px] rounded-2xl"
          style={{ background: `${COR}08`, border: `2px solid ${COR}25` }}>
          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={{ background: COR }} />
          <div className="flex flex-col items-center gap-5 px-8 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: `${COR}18`, border: `2px solid ${COR}40` }}>
              <Play size={40} style={{ color: COR }} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: COR }}>Em Execução</p>
              <h2 className="font-black text-gray-900 leading-tight" style={{ fontSize: '32px' }}>{page.nome}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black" style={{ fontSize: '52px', color: COR, lineHeight: 1 }}>{page.projetos.length}</span>
              <span className="text-lg font-medium text-gray-500 text-left">
                {page.projetos.length === 1 ? 'Projeto em\nExecução' : 'Projetos em\nExecução'}
              </span>
            </div>
            {/* Project list preview */}
            <div className="w-full max-w-sm space-y-1.5 mt-1">
              {page.projetos.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-gray-600 px-3 py-1.5 rounded-lg bg-white/60">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.prioridade === 'ALTA' ? 'bg-red-400' : p.prioridade === 'MEDIA' ? 'bg-amber-400' : 'bg-green-400'}`} />
                  <span className="truncate font-medium">{p.nome}</span>
                  {p.prioridade && <span className="ml-auto text-xs text-gray-400 shrink-0">{p.prioridade}</span>}
                </div>
              ))}
            </div>
            <button onClick={() => setIdx(safeIdx + 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md hover:opacity-90 transition"
              style={{ background: COR }}>
              Ver Projetos <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Projeto page ─────────────────────────────────────────────────
  const { projeto } = page
  const det = detalhe.find(d => d.id === projeto.id) || ({} as ProjetoExecucaoDetalhe)
  const pendsProjeto = pendencias.filter(p => p.projeto_id === projeto.id)

  // Expand FASEs: if a FASE has direct TAREFA children (identified by WBS prefix), show those
  // children instead of the FASE itself. FASEs without child tasks are kept as-is.
  const todasTarefasProjeto = tarefas.filter(t => t.projeto_id === projeto.id)
  const fases = todasTarefasProjeto.filter(t => t.nivel === 'FASE')
  const tarefasFilhas = todasTarefasProjeto.filter(t => t.nivel === 'TAREFA')
  const macros: MacroTarefa[] = fases.flatMap(fase => {
    if (!fase.codigo) return [fase]
    const prefix = fase.codigo + '.'
    const filhos = tarefasFilhas.filter(t => {
      if (!t.codigo?.startsWith(prefix)) return false
      // Direct child only — no additional dot after the prefix
      return !t.codigo.slice(prefix.length).includes('.')
    })
    return filhos.length > 0 ? filhos : [fase]
  })

  // Progress
  const percConcluido = macros.length > 0
    ? Math.round(macros.reduce((s, t) => s + (t.percentual ?? 0), 0) / macros.length)
    : 0

  // Prazo badge
  function prazoInfo(): { label: string; color: string; dot: string } {
    const fim = det.data_fim_prev || projeto.data_fim_prevista
    if (!fim) return { label: 'Sem data', color: '#6B7280', dot: '⚪' }
    const df = new Date(fim + 'T00:00:00')
    const dias = Math.ceil((df.getTime() - today.getTime()) / 86400000)
    if (dias < 0)  return { label: 'Atrasado',    color: '#DC2626', dot: '🔴' }
    if (dias <= 30) return { label: 'Em Atenção',  color: '#D97706', dot: '🟡' }
    return                   { label: 'No Prazo',   color: '#059669', dot: '🟢' }
  }
  const prazo = prazoInfo()

  // Financial — mesma lógica do FinanceiroTab (lib/financeiro/dashboard.ts)
  const capexPlanejado   = det.capex_aprovado  ?? 0
  const opexPlanejado    = det.opex_aprovado   ?? 0
  const capexExecutado   = det.capex_executado ?? 0
  const opexExecutado    = det.opex_executado  ?? 0
  const saldoCapex       = capexPlanejado - capexExecutado
  const saldoOpex        = opexPlanejado  - opexExecutado
  const totalPlanejado   = capexPlanejado + opexPlanejado
  const totalExecutado   = capexExecutado + opexExecutado
  const saldoGeral       = totalPlanejado - totalExecutado
  const percFinanceiro   = totalPlanejado > 0
    ? Math.round((totalExecutado / totalPlanejado) * 100)
    : 0

  // Pontos críticos
  const atrasadas = macros.filter(t => calcStatusTarefa(t, today) === 'atrasada')
  const bloqueadas = macros.filter(t => calcStatusTarefa(t, today) === 'bloqueada')

  // Próximas atividades — usadas quando não há atrasadas
  const proximasAtividades = macros
    .filter(t => {
      const st = calcStatusTarefa(t, today)
      return st !== 'concluida' && st !== 'atrasada'
    })
    .sort((a, b) => {
      if (!a.data_fim && !b.data_fim) return 0
      if (!a.data_fim) return 1
      if (!b.data_fim) return -1
      return a.data_fim.localeCompare(b.data_fim)
    })
    .slice(0, 5)
  const pontosCount = atrasadas.length + bloqueadas.length + pendsProjeto.length

  // Existing decision for this project
  const decisaoExistente = decisoes.find(d => d.projeto_id === projeto.id)

  async function registrarDecisao(tipo: string, descricao: string, novoStatus?: string) {
    setDecisaoLoading(true); setDecisaoErro('')
    try {
      const r1 = await fetch(`/api/comites/${comiteId}/decisoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto_id: projeto.id, tipo, descricao }),
      })
      if (!r1.ok) { setDecisaoErro((await r1.json()).error || 'Erro'); return }
      if (novoStatus) {
        const r2 = await fetch(`/api/projetos/${projeto.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: novoStatus }),
        })
        if (!r2.ok) { setDecisaoErro((await r2.json()).error || 'Erro ao atualizar status'); return }
      }
      if (tipo === 'REVISAO') {
        await fetch(`/api/comites/${comiteId}/pendencias`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projeto_id: projeto.id,
            descricao: `Plano de Ação solicitado pelo Comitê: ${descricao}`,
            responsavel_nome: det.gerente_nome || '',
          }),
        })
      }
      onRefresh()
    } finally { setDecisaoLoading(false) }
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${COR}15`, border: `1px solid ${COR}30` }}>
            <Play size={16} style={{ color: COR }} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: COR }}>Em Execução</p>
            <p className="text-xs text-gray-500">{projetos.length} projetos · {pages.length - projetos.length} diretorias</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-gray-600">{safeIdx + 1} / {pages.length}</span>
          <button onClick={() => setIdx(Math.min(pages.length - 1, safeIdx + 1))} disabled={safeIdx === pages.length - 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
            <ChevronRight size={18} />
          </button>
          {safeIdx === pages.length - 1 && onNextSlide && (
            <button onClick={onNextSlide}
              className="ml-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition hover:opacity-90"
              style={{ background: COR }}>
              {nextSlideLabel} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="flex gap-1 justify-center mb-5 flex-wrap">
          {pages.map((p, i) => (
            <button key={i} onClick={() => setIdx(i)} className="rounded-full transition"
              style={{ width: i === safeIdx ? '20px' : p.kind === 'dir' ? '10px' : '8px', height: p.kind === 'dir' ? '10px' : '8px', background: i === safeIdx ? COR : p.kind === 'dir' ? '#6B7280' : '#D1D5DB' }} />
          ))}
        </div>
      )}

      <div className="space-y-4">

        {/* 1 – Cabeçalho Executivo */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 shadow-sm p-5" style={{ borderTopColor: COR }}>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {/* Left: project info */}
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">{det.codigo || projeto.codigo}</p>
              <h2 className="text-xl font-black text-gray-900 leading-tight mb-3">{det.nome || projeto.nome}</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Building2 size={13} className="shrink-0 text-gray-400" />
                  <span className="truncate">{det.diretoria || projeto.diretoria || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Layers size={13} className="shrink-0 text-gray-400" />
                  <span className="truncate">{det.area || projeto.area || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Briefcase size={13} className="shrink-0 text-gray-400" />
                  <span className="truncate">{det.gerente_nome || projeto.gerente_nome || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Calendar size={13} className="shrink-0 text-gray-400" />
                  <span className="truncate">
                    {fmtDate(det.data_inicio_prev || projeto.data_inicio_prevista)} →{' '}
                    {fmtDate(det.data_fim_prev || projeto.data_fim_prevista)}
                  </span>
                </div>
              </div>
            </div>
            {/* Right: status badges */}
            <div className="flex lg:flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                <span className="text-base">🟢</span>
                <span className="text-xs font-bold text-green-700">EM EXECUÇÃO</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: prazo.color }}>
                <span className="text-lg leading-none">{prazo.dot}</span>
                <span className="text-sm font-black text-white tracking-wide uppercase">{prazo.label}</span>
              </div>
            </div>
          </div>

          {/* Progress indicators */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-gray-500">% Concluído</span>
                <span style={{ color: COR }}>{percConcluido}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${percConcluido}%`, background: COR }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2 – Macro Cronograma */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 shadow-sm overflow-hidden"
          style={{ borderTopColor: atrasadas.length > 0 ? '#DC2626' : COR }}>
          <div className={`px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${atrasadas.length > 0 ? 'text-red-600' : ''}`}
            style={{ color: atrasadas.length > 0 ? '#DC2626' : COR }}>
            <BarChart2 size={13} className="shrink-0" />
            <span>{atrasadas.length > 0 ? 'Macro Cronograma — Atividades Atrasadas' : 'Macro Cronograma — Próximas Atividades'}</span>
            <span className="ml-auto text-gray-400 font-normal">
              {atrasadas.length > 0
                ? `${atrasadas.length} atrasada${atrasadas.length !== 1 ? 's' : ''}`
                : `${proximasAtividades.length} atividade${proximasAtividades.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {atrasadas.length === 0 && proximasAtividades.length === 0 ? (
            <div className="p-6 flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle size={16} /> Todas as atividades concluídas.
            </div>
          ) : atrasadas.length === 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Macro Atividade</th>
                    <th className="px-4 py-2.5 text-left">Responsável</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Previsão</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Dias Rest.</th>
                    <th className="px-4 py-2.5 text-left">Observação</th>
                    <th className="px-4 py-2.5 text-center">Avanço</th>
                  </tr>
                </thead>
                <tbody>
                  {proximasAtividades.map(t => {
                    const st = calcStatusTarefa(t, today)
                    const cfg = STATUS_TAREFA_CFG[st]
                    const dias = t.data_fim
                      ? Math.ceil((new Date(t.data_fim + 'T00:00:00').getTime() - today.getTime()) / 86400000)
                      : null
                    return (
                      <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-800">{t.nome}</span>
                          {t.criticidade === 'CRITICA' && (
                            <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Crítica</span>
                          )}
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ color: cfg.color, background: `${cfg.color}18` }}>
                            {cfg.dot} {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{t.responsavel_nome || '—'}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600 whitespace-nowrap">{fmtDate(t.data_fim)}</td>
                        <td className="px-4 py-3 text-center text-xs">
                          {dias === null ? '—'
                            : <span className={`font-medium ${dias <= 7 ? 'text-amber-600' : 'text-gray-600'}`}>
                                {dias}d
                              </span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                          {t.observacoes || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden" style={{ minWidth: '48px' }}>
                              <div className="h-full rounded-full" style={{ width: `${t.percentual ?? 0}%`, background: cfg.color }} />
                            </div>
                            <span className="text-xs font-medium w-8 text-right" style={{ color: cfg.color }}>{t.percentual ?? 0}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Macro Atividade</th>
                    <th className="px-4 py-2.5 text-left">Responsável</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Data Original</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Dias Atraso</th>
                    <th className="px-4 py-2.5 text-left">Observação</th>
                    <th className="px-4 py-2.5 text-center">Avanço</th>
                    <th className="px-4 py-2.5 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {atrasadas.map(t => {
                    const dias = t.data_fim
                      ? Math.ceil((today.getTime() - new Date(t.data_fim + 'T00:00:00').getTime()) / 86400000)
                      : null
                    const isReprog = reprogramarId === t.id
                    return (
                      <React.Fragment key={t.id}>
                        <tr className="border-t border-gray-50 hover:bg-red-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-red-700">{t.nome}</span>
                            {t.criticidade === 'CRITICA' && (
                              <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Crítica</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{t.responsavel_nome || '—'}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-600 whitespace-nowrap">{fmtDate(t.data_fim)}</td>
                          <td className="px-4 py-3 text-center text-xs">
                            {dias !== null
                              ? <span className="font-bold text-red-600">{dias}d</span>
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                            {t.observacoes || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden" style={{ minWidth: '48px' }}>
                                <div className="h-full rounded-full bg-red-500" style={{ width: `${t.percentual ?? 0}%` }} />
                              </div>
                              <span className="text-xs font-medium w-8 text-right text-red-600">{t.percentual ?? 0}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!isReprog && (
                              <button
                                onClick={() => { setReprogramarId(t.id); setNovaDataFim('') }}
                                className="text-xs px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 font-medium transition"
                              >
                                Reprog.
                              </button>
                            )}
                          </td>
                        </tr>
                        {isReprog && (
                          <tr className="border-t border-amber-100 bg-amber-50/60">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-gray-600 font-medium">Nova data de entrega:</span>
                                <input
                                  type="date"
                                  value={novaDataFim}
                                  onChange={e => setNovaDataFim(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                  min={new Date().toISOString().slice(0, 10)}
                                />
                                <button
                                  disabled={!novaDataFim || reprogramandoLoading}
                                  onClick={async () => {
                                    if (!novaDataFim) return
                                    setReprogramandoLoading(true)
                                    try {
                                      const res = await fetch(
                                        `/api/projetos/${t.projeto_id}/cronograma/${t.cronograma_id}/tarefas/${t.id}/reprogramar`,
                                        { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ nova_data_fim: novaDataFim }) }
                                      )
                                      if (res.ok) { setReprogramarId(null); setNovaDataFim(''); onRefresh() }
                                    } finally { setReprogramandoLoading(false) }
                                  }}
                                  className="text-xs px-3 py-1 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-40 transition"
                                >
                                  {reprogramandoLoading ? 'Salvando…' : 'Confirmar'}
                                </button>
                                <button
                                  onClick={() => { setReprogramarId(null); setNovaDataFim('') }}
                                  className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                                >
                                  Cancelar
                                </button>
                                {t.data_fim && (
                                  <span className="text-xs text-gray-400">Linha de base: {fmtDate(t.data_fim)}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4 – Resumo Financeiro */}
        <div className="bg-white rounded-xl border border-gray-100 border-t-4 shadow-sm" style={{ borderTopColor: '#003087' }}>
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#003087]">
            <DollarSign size={13} className="shrink-0" /><span>Resumo Financeiro</span>
          </div>
          <div className="p-5 space-y-3">
            {/* CAPEX */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1.5">CAPEX</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Planejado',  value: capexPlanejado, color: '#1D4ED8' },
                  { label: 'Executado',  value: capexExecutado, color: capexExecutado > capexPlanejado ? '#DC2626' : '#059669' },
                  { label: 'Saldo',      value: saldoCapex,     color: saldoCapex >= 0 ? '#059669' : '#DC2626' },
                ] as const).map(card => (
                  <div key={card.label} className="flex flex-col items-center p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
                    <p className="text-xs font-semibold text-gray-500 mb-1">{card.label}</p>
                    <p className="font-black text-sm" style={{ color: card.color }}>{fmtR(card.value)}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* OPEX */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-1.5">OPEX</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Planejado',  value: opexPlanejado, color: '#7C3AED' },
                  { label: 'Executado',  value: opexExecutado, color: opexExecutado > opexPlanejado ? '#DC2626' : '#059669' },
                  { label: 'Saldo',      value: saldoOpex,     color: saldoOpex >= 0 ? '#059669' : '#DC2626' },
                ] as const).map(card => (
                  <div key={card.label} className="flex flex-col items-center p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
                    <p className="text-xs font-semibold text-gray-500 mb-1">{card.label}</p>
                    <p className="font-black text-sm" style={{ color: card.color }}>{fmtR(card.value)}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Total */}
            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Total</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Planejado',  value: totalPlanejado, color: '#003087' },
                  { label: 'Executado',  value: totalExecutado, color: totalExecutado > totalPlanejado ? '#DC2626' : '#059669' },
                  { label: 'Saldo Geral',value: saldoGeral,     color: saldoGeral >= 0 ? '#059669' : '#DC2626' },
                ] as const).map(card => (
                  <div key={card.label} className="flex flex-col items-center p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
                    <p className="text-xs font-semibold text-gray-500 mb-1">{card.label}</p>
                    <p className="font-black text-sm" style={{ color: card.color }}>{fmtR(card.value)}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Retorno — dados do Payback */}
            {(det.opex_aprovado != null && det.opex_aprovado > 0) && (det.economia_mensal_esperada != null || det.payback_informado != null || det.payback_meses != null) && (
              <div className="pt-1 border-t border-gray-100">
                <p className="text-xs font-bold uppercase tracking-wider text-green-700 mb-1.5">Retorno Esperado</p>
                <div className="grid grid-cols-2 gap-2">
                  {det.economia_mensal_esperada != null && (
                    <div className="flex flex-col items-center p-3 rounded-xl bg-green-50 border border-green-100 text-center">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Economia Mensal</p>
                      <p className="font-black text-sm text-green-700">{fmtR(det.economia_mensal_esperada)}</p>
                    </div>
                  )}
                  {(det.payback_informado != null || det.payback_meses != null) && (
                    <div className="flex flex-col items-center p-3 rounded-xl bg-green-50 border border-green-100 text-center">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Payback</p>
                      <p className="font-black text-sm text-green-700">
                        {(() => {
                          const pb = det.payback_informado ?? det.payback_meses
                          if (pb == null) return '—'
                          const unit = det.payback_unidade ?? 'MESES'
                          if (unit === 'ANOS') return `${pb} anos`
                          return pb < 12 ? `${pb} meses` : `${(pb / 12).toFixed(1).replace('.', ',')} anos`
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5 – Decisão do Comitê */}
        {podeGerenciar && (
          <div className="bg-white rounded-xl border border-gray-100 border-t-4 shadow-sm" style={{ borderTopColor: COR }}>
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: COR }}>
              <CheckCircle size={13} className="shrink-0" /><span>Decisão do Comitê</span>
            </div>
            <div className="p-5">
              {decisaoErro && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-1.5">
                  <AlertCircle size={13} /> {decisaoErro}
                </div>
              )}
              {decisaoExistente ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <CheckCircle size={16} />
                  <span><strong>Decisão registrada:</strong> {decisaoExistente.descricao}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => registrarDecisao('APROVADO', 'Projeto mantido em execução conforme cronograma')}
                    disabled={decisaoLoading}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: '#059669' }}
                  >
                    {decisaoLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Manter Execução
                  </button>
                  <button
                    onClick={() => registrarDecisao('REVISAO', 'Plano de Ação solicitado pelo Comitê')}
                    disabled={decisaoLoading}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90 border-2"
                    style={{ color: '#D97706', borderColor: '#D97706', background: '#FFFBEB' }}
                  >
                    {decisaoLoading ? <Loader2 size={15} className="animate-spin" /> : <AlertCircle size={15} />}
                    Solicitar Plano de Ação
                  </button>
                  <button
                    onClick={() => registrarDecisao('SUSPENSO', 'Projeto pausado por decisão do Comitê', 'PAUSADO')}
                    disabled={decisaoLoading}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90 border-2"
                    style={{ color: '#6B7280', borderColor: '#D1D5DB', background: '#F9FAFB' }}
                  >
                    {decisaoLoading ? <Loader2 size={15} className="animate-spin" /> : <Pause size={15} />}
                    Pausar Projeto
                  </button>
                  <button
                    onClick={() => registrarDecisao('CANCELADO', 'Projeto encerrado por decisão do Comitê', 'ENCERRAMENTO')}
                    disabled={decisaoLoading}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90 border-2"
                    style={{ color: '#DC2626', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                  >
                    {decisaoLoading ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
                    Encerrar Projeto
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Slide: Diretoria (agrupa todos os status-macro de uma diretoria) ─────────

const MACRO_GRUPOS_DIRETORIA = [
  { macro: 'MACRO_PROPOSTA',     label: 'Proposta / Ideia',       cor: '#2563EB', statuses: ['PROPOSTA','TRIAGEM','COMITE_IDEIAS'] },
  { macro: 'MACRO_VIABILIDADE',  label: 'Est. de Viabilidade',   cor: '#7C3AED', statuses: ['VIABILIDADE','COMPLEMENTACAO_TAP','APROVACAO'] },
  { macro: 'MACRO_ESTRUTURACAO', label: 'Estruturação',           cor: '#D97706', statuses: ['ESTRUTURACAO','CRONOGRAMA'] },
  { macro: 'MACRO_EXECUCAO',     label: 'Execução',               cor: '#059669', statuses: ['EXECUCAO','GOLIVE','PROJETO_CONCLUIDO'] },
  { macro: 'MACRO_PAYBACK',      label: 'Payback',                cor: '#0891B2', statuses: ['ROI','PAYBACK_ACOMPANHAMENTO','PAYBACK_ENCERRADO','PROJETO_ENCERRADO'] },
  { macro: 'MACRO_PAUSADO',      label: 'Pausado',                cor: '#6B7280', statuses: ['PAUSADO'] },
] as const

function SlideDiretoria({
  diretoriaNome, projetos, projetosPropostaDetalhe, projetosViabilidadeDetalhe,
  projetosExecucaoDetalhe, macroTarefasExecucao, diretorias, pendencias,
  decisoes, comiteId, podeGerenciar, onRefresh, onNextSlide, nextSlideLabel,
  comiteData,
}: {
  diretoriaNome: string
  projetos: ProjetoResumo[]
  projetosPropostaDetalhe: ProjetoPropostaDetalhe[]
  projetosViabilidadeDetalhe: ProjetoViabilidadeDetalhe[]
  projetosExecucaoDetalhe: ProjetoExecucaoDetalhe[]
  macroTarefasExecucao: MacroTarefa[]
  diretorias: { id: number; nome: string }[]
  pendencias: ComitePendencia[]
  decisoes: ComiteDecisao[]
  comiteId: number
  podeGerenciar: boolean
  onRefresh: () => Promise<void>
  onNextSlide?: () => void
  nextSlideLabel?: string
  comiteData?: string
}) {
  const sigla = getSigla(diretoriaNome)

  // Nível 2: macro selecionado (null = visão centralizada da diretoria)
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null)

  // ── Cabeçalho (visível na navegação projeto-a-projeto) ───────────────────
  const header = (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[#003087] flex items-center justify-center shrink-0">
        <span className="text-white text-xs font-bold">{sigla}</span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#003087]">{diretoriaNome}</h2>
        <p className="text-sm text-gray-500">
          {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
        </p>
      </div>
    </div>
  )

  // ── NÍVEL 2: Visão centralizada da Diretoria + Macro Fases abaixo ───────
  if (!selectedMacro) {
    const gruposComProjetos = MACRO_GRUPOS_DIRETORIA.filter(g =>
      projetos.some(p => (g.statuses as readonly string[]).includes(p.status))
    )
    const primeiraFase = gruposComProjetos[0]

    return (
      <div className="flex flex-col items-center min-h-[500px] gap-6 py-6">
        {/* Layout centralizado — preservado exatamente como era */}
        <div className="flex flex-col items-center gap-5 text-center">
          {/* Ícone */}
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg bg-[#003087]">
            <span className="text-white text-2xl font-black">{sigla}</span>
          </div>

          {/* Nome da Diretoria */}
          <h1 className="font-black text-gray-900 leading-tight" style={{ fontSize: '36px' }}>
            {diretoriaNome}
          </h1>

          {/* Estatísticas */}
          <div className="flex flex-col items-center">
            <span className="font-black text-[#003087]" style={{ fontSize: '38px' }}>{projetos.length}</span>
            <span className="text-sm font-medium text-gray-500">{projetos.length === 1 ? 'Projeto' : 'Projetos'}</span>
          </div>

          {/* Data do comitê */}
          {comiteData && (
            <p className="text-gray-400 text-sm flex items-center gap-1.5">
              <Calendar size={14} />{fmtDate(comiteData)}
            </p>
          )}

          {/* Botão Ver Projetos */}
          {primeiraFase ? (
            <button
              onClick={() => setSelectedMacro(primeiraFase.macro)}
              className="mt-1 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-md hover:shadow-lg transition-all bg-[#003087] hover:bg-[#00246b]"
            >
              Ver Projetos <ChevronRight size={18} />
            </button>
          ) : onNextSlide && (
            <button
              onClick={onNextSlide}
              className="mt-1 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-md hover:shadow-lg transition-all bg-[#003087] hover:bg-[#00246b]"
            >
              {nextSlideLabel || 'Próxima Diretoria'} <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Macro Fases — compacto, abaixo do conteúdo centralizado */}
        {projetos.length > 0 && (
          <div className="w-full max-w-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Macro Fases</p>
            <div className="flex flex-col">
              {MACRO_GRUPOS_DIRETORIA.map(grupo => {
                const count = projetos.filter(p =>
                  (grupo.statuses as readonly string[]).includes(p.status)
                ).length
                const clicavel = count > 0

                return (
                  <button
                    key={grupo.macro}
                    onClick={() => clicavel && setSelectedMacro(grupo.macro)}
                    disabled={!clicavel}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition
                      ${clicavel ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: grupo.cor, opacity: clicavel ? 1 : 0.3 }} />
                      <span className={clicavel ? 'text-gray-700' : 'text-gray-400'}>{grupo.label}</span>
                    </div>
                    <span className={`font-semibold tabular-nums ${clicavel ? 'text-gray-800' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── NÍVEL 3: Apresentação projeto-a-projeto da fase selecionada ─────────
  const grupoAtual = MACRO_GRUPOS_DIRETORIA.find(g => g.macro === selectedMacro)!
  const projetosGrupo = projetos.filter(p =>
    (grupoAtual.statuses as readonly string[]).includes(p.status)
  )

  // Dados de detalhe filtrados para os projetos desta diretoria/fase
  const propostaDetalheFiltrado   = projetosPropostaDetalhe.filter(d => projetosGrupo.some(p => p.id === d.id))
  const viabilidadeDetalheFiltrado = projetosViabilidadeDetalhe.filter(d => projetosGrupo.some(p => p.id === d.id))
  const execucaoDetalheFiltrado   = projetosExecucaoDetalhe.filter(d => projetosGrupo.some(p => p.id === d.id))
  const tarefasFiltradas          = macroTarefasExecucao.filter(t => projetosGrupo.some(p => p.id === t.projeto_id))

  // Grupos que têm pelo menos um projeto nesta diretoria, em ordem canônica
  const gruposComProjetos = MACRO_GRUPOS_DIRETORIA.filter(g =>
    projetos.some(p => (g.statuses as readonly string[]).includes(p.status))
  )
  const idxGrupoAtual = gruposComProjetos.findIndex(g => g.macro === selectedMacro)
  const proximoGrupo  = idxGrupoAtual >= 0 ? gruposComProjetos[idxGrupoAtual + 1] : undefined

  // Ao finalizar os projetos de uma fase: vai para a próxima fase com projetos;
  // quando não há mais fases na diretoria, avança para a próxima diretoria.
  const irParaProximaFase: (() => void) | undefined = proximoGrupo
    ? () => setSelectedMacro(proximoGrupo.macro)
    : onNextSlide

  const labelProximaFase = proximoGrupo ? proximoGrupo.label : nextSlideLabel

  const voltarFases = () => setSelectedMacro(null)

  return (
    <div>
      {header}

      {/* Botão voltar para fases */}
      <div className="flex items-center gap-2 mb-4 -mt-2">
        <button
          onClick={voltarFases}
          className="flex items-center gap-1 text-sm text-[#003087] hover:underline font-medium"
        >
          <ChevronLeft size={15} /> Fases
        </button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: grupoAtual.cor }} />
          <span className="text-sm font-semibold text-gray-700">{grupoAtual.label}</span>
          <span className="text-xs text-gray-400">— {projetosGrupo.length} {projetosGrupo.length === 1 ? 'projeto' : 'projetos'}</span>
        </div>
      </div>

      {/* Apresentação projeto-a-projeto usando os componentes existentes */}
      {selectedMacro === 'MACRO_PROPOSTA' && (
        <SlidePropostasDetalhe
          projetos={projetosGrupo}
          detalhe={propostaDetalheFiltrado}
          diretorias={diretorias}
          comiteId={comiteId}
          decisoes={decisoes}
          podeGerenciar={podeGerenciar}
          onRefresh={onRefresh}
          onNextSlide={irParaProximaFase}
          nextSlideLabel={labelProximaFase}
        />
      )}
      {selectedMacro === 'MACRO_VIABILIDADE' && (
        <SlideViabilidadeDetalhe
          projetos={projetosGrupo}
          detalhe={viabilidadeDetalheFiltrado}
          diretorias={diretorias}
          comiteId={comiteId}
          decisoes={decisoes}
          podeGerenciar={podeGerenciar}
          onRefresh={onRefresh}
          onNextSlide={irParaProximaFase}
          nextSlideLabel={labelProximaFase}
        />
      )}
      {selectedMacro === 'MACRO_EXECUCAO' && (
        <SlideExecucaoDetalhe
          projetos={projetosGrupo}
          detalhe={execucaoDetalheFiltrado}
          tarefas={tarefasFiltradas}
          pendencias={pendencias}
          diretorias={diretorias}
          comiteId={comiteId}
          decisoes={decisoes}
          podeGerenciar={podeGerenciar}
          onRefresh={onRefresh}
          onNextSlide={irParaProximaFase}
          nextSlideLabel={labelProximaFase}
        />
      )}
      {selectedMacro === 'MACRO_PAYBACK' && (
        <SlidePayback
          projetos={projetosGrupo}
          onNextSlide={irParaProximaFase}
          nextSlideLabel={labelProximaFase}
        />
      )}
      {(selectedMacro === 'MACRO_ESTRUTURACAO' ||
        selectedMacro === 'MACRO_PAUSADO' ||
        selectedMacro === 'MACRO_PAYBACK') && (
        <SlideProjetosPorDiretoria
          titulo={grupoAtual.label}
          projetos={projetosGrupo}
          cor={grupoAtual.cor}
          diretorias={diretorias}
          onNextSlide={irParaProximaFase}
          nextSlideLabel={labelProximaFase}
        />
      )}
    </div>
  )
}

function SlideCapa({
  cfg, projetosCount, diretoriasCount, comiteData, onNext,
}: {
  cfg: CapaConfig
  projetosCount: number
  diretoriasCount: number
  comiteData: string
  onNext?: () => void
}) {
  const Icon = cfg.icon
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[500px] rounded-2xl relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${cfg.cor}15 0%, ${cfg.cor}08 100%)`, border: `2px solid ${cfg.cor}30` }}
    >
      {/* Accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={{ background: cfg.cor }} />

      {/* Content */}
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        {/* Icon badge */}
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg" style={{ background: `${cfg.cor}18`, border: `2px solid ${cfg.cor}40` }}>
          <Icon size={48} style={{ color: cfg.cor }} />
        </div>

        {/* Title */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: cfg.cor }}>{cfg.rotulo ?? 'Etapa'}</p>
          <h1 className="font-black text-gray-900 leading-tight" style={{ fontSize: '42px' }}>{cfg.titulo}</h1>
          <p className="text-gray-500 mt-2 text-lg">{cfg.subtitulo}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-8 mt-2">
          <div className="flex flex-col items-center">
            <span className="font-black text-gray-900" style={{ fontSize: '40px', color: cfg.cor }}>{projetosCount}</span>
            <span className="text-sm font-medium text-gray-500">{projetosCount === 1 ? 'Projeto' : 'Projetos'}</span>
          </div>
          {diretoriasCount > 0 && (
            <>
              <div className="w-px h-12 bg-gray-200" />
              <div className="flex flex-col items-center">
                <span className="font-black text-gray-900" style={{ fontSize: '40px' }}>{diretoriasCount}</span>
                <span className="text-sm font-medium text-gray-500">{diretoriasCount === 1 ? 'Diretoria' : 'Diretorias'}</span>
              </div>
            </>
          )}
        </div>

        {/* Date */}
        <p className="text-gray-400 text-sm flex items-center gap-1.5">
          <Calendar size={14} />{fmtDate(comiteData)}
        </p>

        {/* CTA */}
        {onNext && (
          <button
            onClick={onNext}
            className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-md hover:shadow-lg transition-all"
            style={{ background: cfg.cor }}
          >
            Ver Projetos <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── TI – Desenvolvimento ────────────────────────────────────────────────────

function ModalReprogramarTarefa({
  tarefa,
  onClose,
  onSuccess,
}: {
  tarefa: TITarefaCronogramaComite
  onClose: () => void
  onSuccess: () => void
}) {
  const [novaData, setNovaData] = useState(tarefa.data_fim ?? '')
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!novaData) { setErro('Informe a nova data de término.'); return }
    if (!justificativa.trim()) { setErro('Informe a justificativa.'); return }
    setSalvando(true); setErro(null)
    try {
      const res = await fetch(
        `/api/projetos/${tarefa.projeto_id}/cronograma/${tarefa.cronograma_id}/tarefas/${tarefa.id}/reprogramar`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nova_data: novaData, justificativa }),
        }
      )
      if (!res.ok) { const d = await res.json(); setErro(d.error ?? 'Erro ao reprogramar.'); return }
      onSuccess()
    } catch {
      setErro('Erro de comunicação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900">Reprogramar Tarefa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4 font-medium">{tarefa.nome}</p>
        <div className="space-y-4">
          <div>
            <label className="input-label">Nova Data de Término</label>
            <input type="date" className="input w-full" value={novaData} onChange={e => setNovaData(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Justificativa <span className="text-red-500">*</span></label>
            <textarea
              className="input w-full min-h-[80px] resize-none"
              placeholder="Descreva o motivo da reprogramação..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideTIDesenvolvimento({
  atividades,
  tarefasCronograma,
}: {
  atividades: TIAtividadeComite[]
  tarefasCronograma: TITarefaCronogramaComite[]
}) {
  const router = useRouter()
  const [reprogramar, setReprogramar] = useState<TITarefaCronogramaComite | null>(null)

  // Unify: DEV2026 with linked project + cronograma tasks
  type LinhaUnificada = {
    key: string
    projeto_codigo: string
    projeto_nome: string
    tarefa: string
    analista: string
    prazo: string | null
    prazo_status?: string | null
    fonte: 'dev2026' | 'cronograma'
    tarefaRef?: TITarefaCronogramaComite
  }

  const linhas: LinhaUnificada[] = [
    ...atividades
      .filter(a => !!a.projeto_codigo)
      .map(a => ({
        key: `dev-${a.id}`,
        projeto_codigo: a.projeto_codigo!,
        projeto_nome: a.projeto_nome || '',
        tarefa: a.nome,
        analista: a.responsavel || '—',
        prazo: a.fim_dev || null,
        prazo_status: null,
        fonte: 'dev2026' as const,
      })),
    ...tarefasCronograma.map(t => ({
      key: `cron-${t.id}`,
      projeto_codigo: t.projeto_codigo,
      projeto_nome: t.projeto_nome,
      tarefa: t.nome,
      analista: t.analista || '—',
      prazo: t.data_fim || null,
      prazo_status: t.prazo_status,
      fonte: 'cronograma' as const,
      tarefaRef: t,
    })),
  ]

  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4 flex items-center gap-2">
        <Monitor size={20} /> TI – Projetos em Desenvolvimento
      </h2>

      {linhas.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhuma atividade de TI vinculada a projetos no momento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-megag text-sm">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Tarefa do TI</th>
                <th>Analista</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.key}>
                  <td className="text-xs">
                    <span className="font-mono text-[#003087]">{l.projeto_codigo}</span>{' '}
                    <span className="text-gray-500">{l.projeto_nome}</span>
                    {l.fonte === 'dev2026' && (
                      <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 font-medium border border-purple-100">DEV2026</span>
                    )}
                  </td>
                  <td className="font-medium">{l.tarefa}</td>
                  <td>{l.analista}</td>
                  <td className="text-xs">
                    <div className="flex items-center gap-2">
                      {l.prazo ? (
                        <span className={l.prazo_status === 'ATRASADO' ? 'text-red-600 font-semibold' : l.prazo_status === 'EM_RISCO' ? 'text-yellow-600 font-semibold' : ''}>
                          {fmtDate(l.prazo)}
                        </span>
                      ) : '—'}
                      {l.fonte === 'cronograma' && l.tarefaRef && (
                        <button
                          onClick={() => setReprogramar(l.tarefaRef!)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium"
                          title="Reprogramar tarefa"
                        >
                          Reprogramar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reprogramar && (
        <ModalReprogramarTarefa
          tarefa={reprogramar}
          onClose={() => setReprogramar(null)}
          onSuccess={() => { setReprogramar(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// ─── TI – Prioridades ─────────────────────────────────────────────────────────

const PRIORIDADE_LABELS: Record<number, string> = {
  0: 'Prioridade 0 — Crítica',
  1: 'Prioridade 1 — Alta',
  2: 'Prioridade 2 — Média',
  3: 'Prioridade 3 — Baixa',
  4: 'Prioridade 4 — Mínima',
}

const PRIORIDADE_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800',
  1: 'bg-orange-100 text-orange-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-gray-100 text-gray-600',
}

function CardTIPrioridade({
  atividade,
  comiteId,
  podeConfirmar,
  session,
  onRefresh,
}: {
  atividade: TIAtividadeComite
  comiteId: number
  podeConfirmar: boolean
  session: SessionUser
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [prioSelecionada, setPrioSelecionada] = useState<number | ''>(
    typeof atividade.prioridade === 'number' ? atividade.prioridade : ''
  )
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const jaTemPrioridade = typeof atividade.prioridade === 'number'
  const confirmada = atividade.prioridade_confirmada
  const dbId = atividade.prioridade_db_id

  const handleDefinir = async () => {
    if (prioSelecionada === '') return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/ti/prioridades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atividade_id: atividade.id, prioridade: prioSelecionada }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erro ao salvar prioridade')
      } else {
        setSucesso('Prioridade definida!')
        setTimeout(() => { setSucesso(null); onRefresh() }, 1200)
      }
    } catch { setError('Erro de rede') }
    finally { setSaving(false) }
  }

  const handleConfirmar = async () => {
    if (!dbId) return
    setConfirming(true); setError(null)
    try {
      const res = await fetch(`/api/ti/prioridades/${dbId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comite_id: comiteId }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erro ao confirmar prioridade')
      } else {
        setSucesso('Prioridade confirmada no comitê!')
        setTimeout(() => { setSucesso(null); onRefresh() }, 1500)
      }
    } catch { setError('Erro de rede') }
    finally { setConfirming(false) }
  }

  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header clicável */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{atividade.nome}</span>
            {confirmada && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <ShieldCheck size={11} /> CONFIRMADA
              </span>
            )}
            {jaTemPrioridade && !confirmada && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORIDADE_COLORS[atividade.prioridade as number]}`}>
                {PRIORIDADE_LABELS[atividade.prioridade as number]}
              </span>
            )}
            {!jaTemPrioridade && (
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">Sem prioridade</span>
            )}
          </div>
          {atividade.requisito && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{atividade.requisito}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{atividade.responsavel || '—'}</span>
      </button>

      {/* Conteúdo expandido */}
      {open && (
        <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
          <div className="pt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-500">Analista</span>
              <p className="font-medium">{atividade.responsavel || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Situação</span>
              <p className="font-medium">{atividade.progresso}</p>
            </div>
            {atividade.inicio_dev && (
              <div>
                <span className="text-xs text-gray-500">Início previsto</span>
                <p className="font-medium">{fmtDate(atividade.inicio_dev)}</p>
              </div>
            )}
            {atividade.fim_dev && (
              <div>
                <span className="text-xs text-gray-500">Fim previsto</span>
                <p className="font-medium">{fmtDate(atividade.fim_dev)}</p>
              </div>
            )}
          </div>

          {/* Confirmada — apenas exibe */}
          {confirmada && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <Lock size={14} className="text-green-600" />
              <div className="text-sm">
                <span className="font-semibold text-green-700">Prioridade confirmada no comitê</span>
                {atividade.confirmada_por_nome && (
                  <span className="text-green-600"> · por {atividade.confirmada_por_nome}</span>
                )}
              </div>
            </div>
          )}

          {/* Definir / ajustar prioridade (só se não confirmada) */}
          {!confirmada && podeConfirmar && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Definir prioridade</label>
              <div className="flex gap-2">
                <select
                  className="input text-sm flex-1"
                  value={prioSelecionada}
                  onChange={e => setPrioSelecionada(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">— Selecionar —</option>
                  {[0, 1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{PRIORIDADE_LABELS[n]}</option>
                  ))}
                </select>
                <button
                  className="btn-primary text-sm px-3 py-1.5"
                  disabled={prioSelecionada === '' || saving}
                  onClick={handleDefinir}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>

              {/* Confirmar no comitê (só se já tem DB id e prioridade definida) */}
              {jaTemPrioridade && dbId && (
                <button
                  className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5 py-2"
                  disabled={confirming}
                  onClick={handleConfirmar}
                >
                  {confirming ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Confirmar Prioridade no Comitê
                </button>
              )}
            </div>
          )}

          {/* Erros / Sucesso */}
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          {sucesso && <p className="text-xs text-green-600 font-medium">{sucesso}</p>}
        </div>
      )}
    </div>
  )
}

function SlideTIPrioridades({
  atividades,
  comiteId,
  podeConfirmar,
  onRefresh,
  session,
}: {
  atividades: TIAtividadeComite[]
  comiteId: number
  podeConfirmar: boolean
  onRefresh: () => void
  session: SessionUser
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-1 flex items-center gap-2">
        <Target size={20} /> TI – Prioridades Aguardando Definição
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Itens sem prioridade definida. Defina e confirme a prioridade neste comitê para mover o item para Aguardando Desenvolvimento.
      </p>

      {atividades.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Nenhum item aguardando definição de prioridade.
        </div>
      ) : (
        <div className="space-y-3">
          {atividades.map(a => (
            <CardTIPrioridade
              key={a.id}
              atividade={a}
              comiteId={comiteId}
              podeConfirmar={podeConfirmar}
              session={session}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Histórico ────────────────────────────────────────────────────────────────

function SlideHistorico({ historico }: { historico: HistoricoComite[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#003087] mb-4">Histórico de Comitês</h2>
      {historico.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">Nenhum histórico disponível</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-megag">
            <thead><tr><th>Data</th><th>Título</th><th>Tipo</th><th>Projetos</th><th></th></tr></thead>
            <tbody>
              {historico.map(c => (
                <tr key={c.id}>
                  <td className="text-sm">{fmtDate(c.data_realizacao)}</td>
                  <td className="font-medium text-sm">{c.titulo}</td>
                  <td>
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{c.tipo}</span>
                  </td>
                  <td className="text-sm text-center">{c.num_projetos}</td>
                  <td>
                    <a href={`/comites/${c.id}`} className="text-xs text-[#003087] hover:underline">Ver</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
