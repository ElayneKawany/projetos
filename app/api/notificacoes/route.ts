import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarNotificacoes, marcarTodasLidas } from '@/lib/notificacoes'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const notificacoes = buscarNotificacoes(session.id, 100)
  return NextResponse.json({ notificacoes })
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  marcarTodasLidas(session.id)
  return NextResponse.json({ ok: true })
}
