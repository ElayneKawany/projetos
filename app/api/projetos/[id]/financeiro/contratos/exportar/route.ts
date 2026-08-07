import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { gerarExcelFinanceiro } from '@/lib/financeiro/exportador'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const projeto_id = Number(id)

  const buf = gerarExcelFinanceiro(projeto_id)
  const fileName = `Financeiro_Projeto_${projeto_id}.xlsx`

  return new NextResponse(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
