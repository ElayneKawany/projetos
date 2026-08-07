import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  const body = await request.json()

  const projetoId = parseInt(body.projeto_id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'projeto_id inválido.' }, { status: 422 })

  const existente = ComitesRepository.findComiteProjetoExistente(comiteId, projetoId)
  if (existente) return NextResponse.json({ error: 'Projeto já adicionado a este comitê.' }, { status: 409 })

  const proj = ComitesRepository.findProjetoSnapshot(projetoId)
  if (!proj) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const newId = ComitesRepository.insertComiteProjeto({
    comite_id: comiteId,
    projeto_id: projetoId,
    pauta_item: body.pauta_item || null,
    ordem_pauta: body.ordem_pauta || 0,
    tempo_previsto: body.tempo_previsto || null,
    snap_prioridade: proj.prioridade,
    snap_complexidade: proj.complexidade,
    snap_investimento: proj.investimento,
    snap_roi: proj.roi_previsto,
  })
  return NextResponse.json({ id: newId }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  const url = new URL(request.url)
  const projetoId = parseInt(url.searchParams.get('projeto_id') || '')
  if (isNaN(projetoId)) return NextResponse.json({ error: 'projeto_id inválido.' }, { status: 422 })

  ComitesRepository.removeProjeto(comiteId, projetoId)
  return NextResponse.json({ ok: true })
}
