import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarWorkflow, processarResposta } from '@/lib/workflow'
import { CronogramaRepository, ProjetosRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarHistoricoAlteracao, atualizarStatusProjeto, statusJaAvancou } from '@/lib/projetos'
import { registrarEvento } from '@/lib/timeline'
import { validarCronogramaParaExecucao } from '@/lib/validacoes-cronograma'

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: projetoId, cronogramaId } = await params
  const ip = getIp(request)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(Number(cronogramaId), Number(projetoId)) as Record<string, unknown> | undefined

  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (cronograma.status !== 'PENDENTE_APROVACAO') {
    return NextResponse.json({ error: 'Apenas cronogramas pendentes podem ser processados.' }, { status: 400 })
  }

  const workflow = buscarWorkflow(Number(cronogramaId), 'CRONOGRAMA')
  if (!workflow) return NextResponse.json({ error: 'Nenhum workflow ativo encontrado.' }, { status: 400 })

  const etapaAtual = workflow.etapas.find(e => e.ordem === workflow.etapa_atual)
  if (!etapaAtual) return NextResponse.json({ error: 'Etapa atual não encontrada.' }, { status: 400 })
  if (etapaAtual.usuario_id !== session.id) {
    return NextResponse.json({ error: 'Você não é o responsável pela etapa atual.' }, { status: 403 })
  }

  const acao     = etapaAtual.tipo === 'CIENCIA' ? 'CIENTE' : 'APROVAR'
  const resultado = processarResposta({ workflow, acao })

  if (resultado === 'COMPLETED') {
    const versao = cronograma.versao as number

    // 1. Marcar cronograma como APROVADO (timestamp server-side via SQLite)
    CronogramaRepository.updateStatusAprovado(Number(cronogramaId), session.id)

    // 1b. Trava a Data Base de Entrega na 1ª aprovação (no-op se já existir — ver método)
    ProjetosRepository.capturarDataBaseEntrega(Number(projetoId), Number(cronogramaId))

    // 2. Timeline — Cronograma aprovado
    registrarEvento({
      projeto_id:      Number(projetoId),
      modulo:          'CRONOGRAMA',
      artefato:        'CRONOGRAMA',
      evento:          'APROVADO',
      titulo:          `Cronograma V${versao} aprovado`,
      descricao:       `Aprovado por ${session.nome}. Baseline criada.`,
      usuario_id:      session.id,
      usuario_nome:    session.nome,
      referencia_id:   Number(cronogramaId),
      referencia_tipo: 'cronograma',
    })

    // 3. Histórico de alterações do artefato
    registrarHistoricoAlteracao({
      projeto_id:    Number(projetoId),
      usuario_id:    session.id,
      usuario_nome:  session.nome,
      campo:         'cronograma_status',
      valor_anterior:'PENDENTE_APROVACAO',
      valor_novo:    'APROVADO',
      acao:          'APPROVE',
    })

    // 4. Auditoria com IP
    registrarAuditoria({
      usuario_id:   session.id,
      usuario_nome: session.nome,
      acao:         'APPROVE',
      entidade:     'cronogramas',
      entidade_id:  Number(cronogramaId),
      projeto_id:   Number(projetoId),
      descricao:    `Cronograma V${versao} aprovado por ${session.nome}. Baseline criada.`,
      dados_antes:  { status: 'PENDENTE_APROVACAO' },
      dados_depois: { cronograma_status: 'APROVADO', is_baseline: 1, versao },
      ip,
    })

    // 5. Avançar projeto para EXECUCAO se estiver em CRONOGRAMA ou ESTRUTURACAO
    const projeto = await ProjetosRepository.findById(Number(projetoId))

    if (projeto && !statusJaAvancou(projeto.status, 'EXECUCAO')) {
      const erroExecucao = validarCronogramaParaExecucao(Number(cronogramaId))
      if (erroExecucao) {
        return NextResponse.json({ error: erroExecucao }, { status: 422 })
      }

      await atualizarStatusProjeto(Number(projetoId), 'EXECUCAO', session.id,
        `Cronograma V${versao} aprovado — projeto avança automaticamente para Execução.`)

      registrarEvento({
        projeto_id:      Number(projetoId),
        modulo:          'CRONOGRAMA',
        artefato:        'PROJETO',
        evento:          'APROVADO',
        titulo:          'Projeto avançou para Execução em andamento',
        descricao:       `Status alterado automaticamente após aprovação do Cronograma V${versao}.`,
        usuario_id:      session.id,
        usuario_nome:    session.nome,
        referencia_id:   Number(projetoId),
        referencia_tipo: 'projeto',
      })

      // 6. Cronograma inicia execução junto com o projeto
      CronogramaRepository.updateStatus(Number(cronogramaId), 'EM_EXECUCAO')

      registrarEvento({
        projeto_id:      Number(projetoId),
        modulo:          'CRONOGRAMA',
        artefato:        'CRONOGRAMA',
        evento:          'ALTERADO',
        titulo:          `Cronograma V${versao} em execução`,
        descricao:       `Cronograma iniciado em conjunto com o avanço do projeto para Execução.`,
        usuario_id:      session.id,
        usuario_nome:    session.nome,
        referencia_id:   Number(cronogramaId),
        referencia_tipo: 'cronograma',
      })

      registrarAuditoria({
        usuario_id:   session.id,
        usuario_nome: session.nome,
        acao:         'UPDATE',
        entidade:     'cronogramas',
        entidade_id:  Number(cronogramaId),
        projeto_id:   Number(projetoId),
        descricao:    `Cronograma V${versao} iniciado em execução`,
        dados_antes:  { status: 'APROVADO' },
        dados_depois: { status: 'EM_EXECUCAO' },
        ip,
      })
    }

  } else {
    // Etapa intermediária aprovada
    registrarAuditoria({
      usuario_id:   session.id,
      usuario_nome: session.nome,
      acao:         acao === 'CIENTE' ? 'CIENCIA' : 'APPROVE_STEP',
      entidade:     'cronogramas',
      entidade_id:  Number(cronogramaId),
      projeto_id:   Number(projetoId),
      descricao:    `${session.nome} ${acao === 'CIENTE' ? 'confirmou ciência' : 'aprovou'} a etapa ${etapaAtual.ordem} do workflow do Cronograma.`,
      dados_depois: { etapa: etapaAtual.ordem, tipo: etapaAtual.tipo },
      ip,
    })
  }

  return NextResponse.json({ ok: true, resultado })
}
