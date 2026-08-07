import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { db } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão. Apenas PMO ou Admin.' }, { status: 403 })
  }

  const { id, cronogramaId } = await params
  const projeto_id = Number(id)
  const cron_id    = Number(cronogramaId)

  const cronograma = CronogramaRepository.findByIdAndProjetoId(cron_id, projeto_id) as Record<string, unknown> | undefined

  if (!cronograma) {
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  }
  if (cronograma.status !== 'APROVADO') {
    return NextResponse.json(
      { error: 'Apenas cronogramas com status APROVADO podem gerar uma nova versão.' },
      { status: 400 }
    )
  }

  const novaVersao = (cronograma.versao as number) + 1

  const novoCronId = Number(db.transaction(() => {
    const novoId = CronogramaRepository.insertCronograma({
      projeto_id,
      versao: novaVersao,
      label: `Versão ${novaVersao}`,
      modo: String(cronograma.modo ?? 'CENTRALIZADO'),
      fonte_importacao: String(cronograma.fonte_importacao ?? 'MANUAL'),
      criado_por: session.id,
    })

    const tarefas = CronogramaRepository.findTarefasOrdered(cron_id)

    for (const t of tarefas) {
      CronogramaRepository.insertTarefa({
        cronograma_id: Number(novoId),
        codigo:            String(t.codigo ?? ''),
        nome:              String(t.nome),
        descricao:         t.descricao != null ? String(t.descricao) : null,
        nivel:             String(t.nivel),
        tipo:              t.tipo != null ? String(t.tipo) : undefined,
        criticidade:       t.criticidade != null ? String(t.criticidade) : undefined,
        data_inicio:       t.data_inicio != null ? String(t.data_inicio) : null,
        data_fim:          t.data_fim != null ? String(t.data_fim) : null,
        duracao_dias:      t.duracao_dias != null ? Number(t.duracao_dias) : null,
        responsavel_id:    t.responsavel_id != null ? Number(t.responsavel_id) : null,
        responsavel_nome_ext: t.responsavel_nome_ext != null ? String(t.responsavel_nome_ext) : null,
        executor_id:       t.executor_id != null ? Number(t.executor_id) : null,
        executor_nome_ext: t.executor_nome_ext != null ? String(t.executor_nome_ext) : null,
        area_id:           t.area_id != null ? Number(t.area_id) : null,
        peso:              t.peso != null ? Number(t.peso) : 1,
        ordem:             Number(t.ordem),
        percentual:        t.percentual != null ? Number(t.percentual) : 0,
        status:            t.status != null ? String(t.status) : 'PENDENTE',
        observacoes:       t.observacoes != null ? String(t.observacoes) : null,
        tipo_macro:        t.tipo_macro != null ? String(t.tipo_macro) : null,
        ativo:             1,
        criado_por:        session.id,
        alterado_por:      session.id,
      })
    }

    return novoId
  }))

  registrarEvento({
    projeto_id,
    modulo: 'CRONOGRAMA',
    artefato: 'CRONOGRAMA',
    evento: 'CRIADO',
    titulo: `Nova versão do Cronograma criada (V${novaVersao})`,
    descricao: `Baseada na versão aprovada V${cronograma.versao}`,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: novoCronId,
    referencia_tipo: 'cronograma',
  })

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'cronogramas',
    entidade_id: novoCronId,
    projeto_id,
    descricao: `Nova versão V${novaVersao} criada a partir da versão aprovada V${cronograma.versao}`,
    dados_depois: { versao: novaVersao, status: 'RASCUNHO', baseada_em: cron_id },
  })

  return NextResponse.json({ ok: true, id: novoCronId, versao: novaVersao }, { status: 201 })
}
