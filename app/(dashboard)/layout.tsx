import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import getDb from '@/lib/db'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Buscar notificações não lidas
  const db = getDb()
  const notifs = db.prepare(
    'SELECT COUNT(*) as total FROM notificacoes WHERE usuario_id = ? AND lida = 0'
  ).get(session.id) as { total: number }

  return (
    <div className="flex h-screen overflow-hidden bg-megag-cinza-claro">
      <Sidebar usuario={session} />
      <div className="flex-1 flex flex-col overflow-hidden pl-64 transition-all duration-300">
        <Header usuario={session} notificacoes={notifs?.total ?? 0} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
