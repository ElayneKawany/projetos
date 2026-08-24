import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { corrigirEnquadramento } from '@/lib/financeiro/enquadramento'

/**
 * Enquadramento/correção manual (§8) — vincula (ou revincula) um pagamento a um
 * contrato escolhido pelo usuário. Nunca altera o valor do lançamento; o saldo
 * dos contratos envolvidos é sempre recalculado a partir dos pagamentos (nunca
 * armazenado), então trocar o vínculo já é suficiente.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { pagId } = await params
  const body = await request.json()
  const contrato_id = Number(body.contrato_id)

  if (!contrato_id) {
    return NextResponse.json({ error: 'Campo "contrato_id" é obrigatório.' }, { status: 400 })
  }

  try {
    corrigirEnquadramento(Number(pagId), contrato_id, session.id, session.nome)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao enquadrar pagamento.' }, { status: 400 })
  }
}
