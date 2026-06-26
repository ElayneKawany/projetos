import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import ComitesClient from './ComitesClient'

export default async function ComitesPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const comites = db.prepare(`
    SELECT c.*, u.nome as criador_nome,
           COUNT(DISTINCT cp.id) as num_participantes,
           COUNT(DISTINCT cpj.id) as num_projetos
    FROM comites c
    LEFT JOIN usuarios u ON c.created_by = u.id
    LEFT JOIN comite_participantes cp ON cp.comite_id = c.id
    LEFT JOIN comite_projetos cpj ON cpj.comite_id = c.id
    GROUP BY c.id
    ORDER BY c.data_realizacao DESC
  `).all()

  const projetos = db.prepare('SELECT id, codigo, nome FROM projetos WHERE ativo=1 ORDER BY nome').all()
  const usuarios = db.prepare('SELECT id, nome, cargo FROM usuarios WHERE ativo=1 ORDER BY nome').all()

  return <ComitesClient comites={comites as never[]} projetos={projetos as never[]} usuarios={usuarios as never[]} session={session} />
}
