import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ViabilidadeRepository } from '@/lib/repositories'
import { type EtapaInput } from '@/lib/workflow'
import { submeterArtefato } from '@/lib/artefatos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Apenas PMO ou Administrador pode enviar documentos para aprovação.' }, { status: 403 })
  }

  const { id: projetoId, vid } = await params
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

  const viabilidade = ViabilidadeRepository.findByIdAndProjetoId(Number(vid), Number(projetoId))
  if (!viabilidade) return NextResponse.json({ error: 'Estudo de Viabilidade não encontrado.' }, { status: 404 })
  if (viabilidade.status !== 'RASCUNHO') {
    return NextResponse.json({ error: 'Apenas estudos em rascunho podem ser enviados para aprovação.' }, { status: 400 })
  }

  await submeterArtefato({
    projeto_id: Number(projetoId),
    tipo: 'VIABILIDADE',
    referencia_id: Number(vid),
    tabela: 'viabilidade',
    campoHistorico: 'viabilidade_status',
    session,
    etapas: body.etapas,
    modeloId: body.modeloId,
    novoModelo: body.novoModelo,
  })

  return NextResponse.json({ ok: true })
}
