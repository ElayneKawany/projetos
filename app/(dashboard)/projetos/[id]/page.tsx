import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { buscarProjetoPorId, buscarHistoricoStatus, buscarHistoricoPrioridade, buscarHistoricoAlteracoes, buscarConfigStatus } from '@/lib/projetos'
import getDb from '@/lib/db'
import { buscarWorkflow } from '@/lib/workflow'
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


  const projeto = buscarProjetoPorId(Number(id))
  if (!projeto) notFound()

  const db = getDb()
  const historicoStatus         = buscarHistoricoStatus(projeto.id)
  const historicoPrioridade     = buscarHistoricoPrioridade(projeto.id)
  const historicoAlteracoes     = buscarHistoricoAlteracoes(projeto.id)
  const configStatus            = buscarConfigStatus()

  const tapVersoes = db.prepare(`
    SELECT tv.*, u.nome as criador_nome, ua.nome as aprovador_nome
    FROM tap_versoes tv
    LEFT JOIN usuarios u  ON tv.criado_por   = u.id
    LEFT JOIN usuarios ua ON tv.aprovado_por = ua.id
    WHERE tv.projeto_id = ?
    ORDER BY tv.versao DESC
  `).all(projeto.id)

  const triagem = db.prepare('SELECT * FROM triagens WHERE projeto_id = ?').get(projeto.id)

  const viabilidadeData = db.prepare(
    'SELECT * FROM viabilidade WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1'
  ).get(projeto.id)

  const cronogramaData = db.prepare(
    'SELECT * FROM cronogramas WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1'
  ).get(projeto.id) as { id: number } | undefined

  // Cronograma aprovado — data prevista calculada via MAX(data_fim) das tarefas
  const cronAprovRow = db.prepare(
    `SELECT id FROM cronogramas WHERE projeto_id = ? AND status IN ('APROVADO','EM_EXECUCAO','PRONTO_PARA_ENCERRAMENTO','ENCERRADO') AND (ativo IS NULL OR ativo = 1) ORDER BY versao DESC LIMIT 1`
  ).get(projeto.id) as { id: number } | undefined
  const cronogramaAprovadoData = cronAprovRow
    ? (db.prepare(
        `SELECT MAX(data_fim) AS data_fim_prev FROM cronograma_tarefas WHERE cronograma_id = ?`
      ).get(cronAprovRow.id) as { data_fim_prev?: string | null } | undefined)
    : undefined

  // Tarefas pendentes no cronograma atual (para aviso no modal de conclusão)
  const cronAtualId = (cronogramaData as { id?: number } | undefined)?.id
  let tarefasPendentes = 0
  if (cronAtualId) {
    const { pendentes } = db.prepare(
      `SELECT COUNT(*) AS pendentes FROM cronograma_tarefas
       WHERE cronograma_id = ? AND nivel = 'TAREFA' AND data_conclusao IS NULL
         AND (ativo IS NULL OR ativo = 1)`
    ).get(cronAtualId) as { pendentes: number }
    tarefasPendentes = pendentes
  }

  const cronogramaTarefas = cronogramaData
    ? db.prepare(`
        SELECT ct.*,
               ur.nome as responsavel_nome,
               ue.nome as executor_nome
        FROM cronograma_tarefas ct
        LEFT JOIN usuarios ur ON ct.responsavel_id = ur.id
        LEFT JOIN usuarios ue ON ct.executor_id    = ue.id
        WHERE ct.cronograma_id = ?
        ORDER BY ct.ordem
      `).all(cronogramaData.id)
    : []

  const lancamentos = db.prepare(`
    SELECT fl.*, u.nome as criador_nome
    FROM financeiro_lancamentos fl
    LEFT JOIN usuarios u ON fl.criado_por = u.id
    WHERE fl.projeto_id = ?
    ORDER BY fl.data_lancamento DESC
  `).all(projeto.id)

  const aprovacoesProjeto = db.prepare(`
    SELECT a.*, u.nome as solicitante_nome, ua.nome as aprovador_nome
    FROM aprovacoes a
    LEFT JOIN usuarios u  ON a.solicitante_id = u.id
    LEFT JOIN usuarios ua ON a.aprovador_id   = ua.id
    WHERE a.projeto_id = ?
    ORDER BY a.created_at DESC
  `).all(projeto.id)

  const diretorias = db.prepare('SELECT * FROM diretorias WHERE ativo=1 ORDER BY nome').all()
  const areas = db.prepare(
    'SELECT a.*, d.nome as diretoria_nome FROM areas a JOIN diretorias d ON a.diretoria_id=d.id WHERE a.ativo=1'
  ).all()
  const usuarios = db.prepare('SELECT id, nome, email, cargo FROM usuarios WHERE ativo=1 ORDER BY nome').all()
  const usuariosPmo = db.prepare("SELECT id, nome FROM usuarios WHERE ativo=1 AND perfil='PMO' ORDER BY nome").all()

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
      workflowTap={workflowTap as never}
      workflowViabilidade={workflowViabilidade as never}
      workflowCronograma={workflowCronograma as never}
      cronogramaAprovadoData={cronogramaAprovadoData as never}
      snapshotFinal={snapshotFinal as never}
      tarefasPendentes={tarefasPendentes}
      initialTab={tab}
      session={session}
    />
  )
}
