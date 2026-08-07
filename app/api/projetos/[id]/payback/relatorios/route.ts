import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listarRelatoriosDisponiveis, gerarResumoExecutivo } from '@/lib/payback'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')

  if (tipo === 'RESUMO_EXECUTIVO') {
    const dados = gerarResumoExecutivo(projetoId)
    return NextResponse.json(dados)
  }

  const relatorios = listarRelatoriosDisponiveis(projetoId)
  return NextResponse.json({ relatorios })
}
