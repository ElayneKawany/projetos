import { asyncDb } from '@/lib/database'

// Tabelas Postgres reais (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts) —
// precisam de aspas duplas por causa do case: sem isso o Postgres dobra pra minúsculo e não acha a tabela.
const T_CONFIG_GLOBAL = '"AI"."TI_PMO_CONFIG_GLOBAL"'
const T_CONFIG_STATUS_PROJETO = '"AI"."TI_PMO_CONFIG_STATUS_PROJETO"'

export const ConfiguracoesRepository = {
  // ── Config global (chave/valor) ────────────────────────────────────────────

  async findByKey(chave: string): Promise<string | null> {
    const row = await asyncDb.queryOne<{ valor: string }>(
      `SELECT valor FROM ${T_CONFIG_GLOBAL} WHERE chave = ? LIMIT 1`,
      [chave]
    )
    return row?.valor ?? null
  },

  async upsert(chave: string, valor: string, descricao?: string): Promise<void> {
    await asyncDb.execute(
      `INSERT INTO ${T_CONFIG_GLOBAL} (chave, valor, descricao) VALUES (?, ?, ?)
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP`,
      [chave, valor, descricao ?? null]
    )
  },

  async findAll(): Promise<{ chave: string; valor: string; descricao: string | null }[]> {
    return asyncDb.queryMany(
      `SELECT chave, valor, descricao FROM ${T_CONFIG_GLOBAL} ORDER BY chave ASC`
    )
  },

  // ── Status do projeto ──────────────────────────────────────────────────────

  async findStatusProjeto(): Promise<{ codigo: string; label: string; ordem: number; cor?: string | null }[]> {
    return asyncDb.queryMany(
      `SELECT codigo, label, ordem, cor FROM ${T_CONFIG_STATUS_PROJETO} ORDER BY ordem`
    )
  },

  async findConfigStatusAll(): Promise<{ id: number; codigo: string; label: string; descricao: string; cor: string; ordem: number; ativo: number; is_initial: number }[]> {
    return asyncDb.queryMany(`SELECT * FROM ${T_CONFIG_STATUS_PROJETO} ORDER BY ordem ASC`)
  },

  async findStatusInicial(): Promise<string> {
    const row = await asyncDb.queryOne<{ codigo: string }>(
      `SELECT codigo FROM ${T_CONFIG_STATUS_PROJETO} WHERE is_initial = true AND ativo = true ORDER BY ordem LIMIT 1`
    )
    return row?.codigo ?? 'PROPOSTA'
  },

  // ── Tipos e criticidades de tarefa ─────────────────────────────────────────
  // NOTA: findTiposTarefa/findCriticidades/*ConfiguracaoFinanceira referenciam
  // tabelas (tipos_tarefa, criticidades, config_financeiro) que não existem no
  // schema real (nem em lib/db/schema.sql, nem em runMigrations()) — conferido:
  // nenhuma delas tem uma única chamada em todo o código (achado pré-existente,
  // não introduzido por esta migração; fora de escopo desta fatia corrigir).

  async findTiposTarefa(apenasAtivos = true): Promise<{ id: number; nome: string; descricao: string | null }[]> {
    const where = apenasAtivos ? 'WHERE ativo = 1' : ''
    return asyncDb.queryMany(
      `SELECT id, nome, descricao FROM tipos_tarefa ${where} ORDER BY nome`
    )
  },

  async findCriticidades(apenasAtivas = true): Promise<{ id: number; nome: string; nivel: number; cor: string | null }[]> {
    const where = apenasAtivas ? 'WHERE ativo = 1' : ''
    return asyncDb.queryMany(
      `SELECT id, nome, nivel, cor FROM criticidades ${where} ORDER BY nivel`
    )
  },

  // ── Financeiro ─────────────────────────────────────────────────────────────

  async findConfiguracaoFinanceira(): Promise<{ taxa_desconto: number; moeda: string; ano_base: number } | undefined> {
    return asyncDb.queryOne(
      'SELECT taxa_desconto, moeda, ano_base FROM config_financeiro LIMIT 1'
    )
  },

  async upsertConfiguracaoFinanceira(dados: { taxa_desconto?: number; moeda?: string; ano_base?: number }): Promise<void> {
    const atual = await asyncDb.queryOne<{ id: number }>('SELECT id FROM config_financeiro LIMIT 1')
    if (atual) {
      const sets: string[] = []
      const params: unknown[] = []
      if (dados.taxa_desconto !== undefined) { sets.push('taxa_desconto = ?'); params.push(dados.taxa_desconto) }
      if (dados.moeda) { sets.push('moeda = ?'); params.push(dados.moeda) }
      if (dados.ano_base !== undefined) { sets.push('ano_base = ?'); params.push(dados.ano_base) }
      if (sets.length) {
        params.push(atual.id)
        await asyncDb.execute(`UPDATE config_financeiro SET ${sets.join(', ')} WHERE id = ?`, params)
      }
    } else {
      await asyncDb.execute(
        'INSERT INTO config_financeiro (taxa_desconto, moeda, ano_base) VALUES (?,?,?)',
        [dados.taxa_desconto ?? 12, dados.moeda ?? 'BRL', dados.ano_base ?? new Date().getFullYear()]
      )
    }
  },
}
