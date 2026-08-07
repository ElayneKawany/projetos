import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session || !temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const tipo = db
    .prepare('SELECT * FROM config_cronograma_tipos WHERE id = ?')
    .get(Number(id)) as Record<string, unknown> | undefined

  if (!tipo) return NextResponse.json({ error: 'Tipo não encontrado.' }, { status: 404 })

  const body = await request.json() as { label?: string; ativo?: number; ordem?: number }

  // Tipos do sistema (is_system=1) não podem ser desativados
  if (body.ativo === 0 && tipo.is_system === 1) {
    return NextResponse.json(
      { error: 'Tipos padrão do sistema não podem ser desativados.' },
      { status: 400 }
    )
  }

  const updates: string[] = []
  const values: unknown[] = []

  if (body.label !== undefined) { updates.push('label = ?');  values.push(body.label.trim()) }
  if (body.ativo !== undefined) { updates.push('ativo = ?');  values.push(body.ativo) }
  if (body.ordem !== undefined) { updates.push('ordem = ?');  values.push(body.ordem) }

  if (updates.length === 0)
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })

  values.push(Number(id))
  db.prepare(`UPDATE config_cronograma_tipos SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return NextResponse.json({ ok: true })
}
