import { NextRequest, NextResponse } from 'next/server'
import { getSession, hashSenha } from '@/lib/auth'
import { UsuariosRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN.' }, { status: 403 })

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const atual = await UsuariosRepository.findRawById(userId)
  if (!atual) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }

  const fields: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 422 })
    fields.nome = nome
  }

  if (body.cpf !== undefined) {
    const cpf = String(body.cpf).replace(/\D/g, '')
    if (cpf) {
      const dup = await UsuariosRepository.checkCpfDuplicado(cpf, userId)
      if (dup) return NextResponse.json({ error: 'Este CPF já está cadastrado para outro usuário.' }, { status: 409 })
      fields.cpf = cpf
    }
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 422 })
    const dup = await UsuariosRepository.checkEmailDuplicado(email, userId)
    if (dup) return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 409 })
    fields.email = email
  }

  if (body.cargo !== undefined) {
    fields.cargo = body.cargo ? String(body.cargo).trim() : null
  }

  if (body.perfil_id !== undefined) {
    const perfilId = Number(body.perfil_id)
    const perfil = UsuariosRepository.findPerfilById(perfilId)
    if (!perfil) return NextResponse.json({ error: 'Perfil inválido.' }, { status: 422 })
    fields.perfil_id = perfilId
  }

  if (body.diretoria_id !== undefined) {
    fields.diretoria_id = body.diretoria_id ? Number(body.diretoria_id) : null
  }

  if (body.area_id !== undefined) {
    fields.area_id = body.area_id ? Number(body.area_id) : null
  }

  if (body.ativo !== undefined) {
    fields.ativo = body.ativo === 1 || body.ativo === true ? 1 : 0
  }

  if (body.senha !== undefined && body.senha !== '') {
    const senha = String(body.senha)
    if (senha.length < 8) return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres.' }, { status: 422 })
    fields.senha_hash = await hashSenha(senha)
  }

  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: true })

  await UsuariosRepository.updateFull(userId, fields)

  const depois = await UsuariosRepository.findRawById(userId)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'usuarios',
    entidade_id: userId,
    descricao: `Usuário "${atual.nome}" atualizado`,
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
  const userId = parseInt(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  if (userId === session.id)
    return NextResponse.json({ error: 'Não é possível excluir o próprio usuário.', pode_inativar: false }, { status: 422 })

  const atual = await UsuariosRepository.findRawById(userId)
  if (!atual) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

  if (await UsuariosRepository.checkDependencias(userId)) {
    return NextResponse.json({
      error: 'Este usuário possui vínculos com projetos ou registros do sistema e não pode ser excluído.',
      pode_inativar: true,
    }, { status: 422 })
  }

  try {
    await UsuariosRepository.hardDelete(userId)
  } catch {
    return NextResponse.json({
      error: 'Este usuário possui vínculos com projetos ou registros do sistema e não pode ser excluído.',
      pode_inativar: true,
    }, { status: 422 })
  }

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'DELETE',
    entidade: 'usuarios',
    entidade_id: userId,
    descricao: `Usuário "${atual.nome}" excluído`,
    dados_antes: atual,
    dados_depois: null,
  })

  return NextResponse.json({ ok: true })
}
