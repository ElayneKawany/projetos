import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { type EtapaInput } from '@/lib/workflow'
import { CronogramaRepository } from '@/lib/repositories'
import { submeterArtefato } from '@/lib/artefatos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Apenas PMO ou Administrador pode enviar documentos para aprovação.' }, { status: 403 })
  }

  const { id: projetoId, cronogramaId } = await params
  const body = await request.json().catch(() => ({})) as {
    etapas?: EtapaInput[]
    modeloId?: number
    novoModelo?: { nome: string }
  }

  if (!body.etapas || !Array.isArray(body.etapas) || body.etapas.length === 0) {
    return NextResponse.json({ error: 'Configure pelo menos uma etapa no workflow.' }, { status: 400 })
  }
  if (!body.etapas.some(e => e.tipo === 'APROVACAO')) {
    return NextResponse.json({ error: 'O workflow deve conter pelo menos uma etapa do tipo Aprovação.' }, { status: 400 })
  }
  if (body.etapas.some(e => !e.usuario_id || !e.tipo)) {
    return NextResponse.json({ error: 'Todas as etapas devem ter usuário e tipo preenchidos.' }, { status: 400 })
  }

  const cronograma = CronogramaRepository.findByIdAndProjetoId(Number(cronogramaId), Number(projetoId)) as Record<string, unknown> | undefined

  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (cronograma.status !== 'RASCUNHO') {
    return NextResponse.json({ error: 'Apenas cronogramas em rascunho podem ser submetidos para aprovação.' }, { status: 400 })
  }

  submeterArtefato({
    projeto_id: Number(projetoId),
    tipo: 'CRONOGRAMA',
    referencia_id: Number(cronogramaId),
    tabela: 'cronogramas',
    campoHistorico: 'cronograma_status',
    session,
    etapas: body.etapas,
    modeloId: body.modeloId,
    novoModelo: body.novoModelo,
  })

  return NextResponse.json({ ok: true })
}
