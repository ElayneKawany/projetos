import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

/** GET /api/configuracoes/centros-custo — lista centros de custo ativos */
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const centros = db.prepare(`
    SELECT * FROM config_centros_custo WHERE ativo = 1 ORDER BY codigo
  `).all()

  return NextResponse.json({ centros })
}

/** POST /api/configuracoes/centros-custo — cria centro de custo */
export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Apenas PMO ou Admin pode gerenciar centros de custo.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    codigo?: string
    descricao?: string
    empresa?: string
    filial?: string
  }

  if (!body.codigo?.trim() || !body.descricao?.trim()) {
    return NextResponse.json({ error: 'Código e descrição são obrigatórios.' }, { status: 400 })
  }

  const db = getDb()

  try {
    const result = db.prepare(`
      INSERT INTO config_centros_custo (codigo, descricao, empresa, filial)
      VALUES (?, ?, ?, ?)
    `).run(
      body.codigo.trim(),
      body.descricao.trim(),
      body.empresa ?? null,
      body.filial ?? null,
    )

    return NextResponse.json({ ok: true, id: result.lastInsertRowid }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Código já existe.' }, { status: 409 })
  }
}

/** PATCH /api/configuracoes/centros-custo — atualiza centro de custo */
export async function PATCH(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    id?: number
    descricao?: string
    empresa?: string
    filial?: string
    ativo?: number
  }

  if (!body.id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

  const db = getDb()
  db.prepare(`
    UPDATE config_centros_custo
    SET descricao = COALESCE(?, descricao),
        empresa   = COALESCE(?, empresa),
        filial    = COALESCE(?, filial),
        ativo     = COALESCE(?, ativo),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    body.descricao ?? null,
    body.empresa ?? null,
    body.filial ?? null,
    body.ativo ?? null,
    body.id,
  )

  return NextResponse.json({ ok: true })
}
