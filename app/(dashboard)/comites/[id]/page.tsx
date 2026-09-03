import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { UsuariosRepository, TapRepository, ViabilidadeRepository } from '@/lib/repositories'
import ComiteDetalheClient from './ComiteDetalheClient'
import { DEV2026_ATIVIDADES } from '@/lib/ti/dev2026-data'
import { DATA_FIM_EFETIVA_SQL } from '@/lib/repositories/projetos'

export default async function ComiteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comiteId = parseInt(id)
  if (isNaN(comiteId)) notFound()

  const session = await getSession()
  if (!session) notFound()

  const db = getDb()
  const comiteRaw = db.prepare('SELECT * FROM comites WHERE id = ?').get(comiteId) as (Record<string, unknown> & { created_by: number | null }) | undefined
  if (!comiteRaw) notFound()
  const criadorNomes = await UsuariosRepository.findNomesPorIds(comiteRaw.created_by != null ? [comiteRaw.created_by] : [])
  const comite = {
    ...comiteRaw,
    criador_nome: comiteRaw.created_by != null ? criadorNomes.get(comiteRaw.created_by)?.nome ?? null : null,
  }

  const participantesRaw = db.prepare(`
    SELECT * FROM comite_participantes WHERE comite_id = ? ORDER BY id
  `).all(comiteId) as (Record<string, unknown> & { usuario_id: number | null; nome_externo: string | null })[]
  const partIds = [...new Set(participantesRaw.map(p => p.usuario_id).filter((v): v is number => v != null))]
  const partNomes = await UsuariosRepository.findNomesPorIds(partIds)
  const participantes = participantesRaw.map(p => ({
    ...p,
    nome_exibicao: (p.usuario_id != null ? partNomes.get(p.usuario_id)?.nome : undefined) ?? p.nome_externo,
    usuario_cargo: p.usuario_id != null ? partNomes.get(p.usuario_id)?.cargo ?? null : null,
  }))

  const comiteProjetos = db.prepare(`
    SELECT cp.*, p.codigo AS projeto_codigo, p.nome AS projeto_nome,
           p.status AS projeto_status, d.nome AS projeto_diretoria
    FROM comite_projetos cp
    JOIN projetos p ON p.id = cp.projeto_id
    LEFT JOIN diretorias d ON d.id = p.diretoria_id
    WHERE cp.comite_id = ?
    ORDER BY cp.ordem_pauta, cp.id
  `).all(comiteId)

  const decisoes = db.prepare(`
    SELECT cd.*, p.nome AS projeto_nome, p.codigo AS projeto_codigo
    FROM comite_decisoes cd LEFT JOIN projetos p ON p.id = cd.projeto_id
    WHERE cd.comite_id = ? ORDER BY cd.created_at
  `).all(comiteId)

  const pendencias = db.prepare(`
    SELECT cp.*, p.nome AS projeto_nome, p.codigo AS projeto_codigo
    FROM comite_pendencias cp LEFT JOIN projetos p ON p.id = cp.projeto_id
    WHERE cp.comite_id = ? ORDER BY cp.status, cp.prazo
  `).all(comiteId)

  const ata = db.prepare('SELECT * FROM comite_ata WHERE comite_id = ?').get(comiteId)
  const ataHistorico = db.prepare('SELECT * FROM comite_ata_historico WHERE comite_id = ? ORDER BY created_at DESC LIMIT 20').all(comiteId)

  // Portfolio data for slides
  // data_fim_efetiva = fonte única de prazo/atraso (DATA_FIM_EFETIVA_SQL) — Data Base de
  // Entrega imutável quando o projeto já tem Cronograma aprovado, senão a "Data limite" da
  // macro fase atual (projeto_fase_prazo). Mesma expressão usada pelo Dashboard e pela
  // listagem/detalhe de Projetos — nunca duplicar esse cálculo aqui.
  const todosProjetosRaw = db.prepare(`
    SELECT p.id, p.codigo, p.nome, p.status, p.prioridade, p.complexidade,
           p.capex_aprovado AS investimento,
           p.data_inicio_prev AS data_inicio_prevista,
           p.data_fim_prev AS data_fim_prevista,
           ${DATA_FIM_EFETIVA_SQL},
           d.nome AS diretoria, a.nome AS area,
           p.gerente_id
    FROM projetos p
    LEFT JOIN diretorias d ON d.id = p.diretoria_id
    LEFT JOIN areas a ON a.id = p.area_id
    WHERE p.ativo = 1
    ORDER BY p.status, p.nome
  `).all() as (Record<string, unknown> & { id: number; gerente_id: number | null })[]

  // tap_versoes e viabilidade já estão em Postgres — busca a versão mais recente
  // (qualquer status) de cada projeto ativo de uma vez só, reaproveitada pelos 4
  // conjuntos de dados abaixo (todosProjetos + os 3 "Detalhe" por status).
  const todosProjetoIds = todosProjetosRaw.map(p => p.id)
  const [gerenteNomes1, tapsLatest, viabsLatest] = await Promise.all([
    UsuariosRepository.findNomesPorIds(todosProjetosRaw.map(p => p.gerente_id).filter((v): v is number => v != null)),
    TapRepository.findLatestPorProjetos(todosProjetoIds),
    ViabilidadeRepository.findLatestPorProjetos(todosProjetoIds),
  ])
  const tapPorProjeto = new Map(tapsLatest.map(t => [t.projeto_id, t]))
  const viabPorProjeto = new Map(viabsLatest.map(v => [v.projeto_id, v]))

  const todosProjetos = todosProjetosRaw.map(p => ({
    ...p,
    gerente_nome: p.gerente_id != null ? gerenteNomes1.get(p.gerente_id)?.nome ?? null : null,
    roi_previsto: tapPorProjeto.get(p.id)?.roi_previsto ?? null,
  }))

  // Detail data for the Viabilidade slide
  const projetosViabilidadeDetalheRaw = db.prepare(`
    SELECT p.id, p.objetivo, p.descricao, p.solicitante_id
    FROM projetos p
    WHERE p.ativo = 1 AND p.status IN ('VIABILIDADE','COMPLEMENTACAO_TAP','APROVACAO')
  `).all() as (Record<string, unknown> & { id: number; solicitante_id: number | null })[]
  const solIds1 = [...new Set(projetosViabilidadeDetalheRaw.map(p => p.solicitante_id).filter((v): v is number => v != null))]
  const solNomes1 = await UsuariosRepository.findNomesPorIds(solIds1)
  const projetosViabilidadeDetalhe = projetosViabilidadeDetalheRaw.map(p => {
    const tap = tapPorProjeto.get(p.id)
    const viab = viabPorProjeto.get(p.id)
    return {
      ...p,
      solicitante_nome: p.solicitante_id != null ? solNomes1.get(p.solicitante_id)?.nome ?? null : null,
      situacao_atual: tap?.situacao_atual ?? null,
      cenario_atual: viab?.impacto_operacional ?? null,
      beneficios_esperados: viab?.beneficios_esperados ?? null,
      riscos_json: viab?.riscos ?? null,
      payback_meses: viab?.payback_meses ?? null,
      capex: viab?.capex ?? null,
      opex: viab?.opex ?? null,
      investimento_total: viab?.investimento_total ?? null,
    }
  })

  // Detail data for the Propostas slide
  const projetosPropostaDetalheRaw = db.prepare(`
    SELECT
      p.id, p.objetivo, p.beneficios, p.descricao,
      p.solicitante_id,
      t.beneficios AS triagem_beneficios,
      t.observacoes AS triagem_observacoes,
      t.areas_impactadas AS triagem_areas_json,
      (SELECT GROUP_CONCAT(a.nome, ', ')
       FROM projeto_areas pa JOIN areas a ON a.id = pa.area_id
       WHERE pa.projeto_id = p.id AND pa.ativo = 1) AS areas_envolvidas
    FROM projetos p
    LEFT JOIN triagens t ON t.projeto_id = p.id
    WHERE p.ativo = 1 AND p.status IN ('PROPOSTA','TRIAGEM','COMITE_IDEIAS')
  `).all() as (Record<string, unknown> & { id: number; solicitante_id: number | null })[]
  const solIds2 = [...new Set(projetosPropostaDetalheRaw.map(p => p.solicitante_id).filter((v): v is number => v != null))]
  const solNomes2 = await UsuariosRepository.findNomesPorIds(solIds2)
  const projetosPropostaDetalhe = projetosPropostaDetalheRaw.map(p => {
    const tap = tapPorProjeto.get(p.id)
    return {
      ...p,
      solicitante_nome: p.solicitante_id != null ? solNomes2.get(p.solicitante_id)?.nome ?? null : null,
      riscos_iniciais: tap?.riscos_iniciais ?? null,
      payback_meses: tap?.payback_meses ?? null,
      beneficios_tap: tap?.beneficios_tap ?? null,
      data_limite_tap: tap?.data_limite_tap ?? null,
    }
  })

  // Detail data for the Em Execução slide
  const projetosExecucaoDetalheRaw = db.prepare(`
    SELECT
      p.id, p.codigo, p.nome,
      d.nome AS diretoria, a.nome AS area,
      p.gerente_id,
      p.data_inicio_prev, p.data_fim_prev,
      p.capex_aprovado AS capex_aprovado_base,
      p.opex_aprovado AS opex_aprovado_base,
      COALESCE(
        (SELECT SUM(fc2.valor_aprovado) FROM financeiro_contratos fc2
         WHERE fc2.projeto_id = p.id AND fc2.ativo = 1), 0
      ) AS total_contratado,
      COALESCE(
        (SELECT SUM(fp2.valor_pago)
         FROM financeiro_pagamentos fp2
         JOIN financeiro_contratos fc3 ON fc3.id = fp2.contrato_id
         WHERE fc3.projeto_id = p.id
           AND fp2.contrato_id IS NOT NULL
           AND (fp2.ativo IS NULL OR fp2.ativo = 1)), 0
      ) AS total_pago,
      COALESCE(
        (SELECT SUM(fp3.valor_pago)
         FROM financeiro_pagamentos fp3
         JOIN financeiro_contratos fc4 ON fc4.id = fp3.contrato_id
         WHERE fc4.projeto_id = p.id
           AND fc4.natureza_financeira = 'CAPEX'
           AND fc4.ativo = 1
           AND fp3.contrato_id IS NOT NULL
           AND (fp3.ativo IS NULL OR fp3.ativo = 1)), 0
      ) AS capex_executado,
      COALESCE(
        (SELECT SUM(fp4.valor_pago)
         FROM financeiro_pagamentos fp4
         JOIN financeiro_contratos fc5 ON fc5.id = fp4.contrato_id
         WHERE fc5.projeto_id = p.id
           AND fc5.natureza_financeira = 'OPEX'
           AND fc5.ativo = 1
           AND fp4.contrato_id IS NOT NULL
           AND (fp4.ativo IS NULL OR fp4.ativo = 1)), 0
      ) AS opex_executado
    FROM projetos p
    LEFT JOIN diretorias d ON d.id = p.diretoria_id
    LEFT JOIN areas a ON a.id = p.area_id
    WHERE p.ativo = 1 AND p.status IN ('EXECUCAO', 'GOLIVE')
  `).all() as (Record<string, unknown> & {
    id: number; gerente_id: number | null
    capex_aprovado_base: number | null; opex_aprovado_base: number | null
  })[]
  const gerenteIds2 = [...new Set(projetosExecucaoDetalheRaw.map(p => p.gerente_id).filter((v): v is number => v != null))]
  const gerenteNomes2 = await UsuariosRepository.findNomesPorIds(gerenteIds2)
  const projetosExecucaoDetalhe = projetosExecucaoDetalheRaw.map(p => {
    const viab = viabPorProjeto.get(p.id)
    return {
      ...p,
      gerente_nome: p.gerente_id != null ? gerenteNomes2.get(p.gerente_id)?.nome ?? null : null,
      capex_aprovado: viab?.capex ?? p.capex_aprovado_base ?? 0,
      opex_aprovado: viab?.opex ?? p.opex_aprovado_base ?? 0,
      economia_mensal_esperada: viab?.economia_mensal_esperada ?? null,
      payback_informado: viab?.payback_informado ?? null,
      payback_meses: viab?.payback_meses ?? null,
      payback_unidade: viab?.payback_unidade ?? null,
    }
  })

  // Macro tarefas (FASE + TAREFA direta) from latest active cronograma for each EXECUCAO project
  // TAREFA rows are included so SlideExecucaoDetalhe can expand FASEs that have child tasks
  // Mesmo critério de "cronograma vigente" de CronogramaRepository.findCronogramaVigente:
  // ativo, não arquivado, status aprovado/em execução — nunca um RASCUNHO/PENDENTE_APROVACAO.
  const macroTarefasExecucaoRaw = db.prepare(`
    SELECT
      t.id, c.id AS cronograma_id, c.projeto_id, t.nome, t.nivel, t.codigo, t.percentual,
      t.data_inicio, t.data_inicio_baseline, t.data_fim, t.data_fim_baseline, t.data_conclusao,
      t.bloqueio, t.motivo_bloqueio, t.motivo_atraso, t.criticidade,
      t.observacoes, t.prazo_status, t.ordem, t.status,
      t.responsavel_id, t.responsavel_nome_ext
    FROM cronograma_tarefas t
    JOIN cronogramas c ON c.id = t.cronograma_id
    WHERE (c.ativo IS NULL OR c.ativo = 1)
      AND (c.arquivado IS NULL OR c.arquivado = 0)
      AND c.status IN ('APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO', 'ENCERRADO')
      AND t.nivel IN ('FASE', 'TAREFA')
      AND (t.ativo IS NULL OR t.ativo = 1)
      AND c.versao = (
        SELECT MAX(c2.versao) FROM cronogramas c2
        WHERE c2.projeto_id = c.projeto_id
          AND (c2.ativo IS NULL OR c2.ativo = 1)
          AND (c2.arquivado IS NULL OR c2.arquivado = 0)
          AND c2.status IN ('APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO', 'ENCERRADO')
      )
      AND c.projeto_id IN (
        SELECT id FROM projetos WHERE ativo = 1 AND status IN ('EXECUCAO', 'GOLIVE')
      )
    ORDER BY t.ordem, t.id
  `).all() as (Record<string, unknown> & { responsavel_id: number | null; responsavel_nome_ext: string | null })[]
  const macroNomeIds = [...new Set(macroTarefasExecucaoRaw.map(t => t.responsavel_id).filter((v): v is number => v != null))]
  const macroNomes = await UsuariosRepository.findNomesPorIds(macroNomeIds)
  const macroTarefasExecucao = macroTarefasExecucaoRaw.map(t => ({
    ...t,
    responsavel_nome: (t.responsavel_id != null ? macroNomes.get(t.responsavel_id)?.nome : undefined) ?? t.responsavel_nome_ext,
  }))

  const usuarios = await asyncDb.queryMany(`SELECT id, nome, cargo FROM "AI"."TI_PMO_USUARIOS" WHERE ativo = true ORDER BY nome`)
  const diretorias = db.prepare("SELECT id, nome FROM diretorias WHERE ativo = 1 ORDER BY ordem, nome").all()
  const projetosLista = db.prepare("SELECT id, codigo, nome FROM projetos WHERE ativo = 1 ORDER BY nome").all()

  // ── TI: atividades DEV2026 com prioridades do DB ─────────────────────────────
  const tiPrioridades = db.prepare('SELECT * FROM ti_prioridades WHERE fonte = ?').all('dev2026') as any[]
  const tiPrioMap = new Map<number, any>(tiPrioridades.map((p: any) => [p.atividade_id, p]))

  const dev2026ComPrio = DEV2026_ATIVIDADES.map(a => {
    const dbPrio = tiPrioMap.get(a.id)
    return {
      ...a,
      prioridade: (dbPrio && dbPrio.prioridade !== null) ? dbPrio.prioridade : a.prioridade,
      prioridade_db_id: dbPrio?.id ?? null,
      prioridade_confirmada: dbPrio?.confirmada === 1,
      confirmada_por_nome: dbPrio?.confirmada_por_nome ?? null,
      confirmada_comite_id: dbPrio?.confirmada_comite_id ?? null,
      solicitacao_alteracao: dbPrio?.solicitacao_alteracao === 1,
      solicitacao_nova_prioridade: dbPrio?.solicitacao_nova_prioridade ?? null,
      solicitacao_motivo: dbPrio?.solicitacao_motivo ?? null,
    }
  })

  // TI em Desenvolvimento: itens em dev, validação, treinamento, acompanhamento
  const tiEmDesenvolvimento = dev2026ComPrio.filter(a => {
    if (a.progresso === 'Concluído' || a.progresso === 'Não iniciado') return false
    return true
  })

  // TI Aguardando Prioridade: itens Não iniciados sem prioridade definida (prioridade = '')
  const tiAguardandoPrioridade = dev2026ComPrio.filter(a =>
    a.progresso === 'Não iniciado' && a.prioridade === ''
  )

  // Tarefas de TI dos cronogramas (para slide TI em Desenvolvimento). usuarios já está em
  // Postgres — resolve primeiro quem bate com esses nomes lá, depois filtra
  // cronograma_tarefas (SQLite) por id ou pelo nome externo (fallback).
  const tiUsuariosFiltro = await asyncDb.queryMany<{ id: number; nome: string }>(
    `SELECT id, nome FROM "AI"."TI_PMO_USUARIOS" WHERE ativo = true AND (
       LOWER(nome) LIKE '%michel%' OR LOWER(nome) LIKE '%divonzi%'
       OR LOWER(nome) LIKE '%plinio%' OR LOWER(nome) LIKE '%plínio%'
     )`
  )
  const tiNomesPorId = new Map(tiUsuariosFiltro.map(u => [u.id, u.nome]))
  const tiIdsFiltro = tiUsuariosFiltro.map(u => u.id)
  const tiIdsPlaceholder = tiIdsFiltro.length ? tiIdsFiltro.map(() => '?').join(',') : '-1'

  const tiTarefasCronogramaRaw = db.prepare(`
    SELECT
      t.id, t.nome, t.percentual, t.data_inicio, t.data_fim, t.data_conclusao,
      t.observacoes, t.prazo_status, t.responsavel_id, t.responsavel_nome_ext,
      p.codigo AS projeto_codigo, p.nome AS projeto_nome,
      c.id AS cronograma_id, c.projeto_id
    FROM cronograma_tarefas t
    JOIN cronogramas c ON c.id = t.cronograma_id
    JOIN projetos p ON p.id = c.projeto_id
    WHERE (t.ativo IS NULL OR t.ativo = 1)
      AND (c.ativo IS NULL OR c.ativo = 1)
      AND p.ativo = 1
      AND t.percentual > 0 AND t.percentual < 100
      AND c.versao = (
        SELECT MAX(c2.versao) FROM cronogramas c2
        WHERE c2.projeto_id = c.projeto_id AND (c2.ativo IS NULL OR c2.ativo = 1)
      )
      AND (
        t.responsavel_id IN (${tiIdsPlaceholder})
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%michel%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%divonzi%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plinio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plínio%'
      )
    ORDER BY p.nome, t.data_inicio
  `).all(...tiIdsFiltro) as (Record<string, unknown> & { responsavel_id: number | null; responsavel_nome_ext: string | null })[]

  const tiTarefasCronograma = tiTarefasCronogramaRaw.map(t => ({
    ...t,
    analista: (t.responsavel_id != null ? tiNomesPorId.get(t.responsavel_id) : undefined) ?? t.responsavel_nome_ext,
  }))

  // Previous comitês for history
  const historico = db.prepare(`
    SELECT id, titulo, tipo, data_realizacao, status,
           (SELECT COUNT(*) FROM comite_projetos WHERE comite_id = c.id) AS num_projetos
    FROM comites c
    WHERE id != ? AND status = 'REALIZADO'
    ORDER BY data_realizacao DESC LIMIT 10
  `).all(comiteId)

  return (
    <ComiteDetalheClient
      comite={comite as any}
      participantes={participantes as any}
      comiteProjetos={comiteProjetos as any}
      decisoes={decisoes as any}
      pendencias={pendencias as any}
      ata={ata as any}
      ataHistorico={ataHistorico as any}
      todosProjetos={todosProjetos as any}
      projetosViabilidadeDetalhe={projetosViabilidadeDetalhe as any}
      projetosPropostaDetalhe={projetosPropostaDetalhe as any}
      projetosExecucaoDetalhe={projetosExecucaoDetalhe as any}
      macroTarefasExecucao={macroTarefasExecucao as any}
      usuarios={usuarios as any}
      diretorias={diretorias as any}
      projetosLista={projetosLista as any}
      historico={historico as any}
      tiEmDesenvolvimento={tiEmDesenvolvimento as any}
      tiAguardandoPrioridade={tiAguardandoPrioridade as any}
      tiTarefasCronograma={tiTarefasCronograma as any}
      comiteId={comiteId}
      session={session}
    />
  )
}
