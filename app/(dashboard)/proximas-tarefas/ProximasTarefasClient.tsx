'use client'

import type { ProximaTarefaItem } from '@/lib/meu-trabalho'
import ProximasTarefas from '@/components/dashboard/ProximasTarefas'

interface Props {
  proximasTarefas: { total: number; itens: ProximaTarefaItem[] }
}

export default function ProximasTarefasClient({ proximasTarefas }: Props) {
  return (
    <div className="animate-fade-in">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Próximas Tarefas</h1>
          <p className="page-subtitle">
            {proximasTarefas.total} tarefa{proximasTarefas.total !== 1 ? 's' : ''} atrasada{proximasTarefas.total !== 1 ? 's' : ''} ou vencendo nos próximos 7 dias
          </p>
        </div>
      </div>

      <ProximasTarefas total={proximasTarefas.total} itens={proximasTarefas.itens} />
    </div>
  )
}
