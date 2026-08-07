'use client'

import { useState } from 'react'
import { StatusBadge, SectionBlock, TextValue, TextAreaField } from './ArtefatoShared'
import ArtefatoActions from './ArtefatoActions'
import AlertaValidacao from './AlertaValidacao'
import { validarTap, type ErroValidacao } from '@/lib/validacoes-artefatos'
import WorkflowStatusPanel, { type WorkflowInfo } from './WorkflowStatusPanel'
import EnviarAprovacaoModal, { type EtapaInput } from './EnviarAprovacaoModal'
import ImportacaoModal from './ImportacaoModal'
import type { TapImportado } from '@/lib/importadores/tap-modelo'
import { useDownload } from './useDownload'

interface TapData {
  id: number
  versao: number
  label: string
  fase_origem: string
  status: string
  objetivo_detalhado?: string
  situacao_atual?: string
  escopo_fisico?: string
  escopo_sistemico?: string
  escopo_processo?: string
  setores_envolvidos?: string
  etapas_projeto?: string
  entregaveis?: string
  pontos_atencao?: string
  pontos_definir?: string
  beneficios_tap?: string
  created_at: string
}

interface Props {
  tap: TapData | null
  projetoId: number
  projetoNome: string
  projetoCodigo: string
  canEdit: boolean
  canSubmit: boolean
  isAdmin: boolean
  workflow: WorkflowInfo | null
  sessionUser: { id: number; nome: string }
  usuarios: { id: number; nome: string }[]
  onRefresh: () => void
}

function parseJsonArray(val?: string): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function ListValue({ items, placeholder }: { items: string[]; placeholder?: string }) {
  if (!items.length) {
    return <p className="text-sm text-gray-400 italic">{placeholder ?? 'Não preenchido'}</p>
  }
  return (
    <ul className="list-disc list-inside space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-gray-700">{item}</li>
      ))}
    </ul>
  )
}

function ListAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const text = value.join('\n')
  return (
    <div className="mb-3">
      <label className="input-label">{label} (uma por linha)</label>
      <textarea
        className="input w-full min-h-[80px] resize-y"
        value={text}
        onChange={(e) => onChange(e.target.value.split('\n'))}
      />
    </div>
  )
}

export default function TapEditor({
  tap,
  projetoId,
  projetoNome,
  projetoCodigo,
  canEdit,
  canSubmit,
  isAdmin,
  workflow,
  sessionUser,
  usuarios,
  onRefresh,
}: Props) {
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Validação e modais de aprovação
  const [validacaoErros, setValidacaoErros]       = useState<ErroValidacao[]>([])
  const [validacaoSucesso, setValidacaoSucesso]   = useState(false)
  const [showEnviarModal, setShowEnviarModal]     = useState(false)
  const [submitting, setSubmitting]               = useState(false)
  const [approving, setApproving]                 = useState(false)
  const [showRevisaoModal, setShowRevisaoModal]   = useState(false)
  const [revisaoObs, setRevisaoObs]               = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const { baixar, baixando, erroDownload, setErroDownload } = useDownload()

  const [form, setForm] = useState({
    objetivo_detalhado: tap?.objetivo_detalhado ?? '',
    situacao_atual: tap?.situacao_atual ?? '',
    escopo_fisico: tap?.escopo_fisico ?? '',
    escopo_sistemico: tap?.escopo_sistemico ?? '',
    escopo_processo: tap?.escopo_processo ?? '',
    beneficios_tap: tap?.beneficios_tap ?? '',
    setores_envolvidos: parseJsonArray(tap?.setores_envolvidos),
    etapas_projeto: parseJsonArray(tap?.etapas_projeto),
    entregaveis: parseJsonArray(tap?.entregaveis),
    pontos_atencao: parseJsonArray(tap?.pontos_atencao),
    pontos_definir: parseJsonArray(tap?.pontos_definir),
  })

  // Botão "Editar" visível para RASCUNHO e APROVADO (quando canEdit).
  // Em APROVADO, handleEditar exibe mensagem sem habilitar campos.
  const isEditable = canEdit && (tap?.status === 'RASCUNHO' || tap?.status === 'APROVADO')

  async function handleSave() {
    if (!tap) return
    setSaving(true)
    setError(null)
    try {
      const body = {
        ...form,
        setores_envolvidos: JSON.stringify(form.setores_envolvidos.filter(Boolean)),
        etapas_projeto:     JSON.stringify(form.etapas_projeto.filter(Boolean)),
        entregaveis:        JSON.stringify(form.entregaveis.filter(Boolean)),
        pontos_atencao:     JSON.stringify(form.pontos_atencao.filter(Boolean)),
        pontos_definir:     JSON.stringify(form.pontos_definir.filter(Boolean)),
      }

      // ADMIN editando TAP aprovado → cria nova versão em RASCUNHO, preserva a aprovada
      if (tap.status === 'APROVADO' && isAdmin) {
        const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}/nova-versao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao criar nova versão')
        setEditing(false)
        onRefresh()
        return
      }

      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setEditing(false)
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleEnviarParaAprovacao() {
    if (!tap) return
    setValidacaoErros([])
    setValidacaoSucesso(false)

    const erros = validarTap(tap)
    if (erros.length) {
      setValidacaoErros(erros)
    } else {
      setShowEnviarModal(true)
    }
  }

  async function handleConfirmarWorkflow(
    etapas: EtapaInput[],
    modeloId?: number,
    novoModelo?: { nome: string }
  ) {
    if (!tap) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}/submeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapas, modeloId, novoModelo }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao enviar')
      setShowEnviarModal(false)
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar para aprovação')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAprovar() {
    if (!tap || !workflow) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}/aprovar`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao aprovar')
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao processar')
    } finally {
      setApproving(false)
    }
  }

  async function handleSolicitarRevisao() {
    if (!tap || !workflow || !revisaoObs.trim()) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}/revisao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: revisaoObs }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao solicitar revisão')
      setShowRevisaoModal(false)
      setRevisaoObs('')
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao solicitar revisão')
    } finally {
      setApproving(false)
    }
  }

  function limparValidacao() {
    setValidacaoErros([])
    setValidacaoSucesso(false)
  }

  // Calcula se o usuário logado é o responsável pela etapa atual do workflow
  const etapaAtual = workflow?.etapas.find(e => e.ordem === workflow.etapa_atual)
  const isEtapaAtual = etapaAtual?.usuario_id === sessionUser.id

  if (!tap) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">TAP – Termo de Abertura do Projeto</h3>
        </div>
        <div className="p-6 text-center text-gray-500">
          <p className="text-sm">Nenhum TAP encontrado para este projeto.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="card-title">
              {tap.label} – Termo de Abertura do Projeto
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {projetoCodigo} · {projetoNome}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={tap.status} />
            {/* Exportar/Importar — apenas em modo de edição */}
            {editing && tap.status !== 'APROVADO' && (
              <>
                <button
                  className="btn-secondary text-xs px-2.5 py-1.5 inline-flex items-center gap-1 disabled:opacity-50"
                  disabled={!!baixando}
                  title="Exportar modelo Excel com os dados atuais"
                  onClick={() => baixar(
                    `/api/projetos/${projetoId}/tap/${tap.id}/exportar-modelo`,
                    `TAP_${projetoCodigo}_${tap.label ?? `v${tap.versao}`}.xlsx`,
                  )}
                >
                  {baixando ? '⏳ Gerando…' : '📤 Exportar Modelo'}
                </button>
                <button
                  className="btn-secondary text-xs px-2.5 py-1.5 inline-flex items-center gap-1"
                  title="Importar arquivo modelo preenchido"
                  onClick={() => {
                    const temDados = Object.values(form).some(v =>
                      Array.isArray(v) ? v.length > 0 : String(v ?? '').trim().length > 0
                    )
                    if (
                      temDados &&
                      !window.confirm(
                        'Este documento já possui informações preenchidas. Deseja substituir os dados pelos dados do arquivo importado?'
                      )
                    ) return
                    setShowImportModal(true)
                  }}
                >
                  📥 Importar TAP
                </button>
              </>
            )}
            {erroDownload && (
              <span className="text-xs text-red-600">{erroDownload}
                <button className="ml-1 underline" onClick={() => setErroDownload(null)}>✕</button>
              </span>
            )}
            <ArtefatoActions
              artefatoStatus={tap.status}
              canEdit={isEditable}
              canSubmit={canSubmit}
              editing={editing}
              saving={saving}
              onEditar={() => {
                if (tap.status === 'APROVADO' && !isAdmin) {
                  setError('Este documento foi aprovado e não pode ser alterado.')
                  return
                }
                setEditing(true)
                limparValidacao()
              }}
              onEnviarParaAprovacao={handleEnviarParaAprovacao}
              onSalvar={handleSave}
              onCancelar={() => setEditing(false)}
            />
          </div>
        </div>
      </div>

      {/* Alerta de validação (erros de campos) */}
      <AlertaValidacao
        erros={validacaoErros}
        sucesso={validacaoSucesso}
        onFechar={limparValidacao}
      />

      {/* Painel do workflow quando em aprovação */}
      {workflow && tap?.status === 'PENDENTE_APROVACAO' && (
        <WorkflowStatusPanel
          workflow={workflow}
          sessionId={sessionUser.id}
          actions={isEtapaAtual ? (
            <>
              <button
                className="btn-primary text-sm"
                disabled={approving}
                onClick={handleAprovar}
              >
                {etapaAtual?.tipo === 'CIENCIA' ? (approving ? 'Processando…' : 'Confirmar Ciência') : (approving ? 'Aprovando…' : 'Aprovar')}
              </button>
              {etapaAtual?.tipo === 'APROVACAO' && (
                <button
                  className="btn-secondary text-sm"
                  disabled={approving}
                  onClick={() => setShowRevisaoModal(true)}
                >
                  Solicitar Revisão
                </button>
              )}
            </>
          ) : undefined}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Modal: Solicitar Revisão */}
      {showRevisaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-3">Solicitar Revisão</h3>
            <p className="text-sm text-gray-500 mb-4">Descreva o motivo da revisão. O documento retornará para RASCUNHO.</p>
            <textarea
              className="input w-full min-h-[100px] resize-y"
              placeholder="Observação obrigatória…"
              value={revisaoObs}
              onChange={(e) => setRevisaoObs(e.target.value)}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn-secondary text-sm" onClick={() => { setShowRevisaoModal(false); setRevisaoObs('') }}>
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                disabled={!revisaoObs.trim() || approving}
                onClick={handleSolicitarRevisao}
              >
                {approving ? 'Enviando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar para Aprovação */}
      <EnviarAprovacaoModal
        isOpen={showEnviarModal}
        onClose={() => setShowEnviarModal(false)}
        onConfirm={handleConfirmarWorkflow}
        sessionUser={sessionUser}
        usuarios={usuarios}
        submitting={submitting}
      />

      {/* TAP content */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#003087' }}>
            <span className="text-white font-bold text-sm">TAP</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Escopo de Projeto</h2>
            <p className="text-xs text-gray-500">
              Criado em {new Date(tap.created_at).toLocaleDateString('pt-BR')} · Fase: {tap.fase_origem} · Versão {tap.versao}
            </p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-2">
            <TextAreaField
              label="1. Objetivo do Projeto"
              value={form.objetivo_detalhado}
              onChange={(v) => setForm((f) => ({ ...f, objetivo_detalhado: v }))}
            />
            <TextAreaField
              label="2. Situação Atual"
              value={form.situacao_atual}
              onChange={(v) => setForm((f) => ({ ...f, situacao_atual: v }))}
            />
            <TextAreaField
              label="3.1 Escopo Físico"
              value={form.escopo_fisico}
              onChange={(v) => setForm((f) => ({ ...f, escopo_fisico: v }))}
            />
            <TextAreaField
              label="3.2 Escopo Sistêmico"
              value={form.escopo_sistemico}
              onChange={(v) => setForm((f) => ({ ...f, escopo_sistemico: v }))}
            />
            <TextAreaField
              label="3.3 Escopo de Processo"
              value={form.escopo_processo}
              onChange={(v) => setForm((f) => ({ ...f, escopo_processo: v }))}
            />
            <ListAreaField
              label="4. Setores Envolvidos"
              value={form.setores_envolvidos}
              onChange={(v) => setForm((f) => ({ ...f, setores_envolvidos: v }))}
            />
            <ListAreaField
              label="5. Etapas do Projeto"
              value={form.etapas_projeto}
              onChange={(v) => setForm((f) => ({ ...f, etapas_projeto: v }))}
            />
            <ListAreaField
              label="6. Entregáveis"
              value={form.entregaveis}
              onChange={(v) => setForm((f) => ({ ...f, entregaveis: v }))}
            />
            <ListAreaField
              label="7. Pontos de Atenção"
              value={form.pontos_atencao}
              onChange={(v) => setForm((f) => ({ ...f, pontos_atencao: v }))}
            />
            <TextAreaField
              label="8. Benefícios Esperados"
              value={form.beneficios_tap}
              onChange={(v) => setForm((f) => ({ ...f, beneficios_tap: v }))}
            />
            <ListAreaField
              label="9. Pontos a serem definidos"
              value={form.pontos_definir}
              onChange={(v) => setForm((f) => ({ ...f, pontos_definir: v }))}
            />
          </div>
        ) : (
          <div>
            <SectionBlock number="1" title="Objetivo do Projeto">
              <TextValue value={tap.objetivo_detalhado} />
            </SectionBlock>

            <SectionBlock number="2" title="Situação Atual">
              <TextValue value={tap.situacao_atual} />
            </SectionBlock>

            <SectionBlock number="3" title="Escopo do Projeto">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">3.1 Escopo Físico</h4>
                  <TextValue value={tap.escopo_fisico} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">3.2 Escopo Sistêmico</h4>
                  <TextValue value={tap.escopo_sistemico} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">3.3 Escopo de Processo</h4>
                  <TextValue value={tap.escopo_processo} />
                </div>
              </div>
            </SectionBlock>

            <SectionBlock number="4" title="Setores Envolvidos">
              <ListValue items={parseJsonArray(tap.setores_envolvidos)} placeholder="Nenhum setor listado" />
            </SectionBlock>

            <SectionBlock number="5" title="Etapas do Projeto">
              <ListValue items={parseJsonArray(tap.etapas_projeto)} placeholder="Nenhuma etapa listada" />
            </SectionBlock>

            <SectionBlock number="6" title="Entregáveis">
              <ListValue items={parseJsonArray(tap.entregaveis)} placeholder="Nenhum entregável listado" />
            </SectionBlock>

            <SectionBlock number="7" title="Pontos de Atenção">
              <ListValue items={parseJsonArray(tap.pontos_atencao)} placeholder="Nenhum ponto de atenção listado" />
            </SectionBlock>

            <SectionBlock number="8" title="Benefícios Esperados">
              <TextValue value={tap.beneficios_tap} />
            </SectionBlock>

            <SectionBlock number="9" title="Pontos a serem Definidos">
              <ListValue items={parseJsonArray(tap.pontos_definir)} placeholder="Nenhum ponto pendente" />
            </SectionBlock>
          </div>
        )}
      </div>

      {/* Modal de importação TAP */}
      {showImportModal && tap && (
        <ImportacaoModal
          titulo="Importar TAP"
          urlImportar={`/api/projetos/${projetoId}/tap/${tap.id}/importar`}
          urlExportarXlsx={`/api/projetos/${projetoId}/tap/${tap.id}/exportar-modelo`}
          onFechar={() => setShowImportModal(false)}
          onConfirmar={(dados) => {
            const d = dados as TapImportado
            setForm({
              objetivo_detalhado: d.objetivo_detalhado ?? form.objetivo_detalhado,
              situacao_atual:     d.situacao_atual     ?? form.situacao_atual,
              escopo_fisico:      d.escopo_fisico      ?? form.escopo_fisico,
              escopo_sistemico:   d.escopo_sistemico   ?? form.escopo_sistemico,
              escopo_processo:    d.escopo_processo    ?? form.escopo_processo,
              beneficios_tap:     d.beneficios_tap     ?? form.beneficios_tap,
              setores_envolvidos: d.setores_envolvidos?.length ? d.setores_envolvidos : form.setores_envolvidos,
              etapas_projeto:     d.etapas_projeto?.length     ? d.etapas_projeto     : form.etapas_projeto,
              entregaveis:        d.entregaveis?.length        ? d.entregaveis        : form.entregaveis,
              pontos_atencao:     d.pontos_atencao?.length     ? d.pontos_atencao     : form.pontos_atencao,
              pontos_definir:     d.pontos_definir?.length     ? d.pontos_definir     : form.pontos_definir,
            })
            setEditing(true)
            setShowImportModal(false)
          }}
          renderRevisao={(dados) => {
            const d = dados as TapImportado
            return (
              <div className="space-y-2 text-sm">
                {[
                  ['Objetivo Detalhado', d.objetivo_detalhado],
                  ['Situação Atual', d.situacao_atual],
                  ['Escopo Físico', d.escopo_fisico],
                  ['Escopo Sistêmico', d.escopo_sistemico],
                  ['Escopo de Processo', d.escopo_processo],
                  ['Benefícios', d.beneficios_tap],
                ].map(([label, val]) => (
                  <div key={label} className="border-b border-gray-200 pb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{val || <span className="italic text-gray-400">— não preenchido</span>}</p>
                  </div>
                ))}
                {[
                  ['Setores Envolvidos', d.setores_envolvidos],
                  ['Etapas', d.etapas_projeto],
                  ['Entregáveis', d.entregaveis],
                  ['Pontos de Atenção', d.pontos_atencao],
                  ['Pontos a Definir', d.pontos_definir],
                ].map(([label, items]) => (
                  <div key={String(label)} className="border-b border-gray-200 pb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
                    {(items as string[]).length
                      ? <ul className="list-disc list-inside text-gray-700">{(items as string[]).map((i, k) => <li key={k}>{i}</li>)}</ul>
                      : <p className="italic text-gray-400 text-xs">— não preenchido</p>}
                  </div>
                ))}
              </div>
            )
          }}
        />
      )}
    </div>
  )
}
