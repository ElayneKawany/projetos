import { db } from '@/lib/database'
import type { Projeto, StatusProjeto, Prioridade } from '@/types'

export interface ProjetoFiltros {
  status?: string
  diretoria_id?: number
  prioridade?: string
  busca?: string
  usuario_id?: number
  perfil?: string
  limit?: number
  offset?: number
}

// Fonte única de "prazo efetivo" do projeto, reaproveitada por toda tela que precise de
// prazo/atraso (Dashboard, listagem/detalhe de Projetos, Comitê, Timeline...):
//   - Uma vez que a Data Base de Entrega existe (travada na 1ª aprovação de Cronograma —
//     ver ProjetosRepository.capturarDataBaseEntrega), ela É a resposta: imutável, nunca
//     recalculada a partir do cronograma vigente, nunca afetada por reprogramação ou nova
//     versão.
//   - Antes disso (Proposta/Ideia, Estudo de Viabilidade, Estruturação), usa a "Data limite"
//     cadastrada para a macro fase atual do projeto (projeto_fase_prazo) — sem cair para
//     data_fim_prev nem para o cronograma.
const DATA_FIM_EFETIVA_EXPR = `
  CASE
    WHEN p.data_base_entrega IS NOT NULL THEN p.data_base_entrega
    ELSE (SELECT pfp.data_limite FROM projeto_fase_prazo pfp WHERE pfp.projeto_id = p.id AND pfp.status = p.status)
  END`
export const DATA_FIM_EFETIVA_SQL = `${DATA_FIM_EFETIVA_EXPR} AS data_fim_efetiva`

export const ProjetosRepository = {
  // ── Leitura simples ───────────────────────────────────────────────────────

  findById(id: number): Projeto | undefined {
    return db.queryOne<Projeto>(
      `SELECT p.*,
              d.nome AS diretoria_nome, a.nome AS area_nome,
              u.nome AS gerente_nome, sol.nome AS solicitante_nome
       FROM projetos p
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       LEFT JOIN areas a ON a.id = p.area_id
       LEFT JOIN usuarios u ON u.id = p.gerente_id
       LEFT JOIN usuarios sol ON sol.id = p.solicitante_id
       WHERE p.id = ? AND p.ativo = 1`,
      [id]
    )
  },

  /** Full query com DATA_FIM_EFETIVA_SQL e todos os JOINs — usado por buscarProjetoPorId */
  findByIdComplexo(id: number): Projeto | null {
    return db.queryOne<Projeto>(
      `SELECT p.*,
              us.nome  as solicitante_nome,
              d.nome   as diretoria_nome,
              a.nome   as area_nome,
              g.nome   as gerente_nome,
              mp.nome  as motivo_pausa_nome,
              pmo.nome as pmo_responsavel_nome,
              ${DATA_FIM_EFETIVA_SQL}
       FROM projetos p
       LEFT JOIN usuarios us  ON p.solicitante_id    = us.id
       LEFT JOIN diretorias d ON p.diretoria_id       = d.id
       LEFT JOIN areas a      ON p.area_id            = a.id
       LEFT JOIN usuarios g   ON p.gerente_id         = g.id
       LEFT JOIN config_motivos_pausa mp ON p.motivo_pausa_id = mp.id
       LEFT JOIN usuarios pmo ON p.pmo_responsavel_id = pmo.id
       WHERE p.id = ? AND p.ativo = 1`,
      [id]
    ) ?? null
  },

  findByCodigo(codigo: string): Projeto | undefined {
    return db.queryOne<Projeto>(
      `SELECT p.*, d.nome AS diretoria_nome, a.nome AS area_nome
       FROM projetos p
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       LEFT JOIN areas a ON a.id = p.area_id
       WHERE p.codigo = ? AND p.ativo = 1`,
      [codigo]
    )
  },

  findAll(filtros: ProjetoFiltros = {}): Projeto[] {
    const conditions: string[] = ['p.ativo = 1']
    const params: unknown[] = []

    if (filtros.status) { conditions.push('p.status = ?'); params.push(filtros.status) }
    if (filtros.diretoria_id) { conditions.push('p.diretoria_id = ?'); params.push(filtros.diretoria_id) }
    if (filtros.prioridade) { conditions.push('p.prioridade = ?'); params.push(filtros.prioridade) }
    if (filtros.busca) {
      conditions.push('(p.nome LIKE ? OR p.codigo LIKE ?)')
      params.push(`%${filtros.busca}%`, `%${filtros.busca}%`)
    }

    const where = conditions.join(' AND ')
    const limit = filtros.limit ? `LIMIT ${filtros.limit}` : ''
    const offset = filtros.offset ? `OFFSET ${filtros.offset}` : ''

    return db.queryMany<Projeto>(
      `SELECT p.*, d.nome AS diretoria_nome, a.nome AS area_nome,
              u.nome AS gerente_nome
       FROM projetos p
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       LEFT JOIN areas a ON a.id = p.area_id
       LEFT JOIN usuarios u ON u.id = p.gerente_id
       WHERE ${where}
       ORDER BY p.updated_at DESC
       ${limit} ${offset}`,
      params
    )
  },

  /** Usado por buscarProjetos — full query com named params para visibilidade */
  findAllComplexo(
    conditions: string[],
    namedParams: Record<string, unknown>,
    limit: number,
    offset: number
  ): Projeto[] {
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return db.queryMany<Projeto>(
      `SELECT p.*,
              us.nome  as solicitante_nome,
              d.nome   as diretoria_nome,
              a.nome   as area_nome,
              g.nome   as gerente_nome,
              mp.nome  as motivo_pausa_nome,
              pmo.nome as pmo_responsavel_nome,
              CASE WHEN EXISTS (SELECT 1 FROM cronogramas c WHERE c.projeto_id = p.id AND c.ativo = 1 AND c.status = 'APROVADO') THEN 1 ELSE 0 END AS has_cronograma,
              CASE WHEN EXISTS (
                SELECT 1 FROM aprovacoes apr
                WHERE apr.projeto_id = p.id AND apr.status = 'REJEITADO'
                AND (
                  (apr.tipo = 'TAP'         AND EXISTS (SELECT 1 FROM tap_versoes tv WHERE tv.id = apr.referencia_id AND tv.status = 'RASCUNHO'))
                  OR (apr.tipo = 'VIABILIDADE' AND EXISTS (SELECT 1 FROM viabilidade v  WHERE v.id  = apr.referencia_id AND v.status  = 'RASCUNHO'))
                  OR (apr.tipo = 'CRONOGRAMA'  AND EXISTS (SELECT 1 FROM cronogramas cr WHERE cr.id = apr.referencia_id AND cr.status = 'RASCUNHO'))
                )
              ) THEN 1 ELSE 0 END AS tem_revisao_pendente,
              (SELECT COUNT(*) FROM cronograma_tarefas ct
               JOIN cronogramas c ON ct.cronograma_id = c.id
               WHERE c.projeto_id = p.id AND c.ativo = 1 AND c.status = 'APROVADO'
               AND ct.percentual < 100 AND ct.data_fim IS NOT NULL AND ct.data_fim < date('now')) AS tarefas_atrasadas,
              ${DATA_FIM_EFETIVA_SQL}
       FROM projetos p
       LEFT JOIN usuarios us  ON p.solicitante_id    = us.id
       LEFT JOIN diretorias d ON p.diretoria_id       = d.id
       LEFT JOIN areas a      ON p.area_id            = a.id
       LEFT JOIN usuarios g   ON p.gerente_id         = g.id
       LEFT JOIN config_motivos_pausa mp ON p.motivo_pausa_id = mp.id
       LEFT JOIN usuarios pmo ON p.pmo_responsavel_id = pmo.id
       ${where}
       ORDER BY
         CASE p.prioridade WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
         p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      namedParams
    )
  },

  // ── Criação ───────────────────────────────────────────────────────────────

  create(dados: Partial<Projeto>): number | bigint {
    const result = db.execute(
      `INSERT INTO projetos
         (codigo, nome, descricao, objetivo, beneficios, status, prioridade, complexidade,
          diretoria_id, area_id, gerente_id, solicitante_id,
          data_inicio_prev, data_fim_prev, capex_aprovado, opex_aprovado, ativo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        dados.codigo, dados.nome, dados.descricao ?? null, dados.objetivo ?? null,
        dados.beneficios ?? null, dados.status ?? 'PROPOSTA', dados.prioridade ?? 'MEDIA',
        dados.complexidade ?? null, dados.diretoria_id ?? null, dados.area_id ?? null,
        dados.gerente_id ?? null, dados.solicitante_id ?? null,
        dados.data_inicio_prev ?? null, dados.data_fim_prev ?? null,
        dados.capex_aprovado ?? 0, dados.opex_aprovado ?? 0,
      ]
    )
    return result.lastInsertRowid
  },

  /** INSERT completo — inclui ponto_focal, contato, justificativa, created_by, etc. */
  insertProjeto(dados: {
    codigo: string
    nome: string
    solicitante_id: number
    diretoria_id: number
    area_id: number
    ponto_focal?: string | null
    contato?: string | null
    objetivo: string
    justificativa?: string | null
    descricao?: string | null
    beneficios?: string | null
    status: string
    classificacao?: string | null
    prioridade: string
    gerente_id?: number | null
    created_by: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO projetos
        (codigo, nome, solicitante_id, diretoria_id, area_id, ponto_focal, contato,
         objetivo, justificativa, descricao, beneficios, status, classificacao, prioridade,
         gerente_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.codigo, dados.nome, dados.solicitante_id, dados.diretoria_id, dados.area_id,
        dados.ponto_focal ?? null, dados.contato ?? null, dados.objetivo,
        dados.justificativa ?? null, dados.descricao ?? null, dados.beneficios ?? null,
        dados.status, dados.classificacao ?? null, dados.prioridade,
        dados.gerente_id ?? null, dados.created_by,
      ]
    )
    return result.lastInsertRowid
  },

  /** Insere o TAP V1 automático gerado na criação do projeto */
  insertTapV1(params: {
    projeto_id: number
    criado_por: number
    objetivo_detalhado: string
    nome_projeto: string
  }): void {
    db.execute(
      `INSERT INTO tap_versoes
        (projeto_id, versao, label, fase_origem, status, criado_por,
         escopo_inicial, escopo_fisico, escopo_sistemico, escopo_processo,
         objetivo_detalhado, situacao_atual, etapas_projeto, setores_envolvidos)
       VALUES (?,1,'TAP V1','PROPOSTA','RASCUNHO',?,?,?,?,?,?,?,?,?)`,
      [
        params.projeto_id,
        params.criado_por,
        `Escopo inicial do projeto "${params.nome_projeto}": a ser detalhado pelo gestor.`,
        `Descreva aqui os limites físicos e geográficos do projeto "${params.nome_projeto}".`,
        `Liste os sistemas que serão afetados ou integrados no projeto "${params.nome_projeto}".`,
        `Descreva os processos de negócio impactados pelo projeto "${params.nome_projeto}".`,
        params.objetivo_detalhado,
        'A ser preenchido pelo gestor',
        '[]',
        '[]',
      ]
    )
  },

  // ── Atualização ───────────────────────────────────────────────────────────

  update(id: number, dados: Partial<Projeto>): void {
    const sets: string[] = []
    const params: unknown[] = []

    const campos = [
      'nome', 'descricao', 'objetivo', 'beneficios', 'justificativa',
      'prioridade', 'complexidade', 'classificacao',
      'diretoria_id', 'area_id', 'gerente_id', 'solicitante_id',
      'pmo_responsavel_id', 'ponto_focal', 'contato',
      'data_inicio_prev', 'data_fim_prev', 'capex_aprovado', 'opex_aprovado',
    ] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push((dados as Record<string, unknown>)[campo]) }
    }
    if (!sets.length) return

    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    db.execute(`UPDATE projetos SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  updateStatus(id: number, status: StatusProjeto): void {
    db.execute(
      'UPDATE projetos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    )
  },

  updatePrioridade(id: number, prioridade: Prioridade): void {
    db.execute(
      'UPDATE projetos SET prioridade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [prioridade, id]
    )
  },

  updateParaConcluido(id: number, dados: {
    data_conclusao_real: string
    hora_conclusao: string
    responsavel_conclusao: string
    motivo_conclusao: string
    checklist_conclusao: string
  }): void {
    db.execute(
      `UPDATE projetos SET
         status                = 'PROJETO_CONCLUIDO',
         data_conclusao_real   = ?,
         hora_conclusao        = ?,
         responsavel_conclusao = ?,
         motivo_conclusao      = ?,
         checklist_conclusao   = ?,
         updated_at            = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        dados.data_conclusao_real, dados.hora_conclusao,
        dados.responsavel_conclusao, dados.motivo_conclusao,
        dados.checklist_conclusao, id,
      ]
    )
  },

  softDelete(id: number): void {
    db.execute(
      'UPDATE projetos SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    )
  },

  // ── Histórico de status ───────────────────────────────────────────────────

  findStatusHistorico(projetoId: number) {
    return db.queryMany(
      'SELECT * FROM projeto_status_historico WHERE projeto_id = ? ORDER BY created_at DESC',
      [projetoId]
    )
  },

  findStatusHistoricoComplexo(projetoId: number) {
    return db.queryMany(
      `SELECT h.*, u.nome as usuario_nome
       FROM projeto_status_historico h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.projeto_id = ?
       ORDER BY h.created_at DESC`,
      [projetoId]
    )
  },

  insertStatusHistorico(projetoId: number, statusDe: string, statusPara: string, motivo: string | null, usuarioId: number) {
    db.execute(
      'INSERT INTO projeto_status_historico (projeto_id, status_de, status_para, motivo, usuario_id) VALUES (?,?,?,?,?)',
      [projetoId, statusDe, statusPara, motivo, usuarioId]
    )
  },

  // ── Histórico de prioridade ───────────────────────────────────────────────

  findHistoricoPrioridade(projetoId: number) {
    return db.queryMany(
      `SELECT h.*, u.nome as usuario_nome
       FROM projeto_prioridade_historico h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.projeto_id = ?
       ORDER BY h.created_at DESC`,
      [projetoId]
    )
  },

  insertPrioridadeHistorico(params: {
    projeto_id: number
    prioridade_de: string
    prioridade_para: string
    motivo?: string | null
    usuario_id: number
  }): void {
    db.execute(
      'INSERT INTO projeto_prioridade_historico (projeto_id, prioridade_de, prioridade_para, motivo, usuario_id) VALUES (?,?,?,?,?)',
      [params.projeto_id, params.prioridade_de, params.prioridade_para, params.motivo ?? null, params.usuario_id]
    )
  },

  // ── Histórico de alterações de campos ─────────────────────────────────────

  insertHistoricoAlteracao(params: {
    projeto_id: number
    usuario_id: number
    usuario_nome?: string | null
    campo: string
    valor_anterior?: string | null
    valor_novo?: string | null
    acao?: string
  }): void {
    db.execute(
      `INSERT INTO projeto_historico_alteracoes
        (projeto_id, usuario_id, usuario_nome, campo, valor_anterior, valor_novo, acao)
       VALUES (?,?,?,?,?,?,?)`,
      [
        params.projeto_id, params.usuario_id, params.usuario_nome ?? null,
        params.campo, params.valor_anterior ?? null, params.valor_novo ?? null,
        params.acao ?? 'UPDATE',
      ]
    )
  },

  findHistoricoAlteracoes(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      'SELECT * FROM projeto_historico_alteracoes WHERE projeto_id = ? ORDER BY created_at DESC',
      [projetoId]
    )
  },

  // ── Código sequencial ─────────────────────────────────────────────────────

  nextCodigo(): string {
    const ano = new Date().getFullYear()
    const row = db.queryOne<{ codigo: string }>(
      `SELECT codigo FROM projetos WHERE codigo LIKE 'PRJ-${ano}-%' ORDER BY codigo DESC LIMIT 1`
    )
    const seq = row ? parseInt(row.codigo.split('-')[2]) + 1 : 1
    return `PRJ-${ano}-${String(seq).padStart(4, '0')}`
  },

  // ── Aprovações e documentos ───────────────────────────────────────────────

  insertAprovacao(params: {
    projeto_id: number
    tipo: string
    referencia_id: number | bigint
    referencia_tipo: string
    status: string
    solicitante_id: number
    observacao_req?: string
  }): void {
    db.execute(
      `INSERT INTO aprovacoes
        (projeto_id, tipo, referencia_id, referencia_tipo, status, solicitante_id, observacao_req)
       VALUES (?,?,?,?,?,?,?)`,
      [
        params.projeto_id, params.tipo, params.referencia_id,
        params.referencia_tipo, params.status, params.solicitante_id,
        params.observacao_req ?? null,
      ]
    )
  },

  insertDocumento(params: {
    projeto_id: number
    tipo: string
    titulo: string
    versao?: number
    status?: string
    gerado_auto?: number
    criado_por: number
  }): void {
    db.execute(
      `INSERT INTO documentos
        (projeto_id, tipo, titulo, versao, status, gerado_auto, criado_por)
       VALUES (?,?,?,?,?,?,?)`,
      [
        params.projeto_id, params.tipo, params.titulo,
        params.versao ?? 1, params.status ?? 'EM_APROVACAO',
        params.gerado_auto ?? 0, params.criado_por,
      ]
    )
  },

  insertViabilidadeRascunho(projeto_id: number, usuario_id: number): number | bigint {
    const result = db.execute(
      `INSERT INTO viabilidade
        (projeto_id, versao, status, criado_por, resumo_executivo, recomendacao)
       VALUES (?,1,'RASCUNHO',?,?,NULL)`,
      [projeto_id, usuario_id, 'A preencher: Descreva o objetivo e benefícios esperados do projeto.']
    )
    return result.lastInsertRowid
  },

  updateAprovacao(params: {
    referencia_id: number | bigint
    tipo: string
    novo_status: string
    aprovador_id?: number
    observacao?: string
  }): void {
    if (params.aprovador_id !== undefined) {
      db.execute(
        `UPDATE aprovacoes SET status = ?, aprovador_id = ?, aprovado_em = datetime('now'), observacao_apr = ?
         WHERE referencia_id = ? AND tipo = ? AND status = 'PENDENTE'`,
        [params.novo_status, params.aprovador_id, params.observacao ?? null, params.referencia_id, params.tipo]
      )
    } else {
      db.execute(
        `UPDATE aprovacoes SET status = ?, observacao_apr = ?
         WHERE referencia_id = ? AND tipo = ? AND status = 'PENDENTE'`,
        [params.novo_status, params.observacao ?? null, params.referencia_id, params.tipo]
      )
    }
  },

  // ── Helpers para concluirProjeto ──────────────────────────────────────────

  findNomeUsuario(id: number): string | undefined {
    return db.queryOne<{ nome: string }>('SELECT nome FROM usuarios WHERE id = ?', [id])?.nome
  },

  findCronogramaLatest(projeto_id: number): { id: number; status: string } | undefined {
    return db.queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM cronogramas WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1',
      [projeto_id]
    )
  },

  findCronogramaAprovado(projeto_id: number): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      `SELECT id FROM cronogramas WHERE projeto_id = ? AND status = 'APROVADO' AND (ativo IS NULL OR ativo = 1) ORDER BY versao DESC LIMIT 1`,
      [projeto_id]
    )
  },

  findCronogramaAtivo(projeto_id: number): { id: number; versao: number } | undefined {
    return db.queryOne<{ id: number; versao: number }>(
      `SELECT id, versao FROM cronogramas WHERE projeto_id = ? AND (ativo IS NULL OR ativo = 1) ORDER BY versao DESC LIMIT 1`,
      [projeto_id]
    )
  },

  updateCronogramaStatus(cronograma_id: number, status: string): void {
    db.execute('UPDATE cronogramas SET status = ? WHERE id = ?', [status, cronograma_id])
  },

  countTarefasNivel(cronograma_id: number, nivel: string): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM cronograma_tarefas WHERE cronograma_id = ? AND nivel = ? AND (ativo IS NULL OR ativo = 1)`,
      [cronograma_id, nivel]
    )
    return row?.total ?? 0
  },

  countTarefasConcluidasNivel(cronograma_id: number, nivel: string): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM cronograma_tarefas WHERE cronograma_id = ? AND nivel = ? AND data_conclusao IS NOT NULL AND (ativo IS NULL OR ativo = 1)`,
      [cronograma_id, nivel]
    )
    return row?.total ?? 0
  },

  findTapAprovado(projeto_id: number): { roi_previsto: number | null } | undefined {
    return db.queryOne<{ roi_previsto: number | null }>(
      `SELECT roi_previsto FROM tap_versoes WHERE projeto_id = ? AND status = 'APROVADO' ORDER BY versao DESC LIMIT 1`,
      [projeto_id]
    )
  },

  calcCapexExecutado(projeto_id: number): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(fp.valor_pago),0) AS total
       FROM financeiro_pagamentos fp
       JOIN financeiro_contratos fc ON fp.contrato_id = fc.id
       WHERE fc.projeto_id = ? AND COALESCE(fc.natureza_financeira,'CAPEX') = 'CAPEX'
         AND fp.contrato_id IS NOT NULL AND (fp.ativo IS NULL OR fp.ativo = 1)`,
      [projeto_id]
    )
    return row?.total ?? 0
  },

  calcOpexExecutado(projeto_id: number): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(fp.valor_pago),0) AS total
       FROM financeiro_pagamentos fp
       JOIN financeiro_contratos fc ON fp.contrato_id = fc.id
       WHERE fc.projeto_id = ? AND COALESCE(fc.natureza_financeira,'CAPEX') = 'OPEX'
         AND fp.contrato_id IS NOT NULL AND (fp.ativo IS NULL OR fp.ativo = 1)`,
      [projeto_id]
    )
    return row?.total ?? 0
  },

  findDataFimCronograma(cronograma_id: number): string | null {
    const row = db.queryOne<{ data_fim_prev: string | null }>(
      'SELECT MAX(data_fim) AS data_fim_prev FROM cronograma_tarefas WHERE cronograma_id = ?',
      [cronograma_id]
    )
    return row?.data_fim_prev ?? null
  },

  /**
   * Trava a Data Base de Entrega do projeto — só grava se ainda não existir
   * (WHERE data_base_entrega IS NULL). Chamado uma única vez, na aprovação do
   * PRIMEIRO cronograma do projeto (ver rota .../cronograma/[id]/aprovar).
   * Depois de travada, nenhuma nova versão ou reprogramação a altera —
   * é a referência de atraso do projeto para o resto da vida dele.
   */
  capturarDataBaseEntrega(projetoId: number, cronogramaId: number): void {
    db.execute(
      `UPDATE projetos
       SET data_base_entrega = (
         SELECT MAX(data_fim) FROM cronograma_tarefas
         WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = 1)
       ),
       data_base_entrega_definida_em = datetime('now')
       WHERE id = ? AND data_base_entrega IS NULL`,
      [cronogramaId, projetoId]
    )
  },

  insertSnapshotFinal(params: {
    projeto_id: number
    roi_previsto: number | null
    capex_previsto: number | null
    capex_executado: number
    opex_previsto: number | null
    opex_executado: number
    economia_prevista: number | null
    data_fim_prev: string | null
    data_conclusao_real: string
    dias_desvio: number | null
    responsavel: string
  }): void {
    db.execute(
      `INSERT OR IGNORE INTO projeto_snapshot_final
        (projeto_id, roi_previsto, roi_atual, capex_previsto, capex_executado,
         opex_previsto, opex_executado, economia_prevista, economia_realizada,
         data_fim_prev, data_conclusao_real, dias_desvio, responsavel)
       VALUES (?,?,NULL,?,?,?,?,?,NULL,?,?,?,?)`,
      [
        params.projeto_id, params.roi_previsto,
        params.capex_previsto, params.capex_executado,
        params.opex_previsto, params.opex_executado,
        params.economia_prevista,
        params.data_fim_prev, params.data_conclusao_real,
        params.dias_desvio, params.responsavel,
      ]
    )
  },

  // ── Dashboard PMO ─────────────────────────────────────────────────────────

  fetchDashboard(hoje: string) {
    const totalProjetos = (db.queryOne<{ total: number }>('SELECT COUNT(*) as total FROM projetos WHERE ativo=1') as { total: number }).total
    const projetosAtivos = (db.queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM projetos WHERE ativo=1 AND status NOT IN ('ENCERRAMENTO','CANCELADO','SUSPENSO')`) as { total: number }).total
    const aprovacoesPendentes = (db.queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM aprovacoes WHERE status='PENDENTE'`) as { total: number }).total
    const porStatus = db.queryMany(`SELECT status, COUNT(*) as total FROM projetos WHERE ativo=1 GROUP BY status`)
    const porPrioridade = db.queryMany(`SELECT prioridade, COUNT(*) as total FROM projetos WHERE ativo=1 GROUP BY prioridade`)
    const investimentoTotal = (db.queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(COALESCE(v.capex, 0) + COALESCE(v.opex, 0)), 0) AS total
      FROM projetos p
      LEFT JOIN (
        SELECT projeto_id, capex, opex
        FROM viabilidade vi
        WHERE vi.status = 'APROVADO'
          AND vi.versao = (
            SELECT MAX(versao) FROM viabilidade
            WHERE projeto_id = vi.projeto_id AND status = 'APROVADO'
          )
      ) v ON v.projeto_id = p.id
      WHERE p.ativo = 1 AND p.status NOT IN ('CANCELADO')
    `) as { total: number }).total
    const projetosAtrasados = (db.queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM projetos p WHERE p.ativo=1
AND ${DATA_FIM_EFETIVA_EXPR} IS NOT NULL AND ${DATA_FIM_EFETIVA_EXPR} < date('now')
AND p.status NOT IN ('ENCERRAMENTO','CANCELADO','SUSPENSO','GOLIVE','ROI','PROJETO_ENCERRADO','PAYBACK_ENCERRADO')`) as { total: number }).total
    const proximosComites = db.queryMany(`SELECT * FROM comites WHERE status='AGENDADO' AND data_realizacao >= ? ORDER BY data_realizacao LIMIT 5`, [hoje])
    const paybackMedio = (db.queryOne<{ media: number }>(`SELECT COALESCE(AVG(payback_meses),0) as media FROM tap_versoes WHERE payback_meses IS NOT NULL`) as { media: number }).media
    const projetosPausados = (db.queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM projetos WHERE ativo=1 AND status='PAUSADO'`) as { total: number }).total
    const projetosConcluidos = (db.queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM projetos WHERE ativo=1 AND status IN ('PROJETO_CONCLUIDO','PAYBACK_ACOMPANHAMENTO','PAYBACK_ENCERRADO')`) as { total: number }).total
    const projetosEncerrados = (db.queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM projetos WHERE ativo=1 AND status='PROJETO_ENCERRADO'`) as { total: number }).total

    const statusCronRows = db.queryMany<{ sc: string; total: number }>(`
      WITH ps AS (
        SELECT p.id,
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM cronogramas c WHERE c.projeto_id = p.id AND c.ativo = 1 AND c.status = 'APROVADO') THEN 'SEM_CRONOGRAMA'
            WHEN ${DATA_FIM_EFETIVA_EXPR} IS NOT NULL AND ${DATA_FIM_EFETIVA_EXPR} < date('now') THEN 'ATRASADO'
            WHEN (
              EXISTS (
                SELECT 1 FROM cronograma_tarefas ct
                JOIN cronogramas c ON ct.cronograma_id = c.id
                WHERE c.projeto_id = p.id AND c.ativo = 1 AND c.status = 'APROVADO'
                AND ct.percentual < 100 AND ct.data_fim IS NOT NULL AND ct.data_fim < date('now')
              )
              OR (${DATA_FIM_EFETIVA_EXPR} IS NOT NULL AND CAST((julianday(${DATA_FIM_EFETIVA_EXPR}) - julianday('now')) AS INTEGER) <= 10)
            ) THEN 'ATENCAO'
            ELSE 'NO_PRAZO'
          END AS sc
        FROM projetos p
        WHERE p.ativo = 1 AND p.status NOT IN ('CANCELADO','PROJETO_ENCERRADO','PAYBACK_ENCERRADO')
      )
      SELECT sc, COUNT(*) as total FROM ps GROUP BY sc
    `)

    const getStatusCount = (sc: string) => statusCronRows.find(r => r.sc === sc)?.total ?? 0

    const porDiretoriaBase = db.queryMany<{
      diretoria_id: number; diretoria_nome: string; diretoria_sigla: string
      total: number; ativos: number; atrasados: number; pausados: number
      concluidos: number; encerrados: number; investimento_previsto: number; sem_cronograma: number
    }>(`
      SELECT
        d.id   AS diretoria_id,
        d.nome AS diretoria_nome,
        d.sigla AS diretoria_sigla,
        COUNT(p.id) AS total,
        SUM(CASE WHEN p.status NOT IN ('ENCERRAMENTO','CANCELADO','SUSPENSO','PROJETO_ENCERRADO','PAYBACK_ENCERRADO') THEN 1 ELSE 0 END) AS ativos,
        SUM(CASE WHEN ${DATA_FIM_EFETIVA_EXPR} IS NOT NULL AND ${DATA_FIM_EFETIVA_EXPR} < date('now') AND p.status NOT IN ('ENCERRAMENTO','CANCELADO','SUSPENSO','GOLIVE','ROI','PROJETO_ENCERRADO','PAYBACK_ENCERRADO') THEN 1 ELSE 0 END) AS atrasados,
        SUM(CASE WHEN p.status = 'PAUSADO' THEN 1 ELSE 0 END) AS pausados,
        SUM(CASE WHEN p.status IN ('PROJETO_CONCLUIDO','PAYBACK_ACOMPANHAMENTO','PAYBACK_ENCERRADO') THEN 1 ELSE 0 END) AS concluidos,
        SUM(CASE WHEN p.status = 'PROJETO_ENCERRADO' THEN 1 ELSE 0 END) AS encerrados,
        COALESCE(SUM(COALESCE(p.capex_aprovado,0) + COALESCE(p.opex_aprovado,0)), 0) AS investimento_previsto,
        SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM cronogramas c WHERE c.projeto_id = p.id AND c.status = 'APROVADO' AND (c.ativo IS NULL OR c.ativo = 1)) THEN 1 ELSE 0 END) AS sem_cronograma
      FROM diretorias d
      LEFT JOIN projetos p ON p.diretoria_id = d.id AND p.ativo = 1
      WHERE d.ativo = 1
      GROUP BY d.id, d.nome, d.sigla
      HAVING COUNT(p.id) > 0
      ORDER BY total DESC
    `)

    const apPorDir = db.queryMany<{ diretoria_id: number; total: number }>(`
      SELECT p.diretoria_id, COUNT(*) AS total
      FROM aprovacoes a
      JOIN projetos p ON p.id = a.projeto_id
      WHERE a.status = 'PENDENTE' AND p.ativo = 1
      GROUP BY p.diretoria_id
    `)

    const roiPorDir = db.queryMany<{ diretoria_id: number; roi_medio: number }>(`
      SELECT p.diretoria_id, AVG(t.roi_previsto) AS roi_medio
      FROM tap_versoes t
      JOIN projetos p ON p.id = t.projeto_id
      WHERE t.roi_previsto IS NOT NULL AND p.ativo = 1
      GROUP BY p.diretoria_id
    `)

    const invRealizadoPorDir = db.queryMany<{ diretoria_id: number; total: number }>(`
      SELECT p.diretoria_id, COALESCE(SUM(fp.valor_pago), 0) AS total
      FROM financeiro_pagamentos fp
      JOIN projetos p ON p.id = fp.projeto_id
      WHERE p.ativo = 1 AND (fp.ativo IS NULL OR fp.ativo = 1)
      GROUP BY p.diretoria_id
    `)

    const statusPorDirRows = db.queryMany<{ diretoria_id: number; status: string; total: number }>(`
      SELECT diretoria_id, status, COUNT(*) AS total
      FROM projetos
      WHERE ativo = 1 AND diretoria_id IS NOT NULL
      GROUP BY diretoria_id, status
    `)

    const porDiretoria = porDiretoriaBase.map(d => {
      const statusCounts: Record<string, number> = {}
      statusPorDirRows
        .filter(r => r.diretoria_id === d.diretoria_id)
        .forEach(r => { statusCounts[r.status] = r.total })
      return {
        ...d,
        aprovacoes_pendentes: apPorDir.find(r => r.diretoria_id === d.diretoria_id)?.total ?? 0,
        roi_medio: roiPorDir.find(r => r.diretoria_id === d.diretoria_id)?.roi_medio ?? null,
        investimento_realizado: invRealizadoPorDir.find(r => r.diretoria_id === d.diretoria_id)?.total ?? 0,
        status_counts: statusCounts,
      }
    })

    const beneficioRealizado = (db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(beneficio_periodo),0) AS total FROM payback_lancamentos pl JOIN projetos p ON p.id = pl.projeto_id WHERE p.ativo=1'
    ) as { total: number }).total

    return {
      total_projetos: totalProjetos,
      projetos_ativos: projetosAtivos,
      projetos_atrasados: projetosAtrasados,
      aprovacoes_pendentes: aprovacoesPendentes,
      payback_medio: paybackMedio,
      proximos_comites: proximosComites,
      por_status: porStatus,
      por_prioridade: porPrioridade,
      investimento_total: investimentoTotal,
      projetos_no_prazo: getStatusCount('NO_PRAZO'),
      projetos_atencao: getStatusCount('ATENCAO'),
      projetos_atrasados_prazo: getStatusCount('ATRASADO'),
      projetos_sem_cronograma: getStatusCount('SEM_CRONOGRAMA'),
      projetos_pausados: projetosPausados,
      projetos_concluidos: projetosConcluidos,
      projetos_encerrados: projetosEncerrados,
      por_diretoria: porDiretoria,
      beneficio_realizado: beneficioRealizado,
    }
  },
}
