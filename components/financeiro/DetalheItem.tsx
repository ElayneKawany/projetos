'use client'

import { useState, useEffect, useCallback } from 'react'
import { IndicadorKPI } from './IndicadorKPI'
import type { OrcamentoItem, OrcamentoGrupo } from '@/lib/orcamento-types'
import type { TimelineEvento } from '@/lib/timeline'

interface Movimento {
  id: number
  tipo_movimento: string
  numero_doc: string | null
  fornecedor: string | null
  valor_total: number
  valor_pago: number
  data_emissao: string | null
  status: string
  observacoes: string | null
}

interface Props {
  projetoId: number
  item: OrcamentoItem
  grupo: OrcamentoGrupo
  onVoltar: () => void
}

type AbaDetalhe = 'resumo' | 'documentos' | 'historico'

function fmt(d?: string | null) {
  if (!d) return '—'
  const s = d.slice(0, 10)
  const [y, m, day] = s.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}

function fBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatusDoc({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    APROVADO:  { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprovado' },
    REJEITADO: { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Rejeitado' },
    CANCELADO: { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Cancelado' },
    PENDENTE:  { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendente' },
  }
  const s = map[status] ?? map.PENDENTE
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

/**
 * Detalhe completo de um item de orçamento.
 *
 * Exibe dados do item (conta contábil, centro de custo, previsto, executado, saldo)
 * e três sub-abas: Resumo | Documentos | Histórico.
 *
 * O histórico é a `projeto_timeline` filtrada por referencia_id + referencia_tipo,
 * evitando duplicação com a tabela `auditoria`.
 *
 * @usedBy FinanceiroTab — nível mais profundo do drill-down
 */
export function DetalheItem({ projetoId, item, grupo, onVoltar }: Props) {
  const [aba, setAba] = useState<AbaDetalhe>('resumo')
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [timeline, setTimeline] = useState<TimelineEvento[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [movRes, tlRes] = await Promise.all([
        fetch(`/api/projetos/${projetoId}/financeiro/movimentos`),
        fetch(`/api/projetos/${projetoId}/timeline?modulo=ORCAMENTO&modulo2=FINANCEIRO&limit=100`),
      ])
      const movData = await movRes.json()
      const tlData  = await tlRes.json()

      // Filtrar apenas movimentos vinculados a este item
      setMovimentos(
        (movData.movimentos ?? []).filter((m: Movimento & { item_id?: number }) => m.item_id === item.id)
      )
      // Filtrar eventos da timeline relacionados a este item
      setTimeline(
        (tlData.eventos ?? []).filter(
          (e: TimelineEvento) =>
            (e.referencia_id === item.id && e.referencia_tipo === 'orcamento_itens') ||
            (e.referencia_tipo === 'financeiro_movimentos' &&
              movimentos.some(m => m.id === e.referencia_id))
        )
      )
    } finally {
      setLoading(false)
    }
  }, [projetoId, item.id, movimentos])

  useEffect(() => { carregar() }, [projetoId, item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Indicadores calculados
  const valorExecutado    = movimentos.filter(m => m.status === 'APROVADO').reduce((s, m) => s + m.valor_total, 0)
  const valorComprometido = movimentos.filter(m => m.status !== 'CANCELADO' && m.status !== 'REJEITADO').reduce((s, m) => s + m.valor_total, 0)
  const valorPago         = movimentos.reduce((s, m) => s + (m.valor_pago ?? 0), 0)
  const saldo             = item.valor_aprovado - valorComprometido
  const pctExecutado      = item.valor_aprovado > 0 ? (valorExecutado / item.valor_aprovado) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Voltar */}
      <div className="flex items-center gap-2">
        <button
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          onClick={onVoltar}
        >
          ← Voltar
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">{grupo.nome}</span>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800">{item.nome}</span>
      </div>

      {/* Cabeçalho do item */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-lg">{item.nome}</h3>
            {item.descricao && <p className="text-sm text-gray-500 mt-0.5">{item.descricao}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
              <span>
                <span className="font-medium text-gray-600">Grupo:</span> {grupo.nome}
              </span>
              {item.conta_contabil_codigo && (
                <span>
                  <span className="font-medium text-gray-600">Conta contábil:</span>{' '}
                  {item.conta_contabil_codigo} — {item.conta_contabil_descricao}
                </span>
              )}
              {item.centro_custo_codigo && (
                <span>
                  <span className="font-medium text-gray-600">Centro de custo:</span>{' '}
                  {item.centro_custo_codigo} — {item.centro_custo_descricao}
                </span>
              )}
              <span>
                <span className="font-medium text-gray-600">Prioridade:</span>{' '}
                <span className={
                  item.prioridade === 'ALTA' ? 'text-red-600 font-semibold' :
                  item.prioridade === 'BAIXA' ? 'text-gray-400' : 'text-gray-600'
                }>{item.prioridade}</span>
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">Valor Aprovado</p>
            <p className="text-2xl font-bold" style={{ color: '#003087' }}>{fBRL(item.valor_aprovado)}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IndicadorKPI label="Comprometido"  valor={valorComprometido} variante={valorComprometido > item.valor_aprovado ? 'danger' : 'warning'} icone="📋" />
        <IndicadorKPI label="Executado"     valor={valorExecutado}    variante="info"    icone="✅" percentual={pctExecutado} detalhe={`${pctExecutado.toFixed(1)}% do previsto`} />
        <IndicadorKPI label="Pago"          valor={valorPago}         variante="success" icone="💳" />
        <IndicadorKPI label="Saldo Disponível" valor={saldo} variante={saldo < 0 ? 'danger' : 'success'} icone={saldo < 0 ? '⚠️' : '✅'} />
      </div>

      {/* Sub-abas */}
      <div className="tab-list">
        <button className={`tab-item${aba === 'resumo'    ? ' active' : ''}`} onClick={() => setAba('resumo')}>Resumo</button>
        <button className={`tab-item${aba === 'documentos' ? ' active' : ''}`} onClick={() => setAba('documentos')}>
          Documentos {movimentos.length > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{movimentos.length}</span>}
        </button>
        <button className={`tab-item${aba === 'historico' ? ' active' : ''}`} onClick={() => { setAba('historico'); carregar() }}>Histórico</button>
      </div>

      {loading && <div className="py-8 text-center text-gray-400 text-sm">Carregando…</div>}

      {/* Resumo */}
      {!loading && aba === 'resumo' && (
        <div className="card p-4 space-y-4">
          <h4 className="font-semibold text-sm text-gray-700">Progresso de Execução</h4>
          <div className="space-y-3">
            {[
              { label: 'Comprometido', valor: valorComprometido, cor: '#F59E0B' },
              { label: 'Executado (Aprovado)', valor: valorExecutado, cor: '#3B82F6' },
              { label: 'Pago', valor: valorPago, cor: '#10B981' },
            ].map(({ label, valor, cor }) => {
              const pct = item.valor_aprovado > 0 ? Math.min((valor / item.valor_aprovado) * 100, 100) : 0
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold tabular-nums">{fBRL(valor)} <span className="text-xs text-gray-400 font-normal">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cor }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className={`flex justify-between items-center pt-2 border-t border-gray-100 ${saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>
            <span className="text-sm font-semibold">{saldo < 0 ? '⚠️ Saldo negativo' : 'Saldo disponível'}</span>
            <span className="text-lg font-bold tabular-nums">{fBRL(saldo)}</span>
          </div>
        </div>
      )}

      {/* Documentos */}
      {!loading && aba === 'documentos' && (
        <div>
          {movimentos.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Nenhum documento vinculado a este item.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-megag w-full">
                <thead>
                  <tr><th>Tipo</th><th>Documento</th><th>Fornecedor</th><th className="text-right">Valor</th><th className="text-right">Pago</th><th>Emissão</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {movimentos.map(m => (
                    <tr key={m.id}>
                      <td className="font-medium text-xs">{m.tipo_movimento}</td>
                      <td className="text-xs text-gray-600">{m.numero_doc ?? '—'}</td>
                      <td className="text-xs text-gray-600">{m.fornecedor ?? '—'}</td>
                      <td className="text-right font-semibold tabular-nums text-sm">{fBRL(m.valor_total)}</td>
                      <td className="text-right tabular-nums text-xs text-green-700">{m.valor_pago > 0 ? fBRL(m.valor_pago) : '—'}</td>
                      <td className="text-xs text-gray-500">{fmt(m.data_emissao)}</td>
                      <td><StatusDoc status={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="text-xs font-semibold text-gray-500 px-3 py-2">Total</td>
                    <td className="text-right font-bold tabular-nums text-sm">{fBRL(movimentos.reduce((s, m) => s + m.valor_total, 0))}</td>
                    <td className="text-right tabular-nums text-xs text-green-700 font-semibold">{fBRL(valorPago)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Histórico (timeline do item) */}
      {!loading && aba === 'historico' && (
        <div>
          {timeline.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Nenhum evento registrado para este item.</div>
          ) : (
            <div className="space-y-3">
              {timeline.map(ev => (
                <div key={ev.id} className="timeline-item flex gap-3">
                  <div className="timeline-dot mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{ev.titulo}</p>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {ev.descricao && <p className="text-xs text-gray-500 mt-0.5">{ev.descricao}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">{ev.usuario_nome ?? 'Sistema'}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{ev.evento}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
