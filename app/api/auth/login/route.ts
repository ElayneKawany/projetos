import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { registrarAuditoria } from '@/lib/db/auditoria'

const COOKIE_NAME = 'megag_pmo_session'

export async function POST(request: NextRequest) {
  try {
    const { cpf, senha } = await request.json()

    if (!cpf || !senha) {
      return NextResponse.json({ error: 'CPF e senha são obrigatórios.' }, { status: 400 })
    }

    const result = await login(cpf, senha)

    if (!result.success || !result.token || !result.user) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    registrarAuditoria({
      usuario_id: result.user.id,
      usuario_nome: result.user.nome,
      acao: 'LOGIN',
      entidade: 'usuarios',
      entidade_id: result.user.id,
      descricao: `Login realizado por ${result.user.nome} (${result.user.perfil})`,
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    })

    const response = NextResponse.json({ success: true, user: result.user })
    response.cookies.set(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })
    return response
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
