import { getSession } from '@/lib/auth'
import { buscarProximasTarefasDashboard } from '@/lib/meu-trabalho'
import ProximasTarefasClient from './ProximasTarefasClient'

export default async function ProximasTarefasPage() {
  const session = await getSession()
  if (!session) return null
  const proximasTarefas = buscarProximasTarefasDashboard(session)
  return <ProximasTarefasClient proximasTarefas={proximasTarefas} />
}
