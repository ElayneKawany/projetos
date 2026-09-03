import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { UsuariosRepository } from '@/lib/repositories'
import ComitesClient from './ComitesClient'

export default async function ComitesPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const comitesRaw = db.prepare(`
    SELECT c.*,
           COUNT(DISTINCT cp.id) as num_participantes,
           COUNT(DISTINCT cpj.id) as num_projetos
    FROM comites c
    LEFT JOIN comite_participantes cp ON cp.comite_id = c.id
    LEFT JOIN comite_projetos cpj ON cpj.comite_id = c.id
    GROUP BY c.id
    ORDER BY c.data_realizacao DESC
  `).all() as (Record<string, unknown> & { created_by: number | null })[]
  const criadorIds = [...new Set(comitesRaw.map(c => c.created_by).filter((v): v is number => v != null))]
  const criadorNomes = await UsuariosRepository.findNomesPorIds(criadorIds)
  const comites = comitesRaw.map(c => ({
    ...c,
    criador_nome: c.created_by != null ? criadorNomes.get(c.created_by)?.nome ?? null : null,
  }))

  const projetos = db.prepare('SELECT id, codigo, nome FROM projetos WHERE ativo=1 ORDER BY nome').all()
  const usuarios = await asyncDb.queryMany(
    `SELECT id, nome, cargo FROM "AI"."TI_PMO_USUARIOS" WHERE ativo = true ORDER BY nome`
  )

  return <ComitesClient comites={comites as never[]} projetos={projetos as never[]} usuarios={usuarios as never[]} session={session} />
}
