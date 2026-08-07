/**
 * @file lib/timeline.ts
 *
 * Serviço compartilhado de Timeline do Projeto.
 *
 * Registra e recupera eventos de todos os módulos em uma única estrutura
 * genérica, permitindo a futura exibição de uma linha do tempo consolidada
 * que abranja Workflow, Financeiro, Cronograma, Payback, Aprovações e mais.
 *
 * Estrutura genérica:
 *   Módulo  → FINANCEIRO | WORKFLOW | CRONOGRAMA | PAYBACK | ...
 *   Artefato → ITEM | DOCUMENTO | MOVIMENTO | TAP | CRONOGRAMA | ...
 *   Evento   → CRIADO | ALTERADO | APROVADO | REJEITADO | PAGO | ...
 *   Origem   → MANUAL | WORKFLOW | API | IMPORTACAO | ERP
 *
 * IMPORTANTE: Esta timeline é de leitura humana / exibição visual.
 * A tabela `auditoria` (lib/db/auditoria.ts) continua sendo o log imutável
 * de compliance — nunca substitua uma pela outra.
 *
 * @module timeline
 * @usedBy FinanceiroTab — timeline financeira do projeto
 * @usedBy WorkflowStatusPanel — eventos de aprovação
 * @usedBy CronogramaEditor — eventos de cronograma
 * @usedBy ProjetoDetalhePage — timeline consolidada (futura Sprint)
 * @usedBy Dashboard Executivo — feed de atividades do portfólio
 */

import getDb from './db'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type ModuloTimeline =
  | 'FINANCEIRO'
  | 'WORKFLOW'
  | 'CRONOGRAMA'
  | 'PAYBACK'
  | 'APROVACAO'
  | 'TAP'
  | 'VIABILIDADE'
  | 'ORCAMENTO'
  | 'SISTEMA'
  | 'PROJETO'

export type ArtefatoTimeline =
  | 'ITEM'
  | 'MOVIMENTO'
  | 'PAGAMENTO'
  | 'TAP'
  | 'CRONOGRAMA'
  | 'WORKFLOW'
  | 'GRUPO'
  | 'PROJETO'
  | 'ORCAMENTO'
  | 'VIABILIDADE'
  | 'COMPETENCIA'
  | 'SNAPSHOT_PAYBACK'

export type EventoTimeline =
  | 'CRIADO'
  | 'ALTERADO'
  | 'APROVADO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'PAGO'
  | 'ENVIADO'
  | 'REVISAO'
  | 'ENCERRADO'
  | 'SUSPENSO'
  | 'IMPORTADO'
  | 'CONCLUIDO'
  | 'CRONOGRAMA_IMPORTADO'
  // Eventos do módulo Payback
  | 'PAYBACK_INICIADO'
  | 'COMPETENCIA_CRIADA'
  | 'COMPETENCIA_EDITADA'
  | 'COMPETENCIA_APROVADA'
  | 'PAYBACK_REVISADO'
  | 'PAYBACK_ENCERRADO'

export type OrigemTimeline = 'MANUAL' | 'WORKFLOW' | 'API' | 'IMPORTACAO' | 'ERP'

export interface TimelineEvento {
  id: number
  projeto_id: number
  modulo: ModuloTimeline
  artefato: ArtefatoTimeline
  evento: EventoTimeline
  origem: OrigemTimeline
  titulo: string
  descricao: string | null
  usuario_id: number | null
  usuario_nome: string | null
  referencia_id: number | null
  referencia_tipo: string | null
  dados_json: string | null
  created_at: string
}

export interface RegistrarEventoParams {
  projeto_id: number
  modulo: ModuloTimeline
  artefato: ArtefatoTimeline
  evento: EventoTimeline
  titulo: string
  descricao?: string | null
  usuario_id?: number | null
  usuario_nome?: string | null
  referencia_id?: number | null
  referencia_tipo?: string | null
  dados?: Record<string, unknown>
  origem?: OrigemTimeline
}

export interface FiltrosTimeline {
  modulo?: ModuloTimeline | ModuloTimeline[]
  artefato?: ArtefatoTimeline
  evento?: EventoTimeline
  origem?: OrigemTimeline
  limit?: number
}

// ─── Funções exportadas ───────────────────────────────────────────────────────

/**
 * Registra um novo evento na timeline genérica do projeto.
 *
 * Nunca lança exceção — falha silenciosa para não bloquear o fluxo principal.
 * O registro da timeline é informativo; o registro de compliance está na `auditoria`.
 *
 * @param params - Dados do evento a registrar
 *
 * @usedBy lib/orcamento.ts — ao criar/alterar grupos e itens
 * @usedBy financeiro/documentos route — ao criar/aprovar movimentos
 * @usedBy workflow routes — ao aprovar/rejeitar etapas
 * @usedBy qualquer módulo que gere eventos relevantes para o projeto
 *
 * @example
 * ```ts
 * import { registrarEvento } from '@/lib/timeline'
 *
 * registrarEvento({
 *   projeto_id: 1,
 *   modulo: 'FINANCEIRO',
 *   artefato: 'MOVIMENTO',
 *   evento: 'CRIADO',
 *   titulo: 'NF 00123 lançada — Servidor Dell',
 *   descricao: 'Valor: R$ 80.000,00 | Fornecedor: Dell Brasil',
 *   usuario_id: session.id,
 *   usuario_nome: session.nome,
 *   referencia_id: movimentoId,
 *   referencia_tipo: 'financeiro_movimentos',
 *   dados: { valor: 80000, fornecedor: 'Dell Brasil' },
 * })
 * ```
 */
export function registrarEvento(params: RegistrarEventoParams): void {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO projeto_timeline
        (projeto_id, modulo, artefato, evento, origem, titulo, descricao,
         usuario_id, usuario_nome, referencia_id, referencia_tipo, dados_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.projeto_id,
      params.modulo,
      params.artefato,
      params.evento,
      params.origem ?? 'MANUAL',
      params.titulo,
      params.descricao ?? null,
      params.usuario_id ?? null,
      params.usuario_nome ?? null,
      params.referencia_id ?? null,
      params.referencia_tipo ?? null,
      params.dados ? JSON.stringify(params.dados) : null,
    )
  } catch {
    // Falha silenciosa: timeline é informativa, nunca bloqueia o fluxo
  }
}

/**
 * Retorna os eventos da timeline de um projeto, com filtros opcionais.
 *
 * @param projeto_id - ID do projeto
 * @param filtros - Filtros opcionais: modulo, artefato, evento, origem, limit
 * @returns Lista de eventos em ordem cronológica decrescente (mais recente primeiro)
 *
 * @usedBy FinanceiroTab — timeline financeira
 * @usedBy ProjetoDetalhePage — timeline consolidada (futura Sprint)
 * @usedBy Dashboard Executivo — feed de atividades
 *
 * @example
 * ```ts
 * // Todos os eventos do projeto
 * const todos = buscarTimeline(projetoId)
 *
 * // Apenas eventos financeiros
 * const financeiro = buscarTimeline(projetoId, { modulo: 'FINANCEIRO' })
 *
 * // Últimos 10 eventos de qualquer módulo
 * const recentes = buscarTimeline(projetoId, { limit: 10 })
 * ```
 */
export function buscarTimeline(
  projeto_id: number,
  filtros?: FiltrosTimeline
): TimelineEvento[] {
  const db = getDb()

  const wheres: string[] = ['projeto_id = ?']
  const binds: unknown[] = [projeto_id]

  if (filtros?.modulo) {
    if (Array.isArray(filtros.modulo)) {
      const placeholders = filtros.modulo.map(() => '?').join(', ')
      wheres.push(`modulo IN (${placeholders})`)
      binds.push(...filtros.modulo)
    } else {
      wheres.push('modulo = ?')
      binds.push(filtros.modulo)
    }
  }

  if (filtros?.artefato) {
    wheres.push('artefato = ?')
    binds.push(filtros.artefato)
  }

  if (filtros?.evento) {
    wheres.push('evento = ?')
    binds.push(filtros.evento)
  }

  if (filtros?.origem) {
    wheres.push('origem = ?')
    binds.push(filtros.origem)
  }

  const limit = filtros?.limit ? `LIMIT ${filtros.limit}` : ''

  return db.prepare(`
    SELECT * FROM projeto_timeline
    WHERE ${wheres.join(' AND ')}
    ORDER BY created_at DESC
    ${limit}
  `).all(...binds) as TimelineEvento[]
}
