import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { atualizarContrato, desativarContrato } from '@/lib/financeiro/contratos'
import type { TipoContrato, StatusContrato, NaturezaFinanceira } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, contId } = await params
  const projeto_id = Number(id)
  const body = await request.json()

  atualizarContrato(
    Number(contId),
    {
      numero_contrato: body.numero_contrato,
      contratado: body.contratado,
      tipo_contrato: body.tipo_contrato as TipoContrato | undefined,
      natureza_financeira: body.natureza_financeira as NaturezaFinanceira | undefined,
      descricao_servico: body.descricao_servico,
      valor_aprovado: body.valor_aprovado,
      status: body.status as StatusContrato | undefined,
      observacao: body.observacao,
    },
    projeto_id,
    session.id,
    session.nome,
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, contId } = await params
  desativarContrato(Number(contId), Number(id), session.id, session.nome)

  return NextResponse.json({ ok: true })
}
