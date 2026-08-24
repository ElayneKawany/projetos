import { db } from '@/lib/database'

export interface DistribuicaoMacroFase {
  tipo_macro: string
  total_tarefas: number
  concluidas: number
  atrasadas: number
  percentual_medio: number
}

export interface Cronograma {
  id: number
  projeto_id: number
  versao: number
  label?: string | null
  status: string
  is_baseline?: number
  aprovado_por?: number | null
  aprovado_em?: string | null
  ativo?: number
  created_at?: string
}

export interface CronogramaTarefa {
  id: number
  cronograma_id: number
  parent_id?: number | null
  nivel: number
  ordem: number
  codigo?: string | null
  nome: string
  status?: string | null
  percentual?: number
  prazo_status?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  data_conclusao?: string | null
  bloqueio?: number
  motivo_bloqueio?: string | null
  responsavel_id?: number | null
  responsavel_nome_ext?: string | null
  executor_id?: number | null
  executor_nome_ext?: string | null
  ativo?: number
}

export const CronogramaRepository = {
  findLatestByProjectId(projetoId: number): Cronograma | undefined {
    return db.queryOne<Cronograma>(
      `SELECT c.*, u.nome AS aprovado_nome
       FROM cronogramas c
       LEFT JOIN usuarios u ON u.id = c.aprovado_por
       WHERE c.projeto_id = ? AND (c.ativo IS NULL OR c.ativo = 1)
       ORDER BY c.versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  findById(id: number): Cronograma | undefined {
    return db.queryOne<Cronograma>(
      'SELECT * FROM cronogramas WHERE id = ? AND (ativo IS NULL OR ativo = 1)',
      [id]
    )
  },

  findAllByProjectId(projetoId: number): Cronograma[] {
    return db.queryMany<Cronograma>(
      'SELECT * FROM cronogramas WHERE projeto_id = ? AND (ativo IS NULL OR ativo = 1) ORDER BY versao DESC',
      [projetoId]
    )
  },

  create(dados: Partial<Cronograma>): number | bigint {
    const result = db.execute(
      `INSERT INTO cronogramas (projeto_id, versao, label, status, is_baseline, ativo)
       VALUES (?,?,?,?,?,1)`,
      [
        dados.projeto_id, dados.versao ?? 1, dados.label ?? null,
        dados.status ?? 'RASCUNHO', dados.is_baseline ?? 0,
      ]
    )
    return result.lastInsertRowid
  },

  approve(id: number, aprovadoPor: number): void {
    db.execute(
      "UPDATE cronogramas SET status = 'APROVADO', aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP WHERE id = ?",
      [aprovadoPor, id]
    )
  },

  nextVersao(projetoId: number): number {
    const row = db.queryOne<{ versao: number }>(
      'SELECT MAX(versao) AS versao FROM cronogramas WHERE projeto_id = ?',
      [projetoId]
    )
    return (row?.versao ?? 0) + 1
  },

  // ── Tarefas ────────────────────────────────────────────────────────────────

  findTasks(cronogramaId: number): CronogramaTarefa[] {
    return db.queryMany<CronogramaTarefa>(
      `SELECT t.*,
              COALESCE(u.nome, t.responsavel_nome_ext) AS responsavel_nome,
              COALESCE(e.nome, t.executor_nome_ext) AS executor_nome
       FROM cronograma_tarefas t
       LEFT JOIN usuarios u ON u.id = t.responsavel_id
       LEFT JOIN usuarios e ON e.id = t.executor_id
       WHERE t.cronograma_id = ? AND (t.ativo IS NULL OR t.ativo = 1)
       ORDER BY t.ordem, t.id`,
      [cronogramaId]
    )
  },

  findTaskById(id: number): CronogramaTarefa | undefined {
    return db.queryOne<CronogramaTarefa>(
      'SELECT * FROM cronograma_tarefas WHERE id = ? AND (ativo IS NULL OR ativo = 1)',
      [id]
    )
  },

  updateTask(id: number, dados: Partial<CronogramaTarefa>): void {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = [
      'nome', 'status', 'percentual', 'prazo_status',
      'data_inicio', 'data_fim', 'data_conclusao',
      'bloqueio', 'motivo_bloqueio',
      'responsavel_id', 'responsavel_nome_ext',
      'executor_id', 'executor_nome_ext',
    ] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    db.execute(`UPDATE cronograma_tarefas SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  countTasksByStatus(cronogramaId: number): Record<string, number> {
    const rows = db.queryMany<{ status: string; total: number }>(
      `SELECT status, COUNT(*) AS total FROM cronograma_tarefas
       WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = 1)
       GROUP BY status`,
      [cronogramaId]
    )
    return Object.fromEntries(rows.map(r => [r.status ?? 'NULL', r.total]))
  },

  // ── New methods ────────────────────────────────────────────────────────────

  findAllVersoes(projetoId: number): Array<{ id: number; versao: number; label: string; status: string; is_baseline: number; created_at: string }> {
    return db.queryMany(
      `SELECT id, versao, label, status, is_baseline, created_at
       FROM cronogramas WHERE projeto_id = ? ORDER BY versao DESC`,
      [projetoId]
    )
  },

  findByIdAndProjetoId(id: number, projetoId: number): Cronograma | undefined {
    return db.queryOne<Cronograma>(
      `SELECT c.*, u.nome AS aprovado_nome
       FROM cronogramas c LEFT JOIN usuarios u ON c.aprovado_por = u.id
       WHERE c.id = ? AND c.projeto_id = ?`,
      [id, projetoId]
    )
  },

  findAtivoSimples(projetoId: number): { id: number; versao: number } | undefined {
    return db.queryOne<{ id: number; versao: number }>(
      `SELECT id, versao FROM cronogramas
       WHERE projeto_id = ? AND (ativo = 1 OR ativo IS NULL)
       ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  maxVersao(projetoId: number): number {
    const row = db.queryOne<{ max_v: number | null }>(
      'SELECT MAX(versao) as max_v FROM cronogramas WHERE projeto_id = ?',
      [projetoId]
    )
    return row?.max_v ?? 0
  },

  updateStatus(id: number, status: string): void {
    db.execute(`UPDATE cronogramas SET status = ? WHERE id = ?`, [status, id])
  },

  updateStatusAprovado(id: number, aprovadoPor: number): void {
    db.execute(
      `UPDATE cronogramas SET status = 'APROVADO', is_baseline = 1,
       aprovado_por = ?, aprovado_em = datetime('now') WHERE id = ?`,
      [aprovadoPor, id]
    )
  },

  insertCronograma(params: {
    projeto_id: number
    versao: number
    label: string
    modo?: string
    fonte_importacao?: string
    arquivo_origem?: string | null
    criado_por: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO cronogramas
         (projeto_id, versao, label, modo, fonte_importacao, arquivo_origem, criado_por, status, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RASCUNHO', 1)`,
      [
        params.projeto_id, params.versao, params.label,
        params.modo ?? 'CENTRALIZADO',
        params.fonte_importacao ?? 'MANUAL',
        params.arquivo_origem ?? null,
        params.criado_por,
      ]
    )
    return result.lastInsertRowid
  },

  updateLabelFonte(id: number, label: string, fonte: string, arquivo: string | null): void {
    db.execute(
      `UPDATE cronogramas SET label = ?, fonte_importacao = ?, arquivo_origem = ? WHERE id = ?`,
      [label, fonte, arquivo, id]
    )
  },

  // ── Tarefas ────────────────────────────────────────────────────────────────

  findTarefasOrdered(cronogramaId: number): Record<string, unknown>[] {
    return db.queryMany<Record<string, unknown>>(
      `SELECT * FROM cronograma_tarefas WHERE cronograma_id = ? ORDER BY ordem`,
      [cronogramaId]
    )
  },

  findTarefasComNomes(cronogramaId: number): Record<string, unknown>[] {
    return db.queryMany<Record<string, unknown>>(
      `SELECT ct.codigo, ct.nivel, ct.nome, ct.descricao, ct.tipo, ct.criticidade,
              COALESCE(ct.responsavel_nome_ext, ur.nome) AS responsavel_nome,
              COALESCE(ct.executor_nome_ext,    ue.nome) AS executor_nome,
              ct.data_inicio, ct.data_inicio_baseline, ct.data_fim, ct.data_fim_baseline,
              ct.percentual, ct.status, ct.observacoes, ct.tipo_macro
       FROM cronograma_tarefas ct
       LEFT JOIN usuarios ur ON ct.responsavel_id = ur.id
       LEFT JOIN usuarios ue ON ct.executor_id    = ue.id
       WHERE ct.cronograma_id = ? AND (ct.ativo IS NULL OR ct.ativo = 1)
       ORDER BY ct.ordem`,
      [cronogramaId]
    )
  },

  findTarefasFasesTarefas(cronogramaId: number): Array<{ id: number; nivel: string; nome: string; descricao: string | null; ordem: number }> {
    return db.queryMany(
      `SELECT id, nivel, nome, descricao, ordem
       FROM cronograma_tarefas
       WHERE cronograma_id = ? AND nivel IN ('FASE', 'TAREFA') AND (ativo IS NULL OR ativo = 1)
       ORDER BY ordem`,
      [cronogramaId]
    )
  },

  findTarefaByIdAndCronograma(id: number, cronogramaId: number): Record<string, unknown> | undefined {
    return db.queryOne<Record<string, unknown>>(
      `SELECT * FROM cronograma_tarefas WHERE id = ? AND cronograma_id = ?`,
      [id, cronogramaId]
    )
  },

  findTarefaComNivel(id: number, nivel: string, cronogramaId: number): Record<string, unknown> | undefined {
    return db.queryOne<Record<string, unknown>>(
      `SELECT * FROM cronograma_tarefas WHERE id = ? AND nivel = ? AND cronograma_id = ?`,
      [id, nivel, cronogramaId]
    )
  },

  findIdsAtivos(cronogramaId: number): number[] {
    const rows = db.queryMany<{ id: number }>(
      `SELECT id FROM cronograma_tarefas WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = 1)`,
      [cronogramaId]
    )
    return rows.map(r => r.id)
  },

  insertTarefa(params: {
    cronograma_id: number
    parent_id?: number | null
    codigo?: string | null
    nome: string
    descricao?: string | null
    nivel: string
    tipo?: string | null
    criticidade?: string | null
    data_inicio?: string | null
    data_fim?: string | null
    duracao_dias?: number | null
    responsavel_id?: number | null
    responsavel_nome_ext?: string | null
    executor_id?: number | null
    executor_nome_ext?: string | null
    area_id?: number | null
    peso?: number | null
    ordem: number
    percentual?: number
    status?: string
    prazo_status?: string | null
    data_conclusao?: string | null
    observacoes?: string | null
    tipo_macro?: string | null
    data_fim_baseline?: string | null
    data_inicio_baseline?: string | null
    ativo?: number
    criado_por?: number | null
    alterado_por?: number | null
    natureza_tarefa?: string | null
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO cronograma_tarefas
         (cronograma_id, parent_id, codigo, nome, descricao, nivel, tipo, criticidade,
          data_inicio, data_inicio_baseline, data_fim, data_fim_baseline, duracao_dias,
          responsavel_id, responsavel_nome_ext, executor_id, executor_nome_ext,
          area_id, peso, ordem, percentual, status, prazo_status, data_conclusao,
          observacoes, tipo_macro, ativo, criado_por, alterado_por, alterado_em, natureza_tarefa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      [
        params.cronograma_id,
        params.parent_id ?? null,
        params.codigo ?? null,
        params.nome,
        params.descricao ?? null,
        params.nivel,
        params.tipo ?? 'TAREFA',
        params.criticidade ?? 'NORMAL',
        params.data_inicio ?? null,
        params.data_inicio_baseline ?? null,
        params.data_fim ?? null,
        params.data_fim_baseline ?? null,
        params.duracao_dias ?? null,
        params.responsavel_id ?? null,
        params.responsavel_nome_ext ?? null,
        params.executor_id ?? null,
        params.executor_nome_ext ?? null,
        params.area_id ?? null,
        params.peso ?? 1,
        params.ordem,
        params.percentual ?? 0,
        params.status ?? 'PENDENTE',
        params.prazo_status ?? null,
        params.data_conclusao ?? null,
        params.observacoes ?? null,
        params.tipo_macro ?? null,
        params.ativo ?? 1,
        params.criado_por ?? null,
        params.alterado_por ?? null,
        params.natureza_tarefa ?? 'NORMAL',
      ]
    )
    return result.lastInsertRowid
  },

  updateTarefaCompleta(id: number, cronogramaId: number, params: {
    nome: string; nivel: string; codigo: string; ordem: number; parent_id: number | null
    responsavel_id: number | null; responsavel_nome_ext: string | null
    executor_id: number | null; executor_nome_ext: string | null
    data_inicio: string | null; data_inicio_baseline?: string | null
    data_fim: string | null; data_fim_baseline?: string | null; duracao_dias: number | null
    tipo: string; criticidade: string; observacoes: string | null; descricao: string | null
    tipo_macro: string | null; alterado_por: number
  }): void {
    db.execute(
      `UPDATE cronograma_tarefas
       SET nome = ?, nivel = ?, codigo = ?, ordem = ?, parent_id = ?,
           responsavel_id = ?, responsavel_nome_ext = ?,
           executor_id = ?,   executor_nome_ext = ?,
           data_inicio = ?, data_inicio_baseline = ?, data_fim = ?, data_fim_baseline = ?, duracao_dias = ?,
           tipo = ?, criticidade = ?, observacoes = ?, descricao = ?,
           tipo_macro = ?,
           ativo = 1,
           alterado_por = ?, alterado_em = datetime('now')
       WHERE id = ? AND cronograma_id = ?`,
      [
        params.nome, params.nivel, params.codigo, params.ordem, params.parent_id,
        params.responsavel_id, params.responsavel_nome_ext,
        params.executor_id, params.executor_nome_ext,
        params.data_inicio, params.data_inicio_baseline ?? null,
        params.data_fim, params.data_fim_baseline ?? null, params.duracao_dias,
        params.tipo, params.criticidade, params.observacoes, params.descricao,
        params.tipo_macro, params.alterado_por, id, cronogramaId,
      ]
    )
  },

  softDeleteTarefas(cronogramaId: number): void {
    db.execute(`UPDATE cronograma_tarefas SET ativo = 0 WHERE cronograma_id = ?`, [cronogramaId])
  },

  softDeleteTarefa(id: number, userId: number): void {
    db.execute(
      `UPDATE cronograma_tarefas SET ativo = 0, alterado_por = ?, alterado_em = datetime('now') WHERE id = ?`,
      [userId, id]
    )
  },

  concluirTarefa(id: number, prazoStatus: string, userId: number): void {
    db.execute(
      `UPDATE cronograma_tarefas
       SET data_conclusao = datetime('now'),
           concluido_por  = ?,
           percentual     = 100,
           status         = 'CONCLUIDA',
           prazo_status   = ?,
           alterado_por   = ?,
           alterado_em    = datetime('now')
       WHERE id = ?`,
      [userId, prazoStatus, userId, id]
    )
  },

  atualizarPercentualTarefa(id: number, percentual: number, userId: number): void {
    db.execute(
      `UPDATE cronograma_tarefas
       SET percentual   = ?,
           alterado_por = ?,
           alterado_em  = datetime('now')
       WHERE id = ?`,
      [percentual, userId, id]
    )
  },

  countTarefas(cronogramaId: number): number {
    const row = db.queryOne<{ n: number }>(
      `SELECT COUNT(*) as n FROM cronograma_tarefas WHERE cronograma_id = ?`,
      [cronogramaId]
    )
    return row?.n ?? 0
  },

  countSubtarefas(cronogramaId: number, parentId: number, concluidas: boolean): number {
    const extra = concluidas ? 'AND data_conclusao IS NOT NULL' : ''
    const row = db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM cronograma_tarefas
       WHERE cronograma_id = ? AND parent_id = ? AND nivel = 'SUBTAREFA'
         AND (ativo IS NULL OR ativo = 1) ${extra}`,
      [cronogramaId, parentId]
    )
    return row?.n ?? 0
  },

  countTarefasFase(cronogramaId: number, parentId: number, concluidas: boolean): number {
    const extra = concluidas ? 'AND data_conclusao IS NOT NULL' : ''
    const row = db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM cronograma_tarefas
       WHERE cronograma_id = ? AND parent_id = ? AND nivel = 'TAREFA'
         AND (ativo IS NULL OR ativo = 1) ${extra}`,
      [cronogramaId, parentId]
    )
    return row?.n ?? 0
  },

  countTarefasTotais(cronogramaId: number, concluidas = false): number {
    const extra = concluidas ? 'AND data_conclusao IS NOT NULL' : ''
    const row = db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM cronograma_tarefas
       WHERE cronograma_id = ? AND nivel = 'TAREFA' AND (ativo IS NULL OR ativo = 1) ${extra}`,
      [cronogramaId]
    )
    return row?.n ?? 0
  },

  maxOrdem(cronogramaId: number): number {
    const row = db.queryOne<{ m: number | null }>(
      `SELECT MAX(ordem) as m FROM cronograma_tarefas WHERE cronograma_id = ?`,
      [cronogramaId]
    )
    return row?.m ?? 0
  },

  // ── Responsáveis ──────────────────────────────────────────────────────────

  insertResponsavel(tarefaId: number, uid: number | null, nomeExt: string | null): void {
    db.execute(
      `INSERT INTO cronograma_responsaveis (cronograma_tarefa_id, usuario_id, usuario_nome_ext) VALUES (?, ?, ?)`,
      [tarefaId, uid, nomeExt]
    )
  },

  deleteResponsaveis(tarefaId: number): void {
    db.execute(`DELETE FROM cronograma_responsaveis WHERE cronograma_tarefa_id = ?`, [tarefaId])
  },

  findResponsaveisForCronograma(cronogramaId: number): Array<{ cronograma_tarefa_id: number; usuario_id: number | null; nome: string }> {
    return db.queryMany(
      `SELECT cr.cronograma_tarefa_id, cr.usuario_id,
              COALESCE(u.nome, cr.usuario_nome_ext) as nome
       FROM cronograma_responsaveis cr
       LEFT JOIN usuarios u ON cr.usuario_id = u.id
       WHERE cr.cronograma_tarefa_id IN (
         SELECT id FROM cronograma_tarefas WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = 1)
       )`,
      [cronogramaId]
    )
  },

  // ── Usuários / Config ─────────────────────────────────────────────────────

  findUsuariosAtivos(): { id: number; nome: string }[] {
    return db.queryMany<{ id: number; nome: string }>(
      `SELECT id, nome FROM usuarios WHERE ativo = 1 ORDER BY nome`
    )
  },

  findNomesUsuariosAtivos(): { nome: string }[] {
    return db.queryMany<{ nome: string }>(
      `SELECT nome FROM usuarios WHERE ativo = 1 ORDER BY nome`
    )
  },

  findConfigResponsavelPadrao(): { valor: string } | undefined {
    return db.queryOne<{ valor: string }>(
      `SELECT valor FROM config_global WHERE chave = 'responsavel_padrao_importacao'`
    )
  },

  // ── Contexto para gerar-subtarefas ────────────────────────────────────────

  findProjetoComJoins(projetoId: number): Record<string, unknown> | undefined {
    return db.queryOne<Record<string, unknown>>(
      `SELECT p.nome, p.objetivo, p.tipo_projeto,
              d.nome AS diretoria_nome, a.nome AS area_nome
       FROM projetos p
       LEFT JOIN diretorias d ON p.diretoria_id = d.id
       LEFT JOIN areas a      ON p.area_id      = a.id
       WHERE p.id = ?`,
      [projetoId]
    )
  },

  findTapRecente(projetoId: number): Record<string, unknown> | undefined {
    return db.queryOne<Record<string, unknown>>(
      `SELECT objetivo_detalhado, situacao_atual, escopo_fisico, escopo_sistemico, escopo_processo
       FROM tap
       WHERE projeto_id = ?
       ORDER BY CASE status WHEN 'APROVADO' THEN 0 ELSE 1 END, versao DESC
       LIMIT 1`,
      [projetoId]
    )
  },

  findViabilidadeRecente(projetoId: number): Record<string, unknown> | undefined {
    return db.queryOne<Record<string, unknown>>(
      `SELECT resumo_executivo, sistemas_envolvidos
       FROM viabilidade
       WHERE projeto_id = ?
       ORDER BY CASE status WHEN 'APROVADO' THEN 0 ELSE 1 END, versao DESC
       LIMIT 1`,
      [projetoId]
    )
  },

  // ── Distribuição macro-fases ──────────────────────────────────────────────

  findDistribuicaoMacroFases(cronogramaId: number, today: string): DistribuicaoMacroFase[] {
    return db.queryMany<DistribuicaoMacroFase>(
      `SELECT
         f.tipo_macro,
         COUNT(t.id)                                                AS total_tarefas,
         SUM(CASE WHEN t.status IN ('CONCLUIDO','CONCLUIDO_COM_ATRASO') THEN 1 ELSE 0 END) AS concluidas,
         SUM(CASE WHEN t.status NOT IN ('CONCLUIDO','CONCLUIDO_COM_ATRASO')
                   AND t.data_fim < ? THEN 1 ELSE 0 END)           AS atrasadas,
         ROUND(AVG(COALESCE(t.percentual, 0)), 1)                  AS percentual_medio
       FROM cronograma_tarefas t
       JOIN cronograma_tarefas f ON f.cronograma_id = t.cronograma_id
         AND f.nivel = 'FASE'
         AND t.parent_id = f.id
       WHERE t.cronograma_id = ?
         AND t.nivel = 'TAREFA'
         AND (t.ativo IS NULL OR t.ativo = 1)
         AND (f.ativo IS NULL OR f.ativo = 1)
       GROUP BY f.tipo_macro
       ORDER BY f.ordem`,
      [today, cronogramaId]
    )
  },

  // ── Tarefa de Pagamento (parcelas) ────────────────────────────────────────

  insertPagamentoHeader(params: {
    cronograma_tarefa_id: number
    beneficiario: string | null
    valor_total: number
    qtd_parcelas: number
    periodicidade: string
    data_primeira_parcela: string
    criado_por: number | null
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO cronograma_tarefa_pagamento
         (cronograma_tarefa_id, beneficiario, valor_total, qtd_parcelas, periodicidade, data_primeira_parcela, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.cronograma_tarefa_id,
        params.beneficiario ?? null,
        params.valor_total,
        params.qtd_parcelas,
        params.periodicidade,
        params.data_primeira_parcela,
        params.criado_por ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  insertParcela(params: {
    cronograma_tarefa_id: number
    numero: number
    valor: number
    data_vencimento: string
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO cronograma_tarefa_parcelas (cronograma_tarefa_id, numero, valor, data_vencimento)
       VALUES (?, ?, ?, ?)`,
      [params.cronograma_tarefa_id, params.numero, params.valor, params.data_vencimento]
    )
    return result.lastInsertRowid
  },

  findPagamentoHeaderByTarefaIds(tarefaIds: number[]): Array<{
    id: number; cronograma_tarefa_id: number; beneficiario: string | null
    valor_total: number; qtd_parcelas: number; periodicidade: string
    data_primeira_parcela: string; financeiro_pagamento_id: number | null
  }> {
    if (tarefaIds.length === 0) return []
    const placeholders = tarefaIds.map(() => '?').join(',')
    return db.queryMany(
      `SELECT * FROM cronograma_tarefa_pagamento WHERE cronograma_tarefa_id IN (${placeholders})`,
      tarefaIds
    )
  },

  findParcelasByTarefaIds(tarefaIds: number[]): Array<{
    id: number; cronograma_tarefa_id: number; numero: number; valor: number
    data_vencimento: string; data_vencimento_baseline: string | null
    status: string; data_pagamento: string | null; pago_por: number | null
    pago_por_nome: string | null
  }> {
    if (tarefaIds.length === 0) return []
    const placeholders = tarefaIds.map(() => '?').join(',')
    return db.queryMany(
      `SELECT p.*, u.nome as pago_por_nome
       FROM cronograma_tarefa_parcelas p
       LEFT JOIN usuarios u ON u.id = p.pago_por
       WHERE p.cronograma_tarefa_id IN (${placeholders})
       ORDER BY p.numero ASC`,
      tarefaIds
    )
  },

  findParcelaById(parcelaId: number): {
    id: number; cronograma_tarefa_id: number; numero: number; valor: number
    data_vencimento: string; data_vencimento_baseline: string | null; status: string
  } | undefined {
    return db.queryOne(`SELECT * FROM cronograma_tarefa_parcelas WHERE id = ?`, [parcelaId])
  },

  marcarParcelaPaga(parcelaId: number, dataPagamento: string, pagoPor: number): void {
    db.execute(
      `UPDATE cronograma_tarefa_parcelas
       SET status = 'PAGO', data_pagamento = ?, pago_por = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [dataPagamento, pagoPor, parcelaId]
    )
  },

  reprogramarParcela(parcelaId: number, novaData: string, baselineAtual: string | null, dataAtual: string): void {
    db.execute(
      `UPDATE cronograma_tarefa_parcelas
       SET data_vencimento = ?, data_vencimento_baseline = COALESCE(?, ?), updated_at = datetime('now')
       WHERE id = ?`,
      [novaData, baselineAtual, dataAtual, parcelaId]
    )
  },

  updatePagamentoHeader(tarefaId: number, params: {
    beneficiario: string | null
    valor_total: number
    qtd_parcelas: number
    periodicidade: string
    data_primeira_parcela: string
  }): void {
    db.execute(
      `UPDATE cronograma_tarefa_pagamento
       SET beneficiario = ?, valor_total = ?, qtd_parcelas = ?, periodicidade = ?, data_primeira_parcela = ?
       WHERE cronograma_tarefa_id = ?`,
      [
        params.beneficiario, params.valor_total, params.qtd_parcelas,
        params.periodicidade, params.data_primeira_parcela, tarefaId,
      ]
    )
  },

  deleteParcelasPendentes(tarefaId: number): void {
    db.execute(
      `DELETE FROM cronograma_tarefa_parcelas WHERE cronograma_tarefa_id = ? AND status = 'PENDENTE'`,
      [tarefaId]
    )
  },

  updateTarefaBasico(id: number, cronogramaId: number, params: {
    nome: string
    observacoes: string | null
    responsavel_id: number | null
    alterado_por: number
  }): void {
    db.execute(
      `UPDATE cronograma_tarefas
       SET nome = ?, observacoes = ?, responsavel_id = ?, alterado_por = ?, alterado_em = datetime('now')
       WHERE id = ? AND cronograma_id = ?`,
      [params.nome, params.observacoes, params.responsavel_id, params.alterado_por, id, cronogramaId]
    )
  },

  // ── Mover tarefa entre fases ──────────────────────────────────────────────

  findTarefasAtivasOrdenadas(cronogramaId: number): Array<{ id: number; nivel: string; parent_id: number | null; ordem: number }> {
    return db.queryMany(
      `SELECT id, nivel, parent_id, ordem FROM cronograma_tarefas
       WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = 1)
       ORDER BY ordem, id`,
      [cronogramaId]
    )
  },

  updatePosicaoTarefa(id: number, cronogramaId: number, params: {
    parent_id: number | null; ordem: number; codigo: string; alterado_por: number
  }): void {
    db.execute(
      `UPDATE cronograma_tarefas
       SET parent_id = ?, ordem = ?, codigo = ?, alterado_por = ?, alterado_em = datetime('now')
       WHERE id = ? AND cronograma_id = ?`,
      [params.parent_id, params.ordem, params.codigo, params.alterado_por, id, cronogramaId]
    )
  },

  updateOrdemCodigo(id: number, ordem: number, codigo: string): void {
    db.execute(`UPDATE cronograma_tarefas SET ordem = ?, codigo = ? WHERE id = ?`, [ordem, codigo, id])
  },

  insertParcelaHistorico(params: {
    parcela_id: number
    cronograma_tarefa_id: number
    projeto_id: number
    campo: string
    valor_anterior: string | null
    valor_novo: string | null
    justificativa: string | null
    usuario_id: number | null
    usuario_nome: string | null
  }): void {
    db.execute(
      `INSERT INTO cronograma_tarefa_parcelas_historico
         (parcela_id, cronograma_tarefa_id, projeto_id, campo, valor_anterior, valor_novo, justificativa, usuario_id, usuario_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.parcela_id,
        params.cronograma_tarefa_id,
        params.projeto_id,
        params.campo,
        params.valor_anterior,
        params.valor_novo,
        params.justificativa,
        params.usuario_id,
        params.usuario_nome,
      ]
    )
  },
}
