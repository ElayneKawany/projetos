import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarProjetoPorId, atualizarStatusProjeto, atualizarPrioridadeProjeto, buscarHistoricoStatus, buscarHistoricoPrioridade } from '@/lib/projetos'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'
import type { StatusProjeto, Prioridade } from '@/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const projeto = buscarProjetoPorId(Number(id))
  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const historicoStatus = buscarHistoricoStatus(projeto.id)
  const historicoPrioridade = buscarHistoricoPrioridade(projeto.id)

  // TAP versões
  const db = getDb()
  const tapVersoes = db.prepare(
    'SELECT * FROM tap_versoes WHERE projeto_id = ? ORDER BY versao DESC'
  ).all(projeto.id)

  return NextResponse.json({ projeto, historicoStatus, historicoPrioridade, tapVersoes })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const body = await request.json()

  const projeto = buscarProjetoPorId(Number(id))
  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  try {
    // Mudança de status
    if (body.status && body.status !== projeto.status) {
      atualizarStatusProjeto(projeto.id, body.status as StatusProjeto, session.id, body.motivo)
    }

    // Mudança de prioridade
    if (body.prioridade && body.prioridade !== projeto.prioridade) {
      atualizarPrioridadeProjeto(projeto.id, body.prioridade as Prioridade, session.id, body.motivo)
    }

    // Outros campos editáveis
    const camposEditaveis = [
      'nome','ponto_focal','contato','objetivo','descricao','beneficios',
      'gerente_id','capex_aprovado','opex_aprovado','data_inicio_prev','data_fim_prev',
      'classificacao','complexidade',
    ]
    const updates: string[] = []
    const updateParams: Record<string, unknown> = {}

    for (const campo of camposEditaveis) {
      if (body[campo] !== undefined) {
        updates.push(`${campo} = @${campo}`)
        updateParams[campo] = body[campo]
      }
    }

    if (updates.length) {
      updates.push('updated_at = CURRENT_TIMESTAMP')
      updateParams.id = projeto.id
      const db = getDb()
      db.prepare(`UPDATE projetos SET ${updates.join(', ')} WHERE id = @id`).run(updateParams)

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
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao atualizar projeto.' }, { status: 500 })
  }
}
