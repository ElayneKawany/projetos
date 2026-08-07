import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const status = db.prepare('SELECT * FROM config_status_projeto ORDER BY ordem ASC').all()
  return NextResponse.json({ status })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const body = await request.json()
  const { codigo, label, descricao, cor, ordem } = body

  if (!codigo || !label) {
    return NextResponse.json({ error: 'Campos obrigatórios: codigo e label.' }, { status: 400 })
  }

  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO config_status_projeto (codigo, label, descricao, cor, ordem)
      VALUES (?, ?, ?, ?, ?)
    `).run(codigo.toUpperCase().replace(/\s+/g, '_'), label, descricao ?? null, cor ?? '#6B7280', ordem ?? 99)

    const novo = db.prepare('SELECT * FROM config_status_projeto WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json({ status: novo }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Código já existe ou erro ao criar.' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const body = await request.json()
  const { id, label, descricao, cor, ordem, ativo, is_initial } = body

  if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })

  const db = getDb()

  // Se marcando como inicial, remove flag dos demais
  if (is_initial === 1) {
    db.prepare('UPDATE config_status_projeto SET is_initial = 0').run()
  }

  const updates: string[] = []
  const params: Record<string, unknown> = { id }

  if (label !== undefined)      { updates.push('label = @label');           params.label = label }
  if (descricao !== undefined)  { updates.push('descricao = @descricao');   params.descricao = descricao }
  if (cor !== undefined)        { updates.push('cor = @cor');               params.cor = cor }
  if (ordem !== undefined)      { updates.push('ordem = @ordem');           params.ordem = ordem }
  if (ativo !== undefined)      { updates.push('ativo = @ativo');           params.ativo = ativo }
  if (is_initial !== undefined) { updates.push('is_initial = @is_initial'); params.is_initial = is_initial }

  if (!updates.length) return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })

  updates.push('updated_at = CURRENT_TIMESTAMP')
  db.prepare(`UPDATE config_status_projeto SET ${updates.join(', ')} WHERE id = @id`).run(params)

  const atualizado = db.prepare('SELECT * FROM config_status_projeto WHERE id = ?').get(id)
  return NextResponse.json({ status: atualizado })
}
