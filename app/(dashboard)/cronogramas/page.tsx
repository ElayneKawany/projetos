import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { UsuariosRepository, CronogramaRepository } from '@/lib/repositories'
import CronogramasClient from './CronogramasClient'

export default async function CronogramasPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  // cronogramas/cronograma_tarefas já estão em Postgres — busca todos agregados lá,
  // e projetos (SQLite) entra por lookup em lote, descartando cronogramas cujo
  // projeto não existe mais (equivalente ao antigo INNER JOIN com projetos).
  const cronogramasRaw = await CronogramaRepository.findAllComTotais()

  const criadorIds = [...new Set(cronogramasRaw.map(c => c.criado_por).filter((v): v is number => v != null))]
  const criadorNomes = await UsuariosRepository.findNomesPorIds(criadorIds)

  const projetoIds = [...new Set(cronogramasRaw.map(c => c.projeto_id))]
  const projetosInfo = projetoIds.length
    ? db.prepare(
        `SELECT id, codigo AS projeto_codigo, nome AS projeto_nome
         FROM projetos WHERE id IN (${projetoIds.map(() => '?').join(',')})`
      ).all(...projetoIds) as Array<{ id: number; projeto_codigo: string; projeto_nome: string }>
    : []
  const projetoInfoMap = new Map(projetosInfo.map(p => [p.id, p]))

  const cronogramas = cronogramasRaw
    .filter(c => projetoInfoMap.has(c.projeto_id))
    .map(c => ({
      ...c,
      ...projetoInfoMap.get(c.projeto_id)!,
      criador_nome: c.criado_por != null ? criadorNomes.get(c.criado_por)?.nome ?? null : null,
    }))

  const projetos = db.prepare(
    `SELECT id, codigo, nome FROM projetos WHERE ativo=1 AND status IN ('CRONOGRAMA','EXECUCAO','ESTRUTURACAO') ORDER BY nome`
  ).all()

  return <CronogramasClient cronogramas={cronogramas as never[]} projetos={projetos as never[]} session={session} />
}
