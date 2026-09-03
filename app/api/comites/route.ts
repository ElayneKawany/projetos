import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const comites = await ComitesRepository.findAll({})
  return NextResponse.json({ comites })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  const body = await request.json()
  const id = ComitesRepository.create({ ...body, created_by: session.id })

  registrarAuditoria({
    usuario_id: session.id, usuario_nome: session.nome,
    acao: 'CREATE', entidade: 'comites', entidade_id: Number(id),
    descricao: `Comitê criado: "${body.titulo}"`,
  })
  return NextResponse.json({ id }, { status: 201 })
}
