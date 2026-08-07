import { db } from '@/lib/database'
import { drizzleDb } from '@/lib/database/drizzle'
import { usuarios as usuariosTable } from '@/lib/db/drizzle/schema'
import { eq, sql as drizzleSql } from 'drizzle-orm'

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

export const UsuariosRepository = {
  findAll(apenasAtivos = true): Usuario[] {
    const where = apenasAtivos ? 'WHERE ativo = 1' : ''
    return db.queryMany<Usuario>(
      `SELECT u.*, d.nome AS diretoria_nome, a.nome AS area_nome
       FROM usuarios u
       LEFT JOIN diretorias d ON d.id = u.diretoria_id
       LEFT JOIN areas a ON a.id = u.area_id
       ${where} ORDER BY u.nome`,
    )
  },

  findById(id: number): Usuario | undefined {
    return db.queryOne<Usuario>(
      `SELECT u.*, d.nome AS diretoria_nome, a.nome AS area_nome
       FROM usuarios u
       LEFT JOIN diretorias d ON d.id = u.diretoria_id
       LEFT JOIN areas a ON a.id = u.area_id
       WHERE u.id = ?`,
      [id]
    )
  },

  findByCpf(cpf: string): (Usuario & { senha_hash?: string }) | undefined {
    return db.queryOne<Usuario & { senha_hash?: string }>(
      'SELECT * FROM usuarios WHERE cpf = ? AND ativo = 1',
      [cpf]
    )
  },

  findByEmail(email: string): Usuario | undefined {
    return db.queryOne<Usuario>(
      'SELECT * FROM usuarios WHERE email = ? AND ativo = 1',
      [email]
    )
  },

  create(dados: Partial<Usuario> & { senha_hash: string }): number | bigint {
    const result = drizzleDb()
      .insert(usuariosTable)
      .values({
        nome: dados.nome!,
        email: dados.email!,
        cpf: dados.cpf!,
        senha_hash: dados.senha_hash,
        cargo: dados.cargo ?? null,
        diretoria_id: dados.diretoria_id ?? null,
        area_id: dados.area_id ?? null,
        perfil_id: 1,
        ativo: 1,
      })
      .run()
    return result.lastInsertRowid
  },

  update(id: number, dados: Partial<Usuario>): void {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = ['nome', 'email', 'perfil', 'cargo', 'diretoria_id', 'area_id'] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    db.execute(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  updateSenha(id: number, senhaHash: string): void {
    drizzleDb()
      .update(usuariosTable)
      .set({ senha_hash: senhaHash, updated_at: drizzleSql`CURRENT_TIMESTAMP` })
      .where(eq(usuariosTable.id, id))
      .run()
  },

  softDelete(id: number): void {
    drizzleDb()
      .update(usuariosTable)
      .set({ ativo: 0, updated_at: drizzleSql`CURRENT_TIMESTAMP` })
      .where(eq(usuariosTable.id, id))
      .run()
  },

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

  // ── Queries específicas para api/usuarios ─────────────────────────────────

  findAllWithPerfil(all: boolean): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT u.id, u.cpf, u.nome, u.email, u.cargo, u.ativo,
              p.codigo as perfil_codigo, p.id as perfil_id, d.nome as diretoria_nome, u.diretoria_id,
              a.nome as area_nome, u.area_id
       FROM usuarios u JOIN perfis p ON u.perfil_id=p.id
       LEFT JOIN diretorias d ON u.diretoria_id=d.id
       LEFT JOIN areas a ON u.area_id=a.id
       ${all ? '' : 'WHERE u.ativo=1'}
       ORDER BY u.nome`
    )
  },

  findByEmailOrCpf(cpf: string, email: string): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      'SELECT id FROM usuarios WHERE cpf=? OR email=?',
      [cpf, email]
    )
  },

  createWithPerfilId(dados: {
    cpf: string; nome: string; email: string; senhaHash: string;
    cargo: string | null; perfil_id: number;
    diretoria_id: number | null; area_id: number | null
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO usuarios (cpf, nome, email, senha_hash, cargo, perfil_id, diretoria_id, area_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [dados.cpf, dados.nome, dados.email, dados.senhaHash, dados.cargo,
       dados.perfil_id, dados.diretoria_id, dados.area_id]
    )
    return result.lastInsertRowid
  },

  // ── Queries para lib/auth.ts ───────────────────────────────────────────────

  findByCpfForLogin(cpf: string): Record<string, unknown> | undefined {
    return db.queryOne(
      `SELECT u.*, p.codigo as perfil_codigo, d.nome as diretoria_nome
       FROM usuarios u
       JOIN perfis p ON u.perfil_id = p.id
       LEFT JOIN diretorias d ON u.diretoria_id = d.id
       WHERE u.cpf = ? AND u.ativo = 1`,
      [cpf]
    )
  },

  updateUltimoLogin(id: number): void {
    db.execute('UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?', [id])
  },

  // ── Queries para api/aprovadores ──────────────────────────────────────────

  findAprovadores(): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT da.*, u.nome as usuario_nome, u.cargo
       FROM documento_aprovadores da
       JOIN usuarios u ON da.usuario_id = u.id
       WHERE da.ativo = 1
       ORDER BY da.tipo_documento, da.ordem`
    )
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

  // ── Queries para api/usuarios/[id] ────────────────────────────────────────

  findRawById(id: number): Record<string, unknown> | undefined {
    return db.queryOne('SELECT * FROM usuarios WHERE id = ?', [id])
  },

  checkCpfDuplicado(cpf: string, excludeId: number): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      'SELECT id FROM usuarios WHERE cpf = ? AND id != ?',
      [cpf, excludeId]
    )
  },

  checkEmailDuplicado(email: string, excludeId: number): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      'SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = LOWER(?) AND id != ?',
      [email, excludeId]
    )
  },

  findPerfilById(id: number): { id: number } | undefined {
    return db.queryOne<{ id: number }>('SELECT id FROM perfis WHERE id = ?', [id])
  },

  updateFull(id: number, fields: Record<string, unknown>): void {
    const allowed = ['nome', 'cpf', 'email', 'cargo', 'perfil_id', 'diretoria_id', 'area_id', 'ativo', 'senha_hash']
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields) { sets.push(`${campo} = ?`); params.push(fields[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    db.execute(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, params)
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

  hardDelete(id: number): void {
    db.execute('DELETE FROM usuarios WHERE id = ?', [id])
  },
}
