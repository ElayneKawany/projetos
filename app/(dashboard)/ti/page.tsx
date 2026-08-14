import { getSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import getDb from '@/lib/db'
import TIAgendaClient from './TIAgendaClient'
import { DEV2026_ATIVIDADES } from '@/lib/ti/dev2026-data'

export default async function TIAgendaPage() {
  const session = await getSession()
  if (!session) notFound()

  const db = getDb()

  // Tarefas de TI dos cronogramas ativos onde responsável é Michel, Divonzi ou Plinio
  const tarefasCronograma = db.prepare(`
    SELECT
      t.id,
      t.nome,
      t.nivel,
      t.percentual,
      t.data_inicio,
      t.data_fim,
      t.data_conclusao,
      t.responsavel_nome_ext,
      COALESCE(u.nome, t.responsavel_nome_ext) AS analista,
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
    LEFT JOIN usuarios u ON u.id = t.responsavel_id
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
        LOWER(COALESCE(u.nome, ''))             LIKE '%michel cardero%'
        OR LOWER(COALESCE(u.nome, ''))          LIKE '%divonzi%'
        OR LOWER(COALESCE(u.nome, ''))          LIKE '%plinio%'
        OR LOWER(COALESCE(u.nome, ''))          LIKE '%plínio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%michel cardero%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%divonzi%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plinio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plínio%'
      )
    ORDER BY p.nome, t.data_inicio
  `).all()

  // Dados dos usuários cadastrados: cargo, perfil, diretoria — para os filtros
  const usuariosInfo = db.prepare(`
    SELECT
      u.nome,
      COALESCE(u.cargo, '') AS cargo,
      COALESCE(pf.codigo, '') AS perfil,
      COALESCE(pf.nome, '') AS perfil_nome,
      COALESCE(d.nome, '') AS diretoria
    FROM usuarios u
    LEFT JOIN perfis pf ON pf.id = u.perfil_id AND pf.ativo = 1
    LEFT JOIN diretorias d ON d.id = u.diretoria_id AND d.ativo = 1
    WHERE u.ativo = 1
  `).all()

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
