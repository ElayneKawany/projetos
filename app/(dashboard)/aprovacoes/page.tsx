import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { TapRepository, ViabilidadeRepository } from '@/lib/repositories'
import AprovacoesClient from './AprovacoesClient'

export default async function AprovacoesPage() {
  const session = await getSession()
  if (!session) return null

  const db = getDb()

  // Busca todos os workflows com dados do projeto e modelo
  const rows = db.prepare(`
    SELECT
      wa.id,
      wa.tipo,
      wa.referencia_id,
      wa.etapa_atual,
      wa.status     AS workflow_status,
      wa.modelo_id,
      wa.created_at AS workflow_criado_em,
      wm.nome       AS modelo_nome,
      p.id          AS projeto_id,
      p.nome        AS projeto_nome,
      p.codigo      AS projeto_codigo
    FROM workflow_aprovacao wa
    LEFT JOIN workflow_modelos wm ON wm.id = wa.modelo_id
    LEFT JOIN projetos p ON p.id = wa.projeto_id
    ORDER BY wa.id DESC
  `).all() as WorkflowRow[]

  // tap_versoes e viabilidade já estão em Postgres — busca em lote pelos ids de
  // referência exatos (não por projeto), uma vez, antes do loop por linha.
  const tapIds = rows.filter(r => r.tipo === 'TAP').map(r => r.referencia_id)
  const viabIds = rows.filter(r => r.tipo === 'VIABILIDADE').map(r => r.referencia_id)
  const [taps, viabs] = await Promise.all([
    TapRepository.findByIds(tapIds),
    ViabilidadeRepository.findByIds(viabIds),
  ])
  const tapPorId = new Map(taps.map(t => [t.id, t]))
  const viabPorId = new Map(viabs.map(v => [v.id, v]))

  const workflows = rows.map(row => {
    const etapas = db.prepare(
      'SELECT * FROM workflow_etapas WHERE workflow_id = ? ORDER BY ordem'
    ).all(row.id) as EtapaRow[]

    let versao: string | number = '—'
    let documentoLabel = row.tipo

    if (row.tipo === 'TAP') {
      const doc = tapPorId.get(row.referencia_id)
      versao = doc?.versao ?? '—'
      documentoLabel = doc?.label ?? 'TAP'
    } else if (row.tipo === 'VIABILIDADE') {
      const doc = viabPorId.get(row.referencia_id)
      versao = doc?.versao ?? '—'
      documentoLabel = `Estudo de Viabilidade V${versao}`
    } else if (row.tipo === 'CRONOGRAMA') {
      const doc = db.prepare('SELECT versao, label FROM cronogramas WHERE id = ?').get(row.referencia_id) as { versao: number; label: string } | undefined
      versao = doc?.versao ?? '—'
      documentoLabel = doc?.label ?? `Cronograma V${versao}`
    }

    return { ...row, etapas, versao, documentoLabel }
  })

  return (
    <AprovacoesClient
      workflows={workflows as never[]}
      sessionUser={{ id: session.id, nome: session.nome, perfil: session.perfil }}
    />
  )
}

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface WorkflowRow {
  id: number
  tipo: string
  referencia_id: number
  etapa_atual: number
  workflow_status: string
  modelo_id: number | null
  workflow_criado_em: string
  modelo_nome: string | null
  projeto_id: number
  projeto_nome: string
  projeto_codigo: string
}

interface EtapaRow {
  id: number
  workflow_id: number
  ordem: number
  usuario_id: number
  usuario_nome: string
  tipo: string
  status: string
  observacao: string | null
  respondido_em: string | null
}
