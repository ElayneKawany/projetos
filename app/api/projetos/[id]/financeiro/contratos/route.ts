import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { buscarContratosCompletos, buscarResumoFinanceiro, buscarViabilidadeFinanceira } from '@/lib/financeiro/dashboard'
import { criarContrato } from '@/lib/financeiro/contratos'
import type { TipoContrato, NaturezaFinanceira } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const projeto_id = Number(id)

  const [contratos, resumo, viabilidade] = [
    buscarContratosCompletos(projeto_id),
    buscarResumoFinanceiro(projeto_id),
    buscarViabilidadeFinanceira(projeto_id),
  ]

  return NextResponse.json({ contratos, resumo, viabilidade })
}

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

  const { numero_contrato, contratado, tipo_contrato, natureza_financeira, descricao_servico, valor_aprovado, observacao } = body

  if (!contratado?.trim()) {
    return NextResponse.json({ error: 'Campo "contratado" é obrigatório.' }, { status: 400 })
  }
  if (typeof valor_aprovado !== 'number' || valor_aprovado < 0) {
    return NextResponse.json({ error: 'Campo "valor_aprovado" deve ser um número >= 0.' }, { status: 400 })
  }
  if (natureza_financeira !== 'CAPEX' && natureza_financeira !== 'OPEX') {
    return NextResponse.json({ error: 'Campo "natureza_financeira" é obrigatório (CAPEX ou OPEX).' }, { status: 400 })
  }

  const contratoId = criarContrato(
    { projeto_id, numero_contrato, contratado, tipo_contrato: tipo_contrato as TipoContrato, natureza_financeira: natureza_financeira as NaturezaFinanceira, descricao_servico, valor_aprovado, observacao },
    session.id,
    session.nome,
  )

  return NextResponse.json({ ok: true, id: contratoId }, { status: 201 })
}
