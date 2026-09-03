import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { registrarAuditoria } from '@/lib/db/auditoria'

const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN.' }, { status: 403 })

  const { id } = await params
  const areaId = parseInt(id)
  if (isNaN(areaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const db = getDb()
  const atual = db.prepare('SELECT * FROM areas WHERE id = ?').get(areaId) as Record<string, unknown> | undefined
  if (!atual) return NextResponse.json({ error: 'Área não encontrada.' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }

  const updates: string[] = []
  const vals: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 422 })
    updates.push('nome = @nome'); vals.nome = nome
  }

  if (body.sigla !== undefined) {
    updates.push('sigla = @sigla'); vals.sigla = body.sigla ? String(body.sigla).trim() : null
  }

  if (body.diretoria_id !== undefined) {
    const dirId = Number(body.diretoria_id)
    if (!dirId) return NextResponse.json({ error: 'Diretoria é obrigatória.' }, { status: 422 })
    const dir = db.prepare('SELECT id FROM diretorias WHERE id = ? AND ativo = 1').get(dirId)
    if (!dir) return NextResponse.json({ error: 'Diretoria não encontrada ou inativa.' }, { status: 422 })
    updates.push('diretoria_id = @diretoria_id'); vals.diretoria_id = dirId
  }

  if (body.descricao !== undefined) {
    updates.push('descricao = @descricao')
    vals.descricao = body.descricao ? String(body.descricao).trim() : null
  }

  if (body.ativo !== undefined) {
    updates.push('ativo = @ativo')
    vals.ativo = body.ativo === 1 || body.ativo === true ? 1 : 0
  }

  if (updates.length === 0) return NextResponse.json({ ok: true })

  updates.push("updated_at = datetime('now')")
  vals.id = areaId
  db.prepare(`UPDATE areas SET ${updates.join(', ')} WHERE id = @id`).run(vals)

  const depois = db.prepare('SELECT * FROM areas WHERE id = ?').get(areaId)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'areas',
    entidade_id: areaId,
    descricao: `Área "${atual.nome}" atualizada`,
    dados_antes: atual,
    dados_depois: depois,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN.' }, { status: 403 })

  const { id } = await params
  const areaId = parseInt(id)
  if (isNaN(areaId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const db = getDb()
  const atual = db.prepare('SELECT * FROM areas WHERE id = ?').get(areaId) as Record<string, unknown> | undefined
  if (!atual) return NextResponse.json({ error: 'Área não encontrada.' }, { status: 404 })

  const projetos = db.prepare('SELECT COUNT(*) as c FROM projetos WHERE area_id = ? AND ativo = 1').get(areaId) as { c: number }
  if (projetos.c > 0) {
    return NextResponse.json({
      error: 'Existem registros vinculados a esta área. A exclusão não é permitida.',
      pode_inativar: true,
    }, { status: 422 })
  }

  const usuariosVinculados = await asyncDb.queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${T_USUARIOS} WHERE area_id = ? AND ativo = true`,
    [areaId]
  )
  if (Number(usuariosVinculados?.c ?? 0) > 0) {
    return NextResponse.json({
      error: 'Existem registros vinculados a esta área. A exclusão não é permitida.',
      pode_inativar: true,
    }, { status: 422 })
  }

  try {
    db.prepare('DELETE FROM areas WHERE id = ?').run(areaId)
  } catch {
    return NextResponse.json({
      error: 'Existem registros vinculados a esta área. A exclusão não é permitida.',
      pode_inativar: true,
    }, { status: 422 })
  }

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'DELETE',
    entidade: 'areas',
    entidade_id: areaId,
    descricao: `Área "${atual.nome}" excluída`,
    dados_antes: atual,
    dados_depois: null,
  })

  return NextResponse.json({ ok: true })
}
