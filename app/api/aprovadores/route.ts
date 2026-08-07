import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { UsuariosRepository } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const aprovadores = UsuariosRepository.findAprovadores()
  return NextResponse.json({ aprovadores })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const { tipo_documento, usuario_id, ordem } = await request.json()
  UsuariosRepository.createAprovador(tipo_documento, usuario_id, ordem || 1, session.id)
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  UsuariosRepository.softDeleteAprovador(Number(id))
  return NextResponse.json({ ok: true })
}
