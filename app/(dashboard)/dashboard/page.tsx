import { getSession } from '@/lib/auth'
import { buscarDashboardPMO } from '@/lib/projetos'
import { buscarTarefasProximasVencimento, buscarTarefasAtrasadas } from '@/lib/meu-trabalho'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null
  const dados = await buscarDashboardPMO()
  const tarefasProximas = await buscarTarefasProximasVencimento(session, { limit: 8 })
  const tarefasAtrasadas = await buscarTarefasAtrasadas(session)
  return (
    <DashboardClient
      dados={dados as never}
      session={session}
      tarefasProximas={tarefasProximas}
      tarefasAtrasadas={tarefasAtrasadas}
    />
  )
}
