import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/database'
import { TapRepository, ProjetosRepository, ViabilidadeRepository } from '@/lib/repositories'
import { buscarWorkflow, processarResposta } from '@/lib/workflow'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarHistoricoAlteracao } from '@/lib/projetos'
import { notificarPMOs } from '@/lib/notificacoes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: projetoId, tapId } = await params
  const body = await request.json().catch(() => ({})) as { observacao?: string }

  if (!body.observacao?.trim()) {
    return NextResponse.json({ error: 'Observação obrigatória para solicitar revisão.' }, { status: 400 })
  }

  const tap = await TapRepository.findByIdAndProjetoId(Number(tapId), Number(projetoId))
  if (!tap) return NextResponse.json({ error: 'TAP não encontrada.' }, { status: 404 })
  if (tap.status !== 'PENDENTE_APROVACAO') {
    return NextResponse.json({ error: 'Apenas TAPs pendentes podem ser enviadas para revisão.' }, { status: 400 })
  }

  const workflow = buscarWorkflow(Number(tapId), 'TAP')
  if (!workflow) {
    return NextResponse.json({ error: 'Nenhum workflow ativo encontrado para esta TAP.' }, { status: 400 })
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

  let viabilidadesAtivas: { id: number }[] = []

  // TapRepository já está em Postgres (asyncDb); os demais repositórios usados aqui
  // ainda estão em SQLite (db, síncrono). Enquanto a migração for gradual, os dois
  // bancos não podem participar da mesma transação — o updateStatus do TAP roda à
  // parte, depois que a transação SQLite abaixo já confirmou, para que uma falha no
  // Postgres não deixe a aprovação SQLite com efeitos colaterais não registrados.
  db.transaction(() => {
    processarResposta({ workflow, acao: 'REJEITAR', observacao: body.observacao })

    ProjetosRepository.updateAprovacao({
      referencia_id: Number(tapId),
      tipo: 'TAP',
      novo_status: 'REJEITADO',
      aprovador_id: session.id,
      observacao: body.observacao,
    })

    viabilidadesAtivas = ViabilidadeRepository.findNaoFinalizadas(Number(projetoId))

    for (const v of viabilidadesAtivas) {
      ViabilidadeRepository.updateStatus(v.id, 'CANCELADO')

      ProjetosRepository.updateAprovacao({
        referencia_id: v.id,
        tipo: 'VIABILIDADE',
        novo_status: 'CANCELADO',
        observacao: 'TAP retornou para revisão',
      })

      registrarHistoricoAlteracao({
        projeto_id: Number(projetoId),
        usuario_id: session.id,
        usuario_nome: session.nome,
        campo: 'viabilidade_status',
        valor_anterior: 'RASCUNHO',
        valor_novo: 'CANCELADO',
        acao: 'CANCEL',
      })
    }

    registrarHistoricoAlteracao({
      projeto_id: Number(projetoId),
      usuario_id: session.id,
      usuario_nome: session.nome,
      campo: 'tap_status',
      valor_anterior: 'PENDENTE_APROVACAO',
      valor_novo: 'RASCUNHO',
      acao: 'REJECT',
    })

    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'REJECT',
      entidade: 'tap_versoes',
      entidade_id: Number(tapId),
      projeto_id: Number(projetoId),
      descricao: `TAP enviada para revisão por ${session.nome}: ${body.observacao}${viabilidadesAtivas.length > 0 ? `. ${viabilidadesAtivas.length} Estudo(s) de Viabilidade cancelado(s).` : ''}`,
      dados_depois: { tap_status: 'RASCUNHO', observacao: body.observacao, viabilidades_canceladas: viabilidadesAtivas.length },
    })
  })

  await TapRepository.updateStatus(Number(tapId), 'RASCUNHO')

  const projeto = ProjetosRepository.findById(Number(projetoId))
  notificarPMOs({
    originador_id: session.id,
    projeto_id: Number(projetoId),
    tipo: 'REVISAO_TAP',
    titulo: `Revisão solicitada – TAP – ${projeto?.nome ?? ''}`,
    mensagem: `${session.nome} solicitou revisão na TAP do projeto "${projeto?.nome ?? projetoId}". Mensagem: ${body.observacao}`,
  })

  return NextResponse.json({ ok: true })
}
