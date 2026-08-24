'use client'

import { useState } from 'react'
import { calcStatusParcela, type StatusParcela } from '@/lib/cronograma/parcelas'

export interface ParcelaInfo {
  id: number
  cronograma_tarefa_id: number
  numero: number
  valor: number
  data_vencimento: string
  data_vencimento_baseline: string | null
  status: 'PENDENTE' | 'PAGO'
  data_pagamento: string | null
  pago_por: number | null
  pago_por_nome: string | null
}

const STATUS_LABEL: Record<StatusParcela, { label: string; cls: string }> = {
  PAGO:        { label: '✓ Pago',      cls: 'text-green-600 font-medium' },
  ATRASADA:    { label: 'Atrasada',    cls: 'text-red-600 font-medium' },
  VENCE_HOJE:  { label: 'Vence hoje',  cls: 'text-amber-600 font-medium' },
  PENDENTE:    { label: 'Pendente',    cls: 'text-gray-400' },
}

function fData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  parcela: ParcelaInfo
  qtdParcelas: number
  onMarcarPago: (parcelaId: number, dataPagamento: string) => void | Promise<void>
  onReprogramar: (parcelaId: number, novaData: string, justificativa: string) => void | Promise<void>
}

export default function ParcelaRow({ parcela, qtdParcelas, onMarcarPago, onReprogramar }: Props) {
  const [confirmPagar, setConfirmPagar] = useState(false)
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10))
  const [reprogramando, setReprogramando] = useState(false)
  const [novaData, setNovaData] = useState(parcela.data_vencimento)
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  const status = calcStatusParcela(parcela)
  const { label, cls } = STATUS_LABEL[status]

  async function confirmarPagamento() {
    setSalvando(true)
    try {
      await onMarcarPago(parcela.id, dataPagamento)
      setConfirmPagar(false)
    } finally { setSalvando(false) }
  }

  async function confirmarReprogramacao() {
    if (!justificativa.trim()) return
    setSalvando(true)
    try {
      await onReprogramar(parcela.id, novaData, justificativa.trim())
      setReprogramando(false)
      setJustificativa('')
    } finally { setSalvando(false) }
  }

  return (
    <div className="flex items-center gap-3 py-1.5 px-3 text-xs border-b border-gray-100 last:border-0">
      <span className="text-gray-400 w-12 shrink-0">{parcela.numero}/{qtdParcelas}</span>
      <span className="text-gray-600 w-24 shrink-0">
        {fData(parcela.data_vencimento)}
        {parcela.data_vencimento_baseline && (
          <span className="block text-[10px] text-gray-400">Base: {fData(parcela.data_vencimento_baseline)}</span>
        )}
      </span>
      <span className="text-gray-700 w-28 shrink-0">{fMoeda(parcela.valor)}</span>
      <span className={`w-28 shrink-0 ${cls}`}>{label}</span>
      {parcela.status === 'PAGO' ? (
        <span className="text-gray-400 flex-1">
          Pago em {parcela.data_pagamento ? fData(parcela.data_pagamento) : '—'}
          {parcela.pago_por_nome ? ` por ${parcela.pago_por_nome}` : ''}
        </span>
      ) : (
        <div className="flex-1 flex items-center gap-2">
          {!confirmPagar && !reprogramando && (
            <>
              <button type="button" className="text-emerald-600 hover:underline" onClick={() => setConfirmPagar(true)}>
                Marcar como pago
              </button>
              <button type="button" className="text-megag-azul hover:underline" onClick={() => setReprogramando(true)}>
                Reprogramar
              </button>
            </>
          )}
          {confirmPagar && (
            <div className="flex items-center gap-2">
              <span>Data do pagamento:</span>
              <input type="date" className="input text-xs py-0.5 px-1 w-32" value={dataPagamento}
                onChange={e => setDataPagamento(e.target.value)} />
              <button type="button" disabled={salvando} className="btn-primary text-xs py-0.5 px-2" onClick={confirmarPagamento}>
                {salvando ? 'Salvando…' : 'Confirmar'}
              </button>
              <button type="button" className="text-gray-400 hover:underline" onClick={() => setConfirmPagar(false)}>Cancelar</button>
            </div>
          )}
          {reprogramando && (
            <div className="flex items-center gap-2 flex-wrap">
              <span>Nova data:</span>
              <input type="date" className="input text-xs py-0.5 px-1 w-32" value={novaData}
                onChange={e => setNovaData(e.target.value)} />
              <input type="text" className="input text-xs py-0.5 px-1 flex-1 min-w-[160px]" placeholder="Justificativa (obrigatória)"
                value={justificativa} onChange={e => setJustificativa(e.target.value)} />
              <button type="button" disabled={salvando || !justificativa.trim()} className="btn-primary text-xs py-0.5 px-2" onClick={confirmarReprogramacao}>
                {salvando ? 'Salvando…' : 'Confirmar'}
              </button>
              <button type="button" className="text-gray-400 hover:underline" onClick={() => setReprogramando(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
