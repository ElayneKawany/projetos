import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { buscarNotificacoes, marcarTodasLidas } from '@/lib/notificacoes'
import NotificacoesClient from './NotificacoesClient'

export default async function NotificacoesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Marcar todas como lidas ao abrir a central
  marcarTodasLidas(session.id)

  const notificacoes = buscarNotificacoes(session.id, 100)

  return <NotificacoesClient notificacoes={notificacoes as never[]} />
}
