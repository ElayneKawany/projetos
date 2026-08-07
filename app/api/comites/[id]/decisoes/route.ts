import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const decisoes = ComitesRepository.findDecisoesByComiteId(parseInt(id))
  return NextResponse.json({ decisoes })
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'DIRETOR')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  const body = await request.json()

  if (!body.descricao?.trim()) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 422 })

  const newId = ComitesRepository.insertDecisao({
    comite_id: comiteId,
    projeto_id: body.projeto_id || null,
    tipo: body.tipo || 'PENDENTE',
    descricao: body.descricao.trim(),
    responsavel_nome: body.responsavel_nome || null,
    prazo: body.prazo || null,
    status: body.status || 'PENDENTE',
    created_by: session.id,
  })
  return NextResponse.json({ id: newId }, { status: 201 })
}
