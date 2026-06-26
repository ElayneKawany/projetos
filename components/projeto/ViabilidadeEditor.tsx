'use client'

import { useState } from 'react'

interface ViabilidadeData {
  id: number
  versao: number
  status: string
  resumo_executivo?: string
  investimento_total?: number
  roi?: number
  vpl?: number
  tir?: number
  payback_meses?: number
  sistemas_envolvidos?: string
  complexidade_tecnica?: string
  dependencia_fornecedores?: string
  infraestrutura?: string
  impacto_operacional?: string
  mudanca_processo?: string
  recursos_necessarios?: string
  impactos?: string
  riscos?: string
  data_inicio_prev?: string
  data_fim_prev?: string
  marcos?: string
  recomendacao?: string
  justificativa_recomendacao?: string
  conclusao?: string
  created_at: string
}

interface Props {
  viabilidade: ViabilidadeData | null
  projetoId: number
  canEdit: boolean
  canApprove: boolean
  onRefresh: () => void
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    APROVADO: { bg: 'bg-green-100', text: 'text-green-700', label: '✓ Aprovado' },
    PENDENTE_APROVACAO: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⏳ Pendente de Aprovação' },
    RASCUNHO: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Rascunho' },
    REPROVADO: { bg: 'bg-red-100', text: 'text-red-700', label: '✕ Reprovado' },
  }
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${s.bg} ${s.text}`}>
      {s.label}
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

function TextValue({ value, placeholder }: { value?: string | number; placeholder?: string }) {
  const display = value !== undefined && value !== null && value !== '' ? String(value) : null
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap">
      {display ?? <span className="text-gray-400 italic">{placeholder ?? 'Não preenchido'}</span>}
    </p>
  )
}

function FinanceRow({ label, value, format }: { label: string; value?: number; format?: string }) {
  const formatted =
    value === undefined || value === null
      ? '—'
      : format === 'currency'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
      : format === 'percent'
      ? `${value.toFixed(2)}%`
      : String(value)

  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{formatted}</span>
    </div>
  )
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <label className="input-label">{label}</label>
      <input
        type="number"
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

const RECOMENDACAO_OPTIONS = [
  { value: 'VIAVEL', label: 'Viável' },
  { value: 'VIAVEL_AJUSTES', label: 'Viável com ajustes' },
  { value: 'NAO_VIAVEL', label: 'Não viável' },
]

export default function ViabilidadeEditor({ viabilidade, projetoId, canEdit, canApprove, onRefresh }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    resumo_executivo: viabilidade?.resumo_executivo ?? '',
    investimento_total: viabilidade?.investimento_total?.toString() ?? '',
    roi: viabilidade?.roi?.toString() ?? '',
    vpl: viabilidade?.vpl?.toString() ?? '',
    tir: viabilidade?.tir?.toString() ?? '',
    payback_meses: viabilidade?.payback_meses?.toString() ?? '',
    sistemas_envolvidos: viabilidade?.sistemas_envolvidos ?? '',
    complexidade_tecnica: viabilidade?.complexidade_tecnica ?? '',
    dependencia_fornecedores: viabilidade?.dependencia_fornecedores ?? '',
    infraestrutura: viabilidade?.infraestrutura ?? '',
    impacto_operacional: viabilidade?.impacto_operacional ?? '',
    mudanca_processo: viabilidade?.mudanca_processo ?? '',
    recursos_necessarios: viabilidade?.recursos_necessarios ?? '',
    impactos: viabilidade?.impactos ?? '',
    riscos: viabilidade?.riscos ?? '',
    data_inicio_prev: viabilidade?.data_inicio_prev ?? '',
    data_fim_prev: viabilidade?.data_fim_prev ?? '',
    marcos: viabilidade?.marcos ?? '',
    recomendacao: viabilidade?.recomendacao ?? '',
    justificativa_recomendacao: viabilidade?.justificativa_recomendacao ?? '',
    conclusao: viabilidade?.conclusao ?? '',
  })

  const isEditable = canEdit && viabilidade && (viabilidade.status === 'RASCUNHO' || viabilidade.status === 'PENDENTE_APROVACAO')
  const canApproveVib = canApprove && viabilidade?.status === 'PENDENTE_APROVACAO'

  const setField = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  async function handleSave() {
    if (!viabilidade) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { ...form }
      for (const k of ['investimento_total', 'roi', 'vpl', 'tir', 'payback_meses']) {
        const v = form[k as keyof typeof form]
        body[k] = v !== '' ? parseFloat(v as string) : null
      }
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}`, {
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
    if (!viabilidade) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/aprovar`, {
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
    if (!viabilidade) return
    const obs = window.prompt('Observação para revisão (obrigatório):')
    if (!obs) return
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/revisao`, {
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

  if (!viabilidade) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Estudo de Viabilidade</h3>
        </div>
        <div className="p-6 text-center text-gray-500">
          <p className="text-sm">Nenhum estudo de viabilidade encontrado para este projeto.</p>
          <p className="text-xs mt-1 text-gray-400">O estudo é gerado automaticamente ao avançar para a fase de Viabilidade.</p>
        </div>
      </div>
    )
  }

  const recomLabel = RECOMENDACAO_OPTIONS.find((o) => o.value === viabilidade.recomendacao)?.label ?? viabilidade.recomendacao

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="card-title">Estudo de Viabilidade V{viabilidade.versao}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Criado em {new Date(viabilidade.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={viabilidade.status} />
            {isEditable && !editing && (
              <button className="btn-secondary text-sm" onClick={() => setEditing(true)}>
                Editar
              </button>
            )}
            {editing && (
              <>
                <button className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button className="btn-secondary text-sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </button>
              </>
            )}
            {canApproveVib && !editing && (
              <>
                <button className="btn-primary text-sm" onClick={handleAprovar} disabled={approving}>
                  {approving ? 'Aprovando…' : 'Aprovar'}
                </button>
                <button className="btn-secondary text-sm" onClick={handleSolicitarRevisao}>
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

      {/* Content */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#C8A84B' }}>
            <span className="text-white font-bold text-xs">VIA</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Estudo de Viabilidade</h2>
            <p className="text-xs text-gray-500">Versão {viabilidade.versao}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-2">
            <TextAreaField label="2. Resumo Executivo" value={form.resumo_executivo} onChange={setField('resumo_executivo')} />
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>3.1 Viabilidade Financeira</h4>
              <NumberField label="Investimento Total (R$)" value={form.investimento_total} onChange={setField('investimento_total')} />
              <NumberField label="ROI (%)" value={form.roi} onChange={setField('roi')} />
              <NumberField label="VPL (R$)" value={form.vpl} onChange={setField('vpl')} />
              <NumberField label="TIR (%)" value={form.tir} onChange={setField('tir')} />
              <NumberField label="Payback (meses)" value={form.payback_meses} onChange={setField('payback_meses')} />
            </div>
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>3.2 Viabilidade Técnica</h4>
              <TextAreaField label="Sistemas Envolvidos" value={form.sistemas_envolvidos} onChange={setField('sistemas_envolvidos')} />
              <TextAreaField label="Complexidade Técnica" value={form.complexidade_tecnica} onChange={setField('complexidade_tecnica')} />
              <TextAreaField label="Dependência de Fornecedores" value={form.dependencia_fornecedores} onChange={setField('dependencia_fornecedores')} />
              <TextAreaField label="Infraestrutura" value={form.infraestrutura} onChange={setField('infraestrutura')} />
            </div>
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>3.3 Viabilidade Operacional</h4>
              <TextAreaField label="Impacto Operacional" value={form.impacto_operacional} onChange={setField('impacto_operacional')} />
              <TextAreaField label="Mudança de Processo" value={form.mudanca_processo} onChange={setField('mudanca_processo')} />
              <TextAreaField label="Recursos Necessários / Treinamento" value={form.recursos_necessarios} onChange={setField('recursos_necessarios')} />
            </div>
            <TextAreaField label="4. Impacto no Negócio" value={form.impactos} onChange={setField('impactos')} />
            <TextAreaField label="5. Riscos Principais" value={form.riscos} onChange={setField('riscos')} />
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>6. Estimativa de Prazo</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Data Início Prevista</label>
                  <input type="date" className="input w-full" value={form.data_inicio_prev} onChange={(e) => setField('data_inicio_prev')(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Data Fim Prevista</label>
                  <input type="date" className="input w-full" value={form.data_fim_prev} onChange={(e) => setField('data_fim_prev')(e.target.value)} />
                </div>
              </div>
              <TextAreaField label="Marcos Principais" value={form.marcos} onChange={setField('marcos')} />
            </div>
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>7. Recomendação</h4>
              <div className="flex gap-4 mb-3">
                {RECOMENDACAO_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recomendacao"
                      value={opt.value}
                      checked={form.recomendacao === opt.value}
                      onChange={() => setField('recomendacao')(opt.value)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
              <TextAreaField label="Justificativa" value={form.justificativa_recomendacao} onChange={setField('justificativa_recomendacao')} />
            </div>
            <TextAreaField label="8. Conclusão" value={form.conclusao} onChange={setField('conclusao')} />
          </div>
        ) : (
          <div>
            <SectionBlock number="1" title="Identificação do Projeto">
              <p className="text-sm text-gray-700">
                Versão {viabilidade.versao} · Criado em {new Date(viabilidade.created_at).toLocaleDateString('pt-BR')}
              </p>
            </SectionBlock>

            <SectionBlock number="2" title="Resumo Executivo">
              <TextValue value={viabilidade.resumo_executivo} />
            </SectionBlock>

            <SectionBlock number="3" title="Análise de Viabilidade">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">3.1 Viabilidade Financeira</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <FinanceRow label="Investimento Total" value={viabilidade.investimento_total} format="currency" />
                    <FinanceRow label="ROI" value={viabilidade.roi} format="percent" />
                    <FinanceRow label="VPL" value={viabilidade.vpl} format="currency" />
                    <FinanceRow label="TIR" value={viabilidade.tir} format="percent" />
                    <FinanceRow label="Payback" value={viabilidade.payback_meses !== undefined ? viabilidade.payback_meses : undefined} />
                  </div>
                  {viabilidade.payback_meses !== undefined && viabilidade.payback_meses !== null && (
                    <p className="text-xs text-gray-400 mt-1">Payback: {viabilidade.payback_meses} meses</p>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">3.2 Viabilidade Técnica</h4>
                  <div className="space-y-2">
                    <div><span className="text-xs font-medium text-gray-400">Sistemas:</span> <TextValue value={viabilidade.sistemas_envolvidos} /></div>
                    <div><span className="text-xs font-medium text-gray-400">Complexidade:</span> <TextValue value={viabilidade.complexidade_tecnica} /></div>
                    <div><span className="text-xs font-medium text-gray-400">Dependências:</span> <TextValue value={viabilidade.dependencia_fornecedores} /></div>
                    <div><span className="text-xs font-medium text-gray-400">Infraestrutura:</span> <TextValue value={viabilidade.infraestrutura} /></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">3.3 Viabilidade Operacional</h4>
                  <div className="space-y-2">
                    <div><span className="text-xs font-medium text-gray-400">Impacto operacional:</span> <TextValue value={viabilidade.impacto_operacional} /></div>
                    <div><span className="text-xs font-medium text-gray-400">Mudança de processo:</span> <TextValue value={viabilidade.mudanca_processo} /></div>
                    <div><span className="text-xs font-medium text-gray-400">Recursos / Treinamento:</span> <TextValue value={viabilidade.recursos_necessarios} /></div>
                  </div>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock number="4" title="Impacto no Negócio">
              <TextValue value={viabilidade.impactos} />
            </SectionBlock>

            <SectionBlock number="5" title="Riscos Principais">
              <TextValue value={viabilidade.riscos} />
            </SectionBlock>

            <SectionBlock number="6" title="Estimativa de Prazo">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-xs text-gray-400 block">Início previsto</span>
                  <span className="text-sm font-medium">
                    {viabilidade.data_inicio_prev
                      ? new Date(viabilidade.data_inicio_prev).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Fim previsto</span>
                  <span className="text-sm font-medium">
                    {viabilidade.data_fim_prev
                      ? new Date(viabilidade.data_fim_prev).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-1">Marcos</span>
                <TextValue value={viabilidade.marcos} />
              </div>
            </SectionBlock>

            <SectionBlock number="7" title="Recomendação">
              {viabilidade.recomendacao ? (
                <div className="space-y-2">
                  <div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor:
                          viabilidade.recomendacao === 'VIAVEL'
                            ? '#D1FAE5'
                            : viabilidade.recomendacao === 'VIAVEL_AJUSTES'
                            ? '#FEF3C7'
                            : '#FEE2E2',
                        color:
                          viabilidade.recomendacao === 'VIAVEL'
                            ? '#065F46'
                            : viabilidade.recomendacao === 'VIAVEL_AJUSTES'
                            ? '#92400E'
                            : '#991B1B',
                      }}
                    >
                      {recomLabel}
                    </span>
                  </div>
                  <TextValue value={viabilidade.justificativa_recomendacao} placeholder="Sem justificativa" />
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Recomendação não definida</p>
              )}
            </SectionBlock>

            <SectionBlock number="8" title="Conclusão">
              <TextValue value={viabilidade.conclusao} />
            </SectionBlock>
          </div>
        )}
      </div>
    </div>
  )
}
