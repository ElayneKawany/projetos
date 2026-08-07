import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarTimeline, type ModuloTimeline, type ArtefatoTimeline, type EventoTimeline, type OrigemTimeline } from '@/lib/timeline'

/** GET /api/projetos/[id]/timeline — retorna eventos da timeline do projeto */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)

  const modulo  = url.searchParams.get('modulo') as ModuloTimeline | null
  const artefato = url.searchParams.get('artefato') as ArtefatoTimeline | null
  const evento  = url.searchParams.get('evento') as EventoTimeline | null
  const origem  = url.searchParams.get('origem') as OrigemTimeline | null
  const limit   = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined

  const eventos = buscarTimeline(Number(id), {
    modulo: modulo ?? undefined,
    artefato: artefato ?? undefined,
    evento: evento ?? undefined,
    origem: origem ?? undefined,
    limit,
  })

  return NextResponse.json({ eventos })
}
