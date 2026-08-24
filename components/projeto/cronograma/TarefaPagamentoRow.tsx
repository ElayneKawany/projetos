'use client'

import { calcResumoPagamento } from '@/lib/cronograma/parcelas'
import ParcelaRow, { type ParcelaInfo } from './ParcelaRow'

export interface PagamentoInfo {
  id: number
  cronograma_tarefa_id: number
  beneficiario: string | null
  valor_total: number
  qtd_parcelas: number
  periodicidade: string
  data_primeira_parcela: string
  parcelas: ParcelaInfo[]
}

function fMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  tarefaId: number
  nome: string
  responsavelNome?: string
  pagamento: PagamentoInfo
  colSpan: number
  expanded: boolean
  onToggleExpand: () => void
  onMarcarPago: (parcelaId: number, dataPagamento: string) => void | Promise<void>
  onReprogramar: (parcelaId: number, novaData: string, justificativa: string) => void | Promise<void>
  /** Cronograma editável e versão não histórica — controla Alterar/Mover. */
  canEdit?: boolean
  /** Só ADMIN/PMO — controla a exibição do botão Excluir. */
  podeExcluir?: boolean
  onAlterar?: () => void
  onExcluir?: () => void
  onMover?: () => void
}

export default function TarefaPagamentoRow({
  nome, responsavelNome, pagamento, colSpan, expanded, onToggleExpand, onMarcarPago, onReprogramar,
  canEdit, podeExcluir, onAlterar, onExcluir, onMover,
}: Props) {
  const resumo = calcResumoPagamento(pagamento.valor_total, pagamento.parcelas)

  return (
    <>
      <tr className="border-b border-gray-100 bg-amber-50/40 hover:bg-amber-50">
        <td colSpan={colSpan} className="px-3 py-2.5">
          <div className="flex items-start gap-3">
            <button type="button" onClick={onToggleExpand}
              className="text-gray-500 hover:text-gray-700 mt-0.5 shrink-0" title={expanded ? 'Recolher parcelas' : 'Ver parcelas'}>
              {expanded ? '▼' : '▶'}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base leading-none">💰</span>
                <span className="font-medium text-gray-800">{nome}</span>
                <span className="badge bg-amber-100 text-amber-700 text-[10px]">Tarefa de Pagamento</span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                {pagamento.beneficiario && <span>Beneficiário: <strong className="text-gray-700">{pagamento.beneficiario}</strong></span>}
                {responsavelNome && <span>Responsável: <strong className="text-gray-700">{responsavelNome}</strong></span>}
                <span>Total: <strong className="text-gray-700">{fMoeda(resumo.valorTotal)}</strong></span>
                <span>Parcelas: <strong className="text-gray-700">{resumo.parcelasPagas}/{resumo.totalParcelas} pagas</strong></span>
                <span>Pago: <strong className="text-emerald-700">{fMoeda(resumo.valorPago)}</strong></span>
                <span>Restante: <strong className="text-gray-700">{fMoeda(resumo.valorRestante)}</strong></span>
                <span>Avanço: <strong className="text-megag-azul">{resumo.percentual}%</strong></span>
              </div>
              <div className="mt-1.5 h-1.5 w-full max-w-xs bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-megag-azul rounded-full" style={{ width: `${resumo.percentual}%` }} />
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button type="button" onClick={onAlterar}
                  className="text-[10px] text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50"
                  title="Alterar tarefa de pagamento">Alterar</button>
                <button type="button" onClick={onMover}
                  className="text-[10px] text-megag-azul border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50"
                  title="Mover esta tarefa para outra fase">Mover</button>
                {podeExcluir && (
                  <button type="button" onClick={onExcluir}
                    className="text-[10px] text-red-500 border border-red-200 rounded px-1.5 py-0.5 hover:bg-red-50"
                    title="Excluir tarefa de pagamento (ADMIN/PMO)">Excluir</button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100">
          <td colSpan={colSpan} className="px-3 pb-2 pl-10 bg-amber-50/20">
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              {pagamento.parcelas.map(p => (
                <ParcelaRow
                  key={p.id}
                  parcela={p}
                  qtdParcelas={pagamento.qtd_parcelas}
                  onMarcarPago={onMarcarPago}
                  onReprogramar={onReprogramar}
                />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
