import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(request.url)
  const conds = ['1=1']
  const vals: Record<string, unknown> = {}

  if (searchParams.get('projeto_id')) {
    conds.push('fl.projeto_id = @projeto_id')
    vals.projeto_id = Number(searchParams.get('projeto_id'))
  }
  if (searchParams.get('tipo')) {
    conds.push('fl.tipo = @tipo')
    vals.tipo = searchParams.get('tipo')
  }
  if (searchParams.get('status')) {
    conds.push('fl.status = @status')
    vals.status = searchParams.get('status')
  }

  const lancamentos = db
    .prepare(
      `SELECT fl.*, p.nome as projeto_nome, p.codigo as projeto_codigo, u.nome as criador_nome
       FROM financeiro_lancamentos fl
       LEFT JOIN projetos p ON fl.projeto_id = p.id
       LEFT JOIN usuarios u ON fl.criado_por = u.id
       WHERE ${conds.join(' AND ')}
       ORDER BY fl.created_at DESC
       LIMIT 200`
    )
    .all(vals)

  return NextResponse.json({ lancamentos })
}
