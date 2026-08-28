'use client'

import Link from 'next/link'
import { ListTodo, ArrowRight } from 'lucide-react'
import type { ProximaTarefaItem } from '@/lib/meu-trabalho'

interface Props {
  total: number
  itens: ProximaTarefaItem[]
  verTodasHref?: string
}

const NIVEL_LABEL: Record<ProximaTarefaItem['nivel'], string> = {
  FASE: 'Fase',
  TAREFA: 'Tarefa',
  SUBTAREFA: 'Subtarefa',
}

function fData(iso: string | null): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function DiasBadge({ item }: { item: ProximaTarefaItem }) {
  if (item.situacao === 'VENCE_HOJE') {
    return <span className="text-xs font-semibold text-amber-600">Vence hoje</span>
  }
  return (
    <span className="text-xs font-medium text-megag-cinza-texto">
      Faltam {item.dias} dia{item.dias !== 1 ? 's' : ''}
    </span>
  )
}

export default function TarefasProximasVencimento({ total, itens, verTodasHref }: Props) {
  return (
    <div className="card mb-6">
      <div className="card-header">
        <span className="card-title flex items-center gap-2">
          <ListTodo size={16} className="text-megag-azul" />
          Tarefas Próximas ao Vencimento
        </span>
        {verTodasHref && total > itens.length && (
          <Link href={verTodasHref} className="text-xs text-megag-azul hover:underline flex items-center gap-1">
            Ver todas <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="text-megag-cinza-texto text-sm text-center py-6">
          Nenhuma tarefa vencendo hoje ou nos próximos 7 dias úteis.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-megag w-full text-sm">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th className="hidden lg:table-cell">Diretoria</th>
                  <th>Tarefa</th>
                  <th className="hidden md:table-cell">Responsável</th>
                  <th className="hidden sm:table-cell">Início</th>
                  <th>Fim</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr key={item.tarefa_id}>
                    <td>
                      <Link
                        href={`/projetos/${item.projeto_id}?tab=cronograma`}
                        className="text-megag-azul hover:underline font-medium truncate max-w-[160px] block"
                      >
                        {item.projeto_nome}
                      </Link>
                      {item.projeto_codigo && (
                        <p className="text-xs text-megag-cinza-texto">{item.projeto_codigo}</p>
                      )}
                    </td>
                    <td className="hidden lg:table-cell text-xs text-megag-cinza-texto">
                      {item.diretoria_nome ?? '—'}
                    </td>
                    <td>
                      <span className="text-xs uppercase tracking-wide text-megag-cinza-texto mr-1">
                        {NIVEL_LABEL[item.nivel]}
                      </span>
                      <Link
                        href={`/projetos/${item.projeto_id}?tab=cronograma`}
                        className="hover:underline"
                        title={item.observacoes ?? undefined}
                      >
                        {item.nome}
                      </Link>
                    </td>
                    <td className="hidden md:table-cell text-xs">{item.responsavel_nome ?? '—'}</td>
                    <td className="hidden sm:table-cell text-xs">{fData(item.data_inicio)}</td>
                    <td className="text-xs font-medium">{fData(item.data_fim)}</td>
                    <td><DiasBadge item={item} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > itens.length && (
            <p className="text-xs text-megag-cinza-texto text-right mt-2">
              Mostrando {itens.length} de {total}
            </p>
          )}
        </>
      )}
    </div>
  )
}
