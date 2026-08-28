'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  FolderKanban, TrendingUp, AlertTriangle, Clock,
  DollarSign, CalendarDays, CheckSquare, ArrowRight,
  ArrowUpDown, SortAsc,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/auth'
import type { StatusProjeto, Prioridade, DiretoriaDashboard } from '@/types'
import { STATUS_LABELS, PRIORIDADE_LABELS } from '@/types'
import { gerarSiglaDiretoria } from '@/lib/utils/diretoria'
import type { ProximaTarefaItem, ResponsavelAtrasos } from '@/lib/meu-trabalho'
import TarefasProximasVencimento from '@/components/dashboard/TarefasProximasVencimento'
import TarefasAtrasadas from '@/components/dashboard/TarefasAtrasadas'

// ── Grupos de status para os cards por diretoria ──────────────────────────────
const STATUS_GRUPOS = [
  {
    label: 'Proposta / Ideia',
    statuses: ['PROPOSTA', 'TRIAGEM', 'COMITE_IDEIAS'],
    cor: '#3B82F6',
    bg: 'rgba(59,130,246,0.10)',
  },
  {
    label: 'TAP',
    statuses: ['COMPLEMENTACAO_TAP'],
    cor: '#1D4ED8',
    bg: 'rgba(29,78,216,0.10)',
  },
  {
    label: 'Estudo de Viabilidade',
    statuses: ['VIABILIDADE'],
    cor: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
  },
  {
    label: 'Aguardando Aprovação',
    statuses: ['APROVACAO'],
    cor: '#9333EA',
    bg: 'rgba(147,51,234,0.10)',
  },
  {
    label: 'Estruturação',
    statuses: ['ESTRUTURACAO'],
    cor: '#EA580C',
    bg: 'rgba(234,88,12,0.10)',
  },
  {
    label: 'Cronograma',
    statuses: ['CRONOGRAMA'],
    cor: '#D97706',
    bg: 'rgba(217,119,6,0.10)',
  },
  {
    label: 'Em Execução',
    statuses: ['EXECUCAO'],
    cor: '#16A34A',
    bg: 'rgba(22,163,74,0.10)',
  },
  {
    label: 'Projeto Concluído',
    statuses: ['PROJETO_CONCLUIDO'],
    cor: '#059669',
    bg: 'rgba(5,150,105,0.10)',
  },
  {
    label: 'Acompanhamento Payback',
    statuses: ['PAYBACK_ACOMPANHAMENTO'],
    cor: '#0E7490',
    bg: 'rgba(14,116,144,0.10)',
  },
  {
    label: 'Pausado',
    statuses: ['PAUSADO', 'SUSPENSO'],
    cor: '#6B7280',
    bg: 'rgba(107,114,128,0.10)',
  },
  {
    label: 'Encerrado',
    statuses: ['PROJETO_ENCERRADO', 'PAYBACK_ENCERRADO', 'ENCERRAMENTO', 'CANCELADO'],
    cor: '#111827',
    bg: 'rgba(17,24,39,0.08)',
  },
]

interface Props {
  dados: {
    total_projetos: number
    projetos_ativos: number
    projetos_atrasados: number
    aprovacoes_pendentes: number
    payback_medio: number
    proximos_comites: { id: number; titulo: string; data_realizacao: string; tipo: string }[]
    por_status: { status: string; total: number }[]
    por_prioridade: { prioridade: string; total: number }[]
    investimento_total: number
    projetos_no_prazo: number
    projetos_atencao: number
    projetos_atrasados_prazo: number
    projetos_sem_cronograma: number
    projetos_pausados: number
    projetos_concluidos: number
    projetos_encerrados: number
    por_diretoria: DiretoriaDashboard[]
    beneficio_realizado: number
  }
  session: SessionUser
  tarefasProximas: { total: number; itens: ProximaTarefaItem[] }
  tarefasAtrasadas: { total_projetos: number; porResponsavel: ResponsavelAtrasos[] }
}

function fBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`
  return `R$ ${v.toFixed(0)}`
}

function fBRLCompacto(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1).replace('.', ',')} Bi`
  if (v >= 1_000_000)     return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} Mi`
  if (v >= 1_000)         return `R$ ${(v / 1_000).toFixed(0)} Mil`
  return `R$ ${v.toFixed(0)}`
}

function fBRLCompleto(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Card individual de diretoria
function CardDiretoria({ d, onNavigate }: { d: DiretoriaDashboard; onNavigate: (diretoria: number, statuses?: string) => void }) {
  const sigla = gerarSiglaDiretoria(d.diretoria_nome)
  const statusCounts = d.status_counts ?? {}

  return (
    <div className="card flex flex-col h-full hover:shadow-megag-md transition-shadow">
      {/* Cabeçalho — sigla + nome */}
      <div
        className="cursor-pointer pb-3 border-b border-megag-cinza-medio"
        onClick={() => onNavigate(d.diretoria_id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p
              className="text-2xl font-black text-megag-azul tracking-tight leading-none"
              title={d.diretoria_nome}
            >
              {sigla}
            </p>
            <p className="text-xs text-megag-cinza-texto mt-0.5 leading-tight">{d.diretoria_nome}</p>
          </div>
          {d.atrasados > 0 && (
            <span className="mt-0.5 shrink-0 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {d.atrasados} atrasado{d.atrasados > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Total de projetos */}
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-4xl font-black font-display text-megag-preto leading-none">
            {d.total}
          </span>
          <span className="text-sm text-megag-cinza-texto font-medium">
            projeto{d.total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Linhas de status */}
      <div className="flex-1 py-2 space-y-0.5">
        {STATUS_GRUPOS.map(grupo => {
          const qtd = grupo.statuses.reduce((s, st) => s + (statusCounts[st] ?? 0), 0)
          if (qtd === 0) return null
          const statusParam = grupo.statuses.join(',')
          return (
            <button
              key={grupo.label}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:opacity-90 transition-opacity text-left"
              style={{ backgroundColor: grupo.bg }}
              onClick={() => onNavigate(d.diretoria_id, statusParam)}
            >
              <span className="text-xs font-medium" style={{ color: grupo.cor }}>
                {grupo.label}
              </span>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-md min-w-[24px] text-center"
                style={{ backgroundColor: grupo.cor, color: '#fff' }}
              >
                {qtd}
              </span>
            </button>
          )
        })}
      </div>

      {/* Rodapé financeiro */}
      <div className="pt-3 border-t border-megag-cinza-medio mt-1 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-megag-cinza-texto">Investimento previsto</span>
          <span className="font-semibold text-megag-preto">{fBRL(d.investimento_previsto)}</span>
        </div>
        {d.investimento_realizado > 0 && (
          <div className="flex justify-between">
            <span className="text-megag-cinza-texto">Realizado</span>
            <span className="font-semibold text-megag-preto">{fBRL(d.investimento_realizado)}</span>
          </div>
        )}
        {d.roi_medio !== null && d.roi_medio > 0 && (
          <div className="flex justify-between">
            <span className="text-megag-cinza-texto">ROI médio</span>
            <span className="font-semibold text-emerald-700">{d.roi_medio.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardClient({ dados, session, tarefasProximas, tarefasAtrasadas }: Props) {
  const router = useRouter()
  const ehExecutivo = ['CEO', 'DIRETOR'].includes(session.perfil)
  const [ordenacao, setOrdenacao] = useState<'total' | 'nome'>('total')

  function irParaProjetos(diretoria: number, statuses?: string) {
    const params = new URLSearchParams()
    params.set('diretoria', String(diretoria))
    if (statuses) params.set('status', statuses)
    router.push(`/projetos?${params.toString()}`)
  }

  const kpis = [
    {
      label: 'Total de Projetos',
      valor: String(dados.total_projetos),
      tooltip: null,
      icon: FolderKanban,
      cor: 'text-megag-azul',
      bg: 'bg-megag-azul/10',
      href: '/projetos',
    },
    {
      label: 'Projetos Ativos',
      valor: String(dados.projetos_ativos),
      tooltip: null,
      icon: TrendingUp,
      cor: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/projetos',
    },
    {
      label: 'Projetos Atrasados',
      valor: String(dados.projetos_atrasados),
      tooltip: null,
      icon: AlertTriangle,
      cor: dados.projetos_atrasados > 0 ? 'text-red-500' : 'text-megag-cinza-texto',
      bg: dados.projetos_atrasados > 0 ? 'bg-red-50' : 'bg-megag-cinza-claro',
      href: '/projetos',
    },
    {
      label: 'Investimento Total',
      valor: fBRLCompacto(dados.investimento_total),
      tooltip: fBRLCompleto(dados.investimento_total),
      icon: DollarSign,
      cor: 'text-megag-dourado-escuro',
      bg: 'bg-megag-dourado/10',
      href: '/financeiro',
    },
    {
      label: 'Benefício Realizado',
      valor: fBRLCompacto(dados.beneficio_realizado ?? 0),
      tooltip: fBRLCompleto(dados.beneficio_realizado ?? 0),
      icon: TrendingUp,
      cor: dados.beneficio_realizado > 0 ? 'text-teal-700' : 'text-megag-cinza-texto',
      bg: dados.beneficio_realizado > 0 ? 'bg-teal-50' : 'bg-megag-cinza-claro',
      href: '/projetos',
    },
  ]

  // Agrupa os status brutos nos 10 grupos oficiais, na ordem do fluxo
  const rawCounts = Object.fromEntries(dados.por_status.map(s => [s.status, s.total]))
  const porStatusData = STATUS_GRUPOS
    .map(g => ({
      name: g.label,
      total: g.statuses.reduce((acc, st) => acc + (rawCounts[st] ?? 0), 0),
      cor: g.cor,
      statusParam: g.statuses.join(','),
    }))
    .filter(d => d.total > 0)

  const porPrioridadeData = dados.por_prioridade.map(p => ({
    name: PRIORIDADE_LABELS[p.prioridade as Prioridade] || p.prioridade,
    value: p.total,
    color: ({ ALTA: '#EF4444', MEDIA: '#F59E0B', BAIXA: '#10B981' } as Record<string, string>)[p.prioridade] || '#94A3B8',
  }))

  const diretorias = [...dados.por_diretoria].sort((a, b) =>
    ordenacao === 'total' ? b.total - a.total : a.diretoria_nome.localeCompare(b.diretoria_nome)
  )

  return (
    <div className="animate-fade-in">
      {/* Cabeçalho */}
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">
            {ehExecutivo ? 'Dashboard Executivo' : 'Dashboard PMO'}
          </h1>
          <p className="page-subtitle">
            Bem-vindo, {session.nome.split(' ')[0]}.{' '}
            {session.diretoria_nome ? `Diretoria: ${session.diretoria_nome}.` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-megag-cinza-texto">
          <p className="font-semibold">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── 1. Indicadores Gerais ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {kpis.map(kpi => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="kpi-card hover:shadow-megag-md transition-shadow"
            title={kpi.tooltip ?? undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon size={18} className={kpi.cor} />
              </div>
            </div>
            <p className={`kpi-value ${kpi.cor}`}>{kpi.valor}</p>
            <p className="kpi-label">{kpi.label}</p>
          </Link>
        ))}
      </div>

      {/* ── 2. Tarefas Atrasadas + Tarefas Próximas ao Vencimento ── */}
      <TarefasAtrasadas
        totalProjetos={tarefasAtrasadas.total_projetos}
        porResponsavel={tarefasAtrasadas.porResponsavel}
      />
      <TarefasProximasVencimento
        total={tarefasProximas.total}
        itens={tarefasProximas.itens}
        verTodasHref="/proximas-tarefas"
      />

      {/* ── 3. Carteira por Diretoria ── */}
      {diretorias.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-megag-cinza-texto uppercase tracking-wide">
              Carteira por Diretoria
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-megag-cinza-texto">Ordenar por:</span>
              <button
                onClick={() => setOrdenacao(o => o === 'total' ? 'nome' : 'total')}
                className="btn-ghost text-xs flex items-center gap-1 py-1 px-2"
              >
                {ordenacao === 'total' ? <ArrowUpDown size={12} /> : <SortAsc size={12} />}
                {ordenacao === 'total' ? 'Quantidade' : 'Nome'}
              </button>
            </div>
          </div>

          {/* Grid responsivo: 4 / 3 / 2 / 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {diretorias.map(d => (
              <CardDiretoria
                key={d.diretoria_id}
                d={d}
                onNavigate={irParaProjetos}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Projetos por Status + Por Prioridade ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <span className="card-title">Projetos por Status</span>
            <Link href="/projetos" className="text-xs text-megag-azul hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {porStatusData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-megag-cinza-texto text-sm">
              Nenhum projeto cadastrado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={porStatusData}
                margin={{ top: 4, right: 4, bottom: 48, left: 0 }}
                onClick={e => {
                  const sp = e?.activePayload?.[0]?.payload?.statusParam
                  if (sp) router.push(`/projetos?status=${sp}`)
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  angle={-35}
                  textAnchor="end"
                  height={56}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  formatter={(value: number) => [`${value} projeto${value !== 1 ? 's' : ''}`, '']}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {porStatusData.map((entry, index) => (
                    <Cell key={index} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Por Prioridade</span>
          </div>
          {porPrioridadeData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-megag-cinza-texto text-sm">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={porPrioridadeData}
                  cx="50%" cy="45%"
                  innerRadius={55} outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {porPrioridadeData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 5. Próximos comitês + Acesso rápido ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <CalendarDays size={16} className="text-megag-azul" />
              Próximos Comitês
            </span>
            <Link href="/comites" className="text-xs text-megag-azul hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {dados.proximos_comites.length === 0 ? (
            <p className="text-megag-cinza-texto text-sm text-center py-6">Nenhum comitê agendado.</p>
          ) : (
            <div className="space-y-2">
              {dados.proximos_comites.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-megag-cinza-claro rounded-lg">
                  <div className="w-10 h-10 bg-megag-azul rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {new Date(c.data_realizacao).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-megag-preto truncate">{c.titulo}</p>
                    <p className="text-xs text-megag-cinza-texto">
                      {new Date(c.data_realizacao).toLocaleDateString('pt-BR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="badge bg-blue-100 text-blue-700 text-xs">{c.tipo}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Acesso Rápido</span></div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Novo Projeto',  href: '/projetos',    icon: FolderKanban, cor: 'bg-megag-azul/10 text-megag-azul' },
              { label: 'Aprovações',    href: '/aprovacoes',  icon: CheckSquare,  cor: 'bg-amber-50 text-amber-600' },
              { label: 'Documentos',    href: '/documentos',  icon: FolderKanban, cor: 'bg-emerald-50 text-emerald-600' },
              { label: 'Auditoria',     href: '/auditoria',   icon: Clock,        cor: 'bg-purple-50 text-purple-600' },
              { label: 'Cronogramas',   href: '/cronogramas', icon: CalendarDays, cor: 'bg-sky-50 text-sky-600' },
              { label: 'Financeiro',    href: '/financeiro',  icon: DollarSign,   cor: 'bg-megag-dourado/10 text-megag-dourado-escuro' },
            ].map(item => (
              <Link key={item.label} href={item.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-megag-cinza-claro transition-colors group">
                <div className={`w-9 h-9 rounded-xl ${item.cor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon size={16} />
                </div>
                <span className="text-sm font-medium text-megag-cinza-escuro group-hover:text-megag-azul transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
