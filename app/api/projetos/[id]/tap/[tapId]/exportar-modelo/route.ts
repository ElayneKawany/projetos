import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { TapRepository, ProjetosRepository } from '@/lib/repositories'
import { gerarXlsxTap } from '@/lib/importadores/tap-modelo'
import { apiLogger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, tapId } = await params
  const projeto_id = Number(id)
  const tap_id     = Number(tapId)

  try {
    const projeto = ProjetosRepository.findById(projeto_id)
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

    const tap = TapRepository.findByIdAndProjetoId(tap_id, projeto_id)
    if (!tap) return NextResponse.json({ error: 'TAP não encontrado.' }, { status: 404 })

    const buf = gerarXlsxTap()
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Modelo_TAP.xlsx"',
      },
    })
  } catch (err) {
    apiLogger.error({ err }, 'Erro ao gerar exportação TAP')
    return NextResponse.json({ error: 'Erro ao gerar o arquivo. Tente novamente.' }, { status: 500 })
  }
}
