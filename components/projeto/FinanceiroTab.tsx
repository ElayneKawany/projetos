'use client'

import { useState, useEffect, useRef } from 'react'

interface Lancamento {
  id: number
  projeto_id: number
  tipo: string
  categoria: string
  descricao: string
  fornecedor?: string
  numero_doc?: string
  valor: number
  data_lancamento: string
  competencia?: string
  observacoes?: string
  arquivo_nf?: string
  status: string
  criado_por: number
  criador_nome?: string
  created_at: string
}

interface Props {
  projetoId: number
  capexAprovado: number
  opexAprovado: number
  canEdit: boolean
  onRefresh: () => void
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APROVADO')
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Aprovado
      </span>
    )
  if (status === 'REJEITADO')
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        Rejeitado
      </span>
    )
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      Pendente
    </span>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number
  sub?: string
  color?: string
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className="text-xl font-bold"
        style={{ color: color ?? '#003087' }}
      >
        {fmtBRL(value)}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const TIPOS = ['CAPEX', 'OPEX'] as const
const CATEGORIAS = ['NF', 'CONTRATO', 'COMPROVANTE', 'OUTRO'] as const

interface FormState {
  tipo: string
  categoria: string
  descricao: string
  fornecedor: string
  numero_doc: string
  valor: string
  data_lancamento: string
  competencia: string
  observacoes: string
}

const emptyForm = (): FormState => ({
  tipo: 'CAPEX',
  categoria: 'NF',
  descricao: '',
  fornecedor: '',
  numero_doc: '',
  valor: '',
  data_lancamento: '',
  competencia: '',
  observacoes: '',
})

export default function FinanceiroTab({
  projetoId,
  capexAprovado,
  opexAprovado,
  canEdit,
  onRefresh,
}: Props) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchLancamentos() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/financeiro`)
      if (res.ok) {
        const data = await res.json()
        setLancamentos(data.lancamentos ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLancamentos()
  }, [projetoId])

  const capexRealizado = lancamentos
    .filter((l) => l.tipo === 'CAPEX' && l.status !== 'REJEITADO')
    .reduce((s, l) => s + l.valor, 0)

  const opexRealizado = lancamentos
    .filter((l) => l.tipo === 'OPEX' && l.status !== 'REJEITADO')
    .reduce((s, l) => s + l.valor, 0)

  const capexSaldo = capexAprovado - capexRealizado
  const opexSaldo = opexAprovado - opexRealizado

  function setField<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const hasFile = fileRef.current?.files?.[0]
      let res: Response

      if (hasFile) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        fd.append('arquivo_nf', fileRef.current!.files![0])
        res = await fetch(`/api/projetos/${projetoId}/financeiro`, {
          method: 'POST',
          body: fd,
        })
      } else {
        res = await fetch(`/api/projetos/${projetoId}/financeiro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            valor: parseFloat(form.valor),
          }),
        })
      }

      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setSuccess('Lançamento registrado com sucesso!')
      setShowModal(false)
      setForm(emptyForm())
      if (fileRef.current) fileRef.current.value = ''
      await fetchLancamentos()
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="CAPEX Aprovado" value={capexAprovado} color="#003087" />
        <SummaryCard
          label="CAPEX Realizado"
          value={capexRealizado}
          color={capexRealizado > capexAprovado ? '#DC2626' : '#16A34A'}
        />
        <SummaryCard
          label="CAPEX Saldo"
          value={capexSaldo}
          color={capexSaldo < 0 ? '#DC2626' : '#16A34A'}
          sub={capexSaldo < 0 ? 'Acima do orçamento' : undefined}
        />
        <SummaryCard label="OPEX Aprovado" value={opexAprovado} color="#003087" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryCard
          label="OPEX Realizado"
          value={opexRealizado}
          color={opexRealizado > opexAprovado ? '#DC2626' : '#16A34A'}
        />
        <SummaryCard
          label="OPEX Saldo"
          value={opexSaldo}
          color={opexSaldo < 0 ? '#DC2626' : '#16A34A'}
          sub={opexSaldo < 0 ? 'Acima do orçamento' : undefined}
        />
        <SummaryCard
          label="Total Realizado"
          value={capexRealizado + opexRealizado}
          color="#C8A84B"
        />
      </div>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Table header with action */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">Lançamentos</h3>
          {canEdit && (
            <button
              className="btn-primary text-sm"
              onClick={() => { setShowModal(true); setError(null); setSuccess(null) }}
            >
              + Novo Lançamento
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>
        ) : lancamentos.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            Nenhum lançamento registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Tipo', 'Categoria', 'Descrição', 'Fornecedor', 'Nº Doc', 'Valor', 'Data', 'Status', 'Criado por'].map(
                    (h) => (
                      <th key={h} className="text-left px-4 py-2 font-medium text-gray-500 text-xs">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          l.tipo === 'CAPEX'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {l.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{l.categoria}</td>
                    <td className="px-4 py-2 text-gray-800 max-w-[200px] truncate" title={l.descricao}>
                      {l.descricao}
                      {l.arquivo_nf && (
                        <a
                          href={l.arquivo_nf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-blue-500 hover:underline text-xs"
                          title="Ver anexo"
                        >
                          📎
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{l.fornecedor ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{l.numero_doc ?? '—'}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{fmtBRL(l.valor)}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{formatDate(l.data_lancamento)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{l.criador_nome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div
              className="px-6 py-4 flex items-center justify-between rounded-t-xl"
              style={{ backgroundColor: '#003087' }}
            >
              <h3 className="text-white font-semibold">Novo Lançamento</h3>
              <button
                className="text-white/70 hover:text-white text-xl leading-none"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Tipo *</label>
                  <select
                    className="input w-full"
                    value={form.tipo}
                    onChange={(e) => setField('tipo', e.target.value)}
                    required
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Categoria *</label>
                  <select
                    className="input w-full"
                    value={form.categoria}
                    onChange={(e) => setField('categoria', e.target.value)}
                    required
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Descrição *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Fornecedor</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={form.fornecedor}
                    onChange={(e) => setField('fornecedor', e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Nº Documento</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={form.numero_doc}
                    onChange={(e) => setField('numero_doc', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input w-full"
                    value={form.valor}
                    onChange={(e) => setField('valor', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Data do Lançamento *</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={form.data_lancamento}
                    onChange={(e) => setField('data_lancamento', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Competência (AAAA-MM)</label>
                <input
                  type="month"
                  className="input w-full"
                  value={form.competencia}
                  onChange={(e) => setField('competencia', e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Observações</label>
                <textarea
                  className="input w-full min-h-[70px] resize-y"
                  value={form.observacoes}
                  onChange={(e) => setField('observacoes', e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">
                  Anexo NF / Comprovante (PDF, imagem)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="text-sm text-gray-600 w-full file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : 'Registrar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
