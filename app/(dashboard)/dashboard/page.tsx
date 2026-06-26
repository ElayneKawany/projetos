import { getSession } from '@/lib/auth'
import { buscarDashboardPMO } from '@/lib/projetos'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null
  const dados = buscarDashboardPMO()
  return <DashboardClient dados={dados as never} session={session} />
}
