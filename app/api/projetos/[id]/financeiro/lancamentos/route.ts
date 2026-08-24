import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { enquadrarLancamento } from '@/lib/financeiro/enquadramento'
import type { TipoDocumentoFinanceiro } from '@/types'

/**
 * Lançamento de NF/pagamento SEM contrato pré-escolhido — roda o motor de
 * enquadramento (lib/financeiro/enquadramento.ts) para achar o contrato
 * compatível (ou marcar AGUARDANDO_ANALISE/SEM_CONTRATO).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)
  const body = await request.json()

  const fornecedor = typeof body.fornecedor === 'string' ? body.fornecedor.trim() : ''
  const valor_pago = Number(body.valor_pago) || 0

  if (!fornecedor) {
    return NextResponse.json({ error: 'Campo "fornecedor" é obrigatório.' }, { status: 400 })
  }
  if (valor_pago <= 0) {
    return NextResponse.json({ error: 'Valor pago deve ser maior que zero.' }, { status: 400 })
  }

  try {
    const resultado = enquadrarLancamento(
      {
        projeto_id,
        fornecedor,
        categoria: body.categoria ?? null,
        valor_pago,
        numero_documento: body.numero_documento ?? null,
        tipo_documento: (body.tipo_documento ?? 'NF') as TipoDocumentoFinanceiro,
        nota_fiscal: body.nota_fiscal ?? null,
        data_pagamento: body.data_pagamento ?? null,
        competencia: body.competencia ?? null,
        observacao: body.observacao ?? null,
      },
      session.id,
      session.nome,
    )
    return NextResponse.json(resultado, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao lançar NF.' }, { status: 400 })
  }
}
