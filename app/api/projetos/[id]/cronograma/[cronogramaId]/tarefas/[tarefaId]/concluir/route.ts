import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

// ── Helpers ────────────────────────────────────────────────────────────────────

// Parse de data no fuso local (evita desvio UTC meia-noite → dia anterior em UTC-3)
function parseDateLocalOnly(s: string): Date {
  const parte = String(s).split('T')[0].split(' ')[0] // aceita 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:...'
  const [y, m, d] = parte.split('-').map(Number)
  return new Date(y, m - 1, d)  // construído em hora local, sem conversão UTC
}

function calcPrazoStatus(dataFim: unknown, hoje: Date): 'NO_PRAZO' | 'FORA_DO_PRAZO' {
  if (!dataFim) return 'NO_PRAZO'
  const fim = parseDateLocalOnly(String(dataFim))
  // hoje já vem com setHours(0,0,0,0) feito pelo chamador
  return hoje > fim ? 'FORA_DO_PRAZO' : 'NO_PRAZO'
}

function calcDiasAtraso(dataFim: unknown, hoje: Date): number {
  if (!dataFim) return 0
  const fim = parseDateLocalOnly(String(dataFim))
  const diff = Math.ceil((hoje.getTime() - fim.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

function concluirItem(id: number, prazoStatus: string, userId: number) {
  CronogramaRepository.concluirTarefa(id, prazoStatus, userId)
}

function atualizarPercentualItem(id: number, percentual: number, userId: number) {
  CronogramaRepository.atualizarPercentualTarefa(id, percentual, userId)
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string; tarefaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId, tarefaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)
  const tarefa_id     = Number(tarefaId)

  const cronograma = CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id)

  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  const item = CronogramaRepository.findTarefaByIdAndCronograma(tarefa_id, cronograma_id)

  if (!item)                 return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })
  if (item.nivel === 'FASE') return NextResponse.json({ error: 'Fases não podem ser concluídas diretamente.' }, { status: 400 })
  if (item.data_conclusao)   return NextResponse.json({ error: 'Atividade já foi concluída.' }, { status: 400 })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const prazoStatus  = calcPrazoStatus(item.data_fim, hoje)
  const foraDoPrazo  = prazoStatus === 'FORA_DO_PRAZO'
  const diasAtraso   = foraDoPrazo ? calcDiasAtraso(item.data_fim, hoje) : 0
  const isSubtarefa  = item.nivel === 'SUBTAREFA'
  const labelTipo    = isSubtarefa ? 'Subtarefa' : 'Tarefa'

  // Resultados propagados — preenchidos dentro da transação
  let tarefaPaiAutoCompletada = false
  let tarefaPaiNome:  string | null = null
  let faseAutoCompletada      = false
  let fasePaiId:  number | null = null
  let faseNome:  string | null = null

  db.transaction(() => {
    // ── 1. Concluir o item (TAREFA ou SUBTAREFA) ──────────────────────────────
    concluirItem(tarefa_id, prazoStatus, session.id)

    registrarEvento({
      projeto_id,
      modulo:          'CRONOGRAMA',
      artefato:        'CRONOGRAMA',
      evento:          'ALTERADO',
      titulo:          foraDoPrazo
        ? `${labelTipo} concluída fora do prazo: ${item.nome}`
        : `${labelTipo} concluída: ${item.nome}`,
      descricao:       foraDoPrazo
        ? `Concluída por ${session.nome} — fora do prazo (previsto: ${item.data_fim})`
        : `Concluída por ${session.nome} — dentro do prazo`,
      usuario_id:      session.id,
      usuario_nome:    session.nome,
      referencia_id:   tarefa_id,
      referencia_tipo: 'cronograma_tarefa',
    })

    registrarAuditoria({
      usuario_id:   session.id,
      usuario_nome: session.nome,
      acao:         'UPDATE',
      entidade:     'cronograma_tarefas',
      entidade_id:  tarefa_id,
      projeto_id,
      descricao:    foraDoPrazo
        ? `${labelTipo} "${item.nome}" concluída FORA DO PRAZO por ${session.nome}`
        : `${labelTipo} "${item.nome}" concluída NO PRAZO por ${session.nome}`,
      dados_antes:  { status: item.status ?? 'PENDENTE', percentual: item.percentual ?? 0, data_conclusao: null },
      dados_depois: { status: 'CONCLUIDA', percentual: 100, prazo_status: prazoStatus, concluido_por: session.id },
    })

    if (!item.parent_id) return  // item sem pai → nada a propagar

    // ── 2. SUBTAREFA: propagar para a TAREFA pai ──────────────────────────────
    if (isSubtarefa) {
      const tarefaPaiId = item.parent_id as number

      const tarefaPai = CronogramaRepository.findTarefaComNivel(tarefaPaiId, 'TAREFA', cronograma_id)

      if (!tarefaPai) return

      tarefaPaiNome = String(tarefaPai.nome)

      const totalSubs     = CronogramaRepository.countSubtarefas(cronograma_id, tarefaPaiId, false)
      const concluidasSubs = CronogramaRepository.countSubtarefas(cronograma_id, tarefaPaiId, true)

      const tarefaPercentual = totalSubs > 0 ? Math.round((concluidasSubs / totalSubs) * 100) : 0
      const tarefaConclusa   = totalSubs > 0 && concluidasSubs >= totalSubs

      if (tarefaConclusa && !tarefaPai.data_conclusao) {
        const tarefaPrazo = calcPrazoStatus(tarefaPai.data_fim, hoje)
        concluirItem(tarefaPaiId, tarefaPrazo, session.id)
        tarefaPaiAutoCompletada = true

        registrarEvento({
          projeto_id, modulo: 'CRONOGRAMA', artefato: 'CRONOGRAMA', evento: 'ALTERADO',
          titulo:      `Tarefa concluída automaticamente: ${tarefaPaiNome}`,
          descricao:   `Todas as ${totalSubs} subtarefa(s) foram concluídas.`,
          usuario_id: session.id, usuario_nome: session.nome,
          referencia_id: tarefaPaiId, referencia_tipo: 'cronograma_tarefa',
        })

        registrarAuditoria({
          usuario_id: session.id, usuario_nome: session.nome, acao: 'UPDATE',
          entidade: 'cronograma_tarefas', entidade_id: tarefaPaiId, projeto_id,
          descricao: `Tarefa "${tarefaPaiNome}" concluída automaticamente — todas as subtarefas concluídas`,
          dados_antes:  { status: tarefaPai.status ?? 'PENDENTE', percentual: tarefaPai.percentual ?? 0 },
          dados_depois: { status: 'CONCLUIDA', percentual: 100, prazo_status: tarefaPrazo },
        })
      } else {
        atualizarPercentualItem(tarefaPaiId, tarefaPercentual, session.id)
      }

      // Avançar parent_id para ser o da fase (tarefa pai → fase avó)
      if (!tarefaPai.parent_id) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(item as any).parent_id = tarefaPai.parent_id
    }

    // ── 3. Propagar para a FASE (vale para TAREFA direta e para SUBTAREFA após passo 2) ──
    fasePaiId = item.parent_id as number

    const fase = CronogramaRepository.findTarefaComNivel(fasePaiId, 'FASE', cronograma_id)

    if (!fase || fase.data_conclusao) return

    faseNome = String(fase.nome)

    const totalTarefasFase    = CronogramaRepository.countTarefasFase(cronograma_id, fasePaiId, false)
    const concluidasTarefasFase = CronogramaRepository.countTarefasFase(cronograma_id, fasePaiId, true)

    const fasePercentual = totalTarefasFase > 0
      ? Math.round((concluidasTarefasFase / totalTarefasFase) * 100)
      : 0
    const faseConclusa = totalTarefasFase > 0 && concluidasTarefasFase >= totalTarefasFase

    if (faseConclusa) {
      const fasePrazoStatus = calcPrazoStatus(fase.data_fim, hoje)
      CronogramaRepository.concluirTarefa(fasePaiId, fasePrazoStatus, session.id)

      faseAutoCompletada = true

      registrarEvento({
        projeto_id, modulo: 'CRONOGRAMA', artefato: 'CRONOGRAMA', evento: 'ALTERADO',
        titulo:      `Fase concluída automaticamente: ${faseNome}`,
        descricao:   `Todas as ${totalTarefasFase} tarefa(s) da fase foram concluídas.`,
        usuario_id: session.id, usuario_nome: session.nome,
        referencia_id: fasePaiId, referencia_tipo: 'cronograma_fase',
      })

      registrarAuditoria({
        usuario_id: session.id, usuario_nome: session.nome, acao: 'UPDATE',
        entidade: 'cronograma_tarefas', entidade_id: fasePaiId, projeto_id,
        descricao: `Fase "${faseNome}" concluída automaticamente — todas as tarefas concluídas`,
        dados_antes:  { status: fase.status ?? 'PENDENTE', percentual: fase.percentual ?? 0, data_conclusao: null },
        dados_depois: { status: 'CONCLUIDA', percentual: 100, prazo_status: fasePrazoStatus, concluido_por: session.id },
      })
    } else {
      atualizarPercentualItem(fasePaiId, fasePercentual, session.id)

      registrarAuditoria({
        usuario_id: session.id, usuario_nome: session.nome, acao: 'UPDATE',
        entidade: 'cronograma_tarefas', entidade_id: fasePaiId, projeto_id,
        descricao: `Percentual da fase "${faseNome}" atualizado para ${fasePercentual}%`,
        dados_antes:  { percentual: fase.percentual ?? 0 },
        dados_depois: { percentual: fasePercentual },
      })
    }
  })

  // ── 4. Verificar auto-avanço do cronograma para PRONTO_PARA_ENCERRAMENTO ────
  let cronogramaConcluidoAuto = false
  if (cronograma.status === 'EM_EXECUCAO') {
    const totalTarefas    = CronogramaRepository.countTarefasTotais(cronograma_id, false)
    const concluidasTarefas = CronogramaRepository.countTarefasTotais(cronograma_id, true)

    if (totalTarefas > 0 && concluidasTarefas >= totalTarefas) {
      CronogramaRepository.updateStatus(cronograma_id, 'PRONTO_PARA_ENCERRAMENTO')

      cronogramaConcluidoAuto = true

      registrarEvento({
        projeto_id, modulo: 'CRONOGRAMA', artefato: 'CRONOGRAMA', evento: 'ALTERADO',
        titulo:      'Cronograma concluído',
        descricao:   `Todas as ${totalTarefas} tarefa(s) concluídas. Cronograma pronto para encerramento.`,
        usuario_id: session.id, usuario_nome: session.nome,
        referencia_id: cronograma_id, referencia_tipo: 'cronograma',
      })

      registrarAuditoria({
        usuario_id: session.id, usuario_nome: session.nome, acao: 'UPDATE',
        entidade: 'cronogramas', entidade_id: cronograma_id, projeto_id,
        descricao: `Cronograma avançou para PRONTO_PARA_ENCERRAMENTO — ${totalTarefas} tarefa(s) concluídas`,
        dados_antes:  { status: 'EM_EXECUCAO' },
        dados_depois: { status: 'PRONTO_PARA_ENCERRAMENTO', totalTarefas, concluidasTarefas },
      })
    }
  }

  return NextResponse.json({
    ok:                       true,
    prazo_status:             prazoStatus,
    dias_atraso:              diasAtraso,
    is_subtarefa:             isSubtarefa,
    tarefa_pai_auto_completada: tarefaPaiAutoCompletada,
    tarefa_pai_nome:          tarefaPaiNome,
    fase_auto_completada:     faseAutoCompletada,
    fase_nome:                faseNome,
    cronograma_concluido:     cronogramaConcluidoAuto,
  })
}
