import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarIndicadoresFinanceiros } from '@/lib/payback'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const indicadores = await buscarIndicadoresFinanceiros(projetoId)
  return NextResponse.json({ indicadores })
}
