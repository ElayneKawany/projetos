'use client'

import type { ErroValidacao } from '@/lib/validacoes-artefatos'

interface Props {
  erros: ErroValidacao[]
  sucesso: boolean
  onFechar?: () => void
}

export default function AlertaValidacao({ erros, sucesso, onFechar }: Props) {
  if (!erros.length && !sucesso) return null

  if (sucesso) {
    return (
      <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-bold">✓</span>
          <span>Documento validado com sucesso.</span>
        </div>
        {onFechar && (
          <button
            onClick={onFechar}
            className="text-green-600 hover:text-green-800 font-bold text-base leading-none"
          >
            ×
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold">
          Não é possível enviar para aprovação. Existem campos obrigatórios não preenchidos.
        </p>
        {onFechar && (
          <button
            onClick={onFechar}
            className="text-amber-600 hover:text-amber-900 font-bold text-base leading-none shrink-0"
          >
            ×
          </button>
        )}
      </div>
      <ul className="list-disc list-inside space-y-0.5 text-amber-800">
        {erros.map((e) => (
          <li key={e.campo}>{e.label}</li>
        ))}
      </ul>
    </div>
  )
}
