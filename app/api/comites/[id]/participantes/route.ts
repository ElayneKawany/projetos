import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const participantes = await ComitesRepository.findParticipantes(parseInt(id))
  return NextResponse.json({ participantes })
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  const comite = await ComitesRepository.findById(comiteId)
  if (!comite) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const body = await request.json()
  const newId = ComitesRepository.insertParticipante({
    comite_id: comiteId,
    usuario_id: body.usuario_id || null,
    nome_externo: body.nome_externo || null,
    cargo: body.cargo || null,
    presente: !!body.presente,
    confirmado: !!body.confirmado,
  })
  return NextResponse.json({ id: newId }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  const body = await request.json()

  if (Array.isArray(body.presencas)) {
    ComitesRepository.updatePresencaBulk(comiteId, body.presencas)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Payload inválido.' }, { status: 422 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  const { searchParams } = new URL(request.url)
  const participanteId = parseInt(searchParams.get('participante_id') || '')
  if (isNaN(participanteId)) return NextResponse.json({ error: 'ID do participante inválido.' }, { status: 400 })

  ComitesRepository.deleteParticipante(comiteId, participanteId)
  return NextResponse.json({ ok: true })
}
