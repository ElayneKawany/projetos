'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, PieChart, Pie, Cell,
  BarChart,
} from 'recharts'
import { Plus, Trash2, TrendingUp, DollarSign, Target, Clock, Activity } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'
import type { PaybackLancamentosResumo, PaybackLancamento, TipoBeneficioPayback } from '@/types'

interface Props {
  projetoId: number
  canEdit: boolean
  session: SessionUser
  onRefresh: () => void
}

// ── Formatação ────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}K`
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtComp(competencia: string) {
  const [ano, mes] = competencia.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[Number(mes) - 1]}/${ano.slice(2)}`
}

// ── Tipo de Benefício ─────────────────────────────────────────────────────────

const TIPOS_BENEFICIO: { value: TipoBeneficioPayback; label: string; cor: string; bg: string }[] = [
  { value: 'ECONOMIA_OPERACIONAL',  label: 'Economia Operacional',   cor: '#0E7490', bg: '#CFFAFE' },
  { value: 'AUMENTO_RECEITA',       label: 'Aumento de Receita',     cor: '#16A34A', bg: '#DCFCE7' },
  { value: 'REDUCAO_PERDAS',        label: 'Redução de Perdas',      cor: '#D97706', bg: '#FEF3C7' },
  { value: 'RECUPERACAO_TRIBUTARIA',label: 'Recuperação Tributária', cor: '#7C3AED', bg: '#EDE9FE' },
  { value: 'REDUCAO_CUSTOS',        label: 'Redução de Custos',      cor: '#DC2626', bg: '#FEE2E2' },
  { value: 'OUTRO',                 label: 'Outro',                  cor: '#64748B', bg: '#F1F5F9' },
]

function labelTipo(tipo?: string | null) {
  return TIPOS_BENEFICIO.find(t => t.value === tipo)?.label ?? '—'
}

function corTipo(tipo?: string | null) {
  return TIPOS_BENEFICIO.find(t => t.value === tipo)?.cor ?? '#64748B'
}

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  SEM_LANCAMENTOS: { label: 'Sem lançamentos', cor: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  EM_ANDAMENTO:    { label: 'Em andamento',     cor: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200' },
  CONCLUIDO:       { label: 'Payback Concluído',cor: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
}

// ── Gauge SVG ─────────────────────────────────────────────────────────────────

function GaugeChart({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const cx = 80, cy = 80, r = 60
  const startAngle = Math.PI         // 180°
  const endAngle   = 0               // 0° (meia-lua da esquerda → direita)
  const angle = startAngle - (clamped / 100) * Math.PI
  const x = cx + r * Math.cos(angle)
  const y = cy - r * Math.sin(angle)
  const largeArc = clamped > 50 ? 1 : 0
  const cor = clamped >= 100 ? '#16A34A' : clamped >= 50 ? '#0E7490' : '#F59E0B'

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <svg width={160} height={95} viewBox="0 0 160 95">
        {/* Trilha */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#E2E8F0" strokeWidth={14} strokeLinecap="round"
        />
        {/* Progresso */}
        {clamped > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`}
            fill="none" stroke={cor} strokeWidth={14} strokeLinecap="round"
          />
        )}
        {/* Ponteiro */}
        <circle cx={x} cy={y} r={5} fill={cor} />
        {/* Texto central */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight="700" fill={cor}>
          {clamped.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="#64748B">
          recuperado
        </text>
      </svg>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PaybackTab({ projetoId, canEdit, session, onRefresh }: Props) {
  const [resumo, setResumo] = useState<PaybackLancamentosResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [erro, setErro] = useState('')

  const formInicial = {
    competencia: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    investimento_periodo: '',
    beneficio_periodo: '',
    tipo_beneficio: '' as TipoBeneficioPayback | '',
    observacao: '',
  }
  const [form, setForm] = useState(formInicial)

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/projetos/${projetoId}/payback/lancamentos`)
      if (!res.ok) throw new Error('Erro ao carregar dados de payback')
      const data = await res.json()
      setResumo(data.resumo)
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { carregar() }, [carregar])

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.competencia) { setErro('Informe a competência (MM/AAAA).'); return }
    const inv = parseFloat(form.investimento_periodo.replace(',', '.')) || 0
    const ben = parseFloat(form.beneficio_periodo.replace(',', '.')) || 0
    if (inv === 0 && ben === 0) { setErro('Informe ao menos um valor maior que zero.'); return }

    const partes = form.competencia.split('/')
    if (partes.length !== 2 || partes[0].length !== 2 || partes[1].length !== 4) {
      setErro('Formato inválido. Use MM/AAAA.'); return
    }
    const competenciaISO = `${partes[1]}-${partes[0]}`

    setSalvando(true)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/payback/lancamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencia: competenciaISO,
          data_lancamento: form.data_lancamento,
          investimento_periodo: inv,
          beneficio_periodo: ben,
          tipo_beneficio: form.tipo_beneficio || null,
          observacao: form.observacao || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao salvar') }
      setForm(formInicial)
      await carregar()
      onRefresh()
    } catch (e) {
      setErro(String(e))
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(lancamento: PaybackLancamento) {
    if (!confirm(`Excluir lançamento de ${fmtComp(lancamento.competencia)}?`)) return
    setExcluindo(lancamento.id)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/payback/lancamentos/${lancamento.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      await carregar()
      onRefresh()
    } catch (e) {
      setErro(String(e))
    } finally {
      setExcluindo(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-megag-cinza-texto text-sm">Carregando...</div>
  if (!resumo)  return <div className="flex items-center justify-center h-48 text-red-500 text-sm">{erro || 'Erro ao carregar dados.'}</div>

  const sc = STATUS_CONFIG[resumo.status]
  const podeEditar = canEdit && ['ADMIN', 'PMO'].includes(session.perfil)
  const pct = Math.min(100, resumo.percentual_recuperado)

  // ── Dados para gráficos ───────────────────────────────────────────────────

  let cumBeneficio = 0
  const graficoBase = resumo.lancamentos.map(l => {
    cumBeneficio += l.beneficio_periodo
    return {
      comp: fmtComp(l.competencia),
      beneficioPeriodo:    l.beneficio_periodo,
      investimentoPeriodo: l.investimento_periodo,
      beneficioAcumulado:  cumBeneficio,
      tipo: l.tipo_beneficio,
    }
  })

  // Gráfico 4: empilhado por tipo — um campo por tipo
  const tiposPresentes = Array.from(new Set(resumo.lancamentos.map(l => l.tipo_beneficio ?? 'OUTRO'))) as TipoBeneficioPayback[]
  const graficoPorTipo = graficoBase.map(d => {
    const row: Record<string, number | string> = { comp: d.comp }
    for (const t of tiposPresentes) {
      row[t] = d.tipo === t ? d.beneficioPeriodo : 0
    }
    return row
  })

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: 'Investimento Aprovado',
      valor: fmt(resumo.investimento_aprovado),
      sub: `CAPEX ${fmt(resumo.capex_aprovado)} · OPEX ${fmt(resumo.opex_aprovado)}`,
      icon: DollarSign, cor: 'text-megag-azul', bg: 'bg-megag-azul/10',
    },
    {
      label: 'Investimento Realizado',
      valor: fmt(resumo.investimento_realizado),
      sub: resumo.investimento_aprovado > 0
        ? `${((resumo.investimento_realizado / resumo.investimento_aprovado) * 100).toFixed(1)}% do aprovado`
        : '—',
      icon: DollarSign, cor: 'text-amber-600', bg: 'bg-amber-50',
    },
    {
      label: 'Benefício Previsto',
      valor: resumo.beneficio_previsto != null ? fmt(resumo.beneficio_previsto) : '—',
      sub: resumo.payback_previsto_meses ? `Payback: ${resumo.payback_previsto_meses} meses` : '',
      icon: Target, cor: 'text-purple-600', bg: 'bg-purple-50',
    },
    {
      label: 'Benefício Acumulado',
      valor: fmt(resumo.beneficio_acumulado),
      sub: `${resumo.percentual_recuperado.toFixed(1)}% recuperado`,
      icon: TrendingUp, cor: 'text-emerald-600', bg: 'bg-emerald-50',
    },
    {
      label: 'Saldo Financeiro',
      valor: fmt(resumo.saldo_financeiro),
      sub: resumo.saldo_financeiro >= 0 ? 'Positivo' : 'Negativo',
      icon: Activity,
      cor: resumo.saldo_financeiro >= 0 ? 'text-green-600' : 'text-red-500',
      bg:  resumo.saldo_financeiro >= 0 ? 'bg-green-50'   : 'bg-red-50',
    },
    {
      label: 'Payback Real',
      valor: resumo.payback_real_meses ? `${resumo.payback_real_meses} meses` : '—',
      sub: resumo.data_golive
        ? `Go Live: ${resumo.data_golive.slice(0, 10).split('-').reverse().join('/')}`
        : 'Sem Go Live',
      icon: Clock, cor: 'text-teal-700', bg: 'bg-teal-50',
    },
  ]

  return (
    <div className="space-y-6">

      {/* Banner de status */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${sc.border} ${sc.bg}`}>
        <span className={`text-sm font-semibold shrink-0 ${sc.cor}`}>{sc.label}</span>
        {resumo.status !== 'SEM_LANCAMENTOS' && (
          <div className="flex-1">
            <div className="flex justify-between text-xs text-megag-cinza-texto mb-1">
              <span>Recuperação do investimento</span>
              <span className="font-semibold">{resumo.percentual_recuperado.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: resumo.status === 'CONCLUIDO' ? '#16A34A' : '#0E7490' }}
              />
            </div>
          </div>
        )}
        {resumo.valor_restante > 0 && (
          <span className="text-xs text-megag-cinza-texto shrink-0">
            Restam {fmt(resumo.valor_restante)}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="card py-3 px-4">
            <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
              <kpi.icon size={16} className={kpi.cor} />
            </div>
            <p className={`text-lg font-bold font-display ${kpi.cor}`}>{kpi.valor}</p>
            <p className="text-xs text-megag-cinza-texto font-medium mt-0.5">{kpi.label}</p>
            {kpi.sub && <p className="text-xs text-megag-cinza-texto mt-0.5 leading-tight">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Comparativo Planejado × Realizado */}
      <div className="card">
        <div className="card-header"><span className="card-title">Comparativo: Planejado × Realizado</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-megag-cinza-medio">
                {['Indicador', 'Planejado', 'Realizado', 'Variação'].map(h => (
                  <th key={h} className={`py-2 text-megag-cinza-texto font-medium ${h === 'Indicador' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-megag-cinza-medio">
              {[
                { label: 'Investimento Total',    plan: resumo.investimento_aprovado,  real: resumo.investimento_realizado, isNum: false, inverso: true  },
                { label: 'Benefício Financeiro',  plan: resumo.beneficio_previsto,      real: resumo.beneficio_acumulado,   isNum: false, inverso: false },
                { label: 'Payback (meses)',        plan: resumo.payback_previsto_meses, real: resumo.payback_real_meses,    isNum: true,  inverso: true  },
              ].map(row => {
                const planV = row.plan ?? null
                const realV = row.real ?? null
                const variacao = planV != null && realV != null ? realV - planV : null
                const positivo = variacao == null ? null : row.inverso ? variacao <= 0 : variacao >= 0
                return (
                  <tr key={row.label}>
                    <td className="py-2.5 font-medium text-megag-preto">{row.label}</td>
                    <td className="py-2.5 text-right text-megag-cinza-texto">
                      {planV != null ? (row.isNum ? `${planV} meses` : fmt(planV)) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-megag-preto">
                      {realV != null ? (row.isNum ? `${realV} meses` : fmt(realV)) : '—'}
                    </td>
                    <td className={`py-2.5 text-right text-xs font-medium ${variacao == null ? 'text-megag-cinza-texto' : positivo ? 'text-green-600' : 'text-red-500'}`}>
                      {variacao == null ? '—' : `${variacao >= 0 ? '+' : ''}${row.isNum ? `${variacao} meses` : fmt(Math.abs(variacao))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos — visíveis quando há lançamentos */}
      {graficoBase.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Gráfico 1 — Evolução do Benefício Acumulado */}
          <div className="card">
            <div className="card-header"><span className="card-title">Evolução do Benefício Acumulado</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={graficoBase} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="comp" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={48} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: number) => [fmt(v), '']}
                />
                {resumo.investimento_aprovado > 0 && (
                  <ReferenceLine
                    y={resumo.investimento_aprovado}
                    stroke="#EF4444" strokeDasharray="4 4"
                    label={{ value: 'Meta', position: 'insideTopRight', fontSize: 10, fill: '#EF4444' }}
                  />
                )}
                <Line type="monotone" dataKey="beneficioAcumulado" stroke="#0E7490" strokeWidth={2.5} dot={{ r: 3 }} name="Benefício Acumulado" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico 2 — Investimento × Benefício por Período */}
          <div className="card">
            <div className="card-header"><span className="card-title">Investimento × Benefício por Período</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={graficoBase} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="comp" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={48} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: number) => [fmt(v), '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="investimentoPeriodo" fill="#F59E0B" radius={[3, 3, 0, 0]} name="Investimento" maxBarSize={32} />
                <Bar dataKey="beneficioPeriodo"    fill="#0E7490" radius={[3, 3, 0, 0]} name="Benefício"    maxBarSize={32} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico 3 — Percentual de Recuperação (gauge) */}
          <div className="card">
            <div className="card-header"><span className="card-title">Percentual de Recuperação do Investimento</span></div>
            <div className="flex flex-col items-center justify-center py-2">
              <GaugeChart pct={pct} />
              <div className="flex gap-6 text-xs text-megag-cinza-texto mt-1">
                <span>Recuperado: <strong className="text-megag-preto">{fmt(resumo.beneficio_acumulado)}</strong></span>
                <span>Total: <strong className="text-megag-preto">{fmt(resumo.investimento_aprovado)}</strong></span>
              </div>
              {resumo.valor_restante > 0 && (
                <p className="text-xs text-megag-cinza-texto mt-1">
                  Restam <strong className="text-megag-preto">{fmt(resumo.valor_restante)}</strong> para recuperar
                </p>
              )}
            </div>
          </div>

          {/* Gráfico 4 — Evolução Mensal dos Benefícios por Tipo */}
          <div className="card">
            <div className="card-header"><span className="card-title">Evolução Mensal por Tipo de Benefício</span></div>
            {tiposPresentes.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-megag-cinza-texto text-xs">
                Classifique os lançamentos para visualizar esta análise.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={graficoPorTipo} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="comp" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={48} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number, name: string) => [fmt(v), labelTipo(name)]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '10px' }}
                      formatter={(value) => labelTipo(value)}
                    />
                    {tiposPresentes.map(t => (
                      <Bar key={t} dataKey={t} stackId="a" fill={corTipo(t)} maxBarSize={40} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {/* Legenda de cores dos tipos */}
                <div className="flex flex-wrap gap-2 px-4 pb-3 mt-1">
                  {tiposPresentes.map(t => {
                    const cfg = TIPOS_BENEFICIO.find(x => x.value === t)!
                    return (
                      <span key={t} className="flex items-center gap-1 text-xs text-megag-cinza-texto">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: cfg.cor }} />
                        {cfg.label}
                      </span>
                    )
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* Formulário de novo lançamento */}
      {podeEditar && (
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><Plus size={16} />Novo Lançamento</span>
          </div>
          <form onSubmit={handleSalvar} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            <div>
              <label className="input-label">Competência (MM/AAAA) *</label>
              <input
                className="input"
                placeholder="01/2025"
                value={form.competencia}
                onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))}
                maxLength={7}
              />
            </div>

            <div>
              <label className="input-label">Data do Lançamento *</label>
              <input
                type="date"
                className="input"
                value={form.data_lancamento}
                onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))}
              />
            </div>

            <div>
              <label className="input-label">Tipo do Benefício</label>
              <select
                className="input"
                value={form.tipo_beneficio}
                onChange={e => setForm(f => ({ ...f, tipo_beneficio: e.target.value as TipoBeneficioPayback | '' }))}
              >
                <option value="">Selecione…</option>
                {TIPOS_BENEFICIO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">Investimento no Período (R$)</label>
              <input
                className="input"
                placeholder="0,00"
                value={form.investimento_periodo}
                onChange={e => setForm(f => ({ ...f, investimento_periodo: e.target.value }))}
              />
            </div>

            <div>
              <label className="input-label">Benefício no Período (R$)</label>
              <input
                className="input"
                placeholder="0,00"
                value={form.beneficio_periodo}
                onChange={e => setForm(f => ({ ...f, beneficio_periodo: e.target.value }))}
              />
            </div>

            <div>
              <label className="input-label">Observação</label>
              <input
                className="input"
                placeholder="Opcional"
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              />
            </div>

            {erro && <p className="text-red-500 text-sm lg:col-span-3">{erro}</p>}
            <div className="lg:col-span-3 flex justify-end">
              <button type="submit" className="btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Lançamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de lançamentos */}
      <div className="card p-0 overflow-hidden">
        <div className="card-header px-4 pt-4">
          <span className="card-title">Histórico de Lançamentos ({resumo.lancamentos.length})</span>
        </div>
        {resumo.lancamentos.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-megag-cinza-texto text-sm">
            Nenhum lançamento registrado. Use o formulário acima para incluir o primeiro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-megag">
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Lançado em</th>
                  <th>Tipo de Benefício</th>
                  <th className="text-right">Investimento</th>
                  <th className="text-right">Benefício</th>
                  <th className="text-right">Ben. Acumulado</th>
                  <th>Observação</th>
                  <th>Usuário</th>
                  {podeEditar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let acum = 0
                  return resumo.lancamentos.map(l => {
                    acum += l.beneficio_periodo
                    const pctAcum = resumo.investimento_aprovado > 0
                      ? (acum / resumo.investimento_aprovado) * 100
                      : 0
                    const tipoCfg = TIPOS_BENEFICIO.find(t => t.value === l.tipo_beneficio)
                    return (
                      <tr key={l.id}>
                        <td className="font-semibold">{fmtComp(l.competencia)}</td>
                        <td className="text-sm text-megag-cinza-texto">
                          {l.data_lancamento.slice(0, 10).split('-').reverse().join('/')}
                        </td>
                        <td>
                          {tipoCfg ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: tipoCfg.bg, color: tipoCfg.cor }}
                            >
                              {tipoCfg.label}
                            </span>
                          ) : (
                            <span className="text-xs text-megag-cinza-texto">—</span>
                          )}
                        </td>
                        <td className="text-right text-amber-700 font-medium">{fmt(l.investimento_periodo)}</td>
                        <td className="text-right text-teal-700 font-medium">{fmt(l.beneficio_periodo)}</td>
                        <td className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-semibold text-megag-preto">{fmt(acum)}</span>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-600 rounded-full"
                                style={{ width: `${Math.min(100, pctAcum)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-sm text-megag-cinza-texto max-w-[160px] truncate">
                          {l.observacao || '—'}
                        </td>
                        <td className="text-xs text-megag-cinza-texto">{l.usuario_nome || '—'}</td>
                        {podeEditar && (
                          <td>
                            <button
                              onClick={() => handleExcluir(l)}
                              disabled={excluindo === l.id}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Excluir lançamento"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
