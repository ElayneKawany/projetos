'use client'

import { useState } from 'react'

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
  canApprove: boolean
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'APROVADO') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
        ✓ Aprovado
      </span>
    )
  }
  if (status === 'PENDENTE_APROVACAO') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">
        ⏳ Pendente de Aprovação
      </span>
    )
  }
  if (status === 'RASCUNHO') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">
        Rascunho
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">
      {status}
    </span>
  )
}

function SectionBlock({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: '#003087' }}>
        <span className="text-white text-xs font-mono bg-white/20 px-2 py-0.5 rounded">{number}</span>
        <span className="text-white font-semibold text-sm">{title}</span>
      </div>
      <div className="p-4 bg-white">{children}</div>
    </div>
  )
}

function TextValue({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap">
      {value || <span className="text-gray-400 italic">{placeholder ?? 'Não preenchido'}</span>}
    </p>
  )
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

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-3">
      <label className="input-label">{label}</label>
      <textarea
        className="input w-full min-h-[80px] resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
  canApprove,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
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

  const isEditable =
    canEdit && tap && (tap.status === 'PENDENTE_APROVACAO' || tap.status === 'RASCUNHO')
  const canApproveTap = canApprove && tap?.status === 'PENDENTE_APROVACAO'

  async function handleSave() {
    if (!tap) return
    setSaving(true)
    setError(null)
    try {
      const body = {
        ...form,
        setores_envolvidos: JSON.stringify(form.setores_envolvidos.filter(Boolean)),
        etapas_projeto: JSON.stringify(form.etapas_projeto.filter(Boolean)),
        entregaveis: JSON.stringify(form.entregaveis.filter(Boolean)),
        pontos_atencao: JSON.stringify(form.pontos_atencao.filter(Boolean)),
        pontos_definir: JSON.stringify(form.pontos_definir.filter(Boolean)),
      }
      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setEditing(false)
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAprovar() {
    if (!tap) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}/aprovar`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao aprovar')
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setApproving(false)
    }
  }

  async function handleSolicitarRevisao() {
    if (!tap) return
    const obs = window.prompt('Observação para revisão (obrigatório):')
    if (!obs) return
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/tap/${tap.id}/revisao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: obs }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao solicitar revisão')
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

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
            {isEditable && !editing && (
              <button
                className="btn-secondary text-sm"
                onClick={() => setEditing(true)}
              >
                Editar
              </button>
            )}
            {editing && (
              <>
                <button
                  className="btn-primary text-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </>
            )}
            {canApproveTap && !editing && (
              <>
                <button
                  className="btn-primary text-sm"
                  onClick={handleAprovar}
                  disabled={approving}
                >
                  {approving ? 'Aprovando…' : 'Aprovar'}
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={handleSolicitarRevisao}
                >
                  Solicitar Revisão
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

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
    </div>
  )
}
