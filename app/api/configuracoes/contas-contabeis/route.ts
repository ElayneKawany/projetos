import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

/** GET /api/configuracoes/contas-contabeis — lista contas contábeis ativas */
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const contas = db.prepare(`
    SELECT * FROM config_contas_contabeis WHERE ativo = 1 ORDER BY codigo
  `).all()

  return NextResponse.json({ contas })
}

/** POST /api/configuracoes/contas-contabeis — cria conta contábil */
export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Apenas PMO ou Admin pode gerenciar contas contábeis.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    codigo?: string
    descricao?: string
    tipo?: string
    empresa?: string
    filial?: string
    integracao_codigo?: string
    data_inicio?: string
    data_fim?: string
  }

  if (!body.codigo?.trim() || !body.descricao?.trim()) {
    return NextResponse.json({ error: 'Código e descrição são obrigatórios.' }, { status: 400 })
  }

  const tiposValidos = ['CAPEX_ATIVO', 'CAPEX_RETORNO', 'OPEX']
  if (body.tipo && !tiposValidos.includes(body.tipo)) {
    return NextResponse.json({ error: `tipo inválido. Use: ${tiposValidos.join(', ')}` }, { status: 400 })
  }

  const db = getDb()

  try {
    const result = db.prepare(`
      INSERT INTO config_contas_contabeis
        (codigo, descricao, tipo, empresa, filial, integracao_codigo, data_inicio, data_fim)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.codigo.trim(),
      body.descricao.trim(),
      body.tipo ?? 'CAPEX_ATIVO',
      body.empresa ?? null,
      body.filial ?? null,
      body.integracao_codigo ?? null,
      body.data_inicio ?? null,
      body.data_fim ?? null,
    )

    return NextResponse.json({ ok: true, id: result.lastInsertRowid }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Código já existe.' }, { status: 409 })
  }
}

/** PATCH /api/configuracoes/contas-contabeis — atualiza conta contábil */
export async function PATCH(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    id?: number
    descricao?: string
    tipo?: string
    empresa?: string
    filial?: string
    integracao_codigo?: string
    ativo?: number
    data_inicio?: string
    data_fim?: string
  }

  if (!body.id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

  const db = getDb()
  db.prepare(`
    UPDATE config_contas_contabeis
    SET descricao = COALESCE(?, descricao),
        tipo = COALESCE(?, tipo),
        empresa = COALESCE(?, empresa),
        filial = COALESCE(?, filial),
        integracao_codigo = COALESCE(?, integracao_codigo),
        ativo = COALESCE(?, ativo),
        data_inicio = COALESCE(?, data_inicio),
        data_fim = COALESCE(?, data_fim),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    body.descricao ?? null,
    body.tipo ?? null,
    body.empresa ?? null,
    body.filial ?? null,
    body.integracao_codigo ?? null,
    body.ativo ?? null,
    body.data_inicio ?? null,
    body.data_fim ?? null,
    body.id,
  )

  return NextResponse.json({ ok: true })
}
