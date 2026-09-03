/**
 * @file lib/artefatos.ts
 *
 * Camada de serviço compartilhada para todos os artefatos do sistema.
 * Este arquivo é a referência oficial para operações comuns de artefatos.
 *
 * Artefatos suportados: TAP, Estudo de Viabilidade, Cronograma e quaisquer
 * artefatos futuros que sigam o ciclo RASCUNHO → PENDENTE_APROVACAO → APROVADO.
 *
 * REGRA PERMANENTE: Nenhuma lógica de Workflow, Aprovação, Histórico, Auditoria
 * ou Controle de Status deve ser duplicada nos arquivos de artefatos individuais.
 * Todo novo artefato deve reutilizar este módulo.
 */

import type { Database } from 'better-sqlite3'
import getDb from './db'
import { criarWorkflow, type EtapaInput } from './workflow'
import { registrarHistoricoAlteracao } from './projetos'
import { registrarAuditoria } from './db/auditoria'
import { TapRepository, ViabilidadeRepository } from './repositories'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/**
 * Tipo dos artefatos conhecidos pelo sistema.
 * Estender esta union ao adicionar novos artefatos.
 */
export type TipoArtefato = 'TAP' | 'VIABILIDADE' | 'CRONOGRAMA'

/**
 * Parâmetros para submeter um artefato para aprovação via workflow.
 * Utilizado pela função {@link submeterArtefato}.
 */
export interface SubmeterArtefatoParams {
  /** ID do projeto ao qual o artefato pertence */
  projeto_id: number
  /** Tipo do artefato (determina tabela e registros de histórico) */
  tipo: TipoArtefato
  /** ID do registro na tabela do artefato (ex: tap_versoes.id) */
  referencia_id: number
  /**
   * Nome da tabela no banco de dados onde o status do artefato é atualizado.
   * Exemplos: 'tap_versoes', 'viabilidade', 'cronogramas'
   */
  tabela: string
  /**
   * Nome do campo a ser registrado no histórico de alterações do projeto.
   * Exemplos: 'tap_status', 'viabilidade_status', 'cronograma_status'
   */
  campoHistorico: string
  /** Dados do usuário que está realizando a submissão */
  session: { id: number; nome: string; perfil: string }
  /** Etapas configuradas pelo usuário para o workflow */
  etapas: EtapaInput[]
  /** ID de modelo existente a ser associado ao workflow (opcional) */
  modeloId?: number | null
  /** Se informado, salva um novo modelo de workflow com este nome */
  novoModelo?: { nome: string }
}

// ─── Funções exportadas ───────────────────────────────────────────────────────

/**
 * Verifica se um artefato está bloqueado para edição com base no seu status.
 *
 * A edição é bloqueada quando o artefato está em aprovação (PENDENTE_APROVACAO)
 * ou já foi aprovado (APROVADO). Somente documentos em RASCUNHO ou CANCELADO
 * podem ser editados.
 *
 * @param status - Status atual do artefato
 * @returns `true` se a edição deve ser bloqueada; `false` se for permitida
 *
 * @usedBy TAP PATCH (`app/api/projetos/[id]/tap/[tapId]/route.ts`)
 * @usedBy Viabilidade PATCH (`app/api/projetos/[id]/viabilidade/[vid]/route.ts`)
 * @usedBy Cronograma PATCH (qualquer rota futura)
 *
 * @example
 * ```ts
 * import { verificarBloqueioEdicao } from '@/lib/artefatos'
 *
 * if (verificarBloqueioEdicao(tap.status)) {
 *   return NextResponse.json({ error: 'Documento não pode ser editado.' }, { status: 403 })
 * }
 * ```
 */
export function verificarBloqueioEdicao(status: string): boolean {
  return status === 'PENDENTE_APROVACAO' || status === 'APROVADO'
}

/**
 * Submete um artefato para aprovação criando o workflow e registrando todas
 * as operações necessárias de forma atômica (transação única).
 *
 * Esta função centraliza o fluxo completo de submissão, eliminando duplicação
 * entre os artefatos TAP, Viabilidade, Cronograma e futuros.
 *
 * Fluxo executado atomicamente:
 * 1. Salva novo modelo de workflow (se `novoModelo` informado)
 * 2. Cria o workflow via `criarWorkflow()` (cancela workflows anteriores do mesmo documento)
 * 3. Atualiza o status do artefato para `PENDENTE_APROVACAO`
 * 4. Faz upsert no registro legado de `aprovacoes` (auditoria)
 * 5. Registra alteração no histórico do projeto (Timeline)
 * 6. Registra auditoria imutável do sistema
 *
 * Em caso de qualquer falha, todas as operações são revertidas (rollback).
 *
 * @param params - Parâmetros de submissão. Veja {@link SubmeterArtefatoParams}.
 * @throws {Error} Se a operação falhar no banco de dados (com rollback automático)
 *
 * @usedBy TAP submeter (`app/api/projetos/[id]/tap/[tapId]/submeter/route.ts`)
 * @usedBy Viabilidade submeter (`app/api/projetos/[id]/viabilidade/[vid]/submeter/route.ts`)
 * @usedBy Cronograma submeter (`app/api/projetos/[id]/cronograma/[cronogramaId]/submeter/route.ts`)
 *
 * @example
 * ```ts
 * import { submeterArtefato } from '@/lib/artefatos'
 *
 * submeterArtefato({
 *   projeto_id: 1,
 *   tipo: 'TAP',
 *   referencia_id: tapId,
 *   tabela: 'tap_versoes',
 *   campoHistorico: 'tap_status',
 *   session,
 *   etapas: body.etapas,
 *   novoModelo: body.novoModelo,
 * })
 * ```
 */
export async function submeterArtefato(params: SubmeterArtefatoParams): Promise<void> {
  const {
    projeto_id, tipo, referencia_id, tabela, campoHistorico,
    session, etapas, novoModelo,
  } = params

  const db: Database = getDb()

  const executar = db.transaction(() => {
    // 1. Salvar novo modelo de workflow, se solicitado
    let modeloId = params.modeloId ?? null
    if (novoModelo?.nome?.trim()) {
      const r = db.prepare(
        'INSERT INTO workflow_modelos (nome, criado_por, criado_por_nome) VALUES (?, ?, ?)'
      ).run(novoModelo.nome.trim(), session.id, session.nome)
      const mId = r.lastInsertRowid as number
      const ins = db.prepare(
        'INSERT INTO workflow_modelo_etapas (modelo_id, ordem, usuario_id, usuario_nome, tipo) VALUES (?, ?, ?, ?, ?)'
      )
      for (const e of etapas) ins.run(mId, e.ordem, e.usuario_id, e.usuario_nome, e.tipo)
      modeloId = mId
    }

    // 2. Criar workflow (cancela qualquer workflow ativo anterior deste documento)
    criarWorkflow({
      projeto_id,
      tipo,
      referencia_id,
      criado_por: session.id,
      etapas,
      modelo_id: modeloId,
    })

    // 3. Atualizar status do artefato para PENDENTE_APROVACAO
    // tap_versoes e viabilidade já estão em Postgres (asyncDb) — esse UPDATE roda
    // fora desta transação SQLite, depois que ela confirmar (ver abaixo). Cronograma
    // continua em SQLite, dentro da transação, como sempre.
    if (tabela !== 'tap_versoes' && tabela !== 'viabilidade') {
      db.prepare(
        `UPDATE ${tabela} SET status = 'PENDENTE_APROVACAO' WHERE id = ?`
      ).run(referencia_id)
    }

    // 4. Upsert no registro legado de aprovações (auditoria/compatibilidade)
    const tipoTabela = tipo === 'TAP' ? 'tap_versoes'
      : tipo === 'VIABILIDADE' ? 'viabilidade'
      : 'cronogramas'

    const aprovExist = db
      .prepare(`SELECT id FROM aprovacoes WHERE referencia_id = ? AND tipo = ?`)
      .get(referencia_id, tipo)

    if (aprovExist) {
      db.prepare(
        `UPDATE aprovacoes SET status = 'PENDENTE', solicitante_id = ? WHERE referencia_id = ? AND tipo = ?`
      ).run(session.id, referencia_id, tipo)
    } else {
      db.prepare(`
        INSERT INTO aprovacoes (projeto_id, tipo, referencia_id, referencia_tipo, status, solicitante_id, observacao_req)
        VALUES (?, ?, ?, ?, 'PENDENTE', ?, 'Enviado para aprovação via workflow')
      `).run(projeto_id, tipo, referencia_id, tipoTabela, session.id)
    }

    // 5. Histórico de alterações do projeto (exibido na Timeline)
    registrarHistoricoAlteracao({
      projeto_id,
      usuario_id: session.id,
      usuario_nome: session.nome,
      campo: campoHistorico,
      valor_anterior: 'RASCUNHO',
      valor_novo: 'PENDENTE_APROVACAO',
      acao: 'SUBMIT',
    })

    // 6. Auditoria imutável do sistema
    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'SUBMIT',
      entidade: tabela,
      entidade_id: referencia_id,
      projeto_id,
      descricao: `${tipo} enviado para aprovação por ${session.nome} com ${etapas.length} etapa(s) no workflow.`,
      dados_depois: { status: 'PENDENTE_APROVACAO', etapas: etapas.length },
    })
  })

  executar()

  if (tabela === 'tap_versoes') {
    await TapRepository.updateStatus(referencia_id, 'PENDENTE_APROVACAO')
  } else if (tabela === 'viabilidade') {
    await ViabilidadeRepository.updateStatus(referencia_id, 'PENDENTE_APROVACAO')
  }
}
