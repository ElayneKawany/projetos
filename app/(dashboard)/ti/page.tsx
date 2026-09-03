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
  const idsPlaceholder = idsFiltro.length ? idsFiltro.map(() => '?').join(',') : '-1'

  const tarefasCronogramaRaw = db.prepare(`
    SELECT
      t.id,
      t.nome,
      t.nivel,
      t.percentual,
      t.data_inicio,
      t.data_inicio_baseline,
      t.data_fim,
      t.data_fim_baseline,
      t.data_conclusao,
      t.responsavel_id,
      t.responsavel_nome_ext,
      t.observacoes,
      t.prazo_status,
      t.bloqueio,
      c.projeto_id,
      p.codigo AS projeto_codigo,
      p.nome AS projeto_nome,
      p.status AS projeto_status,
      d.nome AS diretoria
    FROM cronograma_tarefas t
    JOIN cronogramas c ON c.id = t.cronograma_id
    JOIN projetos p ON p.id = c.projeto_id
    LEFT JOIN diretorias d ON d.id = p.diretoria_id
    WHERE (t.ativo IS NULL OR t.ativo = 1)
      AND (c.ativo IS NULL OR c.ativo = 1)
      AND p.ativo = 1
      AND c.versao = (
        SELECT MAX(c2.versao) FROM cronogramas c2
        WHERE c2.projeto_id = c.projeto_id
          AND (c2.ativo IS NULL OR c2.ativo = 1)
      )
      AND (
        t.responsavel_id IN (${idsPlaceholder})
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%michel cardero%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%divonzi%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plinio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plínio%'
      )
    ORDER BY p.nome, t.data_inicio
  `).all(...idsFiltro) as { id: number; responsavel_id: number | null; responsavel_nome_ext: string | null; [k: string]: unknown }[]

  const tarefasCronograma = tarefasCronogramaRaw.map(t => ({
    ...t,
    analista: (t.responsavel_id != null ? nomesPorId.get(t.responsavel_id) : undefined) ?? t.responsavel_nome_ext,
  }))

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
