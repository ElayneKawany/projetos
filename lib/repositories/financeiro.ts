import { db, asyncDb } from '@/lib/database'
import { UsuariosRepository } from './usuarios'

// Tabela Postgres real (schema AI, prefixo TI_PMO_, ver lib/db/drizzle/schema.postgres.ts).
const T_VIABILIDADE = '"AI"."TI_PMO_VIABILIDADE"'

export interface FinanceiroContrato {
  id: number
  projeto_id: number
  numero_contrato?: string | null
  contratado: string
  tipo_contrato: string
  descricao_servico?: string | null
  valor_aprovado: number
  status: string
  observacoes?: string | null
  ativo?: number
  criado_por?: number | null
  created_at?: string
  updated_at?: string
}

export interface FinanceiroPagamento {
  id: number
  contrato_id: number
  numero_documento?: string | null
  tipo_documento?: string
  nota_fiscal?: string | null
  data_pagamento: string
  competencia?: string | null
  valor_pago: number
  observacoes?: string | null
  ativo?: number
  created_at?: string
}

export interface ResumoFinanceiro {
  capex_viabilidade: number
  opex_viabilidade: number
  total_aprovado_contratos: number
  total_pago: number
  qtd_contratos: number
}

export const FinanceiroRepository = {
  // ── Contratos ──────────────────────────────────────────────────────────────

  findContratosByProjectId(projetoId: number): FinanceiroContrato[] {
    return db.queryMany<FinanceiroContrato>(
      `SELECT fc.*,
              COALESCE(
                (SELECT SUM(fp.valor_pago)
                 FROM financeiro_pagamentos fp
                 WHERE fp.contrato_id = fc.id
                   AND fp.contrato_id IS NOT NULL
                   AND (fp.ativo IS NULL OR fp.ativo = 1)
                ), 0
              ) AS valor_pago_total
       FROM financeiro_contratos fc
       WHERE fc.projeto_id = ? AND (fc.ativo IS NULL OR fc.ativo = 1)
       ORDER BY fc.created_at`,
      [projetoId]
    )
  },

  findContratoById(id: number): FinanceiroContrato | undefined {
    return db.queryOne<FinanceiroContrato>(
      'SELECT * FROM financeiro_contratos WHERE id = ? AND (ativo IS NULL OR ativo = 1)',
      [id]
    )
  },

  createContrato(dados: Partial<FinanceiroContrato>): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_contratos
         (projeto_id, numero_contrato, contratado, tipo_contrato, descricao_servico,
          valor_aprovado, status, observacoes, ativo, criado_por)
       VALUES (?,?,?,?,?,?,?,?,1,?)`,
      [
        dados.projeto_id, dados.numero_contrato ?? null, dados.contratado,
        dados.tipo_contrato ?? 'SERVICO', dados.descricao_servico ?? null,
        dados.valor_aprovado ?? 0, dados.status ?? 'ATIVO', dados.observacoes ?? null,
        dados.criado_por ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  updateContrato(id: number, dados: Partial<FinanceiroContrato>): void {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = [
      'numero_contrato', 'contratado', 'tipo_contrato', 'descricao_servico',
      'valor_aprovado', 'status', 'observacoes',
    ] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    db.execute(`UPDATE financeiro_contratos SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  softDeleteContrato(id: number): void {
    db.execute(
      'UPDATE financeiro_contratos SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    )
  },

  // ── Pagamentos ─────────────────────────────────────────────────────────────

  findPagamentosByContratoId(contratoId: number): FinanceiroPagamento[] {
    return db.queryMany<FinanceiroPagamento>(
      `SELECT * FROM financeiro_pagamentos
       WHERE contrato_id = ? AND (ativo IS NULL OR ativo = 1)
       ORDER BY data_pagamento`,
      [contratoId]
    )
  },

  findPagamentosByProjectId(projetoId: number): FinanceiroPagamento[] {
    return db.queryMany<FinanceiroPagamento>(
      `SELECT fp.*
       FROM financeiro_pagamentos fp
       JOIN financeiro_contratos fc ON fc.id = fp.contrato_id
       WHERE fc.projeto_id = ? AND fp.contrato_id IS NOT NULL
         AND (fp.ativo IS NULL OR fp.ativo = 1)
       ORDER BY fp.data_pagamento`,
      [projetoId]
    )
  },

  createPagamento(dados: Partial<FinanceiroPagamento>): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_pagamentos
         (contrato_id, numero_documento, tipo_documento, nota_fiscal,
          data_pagamento, competencia, valor_pago, observacoes, ativo)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [
        dados.contrato_id, dados.numero_documento ?? null,
        dados.tipo_documento ?? 'NF', dados.nota_fiscal ?? null,
        dados.data_pagamento, dados.competencia ?? null,
        dados.valor_pago ?? 0, dados.observacoes ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  softDeletePagamento(id: number): void {
    db.execute(
      'UPDATE financeiro_pagamentos SET ativo = 0 WHERE id = ?',
      [id]
    )
  },

  updatePagamento(id: number, dados: Partial<FinanceiroPagamento>): void {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = [
      'numero_documento', 'tipo_documento', 'nota_fiscal', 'data_pagamento',
      'competencia', 'valor_pago', 'observacoes',
    ] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    params.push(id)
    db.execute(`UPDATE financeiro_pagamentos SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  findPagamentoById(id: number): FinanceiroPagamento | undefined {
    return db.queryOne<FinanceiroPagamento>(
      'SELECT * FROM financeiro_pagamentos WHERE id = ?',
      [id]
    )
  },

  // ── Lançamentos (financeiro_lancamentos — módulo legado) ───────────────────

  async findLancamentos(projetoId: number): Promise<Record<string, unknown>[]> {
    const rows = db.queryMany<Record<string, unknown> & { criado_por: number | null }>(
      `SELECT fl.*
       FROM financeiro_lancamentos fl
       WHERE fl.projeto_id = ?
       ORDER BY fl.created_at DESC`,
      [projetoId]
    )
    const nomes = await UsuariosRepository.findNomesPorIds(
      rows.map(r => r.criado_por).filter((v): v is number => v != null)
    )
    return rows.map(r => ({
      ...r,
      criador_nome: r.criado_por != null ? nomes.get(r.criado_por)?.nome ?? null : null,
    }))
  },

  insertLancamento(dados: {
    projeto_id: number
    tipo: string
    categoria: string
    descricao: string
    fornecedor?: string | null
    numero_doc?: string | null
    valor: number
    data_lancamento: string
    competencia?: string | null
    observacoes?: string | null
    arquivo_path?: string | null
    criado_por: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_lancamentos
         (projeto_id, tipo, categoria, descricao, fornecedor, numero_doc, valor,
          data_lancamento, competencia, observacoes, arquivo_path, criado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.projeto_id, dados.tipo, dados.categoria, dados.descricao,
        dados.fornecedor ?? null, dados.numero_doc ?? null, dados.valor,
        dados.data_lancamento, dados.competencia ?? null, dados.observacoes ?? null,
        dados.arquivo_path ?? null, dados.criado_por,
      ]
    )
    return result.lastInsertRowid
  },

  insertLancamentoRoute(dados: {
    projeto_id: number
    tipo: string
    categoria: string
    descricao: string
    fornecedor?: string | null
    numero_doc?: string | null
    valor: number
    data_lancamento: string
    competencia?: string | null
    observacoes?: string | null
    arquivo_nf?: string | null
    criado_por: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_lancamentos
         (projeto_id, tipo, categoria, descricao, fornecedor, numero_doc,
          valor, data_lancamento, competencia, observacoes, arquivo_nf,
          status, criado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'PENDENTE',?)`,
      [
        dados.projeto_id, dados.tipo, dados.categoria, dados.descricao,
        dados.fornecedor ?? null, dados.numero_doc ?? null, dados.valor,
        dados.data_lancamento, dados.competencia ?? null, dados.observacoes ?? null,
        dados.arquivo_nf ?? null, dados.criado_por,
      ]
    )
    return result.lastInsertRowid
  },

  // ── Movimentos (financeiro_movimentos) ─────────────────────────────────────

  findMovimentos(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT
         m.*,
         oi.nome  AS item_nome,
         og.nome  AS grupo_nome,
         og.tipo  AS grupo_tipo,
         (SELECT COALESCE(SUM(p.valor_pago), 0)
          FROM financeiro_pagamentos p
          WHERE p.movimento_id = m.id) AS valor_pago
       FROM financeiro_movimentos m
       LEFT JOIN orcamento_itens  oi ON oi.id = m.item_id
       LEFT JOIN orcamento_grupos og ON og.id = oi.grupo_id
       WHERE m.projeto_id = ?
       ORDER BY m.created_at DESC`,
      [projetoId]
    )
  },

  insertMovimento(dados: {
    projeto_id: number
    item_id?: number | null
    tipo_movimento: string
    numero_doc?: string | null
    fornecedor?: string | null
    valor_total: number
    data_emissao?: string | null
    data_vencimento?: string | null
    observacoes?: string | null
    criado_por: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_movimentos
         (projeto_id, item_id, tipo_movimento, numero_doc, fornecedor,
          valor_total, data_emissao, data_vencimento, observacoes, criado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.projeto_id, dados.item_id ?? null, dados.tipo_movimento,
        dados.numero_doc ?? null, dados.fornecedor ?? null, dados.valor_total,
        dados.data_emissao ?? null, dados.data_vencimento ?? null,
        dados.observacoes ?? null, dados.criado_por,
      ]
    )
    return result.lastInsertRowid
  },

  findMovimentoById(id: number): Record<string, unknown> | undefined {
    return db.queryOne('SELECT * FROM financeiro_movimentos WHERE id = ?', [id])
  },

  updateMovimentoStatus(id: number, status: string, observacoes: string | null, aprovadoPor: number): void {
    db.execute(
      `UPDATE financeiro_movimentos
       SET status = ?, observacoes = ?, aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, observacoes, aprovadoPor, id]
    )
  },

  // ── Indicadores financeiros ────────────────────────────────────────────────

  sumMovimentosItem(itemId: number, statuses: string[]): number {
    const placeholders = statuses.map(() => '?').join(', ')
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(valor_total), 0) AS total FROM financeiro_movimentos WHERE item_id = ? AND status IN (${placeholders})`,
      [itemId, ...statuses]
    )
    return row?.total ?? 0
  },

  sumPagamentosItem(itemId: number): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(fp.valor_pago), 0) AS total
       FROM financeiro_pagamentos fp
       JOIN financeiro_movimentos fm ON fm.id = fp.movimento_id
       WHERE fm.item_id = ?`,
      [itemId]
    )
    return row?.total ?? 0
  },

  sumMovimentosProjeto(projetoId: number, statuses: string[]): number {
    const placeholders = statuses.map(() => '?').join(', ')
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(fm.valor_total), 0) AS total FROM financeiro_movimentos fm WHERE fm.projeto_id = ? AND fm.status IN (${placeholders})`,
      [projetoId, ...statuses]
    )
    return row?.total ?? 0
  },

  sumPagamentosProjeto(projetoId: number): number {
    const row = db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(fp.valor_pago), 0) AS total FROM financeiro_pagamentos fp WHERE fp.projeto_id = ?',
      [projetoId]
    )
    return row?.total ?? 0
  },

  findProjetoCapexOpex(projetoId: number): { capex_aprovado: number; opex_aprovado: number } | undefined {
    return db.queryOne<{ capex_aprovado: number; opex_aprovado: number }>(
      'SELECT capex_aprovado, opex_aprovado FROM projetos WHERE id = ?',
      [projetoId]
    )
  },

  sumLancamentosAprovados(projetoId: number, tipo: string): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(valor), 0) AS total FROM financeiro_lancamentos WHERE projeto_id = ? AND tipo = ? AND status = 'APROVADO'`,
      [projetoId, tipo]
    )
    return row?.total ?? 0
  },

  // ── Inconsistências ────────────────────────────────────────────────────────

  findEstourosOrcamentarios(projetoId: number): { id: number; nome: string; valor_aprovado: number; comprometido: number }[] {
    return db.queryMany(
      `SELECT oi.id, oi.nome, oi.valor_aprovado,
              COALESCE(SUM(fm.valor_total), 0) AS comprometido
       FROM orcamento_itens oi
       LEFT JOIN financeiro_movimentos fm ON fm.item_id = oi.id
         AND fm.status IN ('PENDENTE', 'APROVADO')
       WHERE oi.projeto_id = ? AND oi.ativo = 1
       GROUP BY oi.id
       HAVING comprometido > oi.valor_aprovado`,
      [projetoId]
    ) as { id: number; nome: string; valor_aprovado: number; comprometido: number }[]
  },

  countMovimentosOrfaos(projetoId: number): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM financeiro_movimentos WHERE projeto_id = ? AND item_id IS NULL AND status != 'CANCELADO'`,
      [projetoId]
    )
    return row?.total ?? 0
  },

  findItensSemMovimento(projetoId: number): { id: number; nome: string }[] {
    return db.queryMany(
      `SELECT oi.id, oi.nome
       FROM orcamento_itens oi
       LEFT JOIN financeiro_movimentos fm ON fm.item_id = oi.id AND fm.status != 'CANCELADO'
       WHERE oi.projeto_id = ? AND oi.ativo = 1 AND oi.status = 'ATIVO' AND fm.id IS NULL`,
      [projetoId]
    ) as { id: number; nome: string }[]
  },

  findDocumentosDuplicados(projetoId: number): { numero_doc: string; qtd: number }[] {
    return db.queryMany(
      `SELECT numero_doc, COUNT(*) AS qtd
       FROM financeiro_movimentos
       WHERE projeto_id = ? AND numero_doc IS NOT NULL AND numero_doc != '' AND status != 'CANCELADO'
       GROUP BY numero_doc
       HAVING qtd > 1`,
      [projetoId]
    ) as { numero_doc: string; qtd: number }[]
  },

  // ── Configuração financeira ────────────────────────────────────────────────

  findConfigFinanceira(): { chave: string; valor: string }[] {
    return db.queryMany<{ chave: string; valor: string }>(
      `SELECT chave, valor FROM config_global WHERE chave IN ('selic','taxa_desconto','inflacao')`,
      []
    )
  },

  // ── Viabilidade (usada por lib/financeiro.ts) ──────────────────────────────

  async findViabilidadeRascunho(projetoId: number): Promise<{ id: number; versao: number } | undefined> {
    return asyncDb.queryOne<{ id: number; versao: number }>(
      `SELECT id, versao FROM ${T_VIABILIDADE} WHERE projeto_id = ? AND status = 'RASCUNHO' ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
  },

  async maxVersaoViabilidade(projetoId: number): Promise<number> {
    const row = await asyncDb.queryOne<{ v: number | null }>(
      `SELECT MAX(versao) AS v FROM ${T_VIABILIDADE} WHERE projeto_id = ?`,
      [projetoId]
    )
    return row?.v ?? 0
  },

  async updateViabilidade(id: number, dados: Record<string, unknown>): Promise<void> {
    await asyncDb.execute(
      `UPDATE ${T_VIABILIDADE} SET
         selic=?, taxa_desconto=?, inflacao=?, investimento_total=?,
         receitas_previstas=?, custos_previstos=?, economia_prevista=?,
         roi=?, tir=?, payback_meses=?,
         impacto_operacional=?, recursos_necessarios=?, mudanca_processo=?,
         tecnologias=?, integracoes=?, infraestrutura=?,
         riscos=?, impactos=?, data_inicio_prev=?, data_fim_prev=?,
         marcos=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        dados.selic ?? null, dados.taxa_desconto ?? null, dados.inflacao ?? null,
        dados.investimento_total ?? null,
        dados.receitas_previstas ?? null, dados.custos_previstos ?? null, dados.economia_prevista ?? null,
        dados.roi ?? null, dados.tir ?? null, dados.payback_meses ?? null,
        dados.impacto_operacional ?? null, dados.recursos_necessarios ?? null, dados.mudanca_processo ?? null,
        dados.tecnologias ?? null, dados.integracoes ?? null, dados.infraestrutura ?? null,
        dados.riscos ?? null, dados.impactos ?? null,
        dados.data_inicio_prev ?? null, dados.data_fim_prev ?? null,
        dados.marcos ?? null, id,
      ]
    )
  },

  async insertViabilidade(dados: Record<string, unknown>): Promise<number | null> {
    const result = await asyncDb.execute(
      `INSERT INTO ${T_VIABILIDADE}
         (projeto_id, versao, selic, taxa_desconto, inflacao, investimento_total,
          receitas_previstas, custos_previstos, economia_prevista,
          roi, tir, payback_meses,
          impacto_operacional, recursos_necessarios, mudanca_processo,
          tecnologias, integracoes, infraestrutura,
          riscos, impactos, data_inicio_prev, data_fim_prev, marcos, criado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       RETURNING id`,
      [
        dados.projeto_id ?? null, dados.versao ?? null,
        dados.selic ?? null, dados.taxa_desconto ?? null, dados.inflacao ?? null,
        dados.investimento_total ?? null,
        dados.receitas_previstas ?? null, dados.custos_previstos ?? null, dados.economia_prevista ?? null,
        dados.roi ?? null, dados.tir ?? null, dados.payback_meses ?? null,
        dados.impacto_operacional ?? null, dados.recursos_necessarios ?? null, dados.mudanca_processo ?? null,
        dados.tecnologias ?? null, dados.integracoes ?? null, dados.infraestrutura ?? null,
        dados.riscos ?? null, dados.impactos ?? null,
        dados.data_inicio_prev ?? null, dados.data_fim_prev ?? null,
        dados.marcos ?? null, dados.criado_por ?? null,
      ]
    )
    return result.insertedId
  },

  // ── Resumo executivo ───────────────────────────────────────────────────────

  async resumoExecutivo(projetoId: number): Promise<ResumoFinanceiro> {
    const via = await asyncDb.queryOne<{ capex: number; opex: number }>(
      `SELECT capex, opex FROM ${T_VIABILIDADE} WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
    const contratos = db.queryOne<{ total_aprovado: number; qtd: number }>(
      `SELECT COALESCE(SUM(valor_aprovado),0) AS total_aprovado, COUNT(*) AS qtd
       FROM financeiro_contratos WHERE projeto_id = ? AND (ativo IS NULL OR ativo = 1)`,
      [projetoId]
    )
    const pago = db.queryOne<{ total_pago: number }>(
      `SELECT COALESCE(SUM(fp.valor_pago),0) AS total_pago
       FROM financeiro_pagamentos fp
       JOIN financeiro_contratos fc ON fc.id = fp.contrato_id
       WHERE fc.projeto_id = ? AND fp.contrato_id IS NOT NULL
         AND (fp.ativo IS NULL OR fp.ativo = 1)`,
      [projetoId]
    )
    return {
      capex_viabilidade: via?.capex ?? 0,
      opex_viabilidade: via?.opex ?? 0,
      total_aprovado_contratos: contratos?.total_aprovado ?? 0,
      total_pago: pago?.total_pago ?? 0,
      qtd_contratos: contratos?.qtd ?? 0,
    }
  },

  // ── Contratos (para lib/financeiro/contratos.ts) ───────────────────────────

  findContratosAtivosProjeto(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT id, projeto_id, numero_contrato, contratado, tipo_contrato,
              COALESCE(natureza_financeira, 'CAPEX') AS natureza_financeira,
              descricao_servico, categoria, valor_aprovado, status,
              COALESCE(observacao, observacoes) AS observacao,
              ativo, criado_por, created_at, updated_at
       FROM financeiro_contratos
       WHERE projeto_id = ? AND ativo = 1 ORDER BY created_at ASC`,
      [projetoId]
    )
  },

  findContratoByIdCompleto(id: number): Record<string, unknown> | undefined {
    return db.queryOne(
      `SELECT id, projeto_id, numero_contrato, contratado, tipo_contrato,
              COALESCE(natureza_financeira, 'CAPEX') AS natureza_financeira,
              descricao_servico, categoria, valor_aprovado, status,
              COALESCE(observacao, observacoes) AS observacao,
              ativo, criado_por, created_at, updated_at
       FROM financeiro_contratos WHERE id = ?`,
      [id]
    )
  },

  insertContratoCompleto(dados: {
    projeto_id: number; numero_contrato?: string | null; contratado: string
    tipo_contrato?: string; natureza_financeira: string; descricao_servico?: string | null
    categoria?: string | null; valor_aprovado: number; observacao?: string | null; criado_por: number
    tipo_projecao?: string | null
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_contratos
         (projeto_id, numero_contrato, contratado, tipo_contrato, natureza_financeira,
          descricao_servico, categoria, valor_aprovado, status, observacao, criado_por, created_at, updated_at, tipo_projecao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?, ?, datetime('now'), datetime('now'), ?)`,
      [
        dados.projeto_id, dados.numero_contrato ?? null, dados.contratado,
        dados.tipo_contrato ?? 'SERVICO', dados.natureza_financeira,
        dados.descricao_servico ?? null, dados.categoria ?? null, dados.valor_aprovado,
        dados.observacao ?? null, dados.criado_por, dados.tipo_projecao ?? 'NENHUMA',
      ]
    )
    return result.lastInsertRowid
  },

  insertProjecaoParcela(dados: {
    contrato_id: number; numero: number; competencia: string; valor_projetado: number
  }): void {
    db.execute(
      `INSERT INTO financeiro_contrato_projecao_parcelas (contrato_id, numero, competencia, valor_projetado)
       VALUES (?, ?, ?, ?)`,
      [dados.contrato_id, dados.numero, dados.competencia, dados.valor_projetado]
    )
  },

  findProjecaoParcelasByContratoId(contratoId: number): Array<{
    id: number; contrato_id: number; numero: number; competencia: string; valor_projetado: number
  }> {
    return db.queryMany(
      `SELECT * FROM financeiro_contrato_projecao_parcelas WHERE contrato_id = ? ORDER BY numero ASC`,
      [contratoId]
    )
  },

  updateContratoCompleto(id: number, dados: {
    numero_contrato?: string | null; contratado?: string; tipo_contrato?: string
    natureza_financeira?: string; descricao_servico?: string | null; categoria?: string | null
    valor_aprovado?: number; status?: string; observacao?: string | null
  }): void {
    db.execute(
      `UPDATE financeiro_contratos SET
         numero_contrato     = COALESCE(?, numero_contrato),
         contratado          = COALESCE(?, contratado),
         tipo_contrato       = COALESCE(?, tipo_contrato),
         natureza_financeira = COALESCE(?, natureza_financeira),
         descricao_servico   = COALESCE(?, descricao_servico),
         categoria           = COALESCE(?, categoria),
         valor_aprovado      = COALESCE(?, valor_aprovado),
         status              = COALESCE(?, status),
         observacao          = COALESCE(?, observacao),
         updated_at          = datetime('now')
       WHERE id = ?`,
      [
        dados.numero_contrato, dados.contratado, dados.tipo_contrato,
        dados.natureza_financeira, dados.descricao_servico, dados.categoria, dados.valor_aprovado,
        dados.status, dados.observacao, id,
      ]
    )
  },

  softDeleteContratoDatetimeNow(id: number): void {
    db.execute(
      "UPDATE financeiro_contratos SET ativo = 0, updated_at = datetime('now') WHERE id = ?",
      [id]
    )
  },

  // ── Dashboard (para lib/financeiro/dashboard.ts) ──────────────────────────

  async findViabilidadeCapexOpex(projetoId: number): Promise<{ capex: number; opex: number }> {
    const row = await asyncDb.queryOne<{ capex: number; opex: number }>(
      `SELECT COALESCE(capex, 0) AS capex, COALESCE(opex, 0) AS opex
       FROM ${T_VIABILIDADE} WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`,
      [projetoId]
    )
    return row ?? { capex: 0, opex: 0 }
  },

  findContratosParaDashboard(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT id, projeto_id, numero_contrato, contratado, tipo_contrato,
              COALESCE(natureza_financeira, 'CAPEX') AS natureza_financeira,
              descricao_servico, categoria, valor_aprovado, status,
              COALESCE(observacao, observacoes) AS observacao,
              ativo, criado_por, created_at, updated_at
       FROM financeiro_contratos
       WHERE projeto_id = ? AND ativo = 1 ORDER BY created_at ASC`,
      [projetoId]
    )
  },

  findPagamentosParaDashboard(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT id, contrato_id, projeto_id, numero_documento, tipo_documento, nota_fiscal,
              data_pagamento, competencia, valor_pago, observacao, arquivo_path,
              ativo, criado_por, created_at, fornecedor, enquadramento_status, contratos_candidatos
       FROM financeiro_pagamentos
       WHERE projeto_id = ? AND contrato_id IS NOT NULL AND (ativo IS NULL OR ativo = 1)
       ORDER BY data_pagamento ASC`,
      [projetoId]
    )
  },

  findDistribuicaoMensalPagamentos(projetoId: number): { mes: string; valor_pago: number }[] {
    return db.queryMany<{ mes: string; valor_pago: number }>(
      `SELECT COALESCE(competencia, substr(data_pagamento, 1, 7)) AS mes,
              SUM(valor_pago) AS valor_pago
       FROM financeiro_pagamentos
       WHERE projeto_id = ?
         AND contrato_id IS NOT NULL
         AND (ativo IS NULL OR ativo = 1)
         AND (competencia IS NOT NULL OR data_pagamento IS NOT NULL)
       GROUP BY mes ORDER BY mes ASC`,
      [projetoId]
    )
  },

  findDistribuicaoPorTipoContrato(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT c.tipo_contrato,
              SUM(c.valor_aprovado) AS valor_aprovado,
              COALESCE(SUM(p.valor_pago), 0) AS valor_pago
       FROM financeiro_contratos c
       LEFT JOIN financeiro_pagamentos p
              ON p.contrato_id = c.id
             AND p.contrato_id IS NOT NULL
             AND (p.ativo IS NULL OR p.ativo = 1)
       WHERE c.projeto_id = ? AND c.ativo = 1
       GROUP BY c.tipo_contrato ORDER BY valor_aprovado DESC`,
      [projetoId]
    )
  },

  // ── Pagamentos (para lib/financeiro/pagamentos.ts) ────────────────────────

  findPagamentosPorContrato(projetoId: number, contratoId?: number): Record<string, unknown>[] {
    const sel = `SELECT id, contrato_id, projeto_id, numero_documento, tipo_documento, nota_fiscal,
                        data_pagamento, competencia, valor_pago, observacao, arquivo_path,
                        ativo, criado_por, created_at, fornecedor, enquadramento_status, contratos_candidatos
                 FROM financeiro_pagamentos`
    if (contratoId !== undefined) {
      return db.queryMany(
        `${sel} WHERE projeto_id = ? AND contrato_id = ? AND (ativo IS NULL OR ativo = 1)
         ORDER BY data_pagamento ASC`,
        [projetoId, contratoId]
      )
    }
    return db.queryMany(
      `${sel} WHERE projeto_id = ? AND contrato_id IS NOT NULL AND (ativo IS NULL OR ativo = 1)
       ORDER BY data_pagamento ASC`,
      [projetoId]
    )
  },

  findPagamentoByIdCompleto(id: number): Record<string, unknown> | undefined {
    return db.queryOne(
      `SELECT id, contrato_id, projeto_id, numero_documento, tipo_documento, nota_fiscal,
              data_pagamento, competencia, valor_pago, observacao, arquivo_path,
              ativo, criado_por, created_at, fornecedor, enquadramento_status, contratos_candidatos
       FROM financeiro_pagamentos WHERE id = ?`,
      [id]
    )
  },

  /** Pagamentos sem contrato vinculado (AGUARDANDO_ANALISE ou SEM_CONTRATO) — para as seções de enquadramento pendente. */
  findPagamentosSemContrato(projetoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT id, contrato_id, projeto_id, numero_documento, tipo_documento, nota_fiscal,
              data_pagamento, competencia, valor_pago, observacao, arquivo_path,
              ativo, criado_por, created_at, fornecedor, enquadramento_status, contratos_candidatos
       FROM financeiro_pagamentos
       WHERE projeto_id = ? AND contrato_id IS NULL AND (ativo IS NULL OR ativo = 1)
         AND enquadramento_status IN ('AGUARDANDO_ANALISE', 'SEM_CONTRATO')
       ORDER BY created_at DESC`,
      [projetoId]
    )
  },

  findContratoParaPagamento(contratoId: number): { contratado: string; valor_aprovado: number } | undefined {
    return db.queryOne<{ contratado: string; valor_aprovado: number }>(
      'SELECT contratado, valor_aprovado FROM financeiro_contratos WHERE id = ? AND ativo = 1',
      [contratoId]
    )
  },

  /**
   * Contratos compatíveis com um lançamento — usados pelo enquadramento (lib/financeiro/enquadramento.ts).
   * Uma única query filtrada por projeto/status/categoria/fornecedor/saldo — sem busca textual pesada.
   * Fornecedor: contrato com `contratado` vazio aceita qualquer fornecedor; senão exige igualdade exata.
   * Saldo: contrato precisa ter saldo suficiente para cobrir o valor do lançamento.
   */
  findContratosCompativeis(criterios: {
    projeto_id: number; categoria: string | null; fornecedor: string; valor: number
  }): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT fc.id, fc.projeto_id, fc.numero_contrato, fc.contratado, fc.tipo_contrato,
              COALESCE(fc.natureza_financeira, 'CAPEX') AS natureza_financeira,
              fc.descricao_servico, fc.categoria, fc.valor_aprovado, fc.status,
              COALESCE(fc.observacao, fc.observacoes) AS observacao,
              fc.ativo, fc.criado_por, fc.created_at, fc.updated_at
       FROM financeiro_contratos fc
       WHERE fc.projeto_id = ? AND fc.ativo = 1 AND fc.status = 'ATIVO'
         AND (fc.categoria IS NULL OR fc.categoria = ?)
         AND (fc.contratado = '' OR fc.contratado = ?)
         AND fc.valor_aprovado - COALESCE((
               SELECT SUM(fp.valor_pago) FROM financeiro_pagamentos fp
               WHERE fp.contrato_id = fc.id AND (fp.ativo IS NULL OR fp.ativo = 1)
             ), 0) >= ?
       ORDER BY fc.created_at ASC`,
      [criterios.projeto_id, criterios.categoria, criterios.fornecedor, criterios.valor]
    )
  },

  insertPagamentoCompleto(dados: {
    contrato_id: number | null; projeto_id: number; numero_documento?: string | null
    tipo_documento?: string; nota_fiscal?: string | null; data_pagamento?: string | null
    competencia?: string | null; valor_pago: number; observacao?: string | null
    arquivo_path?: string | null; criado_por: number
    fornecedor?: string | null; enquadramento_status?: string | null; contratos_candidatos?: string | null
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_pagamentos
         (movimento_id, contrato_id, projeto_id, numero_documento, tipo_documento, nota_fiscal,
          data_pagamento, competencia, valor_pago, observacao, arquivo_path,
          ativo, criado_por, created_at, fornecedor, enquadramento_status, contratos_candidatos)
       VALUES (0, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, 1, ?, datetime('now'), ?, ?, ?)`,
      [
        dados.contrato_id, dados.projeto_id, dados.numero_documento ?? null,
        dados.tipo_documento ?? 'NF', dados.nota_fiscal ?? null,
        dados.data_pagamento ?? null, dados.competencia ?? null,
        dados.valor_pago, dados.observacao ?? null, dados.arquivo_path ?? null,
        dados.criado_por, dados.fornecedor ?? null, dados.enquadramento_status ?? null, dados.contratos_candidatos ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  updatePagamentoCompleto(id: number, dados: {
    numero_documento?: string | null; tipo_documento?: string; nota_fiscal?: string | null
    data_pagamento?: string | null; competencia?: string | null; valor_pago?: number
    observacao?: string | null; arquivo_path?: string | null
  }): void {
    db.execute(
      `UPDATE financeiro_pagamentos SET
         numero_documento = COALESCE(?, numero_documento),
         tipo_documento   = COALESCE(?, tipo_documento),
         nota_fiscal      = COALESCE(?, nota_fiscal),
         data_pagamento   = COALESCE(?, data_pagamento),
         competencia      = COALESCE(?, competencia),
         valor_pago       = COALESCE(?, valor_pago),
         observacao       = COALESCE(?, observacao),
         arquivo_path     = COALESCE(?, arquivo_path)
       WHERE id = ?`,
      [
        dados.numero_documento, dados.tipo_documento, dados.nota_fiscal,
        dados.data_pagamento, dados.competencia, dados.valor_pago,
        dados.observacao, dados.arquivo_path, id,
      ]
    )
  },

  /** Atualiza o contrato vinculado a um pagamento (enquadramento automático ou correção manual). Saldo é sempre derivado — não há nada para recalcular aqui além do vínculo. */
  updatePagamentoContrato(
    id: number,
    contratoId: number | null,
    status: string,
    contratosCandidatos: string | null = null
  ): void {
    db.execute(
      `UPDATE financeiro_pagamentos
       SET contrato_id = ?, enquadramento_status = ?, contratos_candidatos = ?
       WHERE id = ?`,
      [contratoId, status, contratosCandidatos, id]
    )
  },

  softDeletePagamentoCompleto(id: number): void {
    db.execute('UPDATE financeiro_pagamentos SET ativo = 0 WHERE id = ?', [id])
  },

  // ── Histórico de enquadramento ─────────────────────────────────────────────

  insertHistoricoEnquadramento(dados: {
    pagamento_id: number; projeto_id: number
    contrato_id_anterior: number | null; contrato_id_novo: number | null
    tipo_acao: string; regra_utilizada?: string | null
    usuario_id?: number | null; usuario_nome?: string | null
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_enquadramento_historico
         (pagamento_id, projeto_id, contrato_id_anterior, contrato_id_novo,
          tipo_acao, regra_utilizada, usuario_id, usuario_nome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        dados.pagamento_id, dados.projeto_id, dados.contrato_id_anterior, dados.contrato_id_novo,
        dados.tipo_acao, dados.regra_utilizada ?? null, dados.usuario_id ?? null, dados.usuario_nome ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  findHistoricoEnquadramento(pagamentoId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT id, pagamento_id, projeto_id, contrato_id_anterior, contrato_id_novo,
              tipo_acao, regra_utilizada, usuario_id, usuario_nome, created_at
       FROM financeiro_enquadramento_historico
       WHERE pagamento_id = ? ORDER BY created_at ASC`,
      [pagamentoId]
    )
  },

  // ── Importador (para lib/financeiro/importador.ts) ────────────────────────

  findContratoExistente(
    projetoId: number,
    contratado: string,
    numeroContrato: string | null | undefined
  ): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      `SELECT id FROM financeiro_contratos
       WHERE projeto_id = ? AND contratado = ?
         AND (numero_contrato = ? OR (numero_contrato IS NULL AND ? IS NULL))
         AND ativo = 1 LIMIT 1`,
      [projetoId, contratado, numeroContrato ?? null, numeroContrato ?? null]
    )
  },

  /**
   * Busca contrato existente só pelo número do contrato (sem exigir fornecedor igual) —
   * usada pela importação quando a linha tem "Número Contrato" preenchido, para que
   * fornecedores diferentes de uma mesma obra/contrato caiam no mesmo registro.
   */
  findContratoExistentePorNumero(
    projetoId: number,
    numeroContrato: string
  ): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      `SELECT id FROM financeiro_contratos
       WHERE projeto_id = ? AND numero_contrato = ? AND ativo = 1 LIMIT 1`,
      [projetoId, numeroContrato]
    )
  },

  updateContratoValorAprovadoMax(id: number, valorAprovado: number): void {
    db.execute(
      "UPDATE financeiro_contratos SET valor_aprovado = MAX(valor_aprovado, ?), updated_at = datetime('now') WHERE id = ?",
      [valorAprovado, id]
    )
  },

  insertContratoImportado(dados: {
    projeto_id: number; numero_contrato?: string | null; contratado: string
    tipo_contrato: string; natureza_financeira: string; descricao_servico?: string | null
    valor_aprovado: number; criado_por: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO financeiro_contratos
         (projeto_id, numero_contrato, contratado, tipo_contrato, natureza_financeira,
          descricao_servico, valor_aprovado, status, criado_por, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?, datetime('now'), datetime('now'))`,
      [
        dados.projeto_id, dados.numero_contrato ?? null, dados.contratado,
        dados.tipo_contrato, dados.natureza_financeira, dados.descricao_servico ?? null,
        dados.valor_aprovado, dados.criado_por,
      ]
    )
    return result.lastInsertRowid
  },

  insertPagamentoImportado(dados: {
    contrato_id: number; projeto_id: number; numero_documento?: string | null
    tipo_documento?: string; nota_fiscal?: string | null; data_pagamento?: string | null
    competencia?: string | null; valor_pago: number; observacao?: string | null
    criado_por: number; fornecedor?: string | null
  }): void {
    db.execute(
      `INSERT INTO financeiro_pagamentos
         (movimento_id, contrato_id, projeto_id, numero_documento, tipo_documento, nota_fiscal,
          data_pagamento, competencia, valor_pago, observacao, ativo, criado_por, created_at, fornecedor)
       VALUES (0, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?, 1, ?, datetime('now'), ?)`,
      [
        dados.contrato_id, dados.projeto_id, dados.numero_documento ?? null,
        dados.tipo_documento ?? 'NF', dados.nota_fiscal ?? null,
        dados.data_pagamento ?? null, dados.competencia ?? null,
        dados.valor_pago, dados.observacao ?? null, dados.criado_por, dados.fornecedor ?? null,
      ]
    )
  },

  /**
   * Detecta se um lançamento equivalente já foi importado para este contrato — usada para
   * reimportação idempotente (mesma planilha importada de novo não deve duplicar lançamentos).
   * Chave de igualdade: contrato + número do documento + valor pago + data + observação.
   * Não usa só (contrato + número do documento) porque um mesmo documento legitimamente pode
   * ter várias linhas distintas na planilha (ex.: valor principal + impostos retidos separados).
   */
  existePagamentoImportado(dados: {
    contrato_id: number; numero_documento: string | null; valor_pago: number
    data_pagamento: string | null; observacao: string | null
  }): boolean {
    const row = db.queryOne<{ id: number }>(
      `SELECT id FROM financeiro_pagamentos
       WHERE contrato_id = ? AND (ativo IS NULL OR ativo = 1)
         AND (numero_documento = ? OR (numero_documento IS NULL AND ? IS NULL))
         AND ABS(valor_pago - ?) < 0.005
         AND (data_pagamento = ? OR (data_pagamento IS NULL AND ? IS NULL))
         AND (observacao = ? OR (observacao IS NULL AND ? IS NULL))
       LIMIT 1`,
      [
        dados.contrato_id, dados.numero_documento, dados.numero_documento, dados.valor_pago,
        dados.data_pagamento, dados.data_pagamento, dados.observacao, dados.observacao,
      ]
    )
    return !!row
  },
}
