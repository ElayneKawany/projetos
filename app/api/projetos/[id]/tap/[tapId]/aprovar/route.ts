import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { TapRepository, ProjetosRepository, ViabilidadeRepository } from '@/lib/repositories'
import { buscarWorkflow, processarResposta } from '@/lib/workflow'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { buscarProjetoPorId, atualizarStatusProjeto, registrarHistoricoAlteracao, statusJaAvancou } from '@/lib/projetos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: projetoId, tapId } = await params

  const tap = await TapRepository.findByIdAndProjetoId(Number(tapId), Number(projetoId))
  if (!tap) return NextResponse.json({ error: 'TAP não encontrada.' }, { status: 404 })
  if (tap.status !== 'PENDENTE_APROVACAO') {
    return NextResponse.json({ error: 'Apenas TAPs pendentes de aprovação podem ser processadas.' }, { status: 400 })
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

  const acao = etapaAtual.tipo === 'CIENCIA' ? 'CIENTE' : 'APROVAR'
  const resultado = processarResposta({ workflow, acao })

  if (resultado === 'ADVANCED') {
    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: acao === 'CIENTE' ? 'CIENCIA' : 'APPROVE_STEP',
      entidade: 'tap_versoes',
      entidade_id: Number(tapId),
      projeto_id: Number(projetoId),
      descricao: `${session.nome} ${acao === 'CIENTE' ? 'confirmou ciência' : 'aprovou'} a etapa ${etapaAtual.ordem} do workflow da TAP.`,
      dados_depois: { etapa: etapaAtual.ordem, tipo: etapaAtual.tipo, proximo: workflow.etapa_atual + 1 },
    })
    return NextResponse.json({ ok: true, resultado })
  }

  if (resultado === 'COMPLETED') {
    await TapRepository.updateStatus(Number(tapId), 'APROVADO', session.id)

    ProjetosRepository.updateAprovacao({
      referencia_id: Number(tapId),
      tipo: 'TAP',
      novo_status: 'APROVADO',
      aprovador_id: session.id,
    })

    registrarHistoricoAlteracao({
      projeto_id: Number(projetoId),
      usuario_id: session.id,
      usuario_nome: session.nome,
      campo: 'tap_status',
      valor_anterior: 'PENDENTE_APROVACAO',
      valor_novo: 'APROVADO',
      acao: 'APPROVE',
    })

    const projeto = buscarProjetoPorId(Number(projetoId))
    if (projeto && !statusJaAvancou(projeto.status, 'VIABILIDADE')) {
      atualizarStatusProjeto(
        Number(projetoId),
        'VIABILIDADE',
        session.id,
        'TAP aprovada — início do Estudo de Viabilidade'
      )
      registrarHistoricoAlteracao({
        projeto_id: Number(projetoId),
        usuario_id: session.id,
        usuario_nome: session.nome,
        campo: 'status',
        valor_anterior: projeto.status,
        valor_novo: 'VIABILIDADE',
        acao: 'STATUS_CHANGE',
      })
    } else if (projeto) {
      const existeVib = ViabilidadeRepository.findV1ByProjetoId(Number(projetoId))
      if (!existeVib) {
        const vibId = ProjetosRepository.insertViabilidadeRascunho(Number(projetoId), session.id)
        ProjetosRepository.insertAprovacao({
          projeto_id: Number(projetoId),
          tipo: 'VIABILIDADE',
          referencia_id: vibId,
          referencia_tipo: 'viabilidade',
          status: 'PENDENTE',
          solicitante_id: session.id,
          observacao_req: 'Criado automaticamente após aprovação da TAP',
        })
      }
    }

    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'APPROVE',
      entidade: 'tap_versoes',
      entidade_id: Number(tapId),
      projeto_id: Number(projetoId),
      descricao: `TAP aprovada por ${session.nome}. Workflow concluído. Projeto avançado para Estudo de Viabilidade.`,
      dados_depois: { tap_status: 'APROVADO', projeto_status: 'VIABILIDADE' },
    })
  }

  return NextResponse.json({ ok: true, resultado })
}
