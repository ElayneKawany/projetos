import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { TapRepository } from '@/lib/repositories'
import { parsearXlsxTap } from '@/lib/importadores/tap-modelo'
import { apiLogger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, tapId } = await params
  const projeto_id = Number(id)
  const tap_id     = Number(tapId)

  const tap = TapRepository.findByIdAndProjetoId(tap_id, projeto_id)
  if (!tap) return NextResponse.json({ error: 'TAP não encontrado.' }, { status: 404 })
  if (tap.status !== 'RASCUNHO') {
    return NextResponse.json({ error: 'Somente TAPs em rascunho podem ser importados.' }, { status: 400 })
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
    const resultado = parsearXlsxTap(buffer)

    return NextResponse.json({
      ok: true,
      dados:           resultado.dados,
      camposFaltantes: resultado.camposFaltantes,
      avisos:          resultado.avisos,
    })
  } catch (err) {
    apiLogger.error({ err }, 'Erro ao parsear arquivo TAP')
    return NextResponse.json({ error: 'Não foi possível ler o arquivo. Verifique se o formato é válido.' }, { status: 422 })
  }
}
