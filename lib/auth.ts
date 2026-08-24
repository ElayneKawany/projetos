import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { UsuariosRepository } from '@/lib/repositories'
import { env } from '@/lib/config/env'

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET)
const COOKIE_NAME = 'megag_pmo_session'
const SESSION_DURATION = 60 * 60 * 8 // 8 horas

export interface SessionUser {
  id: number
  cpf: string
  nome: string
  email: string
  cargo: string | null
  diretoria_id: number | null
  diretoria_nome: string | null
  area_id: number | null
  perfil: string  // ADMIN | PMO | DIRETOR | GESTOR | SOLICITANTE | CEO
  perfil_id: number
}

export async function criarToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET)
}

export async function verificarToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.user as SessionUser
  } catch {
    return null
  }
}

export async function getSession(request?: NextRequest): Promise<SessionUser | null> {
  let token: string | undefined
  if (request) {
    // Lê direto do objeto request (mesmo padrão do middleware) — mais confiável em POST handlers
    token = request.cookies.get(COOKIE_NAME)?.value
  } else {
    const cookieStore = await cookies()
    token = cookieStore.get(COOKIE_NAME)?.value
  }
  if (!token) return null
  return verificarToken(token)
}

export async function login(cpf: string, senha: string): Promise<{
  success: boolean
  user?: SessionUser
  token?: string
  error?: string
}> {
  const cpfLimpo = cpf.replace(/\D/g, '')

  const usuario = UsuariosRepository.findByCpfForLogin(cpfLimpo)

  if (!usuario) {
    return { success: false, error: 'CPF ou senha inválidos.' }
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash as string)
  if (!senhaValida) {
    return { success: false, error: 'CPF ou senha inválidos.' }
  }

  // Atualizar último login
  UsuariosRepository.updateUltimoLogin(usuario.id as number)

  const user: SessionUser = {
    id: usuario.id as number,
    cpf: usuario.cpf as string,
    nome: usuario.nome as string,
    email: usuario.email as string,
    cargo: usuario.cargo as string | null,
    diretoria_id: usuario.diretoria_id as number | null,
    diretoria_nome: usuario.diretoria_nome as string | null,
    area_id: usuario.area_id as number | null,
    perfil: usuario.perfil_codigo as string,
    perfil_id: usuario.perfil_id as number,
  }

  const token = await criarToken(user)
  return { success: true, user, token }
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12)
}

export function temPermissao(perfil: string, permissaoNecessaria: string): boolean {
  const hierarquia: Record<string, number> = {
    ADMIN: 100,
    PMO: 80,
    CEO: 70,
    DIRETOR: 60,
    GESTOR: 40,
    SOLICITANTE: 20,
  }

  const nivelUsuario = hierarquia[perfil] ?? 0

  const permissoes: Record<string, number> = {
    'config:write': 100,
    'usuarios:write': 100,
    'projetos:create': 20,
    'projetos:manage': 40,
    'projetos:approve': 60,
    'comites:manage': 80,
    'financeiro:approve': 60,
    'auditoria:view': 40,
    'dashboard:executive': 60,
    'cronograma:excluir_pagamento': 80,
  }

  const nivelNecessario = permissoes[permissaoNecessaria] ?? 100
  return nivelUsuario >= nivelNecessario
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME
