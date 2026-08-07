import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { atualizarPagamento, desativarPagamento } from '@/lib/financeiro/pagamentos'
import type { TipoDocumentoFinanceiro } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contId: string; pagId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, pagId } = await params
  const body = await request.json()

  atualizarPagamento(
    Number(pagId),
    {
      numero_documento: body.numero_documento,
      tipo_documento: body.tipo_documento as TipoDocumentoFinanceiro | undefined,
      nota_fiscal: body.nota_fiscal,
      data_pagamento: body.data_pagamento,
      competencia: body.competencia,
      valor_pago: body.valor_pago,
      observacao: body.observacao,
    },
    Number(id),
    session.id,
    session.nome,
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contId: string; pagId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, pagId } = await params
  desativarPagamento(Number(pagId), Number(id), session.id, session.nome)

  return NextResponse.json({ ok: true })
}
