import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import CronogramasClient from './CronogramasClient'

export default async function CronogramasPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const cronogramas = db.prepare(`
    SELECT cr.*, p.codigo as projeto_codigo, p.nome as projeto_nome,
           u.nome as criador_nome,
           COUNT(t.id) as total_tarefas,
           COALESCE(AVG(t.percentual),0) as progresso_medio
    FROM cronogramas cr
    JOIN projetos p ON cr.projeto_id = p.id
    LEFT JOIN usuarios u ON cr.criado_por = u.id
    LEFT JOIN cronograma_tarefas t ON t.cronograma_id = cr.id
    GROUP BY cr.id
    ORDER BY cr.created_at DESC
  `).all()

  const projetos = db.prepare(
    `SELECT id, codigo, nome FROM projetos WHERE ativo=1 AND status IN ('CRONOGRAMA','EXECUCAO','ESTRUTURACAO') ORDER BY nome`
  ).all()

  return <CronogramasClient cronogramas={cronogramas as never[]} projetos={projetos as never[]} session={session} />
}
