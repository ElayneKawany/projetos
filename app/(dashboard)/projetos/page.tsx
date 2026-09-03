import { getSession } from '@/lib/auth'
import { buscarProjetos } from '@/lib/projetos'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import ProjetosClient from './ProjetosClient'

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: Promise<{ diretoria?: string; status?: string }>
}) {
  const session = await getSession()
  if (!session) return null

  const { diretoria, status } = await searchParams

  const projetos = await buscarProjetos({ usuario_id: session.id, perfil: session.perfil })

  const db = getDb()
  const diretorias = db.prepare('SELECT * FROM diretorias WHERE ativo=1 ORDER BY nome').all()
  const areas = db.prepare('SELECT a.*, d.nome as diretoria_nome FROM areas a JOIN diretorias d ON a.diretoria_id=d.id WHERE a.ativo=1 ORDER BY a.nome').all()
  const usuarios = await asyncDb.queryMany(
    `SELECT id, nome, email, cargo FROM "AI"."TI_PMO_USUARIOS" WHERE ativo = true ORDER BY nome`
  )

  return (
    <ProjetosClient
      projetos={projetos}
      diretorias={diretorias as never[]}
      areas={areas as never[]}
      usuarios={usuarios as never[]}
      session={session}
      initialDiretoria={diretoria ?? ''}
      initialStatus={status ?? ''}
    />
  )
}
