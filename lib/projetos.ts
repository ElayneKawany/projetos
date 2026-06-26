import getDb from './db'
import { registrarAuditoria } from './db/auditoria'
import type { Projeto, StatusProjeto, Prioridade } from '@/types'

export function gerarCodigoProjeto(): string {
  const db = getDb()
  const ano = new Date().getFullYear()
  const row = db.prepare(
    `SELECT codigo FROM projetos WHERE codigo LIKE 'PRJ-${ano}-%' ORDER BY codigo DESC LIMIT 1`
  ).get() as { codigo: string } | undefined

  let seq = 1
  if (row) {
    const parts = row.codigo.split('-')
    seq = parseInt(parts[2]) + 1
  }
  return `PRJ-${ano}-${String(seq).padStart(4, '0')}`
}

export function buscarProjetos(filtros: {
  status?: string
  diretoria_id?: number
  prioridade?: string
  busca?: string
  usuario_id?: number
  perfil?: string
  limit?: number
  offset?: number
}): Projeto[] {
  const db = getDb()
  const conditions: string[] = ['p.ativo = 1']
  const params: Record<string, unknown> = {}

  if (filtros.status) {
    conditions.push('p.status = @status')
    params.status = filtros.status
  }
  if (filtros.diretoria_id) {
    conditions.push('p.diretoria_id = @diretoria_id')
    params.diretoria_id = filtros.diretoria_id
  }
  if (filtros.prioridade) {
    conditions.push('p.prioridade = @prioridade')
    params.prioridade = filtros.prioridade
  }
  if (filtros.busca) {
    conditions.push('(p.nome LIKE @busca OR p.codigo LIKE @busca OR p.objetivo LIKE @busca)')
    params.busca = `%${filtros.busca}%`
  }

  // Restrição por perfil
  if (filtros.perfil === 'DIRETOR' && filtros.usuario_id) {
    const u = db.prepare('SELECT diretoria_id FROM usuarios WHERE id = ?').get(filtros.usuario_id) as { diretoria_id: number }
    if (u?.diretoria_id) {
      conditions.push('p.diretoria_id = @dir_usuario')
      params.dir_usuario = u.diretoria_id
    }
  } else if (filtros.perfil === 'GESTOR' && filtros.usuario_id) {
    conditions.push('(p.gerente_id = @uid OR p.solicitante_id = @uid OR p.created_by = @uid)')
    params.uid = filtros.usuario_id
  } else if (filtros.perfil === 'SOLICITANTE' && filtros.usuario_id) {
    conditions.push('(p.solicitante_id = @uid2 OR p.created_by = @uid2)')
    params.uid2 = filtros.usuario_id
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filtros.limit ?? 100
  const offset = filtros.offset ?? 0

  return db.prepare(`
    SELECT p.*,
           us.nome as solicitante_nome,
           d.nome  as diretoria_nome,
           a.nome  as area_nome,
           g.nome  as gerente_nome
    FROM projetos p
    LEFT JOIN usuarios us ON p.solicitante_id = us.id
    LEFT JOIN diretorias d ON p.diretoria_id = d.id
    LEFT JOIN areas a ON p.area_id = a.id
    LEFT JOIN usuarios g ON p.gerente_id = g.id
    ${where}
    ORDER BY
      CASE p.prioridade WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
      p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).all(params) as Projeto[]
}

export function buscarProjetoPorId(id: number): Projeto | null {
  const db = getDb()
  return db.prepare(`
    SELECT p.*,
           us.nome as solicitante_nome,
           d.nome  as diretoria_nome,
           a.nome  as area_nome,
           g.nome  as gerente_nome
    FROM projetos p
    LEFT JOIN usuarios us ON p.solicitante_id = us.id
    LEFT JOIN diretorias d ON p.diretoria_id = d.id
    LEFT JOIN areas a ON p.area_id = a.id
    LEFT JOIN usuarios g ON p.gerente_id = g.id
    WHERE p.id = ? AND p.ativo = 1
  `).get(id) as Projeto | null
}

export function criarProjeto(dados: {
  nome: string
  solicitante_id: number
  diretoria_id: number
  area_id: number
  ponto_focal?: string
  contato?: string
  objetivo: string
  descricao?: string
  beneficios?: string
  created_by: number
}): Projeto {
  const db = getDb()
  const codigo = gerarCodigoProjeto()

  const result = db.prepare(`
    INSERT INTO projetos
      (codigo, nome, solicitante_id, diretoria_id, area_id, ponto_focal, contato,
       objetivo, descricao, beneficios, status, prioridade, created_by)
    VALUES
      (@codigo, @nome, @solicitante_id, @diretoria_id, @area_id, @ponto_focal, @contato,
       @objetivo, @descricao, @beneficios, 'PROPOSTA', 'MEDIA', @created_by)
  `).run({ codigo, ...dados })

  const projeto = buscarProjetoPorId(Number(result.lastInsertRowid))!

  registrarAuditoria({
    usuario_id: dados.created_by,
    acao: 'CREATE',
    entidade: 'projetos',
    entidade_id: projeto.id,
    projeto_id: projeto.id,
    descricao: `Projeto ${codigo} criado: "${dados.nome}"`,
    dados_depois: projeto,
  })

  // Auto-generate TAP V1
  const tap = db.prepare(`
    INSERT INTO tap_versoes
      (projeto_id, versao, label, fase_origem, status, criado_por,
       escopo_inicial, escopo_fisico, escopo_sistemico, escopo_processo,
       objetivo_detalhado, situacao_atual, etapas_projeto, setores_envolvidos)
    VALUES
      (@projeto_id, 1, 'TAP V1', 'PROPOSTA', 'PENDENTE_APROVACAO', @criado_por,
       @escopo_inicial, @escopo_fisico, @escopo_sistemico, @escopo_processo,
       @objetivo_detalhado, @situacao_atual, '[]', '[]')
  `).run({
    projeto_id: projeto.id,
    criado_por: dados.created_by,
    escopo_inicial: `Escopo inicial do projeto "${dados.nome}": a ser detalhado pelo gestor.`,
    escopo_fisico: `Descreva aqui os limites físicos e geográficos do projeto "${dados.nome}".`,
    escopo_sistemico: `Liste os sistemas que serão afetados ou integrados no projeto "${dados.nome}".`,
    escopo_processo: `Descreva os processos de negócio impactados pelo projeto "${dados.nome}".`,
    objetivo_detalhado: dados.objetivo,
    situacao_atual: 'A ser preenchido pelo gestor',
  })

  db.prepare(`
    INSERT INTO aprovacoes
      (projeto_id, tipo, referencia_id, referencia_tipo, status, solicitante_id, observacao_req)
    VALUES
      (?, 'TAP', ?, 'tap_versoes', 'PENDENTE', ?, 'TAP V1 gerado automaticamente após cadastro do projeto')
  `).run(projeto.id, tap.lastInsertRowid, dados.created_by)

  db.prepare(`
    INSERT INTO documentos
      (projeto_id, tipo, titulo, versao, status, gerado_auto, criado_por)
    VALUES
      (?, 'TAP', ?, 1, 'EM_APROVACAO', 1, ?)
  `).run(projeto.id, `TAP V1 – ${dados.nome}`, dados.created_by)

  return projeto
}

export function atualizarStatusProjeto(
  projeto_id: number,
  status_para: StatusProjeto,
  usuario_id: number,
  motivo?: string
): void {
  const db = getDb()
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')

  db.prepare(`
    UPDATE projetos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status_para, projeto_id)

  db.prepare(`
    INSERT INTO projeto_status_historico (projeto_id, status_de, status_para, motivo, usuario_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(projeto_id, projeto.status, status_para, motivo ?? null, usuario_id)

  registrarAuditoria({
    usuario_id,
    acao: 'STATUS_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: `Status alterado de "${projeto.status}" para "${status_para}"`,
    dados_antes: { status: projeto.status },
    dados_depois: { status: status_para, motivo },
  })

  // Auto-generate Viabilidade when entering VIABILIDADE phase
  if (status_para === 'VIABILIDADE') {
    const existingVib = db.prepare(
      `SELECT id FROM viabilidade WHERE projeto_id = ? AND versao = 1`
    ).get(projeto_id)

    if (!existingVib) {
      const vib = db.prepare(`
        INSERT INTO viabilidade
          (projeto_id, versao, status, criado_por, resumo_executivo, recomendacao)
        VALUES
          (?, 1, 'RASCUNHO', ?, 'A preencher: Descreva o objetivo e benefícios esperados do projeto.', NULL)
      `).run(projeto_id, usuario_id)

      db.prepare(`
        INSERT INTO aprovacoes
          (projeto_id, tipo, referencia_id, referencia_tipo, status, solicitante_id, observacao_req)
        VALUES
          (?, 'VIABILIDADE', ?, 'viabilidade', 'PENDENTE', ?, 'Estudo de Viabilidade gerado automaticamente ao avançar para fase VIABILIDADE')
      `).run(projeto_id, vib.lastInsertRowid, usuario_id)

      db.prepare(`
        INSERT INTO documentos
          (projeto_id, tipo, titulo, versao, status, gerado_auto, criado_por)
        VALUES
          (?, 'ESTUDO', ?, 1, 'EM_APROVACAO', 1, ?)
      `).run(projeto_id, `Estudo de Viabilidade – ${projeto.nome}`, usuario_id)
    }
  }
}

export function atualizarPrioridadeProjeto(
  projeto_id: number,
  prioridade_para: Prioridade,
  usuario_id: number,
  motivo?: string
): void {
  const db = getDb()
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')

  db.prepare(`
    UPDATE projetos SET prioridade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(prioridade_para, projeto_id)

  db.prepare(`
    INSERT INTO projeto_prioridade_historico (projeto_id, prioridade_de, prioridade_para, motivo, usuario_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(projeto_id, projeto.prioridade, prioridade_para, motivo ?? null, usuario_id)

  registrarAuditoria({
    usuario_id,
    acao: 'PRIORITY_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: `Prioridade alterada de "${projeto.prioridade}" para "${prioridade_para}"`,
    dados_antes: { prioridade: projeto.prioridade },
    dados_depois: { prioridade: prioridade_para, motivo },
  })
}

export function buscarHistoricoStatus(projeto_id: number) {
  const db = getDb()
  return db.prepare(`
    SELECT h.*, u.nome as usuario_nome
    FROM projeto_status_historico h
    LEFT JOIN usuarios u ON h.usuario_id = u.id
    WHERE h.projeto_id = ?
    ORDER BY h.created_at DESC
  `).all(projeto_id)
}

export function buscarHistoricoPrioridade(projeto_id: number) {
  const db = getDb()
  return db.prepare(`
    SELECT h.*, u.nome as usuario_nome
    FROM projeto_prioridade_historico h
    LEFT JOIN usuarios u ON h.usuario_id = u.id
    WHERE h.projeto_id = ?
    ORDER BY h.created_at DESC
  `).all(projeto_id)
}

export function buscarDashboardPMO() {
  const db = getDb()
  const hoje = new Date().toISOString().split('T')[0]

  const totalProjetos      = (db.prepare('SELECT COUNT(*) as total FROM projetos WHERE ativo=1').get() as { total: number }).total
  const projetosAtivos     = (db.prepare(`SELECT COUNT(*) as total FROM projetos WHERE ativo=1 AND status NOT IN ('ENCERRAMENTO','CANCELADO','SUSPENSO')`).get() as { total: number }).total
  const aprovacoesPendentes = (db.prepare(`SELECT COUNT(*) as total FROM aprovacoes WHERE status='PENDENTE'`).get() as { total: number }).total
  const porStatus          = db.prepare(`SELECT status, COUNT(*) as total FROM projetos WHERE ativo=1 GROUP BY status`).all()
  const porPrioridade      = db.prepare(`SELECT prioridade, COUNT(*) as total FROM projetos WHERE ativo=1 GROUP BY prioridade`).all()
  const investimentoTotal  = (db.prepare(`SELECT COALESCE(SUM(capex_aprovado + opex_aprovado), 0) as total FROM projetos WHERE ativo=1`).get() as { total: number }).total
  const projetosAtrasados  = (db.prepare(`SELECT COUNT(*) as total FROM projetos WHERE ativo=1 AND data_fim_prev < ? AND status NOT IN ('ENCERRAMENTO','CANCELADO','SUSPENSO','GOLIVE','ROI')`).get(hoje) as { total: number }).total
  const proximosComites    = db.prepare(`SELECT * FROM comites WHERE status='AGENDADO' AND data_realizacao >= ? ORDER BY data_realizacao LIMIT 5`).all(hoje)
  const roiMedio           = (db.prepare(`SELECT COALESCE(AVG(roi_previsto),0) as media FROM tap_versoes WHERE roi_previsto IS NOT NULL`).get() as { media: number }).media
  const paybackMedio       = (db.prepare(`SELECT COALESCE(AVG(payback_meses),0) as media FROM tap_versoes WHERE payback_meses IS NOT NULL`).get() as { media: number }).media

  return {
    total_projetos: totalProjetos,
    projetos_ativos: projetosAtivos,
    projetos_atrasados: projetosAtrasados,
    aprovacoes_pendentes: aprovacoesPendentes,
    roi_medio: roiMedio,
    payback_medio: paybackMedio,
    proximos_comites: proximosComites,
    por_status: porStatus,
    por_prioridade: porPrioridade,
    investimento_total: investimentoTotal,
  }
}
