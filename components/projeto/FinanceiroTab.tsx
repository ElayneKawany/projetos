'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Upload, Plus, Download, FileText, ChevronDown, ChevronUp, Trash2, Edit2, X, Check } from 'lucide-react'
import type {
  FinanceiroContratoCompleto,
  FinanceiroResumoExecutivo,

  TipoContrato,
  TipoDocumentoFinanceiro,
  StatusContrato,
  NaturezaFinanceira,
} from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projetoId: number
  /** Mantido por compatibilidade — valores buscados automaticamente da viabilidade */
  capexAprovado: number
  /** Mantido por compatibilidade — valores buscados automaticamente da viabilidade */
  opexAprovado: number
  canEdit: boolean
  onRefresh: () => void
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number): string {
  return `${v}%`
}

function corProgresso(percentual: number): string {
  if (percentual >= 100) return '#16A34A'
  if (percentual >= 50)  return '#CA8A04'
  return '#DC2626'
}

const TIPOS_CONTRATO: { value: TipoContrato; label: string }[] = [
  { value: 'SERVICO',      label: 'Serviço' },
  { value: 'FORNECIMENTO', label: 'Fornecimento' },
  { value: 'OBRA',         label: 'Obra' },
  { value: 'OUTRO',        label: 'Outro' },
]

const TIPOS_DOC: { value: TipoDocumentoFinanceiro; label: string }[] = [
  { value: 'NF',     label: 'Nota Fiscal' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TED',    label: 'TED' },
  { value: 'PIX',    label: 'PIX' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OUTRO',  label: 'Outro' },
]

const STATUS_CONTRATO: { value: StatusContrato; label: string }[] = [
  { value: 'ATIVO',      label: 'Ativo' },
  { value: 'SUSPENSO',   label: 'Suspenso' },
  { value: 'ENCERRADO',  label: 'Encerrado' },
  { value: 'CANCELADO',  label: 'Cancelado' },
]

const NATUREZAS: { value: NaturezaFinanceira; label: string }[] = [
  { value: 'CAPEX', label: 'CAPEX — Investimento' },
  { value: 'OPEX',  label: 'OPEX — Custo Operacional' },
]

// ─── Modal Novo/Editar Contrato ───────────────────────────────────────────────

interface ContratoFormState {
  numero_contrato: string
  contratado: string
  tipo_contrato: TipoContrato
  natureza_financeira: NaturezaFinanceira | ''
  descricao_servico: string
  valor_aprovado: string
  status: StatusContrato
  observacao: string
}

function emptyContrato(): ContratoFormState {
  return { numero_contrato: '', contratado: '', tipo_contrato: 'SERVICO', natureza_financeira: '', descricao_servico: '', valor_aprovado: '', status: 'ATIVO', observacao: '' }
}

interface ContratoModalProps {
  projetoId: number
  contrato?: FinanceiroContratoCompleto | null
  onClose: () => void
  onSaved: () => void
}

function ContratoModal({ projetoId, contrato, onClose, onSaved }: ContratoModalProps) {
  const [form, setForm] = useState<ContratoFormState>(() =>
    contrato
      ? {
          numero_contrato: contrato.numero_contrato ?? '',
          contratado: contrato.contratado,
          tipo_contrato: contrato.tipo_contrato,
          natureza_financeira: contrato.natureza_financeira,
          descricao_servico: contrato.descricao_servico ?? '',
          valor_aprovado: String(contrato.valor_aprovado),
          status: contrato.status,
          observacao: contrato.observacao ?? '',
        }
      : emptyContrato()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSalvar() {
    if (!form.contratado.trim()) { setError('Contratado é obrigatório.'); return }
    if (!form.natureza_financeira) { setError('Natureza Financeira é obrigatória (CAPEX ou OPEX).'); return }
    const valor = parseFloat(form.valor_aprovado.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setError('Valor aprovado inválido.'); return }

    setSaving(true); setError('')
    try {
      const url = contrato
        ? `/api/projetos/${projetoId}/financeiro/contratos/${contrato.id}`
        : `/api/projetos/${projetoId}/financeiro/contratos`
      const method = contrato ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, valor_aprovado: valor }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro ao salvar.'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio">
          <h3 className="card-title">{contrato ? 'Editar Contrato' : 'Novo Contrato'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Número do Contrato</label>
              <input className="input" value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))} placeholder="Ex.: CT-2024-001" />
            </div>
            <div>
              <label className="input-label">Tipo</label>
              <select className="input" value={form.tipo_contrato} onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value as TipoContrato }))}>
                {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Natureza Financeira *</label>
            <div className="flex gap-4 mt-1">
              {NATUREZAS.map(n => (
                <label key={n.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="natureza_financeira"
                    value={n.value}
                    checked={form.natureza_financeira === n.value}
                    onChange={() => setForm(f => ({ ...f, natureza_financeira: n.value }))}
                    className="accent-megag-azul"
                  />
                  <span className="text-sm">{n.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="input-label">Contratado *</label>
            <input className="input" value={form.contratado} onChange={e => setForm(f => ({ ...f, contratado: e.target.value }))} placeholder="Nome do fornecedor / empresa" />
          </div>
          <div>
            <label className="input-label">Descrição do Serviço</label>
            <input className="input" value={form.descricao_servico} onChange={e => setForm(f => ({ ...f, descricao_servico: e.target.value }))} placeholder="Descrição resumida" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Valor Aprovado (R$) *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.valor_aprovado} onChange={e => setForm(f => ({ ...f, valor_aprovado: e.target.value }))} placeholder="0,00" />
            </div>
            {contrato && (
              <div>
                <label className="input-label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusContrato }))}>
                  {STATUS_CONTRATO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea className="input resize-none" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Novo Pagamento ─────────────────────────────────────────────────────

interface PagamentoFormState {
  tipo_documento: TipoDocumentoFinanceiro
  nota_fiscal: string
  data_pagamento: string
  competencia: string
  valor_pago: string
  observacao: string
}

function emptyPagamento(): PagamentoFormState {
  return { tipo_documento: 'NF', nota_fiscal: '', data_pagamento: '', competencia: '', valor_pago: '', observacao: '' }
}

interface PagamentoModalProps {
  projetoId: number
  contrato: FinanceiroContratoCompleto
  onClose: () => void
  onSaved: () => void
}

function PagamentoModal({ projetoId, contrato, onClose, onSaved }: PagamentoModalProps) {
  const [form, setForm] = useState<PagamentoFormState>(emptyPagamento)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSalvar() {
    const valor = parseFloat(form.valor_pago.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setError('Valor pago deve ser maior que zero.'); return }

    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('tipo_documento', form.tipo_documento)
      fd.append('nota_fiscal', form.nota_fiscal)
      fd.append('data_pagamento', form.data_pagamento)
      fd.append('competencia', form.competencia)
      fd.append('valor_pago', String(valor))
      fd.append('observacao', form.observacao)
      if (arquivo) fd.append('arquivo', arquivo)

      const res = await fetch(`/api/projetos/${projetoId}/financeiro/contratos/${contrato.id}/pagamentos`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro ao salvar.'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio">
          <div>
            <h3 className="card-title">Novo Pagamento</h3>
            <p className="text-xs text-megag-cinza-texto mt-0.5">{contrato.contratado}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Tipo Documento</label>
              <select className="input" value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value as TipoDocumentoFinanceiro }))}>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Nota Fiscal</label>
              <input className="input" value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} placeholder="Nº da NF" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Valor Pago (R$) *</label>
              <input className="input" type="number" min="0.01" step="0.01" value={form.valor_pago} onChange={e => setForm(f => ({ ...f, valor_pago: e.target.value }))} placeholder="0,00" />
            </div>
            <div>
              <label className="input-label">Data de Pagamento</label>
              <input className="input" type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="input-label">Competência (MM/AAAA)</label>
            <input className="input" value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))} placeholder="07/2025" />
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea className="input resize-none" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Comprovante (PDF/XML)</label>
            <input ref={fileRef} type="file" accept=".pdf,.xml" className="hidden" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            <button type="button" className="btn-secondary text-xs" onClick={() => fileRef.current?.click()}>
              {arquivo ? arquivo.name : 'Selecionar arquivo…'}
            </button>
            {arquivo && (
              <button type="button" className="ml-2 text-red-500 text-xs underline" onClick={() => { setArquivo(null); if (fileRef.current) fileRef.current.value = '' }}>
                Remover
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={saving}>
            {saving ? 'Salvando…' : 'Lançar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de Contrato ─────────────────────────────────────────────────────────

interface CardContratoProps {
  contrato: FinanceiroContratoCompleto
  canEdit: boolean
  onEditContrato: (c: FinanceiroContratoCompleto) => void
  onNovoPagamento: (c: FinanceiroContratoCompleto) => void
  onDeleteContrato: (c: FinanceiroContratoCompleto) => void
  onDeletePagamento: (contId: number, pagId: number) => void
}

function CardContrato({ contrato: c, canEdit, onEditContrato, onNovoPagamento, onDeleteContrato, onDeletePagamento }: CardContratoProps) {
  const [expandido, setExpandido] = useState(false)
  const cor = corProgresso(c.percentual)
  let acumulado = 0

  return (
    <div className="card">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-megag-preto text-sm">{c.contratado}</span>
              {c.numero_contrato && (
                <span className="badge text-xs">{c.numero_contrato}</span>
              )}
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${c.natureza_financeira === 'CAPEX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {c.natureza_financeira}
              </span>
              <span className="text-xs text-megag-cinza-texto">{TIPOS_CONTRATO.find(t => t.value === c.tipo_contrato)?.label}</span>
            </div>
            {c.descricao_servico && (
              <p className="text-xs text-megag-cinza-texto mt-0.5 line-clamp-1">{c.descricao_servico}</p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <button className="btn-ghost p-1" title="Editar" onClick={() => onEditContrato(c)}><Edit2 size={14} /></button>
              <button className="btn-ghost p-1 text-green-600" title="Lançar pagamento" onClick={() => onNovoPagamento(c)}><Plus size={14} /></button>
              <button className="btn-ghost p-1 text-red-400" title="Excluir" onClick={() => onDeleteContrato(c)}><Trash2 size={14} /></button>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <p className="text-xs text-megag-cinza-texto">Aprovado</p>
            <p className="text-xs font-semibold text-megag-preto">{moeda(c.valor_aprovado)}</p>
          </div>
          <div>
            <p className="text-xs text-megag-cinza-texto">Pago</p>
            <p className="text-xs font-semibold" style={{ color: cor }}>{moeda(c.valor_pago_total)}</p>
          </div>
          <div>
            <p className="text-xs text-megag-cinza-texto">Saldo</p>
            <p className="text-xs font-semibold" style={{ color: c.saldo < 0 ? '#DC2626' : '#374151' }}>{moeda(c.saldo)}</p>
          </div>
          <div>
            <p className="text-xs text-megag-cinza-texto">Executado</p>
            <p className="text-sm font-bold" style={{ color: cor }}>{pct(c.percentual)}</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(c.percentual, 100)}%`, backgroundColor: cor }} />
        </div>

        {/* Toggle pagamentos */}
        {c.pagamentos.length > 0 && (
          <button className="flex items-center gap-1 text-xs text-megag-azul" onClick={() => setExpandido(v => !v)}>
            {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {c.pagamentos.length} pagamento(s)
          </button>
        )}

        {/* Tabela de pagamentos */}
        {expandido && c.pagamentos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-megag text-xs w-full">
              <thead>
                <tr>
                  <th>Data</th><th>NF</th>
                  <th className="text-right">Valor</th><th className="text-right">Acumulado</th><th className="text-right">Saldo</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {c.pagamentos.map(p => {
                  acumulado += p.valor_pago ?? 0
                  const saldoPag = c.valor_aprovado - acumulado
                  return (
                    <tr key={p.id}>
                      <td>{p.data_pagamento ? new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{p.nota_fiscal ?? '—'}</td>
                      <td className="text-right font-medium">{moeda(p.valor_pago)}</td>
                      <td className="text-right">{moeda(acumulado)}</td>
                      <td className="text-right" style={{ color: saldoPag < 0 ? '#DC2626' : undefined }}>{moeda(saldoPag)}</td>
                      {canEdit && (
                        <td>
                          <button className="btn-ghost p-0.5 text-red-400" title="Excluir" onClick={() => onDeletePagamento(c.id, p.id)}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ titulo, valor, subtitulo, cor, destaque, somenteLeitura }: {
  titulo: string; valor: string; subtitulo?: string
  cor?: string; destaque?: boolean; somenteLeitura?: boolean
}) {
  return (
    <div className={`card p-4 flex flex-col gap-1 ${destaque ? 'ring-2 ring-megag-azul/20' : ''}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-megag-cinza-texto uppercase tracking-wide leading-tight">{titulo}</span>
        {somenteLeitura && (
          <span className="text-xs bg-gray-100 px-1 rounded" title="Proveniente do Estudo de Viabilidade — somente leitura">🔒</span>
        )}
      </div>
      <span className="text-base font-bold leading-tight" style={{ color: cor ?? (destaque ? '#003087' : '#111827') }}>{valor}</span>
      {subtitulo && <span className="text-xs text-megag-cinza-texto leading-tight">{subtitulo}</span>}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinanceiroTab({ projetoId, canEdit }: Props) {
  const [contratos, setContratos] = useState<FinanceiroContratoCompleto[]>([])
  const [resumo, setResumo] = useState<FinanceiroResumoExecutivo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalContrato, setModalContrato] = useState<'new' | FinanceiroContratoCompleto | null>(null)
  const [modalPagamento, setModalPagamento] = useState<FinanceiroContratoCompleto | null>(null)
  const [importando, setImportando] = useState(false)
  const [importMsg, setImportMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [filtroNatureza, setFiltroNatureza] = useState<NaturezaFinanceira | 'TODOS'>('TODOS')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/projetos/${projetoId}/financeiro/contratos`)
      if (!res.ok) throw new Error('Erro ao carregar dados financeiros.')
      const data = await res.json()
      setContratos(data.contratos ?? [])
      setResumo(data.resumo ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.')
    } finally { setLoading(false) }
  }, [projetoId])

  useEffect(() => { carregar() }, [carregar])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportando(true); setImportMsg(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/projetos/${projetoId}/financeiro/contratos/importar`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setImportMsg({ tipo: 'erro', texto: (data.errosFatais ?? [data.error]).join(' | ') })
        return
      }
      const avisos = data.warnings?.length ? ` · ${data.warnings.length} aviso(s).` : ''
      setImportMsg({ tipo: 'ok', texto: `${data.importados} contrato(s) e ${data.pagamentosImportados} pagamento(s) importados.${avisos}` })
      await carregar()
    } catch {
      setImportMsg({ tipo: 'erro', texto: 'Falha na importação.' })
    } finally { setImportando(false) }
  }

  function handleExportExcel() {
    window.open(`/api/projetos/${projetoId}/financeiro/contratos/exportar`, '_blank')
  }

  async function handleExportPDF() {
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape' })

      doc.setFontSize(14)
      doc.text(`Relatório Financeiro — Projeto ${projetoId}`, 14, 16)

      if (resumo) {
        autoTable(doc, {
          startY: 22,
          head: [['Indicador', 'Valor']],
          body: [
            ['CAPEX Planejado',  moeda(resumo.capex_viabilidade)],
            ['CAPEX Executado',  moeda(resumo.capex_executado)],
            ['Saldo CAPEX',      moeda(resumo.saldo_capex)],
            ['OPEX Planejado',   moeda(resumo.opex_viabilidade)],
            ['OPEX Executado',   moeda(resumo.opex_executado)],
            ['Saldo OPEX',       moeda(resumo.saldo_opex)],
            ['Total Planejado',  moeda(resumo.total_planejado)],
            ['Total Executado',  moeda(resumo.total_executado)],
            ['Saldo Geral',      moeda(resumo.saldo)],
            ['% Executado',      pct(resumo.percentual_executado)],
          ],
          margin: { left: 14 }, tableWidth: 110,
          styles: { fontSize: 8 }, headStyles: { fillColor: [0, 48, 135] },
        })
      }

      const tbl = doc as unknown as { lastAutoTable?: { finalY?: number } }
      const startY = tbl.lastAutoTable?.finalY ? tbl.lastAutoTable.finalY + 8 : 60

      autoTable(doc, {
        startY,
        head: [['Nº Contrato', 'Contratado', 'Natureza', 'Tipo', 'Aprovado', 'Pago', 'Saldo', '%']],
        body: contratos.map(c => [
          c.numero_contrato ?? '—', c.contratado, c.natureza_financeira,
          TIPOS_CONTRATO.find(t => t.value === c.tipo_contrato)?.label ?? c.tipo_contrato,
          moeda(c.valor_aprovado), moeda(c.valor_pago_total), moeda(c.saldo), pct(c.percentual),
        ]),
        margin: { left: 14 },
        styles: { fontSize: 8 }, headStyles: { fillColor: [0, 48, 135] },
      })

      doc.save(`Financeiro_Projeto_${projetoId}.pdf`)
    } catch {
      alert('Erro ao gerar PDF. Tente novamente.')
    }
  }

  async function handleDeleteContrato(c: FinanceiroContratoCompleto) {
    if (!confirm(`Excluir contrato "${c.contratado}"?`)) return
    await fetch(`/api/projetos/${projetoId}/financeiro/contratos/${c.id}`, { method: 'DELETE' })
    await carregar()
  }

  async function handleDeletePagamento(contId: number, pagId: number) {
    if (!confirm('Excluir este pagamento?')) return
    await fetch(`/api/projetos/${projetoId}/financeiro/contratos/${contId}/pagamentos/${pagId}`, { method: 'DELETE' })
    await carregar()
  }

  const contratosFiltrados = filtroNatureza === 'TODOS'
    ? contratos
    : contratos.filter(c => c.natureza_financeira === filtroNatureza)

  const contratosOrdenados = [...contratosFiltrados].sort((a, b) => b.saldo - a.saldo)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-megag-cinza-texto">
        <span className="text-sm">Carregando dados financeiros…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* ── Header Executivo ── */}
      {resumo && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard titulo="CAPEX Planejado" valor={moeda(resumo.capex_viabilidade)} subtitulo="Estudo de Viabilidade" somenteLeitura />
            <KpiCard titulo="CAPEX Executado" valor={moeda(resumo.capex_executado)} subtitulo={`${pct(Math.round(resumo.capex_viabilidade > 0 ? (resumo.capex_executado / resumo.capex_viabilidade) * 100 : 0))} do planejado`} cor={corProgresso(resumo.capex_viabilidade > 0 ? Math.round((resumo.capex_executado / resumo.capex_viabilidade) * 100) : 0)} />
            <KpiCard titulo="Saldo CAPEX" valor={moeda(resumo.saldo_capex)} cor={resumo.saldo_capex < 0 ? '#DC2626' : '#16A34A'} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard titulo="OPEX Planejado" valor={moeda(resumo.opex_viabilidade)} subtitulo="Estudo de Viabilidade" somenteLeitura />
            <KpiCard titulo="OPEX Executado" valor={moeda(resumo.opex_executado)} subtitulo={`${pct(Math.round(resumo.opex_viabilidade > 0 ? (resumo.opex_executado / resumo.opex_viabilidade) * 100 : 0))} do planejado`} cor={corProgresso(resumo.opex_viabilidade > 0 ? Math.round((resumo.opex_executado / resumo.opex_viabilidade) * 100) : 0)} />
            <KpiCard titulo="Saldo OPEX" valor={moeda(resumo.saldo_opex)} cor={resumo.saldo_opex < 0 ? '#DC2626' : '#16A34A'} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Total Planejado" valor={moeda(resumo.total_planejado)} subtitulo="CAPEX + OPEX" destaque />
            <KpiCard titulo="Total Executado" valor={moeda(resumo.total_executado)} subtitulo={`${pct(resumo.percentual_executado)} do planejado`} cor={corProgresso(resumo.percentual_executado)} />
            <KpiCard titulo="Saldo Geral" valor={moeda(resumo.saldo)} subtitulo="Planejado − Executado" cor={resumo.saldo < 0 ? '#DC2626' : '#16A34A'} />
            <KpiCard titulo="Contratos" valor={String(resumo.quantidade_contratos)} subtitulo="cadastrados" />
          </div>
        </div>
      )}

      {/* ── Barra de ações ── */}
      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
          <>
            <button className="btn-primary flex items-center gap-2" onClick={() => setModalContrato('new')}>
              <Plus size={15} /> Novo Contrato
            </button>
            <button className="btn-secondary flex items-center gap-2" onClick={() => fileInputRef.current?.click()} disabled={importando}>
              <Upload size={15} /> {importando ? 'Importando…' : 'Importar Planilha'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </>
        )}
        <button className="btn-secondary flex items-center gap-2" onClick={handleExportExcel}>
          <Download size={15} /> Exportar Excel
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={handleExportPDF}>
          <FileText size={15} /> Exportar PDF
        </button>
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['TODOS', 'CAPEX', 'OPEX'] as const).map(op => (
            <button
              key={op}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filtroNatureza === op ? 'bg-white shadow text-megag-azul' : 'text-megag-cinza-texto hover:text-megag-preto'}`}
              onClick={() => setFiltroNatureza(op)}
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feedback importação ── */}
      {importMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${importMsg.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {importMsg.tipo === 'ok' ? <Check size={15} /> : <AlertTriangle size={15} />}
          <span className="flex-1">{importMsg.texto}</span>
          <button onClick={() => setImportMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* ── Grid de contratos ── */}
      {contratosFiltrados.length === 0 ? (
        <div className="card">
          <div className="p-12 text-center text-megag-cinza-texto">
            <p className="text-sm">{contratos.length === 0 ? 'Nenhum contrato cadastrado.' : `Nenhum contrato ${filtroNatureza}.`}</p>
            {canEdit && contratos.length === 0 && <p className="text-xs mt-1">Use &quot;Novo Contrato&quot; ou &quot;Importar Planilha&quot; para começar.</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {contratosFiltrados.map(c => (
            <CardContrato
              key={c.id}
              contrato={c}
              canEdit={canEdit}
              onEditContrato={setModalContrato}
              onNovoPagamento={setModalPagamento}
              onDeleteContrato={handleDeleteContrato}
              onDeletePagamento={handleDeletePagamento}
            />
          ))}
        </div>
      )}

      {/* ── Resumo Consolidado ── */}
      {contratos.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="card-title">Resumo Consolidado</span>
            <span className="text-xs text-megag-cinza-texto">Ordenado por maior saldo</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-megag w-full">
              <thead>
                <tr>
                  <th>Contrato</th><th>Fornecedor</th><th>Natureza</th>
                  <th className="text-right">Aprovado</th><th className="text-right">Pago</th>
                  <th className="text-right">Saldo</th><th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {contratosOrdenados.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs">{c.numero_contrato ?? '—'}</td>
                    <td>{c.contratado}</td>
                    <td>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${c.natureza_financeira === 'CAPEX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {c.natureza_financeira}
                      </span>
                    </td>
                    <td className="text-right">{moeda(c.valor_aprovado)}</td>
                    <td className="text-right">{moeda(c.valor_pago_total)}</td>
                    <td className="text-right font-medium" style={{ color: c.saldo < 0 ? '#DC2626' : undefined }}>{moeda(c.saldo)}</td>
                    <td className="text-right font-bold" style={{ color: corProgresso(c.percentual) }}>{pct(c.percentual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      {modalContrato !== null && (
        <ContratoModal
          projetoId={projetoId}
          contrato={modalContrato !== 'new' ? modalContrato : null}
          onClose={() => setModalContrato(null)}
          onSaved={() => { setModalContrato(null); carregar() }}
        />
      )}
      {modalPagamento && (
        <PagamentoModal
          projetoId={projetoId}
          contrato={modalPagamento}
          onClose={() => setModalPagamento(null)}
          onSaved={() => { setModalPagamento(null); carregar() }}
        />
      )}
    </div>
  )
}
