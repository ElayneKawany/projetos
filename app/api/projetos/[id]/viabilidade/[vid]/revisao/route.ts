import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ViabilidadeRepository, ProjetosRepository } from '@/lib/repositories'
import { buscarWorkflow, processarResposta } from '@/lib/workflow'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarHistoricoAlteracao } from '@/lib/projetos'
import { notificarPMOs } from '@/lib/notificacoes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: projetoId, vid } = await params
  const body = await request.json().catch(() => ({})) as { observacao?: string }

  if (!body.observacao?.trim()) {
    return NextResponse.json({ error: 'Observação obrigatória para solicitar revisão.' }, { status: 400 })
  }

  const viabilidade = await ViabilidadeRepository.findByIdAndProjetoId(Number(vid), Number(projetoId))
  if (!viabilidade) return NextResponse.json({ error: 'Estudo de Viabilidade não encontrado.' }, { status: 404 })
  if (viabilidade.status !== 'PENDENTE_APROVACAO') {
    return NextResponse.json({ error: 'Apenas estudos pendentes podem ser enviados para revisão.' }, { status: 400 })
  }

  const workflow = buscarWorkflow(Number(vid), 'VIABILIDADE')
  if (!workflow) {
    return NextResponse.json({ error: 'Nenhum workflow ativo encontrado para este Estudo de Viabilidade.' }, { status: 400 })
  }

  const etapaAtual = workflow.etapas.find(e => e.ordem === workflow.etapa_atual)
  if (!etapaAtual) {
    return NextResponse.json({ error: 'Etapa atual do workflow não encontrada.' }, { status: 400 })
  }
  if (etapaAtual.usuario_id !== session.id) {
    return NextResponse.json({ error: 'Você não é o responsável pela etapa atual do workflow.' }, { status: 403 })
  }
  if (etapaAtual.tipo !== 'APROVACAO') {
    return NextResponse.json({ error: 'Apenas etapas do tipo Aprovação podem solicitar revisão.' }, { status: 400 })
  }

  processarResposta({ workflow, acao: 'REJEITAR', observacao: body.observacao })

  await ViabilidadeRepository.updateStatus(Number(vid), 'RASCUNHO')

  ProjetosRepository.updateAprovacao({
    referencia_id: Number(vid),
    tipo: 'VIABILIDADE',
    novo_status: 'REJEITADO',
    aprovador_id: session.id,
    observacao: body.observacao,
  })

  registrarHistoricoAlteracao({
    projeto_id: Number(projetoId),
    usuario_id: session.id,
    usuario_nome: session.nome,
    campo: 'viabilidade_status',
    valor_anterior: 'PENDENTE_APROVACAO',
    valor_novo: 'RASCUNHO',
    acao: 'REJECT',
  })

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'REJECT',
    entidade: 'viabilidade',
    entidade_id: Number(vid),
    projeto_id: Number(projetoId),
    descricao: `Estudo de Viabilidade enviado para revisão por ${session.nome}: ${body.observacao}`,
    dados_depois: { viabilidade_status: 'RASCUNHO', observacao: body.observacao },
  })

  const projeto = await ProjetosRepository.findById(Number(projetoId))
  await notificarPMOs({
    originador_id: session.id,
    projeto_id: Number(projetoId),
    tipo: 'REVISAO_VIABILIDADE',
    titulo: `Revisão solicitada – Viabilidade – ${projeto?.nome ?? ''}`,
    mensagem: `${session.nome} solicitou revisão no Estudo de Viabilidade do projeto "${projeto?.nome ?? projetoId}". Mensagem: ${body.observacao}`,
  })

  return NextResponse.json({ ok: true })
}
