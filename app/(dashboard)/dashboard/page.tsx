import { getSession } from '@/lib/auth'
import { buscarDashboardPMO } from '@/lib/projetos'
import { buscarProximasTarefasDashboard } from '@/lib/meu-trabalho'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null
  const dados = buscarDashboardPMO()
  const proximasTarefas = buscarProximasTarefasDashboard(session, { limit: 8 })
  return <DashboardClient dados={dados as never} session={session} proximasTarefas={proximasTarefas} />
}
