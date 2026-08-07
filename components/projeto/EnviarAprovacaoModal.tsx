'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, X, Search, Check } from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface EtapaInput {
  ordem: number
  usuario_id: number
  usuario_nome: string
  tipo: string  // codigo do TipoParticipacao
}

interface TipoParticipacao {
  id: number
  nome: string
  codigo: string
  ativo: number
}

interface WorkflowModelo {
  id: number
  nome: string
  descricao: string | null
  etapas: EtapaInput[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (etapas: EtapaInput[], modeloId?: number, novoModelo?: { nome: string }) => Promise<void>
  sessionUser: { id: number; nome: string }
  usuarios: { id: number; nome: string }[]
  submitting: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEtapaPMO(sessionUser: { id: number; nome: string }): EtapaInput {
  return { ordem: 1, usuario_id: sessionUser.id, usuario_nome: sessionUser.nome, tipo: 'CIENCIA' }
}

// ─── EtapaRow ────────────────────────────────────────────────────────────────

function EtapaRow({
  etapa, index, total, tipos, usuarios, onUpdate, onRemove, onMoveUp, onMoveDown, isFixed,
}: {
  etapa: EtapaInput
  index: number
  total: number
  tipos: TipoParticipacao[]
  usuarios: { id: number; nome: string }[]
  onUpdate: (e: EtapaInput) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFixed: boolean
}) {
  const [busca, setBusca] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtrados = usuarios.filter(u =>
    u.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${isFixed ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
      <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
        {etapa.ordem}
      </span>

      <div className="relative flex-1 min-w-0" ref={ref}>
        <div
          className="flex items-center gap-1 input py-1.5 cursor-pointer"
          onClick={() => !isFixed && setShowDrop(v => !v)}
        >
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            className="flex-1 outline-none bg-transparent text-sm min-w-0"
            value={isFixed ? etapa.usuario_nome : (showDrop ? busca : etapa.usuario_nome)}
            onChange={e => { setBusca(e.target.value); setShowDrop(true) }}
            onFocus={() => !isFixed && setShowDrop(true)}
            placeholder="Buscar usuário…"
            readOnly={isFixed}
          />
        </div>
        {showDrop && !isFixed && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
            {filtrados.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">Nenhum usuário encontrado</p>
            ) : filtrados.map(u => (
              <button
                key={u.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  onUpdate({ ...etapa, usuario_id: u.id, usuario_nome: u.nome })
                  setBusca('')
                  setShowDrop(false)
                }}
              >
                {etapa.usuario_id === u.id && <Check size={12} className="text-megag-azul shrink-0" />}
                <span>{u.nome}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <select
        className="input py-1.5 text-sm w-36 shrink-0"
        value={etapa.tipo}
        onChange={e => onUpdate({ ...etapa, tipo: e.target.value })}
        disabled={isFixed}
      >
        {tipos.filter(t => t.ativo).map(t => (
          <option key={t.codigo} value={t.codigo}>{t.nome}</option>
        ))}
      </select>

      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
          onClick={onMoveDown}
          disabled={isFixed || index === total - 1}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {!isFixed ? (
        <button className="text-red-400 hover:text-red-600 shrink-0" onClick={onRemove}>
          <X size={15} />
        </button>
      ) : (
        <div className="w-4 shrink-0" />
      )}
    </div>
  )
}

// ─── Modal principal ─────────────────────────────────────────────────────────

export default function EnviarAprovacaoModal({
  isOpen, onClose, onConfirm, sessionUser, usuarios, submitting,
}: Props) {
  type Passo = 'ESCOLHA' | 'MODELO_EXISTENTE' | 'MONTAR'
  const [passo, setPasso] = useState<Passo>('ESCOLHA')
  const [opcao, setOpcao] = useState<'EXISTENTE' | 'NOVO'>('NOVO')

  const [modelos, setModelos] = useState<WorkflowModelo[]>([])
  const [loadingModelos, setLoadingModelos] = useState(false)
  const [buscaModelo, setBuscaModelo] = useState('')
  const [modeloSelecionado, setModeloSelecionado] = useState<WorkflowModelo | null>(null)

  const [tipos, setTipos] = useState<TipoParticipacao[]>([
    { id: 1, nome: 'Aprovação', codigo: 'APROVACAO', ativo: 1 },
    { id: 2, nome: 'Ciência',   codigo: 'CIENCIA',   ativo: 1 },
  ])

  const [etapas, setEtapas] = useState<EtapaInput[]>([buildEtapaPMO(sessionUser)])
  const [gravarModelo, setGravarModelo] = useState(false)
  const [nomeModelo, setNomeModelo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setPasso('ESCOLHA')
    setOpcao('NOVO')
    setModeloSelecionado(null)
    setBuscaModelo('')
    setEtapas([buildEtapaPMO(sessionUser)])
    setGravarModelo(false)
    setNomeModelo('')
    setErro(null)

    fetch('/api/configuracoes/tipos-participacao')
      .then(r => r.json())
      .then((data: TipoParticipacao[]) => { if (Array.isArray(data)) setTipos(data.filter(t => t.ativo)) })
      .catch(() => {})

    setLoadingModelos(true)
    fetch('/api/workflow/modelos')
      .then(r => r.json())
      .then((data: WorkflowModelo[]) => { if (Array.isArray(data)) setModelos(data) })
      .catch(() => {})
      .finally(() => setLoadingModelos(false))
  }, [isOpen, sessionUser.id])

  function selecionarModelo(m: WorkflowModelo) {
    setModeloSelecionado(m)
    const base: EtapaInput[] = m.etapas.map((e, i) => ({ ...e, ordem: i + 1 }))
    const temPMO = base.length > 0 && base[0].usuario_id === sessionUser.id
    if (!temPMO) {
      setEtapas([buildEtapaPMO(sessionUser), ...base.map((e, i) => ({ ...e, ordem: i + 2 }))])
    } else {
      setEtapas(base)
    }
  }

  function addEtapa() {
    const tipoDefault = tipos.find(t => t.codigo === 'APROVACAO')?.codigo ?? 'APROVACAO'
    setEtapas(prev => [...prev, { ordem: prev.length + 1, usuario_id: 0, usuario_nome: '', tipo: tipoDefault }])
  }

  function updateEtapa(idx: number, updated: EtapaInput) {
    setEtapas(prev => prev.map((e, i) => i === idx ? { ...updated, ordem: i + 1 } : e))
  }

  function removeEtapa(idx: number) {
    setEtapas(prev => prev.filter((_, i) => i !== idx).map((e, i) => ({ ...e, ordem: i + 1 })))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setEtapas(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next.map((e, i) => ({ ...e, ordem: i + 1 }))
    })
  }

  function moveDown(idx: number) {
    setEtapas(prev => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next.map((e, i) => ({ ...e, ordem: i + 1 }))
    })
  }

  function validar(): string | null {
    if (etapas.length === 0) return 'Adicione pelo menos um participante.'
    for (const e of etapas) {
      if (!e.usuario_id) return 'Todos os participantes devem ser selecionados.'
      if (!e.tipo) return 'Todos os participantes devem ter um tipo.'
    }
    if (!etapas.some(e => e.tipo === 'APROVACAO'))
      return 'O Workflow deve ter pelo menos uma etapa de Aprovação.'
    if (gravarModelo && !nomeModelo.trim())
      return 'Informe um nome para o modelo.'
    return null
  }

  async function handleConfirmar() {
    const err = validar()
    if (err) { setErro(err); return }
    setErro(null)
    const modeloId = opcao === 'EXISTENTE' && modeloSelecionado && !gravarModelo
      ? modeloSelecionado.id
      : undefined
    const novoModeloPayload = gravarModelo ? { nome: nomeModelo.trim() } : undefined
    await onConfirm(etapas, modeloId, novoModeloPayload)
  }

  if (!isOpen) return null

  const modelosFiltrados = modelos.filter(m =>
    m.nome.toLowerCase().includes(buscaModelo.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-xl animate-fade-in max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Enviar para Aprovação</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {passo === 'ESCOLHA' && 'Selecione como deseja prosseguir'}
              {passo === 'MODELO_EXISTENTE' && 'Selecione um modelo de workflow'}
              {passo === 'MONTAR' && 'Configure os participantes'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Indicador de passo */}
        <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
          {(['ESCOLHA', opcao === 'EXISTENTE' ? 'MODELO_EXISTENTE' : null, 'MONTAR'] as (Passo | null)[])
            .filter(Boolean)
            .map((p, i, arr) => (
              <div key={p} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${passo === p ? 'text-white' : arr.indexOf(p) < arr.indexOf(passo) ? 'text-white' : 'bg-gray-200 text-gray-400'}`}
                  style={passo === p || arr.indexOf(p as Passo) < arr.indexOf(passo)
                    ? { backgroundColor: '#003087' } : {}}
                >
                  {i + 1}
                </div>
                {i < arr.length - 1 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Passo 1 — Escolha */}
          {passo === 'ESCOLHA' && (
            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${opcao === 'EXISTENTE' ? 'border-megag-azul bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="opcao"
                  value="EXISTENTE"
                  checked={opcao === 'EXISTENTE'}
                  onChange={() => setOpcao('EXISTENTE')}
                  className="mt-0.5 accent-megag-azul"
                />
                <div>
                  <p className="font-semibold text-sm text-gray-800">Utilizar Modelo Existente</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Selecione um modelo salvo. Você poderá visualizar e editar os participantes antes de enviar.
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${opcao === 'NOVO' ? 'border-megag-azul bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="opcao"
                  value="NOVO"
                  checked={opcao === 'NOVO'}
                  onChange={() => setOpcao('NOVO')}
                  className="mt-0.5 accent-megag-azul"
                />
                <div>
                  <p className="font-semibold text-sm text-gray-800">Criar Novo Modelo</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Monte o Workflow manualmente. Você poderá salvá-lo como modelo para reutilização futura.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Passo 2 — Selecionar modelo existente */}
          {passo === 'MODELO_EXISTENTE' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 w-full"
                  placeholder="Buscar modelo pelo nome…"
                  value={buscaModelo}
                  onChange={e => setBuscaModelo(e.target.value)}
                  autoFocus
                />
              </div>
              {loadingModelos ? (
                <p className="text-sm text-gray-400 text-center py-6">Carregando modelos…</p>
              ) : modelosFiltrados.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {modelos.length === 0 ? 'Nenhum modelo cadastrado ainda.' : 'Nenhum modelo encontrado.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {modelosFiltrados.map(m => (
                    <button
                      key={m.id}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all
                        ${modeloSelecionado?.id === m.id ? 'border-megag-azul bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      onClick={() => selecionarModelo(m)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-gray-800">{m.nome}</p>
                        {modeloSelecionado?.id === m.id && <Check size={14} className="text-megag-azul" />}
                      </div>
                      {m.descricao && <p className="text-xs text-gray-500 mt-0.5">{m.descricao}</p>}
                      <p className="text-xs text-gray-400 mt-1">{m.etapas.length} etapa(s)</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Passo 3 — Montar / editar participantes */}
          {passo === 'MONTAR' && (
            <div className="space-y-3">
              {modeloSelecionado && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700 border border-blue-100">
                  <Check size={14} className="shrink-0" />
                  <span>Baseado em: <strong>{modeloSelecionado.nome}</strong></span>
                  <span className="text-blue-400 text-xs">(edições não afetam o modelo original)</span>
                </div>
              )}

              <p className="text-xs text-gray-500">
                O usuário logado foi adicionado automaticamente como Ciência na posição 1.
              </p>

              <div className="space-y-2">
                {etapas.map((e, idx) => (
                  <EtapaRow
                    key={idx}
                    etapa={e}
                    index={idx}
                    total={etapas.length}
                    tipos={tipos}
                    usuarios={usuarios}
                    onUpdate={updated => updateEtapa(idx, updated)}
                    onRemove={() => removeEtapa(idx)}
                    onMoveUp={() => moveUp(idx)}
                    onMoveDown={() => moveDown(idx)}
                    isFixed={idx === 0 && e.usuario_id === sessionUser.id}
                  />
                ))}
              </div>

              <button className="btn-secondary text-sm w-full mt-1" onClick={addEtapa}>
                + Adicionar participante
              </button>

              <div className="border-t border-gray-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={gravarModelo}
                    onChange={e => setGravarModelo(e.target.checked)}
                    className="rounded accent-megag-azul"
                  />
                  <span className="text-sm text-gray-700">Gravar este modelo para reutilização futura</span>
                </label>
                {gravarModelo && (
                  <input
                    className="input mt-2 w-full"
                    placeholder="Nome do modelo…"
                    value={nomeModelo}
                    onChange={e => setNomeModelo(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          {passo === 'ESCOLHA' && (
            <>
              <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setErro(null)
                  if (opcao === 'EXISTENTE') setPasso('MODELO_EXISTENTE')
                  else { setEtapas([buildEtapaPMO(sessionUser)]); setPasso('MONTAR') }
                }}
              >
                Continuar
              </button>
            </>
          )}
          {passo === 'MODELO_EXISTENTE' && (
            <>
              <button className="btn-secondary flex-1" onClick={() => setPasso('ESCOLHA')}>Voltar</button>
              <button
                className="btn-primary flex-1"
                disabled={!modeloSelecionado}
                onClick={() => setPasso('MONTAR')}
              >
                {modeloSelecionado ? 'Visualizar / Editar' : 'Selecione um modelo'}
              </button>
            </>
          )}
          {passo === 'MONTAR' && (
            <>
              <button
                className="btn-secondary flex-1"
                onClick={() => setPasso(opcao === 'EXISTENTE' ? 'MODELO_EXISTENTE' : 'ESCOLHA')}
              >
                Voltar
              </button>
              <button className="btn-primary flex-1" onClick={handleConfirmar} disabled={submitting}>
                {submitting ? 'Enviando…' : 'Confirmar e Enviar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
