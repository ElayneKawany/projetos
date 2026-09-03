import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { UsuariosRepository } from '@/lib/repositories'
import CronogramasClient from './CronogramasClient'

export default async function CronogramasPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const cronogramasRaw = db.prepare(`
    SELECT cr.*, p.codigo as projeto_codigo, p.nome as projeto_nome,
           COUNT(t.id) as total_tarefas,
           COALESCE(AVG(t.percentual),0) as progresso_medio
    FROM cronogramas cr
    JOIN projetos p ON cr.projeto_id = p.id
    LEFT JOIN cronograma_tarefas t ON t.cronograma_id = cr.id
    GROUP BY cr.id
    ORDER BY cr.created_at DESC
  `).all() as (Record<string, unknown> & { criado_por: number | null })[]
  const criadorIds = [...new Set(cronogramasRaw.map(c => c.criado_por).filter((v): v is number => v != null))]
  const criadorNomes = await UsuariosRepository.findNomesPorIds(criadorIds)
  const cronogramas = cronogramasRaw.map(c => ({
    ...c,
    criador_nome: c.criado_por != null ? criadorNomes.get(c.criado_por)?.nome ?? null : null,
  }))

  const projetos = db.prepare(
    `SELECT id, codigo, nome FROM projetos WHERE ativo=1 AND status IN ('CRONOGRAMA','EXECUCAO','ESTRUTURACAO') ORDER BY nome`
  ).all()

  return <CronogramasClient cronogramas={cronogramas as never[]} projetos={projetos as never[]} session={session} />
}
