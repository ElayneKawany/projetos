import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { asyncDb } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

// cronograma_tarefas já está em Postgres — tabela real, ver lib/repositories/cronograma.ts.
const T_CRONOGRAMA_TAREFAS = '"AI"."TI_PMO_CRONOGRAMA_TAREFAS"'

type Params = { params: Promise<{ id: string; cronogramaId: string; tarefaId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId, tarefaId } = await params
  const projetoId    = Number(id)
  const cronogramaId_ = Number(cronogramaId)
  const tarefaId_    = Number(tarefaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronogramaId_, projetoId)
  if (!cronograma)
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (cronograma.status !== 'RASCUNHO')
    return NextResponse.json({ error: 'Exclusão permitida apenas em cronogramas com status Rascunho.' }, { status: 400 })

  const tarefa = await asyncDb.queryOne<{ id: number; nivel: string; nome: string; parent_id: number | null }>(
    `SELECT id, nivel, nome, parent_id FROM ${T_CRONOGRAMA_TAREFAS} WHERE id = ? AND cronograma_id = ? AND (ativo IS NULL OR ativo = true)`,
    [tarefaId_, cronogramaId_]
  )
  if (!tarefa)
    return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 })

  // Conta filhos diretos (TAREFA → SUBTAREFA, FASE → TAREFA+SUBTAREFA)
  const filhosCount = (await asyncDb.queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${T_CRONOGRAMA_TAREFAS} WHERE parent_id = ? AND (ativo IS NULL OR ativo = true)`,
    [tarefaId_]
  ))?.n ?? 0

  const comFilhos = req.nextUrl.searchParams.get('comFilhos') === 'true'

  if (filhosCount > 0 && !comFilhos) {
    return NextResponse.json(
      { error: 'item_tem_filhos', filhos: filhosCount, nome: tarefa.nome, nivel: tarefa.nivel },
      { status: 409 }
    )
  }

  // cronograma_tarefas já está em Postgres — o soft-delete em cascata e o recálculo
  // de WBS cabem numa única transação Postgres. registrarEvento/registrarAuditoria
  // continuam em SQLite e rodam depois, fora dela (mesmo padrão do resto desta fatia).
  try {
    await asyncDb.transaction(async () => {
      // Soft-delete do item e seus filhos (e netos, se FASE)
      const idsParaDeletar: number[] = [tarefaId_]

      if (comFilhos && filhosCount > 0) {
        const filhos = await asyncDb.queryMany<{ id: number }>(
          `SELECT id FROM ${T_CRONOGRAMA_TAREFAS} WHERE parent_id = ? AND (ativo IS NULL OR ativo = true)`,
          [tarefaId_]
        )
        for (const f of filhos) {
          idsParaDeletar.push(f.id)
          // netos (subtarefas de tarefas dentro de uma fase)
          const netos = await asyncDb.queryMany<{ id: number }>(
            `SELECT id FROM ${T_CRONOGRAMA_TAREFAS} WHERE parent_id = ? AND (ativo IS NULL OR ativo = true)`,
            [f.id]
          )
          for (const n of netos) idsParaDeletar.push(n.id)
        }
      }

      for (const idd of idsParaDeletar) {
        await CronogramaRepository.softDeleteTarefa(idd, session.id)
      }

      // Recalcular WBS dos itens restantes
      const restantes = await asyncDb.queryMany<{ id: number; nivel: string; parent_id: number | null }>(
        `SELECT id, nivel, parent_id FROM ${T_CRONOGRAMA_TAREFAS}
         WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true)
         ORDER BY ordem`,
        [cronogramaId_]
      )

      let faseCount = 0; let tarefaCount = 0; let subCount = 0; let rootCount = 0
      for (const item of restantes) {
        let codigo: string
        if (item.nivel === 'FASE') {
          faseCount++; tarefaCount = 0; subCount = 0
          codigo = String(faseCount)
        } else if (item.nivel === 'SUBTAREFA') {
          subCount++
          if (faseCount > 0 && tarefaCount > 0) codigo = `${faseCount}.${tarefaCount}.${subCount}`
          else if (tarefaCount > 0) codigo = `${tarefaCount}.${subCount}`
          else codigo = `${rootCount}.${subCount}`
        } else {
          // TAREFA
          subCount = 0
          if (faseCount > 0) { tarefaCount++; codigo = `${faseCount}.${tarefaCount}` }
          else { rootCount++; codigo = String(rootCount) }
        }
        await asyncDb.execute(`UPDATE ${T_CRONOGRAMA_TAREFAS} SET codigo = ? WHERE id = ?`, [codigo, item.id])
      }
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao excluir item.' },
      { status: 500 }
    )
  }

  registrarEvento({
    projeto_id:      projetoId,
    modulo:          'CRONOGRAMA',
    artefato:        'CRONOGRAMA',
    evento:          'ALTERADO',
    titulo:          'Item excluído do cronograma',
    descricao:       `"${tarefa.nome}" (${tarefa.nivel}) excluído por ${session.nome}${comFilhos && filhosCount > 0 ? ` junto com ${filhosCount} filho(s)` : ''}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   cronogramaId_,
    referencia_tipo: 'cronograma',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'DELETE',
    entidade:     'cronograma_tarefas',
    entidade_id:  tarefaId_,
    projeto_id:   projetoId,
    descricao:    `Item "${tarefa.nome}" excluído do cronograma ${cronogramaId_}${comFilhos && filhosCount > 0 ? ` + ${filhosCount} filho(s)` : ''}`,
    dados_antes:  { id: tarefaId_, nome: tarefa.nome, nivel: tarefa.nivel },
  })

  return NextResponse.json({ ok: true })
}
