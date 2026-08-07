import { db } from '@/lib/database'

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
  findLatestByProjectId(projetoId: number): TapVersao | undefined {
    return db.queryOne<TapVersao>(
      `SELECT tv.*, u.nome AS aprovador_nome
       FROM tap_versoes tv
       LEFT JOIN usuarios u ON u.id = tv.aprovado_por
       WHERE tv.projeto_id = ?
       ORDER BY tv.versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  findById(id: number): TapVersao | undefined {
    return db.queryOne<TapVersao>(
      `SELECT tv.*, u.nome AS aprovador_nome
       FROM tap_versoes tv
       LEFT JOIN usuarios u ON u.id = tv.aprovado_por
       WHERE tv.id = ?`,
      [id]
    )
  },

  findAllByProjectId(projetoId: number): TapVersao[] {
    return db.queryMany<TapVersao>(
      `SELECT tv.*, u.nome AS aprovador_nome
       FROM tap_versoes tv
       LEFT JOIN usuarios u ON u.id = tv.aprovado_por
       WHERE tv.projeto_id = ?
       ORDER BY tv.versao DESC`,
      [projetoId]
    )
  },

  create(dados: Partial<TapVersao>): number | bigint {
    const result = db.execute(
      `INSERT INTO tap_versoes
         (projeto_id, versao, status, titulo, objetivo, descricao, justificativa,
          beneficios_tap, riscos_iniciais, payback_meses, situacao_atual)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.projeto_id, dados.versao ?? 1, dados.status ?? 'RASCUNHO',
        dados.titulo ?? null, dados.objetivo ?? null, dados.descricao ?? null,
        dados.justificativa ?? null, dados.beneficios_tap ?? null,
        dados.riscos_iniciais ?? null, dados.payback_meses ?? null,
        dados.situacao_atual ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  findByIdAndProjetoId(id: number, projetoId: number): TapVersao | undefined {
    return db.queryOne<TapVersao>(
      'SELECT * FROM tap_versoes WHERE id = ? AND projeto_id = ?',
      [id, projetoId]
    )
  },

  update(id: number, dados: Partial<TapVersao>): void {
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
    db.execute(`UPDATE tap_versoes SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  insertCopia(vals: Record<string, unknown>): number | bigint {
    const cols = Object.keys(vals)
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const result = db.execute(
      `INSERT INTO tap_versoes (${cols.join(', ')}) VALUES (${placeholders})`,
      vals
    )
    return result.lastInsertRowid
  },

  updateStatus(id: number, status: string, aprovadoPor?: number): void {
    if (aprovadoPor) {
      db.execute(
        'UPDATE tap_versoes SET status = ?, aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, aprovadoPor, id]
      )
    } else {
      db.execute(
        'UPDATE tap_versoes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      )
    }
  },

  nextVersao(projetoId: number): number {
    const row = db.queryOne<{ versao: number }>(
      'SELECT MAX(versao) AS versao FROM tap_versoes WHERE projeto_id = ?',
      [projetoId]
    )
    return (row?.versao ?? 0) + 1
  },
}
