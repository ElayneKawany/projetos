import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { apiLogger } from '@/lib/logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN.' }, { status: 403 })

  const { id } = await params
  const dirId = parseInt(id)
  if (isNaN(dirId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const db = getDb()
  const atual = db.prepare('SELECT * FROM diretorias WHERE id = ?').get(dirId) as Record<string, unknown> | undefined
  if (!atual) return NextResponse.json({ error: 'Diretoria não encontrada.' }, { status: 404 })

  const body = await request.json()
  const updates: string[] = []
  const vals: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim().replace(/\s+/g, ' ')
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 422 })
    const dup = db.prepare('SELECT id FROM diretorias WHERE LOWER(TRIM(nome)) = LOWER(?) AND id != ?').get(nome, dirId)
    if (dup) return NextResponse.json({ error: 'Já existe uma diretoria com este nome.' }, { status: 409 })
    updates.push('nome = @nome')
    vals.nome = nome
  }

  if (body.descricao !== undefined) {
    updates.push('descricao = @descricao')
    vals.descricao = body.descricao ? String(body.descricao).trim() : null
  }

  if (body.ativo !== undefined) {
    updates.push('ativo = @ativo')
    vals.ativo = body.ativo === 1 || body.ativo === true ? 1 : 0
  }

  if (body.diretor_responsavel_id !== undefined) {
    const dirId2 = body.diretor_responsavel_id ? Number(body.diretor_responsavel_id) : null
    if (dirId2) {
      const dir = db.prepare("SELECT id FROM usuarios WHERE id = ? AND ativo = 1 AND perfil_id = (SELECT id FROM perfis WHERE codigo = 'DIRETOR')").get(dirId2)
      if (!dir) return NextResponse.json({ error: 'Diretor responsável inválido. O usuário deve estar ativo e ter perfil DIRETOR.' }, { status: 422 })
    }
    updates.push('diretor_responsavel_id = @diretor_responsavel_id')
    vals.diretor_responsavel_id = dirId2
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 422 })

  updates.push('updated_at = @updated_at')
  vals.updated_at = new Date().toISOString()
  vals.id = dirId

  db.prepare(`UPDATE diretorias SET ${updates.join(', ')} WHERE id = @id`).run(vals)

  const atualizada = db.prepare('SELECT * FROM diretorias WHERE id = ?').get(dirId)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'diretorias',
    entidade_id: dirId,
    descricao: `Diretoria "${atual.nome}" atualizada`,
    dados_antes: atual,
    dados_depois: atualizada,
  })

  return NextResponse.json({ diretoria: atualizada })
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
  const dirId = parseInt(id)
  if (isNaN(dirId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const db = getDb()
  const atual = db.prepare('SELECT * FROM diretorias WHERE id = ?').get(dirId) as Record<string, unknown> | undefined
  if (!atual) return NextResponse.json({ error: 'Diretoria não encontrada.' }, { status: 404 })

  // Verificar TODAS as tabelas que referenciam diretorias
  const impedimentos: string[] = []

  const projetos = (db.prepare('SELECT COUNT(*) as c FROM projetos WHERE diretoria_id = ? AND ativo = 1').get(dirId) as { c: number }).c
  if (projetos > 0) impedimentos.push(`${projetos} projeto${projetos > 1 ? 's' : ''} vinculado${projetos > 1 ? 's' : ''}`)

  const areas = (db.prepare('SELECT COUNT(*) as c FROM areas WHERE diretoria_id = ?').get(dirId) as { c: number }).c
  if (areas > 0) impedimentos.push(`${areas} área${areas > 1 ? 's' : ''} vinculada${areas > 1 ? 's' : ''}`)

  const usuarios = (db.prepare('SELECT COUNT(*) as c FROM usuarios WHERE diretoria_id = ? AND ativo = 1').get(dirId) as { c: number }).c
  if (usuarios > 0) impedimentos.push(`${usuarios} usuário${usuarios > 1 ? 's' : ''} vinculado${usuarios > 1 ? 's' : ''}`)

  if (impedimentos.length > 0) {
    const lista = impedimentos.map(i => `• ${i}`).join('\n')
    return NextResponse.json({
      error: `Não é possível excluir "${atual.nome}". Existem registros vinculados:\n${lista}`,
    }, { status: 422 })
  }

  try {
    const result = db.prepare('DELETE FROM diretorias WHERE id = ?').run(dirId)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Nenhum registro foi removido. A diretoria pode já ter sido excluída.' }, { status: 404 })
    }
  } catch (e) {
    // FK constraint inesperada — reportar tabela de origem quando possível
    const msg = e instanceof Error ? e.message : String(e)
    apiLogger.error({ route: 'DELETE /diretorias', msg }, 'FK inesperada')
    return NextResponse.json({
      error: `Não foi possível excluir a diretoria. Existem registros vinculados em outras tabelas do sistema.`,
    }, { status: 422 })
  }

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'DELETE',
    entidade: 'diretorias',
    entidade_id: dirId,
    descricao: `Diretoria "${atual.nome}" excluída`,
    dados_antes: atual,
    dados_depois: null,
  })

  return NextResponse.json({ ok: true })
}
