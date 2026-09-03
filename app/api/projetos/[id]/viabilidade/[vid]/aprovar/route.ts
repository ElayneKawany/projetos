import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ViabilidadeRepository, ProjetosRepository } from '@/lib/repositories'
import { buscarWorkflow, processarResposta } from '@/lib/workflow'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { buscarProjetoPorId, atualizarStatusProjeto, registrarHistoricoAlteracao, statusJaAvancou } from '@/lib/projetos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: projetoId, vid } = await params

  const viabilidade = await ViabilidadeRepository.findByIdAndProjetoId(Number(vid), Number(projetoId))
  if (!viabilidade) return NextResponse.json({ error: 'Estudo de Viabilidade não encontrado.' }, { status: 404 })
  if (viabilidade.status !== 'PENDENTE_APROVACAO') {
    return NextResponse.json({ error: 'Apenas estudos pendentes de aprovação podem ser processados.' }, { status: 400 })
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

  const acao = etapaAtual.tipo === 'CIENCIA' ? 'CIENTE' : 'APROVAR'
  const resultado = processarResposta({ workflow, acao })

  if (resultado === 'ADVANCED') {
    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: acao === 'CIENTE' ? 'CIENCIA' : 'APPROVE_STEP',
      entidade: 'viabilidade',
      entidade_id: Number(vid),
      projeto_id: Number(projetoId),
      descricao: `${session.nome} ${acao === 'CIENTE' ? 'confirmou ciência' : 'aprovou'} a etapa ${etapaAtual.ordem} do workflow do Estudo de Viabilidade.`,
      dados_depois: { etapa: etapaAtual.ordem, tipo: etapaAtual.tipo },
    })
    return NextResponse.json({ ok: true, resultado })
  }

  if (resultado === 'COMPLETED') {
    await ViabilidadeRepository.updateStatus(Number(vid), 'APROVADO', session.id)

    ProjetosRepository.updateAprovacao({
      referencia_id: Number(vid),
      tipo: 'VIABILIDADE',
      novo_status: 'APROVADO',
      aprovador_id: session.id,
    })

    registrarHistoricoAlteracao({
      projeto_id: Number(projetoId),
      usuario_id: session.id,
      usuario_nome: session.nome,
      campo: 'viabilidade_status',
      valor_anterior: 'PENDENTE_APROVACAO',
      valor_novo: 'APROVADO',
      acao: 'APPROVE',
    })

    const projeto = buscarProjetoPorId(Number(projetoId))
    if (projeto && !statusJaAvancou(projeto.status, 'ESTRUTURACAO')) {
      await atualizarStatusProjeto(
        Number(projetoId),
        'ESTRUTURACAO',
        session.id,
        'Estudo de Viabilidade aprovado — início da Estruturação'
      )
      registrarHistoricoAlteracao({
        projeto_id: Number(projetoId),
        usuario_id: session.id,
        usuario_nome: session.nome,
        campo: 'status',
        valor_anterior: projeto.status,
        valor_novo: 'ESTRUTURACAO',
        acao: 'STATUS_CHANGE',
      })
    }

    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'APPROVE',
      entidade: 'viabilidade',
      entidade_id: Number(vid),
      projeto_id: Number(projetoId),
      descricao: `Estudo de Viabilidade aprovado por ${session.nome}. Workflow concluído. Projeto avançado para Estruturação.`,
      dados_depois: { viabilidade_status: 'APROVADO', projeto_status: 'ESTRUTURACAO' },
    })
  }

  return NextResponse.json({ ok: true, resultado })
}
