import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { encerrarPayback } from '@/lib/projetos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const motivo: string = body?.motivo ?? ''
  try {
    encerrarPayback(Number(id), motivo, session.id, session.nome)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao encerrar payback.' },
      { status: 400 }
    )
  }
}
