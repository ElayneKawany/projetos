'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { FolderKanban, TrendingUp, AlertTriangle, Clock, DollarSign, CalendarDays, CheckSquare, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/auth'
import type { StatusProjeto, Prioridade } from '@/types'
import { STATUS_LABELS, PRIORIDADE_LABELS } from '@/types'

const CORES_PRIORIDADE = { ALTA: '#EF4444', MEDIA: '#F59E0B', BAIXA: '#10B981' }
const CORES_STATUS = ['#003087','#1a4fa0','#C8A84B','#10B981','#EF4444','#F59E0B','#8B5CF6','#0EA5E9']

interface Props {
  dados: {
    total_projetos: number
    projetos_ativos: number
    projetos_atrasados: number
    aprovacoes_pendentes: number
    roi_medio: number
    payback_medio: number
    proximos_comites: { id: number; titulo: string; data_realizacao: string; tipo: string }[]
    por_status: { status: string; total: number }[]
    por_prioridade: { prioridade: string; total: number }[]
    investimento_total: number
  }
  session: SessionUser
}

export default function DashboardClient({ dados, session }: Props) {
  const ehExecutivo = ['CEO', 'DIRETOR'].includes(session.perfil)

  const kpis = [
    {
      label: 'Total de Projetos',
      valor: dados.total_projetos,
      icon: FolderKanban,
      cor: 'text-megag-azul',
      bg: 'bg-megag-azul/10',
      href: '/projetos',
    },
    {
      label: 'Projetos Ativos',
      valor: dados.projetos_ativos,
      icon: TrendingUp,
      cor: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/projetos',
    },
    {
      label: 'Projetos Atrasados',
      valor: dados.projetos_atrasados,
      icon: AlertTriangle,
      cor: dados.projetos_atrasados > 0 ? 'text-red-500' : 'text-megag-cinza-texto',
      bg: dados.projetos_atrasados > 0 ? 'bg-red-50' : 'bg-megag-cinza-claro',
      href: '/projetos',
    },
    {
      label: 'Aprovações Pendentes',
      valor: dados.aprovacoes_pendentes,
      icon: CheckSquare,
      cor: dados.aprovacoes_pendentes > 0 ? 'text-amber-600' : 'text-megag-cinza-texto',
      bg: dados.aprovacoes_pendentes > 0 ? 'bg-amber-50' : 'bg-megag-cinza-claro',
      href: '/aprovacoes',
    },
    {
      label: 'Investimento Total',
      valor: `R$ ${(dados.investimento_total / 1_000_000).toFixed(1)}M`,
      isText: true,
      icon: DollarSign,
      cor: 'text-megag-dourado-escuro',
      bg: 'bg-megag-dourado/10',
      href: '/financeiro',
    },
    {
      label: 'ROI Médio Previsto',
      valor: dados.roi_medio > 0 ? `${dados.roi_medio.toFixed(1)}%` : '—',
      isText: true,
      icon: TrendingUp,
      cor: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/projetos',
    },
  ]

  const porStatusData = dados.por_status.map(s => ({
    name: STATUS_LABELS[s.status as StatusProjeto]?.split(' ')[0] || s.status,
    total: s.total,
  }))

  const porPrioridadeData = dados.por_prioridade.map(p => ({
    name: PRIORIDADE_LABELS[p.prioridade as Prioridade] || p.prioridade,
    value: p.total,
    color: CORES_PRIORIDADE[p.prioridade as Prioridade] || '#94A3B8',
  }))

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
          <p className="font-semibold">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpis.map(kpi => (
          <Link key={kpi.label} href={kpi.href} className="kpi-card hover:shadow-megag-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon size={18} className={kpi.cor} />
              </div>
            </div>
            <p className={`kpi-value ${kpi.cor}`}>
              {kpi.isText ? kpi.valor : kpi.valor}
            </p>
            <p className="kpi-label">{kpi.label}</p>
          </Link>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Por Status */}
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porStatusData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                  cursor={{ fill: '#003087', opacity: 0.08 }}
                />
                <Bar dataKey="total" fill="#003087" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por Prioridade */}
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

      {/* Próximos comitês + Ações rápidas */}
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
                      {new Date(c.data_realizacao).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="badge bg-blue-100 text-blue-700 text-xs">{c.tipo}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acesso rápido */}
        <div className="card">
          <div className="card-header"><span className="card-title">Acesso Rápido</span></div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Novo Projeto', href: '/projetos', icon: FolderKanban, cor: 'bg-megag-azul/10 text-megag-azul' },
              { label: 'Aprovações', href: '/aprovacoes', icon: CheckSquare, cor: 'bg-amber-50 text-amber-600' },
              { label: 'Documentos', href: '/documentos', icon: FolderKanban, cor: 'bg-emerald-50 text-emerald-600' },
              { label: 'Auditoria', href: '/auditoria', icon: Clock, cor: 'bg-purple-50 text-purple-600' },
              { label: 'Cronogramas', href: '/cronogramas', icon: CalendarDays, cor: 'bg-sky-50 text-sky-600' },
              { label: 'Financeiro', href: '/financeiro', icon: DollarSign, cor: 'bg-megag-dourado/10 text-megag-dourado-escuro' },
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
