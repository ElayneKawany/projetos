import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { buscarProjetoPorId, buscarHistoricoStatus, buscarHistoricoPrioridade, buscarHistoricoAlteracoes, buscarConfigStatus } from '@/lib/projetos'
import { UsuariosRepository, TapRepository, ViabilidadeRepository } from '@/lib/repositories'
import { asyncDb } from '@/lib/database'
import getDb from '@/lib/db'
import { buscarWorkflow } from '@/lib/workflow'
import { CronogramaRepository } from '@/lib/repositories/cronograma'
import { calcIntervaloCronograma } from '@/lib/cronograma/resumo-fase'
import ProjetoDetalheClient from './ProjetoDetalheClient'

export default async function ProjetoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const tab = (await searchParams)?.tab
  const session = await getSession()
  if (!session) return null


  const projeto = await buscarProjetoPorId(Number(id))
  if (!projeto) notFound()

  const db = getDb()
  const historicoStatus         = await buscarHistoricoStatus(projeto.id)
  const historicoPrioridade     = await buscarHistoricoPrioridade(projeto.id)
  const historicoAlteracoes     = buscarHistoricoAlteracoes(projeto.id)
  const configStatus            = await buscarConfigStatus()

  // tap_versoes e viabilidade já estão em Postgres (fatias 2 e 3) — busca via
  // repositório, não mais via SQLite (que ficou congelado desde a migração dessas
  // tabelas). aprovador_nome já vem resolvido pelo repositório; criador_nome
  // ainda precisa do merge em JS de sempre (usuarios também é Postgres).
  const tapVersoesRaw = await TapRepository.findAllByProjectId(projeto.id)
  const tapNomeIds = [...new Set(
    tapVersoesRaw.map(t => t.criado_por).filter((v): v is number => v != null)
  )]
  const tapNomes = await UsuariosRepository.findNomesPorIds(tapNomeIds)
  const tapVersoes = tapVersoesRaw.map(t => ({
    ...t,
    criador_nome: t.criado_por != null ? tapNomes.get(t.criado_por)?.nome ?? null : null,
  }))

  const triagem = db.prepare('SELECT * FROM triagens WHERE projeto_id = ?').get(projeto.id)

  const viabilidadeData = await ViabilidadeRepository.findLatestByProjectId(projeto.id)

  const capexProjecoes = viabilidadeData
    ? db.prepare(`
        SELECT id, viabilidade_id, projeto_id, periodo_ref, valor, descricao, usuario_nome, created_at
        FROM viabilidade_capex_projecoes
        WHERE viabilidade_id = ? AND projeto_id = ?
        ORDER BY created_at ASC
      `).all((viabilidadeData as { id: number }).id, projeto.id) as {
        id: number; viabilidade_id: number; projeto_id: number
        periodo_ref: string; valor: number; descricao: string
        usuario_nome: string | null; created_at: string
      }[]
    : []

  // cronogramas/cronograma_tarefas/cronograma_tarefa_pagamento/cronograma_tarefa_parcelas
  // já estão em Postgres (fatia 5) — busca via CronogramaRepository, que já resolve os
  // merges de nome de usuário (e o normTarefa/normCronograma que preserva ativo/is_baseline
  // como 0/1, não boolean, pro contrato existente com o frontend).
  const cronogramaData = await CronogramaRepository.findLatestByProjectId(projeto.id) as { id: number } | undefined

  // Cronograma vigente — mesmo critério em toda a aplicação (CronogramaRepository.findCronogramaVigente):
  // ativo, não arquivado, status aprovado/em execução. Usado tanto para a data prevista quanto
  // para o intervalo real de Execução exibido na Timeline do projeto.
  const cronAprovRow = await CronogramaRepository.findCronogramaVigente(projeto.id)
  const cronogramaAprovadoData = cronAprovRow
    ? await asyncDb.queryOne<{ data_fim_prev?: string | null }>(
        `SELECT MAX(data_fim) AS data_fim_prev FROM "AI"."TI_PMO_CRONOGRAMA_TAREFAS" WHERE cronograma_id = ?`,
        [cronAprovRow.id]
      )
    : undefined

  // Intervalo real de execução (início/fim) derivado do cronograma vigente — respeita hierarquia
  // FASE→TAREFA via calcIntervaloCronograma (mesmo cálculo usado na aba Cronograma).
  const tarefasParaIntervalo = cronAprovRow
    ? await asyncDb.queryMany<{
        nivel: string; data_inicio: string | null; data_fim: string | null
        data_conclusao: string | null; status: string | null
        percentual: number | null; prazo_status: string | null
      }>(
        `SELECT nivel, data_inicio, data_fim, data_conclusao, status, percentual, prazo_status
         FROM "AI"."TI_PMO_CRONOGRAMA_TAREFAS"
         WHERE cronograma_id = ? AND nivel IN ('FASE', 'TAREFA') AND (ativo IS NULL OR ativo = true)
         ORDER BY ordem`,
        [cronAprovRow.id]
      )
    : []
  const execucaoRange = cronAprovRow ? calcIntervaloCronograma(tarefasParaIntervalo) : null

  // Tarefas pendentes no cronograma atual (para aviso no modal de conclusão)
  const cronAtualId = cronogramaData?.id
  let tarefasPendentes = 0
  if (cronAtualId) {
    const row = await asyncDb.queryOne<{ pendentes: number }>(
      `SELECT COUNT(*) AS pendentes FROM "AI"."TI_PMO_CRONOGRAMA_TAREFAS"
       WHERE cronograma_id = ? AND nivel = 'TAREFA' AND data_conclusao IS NULL
         AND (ativo IS NULL OR ativo = true)`,
      [cronAtualId]
    )
    tarefasPendentes = row?.pendentes ?? 0
  }

  const cronogramaTarefas = (cronogramaData
    ? await CronogramaRepository.findTasks(cronogramaData.id)
    : []) as unknown as (Record<string, unknown> & { id: number; natureza_tarefa?: string; pagamento?: unknown })[]

  // Tarefa de Pagamento: anexa cabeçalho + parcelas nas tarefas com natureza_tarefa='PAGAMENTO'
  const tarefasPagamentoIds = cronogramaTarefas
    .filter(t => t.natureza_tarefa === 'PAGAMENTO')
    .map(t => t.id)
  if (tarefasPagamentoIds.length > 0) {
    const [headers, parcelas] = await Promise.all([
      CronogramaRepository.findPagamentoHeaderByTarefaIds(tarefasPagamentoIds),
      CronogramaRepository.findParcelasByTarefaIds(tarefasPagamentoIds),
    ])
    for (const t of cronogramaTarefas) {
      const header = headers.find(h => h.cronograma_tarefa_id === t.id)
      if (!header) continue
      t.pagamento = { ...header, parcelas: parcelas.filter(p => p.cronograma_tarefa_id === t.id) }
    }
  }

  const lancamentosRaw = db.prepare(`
    SELECT * FROM financeiro_lancamentos WHERE projeto_id = ? ORDER BY data_lancamento DESC
  `).all(projeto.id) as (Record<string, unknown> & { criado_por: number | null })[]
  const lancNomeIds = [...new Set(lancamentosRaw.map(l => l.criado_por).filter((v): v is number => v != null))]
  const lancNomes = await UsuariosRepository.findNomesPorIds(lancNomeIds)
  const lancamentos = lancamentosRaw.map(l => ({
    ...l,
    criador_nome: l.criado_por != null ? lancNomes.get(l.criado_por)?.nome ?? null : null,
  })) as Record<string, unknown>[]

  const aprovacoesProjetoRaw = db.prepare(`
    SELECT * FROM aprovacoes WHERE projeto_id = ? ORDER BY created_at DESC
  `).all(projeto.id) as (Record<string, unknown> & { solicitante_id: number | null; aprovador_id: number | null })[]
  const aprovNomeIds = [...new Set(
    aprovacoesProjetoRaw.flatMap(a => [a.solicitante_id, a.aprovador_id]).filter((v): v is number => v != null)
  )]
  const aprovNomes = await UsuariosRepository.findNomesPorIds(aprovNomeIds)
  const aprovacoesProjeto = aprovacoesProjetoRaw.map(a => ({
    ...a,
    solicitante_nome: a.solicitante_id != null ? aprovNomes.get(a.solicitante_id)?.nome ?? null : null,
    aprovador_nome: a.aprovador_id != null ? aprovNomes.get(a.aprovador_id)?.nome ?? null : null,
  }))

  const diretorias = db.prepare('SELECT * FROM diretorias WHERE ativo=1 ORDER BY nome').all()
  const areas = db.prepare(
    'SELECT a.*, d.nome as diretoria_nome FROM areas a JOIN diretorias d ON a.diretoria_id=d.id WHERE a.ativo=1'
  ).all()
  const usuarios = await asyncDb.queryMany(
    `SELECT id, nome, email, cargo FROM "AI"."TI_PMO_USUARIOS" WHERE ativo = true ORDER BY nome`
  )
  const perfilPmo = db.prepare(`SELECT id FROM perfis WHERE codigo = 'PMO'`).get() as { id: number } | undefined
  const usuariosPmo = perfilPmo
    ? await asyncDb.queryMany(
        `SELECT id, nome FROM "AI"."TI_PMO_USUARIOS" WHERE ativo = true AND perfil_id = ? ORDER BY nome`,
        [perfilPmo.id]
      )
    : []

  const fasePrazos = db.prepare(
    'SELECT status, data_limite, data_baseline FROM projeto_fase_prazo WHERE projeto_id = ?'
  ).all(projeto.id) as { status: string; data_limite: string | null; data_baseline: string | null }[]

  const fasePrazosHistorico = db.prepare(`
    SELECT h.id, h.status, h.data_anterior, h.nova_data, h.justificativa,
           h.usuario_nome, h.created_at
    FROM projeto_fase_prazo_historico h
    WHERE h.projeto_id = ?
    ORDER BY h.created_at ASC
  `).all(projeto.id) as {
    id: number; status: string; data_anterior: string; nova_data: string
    justificativa: string; usuario_nome: string | null; created_at: string
  }[]

  // Workflows ativos por documento
  const tapAtualId = (tapVersoes[0] as { id?: number } | undefined)?.id
  const workflowTap         = tapAtualId ? buscarWorkflow(tapAtualId, 'TAP') : null
  const workflowViabilidade = viabilidadeData ? buscarWorkflow((viabilidadeData as { id: number }).id, 'VIABILIDADE') : null
  const workflowCronograma  = cronogramaData  ? buscarWorkflow(cronogramaData.id, 'CRONOGRAMA') : null

  const capexRealizado = (lancamentos as { tipo: string; valor: number }[])
    .filter(l => l.tipo === 'CAPEX').reduce((a, l) => a + l.valor, 0)
  const opexRealizado = (lancamentos as { tipo: string; valor: number }[])
    .filter(l => l.tipo === 'OPEX').reduce((a, l) => a + l.valor, 0)

  const snapshotFinal = db.prepare(
    `SELECT * FROM projeto_snapshot_final WHERE projeto_id = ?`
  ).get(projeto.id) as {
    roi_previsto: number | null; roi_atual: number | null
    capex_previsto: number | null; capex_executado: number | null
    opex_previsto: number | null; opex_executado: number | null
    economia_prevista: number | null; economia_realizada: number | null
    data_fim_prev: string | null; data_conclusao_real: string | null
    dias_desvio: number | null; responsavel: string | null; created_at: string
  } | undefined

  return (
    <ProjetoDetalheClient
      projeto={projeto}
      historicoStatus={historicoStatus as never[]}
      historicoPrioridade={historicoPrioridade as never[]}
      historicoAlteracoes={historicoAlteracoes as never[]}
      configStatus={configStatus}
      tapVersoes={tapVersoes as never[]}
      triagem={triagem as never}
      viabilidadeData={viabilidadeData as never}
      capexAprovado={projeto.capex_aprovado ?? null}
      capexProjecoes={capexProjecoes}
      cronogramaData={cronogramaData as never}
      cronogramaTarefas={cronogramaTarefas as never[]}
      lancamentos={lancamentos as never[]}
      aprovacoesProjeto={aprovacoesProjeto as never[]}
      capexRealizado={capexRealizado}
      opexRealizado={opexRealizado}
      diretorias={diretorias as never[]}
      areas={areas as never[]}
      usuarios={usuarios as never[]}
      usuariosPmo={usuariosPmo as never[]}
      fasePrazos={fasePrazos}
      fasePrazosHistorico={fasePrazosHistorico}
      workflowTap={workflowTap as never}
      workflowViabilidade={workflowViabilidade as never}
      workflowCronograma={workflowCronograma as never}
      cronogramaAprovadoData={cronogramaAprovadoData as never}
      execucaoRange={execucaoRange}
      snapshotFinal={snapshotFinal as never}
      tarefasPendentes={tarefasPendentes}
      initialTab={tab}
      session={session}
    />
  )
}
