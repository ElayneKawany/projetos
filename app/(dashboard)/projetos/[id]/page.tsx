import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { buscarProjetoPorId, buscarHistoricoStatus, buscarHistoricoPrioridade } from '@/lib/projetos'
import getDb from '@/lib/db'
import ProjetoDetalheClient from './ProjetoDetalheClient'

export default async function ProjetoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return null

  const projeto = buscarProjetoPorId(Number(id))
  if (!projeto) notFound()

  const db = getDb()
  const historicoStatus     = buscarHistoricoStatus(projeto.id)
  const historicoPrioridade = buscarHistoricoPrioridade(projeto.id)

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

  const cronogramaTarefas = cronogramaData
    ? db.prepare(`
        SELECT ct.*, u.nome as responsavel_nome
        FROM cronograma_tarefas ct
        LEFT JOIN usuarios u ON ct.responsavel_id = u.id
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

  const capexRealizado = (lancamentos as { tipo: string; valor: number }[])
    .filter(l => l.tipo === 'CAPEX').reduce((a, l) => a + l.valor, 0)
  const opexRealizado = (lancamentos as { tipo: string; valor: number }[])
    .filter(l => l.tipo === 'OPEX').reduce((a, l) => a + l.valor, 0)

  return (
    <ProjetoDetalheClient
      projeto={projeto}
      historicoStatus={historicoStatus as never[]}
      historicoPrioridade={historicoPrioridade as never[]}
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
      session={session}
    />
  )
}
