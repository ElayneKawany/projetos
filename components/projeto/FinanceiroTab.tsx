'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Upload, Plus, Download, FileText, ChevronDown, ChevronUp, Trash2, Edit2, X, Check } from 'lucide-react'
import type {
  FinanceiroContratoCompleto,
  FinanceiroContratoPagamento,
  FinanceiroResumoExecutivo,
  FinanceiroEnquadramentoHistorico,
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

/** Formata percentual em padrão PT-BR (vírgula decimal) — inteiros ficam sem decimais (ex.: "50%", "99,65%"). */
function pct(v: number): string {
  const texto = Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')
  return `${texto}%`
}

function corProgresso(percentual: number): string {
  if (percentual >= 100) return '#16A34A'
  if (percentual >= 50)  return '#CA8A04'
  return '#DC2626'
}

/**
 * Máscara monetária BRL para digitação livre (campo Valor Pago do lançamento de NF).
 * Trata dígitos antes da vírgula como parte inteira (não como centavos) e limita a
 * parte decimal a 2 dígitos — ex.: "1000" → "R$ 1.000"; "15000,50" → "R$ 15.000,50".
 *
 * A vírgula/decimais só aparecem no texto exibido quando o usuário efetivamente
 * digita a vírgula. Forçar ",00" a cada tecla (mesmo sem vírgula digitada) faz essa
 * vírgula sintética voltar como parte do valor na próxima tecla — como o input é
 * reprocessado a partir do que está exibido, os dígitos seguintes eram lidos como
 * parte decimal (limitada a 2 caracteres) em vez de estender a parte inteira, e o
 * valor nunca passava de um único dígito antes da vírgula (ex.: travava em "R$ 2,00").
 * `numero` (usado no payload) já sai sempre com 2 casas decimais — o padding final
 * de exibição ("R$ 1.000,00") é aplicado só no blur, ver handleValorPagoBlur.
 */
function maskValorMonetario(raw: string): { display: string; numero: number } {
  let cleaned = raw.replace(/[^\d,]/g, '')
  const primeiraVirgula = cleaned.indexOf(',')
  if (primeiraVirgula !== -1) {
    cleaned = cleaned.slice(0, primeiraVirgula + 1) + cleaned.slice(primeiraVirgula + 1).replace(/,/g, '')
  }
  if (cleaned === '') return { display: '', numero: NaN }

  const [intParteRaw, decParte] = cleaned.split(',') as [string, string | undefined]
  const decLimitada = decParte !== undefined ? decParte.slice(0, 2) : undefined

  let intParte = intParteRaw.replace(/^0+(?=\d)/, '')
  if (intParte === '') intParte = '0'
  const intFormatada = intParte.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const display = decLimitada !== undefined ? `R$ ${intFormatada},${decLimitada}` : `R$ ${intFormatada}`
  const numero = parseFloat(`${intParte}.${(decLimitada ?? '00').padEnd(2, '0')}`)
  return { display, numero }
}

/**
 * Máscara MM/AAAA para o campo Competência (lançamento de NF/pagamento).
 * Mantém só dígitos (até 6: MM + AAAA) e insere a barra automaticamente após o mês
 * — ex.: "082026" → "08/2026". A barra é só de exibição: como cada tecla é reprocessada
 * a partir dos dígitos (não da string com barra), não há como uma barra digitada ou
 * autoinserida "confundir" a tecla seguinte.
 */
function maskCompetencia(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 6)
  if (digitos.length <= 2) return digitos
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
}

/** Valida a competência já mascarada. Campo opcional — string vazia é válida. */
function validarCompetencia(valor: string): string | null {
  if (!valor.trim()) return null
  const m = valor.match(/^(\d{2})\/(\d{4})$/)
  if (!m) return 'Competência incompleta. Use o formato MM/AAAA.'
  const mes = Number(m[1])
  if (mes < 1 || mes > 12) return 'Mês da competência inválido — use 01 a 12.'
  return null
}

// ─── Projeção de pagamentos (Novo Contrato) ───────────────────────────────────

type PeriodicidadeProjecao = 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

const MESES_PERIODICIDADE_PROJECAO: Record<PeriodicidadeProjecao, number> = {
  MENSAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12,
}

function somarMesesCompetencia(competencia: string, meses: number): string {
  const [mmStr, aaaaStr] = competencia.split('/')
  const totalMeses = Number(aaaaStr) * 12 + (Number(mmStr) - 1) + meses
  const novoAno = Math.floor(totalMeses / 12)
  const novoMes = (totalMeses % 12) + 1
  return `${String(novoMes).padStart(2, '0')}/${novoAno}`
}

interface ParcelaProjecao { numero: number; competencia: string; valor: string }

/**
 * Distribui o valor total em N parcelas mensais/bimestrais/etc., com a mesma regra do
 * Cronograma (Tarefa de Pagamento, lib/cronograma/parcelas.ts): valor em centavos para
 * evitar resíduo de ponto flutuante, última parcela absorve o resto da divisão.
 */
function gerarParcelasProjecao(
  valorTotal: number, qtd: number, primeiraCompetencia: string, periodicidade: PeriodicidadeProjecao
): ParcelaProjecao[] {
  const totalCentavos = Math.round(valorTotal * 100)
  const baseCentavos = Math.floor(totalCentavos / qtd)
  const restoCentavos = totalCentavos - baseCentavos * qtd
  const passo = MESES_PERIODICIDADE_PROJECAO[periodicidade]
  const parcelas: ParcelaProjecao[] = []
  for (let i = 0; i < qtd; i++) {
    const numero = i + 1
    const centavos = numero === qtd ? baseCentavos + restoCentavos : baseCentavos
    const competencia = i === 0 ? primeiraCompetencia : somarMesesCompetencia(primeiraCompetencia, i * passo)
    parcelas.push({ numero, competencia, valor: (centavos / 100).toFixed(2) })
  }
  return parcelas
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
  categoria: string
  valor_aprovado: string
  status: StatusContrato
  observacao: string
}

function emptyContrato(): ContratoFormState {
  return { numero_contrato: '', contratado: '', tipo_contrato: 'SERVICO', natureza_financeira: '', descricao_servico: '', categoria: '', valor_aprovado: '', status: 'ATIVO', observacao: '' }
}

type TipoProjecao = 'NENHUMA' | 'PARCELADO'

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
          categoria: contrato.categoria ?? '',
          valor_aprovado: String(contrato.valor_aprovado),
          status: contrato.status,
          observacao: contrato.observacao ?? '',
        }
      : emptyContrato()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Projeção de pagamentos — só se aplica na criação (contrato existente não é alterado por isto)
  const [tipoProjecao, setTipoProjecao] = useState<TipoProjecao>('NENHUMA')
  const [qtdParcelasProjecao, setQtdParcelasProjecao] = useState('')
  const [periodicidadeProjecao, setPeriodicidadeProjecao] = useState<PeriodicidadeProjecao>('MENSAL')
  const [primeiraCompetenciaProjecao, setPrimeiraCompetenciaProjecao] = useState('')
  const [parcelasProjecao, setParcelasProjecao] = useState<ParcelaProjecao[]>([])

  function handleGerarParcelasProjecao() {
    const valor = parseFloat(form.valor_aprovado.replace(',', '.'))
    const qtd = parseInt(qtdParcelasProjecao, 10)
    if (isNaN(valor) || valor <= 0) { setError('Informe o Valor Aprovado antes de gerar as parcelas.'); return }
    if (!qtd || qtd <= 0) { setError('Informe a quantidade de parcelas.'); return }
    if (validarCompetencia(primeiraCompetenciaProjecao) || !primeiraCompetenciaProjecao.trim()) {
      setError('Informe o mês da 1ª parcela no formato MM/AAAA.'); return
    }
    setError('')
    setParcelasProjecao(gerarParcelasProjecao(valor, qtd, primeiraCompetenciaProjecao, periodicidadeProjecao))
  }

  function handleAtualizarParcelaProjecao(idx: number, campo: 'competencia' | 'valor', valor: string) {
    setParcelasProjecao(prev => prev.map((p, i) => i === idx ? { ...p, [campo]: valor } : p))
  }

  const somaParcelasProjecao = parcelasProjecao.reduce((s, p) => s + (parseFloat(p.valor.replace(',', '.')) || 0), 0)

  async function handleSalvar() {
    if (!form.natureza_financeira) { setError('Natureza Financeira é obrigatória (CAPEX ou OPEX).'); return }
    const valor = parseFloat(form.valor_aprovado.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setError('Valor aprovado inválido.'); return }
    if (!contrato && tipoProjecao === 'PARCELADO' && parcelasProjecao.length === 0) {
      setError('Gere ou informe as parcelas da projeção antes de salvar.'); return
    }

    setSaving(true); setError('')
    try {
      const url = contrato
        ? `/api/projetos/${projetoId}/financeiro/contratos/${contrato.id}`
        : `/api/projetos/${projetoId}/financeiro/contratos`
      const method = contrato ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = { ...form, valor_aprovado: valor }
      if (!contrato) {
        body.tipo_projecao = tipoProjecao
        if (tipoProjecao === 'PARCELADO') {
          body.parcelas_projecao = parcelasProjecao.map(p => ({
            numero: p.numero,
            competencia: p.competencia,
            valor_projetado: parseFloat(p.valor.replace(',', '.')) || 0,
          }))
        }
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro ao salvar.'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio shrink-0">
          <h3 className="card-title">{contrato ? 'Editar Contrato' : 'Novo Contrato'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
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
            <label className="input-label">Contratado</label>
            <input className="input" value={form.contratado} onChange={e => setForm(f => ({ ...f, contratado: e.target.value }))} placeholder="Nome do fornecedor / empresa" />
            <p className="text-xs text-megag-cinza-texto mt-1">Deixe em branco para o contrato aceitar lançamentos de qualquer fornecedor.</p>
          </div>
          <div>
            <label className="input-label">Categoria</label>
            <input className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex.: Aço e Cordoalha" />
            <p className="text-xs text-megag-cinza-texto mt-1">Usada para identificar automaticamente a qual contrato um lançamento pertence. Deixe em branco para não restringir por categoria.</p>
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

          {!contrato && (
            <div className="border-t border-megag-cinza-medio pt-4">
              <label className="input-label">Tipo de Projeção</label>
              <select
                className="input"
                value={tipoProjecao}
                onChange={e => setTipoProjecao(e.target.value as TipoProjecao)}
              >
                <option value="NENHUMA">Nenhuma</option>
                <option value="PARCELADO">Parcelado</option>
              </select>
              <p className="text-xs text-megag-cinza-texto mt-1">
                Projeção de quando/quanto está previsto pagar — não é um pagamento real. O pagamento efetivo continua sendo lançado normalmente em &quot;Lançar Pagamento&quot;.
              </p>

              {tipoProjecao === 'PARCELADO' && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="input-label">Quantidade de parcelas</label>
                      <input className="input" type="number" min="1" value={qtdParcelasProjecao}
                        onChange={e => setQtdParcelasProjecao(e.target.value)} placeholder="Ex.: 12" />
                    </div>
                    <div>
                      <label className="input-label">Mês da 1ª parcela</label>
                      <input className="input" value={primeiraCompetenciaProjecao}
                        onChange={e => setPrimeiraCompetenciaProjecao(maskCompetencia(e.target.value))}
                        placeholder="01/2027" maxLength={7} inputMode="numeric" />
                    </div>
                    <div>
                      <label className="input-label">Periodicidade</label>
                      <select className="input" value={periodicidadeProjecao}
                        onChange={e => setPeriodicidadeProjecao(e.target.value as PeriodicidadeProjecao)}>
                        <option value="MENSAL">Mensal</option>
                        <option value="BIMESTRAL">Bimestral</option>
                        <option value="TRIMESTRAL">Trimestral</option>
                        <option value="SEMESTRAL">Semestral</option>
                        <option value="ANUAL">Anual</option>
                      </select>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary text-xs" onClick={handleGerarParcelasProjecao}>
                    Gerar parcelas
                  </button>

                  {parcelasProjecao.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-megag-cinza-texto px-1">
                        <span>Parcela</span><span>Mês</span><span>Valor projetado (R$)</span>
                      </div>
                      {parcelasProjecao.map((p, idx) => (
                        <div key={p.numero} className="grid grid-cols-3 gap-2">
                          <span className="input flex items-center text-sm text-megag-cinza-texto">{p.numero}/{parcelasProjecao.length}</span>
                          <input className="input" value={p.competencia}
                            onChange={e => handleAtualizarParcelaProjecao(idx, 'competencia', maskCompetencia(e.target.value))}
                            maxLength={7} inputMode="numeric" />
                          <input className="input" type="number" step="0.01" value={p.valor}
                            onChange={e => handleAtualizarParcelaProjecao(idx, 'valor', e.target.value)} />
                        </div>
                      ))}
                      <p className={`text-xs ${Math.abs(somaParcelasProjecao - (parseFloat(form.valor_aprovado.replace(',', '.')) || 0)) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Soma da projeção: {moeda(somaParcelasProjecao)} — Valor aprovado: {moeda(parseFloat(form.valor_aprovado.replace(',', '.')) || 0)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6 pt-4 shrink-0 border-t border-megag-cinza-medio">
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
  fornecedor: string
  tipo_documento: TipoDocumentoFinanceiro
  nota_fiscal: string
  data_pagamento: string
  competencia: string
  valor_pago: string
  observacao: string
}

function emptyPagamento(contratadoInicial: string): PagamentoFormState {
  return { fornecedor: contratadoInicial, tipo_documento: 'NF', nota_fiscal: '', data_pagamento: '', competencia: '', valor_pago: '', observacao: '' }
}

interface PagamentoModalProps {
  projetoId: number
  contrato: FinanceiroContratoCompleto
  fornecedoresConhecidos: string[]
  onClose: () => void
  onSaved: () => void
}

function PagamentoModal({ projetoId, contrato, fornecedoresConhecidos, onClose, onSaved }: PagamentoModalProps) {
  const [form, setForm] = useState<PagamentoFormState>(() => emptyPagamento(contrato.contratado))
  const [valorPagoDisplay, setValorPagoDisplay] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleValorPagoChange(raw: string) {
    const { display, numero } = maskValorMonetario(raw)
    setValorPagoDisplay(display)
    setForm(f => ({ ...f, valor_pago: isNaN(numero) ? '' : numero.toFixed(2) }))
  }

  /** Ao saír do campo, completa a exibição com as duas casas decimais (ex.: "R$ 1.000" → "R$ 1.000,00"). */
  function handleValorPagoBlur() {
    if (!form.valor_pago) return
    const numero = parseFloat(form.valor_pago)
    if (isNaN(numero)) return
    setValorPagoDisplay(`R$ ${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }

  async function handleSalvar() {
    const valor = parseFloat(form.valor_pago.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setError('Valor pago deve ser maior que zero.'); return }

    const erroCompetencia = validarCompetencia(form.competencia)
    if (erroCompetencia) { setError(erroCompetencia); return }

    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('fornecedor', form.fornecedor)
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
          <div>
            <label className="input-label">Fornecedor</label>
            <input
              className="input"
              list="fornecedores-conhecidos-pagamento"
              value={form.fornecedor}
              onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
              placeholder="Fornecedor deste pagamento"
            />
            <datalist id="fornecedores-conhecidos-pagamento">
              {fornecedoresConhecidos.map(f => <option key={f} value={f} />)}
            </datalist>
          </div>
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
              <input className="input" type="text" inputMode="decimal" value={valorPagoDisplay} onChange={e => handleValorPagoChange(e.target.value)} onBlur={handleValorPagoBlur} placeholder="R$ 0,00" />
            </div>
            <div>
              <label className="input-label">Data de Pagamento</label>
              <input className="input" type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="input-label">Competência (MM/AAAA)</label>
            <input className="input" value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: maskCompetencia(e.target.value) }))} placeholder="07/2025" maxLength={7} inputMode="numeric" />
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

// ─── Modal Lançar NF (sem contrato pré-escolhido — roda o enquadramento) ──────

interface LancamentoFormState {
  fornecedor: string
  categoria: string
  tipo_documento: TipoDocumentoFinanceiro
  nota_fiscal: string
  data_pagamento: string
  competencia: string
  valor_pago: string
  observacao: string
}

function emptyLancamento(): LancamentoFormState {
  return { fornecedor: '', categoria: '', tipo_documento: 'NF', nota_fiscal: '', data_pagamento: '', competencia: '', valor_pago: '', observacao: '' }
}

interface ResultadoEnquadramento {
  status: 'AUTOMATICO' | 'AGUARDANDO_ANALISE' | 'SEM_CONTRATO' | 'MANUAL'
  contrato_id: number | null
}

interface LancamentoModalProps {
  projetoId: number
  onClose: () => void
  onSaved: (msg: { tipo: 'ok'; texto: string }) => void
}

function LancamentoModal({ projetoId, onClose, onSaved }: LancamentoModalProps) {
  const [form, setForm] = useState<LancamentoFormState>(emptyLancamento)
  const [valorPagoDisplay, setValorPagoDisplay] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleValorPagoChange(raw: string) {
    const { display, numero } = maskValorMonetario(raw)
    setValorPagoDisplay(display)
    setForm(f => ({ ...f, valor_pago: isNaN(numero) ? '' : numero.toFixed(2) }))
  }

  function handleValorPagoBlur() {
    if (!form.valor_pago) return
    const numero = parseFloat(form.valor_pago)
    if (isNaN(numero)) return
    setValorPagoDisplay(`R$ ${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }

  async function handleSalvar() {
    if (!form.fornecedor.trim()) { setError('Fornecedor é obrigatório.'); return }
    const valor = parseFloat(form.valor_pago.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setError('Valor pago deve ser maior que zero.'); return }
    const erroCompetencia = validarCompetencia(form.competencia)
    if (erroCompetencia) { setError(erroCompetencia); return }

    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/projetos/${projetoId}/financeiro/lancamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedor: form.fornecedor,
          categoria: form.categoria || null,
          tipo_documento: form.tipo_documento,
          nota_fiscal: form.nota_fiscal,
          data_pagamento: form.data_pagamento,
          competencia: form.competencia,
          valor_pago: valor,
          observacao: form.observacao,
        }),
      })
      const data: ResultadoEnquadramento & { error?: string } = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao lançar NF.'); return }

      const mensagens: Record<ResultadoEnquadramento['status'], string> = {
        AUTOMATICO:          `Lançamento vinculado automaticamente ao Contrato #${data.contrato_id}.`,
        MANUAL:              `Lançamento vinculado ao Contrato #${data.contrato_id}.`,
        AGUARDANDO_ANALISE:  'Contrato não definido — análise necessária. O lançamento aparece em "Aguardando análise" para seleção manual.',
        SEM_CONTRATO:        'Sem contrato compatível encontrado. O lançamento aparece em "Sem contrato" para vínculo manual.',
      }
      onSaved({ tipo: 'ok', texto: mensagens[data.status] })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio">
          <div>
            <h3 className="card-title">Lançar NF</h3>
            <p className="text-xs text-megag-cinza-texto mt-0.5">Sem contrato pré-escolhido — o sistema identifica o contrato compatível automaticamente.</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Fornecedor *</label>
              <input className="input" value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Ex.: COMEP" />
            </div>
            <div>
              <label className="input-label">Categoria</label>
              <input className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex.: Aço e Cordoalha" />
            </div>
          </div>
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
              <input className="input" type="text" inputMode="decimal" value={valorPagoDisplay} onChange={e => handleValorPagoChange(e.target.value)} onBlur={handleValorPagoBlur} placeholder="R$ 0,00" />
            </div>
            <div>
              <label className="input-label">Data de Pagamento</label>
              <input className="input" type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="input-label">Competência (MM/AAAA)</label>
            <input className="input" value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: maskCompetencia(e.target.value) }))} placeholder="07/2025" maxLength={7} inputMode="numeric" />
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea className="input resize-none" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={saving}>
            {saving ? 'Enquadrando…' : 'Lançar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de enquadramento manual (seleção/correção de contrato) ─────────────

interface EnquadramentoModalProps {
  projetoId: number
  pagamento: FinanceiroContratoPagamento
  contratos: FinanceiroContratoCompleto[]
  onClose: () => void
  onSaved: () => void
}

function EnquadramentoModal({ projetoId, pagamento, contratos, onClose, onSaved }: EnquadramentoModalProps) {
  const [contratoId, setContratoId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isAguardando = pagamento.enquadramento_status === 'AGUARDANDO_ANALISE'

  async function handleSalvar() {
    if (!contratoId) { setError('Selecione um contrato.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/projetos/${projetoId}/financeiro/pagamentos/${pagamento.id}/enquadramento`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contratoId }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro ao enquadrar.'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio shrink-0">
          <div>
            <h3 className="card-title">{isAguardando ? 'Selecionar contrato' : 'Vincular a um contrato'}</h3>
            <p className="text-xs text-megag-cinza-texto mt-0.5">
              {pagamento.fornecedor ?? '—'} · {moeda(pagamento.valor_pago)}{pagamento.nota_fiscal ? ` · NF ${pagamento.nota_fiscal}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {isAguardando && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded text-sm">
              Contrato não definido — análise necessária. {contratos.length} contrato(s) compatível(is) encontrado(s) na avaliação automática.
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {contratos.length === 0 ? (
            <p className="text-sm text-megag-cinza-texto">Nenhum contrato ativo disponível neste projeto.</p>
          ) : (
            <div className="space-y-2">
              {contratos.map(c => (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${contratoId === c.id ? 'border-megag-azul bg-blue-50' : 'border-megag-cinza-medio'}`}>
                  <input type="radio" name="contrato_enquadramento" checked={contratoId === c.id} onChange={() => setContratoId(c.id)} className="accent-megag-azul" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.contratado || 'Qualquer fornecedor'} {c.numero_contrato ? `— ${c.numero_contrato}` : ''}</p>
                    <p className="text-xs text-megag-cinza-texto">
                      {c.categoria ? `${c.categoria} · ` : ''}Saldo disponível: {moeda(c.saldo)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6 pt-4 shrink-0 border-t border-megag-cinza-medio">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={saving || contratos.length === 0}>
            {saving ? 'Vinculando…' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de histórico de enquadramento ──────────────────────────────────────

interface HistoricoModalProps {
  projetoId: number
  pagamento: FinanceiroContratoPagamento
  contratos: FinanceiroContratoCompleto[]
  onClose: () => void
}

function HistoricoModal({ projetoId, pagamento, contratos, onClose }: HistoricoModalProps) {
  const [historico, setHistorico] = useState<FinanceiroEnquadramentoHistorico[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/projetos/${projetoId}/financeiro/pagamentos/${pagamento.id}/enquadramento/historico`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setHistorico(data.historico ?? []))
      .catch(() => setErro('Erro ao carregar histórico.'))
  }, [projetoId, pagamento.id])

  function nomeContrato(id: number | null): string {
    if (id == null) return 'sem contrato'
    const c = contratos.find(c => c.id === id)
    return c ? `${c.contratado || 'Qualquer fornecedor'}${c.numero_contrato ? ` (${c.numero_contrato})` : ''}` : `Contrato #${id}`
  }

  const rotuloAcao: Record<FinanceiroEnquadramentoHistorico['tipo_acao'], string> = {
    AUTOMATICO: 'Enquadramento automático',
    MANUAL: 'Enquadramento manual',
    CORRECAO_MANUAL: 'Correção manual',
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio">
          <div>
            <h3 className="card-title">Histórico de enquadramento</h3>
            <p className="text-xs text-megag-cinza-texto mt-0.5">
              {pagamento.fornecedor ?? '—'} · {moeda(pagamento.valor_pago)}{pagamento.nota_fiscal ? ` · NF ${pagamento.nota_fiscal}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}
          {historico === null && !erro && <p className="text-sm text-megag-cinza-texto">Carregando…</p>}
          {historico?.length === 0 && <p className="text-sm text-megag-cinza-texto">Nenhum enquadramento registrado ainda.</p>}
          {historico?.map(h => (
            <div key={h.id} className="border border-megag-cinza-medio rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{rotuloAcao[h.tipo_acao]}</span>
                <span className="text-xs text-megag-cinza-texto">{new Date(h.created_at.replace(' ', 'T')).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-xs text-megag-cinza-texto mt-1">
                {nomeContrato(h.contrato_id_anterior)} → <span className="font-medium text-megag-preto">{nomeContrato(h.contrato_id_novo)}</span>
              </p>
              {h.regra_utilizada && <p className="text-xs text-megag-cinza-texto mt-0.5">Regra: {h.regra_utilizada}</p>}
              <p className="text-xs text-megag-cinza-texto mt-0.5">Por: {h.usuario_nome ?? '—'}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
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
  onVerHistorico: (p: FinanceiroContratoPagamento) => void
}

function CardContrato({ contrato: c, canEdit, onEditContrato, onNovoPagamento, onDeleteContrato, onDeletePagamento, onVerHistorico }: CardContratoProps) {
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
              <span className="font-semibold text-megag-preto text-sm">
                {c.contratado || <span className="italic text-megag-cinza-texto">Qualquer fornecedor</span>}
              </span>
              {c.numero_contrato && (
                <span className="badge text-xs">{c.numero_contrato}</span>
              )}
              {c.categoria && (
                <span className="badge text-xs" title="Categoria — usada no enquadramento automático">{c.categoria}</span>
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
                  <th>Data</th><th>Fornecedor</th><th>NF</th>
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
                      <td>{p.fornecedor ?? c.contratado ?? '—'}</td>
                      <td>{p.nota_fiscal ?? '—'}</td>
                      <td className="text-right font-medium">{moeda(p.valor_pago)}</td>
                      <td className="text-right">{moeda(acumulado)}</td>
                      <td className="text-right" style={{ color: saldoPag < 0 ? '#DC2626' : undefined }}>{moeda(saldoPag)}</td>
                      {canEdit && (
                        <td className="flex items-center gap-1">
                          <button className="btn-ghost p-0.5" title="Ver histórico de enquadramento" onClick={() => onVerHistorico(p)}>
                            <FileText size={12} />
                          </button>
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
  const [pendentes, setPendentes] = useState<FinanceiroContratoPagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalContrato, setModalContrato] = useState<'new' | FinanceiroContratoCompleto | null>(null)
  const [modalPagamento, setModalPagamento] = useState<FinanceiroContratoCompleto | null>(null)
  const [modalLancamento, setModalLancamento] = useState(false)
  const [modalEnquadramento, setModalEnquadramento] = useState<FinanceiroContratoPagamento | null>(null)
  const [modalHistorico, setModalHistorico] = useState<FinanceiroContratoPagamento | null>(null)
  const [enquadramentoMsg, setEnquadramentoMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [importando, setImportando] = useState(false)
  const [importMsg, setImportMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [filtroNatureza, setFiltroNatureza] = useState<NaturezaFinanceira | 'TODOS'>('TODOS')
  const [qtdVisivelContratos, setQtdVisivelContratos] = useState(8)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fornecedoresConhecidos = Array.from(new Set(contratos.map(c => c.contratado).filter(Boolean)))

  const carregar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/projetos/${projetoId}/financeiro/contratos`)
      if (!res.ok) throw new Error('Erro ao carregar dados financeiros.')
      const data = await res.json()
      setContratos(data.contratos ?? [])
      setResumo(data.resumo ?? null)
      setPendentes(data.pendentes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.')
    } finally { setLoading(false) }
  }, [projetoId])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setQtdVisivelContratos(8) }, [filtroNatureza])

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

  // Prioridade de execução: contratos ainda <100% primeiro, 100% depois — sort estável preserva
  // a ordem relativa dentro de cada grupo (não reordena nada além de separar os dois blocos).
  const contratosPriorizados = [...contratosFiltrados].sort(
    (a, b) => (a.percentual >= 100 ? 1 : 0) - (b.percentual >= 100 ? 1 : 0)
  )
  const contratosVisiveis = contratosPriorizados.slice(0, qtdVisivelContratos)

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
            <button className="btn-secondary flex items-center gap-2" onClick={() => setModalLancamento(true)} title="Lançar uma NF/pagamento sem escolher o contrato — o sistema identifica automaticamente">
              <Plus size={15} /> Lançar NF
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

      {/* ── Feedback enquadramento ── */}
      {enquadramentoMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${enquadramentoMsg.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {enquadramentoMsg.tipo === 'ok' ? <Check size={15} /> : <AlertTriangle size={15} />}
          <span className="flex-1">{enquadramentoMsg.texto}</span>
          <button onClick={() => setEnquadramentoMsg(null)}><X size={14} /></button>
        </div>
      )}

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
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contratosVisiveis.map(c => (
              <CardContrato
                key={c.id}
                contrato={c}
                canEdit={canEdit}
                onEditContrato={setModalContrato}
                onNovoPagamento={setModalPagamento}
                onDeleteContrato={handleDeleteContrato}
                onDeletePagamento={handleDeletePagamento}
                onVerHistorico={setModalHistorico}
              />
            ))}
          </div>
          {contratosPriorizados.length > 8 && (
            <div className="flex justify-center mt-3">
              {qtdVisivelContratos < contratosPriorizados.length ? (
                <button
                  type="button"
                  className="btn-ghost text-xs text-megag-azul"
                  onClick={() => setQtdVisivelContratos(contratosPriorizados.length)}
                >
                  Mostrar mais contratos ↓
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-ghost text-xs text-megag-azul"
                  onClick={() => setQtdVisivelContratos(8)}
                >
                  Mostrar menos ↑
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Enquadramento pendente ── */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          {(['AGUARDANDO_ANALISE', 'SEM_CONTRATO'] as const).map(status => {
            const lista = pendentes.filter(p => p.enquadramento_status === status)
            if (!lista.length) return null
            const isAguardando = status === 'AGUARDANDO_ANALISE'
            return (
              <div key={status} className="card">
                <div className="card-header flex items-center justify-between">
                  <span className="card-title flex items-center gap-2">
                    <AlertTriangle size={15} className={isAguardando ? 'text-amber-500' : 'text-red-500'} />
                    {isAguardando ? 'Aguardando análise' : 'Sem contrato'}
                    <span className="badge text-xs">{lista.length}</span>
                  </span>
                  <span className="text-xs text-megag-cinza-texto">
                    {isAguardando ? 'Contrato não definido — análise necessária' : 'Nenhum contrato compatível encontrado'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-megag text-xs w-full">
                    <thead>
                      <tr>
                        <th>Fornecedor</th><th>NF</th>
                        <th className="text-right">Valor</th>
                        {isAguardando && <th>Candidatos</th>}
                        {canEdit && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(p => (
                        <tr key={p.id}>
                          <td>{p.fornecedor ?? '—'}</td>
                          <td>{p.nota_fiscal ?? '—'}</td>
                          <td className="text-right font-medium">{moeda(p.valor_pago)}</td>
                          {isAguardando && (
                            <td>{p.contratos_candidatos?.length ?? 0} contrato(s)</td>
                          )}
                          {canEdit && (
                            <td className="flex items-center gap-2">
                              <button className="text-megag-azul hover:underline" onClick={() => setModalEnquadramento(p)}>
                                {isAguardando ? 'Selecionar contrato' : 'Vincular a um contrato'}
                              </button>
                              <button className="btn-ghost p-0.5" title="Ver histórico" onClick={() => setModalHistorico(p)}>
                                <FileText size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
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
          fornecedoresConhecidos={fornecedoresConhecidos}
          onClose={() => setModalPagamento(null)}
          onSaved={() => { setModalPagamento(null); carregar() }}
        />
      )}
      {modalLancamento && (
        <LancamentoModal
          projetoId={projetoId}
          onClose={() => setModalLancamento(false)}
          onSaved={msg => { setModalLancamento(false); setEnquadramentoMsg(msg); carregar() }}
        />
      )}
      {modalEnquadramento && (
        <EnquadramentoModal
          projetoId={projetoId}
          pagamento={modalEnquadramento}
          contratos={
            modalEnquadramento.enquadramento_status === 'AGUARDANDO_ANALISE'
              ? contratos.filter(c => modalEnquadramento.contratos_candidatos?.includes(c.id))
              : contratos
          }
          onClose={() => setModalEnquadramento(null)}
          onSaved={() => { setModalEnquadramento(null); setEnquadramentoMsg({ tipo: 'ok', texto: 'Lançamento vinculado ao contrato.' }); carregar() }}
        />
      )}
      {modalHistorico && (
        <HistoricoModal
          projetoId={projetoId}
          pagamento={modalHistorico}
          contratos={contratos}
          onClose={() => setModalHistorico(null)}
        />
      )}
    </div>
  )
}
