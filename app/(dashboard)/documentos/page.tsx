import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import DocumentosClient from './DocumentosClient'

export default async function DocumentosPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const documentos = db.prepare(`
    SELECT d.*, p.codigo as projeto_codigo, p.nome as projeto_nome, u.nome as criador_nome
    FROM documentos d
    LEFT JOIN projetos p ON d.projeto_id = p.id
    LEFT JOIN usuarios u ON d.criado_por = u.id
    ORDER BY d.created_at DESC
  `).all()

  return <DocumentosClient documentos={documentos as never[]} session={session} />
}
