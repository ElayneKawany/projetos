import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import { calcularCodigosWBS } from '@/lib/cronograma/wbs'
import getDb from '@/lib/db'

// PATCH — move uma TAREFA (normal ou Tarefa de Pagamento) para outra FASE do mesmo
// cronograma, sem duplicar o registro. Sem checagem de cronograma.status: mesma regra já
// aplicada às rotas de Reprogramar e Concluir tarefa (mutações pontuais de uma tarefa
// existente não são restritas a RASCUNHO neste sistema).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string; tarefaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId, tarefaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)
  const tarefa_id     = Number(tarefaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)
  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  const tarefa = CronogramaRepository.findTarefaByIdAndCronograma(tarefa_id, cronograma_id) as
    Record<string, unknown> | undefined
  if (!tarefa || (tarefa.ativo != null && tarefa.ativo === 0)) {
    return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })
  }
  if (tarefa.nivel !== 'TAREFA') {
    return NextResponse.json({ error: 'Só é possível mover itens do nível Tarefa.' }, { status: 400 })
  }

  const body = await request.json() as { nova_fase_id?: number }
  const novaFaseId = Number(body.nova_fase_id)
  if (!novaFaseId) {
    return NextResponse.json({ error: 'Informe a fase de destino (nova_fase_id).' }, { status: 400 })
  }

  const novaFase = CronogramaRepository.findTarefaComNivel(novaFaseId, 'FASE', cronograma_id) as
    Record<string, unknown> | undefined
  if (!novaFase) {
    return NextResponse.json({ error: 'Fase de destino não encontrada neste cronograma.' }, { status: 404 })
  }
  if (tarefa.parent_id === novaFaseId) {
    return NextResponse.json({ error: 'A tarefa já está nesta fase.' }, { status: 400 })
  }

  const faseAntiga = tarefa.parent_id != null
    ? CronogramaRepository.findTarefaByIdAndCronograma(tarefa.parent_id as number, cronograma_id) as
        Record<string, unknown> | undefined
    : undefined

  const lista = CronogramaRepository.findTarefasAtivasOrdenadas(cronograma_id)

  const tarefaIdx = lista.findIndex(t => t.id === tarefa_id)
  if (tarefaIdx === -1) {
    return NextResponse.json({ error: 'Tarefa não encontrada na lista ativa do cronograma.' }, { status: 404 })
  }

  // Bloco a mover: a própria tarefa + suas subtarefas filhas diretas, contíguas na lista
  const bloco = [lista[tarefaIdx]]
  let cursor = tarefaIdx + 1
  while (cursor < lista.length && lista[cursor].nivel === 'SUBTAREFA' && lista[cursor].parent_id === tarefa_id) {
    bloco.push(lista[cursor])
    cursor++
  }

  const restante = [...lista.slice(0, tarefaIdx), ...lista.slice(cursor)]

  const faseIdxNaRestante = restante.findIndex(t => t.id === novaFaseId)
  if (faseIdxNaRestante === -1) {
    return NextResponse.json({ error: 'Fase de destino não encontrada.' }, { status: 404 })
  }

  // Ponto de inserção: imediatamente após o último filho já existente da fase destino
  let insertIdx = faseIdxNaRestante + 1
  while (insertIdx < restante.length && restante[insertIdx].nivel !== 'FASE') insertIdx++

  const novaLista = [...restante.slice(0, insertIdx), ...bloco, ...restante.slice(insertIdx)]
  const codigos = calcularCodigosWBS(novaLista)

  const db = getDb()
  db.transaction(() => {
    novaLista.forEach((item, idx) => {
      const ordem  = idx + 1
      const codigo = codigos[idx]
      if (item.id === tarefa_id) {
        CronogramaRepository.updatePosicaoTarefa(item.id, cronograma_id, {
          parent_id: novaFaseId, ordem, codigo, alterado_por: session.id,
        })
      } else {
        CronogramaRepository.updateOrdemCodigo(item.id, ordem, codigo)
      }
    })
  })()

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'CRONOGRAMA',
    evento:          'ALTERADO',
    titulo:          'Tarefa movida entre fases',
    descricao:       `"${tarefa.nome}" movida de "${faseAntiga?.nome ?? '—'}" para "${novaFase.nome}" por ${session.nome}`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   cronograma_id,
    referencia_tipo: 'cronograma',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'UPDATE',
    entidade:     'cronograma_tarefas',
    entidade_id:  tarefa_id,
    projeto_id,
    descricao:    `Tarefa "${tarefa.nome}" movida de fase`,
    dados_antes:  { fase_id: tarefa.parent_id, fase_nome: faseAntiga?.nome ?? null },
    dados_depois: { fase_id: novaFaseId, fase_nome: novaFase.nome },
  })

  return NextResponse.json({ ok: true })
}
