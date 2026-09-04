import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'

export interface ProjetoVinculado {
  id: number
  codigo: string
  nome: string
  diretoria_nome: string | null
  status: string
  papeis: string[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const db = getDb()

  // Collect projects with at least one direct link via projetos columns
  type Row = { id: number; codigo: string; nome: string; diretoria_nome: string | null; status: string; papel: string }

  const rows: Row[] = []

  const queries: Array<[string, string]> = [
    [`SELECT p.id, p.codigo, p.nome, d.nome AS diretoria_nome, p.status, 'Gerente do Projeto' AS papel
      FROM projetos p LEFT JOIN diretorias d ON d.id = p.diretoria_id
      WHERE p.gerente_id = ? AND p.ativo = 1`, 'Gerente do Projeto'],
    [`SELECT p.id, p.codigo, p.nome, d.nome AS diretoria_nome, p.status, 'PMO Responsável' AS papel
      FROM projetos p LEFT JOIN diretorias d ON d.id = p.diretoria_id
      WHERE p.pmo_responsavel_id = ? AND p.ativo = 1`, 'PMO Responsável'],
    [`SELECT p.id, p.codigo, p.nome, d.nome AS diretoria_nome, p.status, 'Solicitante' AS papel
      FROM projetos p LEFT JOIN diretorias d ON d.id = p.diretoria_id
      WHERE p.solicitante_id = ? AND p.ativo = 1`, 'Solicitante'],
  ]

  for (const [sql] of queries) {
    try {
      const res = db.prepare(sql).all(userId) as Row[]
      rows.push(...res)
    } catch { /* column may not exist */ }
  }

  // Cronograma tarefas → project link.
  // cronograma_tarefas/cronogramas já migradas para Postgres — o join com projetos/diretorias
  // (ainda em SQLite) não é mais possível em uma única query cross-database. Resolvido em
  // duas etapas: (1) busca no Postgres quais projeto_id/papel batem para este usuário,
  // (2) busca em lote no SQLite os dados de projetos/diretorias para esses ids, com merge em JS.
  try {
    const cronMatches = await asyncDb.queryMany<{ projeto_id: number; papel: string }>(
      `SELECT DISTINCT c.projeto_id,
              CASE WHEN ct.responsavel_id = ? THEN 'Responsável por Tarefa'
                   ELSE 'Executor de Tarefa' END AS papel
       FROM "AI"."TI_PMO_CRONOGRAMA_TAREFAS" ct
       JOIN "AI"."TI_PMO_CRONOGRAMAS" c ON ct.cronograma_id = c.id
       WHERE (ct.responsavel_id = ? OR ct.executor_id = ?)
         AND (ct.ativo IS NULL OR ct.ativo = true)`,
      [userId, userId, userId]
    )

    const projetoIds = [...new Set(cronMatches.map(r => r.projeto_id))]
    if (projetoIds.length > 0) {
      const placeholders = projetoIds.map(() => '?').join(',')
      const projRows = db.prepare(`
        SELECT p.id, p.codigo, p.nome, d.nome AS diretoria_nome, p.status
        FROM projetos p LEFT JOIN diretorias d ON d.id = p.diretoria_id
        WHERE p.id IN (${placeholders}) AND p.ativo = 1
      `).all(...projetoIds) as Omit<Row, 'papel'>[]
      const projMap = new Map(projRows.map(p => [p.id, p]))

      for (const m of cronMatches) {
        const p = projMap.get(m.projeto_id)
        if (p) rows.push({ ...p, papel: m.papel })
      }
    }
  } catch { /* table may not exist */ }

  // Merge: group by project, collect unique papeis
  const map = new Map<number, ProjetoVinculado>()
  for (const r of rows) {
    if (!map.has(r.id)) {
      map.set(r.id, { id: r.id, codigo: r.codigo, nome: r.nome, diretoria_nome: r.diretoria_nome, status: r.status, papeis: [] })
    }
    const proj = map.get(r.id)!
    if (!proj.papeis.includes(r.papel)) proj.papeis.push(r.papel)
  }

  const projetos = Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo))
  return NextResponse.json({ projetos })
}
