import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'

type Params = { params: Promise<{ id: string; pedId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id, pedId } = await params
  const rec = ComitesRepository.findPendencia(parseInt(pedId), parseInt(id))
  if (!rec) return NextResponse.json({ error: 'Pendência não encontrada.' }, { status: 404 })

  const body = await request.json()
  const campos = ['descricao', 'responsavel_nome', 'prazo', 'status']
  const fields: Record<string, unknown> = {}
  for (const c of campos) {
    if (body[c] !== undefined) fields[c] = body[c]
  }
  if (body.status === 'RESOLVIDA') {
    fields.resolved_at = new Date().toISOString()
    fields.resolved_by = session.id
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 422 })

  ComitesRepository.updatePendencia(parseInt(pedId), fields)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id, pedId } = await params
  ComitesRepository.deletePendencia(parseInt(pedId), parseInt(id))
  return NextResponse.json({ ok: true })
}
