'use client'

import { TIPO_INVESTIMENTO_LABELS, TIPO_INVESTIMENTO_CORES, type TipoInvestimento } from '@/lib/orcamento-types'

export interface CardFinanceiroProps {
  tipo: TipoInvestimento
  valorPrevisto: number
  valorComprometido: number
  valorExecutado: number
  valorPago: number
  /** Exibe o card em modo compacto (sem barras de progresso detalhadas) */
  compacto?: boolean
  /** Callback ao clicar — quando presente, o card se torna clicável */
  onClick?: () => void
  /** Desabilita clique e exibe opacidade reduzida */
  disabled?: boolean
  /** Badge de texto exibido no canto superior direito do card */
  badge?: string
  /** Texto secundário abaixo do título */
  subtitle?: string
  /** Ícone (emoji ou texto curto) exibido ao lado do título */
  icon?: string
  /** Indica estado de carregamento — exibe skeleton em vez de valores */
  loading?: boolean
  /** Conteúdo adicional renderizado abaixo das métricas */
  children?: React.ReactNode
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function BarraProgresso({
  label,
  valor,
  total,
  cor,
}: {
  label: string
  valor: number
  total: number
  cor: string
}) {
  const pct = total > 0 ? Math.min((valor / total) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: cor }}
        />
      </div>
    </div>
  )
}

/**
 * Card financeiro reutilizável para exibir indicadores Previsto × Comprometido × Executado × Pago
 * de um tipo de investimento.
 *
 * Aceita `onClick` para drill-down, `loading` para skeleton, `badge`, `subtitle`, `icon` e `children`
 * para composição em diferentes contextos (Dashboard, Payback, Encerramento).
 *
 * @usedBy FinanceiroTab — painel executivo do projeto (clicável → drill-down)
 * @usedBy Dashboard Executivo — cards do portfólio (compacto)
 * @usedBy Payback — resumo de investimento
 * @usedBy Encerramento — balanço final
 */
export function CardFinanceiro({
  tipo,
  valorPrevisto,
  valorComprometido,
  valorExecutado,
  valorPago,
  compacto = false,
  onClick,
  disabled = false,
  badge,
  subtitle,
  icon,
  loading = false,
  children,
}: CardFinanceiroProps) {
  const label = TIPO_INVESTIMENTO_LABELS[tipo]
  const cor   = TIPO_INVESTIMENTO_CORES[tipo]
  const saldo = valorPrevisto - valorComprometido
  const isClickable = !!onClick && !disabled

  const cardClass = [
    'card transition-all duration-150',
    isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]' : '',
    disabled ? 'opacity-50 pointer-events-none' : '',
  ].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="card-header">
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
        <div className="px-4 pb-4 space-y-3">
          <div className="h-8 bg-gray-200 rounded w-40" />
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded" />
            <div className="h-2 bg-gray-200 rounded w-4/5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cardClass} onClick={isClickable ? onClick : undefined} role={isClickable ? 'button' : undefined} tabIndex={isClickable ? 0 : undefined} onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}>
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
          {icon && <span className="text-base leading-none">{icon}</span>}
          <div>
            <h3 className="card-title text-sm">{label}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{badge}</span>
          )}
          {isClickable && (
            <span className="text-gray-400 text-sm">›</span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Valor previsto em destaque */}
        <div>
          <p className="text-2xl font-bold text-gray-900">{fmt(valorPrevisto)}</p>
          <p className={`text-xs mt-0.5 ${saldo < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            Saldo: {fmt(saldo)}
          </p>
        </div>

        {!compacto && (
          <div className="space-y-2 pt-1">
            <BarraProgresso label="Comprometido" valor={valorComprometido} total={valorPrevisto} cor="#F59E0B" />
            <BarraProgresso label="Executado"    valor={valorExecutado}    total={valorPrevisto} cor="#3B82F6" />
            <BarraProgresso label="Pago"         valor={valorPago}         total={valorPrevisto} cor="#10B981" />
          </div>
        )}

        {/* Linha de totais compacta */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100 text-center">
          <div>
            <p className="text-xs text-amber-600 font-medium tabular-nums">{fmt(valorComprometido)}</p>
            <p className="text-[10px] text-gray-400">Comprometido</p>
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium tabular-nums">{fmt(valorExecutado)}</p>
            <p className="text-[10px] text-gray-400">Executado</p>
          </div>
          <div>
            <p className="text-xs text-green-600 font-medium tabular-nums">{fmt(valorPago)}</p>
            <p className="text-[10px] text-gray-400">Pago</p>
          </div>
        </div>

        {children && <div className="pt-1 border-t border-gray-100">{children}</div>}
      </div>
    </div>
  )
}
