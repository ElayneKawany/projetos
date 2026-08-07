import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

interface TarefaInput {
  id?: number
  nome: string
  nivel: 'FASE' | 'TAREFA' | 'SUBTAREFA'
  ordem?: number
  tipo_macro?: string | null
  responsavel_id?: number | null
  responsavel_nome_ext?: string | null
  executor_id?: number | null
  executor_nome_ext?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  tipo?: string
  criticidade?: string
  observacoes?: string | null
  descricao?: string | null
  /** Múltiplos responsáveis — [{id?, nome}] */
  responsaveis?: { id?: number | null; nome: string }[]
}

function calcDuracao(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null
  try {
    const d = Math.ceil(
      (new Date(fim + 'T00:00:00').getTime() - new Date(inicio + 'T00:00:00').getTime()) / 86400000
    )
    return d >= 0 ? d : null
  } catch { return null }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)

  const cronograma = CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)

  if (!cronograma)
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  if (cronograma.status !== 'RASCUNHO')
    return NextResponse.json({ error: 'Só é possível editar cronogramas em Rascunho.' }, { status: 400 })

  const body = await request.json()
  const tarefas: TarefaInput[] = body.tarefas ?? []

  if (!tarefas.length)
    return NextResponse.json({ error: 'Informe ao menos uma tarefa.' }, { status: 400 })

  const invalida = tarefas.find(t => !t.nome?.trim())
  if (invalida)
    return NextResponse.json({ error: 'Todas as linhas precisam ter um nome.' }, { status: 400 })

  const existingIds = CronogramaRepository.findIdsAtivos(cronograma_id)
  const incomingIds = tarefas.filter(t => t.id).map(t => t.id as number)
  const toDelete    = existingIds.filter(eid => !incomingIds.includes(eid))

  const usuariosMap = CronogramaRepository.findUsuariosAtivos()
  function resolveUserId(nome: string): number | null {
    const q = nome.trim().toLowerCase()
    const exato = usuariosMap.find(u => u.nome.toLowerCase() === q)
    if (exato) return exato.id
    if (q.length >= 5) {
      const parcial = usuariosMap.find(u => u.nome.toLowerCase().includes(q) || q.includes(u.nome.toLowerCase()))
      if (parcial) return parcial.id
    }
    return null
  }

  let salvos = 0

  try {
    db.transaction(() => {
      // 1. Soft-delete dos itens removidos
      for (const del of toDelete) CronogramaRepository.softDeleteTarefa(del, session.id)

      // 2. Processar itens em ordem, calculando WBS e parent_id
      let faseCount   = 0
      let tarefaCount = 0
      let lastFaseId: number | null = null

      for (let i = 0; i < tarefas.length; i++) {
        const t    = tarefas[i]
        const nome = t.nome.trim()

        let codigo: string
        if (t.nivel === 'FASE') {
          faseCount++; tarefaCount = 0
          codigo = String(faseCount)
        } else {
          tarefaCount++
          codigo = faseCount > 0 ? `${faseCount}.${tarefaCount}` : String(tarefaCount)
        }

        const ordem      = i + 1
        const parent_id  = t.nivel === 'TAREFA' ? lastFaseId : null
        const exec_id    = t.executor_id ?? t.responsavel_id ?? null
        const durDias    = calcDuracao(t.data_inicio, t.data_fim)

        const tipoMacro = t.nivel === 'FASE' ? (t.tipo_macro ?? 'OUTRO') : null

        // Primary responsavel = first in array, or direct field
        const primaryResp = t.responsaveis?.[0]
        const primaryRespId = primaryResp?.id ?? t.responsavel_id ?? null
        const primaryRespNomeExt = primaryResp && !primaryResp.id ? primaryResp.nome : (t.responsavel_nome_ext ?? null)

        let itemId: number

        if (t.id) {
          CronogramaRepository.updateTarefaCompleta(t.id, cronograma_id, {
            nome, nivel: t.nivel, codigo, ordem, parent_id,
            responsavel_id: primaryRespId, responsavel_nome_ext: primaryRespNomeExt,
            executor_id: exec_id, executor_nome_ext: t.executor_nome_ext ?? null,
            data_inicio: t.data_inicio ?? null, data_fim: t.data_fim ?? null, duracao_dias: durDias,
            tipo: t.tipo ?? 'TAREFA', criticidade: t.criticidade ?? 'NORMAL',
            observacoes: t.observacoes ?? null, descricao: t.descricao ?? null,
            tipo_macro: tipoMacro, alterado_por: session.id,
          })
          if (t.nivel === 'FASE') lastFaseId = t.id
          itemId = t.id
        } else {
          itemId = Number(CronogramaRepository.insertTarefa({
            cronograma_id, codigo, nome,
            descricao:    t.descricao ?? null,
            nivel:        t.nivel,
            tipo:         t.tipo ?? 'TAREFA',
            criticidade:  t.criticidade ?? 'NORMAL',
            data_inicio:  t.data_inicio ?? null,
            data_fim:     t.data_fim ?? null,
            duracao_dias: durDias,
            responsavel_id:    primaryRespId,
            responsavel_nome_ext: primaryRespNomeExt,
            executor_id:   exec_id,
            executor_nome_ext: t.executor_nome_ext ?? null,
            area_id:      null,
            peso:         1,
            ordem,
            percentual:   0,
            status:       'PENDENTE',
            observacoes:  t.observacoes ?? null,
            tipo_macro:   tipoMacro,
            parent_id,
            ativo:        1,
            criado_por:   session.id,
            alterado_por: session.id,
          }))
          if (t.nivel === 'FASE') lastFaseId = itemId
        }

        // Sync cronograma_responsaveis (full replace)
        if (t.responsaveis !== undefined) {
          CronogramaRepository.deleteResponsaveis(itemId)
          for (const r of t.responsaveis) {
            const uid = r.id ?? resolveUserId(r.nome)
            CronogramaRepository.insertResponsavel(itemId, uid, uid ? null : r.nome.trim())
          }
        }

        salvos++
      }

      registrarEvento({
        projeto_id,
        modulo:          'CRONOGRAMA',
        artefato:        'CRONOGRAMA',
        evento:          'ALTERADO',
        titulo:          'Cronograma editado',
        descricao:       `${salvos} item(ns) salvos, ${toDelete.length} removido(s) por ${session.nome}`,
        usuario_id:      session.id,
        usuario_nome:    session.nome,
        referencia_id:   cronograma_id,
        referencia_tipo: 'cronograma',
      })

      registrarAuditoria({
        usuario_id:   session.id,
        usuario_nome: session.nome,
        acao:         'UPDATE',
        entidade:     'cronogramas',
        entidade_id:  cronograma_id,
        projeto_id,
        descricao:    `Cronograma editado inline: ${salvos} item(ns), ${toDelete.length} removido(s)`,
        dados_depois: { salvos, removidos: toDelete.length },
      })
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao salvar cronograma.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, salvos })
}
