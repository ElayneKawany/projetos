'use client'

import { useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface ProjetoFinanceiro {
  id: number; codigo: string; nome: string; status: string; diretoria_nome: string
  capex_aprovado: number; opex_aprovado: number; capex_realizado: number; opex_realizado: number
}

interface Props {
  projetos: ProjetoFinanceiro[]
  configFinanceira: Record<string, number>
  ultimosLancamentos: {
    id: number; tipo: string; descricao: string; valor: number; data_lancamento: string
    projeto_nome: string; projeto_codigo: string; criador_nome: string; status: string
  }[]
  session: SessionUser
}

export default function FinanceiroClient({ projetos, configFinanceira, ultimosLancamentos, session }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<'resumo'|'lancamentos'>('resumo')

  const totalCapexPlan = projetos.reduce((a, p) => a + p.capex_aprovado, 0)
  const totalOpexPlan  = projetos.reduce((a, p) => a + p.opex_aprovado, 0)
  const totalCapexReal = projetos.reduce((a, p) => a + p.capex_realizado, 0)
  const totalOpexReal  = projetos.reduce((a, p) => a + p.opex_realizado, 0)
  const totalPlan = totalCapexPlan + totalOpexPlan
  const totalReal = totalCapexReal + totalOpexReal

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Controle de CAPEX e OPEX por projeto</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Investimento Planejado', valor: fmt(totalPlan), icon: DollarSign, cor: 'text-megag-azul', bg: 'bg-megag-azul/10' },
          { label: 'Realizado', valor: fmt(totalReal), icon: TrendingUp, cor: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Saldo', valor: fmt(totalPlan - totalReal), icon: totalPlan - totalReal < 0 ? TrendingDown : TrendingUp,
            cor: totalPlan - totalReal < 0 ? 'text-red-500' : 'text-megag-cinza-escuro', bg: 'bg-megag-cinza-claro' },
          { label: '% Executado', valor: totalPlan > 0 ? `${((totalReal/totalPlan)*100).toFixed(1)}%` : '—',
            icon: DollarSign, cor: 'text-megag-dourado-escuro', bg: 'bg-megag-dourado/10' },
        ].map(kpi => (
          <div key={kpi.label} className="card flex items-center gap-3 py-4">
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
              <kpi.icon size={20} className={kpi.cor} />
            </div>
            <div>
              <p className={`text-lg font-bold font-display ${kpi.cor}`}>{kpi.valor}</p>
              <p className="text-xs text-megag-cinza-texto font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Configuração global */}
      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Premissas Financeiras Globais</span></div>
        <div className="flex flex-wrap gap-6 text-sm">
          {[
            { label: 'SELIC', chave: 'selic' },
            { label: 'Taxa de Desconto', chave: 'taxa_desconto' },
            { label: 'Inflação', chave: 'inflacao' },
          ].map(item => (
            <div key={item.chave} className="flex items-center gap-3 bg-megag-cinza-claro px-4 py-2 rounded-lg">
              <span className="text-megag-cinza-texto font-medium">{item.label}:</span>
              <span className="font-bold text-megag-azul">
                {configFinanceira[item.chave] ? `${configFinanceira[item.chave]}%` : '—'}
              </span>
            </div>
          ))}
          {['ADMIN','PMO'].includes(session.perfil) && (
            <button className="btn-ghost text-sm">Editar premissas</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-list">
        {(['resumo','lancamentos'] as const).map(t => (
          <button key={t} className={`tab-item ${abaAtiva === t ? 'active' : ''}`} onClick={() => setAbaAtiva(t)}>
            {t === 'resumo' ? 'Resumo por Projeto' : 'Últimos Lançamentos'}
          </button>
        ))}
      </div>

      {abaAtiva === 'resumo' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-megag">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>CAPEX Plan.</th><th>CAPEX Real.</th><th>CAPEX Saldo</th>
                  <th>OPEX Plan.</th><th>OPEX Real.</th><th>OPEX Saldo</th>
                  <th>% Exec.</th>
                </tr>
              </thead>
              <tbody>
                {projetos.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-megag-cinza-texto">Nenhum projeto com orçamento cadastrado.</td></tr>
                ) : projetos.filter(p => p.capex_aprovado > 0 || p.opex_aprovado > 0).map(p => {
                  const totalProj = p.capex_aprovado + p.opex_aprovado
                  const realProj  = p.capex_realizado + p.opex_realizado
                  const pct = totalProj > 0 ? ((realProj / totalProj) * 100) : 0
                  const capexSaldo = p.capex_aprovado - p.capex_realizado
                  const opexSaldo  = p.opex_aprovado - p.opex_realizado
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="font-mono text-megag-azul text-xs font-semibold">{p.codigo}</span>
                        <p className="text-sm font-medium">{p.nome}</p>
                        <p className="text-xs text-megag-cinza-texto">{p.diretoria_nome}</p>
                      </td>
                      <td className="text-sm">{fmt(p.capex_aprovado)}</td>
                      <td className="text-sm">{fmt(p.capex_realizado)}</td>
                      <td className={`text-sm font-medium ${capexSaldo < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(capexSaldo)}</td>
                      <td className="text-sm">{fmt(p.opex_aprovado)}</td>
                      <td className="text-sm">{fmt(p.opex_realizado)}</td>
                      <td className={`text-sm font-medium ${opexSaldo < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(opexSaldo)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-megag-cinza-medio rounded-full h-2 min-w-[40px]">
                            <div className={`h-2 rounded-full ${pct > 100 ? 'bg-red-400' : 'bg-megag-azul'}`} style={{ width: `${Math.min(100,pct)}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${pct > 100 ? 'text-red-500' : 'text-megag-cinza-texto'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === 'lancamentos' && (
        <div className="card p-0 overflow-hidden">
          <table className="table-megag">
            <thead>
              <tr>
                <th>Data</th><th>Projeto</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Por</th>
              </tr>
            </thead>
            <tbody>
              {ultimosLancamentos.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-megag-cinza-texto">Nenhum lançamento encontrado.</td></tr>
              ) : ultimosLancamentos.map(l => (
                <tr key={l.id}>
                  <td className="text-sm">{new Date(l.data_lancamento).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span className="font-mono text-megag-azul text-xs font-semibold">{l.projeto_codigo}</span>
                    <p className="text-xs text-megag-cinza-texto truncate max-w-[150px]">{l.projeto_nome}</p>
                  </td>
                  <td><span className={`badge ${l.tipo === 'CAPEX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{l.tipo}</span></td>
                  <td className="text-sm max-w-[200px]"><p className="truncate">{l.descricao}</p></td>
                  <td className="font-semibold text-sm">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${l.status==='APROVADO' ? 'bg-green-100 text-green-700' : l.status==='REJEITADO' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{l.status}</span></td>
                  <td className="text-xs text-megag-cinza-texto">{l.criador_nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
