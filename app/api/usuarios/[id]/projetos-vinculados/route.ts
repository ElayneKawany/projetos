import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

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

  // Cronograma tarefas → project link
  try {
    const cronRows = db.prepare(`
      SELECT DISTINCT p.id, p.codigo, p.nome, d.nome AS diretoria_nome, p.status,
             CASE WHEN ct.responsavel_id = ? THEN 'Responsável por Tarefa'
                  ELSE 'Executor de Tarefa' END AS papel
      FROM cronograma_tarefas ct
      JOIN cronogramas c ON ct.cronograma_id = c.id
      JOIN projetos p ON c.projeto_id = p.id
      LEFT JOIN diretorias d ON d.id = p.diretoria_id
      WHERE (ct.responsavel_id = ? OR ct.executor_id = ?)
        AND (ct.ativo IS NULL OR ct.ativo = 1)
        AND p.ativo = 1
    `).all(userId, userId, userId) as Row[]
    rows.push(...cronRows)
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
