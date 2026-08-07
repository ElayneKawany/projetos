import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'

type Params = { params: Promise<{ id: string; decId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'DIRETOR')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id, decId } = await params
  const rec = ComitesRepository.findDecisao(parseInt(decId), parseInt(id))
  if (!rec) return NextResponse.json({ error: 'Decisão não encontrada.' }, { status: 404 })

  const body = await request.json()
  const campos = ['tipo', 'descricao', 'responsavel_nome', 'prazo', 'status']
  const fields: Record<string, unknown> = {}
  for (const c of campos) {
    if (body[c] !== undefined) fields[c] = body[c]
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 422 })

  ComitesRepository.updateDecisao(parseInt(decId), fields)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id, decId } = await params
  ComitesRepository.deleteDecisao(parseInt(decId), parseInt(id))
  return NextResponse.json({ ok: true })
}
