import { NextRequest, NextResponse } from 'next/server'
import { getSession, hashSenha } from '@/lib/auth'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { UsuariosRepository } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const all = session.perfil === 'ADMIN' && request.nextUrl.searchParams.get('all') === '1'
  const usuarios = await UsuariosRepository.findAllWithPerfil(all)
  return NextResponse.json({ usuarios })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session || session.perfil !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  const body = await request.json()
  const { nome, cpf, email, cargo, perfil_id, diretoria_id, area_id, senha } = body

  if (!nome || !cpf || !email || !senha || !perfil_id) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
  }
  if (senha.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres.' }, { status: 400 })
  }

  const existente = await UsuariosRepository.findByEmailOrCpf(cpf, email)
  if (existente) return NextResponse.json({ error: 'CPF ou e-mail já cadastrado.' }, { status: 409 })

  const senhaHash = await hashSenha(senha)
  const novoId = await UsuariosRepository.createWithPerfilId({
    cpf, nome, email, senhaHash,
    cargo: cargo || null, perfil_id,
    diretoria_id: diretoria_id || null, area_id: area_id || null,
  })

  registrarAuditoria({
    usuario_id: session.id, usuario_nome: session.nome,
    acao: 'CREATE', entidade: 'usuarios', entidade_id: Number(novoId),
    descricao: `Usuário criado: ${nome} (${email})`,
  })

  return NextResponse.json({ id: novoId }, { status: 201 })
}
