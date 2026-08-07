import { db } from '@/lib/database'
import { drizzleDb } from '@/lib/database/drizzle'
import { configGlobal } from '@/lib/db/drizzle/schema'
import { eq, asc, sql as drizzleSql } from 'drizzle-orm'

export const ConfiguracoesRepository = {
  // ── Config global (chave/valor) — Drizzle ORM ─────────────────────────────

  findByKey(chave: string): string | null {
    const rows = drizzleDb()
      .select({ valor: configGlobal.valor })
      .from(configGlobal)
      .where(eq(configGlobal.chave, chave))
      .limit(1)
      .all()
    return rows[0]?.valor ?? null
  },

  upsert(chave: string, valor: string, descricao?: string): void {
    drizzleDb()
      .insert(configGlobal)
      .values({ chave, valor, descricao: descricao ?? null })
      .onConflictDoUpdate({
        target: configGlobal.chave,
        set: { valor, updated_at: drizzleSql`CURRENT_TIMESTAMP` },
      })
      .run()
  },

  findAll(): { chave: string; valor: string; descricao: string | null }[] {
    return drizzleDb()
      .select({ chave: configGlobal.chave, valor: configGlobal.valor, descricao: configGlobal.descricao })
      .from(configGlobal)
      .orderBy(asc(configGlobal.chave))
      .all()
  },

  // ── Status do projeto ──────────────────────────────────────────────────────

  findStatusProjeto(): { codigo: string; label: string; ordem: number; cor?: string | null }[] {
    return db.queryMany(
      'SELECT codigo, label, ordem, cor FROM config_status_projeto ORDER BY ordem'
    )
  },

  findConfigStatusAll(): { id: number; codigo: string; label: string; descricao: string; cor: string; ordem: number; ativo: number; is_initial: number }[] {
    return db.queryMany('SELECT * FROM config_status_projeto ORDER BY ordem ASC')
  },

  findStatusInicial(): string {
    const row = db.queryOne<{ codigo: string }>(
      'SELECT codigo FROM config_status_projeto WHERE is_initial=1 AND ativo=1 ORDER BY ordem LIMIT 1'
    )
    return row?.codigo ?? 'PROPOSTA'
  },

  // ── Tipos e criticidades de tarefa ─────────────────────────────────────────

  findTiposTarefa(apenasAtivos = true): { id: number; nome: string; descricao: string | null }[] {
    const where = apenasAtivos ? 'WHERE ativo = 1' : ''
    return db.queryMany(
      `SELECT id, nome, descricao FROM tipos_tarefa ${where} ORDER BY nome`
    )
  },

  findCriticidades(apenasAtivas = true): { id: number; nome: string; nivel: number; cor: string | null }[] {
    const where = apenasAtivas ? 'WHERE ativo = 1' : ''
    return db.queryMany(
      `SELECT id, nome, nivel, cor FROM criticidades ${where} ORDER BY nivel`
    )
  },

  // ── Financeiro ─────────────────────────────────────────────────────────────

  findConfiguracaoFinanceira(): { taxa_desconto: number; moeda: string; ano_base: number } | undefined {
    return db.queryOne(
      'SELECT taxa_desconto, moeda, ano_base FROM config_financeiro LIMIT 1'
    )
  },

  upsertConfiguracaoFinanceira(dados: { taxa_desconto?: number; moeda?: string; ano_base?: number }): void {
    const atual = db.queryOne<{ id: number }>('SELECT id FROM config_financeiro LIMIT 1')
    if (atual) {
      const sets: string[] = []
      const params: unknown[] = []
      if (dados.taxa_desconto !== undefined) { sets.push('taxa_desconto = ?'); params.push(dados.taxa_desconto) }
      if (dados.moeda) { sets.push('moeda = ?'); params.push(dados.moeda) }
      if (dados.ano_base !== undefined) { sets.push('ano_base = ?'); params.push(dados.ano_base) }
      if (sets.length) {
        params.push(atual.id)
        db.execute(`UPDATE config_financeiro SET ${sets.join(', ')} WHERE id = ?`, params)
      }
    } else {
      db.execute(
        'INSERT INTO config_financeiro (taxa_desconto, moeda, ano_base) VALUES (?,?,?)',
        [dados.taxa_desconto ?? 12, dados.moeda ?? 'BRL', dados.ano_base ?? new Date().getFullYear()]
      )
    }
  },
}
