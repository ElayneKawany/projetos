import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarProjetos, criarProjeto } from '@/lib/projetos'
import { apiLogger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projetos = await buscarProjetos({
    status: searchParams.get('status') || undefined,
    diretoria_id: searchParams.get('diretoria_id') ? Number(searchParams.get('diretoria_id')) : undefined,
    prioridade: searchParams.get('prioridade') || undefined,
    busca: searchParams.get('busca') || undefined,
    usuario_id: session.id,
    perfil: session.perfil,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
  })

  return NextResponse.json({ projetos })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      nome, diretoria_id, area_id, ponto_focal, contato,
      objetivo, justificativa, descricao, beneficios,
      solicitante_id, gerente_id, classificacao, prioridade,
    } = body

    if (!nome || !diretoria_id || !area_id || !objetivo) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome, diretoria, área e objetivo.' }, { status: 400 })
    }

    const projeto = await criarProjeto({
      nome,
      solicitante_id: solicitante_id || session.id,
      diretoria_id: Number(diretoria_id),
      area_id: Number(area_id),
      ponto_focal,
      contato,
      objetivo,
      justificativa,
      descricao,
      beneficios,
      gerente_id: gerente_id ? Number(gerente_id) : undefined,
      classificacao,
      prioridade,
      created_by: session.id,
    })

    return NextResponse.json({ projeto }, { status: 201 })
  } catch (e) {
    apiLogger.error({ err: e }, 'Erro não tratado')
    return NextResponse.json({ error: 'Erro ao criar projeto.' }, { status: 500 })
  }
}
