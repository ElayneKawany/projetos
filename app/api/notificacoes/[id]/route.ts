import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { marcarNotificacaoLida } from '@/lib/notificacoes'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  marcarNotificacaoLida(Number(id), session.id)
  return NextResponse.json({ ok: true })
}
