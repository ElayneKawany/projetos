'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import type { ResponsavelAtrasos } from '@/lib/meu-trabalho'

interface Props {
  totalProjetos: number
  porResponsavel: ResponsavelAtrasos[]
}

const NIVEL_LABEL: Record<string, string> = {
  FASE: 'Fase',
  TAREFA: 'Tarefa',
  SUBTAREFA: 'Subtarefa',
}

function fData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function TarefasAtrasadas({ totalProjetos, porResponsavel }: Props) {
  return (
    <div className="card mb-6">
      <div className="card-header">
        <span className="card-title flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600" />
          Tarefas Atrasadas
        </span>
        {totalProjetos > 0 && (
          <span className="text-xs text-megag-cinza-texto">
            {totalProjetos} projeto{totalProjetos !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {porResponsavel.length === 0 ? (
        <p className="text-megag-cinza-texto text-sm text-center py-6">
          Nenhuma tarefa atrasada.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {porResponsavel.map(grupo => (
            <div key={grupo.responsavel_nome}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-megag-cinza-texto border-b border-gray-100 pb-1.5 mb-2">
                {grupo.responsavel_nome}
              </h4>
              <ul className="space-y-2.5">
                {grupo.itens.map(item => (
                  <li key={item.projeto_id}>
                    <Link
                      href={`/projetos/${item.projeto_id}?tab=cronograma`}
                      className="block hover:bg-red-50/60 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-600 shrink-0">🔴</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {item.projeto_nome}
                        </span>
                      </div>
                      {item.projeto_codigo && (
                        <p className="text-xs text-megag-cinza-texto ml-5">{item.projeto_codigo}</p>
                      )}
                      <p className="text-xs ml-5 mt-0.5">
                        <span className="uppercase tracking-wide text-megag-cinza-texto mr-1">
                          {NIVEL_LABEL[item.nivel] ?? item.nivel}:
                        </span>
                        <span className="text-gray-700">{item.nome}</span>
                      </p>
                      <p className="text-xs ml-5 mt-0.5 text-red-600 font-medium">
                        Venceu em {fData(item.data_fim)} · {item.dias_atraso} dia{item.dias_atraso !== 1 ? 's' : ''} de atraso
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
