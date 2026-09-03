import { db, asyncDb } from '@/lib/database'

// Tabela Postgres real (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts) —
// precisa de aspas duplas por causa do case: sem isso o Postgres dobra pra minúsculo e não acha a tabela.
const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export interface Usuario {
  id: number
  nome: string
  email: string
  cpf: string
  perfil: string
  cargo?: string | null
  diretoria_id?: number | null
  area_id?: number | null
  ativo: number
  created_at?: string
  updated_at?: string
}

/**
 * Enriquece linhas de `usuarios` (Postgres) com nomes de diretoria/área (SQLite) —
 * join entre bancos diferentes, resolvido em duas consultas + merge em JS.
 */
async function comDiretoriaArea<T extends { diretoria_id?: number | null; area_id?: number | null }>(
  rows: T[]
): Promise<(T & { diretoria_nome: string | null; area_nome: string | null })[]> {
  const diretoriaIds = [...new Set(rows.map(r => r.diretoria_id).filter((v): v is number => v != null))]
  const areaIds = [...new Set(rows.map(r => r.area_id).filter((v): v is number => v != null))]

  const diretorias = diretoriaIds.length
    ? db.queryMany<{ id: number; nome: string }>(
        `SELECT id, nome FROM diretorias WHERE id IN (${diretoriaIds.map(() => '?').join(',')})`,
        diretoriaIds
      )
    : []
  const areas = areaIds.length
    ? db.queryMany<{ id: number; nome: string }>(
        `SELECT id, nome FROM areas WHERE id IN (${areaIds.map(() => '?').join(',')})`,
        areaIds
      )
    : []

  const dMap = new Map(diretorias.map(d => [d.id, d.nome]))
  const aMap = new Map(areas.map(a => [a.id, a.nome]))

  return rows.map(r => ({
    ...r,
    diretoria_nome: r.diretoria_id != null ? dMap.get(r.diretoria_id) ?? null : null,
    area_nome: r.area_id != null ? aMap.get(r.area_id) ?? null : null,
  }))
}

export const UsuariosRepository = {
  // ── Sem callers hoje (`grep -rn "UsuariosRepository.<metodo>("` não encontrou uso) —
  // convertidas por consistência, com menos rigor de teste (mesmo critério das fatias 2/3). ──

  async findAll(apenasAtivos = true): Promise<(Usuario & { diretoria_nome: string | null; area_nome: string | null })[]> {
    const where = apenasAtivos ? 'WHERE ativo = true' : ''
    const rows = await asyncDb.queryMany<Usuario>(
      `SELECT * FROM ${T_USUARIOS} ${where} ORDER BY nome`
    )
    return comDiretoriaArea(rows)
  },

  async findById(id: number): Promise<(Usuario & { diretoria_nome: string | null; area_nome: string | null }) | undefined> {
    const row = await asyncDb.queryOne<Usuario>(`SELECT * FROM ${T_USUARIOS} WHERE id = ?`, [id])
    if (!row) return undefined
    const [comNomes] = await comDiretoriaArea([row])
    return comNomes
  },

  async findByCpf(cpf: string): Promise<(Usuario & { senha_hash?: string }) | undefined> {
    return asyncDb.queryOne<Usuario & { senha_hash?: string }>(
      `SELECT * FROM ${T_USUARIOS} WHERE cpf = ? AND ativo = true`,
      [cpf]
    )
  },

  async findByEmail(email: string): Promise<Usuario | undefined> {
    return asyncDb.queryOne<Usuario>(
      `SELECT * FROM ${T_USUARIOS} WHERE email = ? AND ativo = true`,
      [email]
    )
  },

  async create(dados: Partial<Usuario> & { senha_hash: string }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_USUARIOS} (nome, email, cpf, senha_hash, cargo, diretoria_id, area_id, perfil_id, ativo)
       VALUES (?,?,?,?,?,?,?,?,?)
       RETURNING id`,
      [
        dados.nome, dados.email, dados.cpf, dados.senha_hash, dados.cargo ?? null,
        dados.diretoria_id ?? null, dados.area_id ?? null, 1, true,
      ]
    )
    return result.insertedId
  },

  async update(id: number, dados: Partial<Usuario>): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = ['nome', 'email', 'perfil', 'cargo', 'diretoria_id', 'area_id'] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    await asyncDb.execute(`UPDATE ${T_USUARIOS} SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  async updateSenha(id: number, senhaHash: string): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_USUARIOS} SET senha_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [senhaHash, id]
    )
  },

  async softDelete(id: number): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_USUARIOS} SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    )
  },

  // ── Continuam tocando só tabelas SQLite (não `usuarios`) — sem mudança ──

  findDiretorias(apenasAtivas = true): { id: number; nome: string; sigla: string; ordem: number }[] {
    const where = apenasAtivas ? 'WHERE ativo = 1' : ''
    return db.queryMany(
      `SELECT id, nome, sigla, ordem FROM diretorias ${where} ORDER BY ordem, nome`
    )
  },

  findAreas(directoriaId?: number): { id: number; nome: string; diretoria_id: number }[] {
    if (directoriaId) {
      return db.queryMany(
        'SELECT id, nome, diretoria_id FROM areas WHERE ativo = 1 AND diretoria_id = ? ORDER BY nome',
        [directoriaId]
      )
    }
    return db.queryMany('SELECT id, nome, diretoria_id FROM areas WHERE ativo = 1 ORDER BY nome')
  },

  // ── Queries específicas para api/usuarios (em uso) ─────────────────────────

  async findAllWithPerfil(all: boolean): Promise<Record<string, unknown>[]> {
    const rows = await asyncDb.queryMany<Usuario & { perfil_id: number }>(
      `SELECT id, cpf, nome, email, cargo, ativo, perfil_id, diretoria_id, area_id
       FROM ${T_USUARIOS}
       ${all ? '' : 'WHERE ativo = true'}
       ORDER BY nome`
    )
    const perfilIds = [...new Set(rows.map(r => r.perfil_id))]
    const perfis = perfilIds.length
      ? db.queryMany<{ id: number; codigo: string }>(
          `SELECT id, codigo FROM perfis WHERE id IN (${perfilIds.map(() => '?').join(',')})`,
          perfilIds
        )
      : []
    const perfilMap = new Map(perfis.map(p => [p.id, p.codigo]))
    const comNomes = await comDiretoriaArea(rows)
    return comNomes.map(r => ({
      id: r.id, cpf: r.cpf, nome: r.nome, email: r.email, cargo: r.cargo, ativo: r.ativo,
      perfil_codigo: perfilMap.get(r.perfil_id) ?? null, perfil_id: r.perfil_id,
      diretoria_nome: r.diretoria_nome, diretoria_id: r.diretoria_id,
      area_nome: r.area_nome, area_id: r.area_id,
    }))
  },

  async findByEmailOrCpf(cpf: string, email: string): Promise<{ id: number } | undefined> {
    return asyncDb.queryOne<{ id: number }>(
      `SELECT id FROM ${T_USUARIOS} WHERE cpf = ? OR email = ?`,
      [cpf, email]
    )
  },

  async createWithPerfilId(dados: {
    cpf: string; nome: string; email: string; senhaHash: string;
    cargo: string | null; perfil_id: number;
    diretoria_id: number | null; area_id: number | null
  }): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_USUARIOS} (cpf, nome, email, senha_hash, cargo, perfil_id, diretoria_id, area_id)
       VALUES (?,?,?,?,?,?,?,?)
       RETURNING id`,
      [dados.cpf, dados.nome, dados.email, dados.senhaHash, dados.cargo,
       dados.perfil_id, dados.diretoria_id, dados.area_id]
    )
    return result.insertedId
  },

  // ── Queries para lib/auth.ts (caminho de login — crítico) ──────────────────

  async findByCpfForLogin(cpf: string): Promise<Record<string, unknown> | undefined> {
    const row = await asyncDb.queryOne<Usuario & { perfil_id: number }>(
      `SELECT * FROM ${T_USUARIOS} WHERE cpf = ? AND ativo = true`,
      [cpf]
    )
    if (!row) return undefined
    const perfil = db.queryOne<{ codigo: string }>('SELECT codigo FROM perfis WHERE id = ?', [row.perfil_id])
    if (!perfil) return undefined // réplica do INNER JOIN original: sem perfil, login falha igual
    const diretoria = row.diretoria_id != null
      ? db.queryOne<{ nome: string }>('SELECT nome FROM diretorias WHERE id = ?', [row.diretoria_id])
      : undefined
    return { ...row, perfil_codigo: perfil.codigo, diretoria_nome: diretoria?.nome ?? null }
  },

  async updateUltimoLogin(id: number): Promise<void> {
    await asyncDb.execute(`UPDATE ${T_USUARIOS} SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?`, [id])
  },

  // ── Queries para api/aprovadores (em uso) ───────────────────────────────────

  async findAprovadores(): Promise<Record<string, unknown>[]> {
    const rows = db.queryMany<{
      id: number; tipo_documento: string; usuario_id: number; ordem: number; ativo: number; created_by: number
    }>(
      `SELECT * FROM documento_aprovadores WHERE ativo = 1 ORDER BY tipo_documento, ordem`
    )
    const nomes = await UsuariosRepository.findNomesPorIds(rows.map(r => r.usuario_id))
    return rows.map(r => ({
      ...r,
      usuario_nome: nomes.get(r.usuario_id)?.nome ?? null,
      cargo: nomes.get(r.usuario_id)?.cargo ?? null,
    }))
  },

  createAprovador(tipo_documento: string, usuario_id: number, ordem: number, created_by: number): void {
    db.execute(
      'INSERT INTO documento_aprovadores (tipo_documento, usuario_id, ordem, created_by) VALUES (?, ?, ?, ?)',
      [tipo_documento, usuario_id, ordem, created_by]
    )
  },

  softDeleteAprovador(id: number): void {
    db.execute('UPDATE documento_aprovadores SET ativo = 0 WHERE id = ?', [id])
  },

  // ── Queries para api/usuarios/[id] (em uso) ─────────────────────────────────

  async findRawById(id: number): Promise<Record<string, unknown> | undefined> {
    return asyncDb.queryOne(`SELECT * FROM ${T_USUARIOS} WHERE id = ?`, [id])
  },

  async checkCpfDuplicado(cpf: string, excludeId: number): Promise<{ id: number } | undefined> {
    return asyncDb.queryOne<{ id: number }>(
      `SELECT id FROM ${T_USUARIOS} WHERE cpf = ? AND id != ?`,
      [cpf, excludeId]
    )
  },

  async checkEmailDuplicado(email: string, excludeId: number): Promise<{ id: number } | undefined> {
    return asyncDb.queryOne<{ id: number }>(
      `SELECT id FROM ${T_USUARIOS} WHERE LOWER(TRIM(email)) = LOWER(?) AND id != ?`,
      [email, excludeId]
    )
  },

  findPerfilById(id: number): { id: number } | undefined {
    return db.queryOne<{ id: number }>('SELECT id FROM perfis WHERE id = ?', [id])
  },

  async updateFull(id: number, fields: Record<string, unknown>): Promise<void> {
    const allowed = ['nome', 'cpf', 'email', 'cargo', 'perfil_id', 'diretoria_id', 'area_id', 'ativo', 'senha_hash']
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields) { sets.push(`${campo} = ?`); params.push(fields[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    await asyncDb.execute(`UPDATE ${T_USUARIOS} SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  checkDependencias(userId: number): boolean {
    const queries: Array<[string, unknown[]]> = [
      ['SELECT COUNT(*) AS c FROM projetos WHERE gerente_id = ? AND ativo = 1', [userId]],
      ['SELECT COUNT(*) AS c FROM projetos WHERE pmo_responsavel_id = ? AND ativo = 1', [userId]],
      ['SELECT COUNT(*) AS c FROM projetos WHERE solicitante_id = ? AND ativo = 1', [userId]],
      ['SELECT COUNT(*) AS c FROM cronograma_tarefas WHERE responsavel_id = ? AND (ativo IS NULL OR ativo = 1)', [userId]],
      ['SELECT COUNT(*) AS c FROM cronograma_tarefas WHERE executor_id = ? AND (ativo IS NULL OR ativo = 1)', [userId]],
      ['SELECT COUNT(*) AS c FROM projeto_status_historico WHERE usuario_id = ?', [userId]],
      ['SELECT COUNT(*) AS c FROM projeto_historico_alteracoes WHERE usuario_id = ?', [userId]],
      ['SELECT COUNT(*) AS c FROM workflow_aprovacao_participantes WHERE usuario_id = ?', [userId]],
    ]
    for (const [sql, params] of queries) {
      try {
        const row = db.queryOne<{ c: number }>(sql, params)
        if ((row?.c ?? 0) > 0) return true
      } catch { /* tabela pode não existir */ }
    }
    return false
  },

  async hardDelete(id: number): Promise<void> {
    await asyncDb.execute(`DELETE FROM ${T_USUARIOS} WHERE id = ?`, [id])
  },

  // ── Suporte a merge em JS para queries que hoje cruzam `usuarios` com tabelas
  // ainda em SQLite (projetos, cronograma_tarefas, comites, etc.) — ver
  // lib/repositories/{projetos,cronograma,comites,financeiro}.ts, lib/db/auditoria.ts,
  // lib/orcamento.ts, lib/notificacoes.ts, lib/meu-trabalho.ts e as rotas de API que
  // faziam JOIN direto com usuarios.

  /** Dado uma lista de ids de usuários, retorna nome/cargo em lote (Map pra lookup O(1)). */
  async findNomesPorIds(ids: number[]): Promise<Map<number, { nome: string; cargo: string | null }>> {
    const unicos = [...new Set(ids)]
    if (unicos.length === 0) return new Map()
    const rows = await asyncDb.queryMany<{ id: number; nome: string; cargo: string | null }>(
      `SELECT id, nome, cargo FROM ${T_USUARIOS} WHERE id = ANY(?)`,
      [unicos]
    )
    return new Map(rows.map(r => [r.id, { nome: r.nome, cargo: r.cargo }]))
  },
}
