import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarHistoricoEnquadramento } from '@/lib/financeiro/enquadramento'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pagId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { pagId } = await params
  const historico = buscarHistoricoEnquadramento(Number(pagId))
  return NextResponse.json({ historico })
}
