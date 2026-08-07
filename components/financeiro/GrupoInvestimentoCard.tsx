'use client'

import { useState } from 'react'
import { TIPO_INVESTIMENTO_CORES, type TipoInvestimento, type OrcamentoGrupo, type OrcamentoItem } from '@/lib/orcamento-types'

interface Movimento {
  id: number
  item_id: number | null
  valor_total: number
  valor_pago: number
  status: string
}

interface Props {
  grupo: OrcamentoGrupo
  movimentos: Movimento[]
  /** Chamado quando o usuário clica em um item — navega para DetalheItem */
  onItemClick: (grupo: OrcamentoGrupo, item: OrcamentoItem) => void
  /** Inicia expandido */
  defaultExpanded?: boolean
}

function fBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcItem(item: OrcamentoItem, movimentos: Movimento[]) {
  const movItem = movimentos.filter(m => m.item_id === item.id && m.status !== 'CANCELADO' && m.status !== 'REJEITADO')
  const executado    = movItem.filter(m => m.status === 'APROVADO').reduce((s, m) => s + m.valor_total, 0)
  const comprometido = movItem.reduce((s, m) => s + m.valor_total, 0)
  const pago         = movItem.reduce((s, m) => s + (m.valor_pago ?? 0), 0)
  const saldo        = item.valor_aprovado - comprometido
  const pct          = item.valor_aprovado > 0 ? Math.min((executado / item.valor_aprovado) * 100, 100) : 0
  return { executado, comprometido, pago, saldo, pct }
}

/**
 * Card expansível para um grupo de investimento.
 *
 * Exibe o resumo consolidado do grupo (Previsto / Executado / Saldo / %) e,
 * ao expandir, lista seus itens com métricas individuais e botão de drill-down.
 *
 * Genérico — funciona para qualquer TipoInvestimento (CAPEX_ATIVO, CAPEX_RETORNO, OPEX).
 *
 * @usedBy DetalhamentoFinanceiro — lista de grupos de um tipo
 */
export function GrupoInvestimentoCard({ grupo, movimentos, onItemClick, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const cor = TIPO_INVESTIMENTO_CORES[grupo.tipo as TipoInvestimento] ?? '#6B7280'

  // Totais consolidados do grupo
  const previsto     = grupo.itens.reduce((s, i) => s + i.valor_aprovado, 0)
  const movGrupo     = movimentos.filter(m =>
    grupo.itens.some(i => i.id === m.item_id) &&
    m.status !== 'CANCELADO' && m.status !== 'REJEITADO'
  )
  const executado    = movGrupo.filter(m => m.status === 'APROVADO').reduce((s, m) => s + m.valor_total, 0)
  const comprometido = movGrupo.reduce((s, m) => s + m.valor_total, 0)
  const saldo        = previsto - comprometido
  const pct          = previsto > 0 ? Math.min((executado / previsto) * 100, 100) : 0

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Cabeçalho do grupo — clicável para expandir */}
      <button
        className="w-full flex items-center justify-between px-4 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
          <div>
            <p className="font-semibold text-gray-800 text-sm">{grupo.nome}</p>
            <p className="text-xs text-gray-400">{grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Métricas compactas */}
          <div className="hidden md:flex gap-6 text-right">
            <div>
              <p className="text-xs text-gray-400">Previsto</p>
              <p className="text-sm font-semibold tabular-nums">{fBRL(previsto)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Executado</p>
              <p className="text-sm font-semibold tabular-nums text-blue-700">{fBRL(executado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Saldo</p>
              <p className={`text-sm font-semibold tabular-nums ${saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>{fBRL(saldo)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Exec.</p>
              <p className="text-sm font-semibold">{pct.toFixed(1)}%</p>
            </div>
          </div>
          <span className="text-gray-400 text-lg transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
        </div>
      </button>

      {/* Barra de progresso do grupo */}
      <div className="h-1 bg-gray-100">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>

      {/* Lista de itens (expandida) */}
      {expanded && (
        <div className="divide-y divide-gray-100">
          {grupo.itens.length === 0 && (
            <p className="text-sm text-gray-400 italic px-4 py-3">Nenhum item cadastrado neste grupo.</p>
          )}
          {grupo.itens.map(item => {
            const m = calcItem(item, movimentos)
            return (
              <button
                key={item.id}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left group"
                onClick={() => onItemClick(grupo, item)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700">{item.nome}</p>
                  {item.descricao && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.descricao}</p>
                  )}
                  {/* Barra de progresso do item */}
                  <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden w-48 max-w-full">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.pct}%`, backgroundColor: cor }} />
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="hidden sm:flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Previsto</p>
                      <p className="text-xs font-semibold tabular-nums">{fBRL(item.valor_aprovado)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Executado</p>
                      <p className="text-xs font-semibold tabular-nums text-blue-700">{fBRL(m.executado)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Saldo</p>
                      <p className={`text-xs font-semibold tabular-nums ${m.saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>{fBRL(m.saldo)}</p>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-400 text-sm">›</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
