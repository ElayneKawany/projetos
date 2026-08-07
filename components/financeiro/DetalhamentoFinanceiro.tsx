'use client'

import { GrupoInvestimentoCard } from './GrupoInvestimentoCard'
import { IndicadorKPI } from './IndicadorKPI'
import { TIPO_INVESTIMENTO_LABELS, TIPO_INVESTIMENTO_CORES, type TipoInvestimento, type OrcamentoGrupo, type OrcamentoItem } from '@/lib/orcamento-types'

interface Movimento {
  id: number
  item_id: number | null
  grupo_tipo: TipoInvestimento | null
  valor_total: number
  valor_pago: number
  status: string
}

interface Props {
  tipo: TipoInvestimento
  grupos: OrcamentoGrupo[]
  movimentos: Movimento[]
  onVoltar: () => void
  onItemClick: (grupo: OrcamentoGrupo, item: OrcamentoItem) => void
}

function fBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Detalhamento financeiro de um tipo de investimento.
 *
 * Exibe KPIs consolidados do tipo e uma lista de `GrupoInvestimentoCard`,
 * cada um expansível para revelar os itens individuais.
 *
 * Genérico — o tipo é passado como prop, sem lógica exclusiva por tipo.
 *
 * @usedBy FinanceiroTab — nível 2 do drill-down (Painel → Tipo)
 */
export function DetalhamentoFinanceiro({ tipo, grupos, movimentos, onVoltar, onItemClick }: Props) {
  const cor    = TIPO_INVESTIMENTO_CORES[tipo]
  const label  = TIPO_INVESTIMENTO_LABELS[tipo]

  // Filtrar apenas grupos e movimentos deste tipo
  const gruposTipo = grupos.filter(g => g.tipo === tipo)
  const movsTipo   = movimentos.filter(
    m => m.grupo_tipo === tipo && m.status !== 'CANCELADO' && m.status !== 'REJEITADO'
  )

  const previsto     = gruposTipo.flatMap(g => g.itens).reduce((s, i) => s + i.valor_aprovado, 0)
  const comprometido = movsTipo.reduce((s, m) => s + m.valor_total, 0)
  const executado    = movsTipo.filter(m => m.status === 'APROVADO').reduce((s, m) => s + m.valor_total, 0)
  const pago         = movimentos.filter(m => m.grupo_tipo === tipo).reduce((s, m) => s + (m.valor_pago ?? 0), 0)
  const saldo        = previsto - comprometido
  const pctExec      = previsto > 0 ? (executado / previsto) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button className="text-sm text-blue-600 hover:underline flex items-center gap-1" onClick={onVoltar}>
          ← Voltar
        </button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cor }} />
          <span className="text-sm font-semibold text-gray-800">{label}</span>
        </div>
      </div>

      {/* KPIs do tipo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <IndicadorKPI label="Previsto"       valor={fBRL(previsto)}     variante="default" icone="💰" />
        <IndicadorKPI label="Comprometido"   valor={fBRL(comprometido)} variante={comprometido > previsto ? 'danger' : 'warning'} icone="📋" percentual={previsto > 0 ? (comprometido / previsto) * 100 : 0} />
        <IndicadorKPI label="Executado"      valor={fBRL(executado)}    variante="info"    icone="✅" percentual={pctExec} detalhe={`${pctExec.toFixed(1)}%`} />
        <IndicadorKPI label="Pago"           valor={fBRL(pago)}         variante="success" icone="💳" />
        <IndicadorKPI label="Saldo Disponível" valor={fBRL(saldo)}      variante={saldo < 0 ? 'danger' : 'success'} icone={saldo < 0 ? '⚠️' : '✅'} />
      </div>

      {/* Grupos */}
      {gruposTipo.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p>Nenhum grupo de orçamento cadastrado para {label}.</p>
          <p className="mt-1 text-xs">Acesse Estudo de Viabilidade → Orçamento para criar grupos e itens.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gruposTipo.map(grupo => (
            <GrupoInvestimentoCard
              key={grupo.id}
              grupo={grupo}
              movimentos={movimentos as Parameters<typeof GrupoInvestimentoCard>[0]['movimentos']}
              onItemClick={onItemClick}
              defaultExpanded={gruposTipo.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
