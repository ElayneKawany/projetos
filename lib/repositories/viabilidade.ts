import { db, asyncDb } from '@/lib/database'

// Tabela Postgres real (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts) —
// precisa de aspas duplas por causa do case: sem isso o Postgres dobra pra minúsculo.
const T_VIABILIDADE = '"AI"."TI_PMO_VIABILIDADE"'
const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export interface Viabilidade {
  id: number
  projeto_id: number
  versao: number
  status: string
  situacao_atual?: string | null
  descricao_solucao?: string | null
  impacto_operacional?: string | null
  beneficios_esperados?: string | null
  riscos?: string | null
  payback_meses?: number | null
  capex?: number | null
  opex?: number | null
  opex_periodicidade?: string | null
  economia_estimada?: number | null
  economia_periodicidade?: string | null
  investimento_total?: number | null
  roi_previsto?: number | null
  roi?: number | null
  tir?: number | null
  resumo_executivo?: string | null
  sistemas_envolvidos?: string | null
  complexidade_tecnica?: string | null
  dependencia_fornecedores?: string | null
  infraestrutura?: string | null
  mudanca_processo?: string | null
  recursos_necessarios?: string | null
  impactos?: string | null
  marcos?: string | null
  recomendacao?: string | null
  justificativa_recomendacao?: string | null
  condicoes_aprovacao?: string | null
  tipo_payback?: string | null
  payback_informado?: number | null
  payback_unidade?: string | null
  tipo_payback_quantitativo?: string | null
  tipo_payback_qualitativo?: string | null
  baseline_valor?: number | null
  meta_valor?: number | null
  tipo_indicador?: string | null
  economia_mensal_esperada?: number | null
  criado_por?: number | null
  data_inicio_prev?: string | null
  data_fim_prev?: string | null
  aprovado_por?: number | null
  aprovado_em?: string | null
  aprovador_nome?: string | null
  created_at?: string
  updated_at?: string
}

export const ViabilidadeRepository = {
  async findLatestByProjectId(projetoId: number): Promise<Viabilidade | undefined> {
    return asyncDb.queryOne<Viabilidade>(
      `SELECT v.*, u.nome AS aprovador_nome
       FROM ${T_VIABILIDADE} v
       LEFT JOIN ${T_USUARIOS} u ON u.id = v.aprovado_por
       WHERE v.projeto_id = ?
       ORDER BY v.versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  async findById(id: number): Promise<Viabilidade | undefined> {
    return asyncDb.queryOne<Viabilidade>(
      `SELECT v.*, u.nome AS aprovador_nome
       FROM ${T_VIABILIDADE} v
       LEFT JOIN ${T_USUARIOS} u ON u.id = v.aprovado_por
       WHERE v.id = ?`,
      [id]
    )
  },

  async findAllByProjectId(projetoId: number): Promise<Viabilidade[]> {
    return asyncDb.queryMany<Viabilidade>(
      `SELECT v.*, u.nome AS aprovador_nome
       FROM ${T_VIABILIDADE} v
       LEFT JOIN ${T_USUARIOS} u ON u.id = v.aprovado_por
       WHERE v.projeto_id = ?
       ORDER BY v.versao DESC`,
      [projetoId]
    )
  },

  async create(dados: Partial<Viabilidade>): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_VIABILIDADE}
         (projeto_id, versao, status, situacao_atual, descricao_solucao, impacto_operacional,
          beneficios_esperados, riscos, payback_meses, capex, opex, investimento_total,
          roi_previsto, data_inicio_prev, data_fim_prev)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       RETURNING id`,
      [
        dados.projeto_id, dados.versao ?? 1, dados.status ?? 'RASCUNHO',
        dados.situacao_atual ?? null, dados.descricao_solucao ?? null,
        dados.impacto_operacional ?? null, dados.beneficios_esperados ?? null,
        dados.riscos ?? null, dados.payback_meses ?? null,
        dados.capex ?? null, dados.opex ?? null, dados.investimento_total ?? null,
        dados.roi_previsto ?? null, dados.data_inicio_prev ?? null, dados.data_fim_prev ?? null,
      ]
    )
    return result.insertedId
  },

  async findByIdAndProjetoId(id: number, projetoId: number): Promise<Viabilidade | undefined> {
    return asyncDb.queryOne<Viabilidade>(
      `SELECT * FROM ${T_VIABILIDADE} WHERE id = ? AND projeto_id = ?`,
      [id, projetoId]
    )
  },

  async update(id: number, dados: Record<string, unknown>): Promise<void> {
    const campos = [
      'situacao_atual', 'descricao_solucao', 'impacto_operacional', 'beneficios_esperados',
      'riscos', 'payback_meses', 'capex', 'opex', 'investimento_total', 'economia_estimada',
      'roi_previsto', 'roi', 'tir', 'data_inicio_prev', 'data_fim_prev',
      'resumo_executivo', 'sistemas_envolvidos', 'complexidade_tecnica',
      'dependencia_fornecedores', 'infraestrutura', 'mudanca_processo',
      'recursos_necessarios', 'impactos', 'marcos', 'recomendacao',
      'justificativa_recomendacao', 'condicoes_aprovacao', 'status',
      'opex_periodicidade', 'economia_periodicidade',
      'tipo_payback', 'payback_informado', 'payback_unidade',
      'tipo_payback_quantitativo', 'tipo_payback_qualitativo',
      'baseline_valor', 'meta_valor', 'tipo_indicador', 'economia_mensal_esperada',
    ]
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    await asyncDb.execute(`UPDATE ${T_VIABILIDADE} SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  async insertCopia(vals: Record<string, unknown>): Promise<number | null> {
    const cols = Object.keys(vals)
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const result = await asyncDb.execute(
      `INSERT INTO ${T_VIABILIDADE} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      vals
    )
    return result.insertedId
  },

  // ── Orçamento (orcamento_grupos / orcamento_itens) — tabelas ainda em SQLite,
  // fora do escopo desta fatia (só `viabilidade` migra aqui).

  findGruposAtivos(projetoId: number): Record<string, unknown>[] {
    return db.queryMany('SELECT * FROM orcamento_grupos WHERE projeto_id = ? AND ativo = 1', [projetoId])
  },

  findItensGrupoAtivos(grupoId: number): Record<string, unknown>[] {
    return db.queryMany('SELECT * FROM orcamento_itens WHERE grupo_id = ? AND ativo = 1', [grupoId])
  },

  softDeleteItensGrupo(grupoId: number): void {
    db.execute('UPDATE orcamento_itens SET ativo = 0 WHERE grupo_id = ?', [grupoId])
  },

  softDeleteGrupo(grupoId: number): void {
    db.execute('UPDATE orcamento_grupos SET ativo = 0 WHERE id = ?', [grupoId])
  },

  insertGrupo(params: {
    projeto_id: number; viabilidade_id: number | bigint; tipo: unknown; nome: unknown
    cor: unknown; icone: unknown; ordem: unknown; criado_por: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO orcamento_grupos (projeto_id, viabilidade_id, tipo, nome, cor, icone, ordem, ativo, criado_por)
       VALUES (?,?,?,?,?,?,?,1,?)`,
      [params.projeto_id, params.viabilidade_id, params.tipo, params.nome,
       params.cor, params.icone, params.ordem, params.criado_por]
    )
    return result.lastInsertRowid
  },

  insertItemOrcamento(params: {
    grupo_id: number | bigint; projeto_id: number; nome: unknown; descricao: unknown
    conta_contabil_id: unknown; centro_custo_id: unknown; valor_aprovado: unknown
    valor_revisado: unknown; status: unknown; prioridade: unknown
    responsavel_usuario_id: unknown; ordem: unknown; criado_por: number
  }): void {
    db.execute(
      `INSERT INTO orcamento_itens
         (grupo_id, projeto_id, nome, descricao, conta_contabil_id, centro_custo_id,
          valor_aprovado, valor_revisado, status, prioridade, responsavel_usuario_id, ordem, ativo, criado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
      [params.grupo_id, params.projeto_id, params.nome, params.descricao,
       params.conta_contabil_id, params.centro_custo_id, params.valor_aprovado,
       params.valor_revisado, params.status, params.prioridade,
       params.responsavel_usuario_id, params.ordem, params.criado_por]
    )
  },

  async updateStatus(id: number, status: string, aprovadoPor?: number): Promise<void> {
    if (aprovadoPor) {
      await asyncDb.execute(
        `UPDATE ${T_VIABILIDADE} SET status = ?, aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, aprovadoPor, id]
      )
    } else {
      await asyncDb.execute(
        `UPDATE ${T_VIABILIDADE} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
      )
    }
  },

  async nextVersao(projetoId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ versao: number }>(
      `SELECT MAX(versao) AS versao FROM ${T_VIABILIDADE} WHERE projeto_id = ?`,
      [projetoId]
    )
    return (row?.versao ?? 0) + 1
  },

  async findV1ByProjetoId(projetoId: number): Promise<{ id: number } | undefined> {
    return asyncDb.queryOne<{ id: number }>(
      `SELECT id FROM ${T_VIABILIDADE} WHERE projeto_id = ? AND versao = 1`,
      [projetoId]
    )
  },

  async findNaoFinalizadas(projetoId: number): Promise<{ id: number }[]> {
    return asyncDb.queryMany<{ id: number }>(
      `SELECT id FROM ${T_VIABILIDADE} WHERE projeto_id = ? AND status NOT IN ('CANCELADO', 'APROVADO')`,
      [projetoId]
    )
  },

  // ── Suporte a merge em JS para queries que cruzam viabilidade com tabelas
  // ainda em SQLite (ver lib/repositories/projetos.ts: findAllComplexo, fetchDashboard).

  /** Dado uma lista de ids de viabilidade, retorna os que estão com status='RASCUNHO'. */
  async findRascunhoIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return []
    const rows = await asyncDb.queryMany<{ id: number }>(
      `SELECT id FROM ${T_VIABILIDADE} WHERE id = ANY(?) AND status = 'RASCUNHO'`,
      [ids]
    )
    return rows.map(r => r.id)
  },

  /** capex/opex da versão aprovada mais recente por projeto, entre os ids informados. */
  async findLatestAprovadoCapexOpexPorProjetos(ids: number[]): Promise<{ projeto_id: number; capex: number | null; opex: number | null }[]> {
    if (ids.length === 0) return []
    return asyncDb.queryMany(
      `SELECT DISTINCT ON (projeto_id) projeto_id, capex, opex
       FROM ${T_VIABILIDADE}
       WHERE projeto_id = ANY(?) AND status = 'APROVADO'
       ORDER BY projeto_id, versao DESC`,
      [ids]
    )
  },

  /** Linha completa da versão mais recente (qualquer status) de cada projeto informado. */
  async findLatestPorProjetos(ids: number[]): Promise<Viabilidade[]> {
    if (ids.length === 0) return []
    return asyncDb.queryMany<Viabilidade>(
      `SELECT DISTINCT ON (projeto_id) *
       FROM ${T_VIABILIDADE}
       WHERE projeto_id = ANY(?)
       ORDER BY projeto_id, versao DESC`,
      [ids]
    )
  },

  /** Busca por lote de ids (não por projeto) — usado onde já se tem a referencia_id exata (ex.: workflow de aprovação). */
  async findByIds(ids: number[]): Promise<Viabilidade[]> {
    if (ids.length === 0) return []
    return asyncDb.queryMany<Viabilidade>(
      `SELECT * FROM ${T_VIABILIDADE} WHERE id = ANY(?)`,
      [ids]
    )
  },
}
