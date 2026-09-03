import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/database'
import { buscarWorkflow, processarResposta } from '@/lib/workflow'
import { CronogramaRepository, ProjetosRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarHistoricoAlteracao } from '@/lib/projetos'
import { notificarPMOs } from '@/lib/notificacoes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: projetoId, cronogramaId } = await params
  const { observacao } = await request.json().catch(() => ({})) as { observacao?: string }

  if (!observacao?.trim()) {
    return NextResponse.json({ error: 'Observação é obrigatória para solicitar revisão.' }, { status: 400 })
  }

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(Number(cronogramaId), Number(projetoId)) as Record<string, unknown> | undefined

  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (cronograma.status !== 'PENDENTE_APROVACAO') {
    return NextResponse.json({ error: 'Apenas cronogramas pendentes podem ser enviados para revisão.' }, { status: 400 })
  }

  const workflow = buscarWorkflow(Number(cronogramaId), 'CRONOGRAMA')
  if (!workflow) return NextResponse.json({ error: 'Nenhum workflow ativo encontrado.' }, { status: 400 })

  const etapaAtual = workflow.etapas.find(e => e.ordem === workflow.etapa_atual)
  if (!etapaAtual) return NextResponse.json({ error: 'Etapa atual não encontrada.' }, { status: 400 })
  if (etapaAtual.usuario_id !== session.id) {
    return NextResponse.json({ error: 'Você não é o responsável pela etapa atual.' }, { status: 403 })
  }
  if (etapaAtual.tipo !== 'APROVACAO') {
    return NextResponse.json({ error: 'Apenas etapas de aprovação podem solicitar revisão.' }, { status: 400 })
  }

  db.transaction(() => {
    processarResposta({ workflow, acao: 'REJEITAR', observacao })

    CronogramaRepository.updateStatus(Number(cronogramaId), 'RASCUNHO')

    ProjetosRepository.updateAprovacao({
      referencia_id: Number(cronogramaId),
      tipo: 'CRONOGRAMA',
      novo_status: 'REJEITADO',
      aprovador_id: session.id,
      observacao,
    })

    registrarHistoricoAlteracao({
      projeto_id: Number(projetoId),
      usuario_id: session.id,
      usuario_nome: session.nome,
      campo: 'cronograma_status',
      valor_anterior: 'PENDENTE_APROVACAO',
      valor_novo: 'RASCUNHO',
      acao: 'REJECT',
    })

    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'REJECT',
      entidade: 'cronogramas',
      entidade_id: Number(cronogramaId),
      projeto_id: Number(projetoId),
      descricao: `Revisão solicitada por ${session.nome}: ${observacao}`,
      dados_depois: { cronograma_status: 'RASCUNHO', observacao },
    })
  })

  // Notificar PMOs
  const projeto = await ProjetosRepository.findById(Number(projetoId))
  await notificarPMOs({
    originador_id: session.id,
    projeto_id: Number(projetoId),
    tipo: 'REVISAO_CRONOGRAMA',
    titulo: `Revisão solicitada – Cronograma – ${projeto?.nome ?? ''}`,
    mensagem: `${session.nome} solicitou revisão no Cronograma do projeto "${projeto?.nome ?? projetoId}". Mensagem: ${observacao}`,
  })

  return NextResponse.json({ ok: true })
}
