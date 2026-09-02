import { asyncDb } from '@/lib/database'

// Tabelas Postgres reais (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts) —
// precisam de aspas duplas por causa do case: sem isso o Postgres dobra pra minúsculo e não acha a tabela.
const T_TAP_VERSOES = '"AI"."TI_PMO_TAP_VERSOES"'
const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export interface TapVersao {
  id: number
  projeto_id: number
  versao: number
  label?: string | null
  status: string
  titulo?: string | null
  objetivo?: string | null
  descricao?: string | null
  justificativa?: string | null
  objetivo_detalhado?: string | null
  situacao_atual?: string | null
  escopo_fisico?: string | null
  escopo_sistemico?: string | null
  escopo_processo?: string | null
  setores_envolvidos?: string | null
  etapas_projeto?: string | null
  entregaveis?: string | null
  pontos_atencao?: string | null
  pontos_definir?: string | null
  beneficios_tap?: string | null
  escopo_inicial?: string | null
  escopo_fora?: string | null
  restricoes?: string | null
  premissas?: string | null
  riscos_iniciais?: string | null
  payback_meses?: number | null
  fase_origem?: string | null
  criado_por?: number | null
  aprovado_por?: number | null
  aprovado_em?: string | null
  aprovador_nome?: string | null
  created_at?: string
  updated_at?: string
}

export const TapRepository = {
  async findLatestByProjectId(projetoId: number): Promise<TapVersao | undefined> {
    return asyncDb.queryOne<TapVersao>(
      `SELECT tv.*, u.nome AS aprovador_nome
       FROM ${T_TAP_VERSOES} tv
       LEFT JOIN ${T_USUARIOS} u ON u.id = tv.aprovado_por
       WHERE tv.projeto_id = ?
       ORDER BY tv.versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  async findById(id: number): Promise<TapVersao | undefined> {
    return asyncDb.queryOne<TapVersao>(
      `SELECT tv.*, u.nome AS aprovador_nome
       FROM ${T_TAP_VERSOES} tv
       LEFT JOIN ${T_USUARIOS} u ON u.id = tv.aprovado_por
       WHERE tv.id = ?`,
      [id]
    )
  },

  async findAllByProjectId(projetoId: number): Promise<TapVersao[]> {
    return asyncDb.queryMany<TapVersao>(
      `SELECT tv.*, u.nome AS aprovador_nome
       FROM ${T_TAP_VERSOES} tv
       LEFT JOIN ${T_USUARIOS} u ON u.id = tv.aprovado_por
       WHERE tv.projeto_id = ?
       ORDER BY tv.versao DESC`,
      [projetoId]
    )
  },

  async create(dados: Partial<TapVersao>): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_TAP_VERSOES}
         (projeto_id, versao, status, titulo, objetivo, descricao, justificativa,
          beneficios_tap, riscos_iniciais, payback_meses, situacao_atual)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       RETURNING id`,
      [
        dados.projeto_id, dados.versao ?? 1, dados.status ?? 'RASCUNHO',
        dados.titulo ?? null, dados.objetivo ?? null, dados.descricao ?? null,
        dados.justificativa ?? null, dados.beneficios_tap ?? null,
        dados.riscos_iniciais ?? null, dados.payback_meses ?? null,
        dados.situacao_atual ?? null,
      ]
    )
    return result.insertedId
  },

  async findByIdAndProjetoId(id: number, projetoId: number): Promise<TapVersao | undefined> {
    return asyncDb.queryOne<TapVersao>(
      `SELECT * FROM ${T_TAP_VERSOES} WHERE id = ? AND projeto_id = ?`,
      [id, projetoId]
    )
  },

  async update(id: number, dados: Partial<TapVersao>): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = [
      'titulo', 'objetivo', 'descricao', 'justificativa',
      'objetivo_detalhado', 'situacao_atual', 'escopo_fisico', 'escopo_sistemico',
      'escopo_processo', 'setores_envolvidos', 'etapas_projeto', 'entregaveis',
      'pontos_atencao', 'pontos_definir', 'beneficios_tap', 'escopo_inicial',
      'escopo_fora', 'restricoes', 'premissas', 'riscos_iniciais', 'payback_meses', 'fase_origem',
    ] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    await asyncDb.execute(`UPDATE ${T_TAP_VERSOES} SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  async insertCopia(vals: Record<string, unknown>): Promise<number | null> {
    const cols = Object.keys(vals)
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const result = await asyncDb.execute(
      `INSERT INTO ${T_TAP_VERSOES} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      vals
    )
    return result.insertedId
  },

  async updateStatus(id: number, status: string, aprovadoPor?: number): Promise<void> {
    if (aprovadoPor) {
      await asyncDb.execute(
        `UPDATE ${T_TAP_VERSOES} SET status = ?, aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, aprovadoPor, id]
      )
    } else {
      await asyncDb.execute(
        `UPDATE ${T_TAP_VERSOES} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
      )
    }
  },

  async nextVersao(projetoId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ versao: number }>(
      `SELECT MAX(versao) AS versao FROM ${T_TAP_VERSOES} WHERE projeto_id = ?`,
      [projetoId]
    )
    return (row?.versao ?? 0) + 1
  },

  // ── Suporte a merge em JS para queries que hoje cruzam tap_versoes com
  // tabelas ainda em SQLite (projetos, aprovacoes) — ver lib/repositories/projetos.ts
  // (findAllComplexo, fetchDashboard) e lib/repositories/comites.ts (findPortfolioAtivoParaIA).

  /** Dado uma lista de ids de tap_versoes, retorna os que estão com status='RASCUNHO'. */
  async findRascunhoIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return []
    const rows = await asyncDb.queryMany<{ id: number }>(
      `SELECT id FROM ${T_TAP_VERSOES} WHERE id = ANY(?) AND status = 'RASCUNHO'`,
      [ids]
    )
    return rows.map(r => r.id)
  },

  /** Toda linha com roi_previsto não nulo, sem dedupe por projeto (replica o cálculo atual de roiPorDir). */
  async findRoiPrevistoTodos(): Promise<{ projeto_id: number; roi_previsto: number | null }[]> {
    return asyncDb.queryMany(
      `SELECT projeto_id, roi_previsto FROM ${T_TAP_VERSOES} WHERE roi_previsto IS NOT NULL`
    )
  },

  /** roi_previsto da versão mais recente de tap_versoes por projeto, entre os ids informados. */
  async findLatestRoiPrevistoPorProjetos(ids: number[]): Promise<{ projeto_id: number; roi_previsto: number | null }[]> {
    if (ids.length === 0) return []
    return asyncDb.queryMany(
      `SELECT DISTINCT ON (projeto_id) projeto_id, roi_previsto
       FROM ${T_TAP_VERSOES}
       WHERE projeto_id = ANY(?)
       ORDER BY projeto_id, versao DESC`,
      [ids]
    )
  },
}
