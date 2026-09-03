import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id) as Record<string, unknown> | undefined

  if (!cronograma) {
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  }
  if (cronograma.status !== 'APROVADO') {
    return NextResponse.json(
      { error: 'Novas atividades só podem ser adicionadas a cronogramas aprovados.' },
      { status: 400 }
    )
  }

  const body = await request.json() as {
    macro_id?: number | null
    parent_id?: number | null
    nivel?: string
    nome: string
    descricao?: string
    tipo?: string
    criticidade?: string
    responsavel_id?: number | null
    executor_id?: number | null
    area_id?: number | null
    data_inicio?: string
    data_fim?: string
    duracao_dias?: number | null
    observacoes?: string
    peso?: number
    percentual?: number
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome da atividade é obrigatório.' }, { status: 400 })
  }
  if (!body.responsavel_id) {
    return NextResponse.json({ error: 'Responsável é obrigatório.' }, { status: 400 })
  }

  const executorId = body.executor_id ?? body.responsavel_id
  const ordemMax = CronogramaRepository.maxOrdem(cronograma_id)
  const nivel = body.nivel === 'SUBTAREFA' ? 'SUBTAREFA' : 'TAREFA'
  const parentId = nivel === 'SUBTAREFA' ? (body.parent_id ?? null) : (body.macro_id ?? null)

  const novaId = Number(CronogramaRepository.insertTarefa({
    cronograma_id,
    parent_id:    parentId,
    nivel,
    tipo:         body.tipo        ?? 'TAREFA',
    criticidade:  body.criticidade ?? 'NORMAL',
    nome:         body.nome.trim(),
    descricao:    body.descricao   ?? null,
    data_inicio:  body.data_inicio ?? null,
    data_fim:     body.data_fim    ?? null,
    duracao_dias: body.duracao_dias ?? null,
    responsavel_id: body.responsavel_id ?? null,
    executor_id:  executorId ?? null,
    area_id:      body.area_id    ?? null,
    observacoes:  body.observacoes ?? null,
    peso:         body.peso ?? 1,
    percentual:   body.percentual ?? 0,
    status:       'NAO_INICIADA',
    ordem:        ordemMax + 1,
    criado_por:   session.id,
    alterado_por: session.id,
  }))

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'CRONOGRAMA',
    evento:          'ALTERADO',
    titulo:          `Nova atividade adicionada: ${body.nome.trim()}`,
    descricao:       `Adicionada ao cronograma aprovado por ${session.nome}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   novaId,
    referencia_tipo: 'cronograma_tarefa',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'CREATE',
    entidade:     'cronograma_tarefas',
    entidade_id:  novaId,
    projeto_id,
    descricao:    `Nova atividade "${body.nome.trim()}" adicionada ao cronograma aprovado`,
    dados_depois: { nome: body.nome, tipo: body.tipo, criticidade: body.criticidade, cronograma_id },
  })

  return NextResponse.json({ ok: true, id: novaId }, { status: 201 })
}
