import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { registrarAuditoria } from '@/lib/db/auditoria'

const COOKIE_NAME = 'megag_pmo_session'

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (session) {
    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'LOGOUT',
      entidade: 'usuarios',
      entidade_id: session.id,
      descricao: `Logout de ${session.nome}`,
    })
  }
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete(COOKIE_NAME)
  return response
}
