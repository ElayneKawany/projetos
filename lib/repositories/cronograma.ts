import { db, asyncDb } from '@/lib/database'
import { UsuariosRepository } from './usuarios'

// Tabelas Postgres reais (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts) —
// precisam de aspas duplas por causa do case: sem isso o Postgres dobra pra minúsculo e não acha a tabela.
const T_CRONOGRAMAS = '"AI"."TI_PMO_CRONOGRAMAS"'
const T_CRONOGRAMA_TAREFAS = '"AI"."TI_PMO_CRONOGRAMA_TAREFAS"'
const T_CRONOGRAMA_RESPONSAVEIS = '"AI"."TI_PMO_CRONOGRAMA_RESPONSAVEIS"'
const T_CRONOGRAMA_TAREFA_PAGAMENTO = '"AI"."TI_PMO_CRONOGRAMA_TAREFA_PAGAMENTO"'
const T_CRONOGRAMA_TAREFA_PARCELAS = '"AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS"'
const T_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO = '"AI"."TI_PMO_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO"'
const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

// `ativo`/`is_baseline`/`arquivado`/`bloqueio` são INTEGER 0/1 em SQLite mas boolean nativo em
// Postgres — normaliza de volta pra 0/1 no retorno pra preservar o contrato existente com o
// frontend (ex.: CronogramaEditor.tsx faz `cronograma.is_baseline === 1`, não truthy check).
const toInt01 = (v: unknown): number | null | undefined =>
  v == null ? (v as null | undefined) : (v ? 1 : 0)

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
  is_baseline?: number | null
  aprovado_por?: number | null
  aprovado_em?: string | null
  ativo?: number | null
  arquivado?: number | null
  arquivado_por?: number | null
  arquivado_em?: string | null
  criado_por?: number | null
  modo?: string | null
  fonte_importacao?: string | null
  arquivo_origem?: string | null
  motivo_replano?: string | null
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
  data_inicio_baseline?: string | null
  data_fim_baseline?: string | null
  data_conclusao?: string | null
  bloqueio?: number | null
  motivo_bloqueio?: string | null
  motivo_atraso?: string | null
  responsavel_id?: number | null
  responsavel_nome_ext?: string | null
  executor_id?: number | null
  executor_nome_ext?: string | null
  criado_por?: number | null
  concluido_por?: number | null
  alterado_por?: number | null
  alterado_em?: string | null
  ativo?: number | null
  tipo_macro?: string | null
  natureza_tarefa?: string | null
}

function normCronograma<T extends { is_baseline?: unknown; ativo?: unknown; arquivado?: unknown }>(row: T): T {
  return {
    ...row,
    is_baseline: toInt01(row.is_baseline),
    ativo: toInt01(row.ativo),
    arquivado: toInt01(row.arquivado),
  }
}

function normTarefa<T extends { ativo?: unknown; bloqueio?: unknown }>(row: T): T {
  return { ...row, ativo: toInt01(row.ativo), bloqueio: toInt01(row.bloqueio) }
}

export const CronogramaRepository = {
  async findLatestByProjectId(projetoId: number): Promise<(Cronograma & { aprovado_nome: string | null }) | undefined> {
    const row = await asyncDb.queryOne<Cronograma>(
      `SELECT * FROM ${T_CRONOGRAMAS}
       WHERE projeto_id = ? AND (ativo IS NULL OR ativo = true)
       ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
    if (!row) return undefined
    const nomes = row.aprovado_por != null
      ? await UsuariosRepository.findNomesPorIds([row.aprovado_por])
      : new Map<number, { nome: string; cargo: string | null }>()
    return {
      ...normCronograma(row),
      aprovado_nome: row.aprovado_por != null ? nomes.get(row.aprovado_por)?.nome ?? null : null,
    }
  },

  // Sem callers hoje (`grep -rn "CronogramaRepository.findById("` não encontrou uso, substituído
  // por findByIdAndProjetoId) — convertido por consistência, com menos rigor de teste.
  async findById(id: number): Promise<Cronograma | undefined> {
    const row = await asyncDb.queryOne<Cronograma>(
      `SELECT * FROM ${T_CRONOGRAMAS} WHERE id = ? AND (ativo IS NULL OR ativo = true)`,
      [id]
    )
    return row ? normCronograma(row) : undefined
  },

  // Sem callers hoje (substituído por findAllVersoes) — menos rigor.
  async findAllByProjectId(projetoId: number): Promise<Cronograma[]> {
    const rows = await asyncDb.queryMany<Cronograma>(
      `SELECT * FROM ${T_CRONOGRAMAS} WHERE projeto_id = ? AND (ativo IS NULL OR ativo = true) ORDER BY versao DESC`,
      [projetoId]
    )
    return rows.map(normCronograma)
  },

  // Sem callers hoje (substituído por insertCronograma) — menos rigor.
  async create(dados: Partial<Cronograma>): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMAS} (projeto_id, versao, label, status, is_baseline, ativo, criado_por)
       VALUES (?,?,?,?,?,true,?)
       RETURNING id`,
      [
        dados.projeto_id, dados.versao ?? 1, dados.label ?? null,
        dados.status ?? 'RASCUNHO', !!dados.is_baseline, dados.criado_por ?? null,
      ]
    )
    return result.insertedId
  },

  // Sem callers hoje (substituído por updateStatusAprovado) — menos rigor.
  async approve(id: number, aprovadoPor: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMAS} SET status = 'APROVADO', aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [aprovadoPor, id]
    )
  },

  // Sem callers hoje (substituído por maxVersao) — menos rigor.
  async nextVersao(projetoId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ versao: number }>(
      `SELECT MAX(versao) AS versao FROM ${T_CRONOGRAMAS} WHERE projeto_id = ?`,
      [projetoId]
    )
    return (row?.versao ?? 0) + 1
  },

  // ── Tarefas ────────────────────────────────────────────────────────────────

  async findTasks(cronogramaId: number): Promise<(CronogramaTarefa & { responsavel_nome: string | null; executor_nome: string | null })[]> {
    const rows = await asyncDb.queryMany<CronogramaTarefa>(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true)
       ORDER BY ordem, id`,
      [cronogramaId]
    )
    const ids = [...new Set(
      rows.flatMap(t => [t.responsavel_id, t.executor_id]).filter((v): v is number => v != null)
    )]
    const nomes = await UsuariosRepository.findNomesPorIds(ids)
    return rows.map(t => ({
      ...normTarefa(t),
      responsavel_nome: (t.responsavel_id != null ? nomes.get(t.responsavel_id)?.nome : undefined) ?? t.responsavel_nome_ext ?? null,
      executor_nome: (t.executor_id != null ? nomes.get(t.executor_id)?.nome : undefined) ?? t.executor_nome_ext ?? null,
    }))
  },

  // Sem callers hoje (substituído por findTarefaByIdAndCronograma) — menos rigor.
  async findTaskById(id: number): Promise<CronogramaTarefa | undefined> {
    const row = await asyncDb.queryOne<CronogramaTarefa>(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFAS} WHERE id = ? AND (ativo IS NULL OR ativo = true)`,
      [id]
    )
    return row ? normTarefa(row) : undefined
  },

  // Sem callers hoje (substituído por updateTarefaCompleta/updateTarefaBasico) — menos rigor.
  async updateTask(id: number, dados: Partial<CronogramaTarefa>): Promise<void> {
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
    await asyncDb.execute(`UPDATE ${T_CRONOGRAMA_TAREFAS} SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  // Sem callers hoje — menos rigor.
  async countTasksByStatus(cronogramaId: number): Promise<Record<string, number>> {
    const rows = await asyncDb.queryMany<{ status: string; total: number }>(
      `SELECT status, COUNT(*) AS total FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true)
       GROUP BY status`,
      [cronogramaId]
    )
    return Object.fromEntries(rows.map(r => [r.status ?? 'NULL', r.total]))
  },

  // ── New methods ────────────────────────────────────────────────────────────

  async findAllVersoes(projetoId: number): Promise<Array<{ id: number; versao: number; label: string; status: string; is_baseline: number | null; arquivado: number | null; created_at: string }>> {
    const rows = await asyncDb.queryMany<{ id: number; versao: number; label: string; status: string; is_baseline: unknown; arquivado: unknown; created_at: string }>(
      `SELECT id, versao, label, status, is_baseline, arquivado, created_at
       FROM ${T_CRONOGRAMAS} WHERE projeto_id = ? ORDER BY versao DESC`,
      [projetoId]
    )
    return rows.map(r => ({ ...r, is_baseline: toInt01(r.is_baseline) ?? null, arquivado: toInt01(r.arquivado) ?? null }))
  },

  /** Arquiva uma versão do cronograma — só tira da lista padrão, não apaga nada. */
  async arquivarVersao(cronogramaId: number, usuarioId: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMAS} SET arquivado = true, arquivado_por = ?, arquivado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [usuarioId, cronogramaId]
    )
  },

  async findByIdAndProjetoId(id: number, projetoId: number): Promise<(Cronograma & { aprovado_nome: string | null }) | undefined> {
    const row = await asyncDb.queryOne<Cronograma>(
      `SELECT * FROM ${T_CRONOGRAMAS} WHERE id = ? AND projeto_id = ?`,
      [id, projetoId]
    )
    if (!row) return undefined
    const nomes = row.aprovado_por != null
      ? await UsuariosRepository.findNomesPorIds([row.aprovado_por])
      : new Map<number, { nome: string; cargo: string | null }>()
    return {
      ...normCronograma(row),
      aprovado_nome: row.aprovado_por != null ? nomes.get(row.aprovado_por)?.nome ?? null : null,
    }
  },

  async findAtivoSimples(projetoId: number): Promise<{ id: number; versao: number } | undefined> {
    return asyncDb.queryOne<{ id: number; versao: number }>(
      `SELECT id, versao FROM ${T_CRONOGRAMAS}
       WHERE projeto_id = ? AND (ativo = true OR ativo IS NULL)
       ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  /**
   * Resolve a versão vigente do cronograma de um projeto: a de maior `versao`
   * entre as que estão ativas, aprovadas (ou em estágio pós-aprovação) e não
   * arquivadas. Fonte única para "qual cronograma alimenta a Timeline/dashboard/
   * Comitê" — nunca um RASCUNHO/PENDENTE_APROVACAO nem uma versão arquivada.
   */
  async findCronogramaVigente(projetoId: number): Promise<{ id: number; versao: number } | undefined> {
    return asyncDb.queryOne<{ id: number; versao: number }>(
      `SELECT id, versao FROM ${T_CRONOGRAMAS}
       WHERE projeto_id = ?
         AND (ativo IS NULL OR ativo = true)
         AND (arquivado IS NULL OR arquivado = false)
         AND status IN ('APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO', 'ENCERRADO')
       ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  async maxVersao(projetoId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ max_v: number | null }>(
      `SELECT MAX(versao) as max_v FROM ${T_CRONOGRAMAS} WHERE projeto_id = ?`,
      [projetoId]
    )
    return row?.max_v ?? 0
  },

  async updateStatus(id: number, status: string): Promise<void> {
    await asyncDb.execute(`UPDATE ${T_CRONOGRAMAS} SET status = ? WHERE id = ?`, [status, id])
  },

  async updateStatusAprovado(id: number, aprovadoPor: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMAS} SET status = 'APROVADO', is_baseline = true,
       aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [aprovadoPor, id]
    )
  },

  async insertCronograma(params: {
    projeto_id: number
    versao: number
    label: string
    modo?: string
    fonte_importacao?: string
    arquivo_origem?: string | null
    criado_por: number
  }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMAS}
         (projeto_id, versao, label, modo, fonte_importacao, arquivo_origem, criado_por, status, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RASCUNHO', true)
       RETURNING id`,
      [
        params.projeto_id, params.versao, params.label,
        params.modo ?? 'CENTRALIZADO',
        params.fonte_importacao ?? 'MANUAL',
        params.arquivo_origem ?? null,
        params.criado_por,
      ]
    )
    return result.insertedId
  },

  async updateLabelFonte(id: number, label: string, fonte: string, arquivo: string | null): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMAS} SET label = ?, fonte_importacao = ?, arquivo_origem = ? WHERE id = ?`,
      [label, fonte, arquivo, id]
    )
  },

  // ── Tarefas ────────────────────────────────────────────────────────────────

  /**
   * Tarefas ativas de um cronograma, em ordem — fonte usada para copiar a
   * estrutura ao criar uma Nova Versão. O filtro de `ativo` é essencial: sem
   * ele, linhas desativadas pelo editor inline (substituídas por uma versão
   * mais nova da mesma linha, mas nunca removidas da tabela) seriam copiadas
   * de volta como ativas — causando tarefas/fases duplicadas na nova versão,
   * e esse efeito compõe a cada nova versão criada a partir da anterior.
   */
  async findTarefasOrdered(cronogramaId: number): Promise<Record<string, unknown>[]> {
    const rows = await asyncDb.queryMany<Record<string, unknown>>(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFAS} WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true) ORDER BY ordem`,
      [cronogramaId]
    )
    return rows.map(r => normTarefa(r as unknown as CronogramaTarefa)) as unknown as Record<string, unknown>[]
  },

  async findTarefasComNomes(cronogramaId: number): Promise<Record<string, unknown>[]> {
    const rows = await asyncDb.queryMany<{
      codigo: string | null; nivel: string; nome: string; descricao: string | null; tipo: string | null; criticidade: string | null
      responsavel_id: number | null; responsavel_nome_ext: string | null
      executor_id: number | null; executor_nome_ext: string | null
      data_inicio: string | null; data_inicio_baseline: string | null; data_fim: string | null; data_fim_baseline: string | null
      percentual: number | null; status: string | null; observacoes: string | null; tipo_macro: string | null
    }>(
      `SELECT codigo, nivel, nome, descricao, tipo, criticidade,
              responsavel_id, responsavel_nome_ext,
              executor_id, executor_nome_ext,
              data_inicio, data_inicio_baseline, data_fim, data_fim_baseline,
              percentual, status, observacoes, tipo_macro
       FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true)
       ORDER BY ordem`,
      [cronogramaId]
    )
    const ids = [...new Set(
      rows.flatMap(t => [t.responsavel_id, t.executor_id]).filter((v): v is number => v != null)
    )]
    const nomes = await UsuariosRepository.findNomesPorIds(ids)
    // Ordem do COALESCE original é invertida em relação a findTasks: aqui o nome
    // externo (_ext) tem prioridade, e o nome do usuário Postgres é o fallback.
    return rows.map(t => ({
      ...t,
      responsavel_nome: t.responsavel_nome_ext ?? (t.responsavel_id != null ? nomes.get(t.responsavel_id)?.nome : undefined) ?? null,
      executor_nome: t.executor_nome_ext ?? (t.executor_id != null ? nomes.get(t.executor_id)?.nome : undefined) ?? null,
    }))
  },

  async findTarefasFasesTarefas(cronogramaId: number): Promise<Array<{ id: number; nivel: string; nome: string; descricao: string | null; ordem: number }>> {
    return asyncDb.queryMany(
      `SELECT id, nivel, nome, descricao, ordem
       FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND nivel IN ('FASE', 'TAREFA') AND (ativo IS NULL OR ativo = true)
       ORDER BY ordem`,
      [cronogramaId]
    )
  },

  async findTarefaByIdAndCronograma(id: number, cronogramaId: number): Promise<Record<string, unknown> | undefined> {
    const row = await asyncDb.queryOne<CronogramaTarefa>(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFAS} WHERE id = ? AND cronograma_id = ?`,
      [id, cronogramaId]
    )
    return row ? (normTarefa(row) as unknown as Record<string, unknown>) : undefined
  },

  async findTarefaComNivel(id: number, nivel: string, cronogramaId: number): Promise<Record<string, unknown> | undefined> {
    const row = await asyncDb.queryOne<CronogramaTarefa>(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFAS} WHERE id = ? AND nivel = ? AND cronograma_id = ?`,
      [id, nivel, cronogramaId]
    )
    return row ? (normTarefa(row) as unknown as Record<string, unknown>) : undefined
  },

  async findIdsAtivos(cronogramaId: number): Promise<number[]> {
    const rows = await asyncDb.queryMany<{ id: number }>(
      `SELECT id FROM ${T_CRONOGRAMA_TAREFAS} WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true)`,
      [cronogramaId]
    )
    return rows.map(r => r.id)
  },

  async insertTarefa(params: {
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
  }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMA_TAREFAS}
         (cronograma_id, parent_id, codigo, nome, descricao, nivel, tipo, criticidade,
          data_inicio, data_inicio_baseline, data_fim, data_fim_baseline, duracao_dias,
          responsavel_id, responsavel_nome_ext, executor_id, executor_nome_ext,
          area_id, peso, ordem, percentual, status, prazo_status, data_conclusao,
          observacoes, tipo_macro, ativo, criado_por, alterado_por, alterado_em, natureza_tarefa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
       RETURNING id`,
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
        (params.ativo ?? 1) !== 0,
        params.criado_por ?? null,
        params.alterado_por ?? null,
        params.natureza_tarefa ?? 'NORMAL',
      ]
    )
    return result.insertedId
  },

  async updateTarefaCompleta(id: number, cronogramaId: number, params: {
    nome: string; nivel: string; codigo: string; ordem: number; parent_id: number | null
    responsavel_id: number | null; responsavel_nome_ext: string | null
    executor_id: number | null; executor_nome_ext: string | null
    data_inicio: string | null; data_inicio_baseline?: string | null
    data_fim: string | null; data_fim_baseline?: string | null; duracao_dias: number | null
    tipo: string; criticidade: string; observacoes: string | null; descricao: string | null
    tipo_macro: string | null; alterado_por: number
  }): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFAS}
       SET nome = ?, nivel = ?, codigo = ?, ordem = ?, parent_id = ?,
           responsavel_id = ?, responsavel_nome_ext = ?,
           executor_id = ?,   executor_nome_ext = ?,
           data_inicio = ?, data_inicio_baseline = ?, data_fim = ?, data_fim_baseline = ?, duracao_dias = ?,
           tipo = ?, criticidade = ?, observacoes = ?, descricao = ?,
           tipo_macro = ?,
           ativo = true,
           alterado_por = ?, alterado_em = CURRENT_TIMESTAMP
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

  async softDeleteTarefas(cronogramaId: number): Promise<void> {
    await asyncDb.execute(`UPDATE ${T_CRONOGRAMA_TAREFAS} SET ativo = false WHERE cronograma_id = ?`, [cronogramaId])
  },

  async softDeleteTarefa(id: number, userId: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFAS} SET ativo = false, alterado_por = ?, alterado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, id]
    )
  },

  async concluirTarefa(id: number, prazoStatus: string, userId: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFAS}
       SET data_conclusao = CURRENT_TIMESTAMP,
           concluido_por  = ?,
           percentual     = 100,
           status         = 'CONCLUIDA',
           prazo_status   = ?,
           alterado_por   = ?,
           alterado_em    = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId, prazoStatus, userId, id]
    )
  },

  async atualizarPercentualTarefa(id: number, percentual: number, userId: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFAS}
       SET percentual   = ?,
           alterado_por = ?,
           alterado_em  = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [percentual, userId, id]
    )
  },

  async countTarefas(cronogramaId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ n: number }>(
      `SELECT COUNT(*) as n FROM ${T_CRONOGRAMA_TAREFAS} WHERE cronograma_id = ?`,
      [cronogramaId]
    )
    return row?.n ?? 0
  },

  async countSubtarefas(cronogramaId: number, parentId: number, concluidas: boolean): Promise<number> {
    const extra = concluidas ? 'AND data_conclusao IS NOT NULL' : ''
    const row = await asyncDb.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND parent_id = ? AND nivel = 'SUBTAREFA'
         AND (ativo IS NULL OR ativo = true) ${extra}`,
      [cronogramaId, parentId]
    )
    return row?.n ?? 0
  },

  async countTarefasFase(cronogramaId: number, parentId: number, concluidas: boolean): Promise<number> {
    const extra = concluidas ? 'AND data_conclusao IS NOT NULL' : ''
    const row = await asyncDb.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND parent_id = ? AND nivel = 'TAREFA'
         AND (ativo IS NULL OR ativo = true) ${extra}`,
      [cronogramaId, parentId]
    )
    return row?.n ?? 0
  },

  async countTarefasTotais(cronogramaId: number, concluidas = false): Promise<number> {
    const extra = concluidas ? 'AND data_conclusao IS NOT NULL' : ''
    const row = await asyncDb.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${T_CRONOGRAMA_TAREFAS} WHERE cronograma_id = ? AND nivel = 'TAREFA' AND (ativo IS NULL OR ativo = true) ${extra}`,
      [cronogramaId]
    )
    return row?.n ?? 0
  },

  async maxOrdem(cronogramaId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ m: number | null }>(
      `SELECT MAX(ordem) as m FROM ${T_CRONOGRAMA_TAREFAS} WHERE cronograma_id = ?`,
      [cronogramaId]
    )
    return row?.m ?? 0
  },

  // ── Responsáveis ──────────────────────────────────────────────────────────

  async insertResponsavel(tarefaId: number, uid: number | null, nomeExt: string | null): Promise<void> {
    await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMA_RESPONSAVEIS} (cronograma_tarefa_id, usuario_id, usuario_nome_ext) VALUES (?, ?, ?)`,
      [tarefaId, uid, nomeExt]
    )
  },

  async deleteResponsaveis(tarefaId: number): Promise<void> {
    await asyncDb.execute(`DELETE FROM ${T_CRONOGRAMA_RESPONSAVEIS} WHERE cronograma_tarefa_id = ?`, [tarefaId])
  },

  async findResponsaveisForCronograma(cronogramaId: number): Promise<Array<{ cronograma_tarefa_id: number; usuario_id: number | null; nome: string }>> {
    const tarefaIds = await CronogramaRepository.findIdsAtivos(cronogramaId)
    if (tarefaIds.length === 0) return []
    const rows = await asyncDb.queryMany<{ cronograma_tarefa_id: number; usuario_id: number | null; usuario_nome_ext: string | null }>(
      `SELECT cronograma_tarefa_id, usuario_id, usuario_nome_ext
       FROM ${T_CRONOGRAMA_RESPONSAVEIS}
       WHERE cronograma_tarefa_id = ANY(?)`,
      [tarefaIds]
    )
    const ids = [...new Set(rows.map(r => r.usuario_id).filter((v): v is number => v != null))]
    const nomes = await UsuariosRepository.findNomesPorIds(ids)
    return rows.map(r => ({
      cronograma_tarefa_id: r.cronograma_tarefa_id,
      usuario_id: r.usuario_id,
      // Tipo de retorno mantém `nome: string` (contrato pré-existente do método,
      // não alterado nesta fatia) — na prática nunca é null porque toda linha
      // de cronograma_responsaveis tem usuario_id OU usuario_nome_ext preenchido.
      nome: ((r.usuario_id != null ? nomes.get(r.usuario_id)?.nome : undefined) ?? r.usuario_nome_ext ?? null) as string,
    }))
  },

  // ── Usuários / Config ─────────────────────────────────────────────────────

  async findUsuariosAtivos(): Promise<{ id: number; nome: string }[]> {
    return asyncDb.queryMany<{ id: number; nome: string }>(
      `SELECT id, nome FROM ${T_USUARIOS} WHERE ativo = true ORDER BY nome`
    )
  },

  async findNomesUsuariosAtivos(): Promise<{ nome: string }[]> {
    return asyncDb.queryMany<{ nome: string }>(
      `SELECT nome FROM ${T_USUARIOS} WHERE ativo = true ORDER BY nome`
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

  async findViabilidadeRecente(projetoId: number): Promise<Record<string, unknown> | undefined> {
    return asyncDb.queryOne<Record<string, unknown>>(
      `SELECT resumo_executivo, sistemas_envolvidos
       FROM "AI"."TI_PMO_VIABILIDADE"
       WHERE projeto_id = ?
       ORDER BY CASE status WHEN 'APROVADO' THEN 0 ELSE 1 END, versao DESC
       LIMIT 1`,
      [projetoId]
    )
  },

  // ── Distribuição macro-fases ──────────────────────────────────────────────

  async findDistribuicaoMacroFases(cronogramaId: number, today: string): Promise<DistribuicaoMacroFase[]> {
    return asyncDb.queryMany<DistribuicaoMacroFase>(
      `SELECT
         f.tipo_macro,
         COUNT(t.id)                                                AS total_tarefas,
         SUM(CASE WHEN t.status IN ('CONCLUIDO','CONCLUIDO_COM_ATRASO') THEN 1 ELSE 0 END) AS concluidas,
         SUM(CASE WHEN t.status NOT IN ('CONCLUIDO','CONCLUIDO_COM_ATRASO')
                   AND t.data_fim < ? THEN 1 ELSE 0 END)           AS atrasadas,
         ROUND(AVG(COALESCE(t.percentual, 0)), 1)                  AS percentual_medio
       FROM ${T_CRONOGRAMA_TAREFAS} t
       JOIN ${T_CRONOGRAMA_TAREFAS} f ON f.cronograma_id = t.cronograma_id
         AND f.nivel = 'FASE'
         AND t.parent_id = f.id
       WHERE t.cronograma_id = ?
         AND t.nivel = 'TAREFA'
         AND (t.ativo IS NULL OR t.ativo = true)
         AND (f.ativo IS NULL OR f.ativo = true)
       GROUP BY f.tipo_macro
       ORDER BY f.ordem`,
      [today, cronogramaId]
    )
  },

  // ── Tarefa de Pagamento (parcelas) ────────────────────────────────────────

  async insertPagamentoHeader(params: {
    cronograma_tarefa_id: number
    beneficiario: string | null
    valor_total: number
    qtd_parcelas: number
    periodicidade: string
    data_primeira_parcela: string
    criado_por: number | null
  }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMA_TAREFA_PAGAMENTO}
         (cronograma_tarefa_id, beneficiario, valor_total, qtd_parcelas, periodicidade, data_primeira_parcela, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
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
    return result.insertedId
  },

  async insertParcela(params: {
    cronograma_tarefa_id: number
    numero: number
    valor: number
    data_vencimento: string
  }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMA_TAREFA_PARCELAS} (cronograma_tarefa_id, numero, valor, data_vencimento)
       VALUES (?, ?, ?, ?)
       RETURNING id`,
      [params.cronograma_tarefa_id, params.numero, params.valor, params.data_vencimento]
    )
    return result.insertedId
  },

  /**
   * Copia uma parcela preservando todo o estado (status pago, data de
   * pagamento, linha de base) — usado só pela criação de Nova Versão do
   * Cronograma, para levar o histórico financeiro da tarefa de pagamento
   * para a nova versão sem recriar/resetar o que já foi pago.
   */
  async insertParcelaCompleta(params: {
    cronograma_tarefa_id: number
    numero: number
    valor: number
    data_vencimento: string
    data_vencimento_baseline: string | null
    status: string
    data_pagamento: string | null
    pago_por: number | null
  }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMA_TAREFA_PARCELAS}
         (cronograma_tarefa_id, numero, valor, data_vencimento, data_vencimento_baseline, status, data_pagamento, pago_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        params.cronograma_tarefa_id, params.numero, params.valor, params.data_vencimento,
        params.data_vencimento_baseline, params.status, params.data_pagamento, params.pago_por,
      ]
    )
    return result.insertedId
  },

  async findPagamentoHeaderByTarefaIds(tarefaIds: number[]): Promise<Array<{
    id: number; cronograma_tarefa_id: number; beneficiario: string | null
    valor_total: number; qtd_parcelas: number; periodicidade: string
    data_primeira_parcela: string; financeiro_pagamento_id: number | null
  }>> {
    if (tarefaIds.length === 0) return []
    return asyncDb.queryMany(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFA_PAGAMENTO} WHERE cronograma_tarefa_id = ANY(?)`,
      [tarefaIds]
    )
  },

  async findParcelasByTarefaIds(tarefaIds: number[]): Promise<Array<{
    id: number; cronograma_tarefa_id: number; numero: number; valor: number
    data_vencimento: string; data_vencimento_baseline: string | null
    status: string; data_pagamento: string | null; pago_por: number | null
    pago_por_nome: string | null
  }>> {
    if (tarefaIds.length === 0) return []
    const rows = await asyncDb.queryMany<{
      id: number; cronograma_tarefa_id: number; numero: number; valor: number
      data_vencimento: string; data_vencimento_baseline: string | null
      status: string; data_pagamento: string | null; pago_por: number | null
    }>(
      `SELECT * FROM ${T_CRONOGRAMA_TAREFA_PARCELAS}
       WHERE cronograma_tarefa_id = ANY(?)
       ORDER BY numero ASC`,
      [tarefaIds]
    )
    const ids = [...new Set(rows.map(r => r.pago_por).filter((v): v is number => v != null))]
    const nomes = await UsuariosRepository.findNomesPorIds(ids)
    return rows.map(r => ({
      ...r,
      pago_por_nome: r.pago_por != null ? nomes.get(r.pago_por)?.nome ?? null : null,
    }))
  },

  async findParcelaById(parcelaId: number): Promise<{
    id: number; cronograma_tarefa_id: number; numero: number; valor: number
    data_vencimento: string; data_vencimento_baseline: string | null; status: string
  } | undefined> {
    return asyncDb.queryOne(`SELECT * FROM ${T_CRONOGRAMA_TAREFA_PARCELAS} WHERE id = ?`, [parcelaId])
  },

  async marcarParcelaPaga(parcelaId: number, dataPagamento: string, pagoPor: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFA_PARCELAS}
       SET status = 'PAGO', data_pagamento = ?, pago_por = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [dataPagamento, pagoPor, parcelaId]
    )
  },

  async reprogramarParcela(parcelaId: number, novaData: string, baselineAtual: string | null, dataAtual: string): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFA_PARCELAS}
       SET data_vencimento = ?, data_vencimento_baseline = COALESCE(?, ?), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [novaData, baselineAtual, dataAtual, parcelaId]
    )
  },

  /**
   * Correção pontual da data de vencimento ("Editar", não "Reprogramar"): não toca em
   * data_vencimento_baseline — é a correção de um dado cadastrado errado, não a preservação
   * de uma linha de base para uma mudança planejada.
   */
  async corrigirDataVencimentoParcela(parcelaId: number, novaData: string): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFA_PARCELAS} SET data_vencimento = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [novaData, parcelaId]
    )
  },

  /**
   * Corrige a DATA DO PAGAMENTO REALIZADO de uma parcela já paga (independente da data de
   * vencimento). Não toca em vencimento/valor/status/pago_por — só data_pagamento.
   */
  async corrigirDataPagamentoParcela(parcelaId: number, novaDataPagamento: string): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFA_PARCELAS} SET data_pagamento = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [novaDataPagamento, parcelaId]
    )
  },

  async updatePagamentoHeader(tarefaId: number, params: {
    beneficiario: string | null
    valor_total: number
    qtd_parcelas: number
    periodicidade: string
    data_primeira_parcela: string
  }): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFA_PAGAMENTO}
       SET beneficiario = ?, valor_total = ?, qtd_parcelas = ?, periodicidade = ?, data_primeira_parcela = ?
       WHERE cronograma_tarefa_id = ?`,
      [
        params.beneficiario, params.valor_total, params.qtd_parcelas,
        params.periodicidade, params.data_primeira_parcela, tarefaId,
      ]
    )
  },

  async deleteParcelasPendentes(tarefaId: number): Promise<void> {
    await asyncDb.execute(
      `DELETE FROM ${T_CRONOGRAMA_TAREFA_PARCELAS} WHERE cronograma_tarefa_id = ? AND status = 'PENDENTE'`,
      [tarefaId]
    )
  },

  async updateTarefaBasico(id: number, cronogramaId: number, params: {
    nome: string
    observacoes: string | null
    responsavel_id: number | null
    alterado_por: number
  }): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFAS}
       SET nome = ?, observacoes = ?, responsavel_id = ?, alterado_por = ?, alterado_em = CURRENT_TIMESTAMP
       WHERE id = ? AND cronograma_id = ?`,
      [params.nome, params.observacoes, params.responsavel_id, params.alterado_por, id, cronogramaId]
    )
  },

  // ── Mover tarefa entre fases ──────────────────────────────────────────────

  async findTarefasAtivasOrdenadas(cronogramaId: number): Promise<Array<{ id: number; nivel: string; parent_id: number | null; ordem: number }>> {
    return asyncDb.queryMany(
      `SELECT id, nivel, parent_id, ordem FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = true)
       ORDER BY ordem, id`,
      [cronogramaId]
    )
  },

  async updatePosicaoTarefa(id: number, cronogramaId: number, params: {
    parent_id: number | null; ordem: number; codigo: string; alterado_por: number
  }): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_CRONOGRAMA_TAREFAS}
       SET parent_id = ?, ordem = ?, codigo = ?, alterado_por = ?, alterado_em = CURRENT_TIMESTAMP
       WHERE id = ? AND cronograma_id = ?`,
      [params.parent_id, params.ordem, params.codigo, params.alterado_por, id, cronogramaId]
    )
  },

  async updateOrdemCodigo(id: number, ordem: number, codigo: string): Promise<void> {
    await asyncDb.execute(`UPDATE ${T_CRONOGRAMA_TAREFAS} SET ordem = ?, codigo = ? WHERE id = ?`, [ordem, codigo, id])
  },

  async insertParcelaHistorico(params: {
    parcela_id: number
    cronograma_tarefa_id: number
    projeto_id: number
    campo: string
    valor_anterior: string | null
    valor_novo: string | null
    justificativa: string | null
    usuario_id: number | null
    usuario_nome: string | null
  }): Promise<void> {
    await asyncDb.execute(
      `INSERT INTO ${T_CRONOGRAMA_TAREFA_PARCELAS_HISTORICO}
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

  // ── Suporte a merge em JS para queries que cruzam cronograma com tabelas
  // ainda em SQLite (projetos, aprovacoes, diretorias) — ver lib/repositories/
  // projetos.ts (findAllComplexo, fetchDashboard), lib/permissoes.ts, lib/meu-trabalho.ts.

  /** Cronograma vigente (aprovado/em execução/etc., não arquivado) de cada projeto informado. */
  async findVigentePorProjetos(ids: number[]): Promise<Array<{ id: number; projeto_id: number; versao: number; status: string }>> {
    if (ids.length === 0) return []
    return asyncDb.queryMany(
      `SELECT DISTINCT ON (projeto_id) id, projeto_id, versao, status
       FROM ${T_CRONOGRAMAS}
       WHERE projeto_id = ANY(?)
         AND (ativo IS NULL OR ativo = true)
         AND (arquivado IS NULL OR arquivado = false)
         AND status IN ('APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO', 'ENCERRADO')
       ORDER BY projeto_id, versao DESC`,
      [ids]
    )
  },

  /**
   * Todos os cronogramas com status='APROVADO' (ativo) dos projetos informados — não filtra
   * por "vigente"/arquivado, réplica fiel do `EXISTS (... status='APROVADO')` que `has_cronograma`
   * e `tarefas_atrasadas` já faziam em `findAllComplexo`/`fetchDashboard` antes desta fatia.
   */
  async findAprovadosPorProjetos(ids: number[]): Promise<Array<{ id: number; projeto_id: number }>> {
    if (ids.length === 0) return []
    return asyncDb.queryMany(
      `SELECT id, projeto_id FROM ${T_CRONOGRAMAS}
       WHERE projeto_id = ANY(?) AND (ativo IS NULL OR ativo = true) AND status = 'APROVADO'`,
      [ids]
    )
  },

  /** Quantidade de tarefas atrasadas (nível TAREFA, não concluída, data_fim no passado) por cronograma. */
  async countTarefasAtrasadasPorCronogramas(cronogramaIds: number[]): Promise<Array<{ cronograma_id: number; total: number }>> {
    if (cronogramaIds.length === 0) return []
    return asyncDb.queryMany(
      `SELECT cronograma_id, COUNT(*) AS total
       FROM ${T_CRONOGRAMA_TAREFAS}
       WHERE cronograma_id = ANY(?)
         AND percentual < 100 AND data_fim IS NOT NULL AND data_fim < CURRENT_DATE
       GROUP BY cronograma_id`,
      [cronogramaIds]
    )
  },

  /** Projeto_id distintos onde o usuário é responsável ou executor de alguma tarefa (qualquer cronograma). */
  async findProjetoIdsParticipante(usuarioId: number): Promise<number[]> {
    const rows = await asyncDb.queryMany<{ projeto_id: number }>(
      `SELECT DISTINCT c.projeto_id
       FROM ${T_CRONOGRAMA_TAREFAS} ct
       JOIN ${T_CRONOGRAMAS} c ON c.id = ct.cronograma_id
       WHERE ct.responsavel_id = ? OR ct.executor_id = ?`,
      [usuarioId, usuarioId]
    )
    return rows.map(r => r.projeto_id)
  },

  /** Verifica se o usuário é responsável/executor de alguma tarefa do cronograma vigente de um projeto. */
  async temParticipacaoNoProjeto(projetoId: number, usuarioId: number): Promise<boolean> {
    const row = await asyncDb.queryOne<{ id: number }>(
      `SELECT ct.id
       FROM ${T_CRONOGRAMA_TAREFAS} ct
       JOIN ${T_CRONOGRAMAS} c ON c.id = ct.cronograma_id
       WHERE c.projeto_id = ? AND (ct.responsavel_id = ? OR ct.executor_id = ?)
       LIMIT 1`,
      [projetoId, usuarioId, usuarioId]
    )
    return !!row
  },

  /** Dado uma lista de ids de cronogramas, retorna os que estão com status='RASCUNHO'. */
  async findRascunhoIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return []
    const rows = await asyncDb.queryMany<{ id: number }>(
      `SELECT id FROM ${T_CRONOGRAMAS} WHERE id = ANY(?) AND status = 'RASCUNHO'`,
      [ids]
    )
    return rows.map(r => r.id)
  },

  /**
   * Todos os cronogramas (todas as versões, todos os projetos) com total de
   * tarefas e progresso médio agregados — usado pela página `/cronogramas`.
   * `projetos` (SQLite) entra por lookup em lote no caller, não aqui.
   */
  async findAllComTotais(): Promise<Array<Cronograma & { total_tarefas: number; progresso_medio: number }>> {
    const rows = await asyncDb.queryMany<Cronograma & { total_tarefas: number; progresso_medio: number }>(
      `SELECT cr.*,
              COUNT(t.id) AS total_tarefas,
              COALESCE(AVG(t.percentual), 0) AS progresso_medio
       FROM ${T_CRONOGRAMAS} cr
       LEFT JOIN ${T_CRONOGRAMA_TAREFAS} t ON t.cronograma_id = cr.id
       GROUP BY cr.id
       ORDER BY cr.created_at DESC`
    )
    return rows.map(normCronograma)
  },
}
