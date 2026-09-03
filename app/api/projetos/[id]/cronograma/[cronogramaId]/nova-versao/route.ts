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

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cron_id, projeto_id) as Record<string, unknown> | undefined

  if (!cronograma) {
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  }
  if (!['APROVADO','EM_EXECUCAO','PRONTO_PARA_ENCERRAMENTO'].includes(String(cronograma.status))) {
    return NextResponse.json(
      { error: 'Apenas cronogramas aprovados ou em execução podem gerar uma nova versão.' },
      { status: 400 }
    )
  }

  const novaVersao = (cronograma.versao as number) + 1

  // Pré-busca as parcelas das tarefas de PAGAMENTO fora da transação: a query
  // agora envolve `usuarios` (Postgres, async) e o wrapper de transação do
  // better-sqlite3 é síncrono — não pode conter um `await` no meio do callback.
  const tarefasParaCopia = CronogramaRepository.findTarefasOrdered(cron_id)
  const idsPagamento = tarefasParaCopia
    .filter(t => String(t.natureza_tarefa) === 'PAGAMENTO')
    .map(t => Number(t.id))
  const parcelasPagamento = await CronogramaRepository.findParcelasByTarefaIds(idsPagamento)
  const parcelasPorTarefaAntiga = new Map<number, typeof parcelasPagamento>()
  for (const p of parcelasPagamento) {
    const arr = parcelasPorTarefaAntiga.get(p.cronograma_tarefa_id) ?? []
    arr.push(p)
    parcelasPorTarefaAntiga.set(p.cronograma_tarefa_id, arr)
  }

  let novoCronId: number
  try {
    novoCronId = Number(db.transaction(() => {
      const novoId = CronogramaRepository.insertCronograma({
        projeto_id,
        versao: novaVersao,
        label: `Versão ${novaVersao}`,
        modo: String(cronograma.modo ?? 'CENTRALIZADO'),
        fonte_importacao: String(cronograma.fonte_importacao ?? 'MANUAL'),
        criado_por: session.id,
      })

      // Só tarefas ATIVAS — linhas desativadas pelo editor inline (substituídas
      // por uma versão mais nova da mesma linha) nunca devem ser copiadas.
      const tarefas = CronogramaRepository.findTarefasOrdered(cron_id)

      // Mapa ID antigo → ID novo, para religar parent_id (FASE/TAREFA/SUBTAREFA)
      // na nova versão em vez de deixar todo mundo órfão (parent_id nulo).
      const mapaIds = new Map<number, number>()

      for (const t of tarefas) {
        const idAntigo = Number(t.id)
        const parentAntigo = t.parent_id != null ? Number(t.parent_id) : null
        const novoParentId = parentAntigo != null ? mapaIds.get(parentAntigo) ?? null : null

        const novaTarefaId = Number(CronogramaRepository.insertTarefa({
          cronograma_id: Number(novoId),
          parent_id:         novoParentId,
          codigo:            String(t.codigo ?? ''),
          nome:              String(t.nome),
          descricao:         t.descricao != null ? String(t.descricao) : null,
          nivel:             String(t.nivel),
          tipo:              t.tipo != null ? String(t.tipo) : undefined,
          criticidade:       t.criticidade != null ? String(t.criticidade) : undefined,
          data_inicio:       t.data_inicio != null ? String(t.data_inicio) : null,
          data_fim:          t.data_fim != null ? String(t.data_fim) : null,
          data_inicio_baseline: t.data_inicio_baseline != null ? String(t.data_inicio_baseline) : null,
          data_fim_baseline:    t.data_fim_baseline != null ? String(t.data_fim_baseline) : null,
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
          natureza_tarefa:   t.natureza_tarefa != null ? String(t.natureza_tarefa) : 'NORMAL',
          ativo:             1,
          criado_por:        session.id,
          alterado_por:      session.id,
        }))

        mapaIds.set(idAntigo, novaTarefaId)

        // Tarefa de Pagamento: leva o cabeçalho + as parcelas (com status/data de
        // pagamento preservados) para a nova versão — não recria pagamentos reais,
        // só religa o mesmo histórico financeiro à nova linha da tarefa.
        if (String(t.natureza_tarefa) === 'PAGAMENTO') {
          const header = CronogramaRepository.findPagamentoHeaderByTarefaIds([idAntigo])[0]
          if (header) {
            CronogramaRepository.insertPagamentoHeader({
              cronograma_tarefa_id: novaTarefaId,
              beneficiario: header.beneficiario,
              valor_total: header.valor_total,
              qtd_parcelas: header.qtd_parcelas,
              periodicidade: header.periodicidade,
              data_primeira_parcela: header.data_primeira_parcela,
              criado_por: session.id,
            })
            const parcelas = parcelasPorTarefaAntiga.get(idAntigo) ?? []
            for (const p of parcelas) {
              CronogramaRepository.insertParcelaCompleta({
                cronograma_tarefa_id: novaTarefaId,
                numero: p.numero,
                valor: p.valor,
                data_vencimento: p.data_vencimento,
                data_vencimento_baseline: p.data_vencimento_baseline,
                status: p.status,
                data_pagamento: p.data_pagamento,
                pago_por: p.pago_por,
              })
            }
          }
        }
      }

      return novoId
    }))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
      return NextResponse.json(
        { error: 'Uma nova versão já foi criada para este cronograma. Atualize a página.' },
        { status: 409 }
      )
    }
    throw e
  }

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
