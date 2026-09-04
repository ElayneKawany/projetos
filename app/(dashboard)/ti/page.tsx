import { getSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import TIAgendaClient from './TIAgendaClient'
import { DEV2026_ATIVIDADES } from '@/lib/ti/dev2026-data'

const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export default async function TIAgendaPage() {
  const session = await getSession()
  if (!session) notFound()

  const db = getDb()

  // Tarefas de TI dos cronogramas ativos onde responsável é Michel, Divonzi ou Plinio.
  // usuarios já está em Postgres — resolve primeiro quem bate com esses nomes lá,
  // depois filtra cronograma_tarefas (SQLite) por id ou pelo nome externo (fallback
  // de quando a tarefa não tem usuário cadastrado vinculado).
  const usuariosFiltro = await asyncDb.queryMany<{ id: number; nome: string }>(
    `SELECT id, nome FROM ${T_USUARIOS} WHERE ativo = true AND (
       LOWER(nome) LIKE '%michel cardero%' OR LOWER(nome) LIKE '%divonzi%'
       OR LOWER(nome) LIKE '%plinio%' OR LOWER(nome) LIKE '%plínio%'
     )`
  )
  const nomesPorId = new Map(usuariosFiltro.map(u => [u.id, u.nome]))
  const idsFiltro = usuariosFiltro.map(u => u.id)

  // cronogramas/cronograma_tarefas já estão em Postgres — a query roda lá, e
  // projetos/diretorias (SQLite) entram por lookup em lote a partir dos projeto_id
  // retornados, descartando tarefas de projeto inativo (equivalente ao antigo
  // `p.ativo = 1` no JOIN).
  const tarefasCronogramaPg = await asyncDb.queryMany<{
    id: number
    nome: string
    nivel: string
    percentual: number | null
    data_inicio: string | null
    data_inicio_baseline: string | null
    data_fim: string | null
    data_fim_baseline: string | null
    data_conclusao: string | null
    responsavel_id: number | null
    responsavel_nome_ext: string | null
    observacoes: string | null
    prazo_status: string | null
    bloqueio: number | null
    projeto_id: number
  }>(`
    SELECT
      t.id, t.nome, t.nivel, t.percentual,
      t.data_inicio, t.data_inicio_baseline, t.data_fim, t.data_fim_baseline, t.data_conclusao,
      t.responsavel_id, t.responsavel_nome_ext, t.observacoes, t.prazo_status, t.bloqueio,
      c.projeto_id
    FROM "AI"."TI_PMO_CRONOGRAMA_TAREFAS" t
    JOIN "AI"."TI_PMO_CRONOGRAMAS" c ON c.id = t.cronograma_id
    WHERE (t.ativo IS NULL OR t.ativo = true)
      AND (c.ativo IS NULL OR c.ativo = true)
      AND c.versao = (
        SELECT MAX(c2.versao) FROM "AI"."TI_PMO_CRONOGRAMAS" c2
        WHERE c2.projeto_id = c.projeto_id
          AND (c2.ativo IS NULL OR c2.ativo = true)
      )
      AND (
        t.responsavel_id = ANY(?)
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%michel cardero%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%divonzi%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plinio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plínio%'
      )
  `, [idsFiltro])

  const tCronoProjetoIds = [...new Set(tarefasCronogramaPg.map(t => t.projeto_id))]
  const tCronoProjetosInfo = tCronoProjetoIds.length
    ? db.prepare(`
        SELECT p.id, p.codigo AS projeto_codigo, p.nome AS projeto_nome, p.status AS projeto_status,
               d.nome AS diretoria
        FROM projetos p
        LEFT JOIN diretorias d ON d.id = p.diretoria_id
        WHERE p.id IN (${tCronoProjetoIds.map(() => '?').join(',')}) AND p.ativo = 1
      `).all(...tCronoProjetoIds) as Array<{ id: number; projeto_codigo: string; projeto_nome: string; projeto_status: string; diretoria: string | null }>
    : []
  const tCronoProjetoInfoMap = new Map(tCronoProjetosInfo.map(p => [p.id, p]))

  const tarefasCronograma = tarefasCronogramaPg
    .filter(t => tCronoProjetoInfoMap.has(t.projeto_id))
    .map(t => ({
      ...t,
      ...tCronoProjetoInfoMap.get(t.projeto_id)!,
      analista: (t.responsavel_id != null ? nomesPorId.get(t.responsavel_id) : undefined) ?? t.responsavel_nome_ext,
    }))
    .sort((a, b) => (a.projeto_nome === b.projeto_nome
      ? String(a.data_inicio ?? '').localeCompare(String(b.data_inicio ?? ''))
      : a.projeto_nome.localeCompare(b.projeto_nome)))

  // Dados dos usuários cadastrados: cargo, perfil, diretoria — para os filtros
  const usuariosRaw = await asyncDb.queryMany<{ nome: string; cargo: string | null; perfil_id: number; diretoria_id: number | null }>(
    `SELECT nome, cargo, perfil_id, diretoria_id FROM ${T_USUARIOS} WHERE ativo = true`
  )
  const perfilIds = [...new Set(usuariosRaw.map(u => u.perfil_id))]
  const diretoriaIds = [...new Set(usuariosRaw.map(u => u.diretoria_id).filter((v): v is number => v != null))]
  const perfis = perfilIds.length
    ? db.prepare(`SELECT id, codigo, nome FROM perfis WHERE ativo = 1 AND id IN (${perfilIds.map(() => '?').join(',')})`).all(...perfilIds) as { id: number; codigo: string; nome: string }[]
    : []
  const diretoriasPorUsuario = diretoriaIds.length
    ? db.prepare(`SELECT id, nome FROM diretorias WHERE ativo = 1 AND id IN (${diretoriaIds.map(() => '?').join(',')})`).all(...diretoriaIds) as { id: number; nome: string }[]
    : []
  const perfilMap = new Map(perfis.map(p => [p.id, p]))
  const diretoriaMap = new Map(diretoriasPorUsuario.map(d => [d.id, d.nome]))
  const usuariosInfo = usuariosRaw.map(u => ({
    nome: u.nome,
    cargo: u.cargo ?? '',
    perfil: perfilMap.get(u.perfil_id)?.codigo ?? '',
    perfil_nome: perfilMap.get(u.perfil_id)?.nome ?? '',
    diretoria: (u.diretoria_id != null ? diretoriaMap.get(u.diretoria_id) : undefined) ?? '',
  }))

  // Valores únicos para os dropdowns de filtro
  const cargosDistinct = [...new Set(
    (usuariosInfo as any[]).map((u: any) => u.cargo).filter(Boolean)
  )].sort() as string[]

  const perfisDistinct = [...new Map(
    (usuariosInfo as any[])
      .filter((u: any) => u.perfil)
      .map((u: any) => [u.perfil, { codigo: u.perfil, nome: u.perfil_nome }])
  ).values()] as { codigo: string; nome: string }[]

  const diretoriasDistinct = [...new Set(
    (usuariosInfo as any[]).map((u: any) => u.diretoria).filter(Boolean)
  )].sort() as string[]

  // Prioridades persistidas no DB (overrides, confirmações e vínculos)
  const tiPrioridadesDB = db.prepare('SELECT * FROM ti_prioridades WHERE fonte = ?').all('dev2026') as any[]

  // Lista de projetos disponíveis para vínculo
  const projetosDisponiveis = db.prepare(`
    SELECT id, codigo, nome, status FROM projetos WHERE ativo = 1 ORDER BY nome
  `).all() as { id: number; codigo: string; nome: string; status: string }[]

  // Hierarquia: para cada (projeto_id, analista), manter só o nível mais específico
  // Ordem de especificidade: SUBTAREFA > TAREFA > FASE
  const NIVEL_DEPTH: Record<string, number> = { SUBTAREFA: 3, TAREFA: 2, FASE: 1 }
  const tarefasHierarquizadas = (() => {
    const tarefas = tarefasCronograma as any[]
    // Determinar profundidade máxima por (projeto_id, analista)
    const maxDepth: Record<string, number> = {}
    tarefas.forEach((t: any) => {
      const key = `${t.projeto_id}::${t.analista}`
      const d = NIVEL_DEPTH[t.nivel] ?? 1
      if (!maxDepth[key] || d > maxDepth[key]) maxDepth[key] = d
    })
    // Manter apenas o nível mais específico
    return tarefas.filter((t: any) => {
      const key = `${t.projeto_id}::${t.analista}`
      return (NIVEL_DEPTH[t.nivel] ?? 1) === maxDepth[key]
    })
  })()

  return (
    <TIAgendaClient
      tarefasCronograma={tarefasHierarquizadas as any}
      dev2026={DEV2026_ATIVIDADES}
      tiPrioridadesDB={tiPrioridadesDB}
      usuariosInfo={usuariosInfo as any}
      cargosDistinct={cargosDistinct}
      perfisDistinct={perfisDistinct}
      diretoriasDistinct={diretoriasDistinct}
      projetosDisponiveis={projetosDisponiveis}
      session={session}
    />
  )
}
