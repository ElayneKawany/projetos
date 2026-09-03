import { getSession, temPermissao } from '@/lib/auth'
import { buscarAuditoria } from '@/lib/db/auditoria'
import { redirect } from 'next/navigation'
import AuditoriaClient from './AuditoriaClient'
import getDb from '@/lib/db'

export default async function AuditoriaPage() {
  const session = await getSession()
  if (!session) return null
  if (!temPermissao(session.perfil, 'auditoria:view')) redirect('/dashboard')

  const logs = await buscarAuditoria({ limit: 100 })
  const projetos = getDb().prepare('SELECT id, codigo, nome FROM projetos WHERE ativo=1 ORDER BY nome').all()

  return <AuditoriaClient logs={logs as never[]} projetos={projetos as never[]} session={session} />
}
