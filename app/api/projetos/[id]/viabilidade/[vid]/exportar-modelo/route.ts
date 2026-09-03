import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ViabilidadeRepository, ProjetosRepository } from '@/lib/repositories'
import { apiLogger } from '@/lib/logger'
import {
  gerarXlsxViabilidade,
  gerarXlsxViabilidadeQualitativo,
} from '@/lib/importadores/viabilidade-modelo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, vid } = await params
  const projeto_id = Number(id)
  const vid_id     = Number(vid)

  try {
    const projeto = await ProjetosRepository.findById(projeto_id)
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

    const v = await ViabilidadeRepository.findByIdAndProjetoId(vid_id, projeto_id)
    if (!v) return NextResponse.json({ error: 'Estudo de Viabilidade não encontrado.' }, { status: 404 })

    const isQualitativo = String(projeto.tipo_beneficio ?? '').toUpperCase() === 'QUALITATIVO'
    const nomeArq = `Modelo_Viabilidade${isQualitativo ? '_Qualitativo' : ''}`.replace(/\s+/g, '_')

    const buf = isQualitativo
      ? gerarXlsxViabilidadeQualitativo()
      : gerarXlsxViabilidade()

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nomeArq}.xlsx"`,
      },
    })
  } catch (err) {
    apiLogger.error({ err }, 'Erro ao gerar exportação Viabilidade')
    return NextResponse.json({ error: 'Erro ao gerar o arquivo. Tente novamente.' }, { status: 500 })
  }
}
