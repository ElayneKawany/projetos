'use client'

import { useState, useEffect, useCallback } from 'react'
import CurrencyInput from '@/components/ui/CurrencyInput'
import { StatusBadge, SectionBlock, TextValue, TextAreaField } from './ArtefatoShared'
import AlertaValidacao from './AlertaValidacao'
import { validarViabilidade, type ErroValidacao, type ViabilidadeParaValidar } from '@/lib/validacoes-artefatos'
import WorkflowStatusPanel, { type WorkflowInfo } from './WorkflowStatusPanel'
import EnviarAprovacaoModal, { type EtapaInput } from './EnviarAprovacaoModal'
import { TIPO_INVESTIMENTO_LABELS, TIPO_INVESTIMENTO_CORES, type TipoInvestimento, type OrcamentoGrupo } from '@/lib/orcamento-types'
import ImportacaoModal from './ImportacaoModal'
import ArtefatoEditarDropdown from './ArtefatoEditarDropdown'
import type { ViabilidadeImportada } from '@/lib/importadores/viabilidade-modelo'
import { useDownload } from './useDownload'

interface ViabilidadeData {
  id: number
  versao: number
  status: string
  resumo_executivo?: string
  investimento_total?: number
  roi?: number
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
  condicoes_aprovacao?: string
  // Financial premises
  capex?: number | null
  opex?: number | null
  opex_periodicidade?: string
  economia_estimada?: number | null
  economia_periodicidade?: string
  tipo_payback?: string
  tipo_payback_quantitativo?: number | null
  tipo_payback_qualitativo?: number | null
  beneficios_esperados?: string | null
  payback_informado?: number | null
  payback_unidade?: string
  // Payback v2 — base para acompanhamento automático
  baseline_valor?: number | null
  meta_valor?: number | null
  tipo_indicador?: string
  economia_mensal_esperada?: number | null
  // Indicador Ganho Tarefa
  ganho_tarefa_ativo?: number | null
  ganho_tarefa_salario?: number | null
  ganho_tarefa_horas_antes?: number | null
  ganho_tarefa_horas_depois?: number | null
  ganho_tarefa_freq_mensal?: number | null
  // Indicador HC
  hc_ativo?: number | null
  hc_quantidade?: number | null
  hc_salario_mensal?: number | null
  hc_encargos_pct?: number | null
  hc_beneficios_mensais?: number | null
  hc_outros_mensais?: number | null
  // Horas de analistas MegaG
  horas_analistas_ativo?: number | null
  horas_analistas_json?: string | null
  horas_analistas_total?: number | null
  created_at: string
}

interface Props {
  viabilidade: ViabilidadeData | null
  projetoId: number
  canEdit: boolean
  canSubmit: boolean
  workflow: WorkflowInfo | null
  sessionUser: { id: number; nome: string }
  usuarios: { id: number; nome: string }[]
  onRefresh: () => void
}

function FinanceRowRaw({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2 border-b border-gray-100 last:border-0 ${highlight ? 'bg-blue-50 -mx-3 px-3 rounded' : ''}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-blue-800' : 'text-gray-800'}`}>{children}</span>
    </div>
  )
}

const RECOMENDACAO_OPTIONS = [
  { value: 'VIAVEL', label: 'Viável' },
  { value: 'VIAVEL_AJUSTES', label: 'Viável com ajustes' },
  { value: 'NAO_VIAVEL', label: 'Não viável' },
]

function fBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ─── Sub-componentes visuais sem estado ──────────────────────────────────────

function FinancialPremisesView({ v }: { v: ViabilidadeData }) {
  const invTotal = (v.capex ?? 0) + (v.opex ?? 0)
  const econMensal = v.economia_periodicidade === 'ANUAL'
    ? (v.economia_estimada ?? 0) / 12
    : (v.economia_estimada ?? 0)
  const paybackCalc =
    v.tipo_payback === 'QUANTITATIVO' && invTotal > 0 && econMensal > 0
      ? invTotal / econMensal
      : null

  return (
    <SectionBlock number="3" title="Premissas Financeiras">
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Investimentos</h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <FinanceRowRaw label="CAPEX">{fBRL(v.capex)}</FinanceRowRaw>
            <FinanceRowRaw label={`OPEX (${v.opex_periodicidade === 'ANUAL' ? 'Anual' : 'Mensal'})`}>
              {fBRL(v.opex)}
            </FinanceRowRaw>
            <FinanceRowRaw label="Investimento Total (CAPEX + OPEX)" highlight>
              {fBRL(invTotal > 0 ? invTotal : null)}
            </FinanceRowRaw>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Benefícios Financeiros</h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <FinanceRowRaw label={`Economia Estimada (${v.economia_periodicidade === 'ANUAL' ? 'Anual' : 'Mensal'})`}>
              {fBRL(v.economia_estimada)}
            </FinanceRowRaw>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Indicadores</h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <FinanceRowRaw label="Tipo de Benefício">
              {(() => {
                const isQuant = v.tipo_payback_quantitativo != null ? Boolean(v.tipo_payback_quantitativo) : v.tipo_payback === 'QUANTITATIVO'
                const isQual  = v.tipo_payback_qualitativo  != null ? Boolean(v.tipo_payback_qualitativo)  : v.tipo_payback !== 'QUANTITATIVO'
                if (isQuant && isQual) return 'Quantitativo + Qualitativo'
                if (isQuant) return 'Quantitativo'
                return 'Qualitativo'
              })()}
            </FinanceRowRaw>
            {v.beneficios_esperados && (
              <FinanceRowRaw label="Benefícios Esperados">{v.beneficios_esperados}</FinanceRowRaw>
            )}
            {v.payback_informado !== null && v.payback_informado !== undefined && (
              <FinanceRowRaw label="Payback Informado">
                {v.payback_informado} {v.payback_unidade === 'ANOS' ? 'anos' : 'meses'}
              </FinanceRowRaw>
            )}
            {paybackCalc !== null && (
              <FinanceRowRaw label="Payback Calculado" highlight>
                {paybackCalc.toFixed(2).replace('.', ',')} meses
              </FinanceRowRaw>
            )}
          </div>
        </div>
      </div>
    </SectionBlock>
  )
}

interface SidebarData {
  capex: number | null | undefined
  opex: number | null | undefined
  invTotal: number | null
  economia: number | null | undefined
  economiaLabel: string
  tipoPayback: string
  paybackCalc: number | null
  paybackInformado: number | null | undefined
  paybackUnidade: string
  divergencia: boolean
}

function AnaliseFinanceiraSidebar({ data: d }: { data: SidebarData }) {
  return (
    <div className="w-72 flex-shrink-0 sticky top-4">
      <div className="card p-4">
        <h4 className="font-semibold text-sm mb-4 pb-2 border-b border-gray-100" style={{ color: '#003087' }}>
          Análise Financeira
        </h4>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-xs text-gray-400 uppercase font-medium block mb-2">Investimentos</span>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">CAPEX</span>
                <span className="font-medium tabular-nums">{fBRL(d.capex)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">OPEX</span>
                <span className="font-medium tabular-nums">{fBRL(d.opex)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-100 font-semibold">
                <span className="text-gray-700">Total</span>
                <span className="text-blue-700 tabular-nums">{fBRL(d.invTotal)}</span>
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase font-medium block mb-2">Benefícios</span>
            <div className="flex justify-between">
              <span className="text-gray-500">Economia {d.economiaLabel}</span>
              <span className="font-medium tabular-nums">{fBRL(d.economia)}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase font-medium block mb-2">Payback</span>
            <div className="space-y-1">
              {d.tipoPayback === 'QUANTITATIVO' && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Calculado</span>
                  <span className="font-semibold text-blue-700 tabular-nums">
                    {d.paybackCalc !== null ? `${d.paybackCalc.toFixed(2).replace('.', ',')} m` : '—'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Informado</span>
                <span className="font-medium tabular-nums">
                  {d.paybackInformado !== null && d.paybackInformado !== undefined
                    ? `${d.paybackInformado} ${d.paybackUnidade === 'ANOS' ? 'anos' : 'meses'}`
                    : '—'}
                </span>
              </div>
            </div>
            {d.divergencia && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                Divergência entre payback calculado e informado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Aba Orçamento ────────────────────────────────────────────────────────────

function OrcamentoTab({ projetoId, viabilidadeId, canEdit, viabilidadeStatus, viabilidadeV1 }: { projetoId: number; viabilidadeId: number; canEdit: boolean; viabilidadeStatus: string; viabilidadeV1: boolean }) {
  const bloqueado = viabilidadeStatus === 'APROVADO' && !viabilidadeV1
  const podeEditar = canEdit && !bloqueado
  const [grupos, setGrupos] = useState<OrcamentoGrupo[]>([])
  const [loading, setLoading] = useState(true)
  const [showNovoGrupo, setShowNovoGrupo] = useState(false)
  const [novoGrupoNome, setNovoGrupoNome] = useState('')
  const [novoGrupoTipo, setNovoGrupoTipo] = useState<TipoInvestimento>('CAPEX_ATIVO')
  const [saving, setSaving] = useState(false)
  const [showNovoItem, setShowNovoItem] = useState<number | null>(null)
  const [novoItem, setNovoItem] = useState({ nome: '', valor_aprovado: '', descricao: '' })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/orcamento`)
      const data = await res.json()
      setGrupos(data.grupos ?? [])
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { carregar() }, [carregar])

  async function criarGrupo() {
    if (!novoGrupoNome.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/projetos/${projetoId}/orcamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoGrupoNome.trim(), tipo: novoGrupoTipo, viabilidade_id: viabilidadeId }),
      })
      setNovoGrupoNome('')
      setShowNovoGrupo(false)
      carregar()
    } finally {
      setSaving(false)
    }
  }

  async function criarItem(grupoId: number) {
    if (!novoItem.nome.trim() || !novoItem.valor_aprovado) return
    setSaving(true)
    try {
      await fetch(`/api/projetos/${projetoId}/orcamento/grupos/${grupoId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoItem.nome.trim(),
          valor_aprovado: parseFloat(novoItem.valor_aprovado),
          descricao: novoItem.descricao || undefined,
        }),
      })
      setNovoItem({ nome: '', valor_aprovado: '', descricao: '' })
      setShowNovoItem(null)
      carregar()
    } finally {
      setSaving(false)
    }
  }

  async function removerGrupo(grupoId: number, itemCount: number) {
    const msg = itemCount > 0
      ? `Excluir o grupo e seus ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}? Esta ação não pode ser desfeita.`
      : 'Excluir este grupo vazio?'
    if (!confirm(msg)) return
    await fetch(`/api/projetos/${projetoId}/orcamento/grupos/${grupoId}/itens`, { method: 'DELETE' })
    carregar()
  }

  async function removerItem(grupoId: number, itemId: number) {
    if (!confirm('Remover este item do orçamento?')) return
    await fetch(`/api/projetos/${projetoId}/orcamento/grupos/${grupoId}/itens?itemId=${itemId}`, { method: 'DELETE' })
    carregar()
  }

  const fBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-center text-gray-400 text-sm">Carregando orçamento…</div>

  const totalGeral = grupos.reduce((s, g) => s + g.itens.reduce((si, i) => si + i.valor_aprovado, 0), 0)

  return (
    <div className="space-y-4">
      {/* Banner de bloqueio quando viabilidade aprovada */}
      {bloqueado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          O orçamento está bloqueado pois o Estudo de Viabilidade foi <strong>Aprovado</strong>. Para editar, solicite uma Revisão da Viabilidade.
        </div>
      )}

      {/* Cabeçalho com total */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Investimento Total Aprovado</p>
          <p className="text-2xl font-bold" style={{ color: '#003087' }}>{fBRL(totalGeral)}</p>
        </div>
        {podeEditar && (
          <button className="btn-primary text-sm" onClick={() => setShowNovoGrupo(true)}>
            + Grupo
          </button>
        )}
      </div>

      {/* Modal novo grupo */}
      {podeEditar && showNovoGrupo && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Novo Grupo de Orçamento</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Nome do Grupo</label>
              <input className="input w-full" value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value)} placeholder="Ex: Hardware, Software…" />
            </div>
            <div>
              <label className="input-label">Tipo de Investimento</label>
              <select className="input w-full" value={novoGrupoTipo} onChange={e => setNovoGrupoTipo(e.target.value as TipoInvestimento)}>
                {(Object.entries(TIPO_INVESTIMENTO_LABELS) as [TipoInvestimento, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost text-sm" onClick={() => setShowNovoGrupo(false)}>Cancelar</button>
            <button className="btn-primary text-sm" disabled={saving || !novoGrupoNome.trim()} onClick={criarGrupo}>
              {saving ? 'Salvando…' : 'Criar Grupo'}
            </button>
          </div>
        </div>
      )}

      {grupos.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p>Nenhum grupo de orçamento cadastrado.</p>
          {canEdit && <p className="mt-1 text-xs">Clique em &quot;+ Grupo&quot; para iniciar o detalhamento do investimento.</p>}
        </div>
      )}

      {/* Lista de grupos */}
      {grupos.map(grupo => {
        const cor = TIPO_INVESTIMENTO_CORES[grupo.tipo as TipoInvestimento] ?? '#6B7280'
        const totalGrupo = grupo.itens.reduce((s, i) => s + i.valor_aprovado, 0)
        return (
          <div key={grupo.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header grupo */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cor }} />
                <span className="font-semibold text-sm text-gray-800">{grupo.nome}</span>
                <span className="text-xs text-gray-400">({TIPO_INVESTIMENTO_LABELS[grupo.tipo as TipoInvestimento]})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700">{fBRL(totalGrupo)}</span>
                {podeEditar && (
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setShowNovoItem(grupo.id)}>
                    + Item
                  </button>
                )}
                {podeEditar && (
                  <button
                    className="text-red-400 hover:text-red-600 text-xs p-1"
                    title="Excluir grupo"
                    onClick={() => removerGrupo(grupo.id, grupo.itens.length)}
                  >✕</button>
                )}
              </div>
            </div>

            {/* Form novo item */}
            {podeEditar && showNovoItem === grupo.id && (
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="input-label">Nome do Item</label>
                    <input className="input w-full text-sm" value={novoItem.nome} onChange={e => setNovoItem(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Servidor Dell PowerEdge" />
                  </div>
                  <div>
                    <label className="input-label">Valor Aprovado (R$)</label>
                    <input className="input w-full text-sm" type="number" min="0" step="0.01" value={novoItem.valor_aprovado} onChange={e => setNovoItem(p => ({ ...p, valor_aprovado: e.target.value }))} placeholder="0,00" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Descrição (opcional)</label>
                  <input className="input w-full text-sm" value={novoItem.descricao} onChange={e => setNovoItem(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes adicionais…" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="btn-ghost text-xs" onClick={() => { setShowNovoItem(null); setNovoItem({ nome: '', valor_aprovado: '', descricao: '' }) }}>Cancelar</button>
                  <button className="btn-primary text-xs" disabled={saving || !novoItem.nome.trim() || !novoItem.valor_aprovado} onClick={() => criarItem(grupo.id)}>
                    {saving ? 'Salvando…' : 'Adicionar'}
                  </button>
                </div>
              </div>
            )}

            {/* Itens */}
            {grupo.itens.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-4 py-3">Nenhum item neste grupo.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left px-4 py-2 font-medium">Item</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Descrição</th>
                    <th className="text-right px-4 py-2 font-medium">Valor Aprovado</th>
                    {podeEditar && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {grupo.itens.map(item => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{item.nome}</td>
                      <td className="px-4 py-2 text-gray-500 hidden md:table-cell text-xs">{item.descricao ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{fBRL(item.valor_aprovado)}</td>
                      {podeEditar && (
                        <td className="pr-2 text-center">
                          <button className="text-red-400 hover:text-red-600 text-xs p-1" title="Remover item" onClick={() => removerItem(grupo.id, item.id)}>✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-xs font-semibold text-gray-500" colSpan={2}>Subtotal</td>
                    <td className="px-4 py-2 text-right text-sm font-bold tabular-nums">{fBRL(totalGrupo)}</td>
                    {podeEditar && <td />}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ViabilidadeEditor({ viabilidade, projetoId, canEdit, canSubmit, workflow, sessionUser, usuarios, onRefresh }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<'viabilidade' | 'orcamento'>('viabilidade')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const { baixar, baixando, erroDownload, setErroDownload } = useDownload()

  // Validação e modais de aprovação
  const [validacaoErros, setValidacaoErros]     = useState<ErroValidacao[]>([])
  const [validacaoSucesso, setValidacaoSucesso] = useState(false)
  const [showEnviarModal, setShowEnviarModal]   = useState(false)
  const [submitting, setSubmitting]             = useState(false)
  const [approving, setApproving]               = useState(false)
  const [showRevisaoModal, setShowRevisaoModal] = useState(false)
  const [revisaoObs, setRevisaoObs]             = useState('')

  // Backwards compat: se novos flags forem null, deriva do campo legado tipo_payback
  const tpQuantInit = viabilidade?.tipo_payback_quantitativo != null
    ? Boolean(viabilidade.tipo_payback_quantitativo)
    : viabilidade?.tipo_payback === 'QUANTITATIVO'
  const tpQualInit = viabilidade?.tipo_payback_qualitativo != null
    ? Boolean(viabilidade.tipo_payback_qualitativo)
    : viabilidade?.tipo_payback !== 'QUANTITATIVO'

  const [form, setForm] = useState({
    resumo_executivo: viabilidade?.resumo_executivo ?? '',
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
    condicoes_aprovacao: viabilidade?.condicoes_aprovacao ?? '',
    // Financial premises
    capex: (viabilidade?.capex ?? null) as number | null,
    opex: (viabilidade?.opex ?? null) as number | null,
    opex_periodicidade: viabilidade?.opex_periodicidade ?? 'MENSAL',
    economia_estimada: (viabilidade?.economia_estimada ?? null) as number | null,
    economia_periodicidade: viabilidade?.economia_periodicidade ?? 'MENSAL',
    tipo_payback: viabilidade?.tipo_payback ?? 'QUALITATIVO',
    tipo_payback_quantitativo: tpQuantInit,
    tipo_payback_qualitativo: tpQualInit,
    beneficios_esperados: viabilidade?.beneficios_esperados ?? '',
    payback_informado: (viabilidade?.payback_informado ?? null) as number | null,
    payback_unidade: viabilidade?.payback_unidade ?? 'MESES',
    // Payback v2
    baseline_valor: (viabilidade?.baseline_valor ?? null) as number | null,
    meta_valor: (viabilidade?.meta_valor ?? null) as number | null,
    tipo_indicador: (() => {
      const raw = viabilidade?.tipo_indicador ?? null
      if (!raw) {
        // Backward compat: derive from boolean flags
        const arr: string[] = ['ABSOLUTO']
        if (viabilidade?.ganho_tarefa_ativo) arr.push('GANHO_TAREFA')
        if (viabilidade?.hc_ativo) arr.push('HC')
        return arr
      }
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] }
      catch { return [raw] }
    })() as string[],
    economia_mensal_esperada: (viabilidade?.economia_mensal_esperada ?? null) as number | null,
    // Indicador Ganho Tarefa
    ganho_tarefa_ativo: Boolean(viabilidade?.ganho_tarefa_ativo),
    ganho_tarefa_salario: (viabilidade?.ganho_tarefa_salario ?? null) as number | null,
    ganho_tarefa_horas_antes: (viabilidade?.ganho_tarefa_horas_antes ?? null) as number | null,
    ganho_tarefa_horas_depois: (viabilidade?.ganho_tarefa_horas_depois ?? null) as number | null,
    ganho_tarefa_freq_mensal: (viabilidade?.ganho_tarefa_freq_mensal ?? 1) as number,
    // Indicador HC
    hc_ativo: Boolean(viabilidade?.hc_ativo),
    hc_quantidade: (viabilidade?.hc_quantidade ?? 1) as number,
    hc_salario_mensal: (viabilidade?.hc_salario_mensal ?? null) as number | null,
    hc_encargos_pct: (viabilidade?.hc_encargos_pct ?? null) as number | null,
    hc_beneficios_mensais: (viabilidade?.hc_beneficios_mensais ?? null) as number | null,
    hc_outros_mensais: (viabilidade?.hc_outros_mensais ?? null) as number | null,
    // Horas de analistas MegaG
    horas_analistas_ativo: Boolean(viabilidade?.horas_analistas_ativo),
    horas_analistas_lista: (() => {
      try {
        const raw = viabilidade?.horas_analistas_json
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch { return [] }
    })() as { id: string; nome: string; horas: number | null; custo_hora: number | null }[],
  })

  // V1 aprovada pode ser editada para regularização de base histórica
  const isV1Aprovada = viabilidade?.status === 'APROVADO' && viabilidade?.versao === 1

  const isEditable = canEdit && (viabilidade?.status === 'RASCUNHO' || isV1Aprovada)

  const setField = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  // Custo de Desenvolvimento Interno (horas analistas MegaG)
  const custoDesenvolvimentoInterno = form.horas_analistas_ativo
    ? form.horas_analistas_lista.reduce(
        (sum, a) => sum + (a.horas ?? 0) * (a.custo_hora ?? 0),
        0
      )
    : 0

  // Derived: Investimento Total = CAPEX + OPEX + Custo Desenvolvimento Interno
  const investimentoTotalCalc = (form.capex ?? 0) + (form.opex ?? 0) + custoDesenvolvimentoInterno

  // Economia mensal (normalize for payback calculation)
  const economiaMensal =
    form.economia_periodicidade === 'ANUAL'
      ? (form.economia_estimada ?? 0) / 12
      : (form.economia_estimada ?? 0)

  // Payback Calculado only for QUANTITATIVO
  const paybackCalculado =
    form.tipo_payback === 'QUANTITATIVO' && investimentoTotalCalc > 0 && economiaMensal > 0
      ? investimentoTotalCalc / economiaMensal
      : null

  // Cálculo Ganho Tarefa (44h/semana → 220h/mês)
  const valorHoraGT = form.ganho_tarefa_salario && form.ganho_tarefa_salario > 0
    ? form.ganho_tarefa_salario / 220
    : null
  const horasEconomizadasGT = (form.ganho_tarefa_horas_antes !== null && form.ganho_tarefa_horas_depois !== null)
    ? Math.max(0, (form.ganho_tarefa_horas_antes ?? 0) - (form.ganho_tarefa_horas_depois ?? 0))
    : null
  const economiaMensalGT = valorHoraGT !== null && horasEconomizadasGT !== null
    ? valorHoraGT * horasEconomizadasGT * (form.ganho_tarefa_freq_mensal ?? 1)
    : null

  // Cálculo HC
  const custoTotalHCUnitario = form.hc_salario_mensal !== null
    ? (form.hc_salario_mensal ?? 0)
      + (form.hc_encargos_pct ? (form.hc_salario_mensal ?? 0) * (form.hc_encargos_pct / 100) : 0)
      + (form.hc_beneficios_mensais ?? 0)
      + (form.hc_outros_mensais ?? 0)
    : null
  const economiaMensalHC = custoTotalHCUnitario !== null
    ? custoTotalHCUnitario * (form.hc_quantidade ?? 1)
    : null

  const tipoIndicadorArr = Array.isArray(form.tipo_indicador) ? form.tipo_indicador : [form.tipo_indicador as unknown as string]
  const ganhoTarefaAtivo = tipoIndicadorArr.includes('GANHO_TAREFA')
  const hcAtivo = tipoIndicadorArr.includes('HC')

  // Economia mensal total dos indicadores automáticos
  const economiaMensalIndicadores = (
    (ganhoTarefaAtivo ? (economiaMensalGT ?? 0) : 0)
    + (hcAtivo ? (economiaMensalHC ?? 0) : 0)
  ) || null

  // Divergence check
  const divergencia =
    form.tipo_payback === 'QUANTITATIVO' &&
    paybackCalculado !== null &&
    form.payback_informado !== null &&
    form.payback_informado !== undefined
      ? (() => {
          const informadoMeses = form.payback_unidade === 'ANOS'
            ? (form.payback_informado ?? 0) * 12
            : (form.payback_informado ?? 0)
          return Math.abs(paybackCalculado - informadoMeses) > 0.5
        })()
      : false

  function handleTipoPayback(field: 'tipo_payback_quantitativo' | 'tipo_payback_qualitativo', checked: boolean) {
    setForm(f => {
      const nextQuant = field === 'tipo_payback_quantitativo' ? checked : f.tipo_payback_quantitativo
      return {
        ...f,
        [field]: checked,
        // Mantém tipo_payback sincronizado para os cálculos existentes
        tipo_payback: nextQuant ? 'QUANTITATIVO' : 'QUALITATIVO',
      }
    })
  }

  function handleEnviarParaAprovacao() {
    if (!viabilidade) return
    setValidacaoErros([])
    setValidacaoSucesso(false)

    // Montar objeto ViabilidadeParaValidar a partir do form state atual.
    // Usar form (e não viabilidade) garante que campos editados mas ainda
    // não salvos sejam validados com os valores mais recentes.
    const paraValidar: ViabilidadeParaValidar = {
      resumo_executivo:           form.resumo_executivo        || null,
      capex:                      form.capex,
      opex:                       form.opex,
      economia_estimada:          form.economia_estimada,
      tipo_payback:               form.tipo_payback            || null,
      tipo_payback_quantitativo:  form.tipo_payback_quantitativo,
      tipo_payback_qualitativo:   form.tipo_payback_qualitativo,
      beneficios_esperados:       form.beneficios_esperados    || null,
      payback_informado:          form.payback_informado,
      sistemas_envolvidos:        form.sistemas_envolvidos     || null,
      complexidade_tecnica:       form.complexidade_tecnica    || null,
      dependencia_fornecedores:   form.dependencia_fornecedores|| null,
      infraestrutura:             form.infraestrutura          || null,
      impacto_operacional:        form.impacto_operacional     || null,
      mudanca_processo:           form.mudanca_processo        || null,
      recursos_necessarios:       form.recursos_necessarios    || null,
      impactos:                   form.impactos                || null,
      riscos:                     form.riscos                  || null,
      data_inicio_prev:           form.data_inicio_prev        || null,
      data_fim_prev:              form.data_fim_prev           || null,
      marcos:                     form.marcos                  || null,
      recomendacao:               form.recomendacao            || null,
      justificativa_recomendacao: form.justificativa_recomendacao || null,
      condicoes_aprovacao:        form.condicoes_aprovacao     || null,
    }

    // Toda a lógica de validação — incluindo regras condicionais — está
    // centralizada em validarViabilidade(). O componente apenas monta o
    // objeto e apresenta os erros retornados.
    const erros = validarViabilidade(paraValidar)

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
    if (!viabilidade) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/submeter`, {
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
    if (!viabilidade || !workflow) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/aprovar`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao aprovar')
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao processar')
    } finally {
      setApproving(false)
    }
  }

  async function handleNovaVersao() {
    if (!viabilidade) return
    if (!confirm(`Criar uma nova versão editável baseada na V${viabilidade.versao} aprovada?`)) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/nova-versao`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao criar nova versão')
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar nova versão')
    } finally {
      setApproving(false)
    }
  }

  async function handleSolicitarRevisao() {
    if (!viabilidade || !workflow || !revisaoObs.trim()) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/revisao`, {
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

  const etapaAtual = workflow?.etapas.find(e => e.ordem === workflow.etapa_atual)
  const isEtapaAtual = etapaAtual?.usuario_id === sessionUser.id


  async function handleSave() {
    if (!viabilidade) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumo_executivo: form.resumo_executivo,
          sistemas_envolvidos: form.sistemas_envolvidos,
          complexidade_tecnica: form.complexidade_tecnica,
          dependencia_fornecedores: form.dependencia_fornecedores,
          infraestrutura: form.infraestrutura,
          impacto_operacional: form.impacto_operacional,
          mudanca_processo: form.mudanca_processo,
          recursos_necessarios: form.recursos_necessarios,
          impactos: form.impactos,
          riscos: form.riscos,
          data_inicio_prev: form.data_inicio_prev || null,
          data_fim_prev: form.data_fim_prev || null,
          marcos: form.marcos,
          recomendacao: form.recomendacao,
          justificativa_recomendacao: form.justificativa_recomendacao,
          condicoes_aprovacao: form.condicoes_aprovacao || null,
          capex: form.capex,
          opex: form.opex,
          opex_periodicidade: form.opex_periodicidade,
          economia_estimada: form.economia_estimada,
          economia_periodicidade: form.economia_periodicidade,
          tipo_payback: form.tipo_payback,
          tipo_payback_quantitativo: form.tipo_payback_quantitativo ? 1 : 0,
          tipo_payback_qualitativo: form.tipo_payback_qualitativo ? 1 : 0,
          beneficios_esperados: form.beneficios_esperados || null,
          payback_informado: form.payback_informado,
          payback_unidade: form.payback_unidade,
          baseline_valor: form.baseline_valor,
          meta_valor: form.meta_valor,
          tipo_indicador: JSON.stringify(form.tipo_indicador),
          economia_mensal_esperada: form.economia_mensal_esperada,
          // Ganho Tarefa
          ganho_tarefa_ativo: ganhoTarefaAtivo ? 1 : 0,
          ganho_tarefa_salario: form.ganho_tarefa_salario,
          ganho_tarefa_horas_antes: form.ganho_tarefa_horas_antes,
          ganho_tarefa_horas_depois: form.ganho_tarefa_horas_depois,
          ganho_tarefa_freq_mensal: form.ganho_tarefa_freq_mensal,
          // HC
          hc_ativo: hcAtivo ? 1 : 0,
          hc_quantidade: form.hc_quantidade,
          hc_salario_mensal: form.hc_salario_mensal,
          hc_encargos_pct: form.hc_encargos_pct,
          hc_beneficios_mensais: form.hc_beneficios_mensais,
          hc_outros_mensais: form.hc_outros_mensais,
          // Horas de Analistas MegaG
          horas_analistas_ativo: form.horas_analistas_ativo ? 1 : 0,
          horas_analistas_json: form.horas_analistas_ativo ? JSON.stringify(form.horas_analistas_lista) : null,
          horas_analistas_total: form.horas_analistas_ativo ? custoDesenvolvimentoInterno : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setEditing(false)
      onRefresh()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
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

  // Computa os valores do sidebar a partir do estado atual (edição ou visualização)
  const _capex   = editing ? form.capex   : viabilidade!.capex
  const _opex    = editing ? form.opex    : viabilidade!.opex
  const _invTotal = (_capex ?? 0) + (_opex ?? 0)
  const _eco     = editing ? form.economia_estimada   : viabilidade!.economia_estimada
  const _period  = editing ? form.economia_periodicidade : (viabilidade!.economia_periodicidade ?? 'MENSAL')
  const _tipo    = editing ? form.tipo_payback : (viabilidade!.tipo_payback ?? 'QUALITATIVO')
  const _mensal  = _period === 'ANUAL' ? (_eco ?? 0) / 12 : (_eco ?? 0)
  const _pbCalc  = _tipo === 'QUANTITATIVO' && _invTotal > 0 && _mensal > 0 ? _invTotal / _mensal : null

  const sidebarData: SidebarData = {
    capex: _capex,
    opex:  _opex,
    invTotal: _invTotal > 0 ? _invTotal : null,
    economia: _eco,
    economiaLabel: _period === 'ANUAL' ? '(anual)' : '(mensal)',
    tipoPayback: _tipo,
    paybackCalc: _pbCalc,
    paybackInformado: editing ? form.payback_informado : viabilidade!.payback_informado,
    paybackUnidade:   editing ? form.payback_unidade   : (viabilidade!.payback_unidade ?? 'MESES'),
    divergencia,
  }

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
            {erroDownload && (
              <span className="text-xs text-red-600">{erroDownload}
                <button className="ml-1 underline" onClick={() => setErroDownload(null)}>✕</button>
              </span>
            )}

            {/* Modo edição: Salvar + Cancelar */}
            {editing ? (
              <>
                <button className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button className="btn-secondary text-sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                {/* RASCUNHO: dropdown Editar com 3 opções */}
                {isEditable && viabilidade.status === 'RASCUNHO' && (
                  <ArtefatoEditarDropdown
                    exportando={!!baixando}
                    onEditarManual={() => { limparValidacao(); setEditing(true) }}
                    onImportar={() => {
                      const temDados = Object.values(form).some(v =>
                        v !== null && v !== undefined &&
                        (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0)
                      )
                      if (
                        temDados &&
                        !window.confirm(
                          'Este documento já possui informações preenchidas. Deseja substituir os dados pelos dados do arquivo importado?'
                        )
                      ) return
                      setShowImportModal(true)
                    }}
                    onExportar={() => baixar(
                      `/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/exportar-modelo?formato=xlsx`,
                      `Viabilidade_Projeto${projetoId}_v${viabilidade.versao}.xlsx`,
                    )}
                  />
                )}
                {canSubmit && viabilidade.status === 'RASCUNHO' && (
                  <button className="btn-primary text-sm" onClick={handleEnviarParaAprovacao}>
                    Enviar para Aprovação
                  </button>
                )}

                {/* APROVADO — Editar V1 (regularização histórica) ou Nova Versão */}
                {viabilidade.status === 'APROVADO' && canEdit && (
                  <>
                    {isV1Aprovada && (
                      <button className="btn-secondary text-sm" onClick={() => { limparValidacao(); setEditing(true) }}>
                        Editar
                      </button>
                    )}
                    <button className="btn-secondary text-sm" disabled={approving} onClick={handleNovaVersao}>
                      {approving ? 'Criando…' : 'Nova Versão'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de validação */}
      <AlertaValidacao
        erros={validacaoErros}
        sucesso={validacaoSucesso}
        onFechar={limparValidacao}
      />

      {/* Painel do workflow quando em aprovação */}
      {workflow && viabilidade.status === 'PENDENTE_APROVACAO' && (
        <WorkflowStatusPanel
          workflow={workflow}
          sessionId={sessionUser.id}
          actions={isEtapaAtual ? (
            <>
              <button className="btn-primary text-sm" disabled={approving} onClick={handleAprovar}>
                {etapaAtual?.tipo === 'CIENCIA' ? (approving ? 'Processando…' : 'Confirmar Ciência') : (approving ? 'Aprovando…' : 'Aprovar')}
              </button>
              {etapaAtual?.tipo === 'APROVACAO' && (
                <button className="btn-secondary text-sm" disabled={approving} onClick={() => setShowRevisaoModal(true)}>
                  Solicitar Revisão
                </button>
              )}
            </>
          ) : undefined}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
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
              <button className="btn-secondary text-sm" onClick={() => { setShowRevisaoModal(false); setRevisaoObs('') }}>Cancelar</button>
              <button className="btn-primary text-sm" disabled={!revisaoObs.trim() || approving} onClick={handleSolicitarRevisao}>
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

      {/* Tabs: Viabilidade | Orçamento */}
      <div className="tab-list mb-4">
        <button
          className={`tab-item${abaAtiva === 'viabilidade' ? ' active' : ''}`}
          onClick={() => setAbaAtiva('viabilidade')}
        >
          Estudo de Viabilidade
        </button>
        <button
          className={`tab-item${abaAtiva === 'orcamento' ? ' active' : ''}`}
          onClick={() => setAbaAtiva('orcamento')}
        >
          Orçamento Aprovado
        </button>
      </div>

      {/* Aba Orçamento */}
      {abaAtiva === 'orcamento' && viabilidade && (
        <OrcamentoTab projetoId={projetoId} viabilidadeId={viabilidade.id} canEdit={canEdit} viabilidadeStatus={viabilidade.status ?? 'RASCUNHO'} viabilidadeV1={isV1Aprovada} />
      )}

      {/* Two-column layout: main content + sidebar */}
      {abaAtiva === 'viabilidade' && (
      <div className="flex gap-4 items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0">
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
                <TextAreaField label="Resumo Executivo" value={form.resumo_executivo} onChange={setField('resumo_executivo')} />

                {/* Bloco 1 — Investimentos */}
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm mb-4" style={{ color: '#003087' }}>Bloco 1 — Investimentos</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CurrencyInput
                      label="CAPEX (R$)"
                      value={form.capex}
                      onChange={(v) => setForm((f) => ({ ...f, capex: v }))}
                      helpText="Investimento de capital (equipamentos, infraestrutura, licenças)"
                    />
                    <div>
                      <CurrencyInput
                        label="OPEX (R$)"
                        value={form.opex}
                        onChange={(v) => setForm((f) => ({ ...f, opex: v }))}
                        helpText="Custo operacional recorrente"
                      />
                      <div className="mt-2">
                        <label className="input-label">Periodicidade do OPEX</label>
                        <select className="input w-full" value={form.opex_periodicidade} onChange={(e) => setField('opex_periodicidade')(e.target.value)}>
                          <option value="MENSAL">Mensal</option>
                          <option value="ANUAL">Anual</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* Horas de Analistas MegaG */}
                  <div className="mt-4 border border-gray-100 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.horas_analistas_ativo}
                        onChange={e => setForm(f => ({
                          ...f,
                          horas_analistas_ativo: e.target.checked,
                          horas_analistas_lista: e.target.checked && f.horas_analistas_lista.length === 0
                            ? [{ id: crypto.randomUUID(), nome: '', horas: null, custo_hora: null }]
                            : f.horas_analistas_lista,
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Possui horas de analistas MegaG</span>
                    </label>

                    {form.horas_analistas_ativo && (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-[1fr_100px_130px_110px_28px] gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                          <span>Analista</span>
                          <span>Horas</span>
                          <span>Custo/hora (R$)</span>
                          <span>Custo Total</span>
                          <span />
                        </div>
                        {form.horas_analistas_lista.map((analista, idx) => {
                          const custo = (analista.horas ?? 0) * (analista.custo_hora ?? 0)
                          return (
                            <div key={analista.id} className="grid grid-cols-[1fr_100px_130px_110px_28px] gap-2 items-center">
                              <input
                                type="text"
                                className="input text-sm"
                                placeholder="Nome do analista"
                                value={analista.nome}
                                onChange={e => setForm(f => ({
                                  ...f,
                                  horas_analistas_lista: f.horas_analistas_lista.map((a, i) =>
                                    i === idx ? { ...a, nome: e.target.value } : a
                                  ),
                                }))}
                              />
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="input text-sm"
                                placeholder="0"
                                value={analista.horas ?? ''}
                                onChange={e => setForm(f => ({
                                  ...f,
                                  horas_analistas_lista: f.horas_analistas_lista.map((a, i) =>
                                    i === idx ? { ...a, horas: e.target.value ? parseFloat(e.target.value) : null } : a
                                  ),
                                }))}
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input text-sm"
                                placeholder="0,00"
                                value={analista.custo_hora ?? ''}
                                onChange={e => setForm(f => ({
                                  ...f,
                                  horas_analistas_lista: f.horas_analistas_lista.map((a, i) =>
                                    i === idx ? { ...a, custo_hora: e.target.value ? parseFloat(e.target.value) : null } : a
                                  ),
                                }))}
                              />
                              <span className="text-sm font-medium text-gray-700 tabular-nums">
                                {custo > 0 ? fBRL(custo) : '—'}
                              </span>
                              <button
                                type="button"
                                title="Remover analista"
                                className="text-red-400 hover:text-red-600 text-lg leading-none"
                                onClick={() => setForm(f => ({
                                  ...f,
                                  horas_analistas_lista: f.horas_analistas_lista.filter((_, i) => i !== idx),
                                }))}
                              >×</button>
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          className="text-sm font-medium hover:underline mt-1"
                          style={{ color: '#003087' }}
                          onClick={() => setForm(f => ({
                            ...f,
                            horas_analistas_lista: [
                              ...f.horas_analistas_lista,
                              { id: crypto.randomUUID(), nome: '', horas: null, custo_hora: null },
                            ],
                          }))}
                        >
                          + Adicionar analista
                        </button>
                        {custoDesenvolvimentoInterno > 0 && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg flex justify-between items-center">
                            <span className="text-xs font-medium text-amber-800">Custo de Desenvolvimento Interno</span>
                            <span className="text-sm font-bold text-amber-900 tabular-nums">{fBRL(custoDesenvolvimentoInterno)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium text-blue-800">Investimento Total</span>
                      <p className="text-xs text-blue-600 mt-0.5">CAPEX + OPEX{form.horas_analistas_ativo ? ' + Desenvolvimento Interno' : ''} — calculado automaticamente</p>
                    </div>
                    <span className="text-sm font-bold text-blue-900 tabular-nums">
                      {fBRL(investimentoTotalCalc > 0 ? investimentoTotalCalc : null)}
                    </span>
                  </div>
                </div>

                {/* Bloco 2 — Indicadores Financeiros */}
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm mb-4" style={{ color: '#003087' }}>Bloco 2 — Indicadores Financeiros</h4>

                  {/* Tipo de Benefício */}
                  <div className="mb-5">
                    <label className="input-label">Tipo de Benefício <span className="text-red-500">*</span></label>
                    <div className="flex gap-6 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.tipo_payback_quantitativo}
                          onChange={(e) => handleTipoPayback('tipo_payback_quantitativo', e.target.checked)}
                        />
                        <span className="text-sm">Quantitativo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.tipo_payback_qualitativo}
                          onChange={(e) => handleTipoPayback('tipo_payback_qualitativo', e.target.checked)}
                        />
                        <span className="text-sm">Qualitativo</span>
                      </label>
                    </div>
                    {!form.tipo_payback_quantitativo && !form.tipo_payback_qualitativo && (
                      <p className="text-xs text-amber-600 mt-1">Selecione pelo menos um tipo de benefício.</p>
                    )}
                  </div>

                  {/* Benefício Quantitativo */}
                  {form.tipo_payback_quantitativo && (
                    <div className="border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#003087' }}>Benefício Quantitativo</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <CurrencyInput
                          label="Economia Estimada (R$)"
                          value={form.economia_estimada}
                          onChange={(v) => setForm((f) => ({ ...f, economia_estimada: v }))}
                        />
                        <div>
                          <label className="input-label">Periodicidade da Economia</label>
                          <select className="input w-full" value={form.economia_periodicidade} onChange={(e) => setField('economia_periodicidade')(e.target.value)}>
                            <option value="MENSAL">Mensal</option>
                            <option value="ANUAL">Anual</option>
                          </select>
                        </div>
                      </div>

                      {paybackCalculado !== null && (
                        <div className="p-3 bg-blue-50 rounded-lg mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Payback Calculado</span>
                            <span className="text-sm font-semibold text-gray-800">
                              {paybackCalculado.toFixed(2).replace('.', ',')} meses
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Investimento Total ÷ Economia Mensal</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="input-label">Payback Informado</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input w-full"
                            value={form.payback_informado ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, payback_informado: e.target.value ? parseFloat(e.target.value) : null }))}
                            placeholder="Ex.: 18"
                          />
                        </div>
                        <div>
                          <label className="input-label">Unidade</label>
                          <select className="input w-full" value={form.payback_unidade} onChange={(e) => setField('payback_unidade')(e.target.value)}>
                            <option value="MESES">Meses</option>
                            <option value="ANOS">Anos</option>
                          </select>
                        </div>
                      </div>

                      {divergencia && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800 font-medium">Divergência detectada</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            O payback informado difere do calculado em mais de 0,5 meses. Verifique os valores antes de continuar.
                          </p>
                        </div>
                      )}

                      {/* Acompanhamento Automático de Payback */}
                      <div className="mt-4 pt-4 border-t border-blue-100">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-3">
                          Base para Acompanhamento Automático
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          Preencha estes campos para habilitar o gráfico de evolução do indicador na aba de Payback.
                        </p>
                        <div className="mb-4">
                          <label className="input-label mb-2">Tipo de Indicador (selecione um ou mais)</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: 'ABSOLUTO',     label: 'Absoluto (n.º ocorrências)' },
                              { value: 'PERCENTUAL',   label: 'Percentual (%)' },
                              { value: 'GANHO_TAREFA', label: 'Ganho Tarefa' },
                              { value: 'HC',           label: 'HC (Headcount)' },
                            ].map(opt => {
                              const selected = tipoIndicadorArr.includes(opt.value)
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    const arr = tipoIndicadorArr.includes(opt.value)
                                      ? tipoIndicadorArr.filter(v => v !== opt.value)
                                      : [...tipoIndicadorArr, opt.value]
                                    setForm(f => ({ ...f, tipo_indicador: arr.length ? arr : ['ABSOLUTO'] }))
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${selected ? 'bg-megag-azul text-white border-megag-azul' : 'bg-white text-gray-600 border-gray-300 hover:border-megag-azul'}`}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="input-label">Valor Baseline (antes do projeto)</label>
                            <input
                              type="number" step="0.01" min="0" className="input w-full"
                              value={form.baseline_valor ?? ''}
                              onChange={e => setForm(f => ({ ...f, baseline_valor: e.target.value ? parseFloat(e.target.value) : null }))}
                              placeholder={tipoIndicadorArr.includes('PERCENTUAL') ? 'Ex: 15 (%)' : 'Ex: 250'}
                            />
                          </div>
                          <div>
                            <label className="input-label">Valor Meta (alvo após projeto)</label>
                            <input
                              type="number" step="0.01" min="0" className="input w-full"
                              value={form.meta_valor ?? ''}
                              onChange={e => setForm(f => ({ ...f, meta_valor: e.target.value ? parseFloat(e.target.value) : null }))}
                              placeholder={tipoIndicadorArr.includes('PERCENTUAL') ? 'Ex: 3 (%)' : 'Ex: 50'}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="input-label">Economia Mensal Esperada (R$)</label>
                          <CurrencyInput
                            value={form.economia_mensal_esperada}
                            onChange={v => setForm(f => ({ ...f, economia_mensal_esperada: v }))}
                            placeholder="Benefício financeiro mensal esperado"
                          />
                          <p className="text-xs text-gray-400 mt-1">Se informado, substitui o cálculo automático a partir da Economia Estimada.</p>
                        </div>
                      </div>

                      {/* Campos dinâmicos — abrem conforme seleção no Tipo de Indicador */}

                      {ganhoTarefaAtivo && (
                        <div className="mt-4 pt-4 border-t border-blue-100">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-3">Ganho Tarefa — Detalhamento</p>
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="input-label">Salário Mensal (R$)</label>
                                <CurrencyInput
                                  value={form.ganho_tarefa_salario}
                                  onChange={v => setForm(f => ({ ...f, ganho_tarefa_salario: v }))}
                                  placeholder="Ex.: 5000"
                                />
                              </div>
                              <div>
                                <label className="input-label">Frequência Mensal (vezes/mês)</label>
                                <input
                                  type="number" step="0.5" min="0.5" className="input w-full"
                                  value={form.ganho_tarefa_freq_mensal ?? 1}
                                  onChange={e => setForm(f => ({ ...f, ganho_tarefa_freq_mensal: e.target.value ? parseFloat(e.target.value) : 1 }))}
                                  placeholder="Ex.: 22"
                                />
                              </div>
                              <div>
                                <label className="input-label">Horas Atuais (por execução)</label>
                                <input
                                  type="number" step="0.25" min="0" className="input w-full"
                                  value={form.ganho_tarefa_horas_antes ?? ''}
                                  onChange={e => setForm(f => ({ ...f, ganho_tarefa_horas_antes: e.target.value ? parseFloat(e.target.value) : null }))}
                                  placeholder="Ex.: 2"
                                />
                              </div>
                              <div>
                                <label className="input-label">Horas Previstas após projeto (por execução)</label>
                                <input
                                  type="number" step="0.25" min="0" className="input w-full"
                                  value={form.ganho_tarefa_horas_depois ?? ''}
                                  onChange={e => setForm(f => ({ ...f, ganho_tarefa_horas_depois: e.target.value ? parseFloat(e.target.value) : null }))}
                                  placeholder="Ex.: 0.5"
                                />
                              </div>
                            </div>
                            {valorHoraGT !== null && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-white rounded p-2 border border-blue-200">
                                <div>
                                  <span className="text-gray-500">Valor/hora</span>
                                  <p className="font-semibold text-gray-800">R$ {valorHoraGT.toFixed(2).replace('.', ',')}</p>
                                  <p className="text-gray-400">salário ÷ 220h</p>
                                </div>
                                {horasEconomizadasGT !== null && (
                                  <div>
                                    <span className="text-gray-500">Horas economizadas/exec.</span>
                                    <p className="font-semibold text-gray-800">{horasEconomizadasGT.toFixed(2).replace('.', ',')}h</p>
                                  </div>
                                )}
                                {economiaMensalGT !== null && (
                                  <div>
                                    <span className="text-gray-500">Economia mensal</span>
                                    <p className="font-semibold text-green-700">R$ {economiaMensalGT.toFixed(2).replace('.', ',')}</p>
                                    <p className="text-gray-400">valor/h × horas × freq.</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {hcAtivo && (
                        <div className="mt-4 pt-4 border-t border-blue-100">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-3">HC — Headcount Reduzido</p>
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="input-label">Quantidade de Colaboradores (HC)</label>
                                <input
                                  type="number" step="1" min="1" className="input w-full"
                                  value={form.hc_quantidade ?? 1}
                                  onChange={e => setForm(f => ({ ...f, hc_quantidade: e.target.value ? parseInt(e.target.value) : 1 }))}
                                  placeholder="Ex.: 2"
                                />
                              </div>
                              <div>
                                <label className="input-label">Salário Mensal por Colaborador (R$)</label>
                                <CurrencyInput
                                  value={form.hc_salario_mensal}
                                  onChange={v => setForm(f => ({ ...f, hc_salario_mensal: v }))}
                                  placeholder="Ex.: 4000"
                                />
                              </div>
                              <div>
                                <label className="input-label">Encargos (%)</label>
                                <input
                                  type="number" step="0.1" min="0" max="200" className="input w-full"
                                  value={form.hc_encargos_pct ?? ''}
                                  onChange={e => setForm(f => ({ ...f, hc_encargos_pct: e.target.value ? parseFloat(e.target.value) : null }))}
                                  placeholder="Ex.: 68 (INSS+FGTS+férias)"
                                />
                              </div>
                              <div>
                                <label className="input-label">Benefícios Mensais por Colaborador (R$)</label>
                                <CurrencyInput
                                  value={form.hc_beneficios_mensais}
                                  onChange={v => setForm(f => ({ ...f, hc_beneficios_mensais: v }))}
                                  placeholder="VT + VR + plano de saúde..."
                                />
                              </div>
                              <div>
                                <label className="input-label">Outros Custos Mensais por Colaborador (R$)</label>
                                <CurrencyInput
                                  value={form.hc_outros_mensais}
                                  onChange={v => setForm(f => ({ ...f, hc_outros_mensais: v }))}
                                  placeholder="Ex.: equipamentos, licenças..."
                                />
                              </div>
                            </div>
                            {custoTotalHCUnitario !== null && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white rounded p-2 border border-blue-200">
                                <div>
                                  <span className="text-gray-500">Custo unitário/mês</span>
                                  <p className="font-semibold text-gray-800">R$ {custoTotalHCUnitario.toFixed(2).replace('.', ',')}</p>
                                  <p className="text-gray-400">salário + encargos + benefícios + outros</p>
                                </div>
                                {economiaMensalHC !== null && (
                                  <div>
                                    <span className="text-gray-500">Economia mensal total ({form.hc_quantidade ?? 1} HC)</span>
                                    <p className="font-semibold text-green-700">R$ {economiaMensalHC.toFixed(2).replace('.', ',')}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {economiaMensalIndicadores !== null && economiaMensalIndicadores > 0 && (
                        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
                          <span className="text-gray-600">Economia mensal total dos indicadores: </span>
                          <span className="font-semibold text-green-700">R$ {economiaMensalIndicadores.toFixed(2).replace('.', ',')}</span>
                          <span className="text-gray-400 ml-2">— use este valor no campo "Economia Mensal Esperada" acima para acionar o gráfico de Payback.</span>
                        </div>
                      )}

                    </div>
                  )}

                  {/* Benefício Qualitativo */}
                  {form.tipo_payback_qualitativo && (
                    <div className="border border-green-200 rounded-lg p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#1a6e3c' }}>Benefício Qualitativo</p>
                      <label className="input-label">Benefícios Esperados <span className="text-red-500">*</span></label>
                      <textarea
                        className="input w-full min-h-[120px] resize-y mt-1"
                        value={form.beneficios_esperados}
                        onChange={(e) => setForm((f) => ({ ...f, beneficios_esperados: e.target.value }))}
                        placeholder="Ex.: Redução de retrabalho, melhoria da experiência do cliente, maior controle operacional, conformidade regulatória..."
                      />
                    </div>
                  )}
                </div>

                {/* Bloco 4 — Viabilidade Técnica e Operacional */}
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>Bloco 4 — Viabilidade Técnica</h4>
                  <TextAreaField label="Sistemas Envolvidos" value={form.sistemas_envolvidos} onChange={setField('sistemas_envolvidos')} />
                  <TextAreaField label="Complexidade Técnica" value={form.complexidade_tecnica} onChange={setField('complexidade_tecnica')} />
                  <TextAreaField label="Dependência de Fornecedores" value={form.dependencia_fornecedores} onChange={setField('dependencia_fornecedores')} />
                  <TextAreaField label="Infraestrutura" value={form.infraestrutura} onChange={setField('infraestrutura')} />
                </div>
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>Viabilidade Operacional</h4>
                  <TextAreaField label="Impacto Operacional" value={form.impacto_operacional} onChange={setField('impacto_operacional')} />
                  <TextAreaField label="Mudança de Processo" value={form.mudanca_processo} onChange={setField('mudanca_processo')} />
                  <TextAreaField label="Recursos Necessários / Treinamento" value={form.recursos_necessarios} onChange={setField('recursos_necessarios')} />
                </div>

                <TextAreaField label="Impacto no Negócio" value={form.impactos} onChange={setField('impactos')} />
                <TextAreaField label="Riscos Principais" value={form.riscos} onChange={setField('riscos')} />

                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>Estimativa de Prazo</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
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
                  <h4 className="font-semibold text-sm mb-3" style={{ color: '#003087' }}>Recomendação</h4>
                  <div className="flex gap-4 mb-3">
                    {RECOMENDACAO_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="recomendacao" value={opt.value} checked={form.recomendacao === opt.value} onChange={() => setField('recomendacao')(opt.value)} />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <TextAreaField label="Justificativa" value={form.justificativa_recomendacao} onChange={setField('justificativa_recomendacao')} />

                  {/* Condições para Aprovação — obrigatório quando VIAVEL_AJUSTES */}
                  {form.recomendacao === 'VIAVEL_AJUSTES' && (
                    <div className="mt-3">
                      <label className="input-label">
                        Condições para Aprovação
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <textarea
                        className="input w-full min-h-[100px] resize-y"
                        placeholder="Descreva as condições que devem ser atendidas para aprovação do projeto. Ex: Atualizar orçamento da infraestrutura; Validar cotação dos equipamentos…"
                        value={form.condicoes_aprovacao}
                        onChange={(e) => setField('condicoes_aprovacao')(e.target.value)}
                      />
                      {!form.condicoes_aprovacao.trim() && (
                        <p className="text-xs text-red-500 mt-1">Obrigatório quando a recomendação é &quot;Viável com ajustes&quot;.</p>
                      )}
                    </div>
                  )}
                </div>
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

                <FinancialPremisesView v={viabilidade} />

                <SectionBlock number="4" title="Análise de Viabilidade">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Viabilidade Técnica</h4>
                      <div className="space-y-2">
                        <div><span className="text-xs font-medium text-gray-400">Sistemas:</span> <TextValue value={viabilidade.sistemas_envolvidos} /></div>
                        <div><span className="text-xs font-medium text-gray-400">Complexidade:</span> <TextValue value={viabilidade.complexidade_tecnica} /></div>
                        <div><span className="text-xs font-medium text-gray-400">Dependências:</span> <TextValue value={viabilidade.dependencia_fornecedores} /></div>
                        <div><span className="text-xs font-medium text-gray-400">Infraestrutura:</span> <TextValue value={viabilidade.infraestrutura} /></div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Viabilidade Operacional</h4>
                      <div className="space-y-2">
                        <div><span className="text-xs font-medium text-gray-400">Impacto operacional:</span> <TextValue value={viabilidade.impacto_operacional} /></div>
                        <div><span className="text-xs font-medium text-gray-400">Mudança de processo:</span> <TextValue value={viabilidade.mudanca_processo} /></div>
                        <div><span className="text-xs font-medium text-gray-400">Recursos / Treinamento:</span> <TextValue value={viabilidade.recursos_necessarios} /></div>
                      </div>
                    </div>
                  </div>
                </SectionBlock>

                <SectionBlock number="5" title="Impacto no Negócio">
                  <TextValue value={viabilidade.impactos} />
                </SectionBlock>

                <SectionBlock number="6" title="Riscos Principais">
                  <TextValue value={viabilidade.riscos} />
                </SectionBlock>

                <SectionBlock number="7" title="Estimativa de Prazo">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <span className="text-xs text-gray-400 block">Início previsto</span>
                      <span className="text-sm font-medium">
                        {viabilidade.data_inicio_prev ? viabilidade.data_inicio_prev.slice(0,10).split('-').reverse().join('/') : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Fim previsto</span>
                      <span className="text-sm font-medium">
                        {viabilidade.data_fim_prev ? viabilidade.data_fim_prev.slice(0,10).split('-').reverse().join('/') : '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Marcos</span>
                    <TextValue value={viabilidade.marcos} />
                  </div>
                </SectionBlock>

                <SectionBlock number="8" title="Recomendação">
                  {viabilidade.recomendacao ? (
                    <div className="space-y-3">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor:
                            viabilidade.recomendacao === 'VIAVEL' ? '#D1FAE5' :
                            viabilidade.recomendacao === 'VIAVEL_AJUSTES' ? '#FEF3C7' : '#FEE2E2',
                          color:
                            viabilidade.recomendacao === 'VIAVEL' ? '#065F46' :
                            viabilidade.recomendacao === 'VIAVEL_AJUSTES' ? '#92400E' : '#991B1B',
                        }}
                      >
                        {recomLabel}
                      </span>
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">Justificativa</span>
                        <TextValue value={viabilidade.justificativa_recomendacao} placeholder="Sem justificativa" />
                      </div>
                      {viabilidade.condicoes_aprovacao && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <span className="text-xs font-semibold text-amber-700 block mb-1">Condições para Aprovação</span>
                          <TextValue value={viabilidade.condicoes_aprovacao} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Recomendação não definida</p>
                  )}
                </SectionBlock>
              </div>
            )}
          </div>
        </div>

        <AnaliseFinanceiraSidebar data={sidebarData} />
      </div>
      )}

      {/* Modal de importação Viabilidade */}
      {showImportModal && viabilidade && (
        <ImportacaoModal
          titulo="Importar Estudo de Viabilidade"
          urlImportar={`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/importar`}
          urlExportarXlsx={`/api/projetos/${projetoId}/viabilidade/${viabilidade.id}/exportar-modelo?formato=xlsx`}
          onFechar={() => setShowImportModal(false)}
          onConfirmar={(dados) => {
            const d = dados as ViabilidadeImportada
            setForm(prev => ({
              ...prev,
              resumo_executivo:         d.resumo_executivo         || prev.resumo_executivo,
              sistemas_envolvidos:      d.sistemas_envolvidos      || prev.sistemas_envolvidos,
              complexidade_tecnica:     d.complexidade_tecnica     || prev.complexidade_tecnica,
              dependencia_fornecedores: d.dependencia_fornecedores || prev.dependencia_fornecedores,
              infraestrutura:           d.infraestrutura           || prev.infraestrutura,
              impacto_operacional:      d.impacto_operacional      || prev.impacto_operacional,
              mudanca_processo:         d.mudanca_processo         || prev.mudanca_processo,
              recursos_necessarios:     d.recursos_necessarios     || prev.recursos_necessarios,
              impactos:                 d.impactos                 || prev.impactos,
              beneficios_esperados:     d.beneficios_esperados     || prev.beneficios_esperados,
              riscos:                   d.riscos                   || prev.riscos,
              data_inicio_prev:         d.data_inicio_prev         || prev.data_inicio_prev,
              data_fim_prev:            d.data_fim_prev            || prev.data_fim_prev,
              marcos:                   d.marcos                   || prev.marcos,
              recomendacao:             d.recomendacao             || prev.recomendacao,
              justificativa_recomendacao: d.justificativa_recomendacao || prev.justificativa_recomendacao,
              condicoes_aprovacao:      d.condicoes_aprovacao      || prev.condicoes_aprovacao,
              capex:                    d.capex           ?? prev.capex,
              opex:                     d.opex            ?? prev.opex,
              opex_periodicidade:       d.opex_periodicidade       || prev.opex_periodicidade,
              economia_estimada:        d.economia_estimada        ?? prev.economia_estimada,
              economia_periodicidade:   d.economia_periodicidade   || prev.economia_periodicidade,
              tipo_payback:             d.tipo_payback             || prev.tipo_payback,
              payback_informado:        d.payback_informado        ?? prev.payback_informado,
              payback_unidade:          d.payback_unidade          || prev.payback_unidade,
            }))
            setEditing(true)
            setShowImportModal(false)
          }}
          renderRevisao={(dados) => {
            const d = dados as ViabilidadeImportada
            const fBRL = (v: number | null) => v != null
              ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
            return (
              <div className="space-y-2 text-sm">
                {[
                  ['Resumo Executivo', d.resumo_executivo],
                  ['Sistemas Envolvidos', d.sistemas_envolvidos],
                  ['Impacto Operacional', d.impacto_operacional],
                  ['Riscos', d.riscos],
                  ['Recomendação', d.recomendacao],
                  ['Justificativa', d.justificativa_recomendacao],
                  ['Condições de Aprovação', d.condicoes_aprovacao],
                ].map(([label, val]) => (
                  <div key={String(label)} className="border-b border-gray-200 pb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{val || <span className="italic text-gray-400">— não preenchido</span>}</p>
                  </div>
                ))}
                <div className="border-b border-gray-200 pb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Premissas Financeiras</p>
                  <p className="text-gray-700">CAPEX: {fBRL(d.capex)} · OPEX: {fBRL(d.opex)} · Payback: {d.payback_informado ?? '—'} {d.payback_unidade}</p>
                </div>
              </div>
            )
          }}
        />
      )}
    </div>
  )
}
