import { db } from '@/lib/database'
import { TapRepository } from './tap'

export interface Comite {
  id: number
  titulo: string
  tipo: string
  data_realizacao: string
  status: string
  local?: string | null
  pauta?: string | null
  diretorias_ids?: string | null
  created_by?: number | null
  created_at?: string
  updated_at?: string
}

export const ComitesRepository = {
  findAll(filtros: { status?: string; tipo?: string } = {}): Comite[] {
    const conditions: string[] = []
    const params: unknown[] = []
    if (filtros.status) { conditions.push('status = ?'); params.push(filtros.status) }
    if (filtros.tipo) { conditions.push('tipo = ?'); params.push(filtros.tipo) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return db.queryMany<Comite>(
      `SELECT c.*, u.nome AS criador_nome,
              (SELECT COUNT(*) FROM comite_projetos WHERE comite_id = c.id) AS num_projetos
       FROM comites c LEFT JOIN usuarios u ON u.id = c.created_by
       ${where} ORDER BY c.data_realizacao DESC`,
      params
    )
  },

  findById(id: number): Comite | undefined {
    return db.queryOne<Comite>(
      `SELECT c.*, u.nome AS criador_nome
       FROM comites c LEFT JOIN usuarios u ON u.id = c.created_by
       WHERE c.id = ?`,
      [id]
    )
  },

  create(dados: Partial<Comite>): number | bigint {
    const result = db.execute(
      `INSERT INTO comites (titulo, tipo, data_realizacao, status, local, pauta, diretorias_ids, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        dados.titulo, dados.tipo ?? 'ORDINARIO', dados.data_realizacao,
        dados.status ?? 'AGENDADO', dados.local ?? null, dados.pauta ?? null,
        dados.diretorias_ids ?? null, dados.created_by ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  update(id: number, dados: Partial<Comite>): void {
    const sets: string[] = []
    const params: unknown[] = []
    const campos = ['titulo', 'tipo', 'data_realizacao', 'status', 'local', 'pauta', 'diretorias_ids'] as const
    for (const campo of campos) {
      if (campo in dados) { sets.push(`${campo} = ?`); params.push(dados[campo]) }
    }
    if (!sets.length) return
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)
    db.execute(`UPDATE comites SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  // ── Projetos do comitê ─────────────────────────────────────────────────────

  findProjetosByComiteId(comiteId: number) {
    return db.queryMany(
      `SELECT cp.*, p.codigo AS projeto_codigo, p.nome AS projeto_nome,
              p.status AS projeto_status, d.nome AS projeto_diretoria
       FROM comite_projetos cp
       JOIN projetos p ON p.id = cp.projeto_id
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       WHERE cp.comite_id = ? ORDER BY cp.ordem_pauta, cp.id`,
      [comiteId]
    )
  },

  addProjeto(comiteId: number, projetoId: number, ordem?: number): number | bigint {
    const result = db.execute(
      'INSERT OR IGNORE INTO comite_projetos (comite_id, projeto_id, ordem_pauta) VALUES (?,?,?)',
      [comiteId, projetoId, ordem ?? null]
    )
    return result.lastInsertRowid
  },

  removeProjeto(comiteId: number, projetoId: number): void {
    db.execute('DELETE FROM comite_projetos WHERE comite_id = ? AND projeto_id = ?', [comiteId, projetoId])
  },

  // ── Decisões e pendências ──────────────────────────────────────────────────

  findDecisoesByComiteId(comiteId: number) {
    return db.queryMany(
      `SELECT cd.*, p.nome AS projeto_nome, p.codigo AS projeto_codigo
       FROM comite_decisoes cd LEFT JOIN projetos p ON p.id = cd.projeto_id
       WHERE cd.comite_id = ? ORDER BY cd.created_at`,
      [comiteId]
    )
  },

  findPendenciasByComiteId(comiteId: number) {
    return db.queryMany(
      `SELECT cp.*, p.nome AS projeto_nome, p.codigo AS projeto_codigo
       FROM comite_pendencias cp LEFT JOIN projetos p ON p.id = cp.projeto_id
       WHERE cp.comite_id = ? ORDER BY cp.status, cp.prazo`,
      [comiteId]
    )
  },

  // ── Acesso raw / update completo ──────────────────────────────────────────

  findRaw(id: number): Record<string, unknown> | undefined {
    return db.queryOne('SELECT * FROM comites WHERE id = ?', [id])
  },

  updateFull(id: number, fields: Record<string, unknown>): void {
    const allowed = [
      'titulo', 'tipo', 'data_realizacao', 'hora', 'local', 'pauta', 'decisao_geral',
      'status', 'periodo_inicio', 'periodo_fim', 'diretorias_ids',
      'resumo_executivo_ia', 'resumo_executivo_ia_json', 'resumo_ia_gerado_em',
    ]
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields && fields[campo] !== undefined) {
        sets.push(`${campo} = ?`)
        params.push(fields[campo])
      }
    }
    if (!sets.length) return
    sets.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(id)
    db.execute(`UPDATE comites SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  deleteCascade(comiteId: number): void {
    db.transaction(() => {
      db.execute('DELETE FROM comite_ata WHERE comite_id = ?', [comiteId])
      db.execute('DELETE FROM comite_decisoes WHERE comite_id = ?', [comiteId])
      db.execute('DELETE FROM comite_pendencias WHERE comite_id = ?', [comiteId])
      db.execute('DELETE FROM comite_participantes WHERE comite_id = ?', [comiteId])
      db.execute('DELETE FROM comite_projetos WHERE comite_id = ?', [comiteId])
      db.execute('DELETE FROM comite_documentos WHERE comite_id = ?', [comiteId])
      db.execute('DELETE FROM comites WHERE id = ?', [comiteId])
    })
  },

  // ── Participantes ──────────────────────────────────────────────────────────

  findParticipantes(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT cp.*, u.nome AS usuario_nome, u.cargo AS usuario_cargo
       FROM comite_participantes cp
       LEFT JOIN usuarios u ON u.id = cp.usuario_id
       WHERE cp.comite_id = ? ORDER BY cp.id`,
      [comiteId]
    )
  },

  findParticipantesNomeados(comiteId: number): { nome: string; cargo: string | null; presente: number }[] {
    return db.queryMany<{ nome: string; cargo: string | null; presente: number }>(
      `SELECT COALESCE(u.nome, cp.nome_externo) AS nome, cp.cargo, cp.presente
       FROM comite_participantes cp
       LEFT JOIN usuarios u ON u.id = cp.usuario_id
       WHERE cp.comite_id = ?`,
      [comiteId]
    )
  },

  insertParticipante(dados: {
    comite_id: number; usuario_id?: number | null; nome_externo?: string | null
    cargo?: string | null; presente?: boolean; confirmado?: boolean
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO comite_participantes (comite_id, usuario_id, nome_externo, cargo, presente, confirmado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dados.comite_id, dados.usuario_id ?? null, dados.nome_externo ?? null,
        dados.cargo ?? null, dados.presente ? 1 : 0, dados.confirmado ? 1 : 0,
      ]
    )
    return result.lastInsertRowid
  },

  updatePresencaBulk(comiteId: number, presencas: { id: number; presente: boolean }[]): void {
    db.transaction(() => {
      for (const p of presencas) {
        db.execute(
          'UPDATE comite_participantes SET presente = ? WHERE id = ? AND comite_id = ?',
          [p.presente ? 1 : 0, p.id, comiteId]
        )
      }
    })
  },

  deleteParticipante(comiteId: number, participanteId: number): void {
    db.execute('DELETE FROM comite_participantes WHERE id = ? AND comite_id = ?', [participanteId, comiteId])
  },

  // ── Decisões ──────────────────────────────────────────────────────────────

  insertDecisao(dados: {
    comite_id: number; projeto_id?: number | null; tipo?: string
    descricao: string; responsavel_nome?: string | null; prazo?: string | null
    status?: string; created_by: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO comite_decisoes (comite_id, projeto_id, tipo, descricao, responsavel_nome, prazo, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.comite_id, dados.projeto_id ?? null, dados.tipo ?? 'PENDENTE',
        dados.descricao, dados.responsavel_nome ?? null, dados.prazo ?? null,
        dados.status ?? 'PENDENTE', dados.created_by,
      ]
    )
    return result.lastInsertRowid
  },

  findDecisao(decId: number, comiteId: number): Record<string, unknown> | undefined {
    return db.queryOne('SELECT * FROM comite_decisoes WHERE id = ? AND comite_id = ?', [decId, comiteId])
  },

  updateDecisao(decId: number, fields: Record<string, unknown>): void {
    const allowed = ['tipo', 'descricao', 'responsavel_nome', 'prazo', 'status']
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields && fields[campo] !== undefined) {
        sets.push(`${campo} = ?`)
        params.push(fields[campo])
      }
    }
    if (!sets.length) return
    sets.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(decId)
    db.execute(`UPDATE comite_decisoes SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  deleteDecisao(decId: number, comiteId: number): void {
    db.execute('DELETE FROM comite_decisoes WHERE id = ? AND comite_id = ?', [decId, comiteId])
  },

  // ── Pendências ─────────────────────────────────────────────────────────────

  insertPendencia(dados: {
    comite_id: number; projeto_id?: number | null; descricao: string
    responsavel_nome?: string | null; prazo?: string | null; created_by: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO comite_pendencias (comite_id, projeto_id, descricao, responsavel_nome, prazo, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'ABERTA', ?)`,
      [
        dados.comite_id, dados.projeto_id ?? null, dados.descricao,
        dados.responsavel_nome ?? null, dados.prazo ?? null, dados.created_by,
      ]
    )
    return result.lastInsertRowid
  },

  findPendencia(pedId: number, comiteId: number): Record<string, unknown> | undefined {
    return db.queryOne('SELECT * FROM comite_pendencias WHERE id = ? AND comite_id = ?', [pedId, comiteId])
  },

  updatePendencia(pedId: number, fields: Record<string, unknown>): void {
    const allowed = ['descricao', 'responsavel_nome', 'prazo', 'status', 'resolved_at', 'resolved_by']
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields && fields[campo] !== undefined) {
        sets.push(`${campo} = ?`)
        params.push(fields[campo])
      }
    }
    if (!sets.length) return
    params.push(pedId)
    db.execute(`UPDATE comite_pendencias SET ${sets.join(', ')} WHERE id = ?`, params)
  },

  deletePendencia(pedId: number, comiteId: number): void {
    db.execute('DELETE FROM comite_pendencias WHERE id = ? AND comite_id = ?', [pedId, comiteId])
  },

  // ── Comite Projetos ────────────────────────────────────────────────────────

  findComiteProjetoExistente(comiteId: number, projetoId: number): { id: number } | undefined {
    return db.queryOne<{ id: number }>(
      'SELECT id FROM comite_projetos WHERE comite_id = ? AND projeto_id = ?',
      [comiteId, projetoId]
    )
  },

  findProjetoSnapshot(projetoId: number): Record<string, unknown> | undefined {
    return db.queryOne(
      'SELECT prioridade, complexidade, investimento, roi_previsto FROM projetos WHERE id = ?',
      [projetoId]
    )
  },

  insertComiteProjeto(dados: {
    comite_id: number; projeto_id: number; pauta_item?: string | null
    ordem_pauta?: number; tempo_previsto?: string | null
    snap_prioridade?: unknown; snap_complexidade?: unknown
    snap_investimento?: unknown; snap_roi?: unknown
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO comite_projetos
         (comite_id, projeto_id, pauta_item, ordem_pauta, tempo_previsto,
          snap_prioridade, snap_complexidade, snap_investimento, snap_roi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.comite_id, dados.projeto_id, dados.pauta_item ?? null,
        dados.ordem_pauta ?? 0, dados.tempo_previsto ?? null,
        dados.snap_prioridade ?? null, dados.snap_complexidade ?? null,
        dados.snap_investimento ?? null, dados.snap_roi ?? null,
      ]
    )
    return result.lastInsertRowid
  },

  findComiteProjeto(comiteId: number, projetoId: number): Record<string, unknown> | undefined {
    return db.queryOne(
      'SELECT * FROM comite_projetos WHERE comite_id = ? AND projeto_id = ?',
      [comiteId, projetoId]
    )
  },

  updateComiteProjeto(comiteId: number, projetoId: number, fields: Record<string, unknown>): void {
    const allowed = ['decisao', 'observacoes', 'pauta_item', 'ordem_pauta', 'tempo_previsto']
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields && fields[campo] !== undefined) {
        sets.push(`${campo} = ?`)
        params.push(fields[campo])
      }
    }
    if (!sets.length) return
    params.push(comiteId)
    params.push(projetoId)
    db.execute(
      `UPDATE comite_projetos SET ${sets.join(', ')} WHERE comite_id = ? AND projeto_id = ?`,
      params
    )
  },

  // ── Ata ────────────────────────────────────────────────────────────────────

  findAta(comiteId: number): Record<string, unknown> | undefined {
    return db.queryOne('SELECT * FROM comite_ata WHERE comite_id = ?', [comiteId])
  },

  findAtaHistorico(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      'SELECT * FROM comite_ata_historico WHERE comite_id = ? ORDER BY created_at DESC LIMIT 20',
      [comiteId]
    )
  },

  insertAta(dados: {
    comite_id: number; transcricao?: string | null; conteudo?: string
    conteudo_json?: string | null; gerado_por_ia?: boolean; status?: string
    hora_inicio?: string | null; hora_fim?: string | null; duracao_min?: number | null
    created_by: number
  }): number | bigint {
    const result = db.execute(
      `INSERT INTO comite_ata (comite_id, transcricao, conteudo, conteudo_json, gerado_por_ia,
         status, hora_inicio, hora_fim, duracao_min, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.comite_id, dados.transcricao ?? null, dados.conteudo ?? '',
        dados.conteudo_json ?? null, dados.gerado_por_ia ? 1 : 0,
        dados.status ?? 'RASCUNHO', dados.hora_inicio ?? null,
        dados.hora_fim ?? null, dados.duracao_min ?? null, dados.created_by,
      ]
    )
    return result.lastInsertRowid
  },

  updateAta(comiteId: number, fields: Record<string, unknown>, novaVersao: number): void {
    const allowed = ['transcricao', 'conteudo', 'conteudo_json', 'gerado_por_ia', 'status', 'hora_inicio', 'hora_fim', 'duracao_min']
    const sets: string[] = []
    const params: unknown[] = []
    for (const campo of allowed) {
      if (campo in fields && fields[campo] !== undefined) {
        sets.push(`${campo} = ?`)
        params.push(fields[campo])
      }
    }
    if (!sets.length) return
    sets.push('versao = ?', 'updated_at = ?')
    params.push(novaVersao, new Date().toISOString(), comiteId)
    db.execute(`UPDATE comite_ata SET ${sets.join(', ')} WHERE comite_id = ?`, params)
  },

  insertAtaHistorico(dados: {
    comite_id: number; ata_id: number; versao: number
    conteudo_snap?: string | null; acao: string; usuario_id: number; usuario_nome: string
  }): void {
    db.execute(
      `INSERT INTO comite_ata_historico (comite_id, ata_id, versao, conteudo_snap, acao, usuario_id, usuario_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.comite_id, dados.ata_id, dados.versao,
        dados.conteudo_snap ?? null, dados.acao, dados.usuario_id, dados.usuario_nome,
      ]
    )
  },

  // ── Contexto para IA / exportação ─────────────────────────────────────────

  findProjetosParaAta(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT p.codigo, p.nome, p.status, d.nome AS diretoria, cp.decisao, cp.observacoes, cp.pauta_item
       FROM comite_projetos cp
       JOIN projetos p ON p.id = cp.projeto_id
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       WHERE cp.comite_id = ? ORDER BY cp.ordem_pauta`,
      [comiteId]
    )
  },

  findDecisoesSimplesComiteId(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      'SELECT tipo, descricao, responsavel_nome, prazo FROM comite_decisoes WHERE comite_id = ?',
      [comiteId]
    )
  },

  findPendenciasAbertas(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT descricao, responsavel_nome, prazo FROM comite_pendencias
       WHERE comite_id = ? AND status = 'ABERTA'`,
      [comiteId]
    )
  },

  findProjetosParaExportacao(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT p.codigo, p.nome, p.status, d.nome AS diretoria, cp.decisao, cp.observacoes,
              cp.snap_prioridade, cp.snap_complexidade, cp.snap_investimento, cp.snap_roi
       FROM comite_projetos cp
       JOIN projetos p ON p.id = cp.projeto_id
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       WHERE cp.comite_id = ? ORDER BY cp.ordem_pauta, cp.id`,
      [comiteId]
    )
  },

  findDecisoesParaExportacao(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT tipo, descricao, responsavel_nome, prazo, status,
              p.nome AS projeto FROM comite_decisoes cd
       LEFT JOIN projetos p ON p.id = cd.projeto_id WHERE cd.comite_id = ?`,
      [comiteId]
    )
  },

  findPendenciasParaExportacao(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT descricao, responsavel_nome, prazo, status,
              p.nome AS projeto FROM comite_pendencias cp
       LEFT JOIN projetos p ON p.id = cp.projeto_id WHERE cp.comite_id = ?`,
      [comiteId]
    )
  },

  async findPortfolioAtivoParaIA(): Promise<Record<string, unknown>[]> {
    const projetos = db.queryMany<Record<string, unknown> & { id: number }>(
      `SELECT p.id, p.codigo, p.nome, p.status, p.prioridade, p.complexidade,
              p.capex_aprovado, p.data_inicio_prev, p.data_fim_prev,
              p.responsavel_nome, p.gestor_nome,
              d.nome AS diretoria, a.nome AS area
       FROM projetos p
       LEFT JOIN diretorias d ON d.id = p.diretoria_id
       LEFT JOIN areas a ON a.id = p.area_id
       WHERE p.ativo = 1
       ORDER BY p.status, p.nome`,
      []
    )

    // roi_previsto vinha de uma subquery correlacionada em tap_versoes, que já
    // está em Postgres — busca em lote (versão mais recente por projeto) e faz
    // o merge em JS.
    const roiPorProjeto = await TapRepository.findLatestRoiPrevistoPorProjetos(projetos.map(p => p.id))
    const roiMap = new Map(roiPorProjeto.map(r => [r.projeto_id, r.roi_previsto]))
    for (const p of projetos) {
      p.roi_previsto = roiMap.get(p.id) ?? null
    }

    return projetos
  },

  findTotalFinanceiroPago(): number {
    const row = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(fp.valor_pago), 0) AS total
       FROM financeiro_pagamentos fp
       WHERE (fp.ativo IS NULL OR fp.ativo = 1)`,
      []
    )
    return row?.total ?? 0
  },

  findTotalBeneficioPayback(): number {
    const row = db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(beneficio_periodo), 0) AS total FROM payback_lancamentos',
      []
    )
    return row?.total ?? 0
  },

  findDecisoesPendentes(comiteId: number): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT cd.tipo, cd.descricao, cd.responsavel_nome, cd.prazo,
              p.nome AS projeto_nome, p.codigo AS projeto_codigo
       FROM comite_decisoes cd
       LEFT JOIN projetos p ON p.id = cd.projeto_id
       WHERE cd.comite_id = ? AND cd.status = 'PENDENTE'
       ORDER BY cd.prazo`,
      [comiteId]
    )
  },

  findComiteAnterior(comiteId: number): { id: number; data_realizacao: string } | undefined {
    return db.queryOne<{ id: number; data_realizacao: string }>(
      `SELECT id, titulo, data_realizacao FROM comites
       WHERE id < ? AND status = 'REALIZADO'
       ORDER BY data_realizacao DESC LIMIT 1`,
      [comiteId]
    )
  },

  findMovimentosRecentes(dataReferencia: string): Record<string, unknown>[] {
    return db.queryMany(
      `SELECT p.codigo, p.nome, ph.campo, ph.valor_anterior, ph.valor_novo, ph.created_at
       FROM projeto_historico_alteracoes ph
       JOIN projetos p ON p.id = ph.projeto_id
       WHERE ph.campo = 'status' AND ph.created_at >= ?
       ORDER BY ph.created_at DESC LIMIT 20`,
      [dataReferencia]
    )
  },

  updateResumoIaGeradoEm(comiteId: number, timestamp: string): void {
    db.execute('UPDATE comites SET resumo_ia_gerado_em = ? WHERE id = ?', [timestamp, comiteId])
  },
}
