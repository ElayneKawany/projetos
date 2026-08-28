import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
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
  const comite = db.prepare('SELECT c.*, u.nome AS criador_nome FROM comites c LEFT JOIN usuarios u ON u.id = c.created_by WHERE c.id = ?').get(comiteId)
  if (!comite) notFound()

  const participantes = db.prepare(`
    SELECT cp.*, COALESCE(u.nome, cp.nome_externo) AS nome_exibicao, u.cargo AS usuario_cargo
    FROM comite_participantes cp
    LEFT JOIN usuarios u ON u.id = cp.usuario_id
    WHERE cp.comite_id = ? ORDER BY cp.id
  `).all(comiteId)

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
  const todosProjetos = db.prepare(`
    SELECT p.id, p.codigo, p.nome, p.status, p.prioridade, p.complexidade,
           p.capex_aprovado AS investimento,
           p.data_inicio_prev AS data_inicio_prevista,
           p.data_fim_prev AS data_fim_prevista,
           ${DATA_FIM_EFETIVA_SQL},
           d.nome AS diretoria, a.nome AS area,
           u.nome AS gerente_nome,
           (SELECT tv.roi_previsto FROM tap_versoes tv WHERE tv.projeto_id = p.id ORDER BY tv.versao DESC LIMIT 1) AS roi_previsto
    FROM projetos p
    LEFT JOIN diretorias d ON d.id = p.diretoria_id
    LEFT JOIN areas a ON a.id = p.area_id
    LEFT JOIN usuarios u ON u.id = p.gerente_id
    WHERE p.ativo = 1
    ORDER BY p.status, p.nome
  `).all()

  // Detail data for the Viabilidade slide
  const projetosViabilidadeDetalhe = db.prepare(`
    SELECT
      p.id,
      p.objetivo,
      p.descricao,
      sol.nome AS solicitante_nome,
      tv.situacao_atual,
      v.impacto_operacional AS cenario_atual,
      v.beneficios_esperados,
      v.riscos AS riscos_json,
      v.payback_meses,
      v.capex,
      v.opex,
      v.investimento_total
    FROM projetos p
    LEFT JOIN usuarios sol ON sol.id = p.solicitante_id
    LEFT JOIN (
      SELECT tv2.projeto_id, tv2.situacao_atual
      FROM tap_versoes tv2
      WHERE tv2.versao = (SELECT MAX(tv3.versao) FROM tap_versoes tv3 WHERE tv3.projeto_id = tv2.projeto_id)
    ) tv ON tv.projeto_id = p.id
    LEFT JOIN (
      SELECT v2.projeto_id, v2.impacto_operacional, v2.beneficios_esperados, v2.riscos, v2.payback_meses, v2.capex, v2.opex, v2.investimento_total
      FROM viabilidade v2
      WHERE v2.versao = (SELECT MAX(v3.versao) FROM viabilidade v3 WHERE v3.projeto_id = v2.projeto_id)
    ) v ON v.projeto_id = p.id
    WHERE p.ativo = 1 AND p.status IN ('VIABILIDADE','COMPLEMENTACAO_TAP','APROVACAO')
  `).all()

  // Detail data for the Propostas slide
  const projetosPropostaDetalhe = db.prepare(`
    SELECT
      p.id, p.objetivo, p.beneficios, p.descricao,
      sol.nome AS solicitante_nome,
      t.beneficios AS triagem_beneficios,
      t.observacoes AS triagem_observacoes,
      t.areas_impactadas AS triagem_areas_json,
      (SELECT tv.riscos_iniciais FROM tap_versoes tv WHERE tv.projeto_id = p.id ORDER BY tv.versao DESC LIMIT 1) AS riscos_iniciais,
      (SELECT tv.payback_meses FROM tap_versoes tv WHERE tv.projeto_id = p.id ORDER BY tv.versao DESC LIMIT 1) AS payback_meses,
      (SELECT tv.beneficios_tap FROM tap_versoes tv WHERE tv.projeto_id = p.id ORDER BY tv.versao DESC LIMIT 1) AS beneficios_tap,
      (SELECT tv.data_limite_tap FROM tap_versoes tv WHERE tv.projeto_id = p.id ORDER BY tv.versao DESC LIMIT 1) AS data_limite_tap,
      (SELECT GROUP_CONCAT(a.nome, ', ')
       FROM projeto_areas pa JOIN areas a ON a.id = pa.area_id
       WHERE pa.projeto_id = p.id AND pa.ativo = 1) AS areas_envolvidas
    FROM projetos p
    LEFT JOIN usuarios sol ON sol.id = p.solicitante_id
    LEFT JOIN triagens t ON t.projeto_id = p.id
    WHERE p.ativo = 1 AND p.status IN ('PROPOSTA','TRIAGEM','COMITE_IDEIAS')
  `).all()

  // Detail data for the Em Execução slide
  const projetosExecucaoDetalhe = db.prepare(`
    SELECT
      p.id, p.codigo, p.nome,
      d.nome AS diretoria, a.nome AS area,
      u.nome AS gerente_nome,
      p.data_inicio_prev, p.data_fim_prev,
      COALESCE(
        (SELECT v.capex FROM viabilidade v WHERE v.projeto_id = p.id ORDER BY v.versao DESC LIMIT 1),
        p.capex_aprovado,
        0
      ) AS capex_aprovado,
      COALESCE(
        (SELECT v.opex FROM viabilidade v WHERE v.projeto_id = p.id ORDER BY v.versao DESC LIMIT 1),
        p.opex_aprovado,
        0
      ) AS opex_aprovado,
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
      ) AS opex_executado,
      (SELECT v.economia_mensal_esperada FROM viabilidade v WHERE v.projeto_id = p.id ORDER BY v.versao DESC LIMIT 1) AS economia_mensal_esperada,
      (SELECT v.payback_informado FROM viabilidade v WHERE v.projeto_id = p.id ORDER BY v.versao DESC LIMIT 1) AS payback_informado,
      (SELECT v.payback_meses FROM viabilidade v WHERE v.projeto_id = p.id ORDER BY v.versao DESC LIMIT 1) AS payback_meses,
      (SELECT v.payback_unidade FROM viabilidade v WHERE v.projeto_id = p.id ORDER BY v.versao DESC LIMIT 1) AS payback_unidade
    FROM projetos p
    LEFT JOIN diretorias d ON d.id = p.diretoria_id
    LEFT JOIN areas a ON a.id = p.area_id
    LEFT JOIN usuarios u ON u.id = p.gerente_id
    WHERE p.ativo = 1 AND p.status IN ('EXECUCAO', 'GOLIVE')
  `).all()

  // Macro tarefas (FASE + TAREFA direta) from latest active cronograma for each EXECUCAO project
  // TAREFA rows are included so SlideExecucaoDetalhe can expand FASEs that have child tasks
  // Mesmo critério de "cronograma vigente" de CronogramaRepository.findCronogramaVigente:
  // ativo, não arquivado, status aprovado/em execução — nunca um RASCUNHO/PENDENTE_APROVACAO.
  const macroTarefasExecucao = db.prepare(`
    SELECT
      t.id, c.id AS cronograma_id, c.projeto_id, t.nome, t.nivel, t.codigo, t.percentual,
      t.data_inicio, t.data_inicio_baseline, t.data_fim, t.data_fim_baseline, t.data_conclusao,
      t.bloqueio, t.motivo_bloqueio, t.motivo_atraso, t.criticidade,
      t.observacoes, t.prazo_status, t.ordem, t.status,
      COALESCE(u.nome, t.responsavel_nome_ext) AS responsavel_nome
    FROM cronograma_tarefas t
    JOIN cronogramas c ON c.id = t.cronograma_id
    LEFT JOIN usuarios u ON u.id = t.responsavel_id
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
  `).all()

  const usuarios = db.prepare("SELECT id, nome, cargo FROM usuarios WHERE ativo = 1 ORDER BY nome").all()
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

  // Tarefas de TI dos cronogramas (para slide TI em Desenvolvimento)
  const tiTarefasCronograma = db.prepare(`
    SELECT
      t.id, t.nome, t.percentual, t.data_inicio, t.data_fim, t.data_conclusao,
      t.observacoes, t.prazo_status,
      COALESCE(u.nome, t.responsavel_nome_ext) AS analista,
      p.codigo AS projeto_codigo, p.nome AS projeto_nome,
      c.id AS cronograma_id, c.projeto_id
    FROM cronograma_tarefas t
    JOIN cronogramas c ON c.id = t.cronograma_id
    JOIN projetos p ON p.id = c.projeto_id
    LEFT JOIN usuarios u ON u.id = t.responsavel_id
    WHERE (t.ativo IS NULL OR t.ativo = 1)
      AND (c.ativo IS NULL OR c.ativo = 1)
      AND p.ativo = 1
      AND t.percentual > 0 AND t.percentual < 100
      AND c.versao = (
        SELECT MAX(c2.versao) FROM cronogramas c2
        WHERE c2.projeto_id = c.projeto_id AND (c2.ativo IS NULL OR c2.ativo = 1)
      )
      AND (
        LOWER(COALESCE(u.nome, ''))                    LIKE '%michel%'
        OR LOWER(COALESCE(u.nome, ''))                 LIKE '%divonzi%'
        OR LOWER(COALESCE(u.nome, ''))                 LIKE '%plinio%'
        OR LOWER(COALESCE(u.nome, ''))                 LIKE '%plínio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%michel%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%divonzi%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plinio%'
        OR LOWER(COALESCE(t.responsavel_nome_ext, '')) LIKE '%plínio%'
      )
    ORDER BY p.nome, t.data_inicio
  `).all()

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
