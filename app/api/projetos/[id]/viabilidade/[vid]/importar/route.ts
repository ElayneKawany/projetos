import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ViabilidadeRepository } from '@/lib/repositories'
import { parsearXlsxViabilidade } from '@/lib/importadores/viabilidade-modelo'
import { apiLogger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, vid } = await params
  const projeto_id = Number(id)
  const vid_id     = Number(vid)

  const viabilidade = await ViabilidadeRepository.findByIdAndProjetoId(vid_id, projeto_id)
  if (!viabilidade) return NextResponse.json({ error: 'Estudo de Viabilidade não encontrado.' }, { status: 404 })
  if (viabilidade.status !== 'RASCUNHO') {
    return NextResponse.json({ error: 'Somente estudos em rascunho podem ser importados.' }, { status: 400 })
  }

  const formData = await request.formData()
  const arquivo  = formData.get('arquivo') as File | null
  if (!arquivo) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  const nome = arquivo.name.toLowerCase()
  if (!nome.endsWith('.xlsx') && !nome.endsWith('.xls')) {
    return NextResponse.json({ error: 'Formato não suportado. Envie um arquivo .xlsx.' }, { status: 400 })
  }

  try {
    const buffer    = Buffer.from(await arquivo.arrayBuffer())
    const resultado = parsearXlsxViabilidade(buffer)

    return NextResponse.json({
      ok: true,
      dados:           resultado.dados,
      camposFaltantes: resultado.camposFaltantes,
      avisos:          resultado.avisos,
    })
  } catch (err) {
    apiLogger.error({ err }, 'Erro ao parsear arquivo de Viabilidade')
    return NextResponse.json({ error: 'Não foi possível ler o arquivo. Verifique se o formato é válido.' }, { status: 422 })
  }
}
