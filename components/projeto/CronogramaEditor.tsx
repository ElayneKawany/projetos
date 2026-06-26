'use client'

import { useState, useEffect, useRef } from 'react'

interface CronogramaTarefa {
  id?: number
  cronograma_id?: number
  codigo?: string
  nome: string
  nivel: 'FASE' | 'TAREFA'
  data_inicio?: string
  data_fim?: string
  responsavel_id?: number | null
  responsavel_nome?: string
  ordem: number
  status?: string
  percentual?: number
}

interface Cronograma {
  id: number
  projeto_id: number
  versao: number
  label: string
  fonte_importacao: string
  status: string
  is_baseline: number
  aprovado_por?: number
  aprovado_em?: string
  created_at: string
}

interface Props {
  projetoId: number
  canEdit: boolean
  canApprove: boolean
  onRefresh: () => void
}

interface NovaLinha {
  codigo: string
  nome: string
  nivel: 'FASE' | 'TAREFA'
  data_inicio: string
  data_fim: string
  responsavel_id: string
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'PENDENTE') return <span className="text-xs text-gray-400">—</span>
  if (status === 'CONCLUIDA') return <span className="text-xs text-green-600 font-medium">Concluída</span>
  if (status === 'EM_ANDAMENTO') return <span className="text-xs text-blue-600 font-medium">Em andamento</span>
  if (status === 'ATRASADA') return <span className="text-xs text-red-600 font-medium">Atrasada</span>
  return <span className="text-xs text-gray-500">{status}</span>
}

function formatDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

const emptyLinha = (): NovaLinha => ({
  codigo: '',
  nome: '',
  nivel: 'TAREFA',
  data_inicio: '',
  data_fim: '',
  responsavel_id: '',
})

export default function CronogramaEditor({ projetoId, canEdit, canApprove, onRefresh }: Props) {
  const [cronograma, setCronograma] = useState<Cronograma | null>(null)
  const [tarefas, setTarefas] = useState<CronogramaTarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'MANUAL' | 'EXCEL'>('MANUAL')
  const [linhas, setLinhas] = useState<NovaLinha[]>([emptyLinha()])
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchCronograma() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma`)
      if (res.ok) {
        const data = await res.json()
        setCronograma(data.cronograma)
        setTarefas(data.tarefas ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCronograma()
  }, [projetoId])

  function addLinha() {
    setLinhas((prev) => [...prev, emptyLinha()])
  }

  function updateLinha(idx: number, field: keyof NovaLinha, value: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  function removeLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSalvarManual() {
    const validadas = linhas.filter((l) => l.nome.trim())
    if (!validadas.length) {
      setError('Adicione ao menos uma tarefa com nome.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label || undefined,
          fonte_importacao: 'MANUAL',
          tarefas: validadas.map((l, i) => ({
            codigo: l.codigo || undefined,
            nome: l.nome,
            nivel: l.nivel,
            data_inicio: l.data_inicio || undefined,
            data_fim: l.data_fim || undefined,
            responsavel_id: l.responsavel_id ? Number(l.responsavel_id) : null,
            ordem: i + 1,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setSuccess('Cronograma criado com sucesso!')
      setLinhas([emptyLinha()])
      setLabel('')
      await fetchCronograma()
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleImportarExcel() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Selecione um arquivo Excel.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', label || '')
      const res = await fetch(`/api/projetos/${projetoId}/cronograma`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao importar')
      setSuccess('Cronograma importado com sucesso!')
      if (fileRef.current) fileRef.current.value = ''
      setLabel('')
      await fetchCronograma()
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleAprovarBaseline() {
    if (!cronograma) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/cronograma/${cronograma.id}/aprovar`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao aprovar')
      setSuccess('Baseline V1 criada com sucesso!')
      await fetchCronograma()
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6 text-center text-sm text-gray-500">
        Carregando cronograma…
      </div>
    )
  }

  const isBaseline = cronograma?.is_baseline === 1

  return (
    <div className="space-y-4">
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

      {/* Cronograma existente */}
      {cronograma && (
        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="card-title">
                Cronograma {cronograma.label ?? `V${cronograma.versao}`}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Criado em {formatDate(cronograma.created_at)} · {tarefas.length} tarefa(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isBaseline ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                  Baseline V1 Aprovada 🔒
                </span>
              ) : (
                canApprove && (
                  <button
                    className="btn-primary text-sm"
                    onClick={handleAprovarBaseline}
                    disabled={approving}
                  >
                    {approving ? 'Aprovando…' : 'Aprovar e Criar Baseline V1'}
                  </button>
                )
              )}
            </div>
          </div>

          {tarefas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">WBS</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Nome</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Início</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Fim</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Responsável</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Status</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">%</th>
                  </tr>
                </thead>
                <tbody>
                  {tarefas.map((t, i) => (
                    <tr
                      key={t.id ?? i}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        t.nivel === 'FASE' ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-mono text-xs text-gray-400">
                        {t.codigo ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            t.nivel === 'FASE'
                              ? 'font-semibold text-gray-800'
                              : 'pl-4 text-gray-700'
                          }
                        >
                          {t.nome}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(t.data_inicio)}</td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(t.data_fim)}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {t.responsavel_nome ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {t.percentual != null ? `${t.percentual}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-gray-400">
              Nenhuma tarefa cadastrada.
            </div>
          )}
        </div>
      )}

      {/* Criar cronograma (só exibe se canEdit e sem baseline) */}
      {canEdit && !isBaseline && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              {cronograma ? 'Nova Versão do Cronograma' : 'Criar Cronograma'}
            </h3>
          </div>
          <div className="p-4">
            {/* Label */}
            <div className="mb-4">
              <label className="input-label">Rótulo (opcional)</label>
              <input
                type="text"
                className="input w-full max-w-sm"
                placeholder="Ex.: Versão inicial"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {(['MANUAL', 'EXCEL'] as const).map((t) => (
                <button
                  key={t}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t
                      ? 'border-megag-azul text-megag-azul'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  style={tab === t ? { borderBottomColor: '#003087', color: '#003087' } : {}}
                  onClick={() => setTab(t)}
                >
                  {t === 'MANUAL' ? 'Manual' : 'Importar Excel'}
                </button>
              ))}
            </div>

            {tab === 'MANUAL' && (
              <div>
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">WBS</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Nome *</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">Nível</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-32">Início</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-32">Fim</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((linha, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              className="input w-full text-xs"
                              placeholder="1.1"
                              value={linha.codigo}
                              onChange={(e) => updateLinha(idx, 'codigo', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              className="input w-full text-xs"
                              placeholder="Nome da tarefa"
                              value={linha.nome}
                              onChange={(e) => updateLinha(idx, 'nome', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-2">
                              {(['FASE', 'TAREFA'] as const).map((n) => (
                                <label key={n} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`nivel_${idx}`}
                                    value={n}
                                    checked={linha.nivel === n}
                                    onChange={() => updateLinha(idx, 'nivel', n)}
                                  />
                                  <span className="text-xs">{n === 'FASE' ? 'Fase' : 'Tarefa'}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="date"
                              className="input w-full text-xs"
                              value={linha.data_inicio}
                              onChange={(e) => updateLinha(idx, 'data_inicio', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="date"
                              className="input w-full text-xs"
                              value={linha.data_fim}
                              onChange={(e) => updateLinha(idx, 'data_fim', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            {linhas.length > 1 && (
                              <button
                                type="button"
                                className="text-red-400 hover:text-red-600 text-xs px-1"
                                onClick={() => removeLinha(idx)}
                                title="Remover linha"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={addLinha}
                  >
                    + Adicionar tarefa
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={handleSalvarManual}
                    disabled={saving}
                  >
                    {saving ? 'Salvando…' : 'Salvar Cronograma'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'EXCEL' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Selecione um arquivo <strong>.xlsx</strong> ou <strong>.xls</strong> com as colunas:
                  WBS, Nome, Início, Fim, Responsável.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={handleImportarExcel}
                    disabled={importing}
                  >
                    {importing ? 'Processando…' : 'Importar'}
                  </button>
                </div>
                {importing && (
                  <p className="text-xs text-gray-400 animate-pulse">Processando arquivo…</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!cronograma && !canEdit && (
        <div className="card p-6 text-center text-sm text-gray-400">
          Nenhum cronograma cadastrado para este projeto.
        </div>
      )}
    </div>
  )
}
