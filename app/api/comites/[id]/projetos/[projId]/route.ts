import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'

type Params = { params: Promise<{ id: string; projId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'DIRETOR')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id, projId } = await params
  const comiteId = parseInt(id)
  const projetoId = parseInt(projId)

  const registro = ComitesRepository.findComiteProjeto(comiteId, projetoId)
  if (!registro) return NextResponse.json({ error: 'Projeto não encontrado neste comitê.' }, { status: 404 })

  const body = await request.json()
  const campos = ['decisao', 'observacoes', 'pauta_item', 'ordem_pauta', 'tempo_previsto']
  const fields: Record<string, unknown> = {}
  for (const c of campos) {
    if (body[c] !== undefined) fields[c] = body[c]
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 422 })

  ComitesRepository.updateComiteProjeto(comiteId, projetoId, fields)
  return NextResponse.json({ ok: true })
}
