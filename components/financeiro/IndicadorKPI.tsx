'use client'

export type VarianteKPI = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface IndicadorKPIProps {
  label: string
  valor: string | number
  /** Subtexto exibido abaixo do valor principal */
  detalhe?: string
  variante?: VarianteKPI
  /** Ícone (emoji ou texto curto) exibido à esquerda do label */
  icone?: string
  /** Percentual 0–100 para exibir uma barra de progresso horizontal */
  percentual?: number
}

const varianteCores: Record<VarianteKPI, { valor: string; barra: string; fundo: string }> = {
  default: { valor: 'text-gray-900',  barra: 'bg-gray-400',   fundo: 'bg-gray-50'   },
  success: { valor: 'text-green-700', barra: 'bg-green-500',  fundo: 'bg-green-50'  },
  warning: { valor: 'text-amber-700', barra: 'bg-amber-400',  fundo: 'bg-amber-50'  },
  danger:  { valor: 'text-red-700',   barra: 'bg-red-500',    fundo: 'bg-red-50'    },
  info:    { valor: 'text-blue-700',  barra: 'bg-blue-500',   fundo: 'bg-blue-50'   },
}

/**
 * Tile de KPI reutilizável para painéis financeiros e dashboards.
 *
 * Exibe um indicador com label, valor principal, detalhe opcional e
 * barra de progresso opcional.
 *
 * @usedBy FinanceiroTab — KPIs do painel executivo
 * @usedBy Dashboard Executivo — indicadores do portfólio
 * @usedBy Payback — métricas de retorno
 *
 * @example
 * ```tsx
 * <IndicadorKPI
 *   label="% Executado"
 *   valor="72,4%"
 *   detalhe="R$ 580.000 de R$ 800.000"
 *   variante="info"
 *   percentual={72.4}
 * />
 * ```
 */
export function IndicadorKPI({
  label,
  valor,
  detalhe,
  variante = 'default',
  icone,
  percentual,
}: IndicadorKPIProps) {
  const cores = varianteCores[variante]
  const pct   = percentual !== undefined ? Math.min(Math.max(percentual, 0), 100) : undefined

  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${cores.fundo}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icone && <span className="text-base leading-none">{icone}</span>}
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      </div>

      <p className={`text-xl font-bold leading-tight ${cores.valor}`}>
        {typeof valor === 'number'
          ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : valor}
      </p>

      {detalhe && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">{detalhe}</p>
      )}

      {pct !== undefined && (
        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${cores.barra}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
