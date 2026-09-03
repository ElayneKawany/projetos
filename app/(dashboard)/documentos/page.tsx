import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { UsuariosRepository } from '@/lib/repositories'
import DocumentosClient from './DocumentosClient'

export default async function DocumentosPage() {
  const session = await getSession()
  if (!session) return null
  const db = getDb()

  const documentosRaw = db.prepare(`
    SELECT d.*, p.codigo as projeto_codigo, p.nome as projeto_nome
    FROM documentos d
    LEFT JOIN projetos p ON d.projeto_id = p.id
    ORDER BY d.created_at DESC
  `).all() as (Record<string, unknown> & { criado_por: number | null })[]
  const criadorIds = [...new Set(documentosRaw.map(d => d.criado_por).filter((v): v is number => v != null))]
  const criadorNomes = await UsuariosRepository.findNomesPorIds(criadorIds)
  const documentos = documentosRaw.map(d => ({
    ...d,
    criador_nome: d.criado_por != null ? criadorNomes.get(d.criado_por)?.nome ?? null : null,
  }))

  return <DocumentosClient documentos={documentos as never[]} session={session} />
}
