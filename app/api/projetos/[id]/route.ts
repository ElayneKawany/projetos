import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarProjetoPorId, atualizarStatusProjeto, atualizarPrioridadeProjeto, buscarHistoricoStatus, buscarHistoricoPrioridade, registrarHistoricoAlteracao } from '@/lib/projetos'
import { TapRepository, ProjetosRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import type { StatusProjeto, Prioridade } from '@/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const projeto = await buscarProjetoPorId(Number(id))
  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const historicoStatus = await buscarHistoricoStatus(projeto.id)
  const historicoPrioridade = await buscarHistoricoPrioridade(projeto.id)
  const tapVersoes = await TapRepository.findAllByProjectId(projeto.id)

  return NextResponse.json({ projeto, historicoStatus, historicoPrioridade, tapVersoes })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const body = await request.json()

  const projeto = await buscarProjetoPorId(Number(id))
  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  try {
    if (body.status && body.status !== projeto.status) {
      await atualizarStatusProjeto(projeto.id, body.status as StatusProjeto, session.id, body.motivo)
    }

    if (body.prioridade && body.prioridade !== projeto.prioridade) {
      await atualizarPrioridadeProjeto(projeto.id, body.prioridade as Prioridade, session.id, body.motivo)
    }

    const camposEditaveis = [
      'nome','ponto_focal','contato','objetivo','justificativa','descricao','beneficios',
      'gerente_id','pmo_responsavel_id','capex_aprovado','opex_aprovado','data_inicio_prev','data_fim_prev',
      'classificacao','complexidade','prioridade',
    ]

    const dadosParaAtualizar: Record<string, unknown> = {}
    for (const campo of camposEditaveis) {
      if (body[campo] !== undefined) {
        dadosParaAtualizar[campo] = body[campo]
      }
    }

    if (Object.keys(dadosParaAtualizar).length) {
      ProjetosRepository.update(projeto.id, dadosParaAtualizar as Parameters<typeof ProjetosRepository.update>[1])

      for (const campo of camposEditaveis) {
        if (body[campo] !== undefined) {
          const valorAnterior = String(projeto[campo as keyof typeof projeto] ?? '')
          const valorNovo     = String(body[campo])
          if (valorAnterior !== valorNovo) {
            registrarHistoricoAlteracao({
              projeto_id: projeto.id,
              usuario_id: session.id,
              usuario_nome: session.nome,
              campo,
              valor_anterior: valorAnterior || null,
              valor_novo: valorNovo || null,
            })
          }
        }
      }

      registrarAuditoria({
        usuario_id: session.id,
        usuario_nome: session.nome,
        acao: 'UPDATE',
        entidade: 'projetos',
        entidade_id: projeto.id,
        projeto_id: projeto.id,
        descricao: `Projeto ${projeto.codigo} atualizado`,
        dados_antes: projeto,
        dados_depois: body,
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar projeto.' }, { status: 500 })
  }
}
