import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import AprovacoesClient from './AprovacoesClient'

export default async function AprovacoesPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const aprovacoes = db.prepare(`
    SELECT a.*,
           p.codigo as projeto_codigo, p.nome as projeto_nome,
           s.nome as solicitante_nome,
           ap.nome as aprovador_nome
    FROM aprovacoes a
    LEFT JOIN projetos p ON a.projeto_id = p.id
    LEFT JOIN usuarios s ON a.solicitante_id = s.id
    LEFT JOIN usuarios ap ON a.aprovador_id = ap.id
    ORDER BY CASE a.status WHEN 'PENDENTE' THEN 0 ELSE 1 END, a.created_at DESC
  `).all()

  return <AprovacoesClient aprovacoes={aprovacoes as never[]} session={session} />
}
