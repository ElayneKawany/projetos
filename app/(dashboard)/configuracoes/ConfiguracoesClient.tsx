'use client'

import { useState } from 'react'
import { Settings, Plus, CheckCircle, AlertCircle, ToggleLeft, ToggleRight, Star, Pencil, X } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface ConfigStatusItem {
  id: number; codigo: string; label: string; descricao: string | null
  cor: string; ordem: number; ativo: number; is_initial: number
}

interface TipoParticipacao {
  id: number; nome: string; codigo: string; descricao: string | null; ativo: number
}

interface ContaContabil {
  id: number; codigo: string; descricao: string; tipo: string; empresa: string | null
  filial: string | null; integracao_codigo: string | null; ativo: number
}

interface CentroCusto {
  id: number; codigo: string; descricao: string; empresa: string | null; filial: string | null; ativo: number
}

interface TipoTarefa {
  id: number; codigo: string; label: string; ordem: number; ativo: number; is_system: number
}

interface Criticidade {
  id: number; codigo: string; label: string; cor: string; ordem: number; ativo: number; is_system: number
}

interface MotivoPausaItem {
  id: number; nome: string; descricao: string | null; ordem: number; ativo: number
}

interface DiretoriaItem {
  id: number
  codigo: string
  nome: string
  sigla: string
  descricao: string | null
  ativo: number
  created_at: string
  updated_at: string | null
  projeto_count: number
  area_count: number
  usuario_count: number
  diretor_responsavel_id: number | null
  diretor_responsavel_nome: string | null
}

interface AreaConfigItem {
  id: number
  codigo: string
  nome: string
  sigla: string
  diretoria_id: number
  diretoria_nome: string
  descricao: string | null
  updated_at: string | null
  created_at: string
  ativo: number
  projeto_count: number
}

interface UsuarioItem {
  id: number
  cpf: string
  nome: string
  email: string
  cargo: string | null
  perfil_codigo: string
  perfil_id: number
  diretoria_nome: string | null
  diretoria_id: number | null
  area_nome: string | null
  area_id: number | null
  ativo: number
}

interface Props {
  diretorias: DiretoriaItem[]
  diretoresUsuarios: { id: number; nome: string }[]
  areas: AreaConfigItem[]
  usuarios: UsuarioItem[]
  configFinanceira: { id: number; chave: string; valor: string; descricao: string }[]
  configStatus: ConfigStatusItem[]
  tiposParticipacao: TipoParticipacao[]
  contasContabeis: ContaContabil[]
  centrosCusto: CentroCusto[]
  tiposTarefa: TipoTarefa[]
  criticidades: Criticidade[]
  responsavelPadraoImportacaoId: number | null
  motivosPausa: MotivoPausaItem[]
  session: SessionUser
}

const TABS = ['Usuários', 'Diretorias', 'Áreas', 'Status de Projetos', 'Premissas Financeiras', 'Tipos de Participação', 'Contas Contábeis', 'Centros de Custo', 'Tipos de Tarefa', 'Criticidades', 'Cronograma', 'Motivos de Pausa']

async function safeError(res: Response, fallback = 'Erro na operação.'): Promise<string> {
  try { return (await res.json()).error || fallback } catch { return fallback }
}

const CHAVE_LABELS: Record<string, string> = {
  selic: 'SELIC',
  taxa_desconto: 'Taxa de Desconto',
  inflacao: 'Inflação (IPCA)',
}

function PremissasFinanceiras({
  configFinanceira, podeAdmin, onSucesso, onErro
}: {
  configFinanceira: { id: number; chave: string; valor: string; descricao: string }[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [editando, setEditando] = useState<number | null>(null)
  const [valorEdit, setValorEdit] = useState('')
  const [loading, setLoading] = useState(false)
  const [valores, setValores] = useState(configFinanceira)

  function iniciarEdit(cfg: { id: number; valor: string }) {
    setEditando(cfg.id)
    setValorEdit(cfg.valor)
  }

  function cancelar() {
    setEditando(null)
    setValorEdit('')
  }

  async function salvar(chave: string) {
    const num = parseFloat(valorEdit.replace(',', '.'))
    if (isNaN(num) || num < 0 || num > 100) {
      onErro('Valor deve ser um número entre 0 e 100.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/financeiro', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, valor: String(num.toFixed(2)) }),
      })
      if (!res.ok) {
        const d = await res.json()
        onErro(d.error || 'Erro ao salvar.')
        return
      }
      setValores(prev => prev.map(c => c.chave === chave ? { ...c, valor: String(num.toFixed(2)) } : c))
      setEditando(null)
      onSucesso('Premissa atualizada com sucesso!')
    } catch {
      onErro('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 max-w-lg">
      <p className="text-xs text-megag-cinza-texto mb-2">
        Estas premissas são usadas nos cálculos de TIR e Payback de todos os projetos.
      </p>
      {valores.map(cfg => (
        <div key={cfg.id} className="card flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-megag-preto text-sm">
              {CHAVE_LABELS[cfg.chave] || cfg.chave.replace('_', ' ')}
            </p>
            {cfg.descricao && (
              <p className="text-xs text-megag-cinza-texto mt-0.5">{cfg.descricao}</p>
            )}
          </div>

          {editando === cfg.id ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={valorEdit}
                  onChange={e => setValorEdit(e.target.value)}
                  className="input w-28 text-right pr-7 py-1.5 text-sm font-bold"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') salvar(cfg.chave); if (e.key === 'Escape') cancelar() }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-megag-cinza-texto text-sm">%</span>
              </div>
              <button
                onClick={() => salvar(cfg.chave)}
                disabled={loading}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {loading ? '...' : 'Salvar'}
              </button>
              <button onClick={cancelar} className="btn-ghost text-xs py-1.5 px-2">
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-display text-megag-azul">{cfg.valor}%</span>
              {podeAdmin && (
                <button
                  onClick={() => iniciarEdit(cfg)}
                  className="btn-ghost text-xs py-1 px-2"
                >
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {valores.length === 0 && (
        <p className="text-megag-cinza-texto text-sm text-center py-4">
          Nenhuma premissa configurada. Execute o seed de dados iniciais.
        </p>
      )}
    </div>
  )
}

function StatusProjetosTab({
  configStatus: initialStatus, podeAdmin, onSucesso, onErro,
}: {
  configStatus: ConfigStatusItem[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState<ConfigStatusItem[]>(initialStatus)
  const [editando, setEditando] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ label: '', descricao: '' })
  const [showNovo, setShowNovo] = useState(false)
  const [novoForm, setNovoForm] = useState({ codigo: '', label: '', descricao: '' })
  const [loading, setLoading] = useState(false)

  async function toggleAtivo(item: ConfigStatusItem) {
    if (!podeAdmin) return
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, ativo: item.ativo ? 0 : 1 }),
      })
      if (!res.ok) { onErro('Erro ao atualizar status.'); return }
      const data = await res.json()
      setLista(prev => prev.map(s => s.id === item.id ? data.status : s))
      onSucesso(`Status "${item.label}" ${item.ativo ? 'desativado' : 'ativado'}.`)
    } finally { setLoading(false) }
  }

  async function setInicial(item: ConfigStatusItem) {
    if (!podeAdmin) return
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_initial: 1 }),
      })
      if (!res.ok) { onErro('Erro ao definir status inicial.'); return }
      setLista(prev => prev.map(s => ({ ...s, is_initial: s.id === item.id ? 1 : 0 })))
      onSucesso(`"${item.label}" definido como status inicial dos projetos.`)
    } finally { setLoading(false) }
  }

  function iniciarEdicao(item: ConfigStatusItem) {
    setEditando(item.id)
    setEditForm({ label: item.label, descricao: item.descricao ?? '' })
  }

  async function salvarEdicao(item: ConfigStatusItem) {
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, label: editForm.label, descricao: editForm.descricao }),
      })
      if (!res.ok) { onErro('Erro ao salvar.'); return }
      const data = await res.json()
      setLista(prev => prev.map(s => s.id === item.id ? data.status : s))
      setEditando(null)
      onSucesso('Status atualizado.')
    } finally { setLoading(false) }
  }

  async function criarNovo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoForm),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao criar status.'); return }
      setLista(prev => [...prev, data.status].sort((a, b) => a.ordem - b.ordem))
      setShowNovo(false)
      setNovoForm({ codigo: '', label: '', descricao: '' })
      onSucesso('Status criado com sucesso.')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-megag-cinza-texto">
          Configure os status disponíveis para os projetos. O status inicial é aplicado automaticamente ao criar um projeto.
        </p>
        {podeAdmin && (
          <button className="btn-primary text-sm" onClick={() => setShowNovo(true)}>
            <Plus size={15} /> Novo Status
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Código</th>
              <th>Label</th>
              <th>Descrição</th>
              <th>Inicial</th>
              <th>Situação</th>
              {podeAdmin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map(item => (
              <tr key={item.id} className={!item.ativo ? 'opacity-50' : ''}>
                <td className="text-xs text-megag-cinza-texto font-mono">{item.ordem}</td>
                <td>
                  <span className="badge bg-megag-azul/10 text-megag-azul text-xs font-mono">
                    {item.codigo}
                  </span>
                </td>
                <td>
                  {editando === item.id ? (
                    <input
                      value={editForm.label}
                      onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                      className="input text-sm py-1"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-sm text-megag-preto">{item.label}</span>
                  )}
                </td>
                <td className="max-w-[200px]">
                  {editando === item.id ? (
                    <input
                      value={editForm.descricao}
                      onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
                      className="input text-sm py-1"
                      placeholder="Descrição opcional"
                    />
                  ) : (
                    <span className="text-xs text-megag-cinza-texto">{item.descricao || '—'}</span>
                  )}
                </td>
                <td>
                  {item.is_initial ? (
                    <span className="badge bg-megag-dourado/20 text-megag-dourado text-xs flex items-center gap-1 w-fit">
                      <Star size={10} fill="currentColor" /> Inicial
                    </span>
                  ) : (
                    podeAdmin && item.ativo ? (
                      <button
                        onClick={() => setInicial(item)}
                        disabled={loading}
                        className="text-xs text-megag-cinza-texto hover:text-megag-azul underline"
                        title="Definir como status inicial"
                      >
                        Definir
                      </button>
                    ) : <span className="text-megag-cinza-texto text-xs">—</span>
                  )}
                </td>
                <td>
                  <span className={`badge text-xs ${item.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                {podeAdmin && (
                  <td>
                    <div className="flex items-center gap-1">
                      {editando === item.id ? (
                        <>
                          <button
                            onClick={() => salvarEdicao(item)}
                            disabled={loading || !editForm.label}
                            className="btn-primary text-xs py-1 px-2"
                          >
                            Salvar
                          </button>
                          <button onClick={() => setEditando(null)} className="btn-ghost text-xs py-1 px-2">
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => iniciarEdicao(item)}
                            className="btn-ghost text-xs py-1 px-2"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => toggleAtivo(item)}
                            disabled={loading || (item.is_initial === 1 && item.ativo === 1)}
                            className="btn-ghost text-xs py-1 px-2"
                            title={item.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {item.ativo
                              ? <ToggleRight size={16} className="text-green-600" />
                              : <ToggleLeft size={16} className="text-gray-400" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Novo Status */}
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNovo(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-megag-lg animate-fade-in">
            <h3 className="font-bold font-display text-lg text-megag-preto mb-4">Novo Status</h3>
            <form onSubmit={criarNovo} className="space-y-3">
              <div>
                <label className="input-label">Código *</label>
                <input
                  value={novoForm.codigo}
                  onChange={e => setNovoForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                  className="input font-mono"
                  placeholder="EX: MEU_STATUS"
                  required
                />
                <p className="text-xs text-megag-cinza-texto mt-1">Letras maiúsculas e underscores. Não pode ser alterado depois.</p>
              </div>
              <div>
                <label className="input-label">Label *</label>
                <input
                  value={novoForm.label}
                  onChange={e => setNovoForm(f => ({ ...f, label: e.target.value }))}
                  className="input"
                  placeholder="Nome exibido na plataforma"
                  required
                />
              </div>
              <div>
                <label className="input-label">Descrição</label>
                <input
                  value={novoForm.descricao}
                  onChange={e => setNovoForm(f => ({ ...f, descricao: e.target.value }))}
                  className="input"
                  placeholder="Descrição opcional"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowNovo(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TiposParticipacaoTab({
  initialTipos, podeAdmin, onSucesso, onErro,
}: {
  initialTipos: TipoParticipacao[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState<TipoParticipacao[]>(initialTipos)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', descricao: '' })
  const [showNovo, setShowNovo] = useState(false)
  const [novoForm, setNovoForm] = useState({ nome: '', codigo: '', descricao: '' })
  const [loading, setLoading] = useState(false)

  async function toggleAtivo(tipo: TipoParticipacao) {
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/tipos-participacao/${tipo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: tipo.ativo ? 0 : 1 }),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao atualizar.'); return }
      setLista(prev => prev.map(t => t.id === tipo.id ? { ...t, ativo: tipo.ativo ? 0 : 1 } : t))
      onSucesso(`Tipo "${tipo.nome}" ${tipo.ativo ? 'inativado' : 'ativado'}.`)
    } finally { setLoading(false) }
  }

  async function salvarEdicao(tipo: TipoParticipacao) {
    if (!editForm.nome.trim()) { onErro('Nome é obrigatório.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/tipos-participacao/${tipo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editForm.nome, descricao: editForm.descricao }),
      })
      if (!res.ok) { const d = await res.json(); onErro(d.error || 'Erro ao salvar.'); return }
      setLista(prev => prev.map(t => t.id === tipo.id ? { ...t, nome: editForm.nome, descricao: editForm.descricao || null } : t))
      setEditandoId(null)
      onSucesso('Tipo atualizado.')
    } finally { setLoading(false) }
  }

  async function criarTipo() {
    if (!novoForm.nome.trim() || !novoForm.codigo.trim()) { onErro('Nome e código são obrigatórios.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/tipos-participacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoForm),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao criar.'); return }
      setLista(prev => [...prev, { id: data.id, ...novoForm, codigo: novoForm.codigo.toUpperCase(), descricao: novoForm.descricao || null, ativo: 1 }])
      setNovoForm({ nome: '', codigo: '', descricao: '' })
      setShowNovo(false)
      onSucesso('Tipo de participação criado com sucesso!')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-megag-cinza-texto">
          Tipos utilizados nas etapas de Workflow de Aprovação dos documentos.
        </p>
        {podeAdmin && (
          <button className="btn-primary text-sm" onClick={() => setShowNovo(true)}>
            <Plus size={15} /> Novo Tipo
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Nome</th><th>Código</th><th>Descrição</th><th>Status</th>
              {podeAdmin && <th className="text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map(tipo => (
              <tr key={tipo.id}>
                {editandoId === tipo.id ? (
                  <>
                    <td>
                      <input
                        className="input text-sm py-1"
                        value={editForm.nome}
                        onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                        autoFocus
                      />
                    </td>
                    <td className="font-mono text-xs text-gray-400">{tipo.codigo}</td>
                    <td>
                      <input
                        className="input text-sm py-1"
                        value={editForm.descricao}
                        onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
                        placeholder="Descrição opcional"
                      />
                    </td>
                    <td></td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button className="btn-primary text-xs py-1 px-2" onClick={() => salvarEdicao(tipo)} disabled={loading}>
                          Salvar
                        </button>
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => setEditandoId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium text-sm">{tipo.nome}</td>
                    <td><span className="badge bg-megag-azul/10 text-megag-azul font-mono text-xs">{tipo.codigo}</span></td>
                    <td className="text-sm text-gray-500">{tipo.descricao || '—'}</td>
                    <td>
                      <span className={`badge ${tipo.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {tipo.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {podeAdmin && (
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            className="btn-ghost text-xs py-1 px-2"
                            onClick={() => { setEditandoId(tipo.id); setEditForm({ nome: tipo.nome, descricao: tipo.descricao ?? '' }) }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className={`btn-ghost text-xs py-1 px-2 ${tipo.ativo ? 'text-amber-600' : 'text-green-600'}`}
                            onClick={() => toggleAtivo(tipo)}
                            disabled={loading}
                          >
                            {tipo.ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal novo tipo */}
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNovo(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-megag-lg animate-fade-in">
            <h3 className="font-bold text-lg text-megag-preto mb-4">Novo Tipo de Participação</h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Nome *</label>
                <input
                  className="input"
                  value={novoForm.nome}
                  onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex.: Ratificação"
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Código *</label>
                <input
                  className="input font-mono"
                  value={novoForm.codigo}
                  onChange={e => setNovoForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                  placeholder="Ex.: RATIFICACAO"
                />
                <p className="text-xs text-gray-400 mt-1">Maiúsculas, sem espaços. Usado internamente pelo sistema.</p>
              </div>
              <div>
                <label className="input-label">Descrição</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={novoForm.descricao}
                  onChange={e => setNovoForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva o comportamento deste tipo…"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setShowNovo(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={criarTipo} disabled={loading}>
                {loading ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TIPO_CONTA_LABELS: Record<string, string> = {
  CAPEX_ATIVO: 'CAPEX — Aquisição de Ativo',
  CAPEX_RETORNO: 'CAPEX — Retorno Financeiro',
  OPEX: 'OPEX',
}

function ContasContabeisTab({
  initialContas, podeAdmin, onSucesso, onErro
}: {
  initialContas: ContaContabil[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [contas, setContas] = useState(initialContas)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ codigo: '', descricao: '', tipo: 'CAPEX_ATIVO', empresa: '', filial: '', integracao_codigo: '' })
  const [loading, setLoading] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/contas-contabeis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error ?? 'Erro ao criar conta.'); return }
      const res2 = await fetch('/api/configuracoes/contas-contabeis')
      const data2 = await res2.json()
      setContas(data2.contas ?? [])
      setShowForm(false)
      setForm({ codigo: '', descricao: '', tipo: 'CAPEX_ATIVO', empresa: '', filial: '', integracao_codigo: '' })
      onSucesso('Conta contábil criada com sucesso.')
    } finally { setLoading(false) }
  }

  async function toggleAtivo(id: number, ativo: number) {
    await fetch('/api/configuracoes/contas-contabeis', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ativo: ativo ? 0 : 1 }),
    })
    setContas(c => c.map(x => x.id === id ? { ...x, ativo: ativo ? 0 : 1 } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{contas.length} conta{contas.length !== 1 ? 's' : ''} cadastrada{contas.length !== 1 ? 's' : ''}</p>
        {podeAdmin && <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>+ Nova Conta</button>}
      </div>
      {showForm && (
        <form onSubmit={criar} className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Código *</label>
              <input className="input w-full" required value={form.codigo} onChange={e => setForm(f => ({...f, codigo: e.target.value}))} />
            </div>
            <div>
              <label className="input-label">Descrição *</label>
              <input className="input w-full" required value={form.descricao} onChange={e => setForm(f => ({...f, descricao: e.target.value}))} />
            </div>
            <div>
              <label className="input-label">Tipo</label>
              <select className="input w-full" value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}>
                {Object.entries(TIPO_CONTA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Código Integração (ERP)</label>
              <input className="input w-full" value={form.integracao_codigo} onChange={e => setForm(f => ({...f, integracao_codigo: e.target.value}))} placeholder="Consinco / SAP…" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-ghost text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary text-sm" disabled={loading}>{loading ? 'Salvando…' : 'Criar Conta'}</button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="table-megag w-full">
          <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Integração</th><th>Status</th>{podeAdmin && <th />}</tr></thead>
          <tbody>
            {contas.map(c => (
              <tr key={c.id}>
                <td className="font-mono text-sm">{c.codigo}</td>
                <td>{c.descricao}</td>
                <td className="text-xs">{TIPO_CONTA_LABELS[c.tipo] ?? c.tipo}</td>
                <td className="text-xs text-gray-500">{c.integracao_codigo ?? '—'}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                {podeAdmin && <td><button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => toggleAtivo(c.id, c.ativo)}>{c.ativo ? 'Desativar' : 'Ativar'}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CentrosCustoTab({
  initialCentros, podeAdmin, onSucesso, onErro
}: {
  initialCentros: CentroCusto[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [centros, setCentros] = useState(initialCentros)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ codigo: '', descricao: '', empresa: '', filial: '' })
  const [loading, setLoading] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/centros-custo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error ?? 'Erro ao criar centro de custo.'); return }
      const res2 = await fetch('/api/configuracoes/centros-custo')
      const data2 = await res2.json()
      setCentros(data2.centros ?? [])
      setShowForm(false)
      setForm({ codigo: '', descricao: '', empresa: '', filial: '' })
      onSucesso('Centro de custo criado com sucesso.')
    } finally { setLoading(false) }
  }

  async function toggleAtivo(id: number, ativo: number) {
    await fetch('/api/configuracoes/centros-custo', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ativo: ativo ? 0 : 1 }),
    })
    setCentros(c => c.map(x => x.id === id ? { ...x, ativo: ativo ? 0 : 1 } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{centros.length} centro{centros.length !== 1 ? 's' : ''} cadastrado{centros.length !== 1 ? 's' : ''}</p>
        {podeAdmin && <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>+ Novo Centro</button>}
      </div>
      {showForm && (
        <form onSubmit={criar} className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Código *</label>
              <input className="input w-full" required value={form.codigo} onChange={e => setForm(f => ({...f, codigo: e.target.value}))} />
            </div>
            <div>
              <label className="input-label">Descrição *</label>
              <input className="input w-full" required value={form.descricao} onChange={e => setForm(f => ({...f, descricao: e.target.value}))} />
            </div>
            <div>
              <label className="input-label">Empresa</label>
              <input className="input w-full" value={form.empresa} onChange={e => setForm(f => ({...f, empresa: e.target.value}))} />
            </div>
            <div>
              <label className="input-label">Filial</label>
              <input className="input w-full" value={form.filial} onChange={e => setForm(f => ({...f, filial: e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-ghost text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary text-sm" disabled={loading}>{loading ? 'Salvando…' : 'Criar Centro'}</button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="table-megag w-full">
          <thead><tr><th>Código</th><th>Descrição</th><th>Empresa</th><th>Filial</th><th>Status</th>{podeAdmin && <th />}</tr></thead>
          <tbody>
            {centros.map(c => (
              <tr key={c.id}>
                <td className="font-mono text-sm">{c.codigo}</td>
                <td>{c.descricao}</td>
                <td className="text-xs text-gray-500">{c.empresa ?? '—'}</td>
                <td className="text-xs text-gray-500">{c.filial ?? '—'}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                {podeAdmin && <td><button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => toggleAtivo(c.id, c.ativo)}>{c.ativo ? 'Desativar' : 'Ativar'}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tipos de Tarefa (Cronograma) ─────────────────────────────────────────────

function TiposTarefaTab({
  initialTipos, podeAdmin, onSucesso, onErro,
}: {
  initialTipos: TipoTarefa[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState<TipoTarefa[]>(initialTipos)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [showNovo, setShowNovo] = useState(false)
  const [novoForm, setNovoForm] = useState({ label: '', codigo: '' })
  const [loading, setLoading] = useState(false)

  async function toggleAtivo(tipo: TipoTarefa) {
    if (tipo.is_system) { onErro('Tipos padrão do sistema não podem ser desativados.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/tipos-tarefa/${tipo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: tipo.ativo ? 0 : 1 }),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao atualizar.'); return }
      setLista(prev => prev.map(t => t.id === tipo.id ? { ...t, ativo: tipo.ativo ? 0 : 1 } : t))
      onSucesso(`Tipo "${tipo.label}" ${tipo.ativo ? 'inativado' : 'ativado'}.`)
    } finally { setLoading(false) }
  }

  async function salvarEdicao(tipo: TipoTarefa) {
    if (!editLabel.trim()) { onErro('Label é obrigatório.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/tipos-tarefa/${tipo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel }),
      })
      if (!res.ok) { const d = await res.json(); onErro(d.error || 'Erro ao salvar.'); return }
      setLista(prev => prev.map(t => t.id === tipo.id ? { ...t, label: editLabel } : t))
      setEditandoId(null)
      onSucesso('Tipo atualizado.')
    } finally { setLoading(false) }
  }

  async function criarTipo() {
    if (!novoForm.label.trim() || !novoForm.codigo.trim()) { onErro('Label e código são obrigatórios.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/tipos-tarefa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoForm),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao criar.'); return }
      setLista(prev => [...prev, { id: data.id, label: novoForm.label, codigo: novoForm.codigo.toUpperCase(), ordem: lista.length + 1, ativo: 1, is_system: 0 }])
      setNovoForm({ label: '', codigo: '' })
      setShowNovo(false)
      onSucesso('Tipo de tarefa criado com sucesso!')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-megag-cinza-texto">
          Tipos utilizados nas tarefas do Cronograma. Tipos do sistema não podem ser desativados.
        </p>
        {podeAdmin && (
          <button className="btn-primary text-sm" onClick={() => setShowNovo(true)}>
            <Plus size={15} /> Novo Tipo
          </button>
        )}
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Ordem</th><th>Código</th><th>Label</th><th>Sistema</th><th>Status</th>
              {podeAdmin && <th className="text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map(tipo => (
              <tr key={tipo.id} className={!tipo.ativo ? 'opacity-50' : ''}>
                <td className="text-xs font-mono text-megag-cinza-texto">{tipo.ordem}</td>
                <td><span className="badge bg-megag-azul/10 text-megag-azul font-mono text-xs">{tipo.codigo}</span></td>
                <td>
                  {editandoId === tipo.id ? (
                    <input className="input text-sm py-1" value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus />
                  ) : (
                    <span className="font-medium text-sm">{tipo.label}</span>
                  )}
                </td>
                <td>
                  {tipo.is_system ? <span className="badge bg-blue-100 text-blue-700 text-xs">Sistema</span> : <span className="badge bg-gray-100 text-gray-500 text-xs">Custom</span>}
                </td>
                <td><span className={`badge ${tipo.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{tipo.ativo ? 'Ativo' : 'Inativo'}</span></td>
                {podeAdmin && (
                  <td className="text-right">
                    {editandoId === tipo.id ? (
                      <div className="flex gap-2 justify-end">
                        <button className="btn-primary text-xs py-1 px-2" onClick={() => salvarEdicao(tipo)} disabled={loading}>Salvar</button>
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => setEditandoId(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => { setEditandoId(tipo.id); setEditLabel(tipo.label) }}>
                          <Pencil size={13} />
                        </button>
                        {!tipo.is_system && (
                          <button className={`btn-ghost text-xs py-1 px-2 ${tipo.ativo ? 'text-amber-600' : 'text-green-600'}`} onClick={() => toggleAtivo(tipo)} disabled={loading}>
                            {tipo.ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNovo(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-megag-lg animate-fade-in">
            <h3 className="font-bold text-lg text-megag-preto mb-4">Novo Tipo de Tarefa</h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Label *</label>
                <input className="input" value={novoForm.label} onChange={e => setNovoForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex.: Teste de Carga" autoFocus />
              </div>
              <div>
                <label className="input-label">Código *</label>
                <input className="input font-mono" value={novoForm.codigo} onChange={e => setNovoForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} placeholder="Ex.: TESTE_CARGA" />
                <p className="text-xs text-gray-400 mt-1">Maiúsculas, sem espaços. Usado internamente pelo sistema.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setShowNovo(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={criarTipo} disabled={loading}>{loading ? 'Criando…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Criticidades (Cronograma) ────────────────────────────────────────────────

function CriticidadesTab({
  initialCriticidades, podeAdmin, onSucesso, onErro,
}: {
  initialCriticidades: Criticidade[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState<Criticidade[]>(initialCriticidades)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ label: '', cor: '' })
  const [showNovo, setShowNovo] = useState(false)
  const [novoForm, setNovoForm] = useState({ label: '', codigo: '', cor: '#6B7280' })
  const [loading, setLoading] = useState(false)

  async function toggleAtivo(crit: Criticidade) {
    if (crit.is_system) { onErro('Criticidades padrão do sistema não podem ser desativadas.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/criticidades/${crit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: crit.ativo ? 0 : 1 }),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao atualizar.'); return }
      setLista(prev => prev.map(c => c.id === crit.id ? { ...c, ativo: crit.ativo ? 0 : 1 } : c))
      onSucesso(`Criticidade "${crit.label}" ${crit.ativo ? 'inativada' : 'ativada'}.`)
    } finally { setLoading(false) }
  }

  async function salvarEdicao(crit: Criticidade) {
    if (!editForm.label.trim()) { onErro('Label é obrigatório.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/criticidades/${crit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editForm.label, cor: editForm.cor }),
      })
      if (!res.ok) { const d = await res.json(); onErro(d.error || 'Erro ao salvar.'); return }
      setLista(prev => prev.map(c => c.id === crit.id ? { ...c, label: editForm.label, cor: editForm.cor } : c))
      setEditandoId(null)
      onSucesso('Criticidade atualizada.')
    } finally { setLoading(false) }
  }

  async function criarCriticidade() {
    if (!novoForm.label.trim() || !novoForm.codigo.trim()) { onErro('Label e código são obrigatórios.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/criticidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoForm),
      })
      const data = await res.json()
      if (!res.ok) { onErro(data.error || 'Erro ao criar.'); return }
      setLista(prev => [...prev, { id: data.id, label: novoForm.label, codigo: novoForm.codigo.toUpperCase(), cor: novoForm.cor, ordem: lista.length + 1, ativo: 1, is_system: 0 }])
      setNovoForm({ label: '', codigo: '', cor: '#6B7280' })
      setShowNovo(false)
      onSucesso('Criticidade criada com sucesso!')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-megag-cinza-texto">
          Níveis de criticidade utilizados nas tarefas do Cronograma.
        </p>
        {podeAdmin && (
          <button className="btn-primary text-sm" onClick={() => setShowNovo(true)}>
            <Plus size={15} /> Nova Criticidade
          </button>
        )}
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Código</th><th>Label</th><th>Cor</th><th>Sistema</th><th>Status</th>
              {podeAdmin && <th className="text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map(crit => (
              <tr key={crit.id} className={!crit.ativo ? 'opacity-50' : ''}>
                <td><span className="badge bg-megag-azul/10 text-megag-azul font-mono text-xs">{crit.codigo}</span></td>
                <td>
                  {editandoId === crit.id ? (
                    <input className="input text-sm py-1" value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} autoFocus />
                  ) : (
                    <span className="font-medium text-sm">{crit.label}</span>
                  )}
                </td>
                <td>
                  {editandoId === crit.id ? (
                    <input type="color" className="h-8 w-14 rounded border cursor-pointer" value={editForm.cor} onChange={e => setEditForm(f => ({ ...f, cor: e.target.value }))} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 rounded-full border" style={{ backgroundColor: crit.cor }} />
                      <span className="text-xs font-mono text-gray-500">{crit.cor}</span>
                    </div>
                  )}
                </td>
                <td>
                  {crit.is_system ? <span className="badge bg-blue-100 text-blue-700 text-xs">Sistema</span> : <span className="badge bg-gray-100 text-gray-500 text-xs">Custom</span>}
                </td>
                <td><span className={`badge ${crit.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{crit.ativo ? 'Ativa' : 'Inativa'}</span></td>
                {podeAdmin && (
                  <td className="text-right">
                    {editandoId === crit.id ? (
                      <div className="flex gap-2 justify-end">
                        <button className="btn-primary text-xs py-1 px-2" onClick={() => salvarEdicao(crit)} disabled={loading}>Salvar</button>
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => setEditandoId(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => { setEditandoId(crit.id); setEditForm({ label: crit.label, cor: crit.cor }) }}>
                          <Pencil size={13} />
                        </button>
                        {!crit.is_system && (
                          <button className={`btn-ghost text-xs py-1 px-2 ${crit.ativo ? 'text-amber-600' : 'text-green-600'}`} onClick={() => toggleAtivo(crit)} disabled={loading}>
                            {crit.ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNovo(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-megag-lg animate-fade-in">
            <h3 className="font-bold text-lg text-megag-preto mb-4">Nova Criticidade</h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Label *</label>
                <input className="input" value={novoForm.label} onChange={e => setNovoForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex.: Urgente" autoFocus />
              </div>
              <div>
                <label className="input-label">Código *</label>
                <input className="input font-mono" value={novoForm.codigo} onChange={e => setNovoForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} placeholder="Ex.: URGENTE" />
              </div>
              <div>
                <label className="input-label">Cor</label>
                <div className="flex items-center gap-3">
                  <input type="color" className="h-10 w-14 rounded border cursor-pointer" value={novoForm.cor} onChange={e => setNovoForm(f => ({ ...f, cor: e.target.value }))} />
                  <span className="text-sm font-mono text-gray-600">{novoForm.cor}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setShowNovo(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={criarCriticidade} disabled={loading}>{loading ? 'Criando…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CronogramaConfigTab({
  usuarios, responsavelPadraoId, podeAdmin, onSucesso, onErro,
}: {
  usuarios: Props['usuarios']
  responsavelPadraoId: number | null
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [selecionado, setSelecionado] = useState<number | null>(responsavelPadraoId)
  const [loading, setLoading] = useState(false)

  async function salvar() {
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/cronograma', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: selecionado }),
      })
      if (!res.ok) {
        const d = await res.json()
        onErro(d.error || 'Erro ao salvar.')
        return
      }
      onSucesso('Responsável padrão atualizado com sucesso!')
    } catch {
      onErro('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  const usuariosAtivos = usuarios.filter(u => u.ativo)

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card">
        <p className="text-xs text-megag-cinza-texto mb-4">
          Quando uma planilha Excel não contém o nome do responsável de uma tarefa, este usuário será atribuído automaticamente. Se não configurado, a importação será cancelada e os responsáveis não encontrados serão listados.
        </p>
        <label className="input-label">Responsável padrão para importações de cronograma</label>
        <select
          value={selecionado ?? ''}
          onChange={e => setSelecionado(e.target.value ? Number(e.target.value) : null)}
          className="input mt-1"
          disabled={!podeAdmin}
        >
          <option value="">— Nenhum (cancelar importação se não encontrado) —</option>
          {usuariosAtivos.map(u => (
            <option key={u.id} value={u.id}>{u.nome} — {u.perfil_codigo}</option>
          ))}
        </select>
        {podeAdmin && (
          <button
            onClick={salvar}
            disabled={loading}
            className="btn-primary mt-3 text-sm"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>
    </div>
  )
}

function MotivosPausaTab({
  motivosPausa, podeAdmin, onSucesso, onErro,
}: {
  motivosPausa: MotivoPausaItem[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState(motivosPausa)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', ordem: '' })
  const [loading, setLoading] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = editId ? `/api/configuracoes/motivos-pausa/${editId}` : '/api/configuracoes/motivos-pausa'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: form.nome, descricao: form.descricao, ordem: form.ordem ? Number(form.ordem) : undefined }) })
      if (!res.ok) { onErro(await safeError(res, 'Erro ao salvar.')); return }
      onSucesso(editId ? 'Motivo atualizado.' : 'Motivo criado.')
      setShowForm(false); setEditId(null); setForm({ nome: '', descricao: '', ordem: '' })
      const r = await fetch('/api/configuracoes/motivos-pausa')
      if (r.ok) setLista((await r.json()).motivos)
    } finally { setLoading(false) }
  }

  async function toggleAtivo(id: number, ativo: number) {
    const res = await fetch(`/api/configuracoes/motivos-pausa/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: ativo === 1 ? 0 : 1 }) })
    if (res.ok) { const r = await fetch('/api/configuracoes/motivos-pausa'); if (r.ok) setLista((await r.json()).motivos) }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir este motivo?')) return
    const res = await fetch(`/api/configuracoes/motivos-pausa/${id}`, { method: 'DELETE' })
    if (!res.ok) { onErro(await safeError(res, 'Erro ao excluir.')); return }
    onSucesso('Motivo excluído.')
    setLista(l => l.filter(m => m.id !== id))
  }

  function iniciarEdicao(m: MotivoPausaItem) {
    setEditId(m.id); setForm({ nome: m.nome, descricao: m.descricao ?? '', ordem: String(m.ordem) }); setShowForm(true)
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Motivos de Pausa</h3>
        {podeAdmin && !showForm && (
          <button onClick={() => { setEditId(null); setForm({ nome: '', descricao: '', ordem: '' }); setShowForm(true) }} className="btn-primary text-sm flex items-center gap-1">
            <Plus size={14} /> Novo Motivo
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={salvar} className="p-4 border-b border-megag-cinza-claro space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="input-label">Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="input" required />
            </div>
            <div className="col-span-2">
              <label className="input-label">Descrição</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="input-label">Ordem</label>
              <input type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))} className="input" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary text-sm">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary text-sm">{loading ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      )}

      <div className="divide-y divide-megag-cinza-claro">
        {lista.length === 0 && <p className="p-4 text-sm text-megag-cinza">Nenhum motivo cadastrado.</p>}
        {lista.map(m => (
          <div key={m.id} className="flex items-center justify-between p-4 hover:bg-megag-cinza-claro/30">
            <div>
              <p className={`font-medium text-sm ${m.ativo === 0 ? 'text-megag-cinza line-through' : 'text-megag-preto'}`}>{m.nome}</p>
              {m.descricao && <p className="text-xs text-megag-cinza mt-0.5">{m.descricao}</p>}
            </div>
            {podeAdmin && (
              <div className="flex items-center gap-2">
                <button onClick={() => iniciarEdicao(m)} className="btn-ghost text-xs p-1"><Pencil size={13} /></button>
                <button onClick={() => toggleAtivo(m.id, m.ativo)} className="btn-ghost text-xs p-1" title={m.ativo ? 'Desativar' : 'Ativar'}>
                  {m.ativo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-megag-cinza" />}
                </button>
                <button onClick={() => excluir(m.id)} className="btn-ghost text-xs p-1 text-red-500"><X size={13} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function UsuariosTab({
  initialUsuarios, diretorias, areas, podeAdmin, onSucesso, onErro,
}: {
  initialUsuarios: UsuarioItem[]
  diretorias: DiretoriaItem[]
  areas: AreaConfigItem[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState(initialUsuarios)
  const [busca, setBusca] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [filtroDiretoria, setFiltroDiretoria] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [confirmExcluirId, setConfirmExcluirId] = useState<number | null>(null)
  const [podeInativar, setPodeInativar] = useState(false)
  const [projetosVinculados, setProjetosVinculados] = useState<{ id: number; codigo: string; nome: string; diretoria_nome: string | null; status: string; papeis: string[] }[]>([])
  const [form, setForm] = useState({ nome: '', cpf: '', email: '', cargo: '', perfil_id: '2', diretoria_id: '', area_id: '', ativo: 1, senha: '' })
  const [loading, setLoading] = useState(false)

  // Valores distintos para os dropdowns (derivados da lista real)
  const cargosDistinct = [...new Set(lista.map(u => u.cargo).filter(Boolean))].sort() as string[]
  const perfisDistinct = [...new Set(lista.map(u => u.perfil_codigo).filter(Boolean))].sort() as string[]
  const diretoriasDistinct = [...new Set(lista.map(u => u.diretoria_nome).filter(Boolean))].sort() as string[]

  const filtrados = lista
    .filter(u => {
      if (busca && !u.nome.toLowerCase().includes(busca.toLowerCase()) && !u.email.toLowerCase().includes(busca.toLowerCase())) return false
      if (filtroCargo && u.cargo !== filtroCargo) return false
      if (filtroPerfil && u.perfil_codigo !== filtroPerfil) return false
      if (filtroDiretoria && u.diretoria_nome !== filtroDiretoria) return false
      return true
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  function abrirNovo() {
    setEditId(null)
    setForm({ nome: '', cpf: '', email: '', cargo: '', perfil_id: '2', diretoria_id: '', area_id: '', ativo: 1, senha: '' })
    setShowModal(true)
  }

  function abrirEdicao(u: UsuarioItem) {
    setEditId(u.id)
    setForm({
      nome: u.nome,
      cpf: u.cpf ?? '',
      email: u.email,
      cargo: u.cargo ?? '',
      perfil_id: String(u.perfil_id),
      diretoria_id: u.diretoria_id ? String(u.diretoria_id) : '',
      area_id: u.area_id ? String(u.area_id) : '',
      ativo: u.ativo,
      senha: '',
    })
    setShowModal(true)
  }

  async function recarregar() {
    const r = await fetch('/api/usuarios?all=1')
    if (r.ok) setLista((await r.json()).usuarios ?? [])
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = editId ? `/api/usuarios/${editId}` : '/api/usuarios'
      const method = editId ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = {
        nome: form.nome,
        cpf: form.cpf,
        email: form.email,
        cargo: form.cargo || null,
        perfil_id: Number(form.perfil_id),
        diretoria_id: form.diretoria_id ? Number(form.diretoria_id) : null,
        area_id: form.area_id ? Number(form.area_id) : null,
        ativo: form.ativo,
      }
      if (!editId) { body.senha = form.senha }
      else if (form.senha) body.senha = form.senha
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { onErro(await safeError(res, 'Erro ao salvar.')); return }
      onSucesso(editId ? 'Usuário atualizado.' : 'Usuário criado.')
      setShowModal(false)
      await recarregar()
    } finally { setLoading(false) }
  }

  async function confirmarExclusao() {
    if (!confirmExcluirId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/usuarios/${confirmExcluirId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        if (data.pode_inativar) {
          setPodeInativar(true)
          onErro(data.error)
          // Fetch linked projects to display in modal
          try {
            const r = await fetch(`/api/usuarios/${confirmExcluirId}/projetos-vinculados`)
            if (r.ok) setProjetosVinculados((await r.json()).projetos ?? [])
          } catch { /* ignore */ }
        } else {
          onErro(data.error || 'Erro ao excluir.')
          setConfirmExcluirId(null)
        }
        return
      }
      onSucesso('Usuário excluído.')
      setConfirmExcluirId(null)
      setPodeInativar(false)
      setProjetosVinculados([])
      await recarregar()
    } finally { setLoading(false) }
  }

  async function inativarUsuario() {
    if (!confirmExcluirId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/usuarios/${confirmExcluirId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: 0 }),
      })
      if (!res.ok) { onErro(await safeError(res, 'Erro ao inativar.')); return }
      onSucesso('Usuário inativado.')
      setConfirmExcluirId(null)
      setPodeInativar(false)
      setProjetosVinculados([])
      await recarregar()
    } finally { setLoading(false) }
  }

  const nomeUsuExcluir = lista.find(u => u.id === confirmExcluirId)?.nome ?? ''
  const areasFiltradas = form.diretoria_id
    ? areas.filter(a => String(a.diretoria_id) === form.diretoria_id && a.ativo)
    : areas.filter(a => a.ativo)

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Usuários</h3>
        {podeAdmin && (
          <button onClick={abrirNovo} className="btn-primary text-sm flex items-center gap-1">
            <Plus size={14} /> Novo Usuário
          </button>
        )}
      </div>

      <div className="px-4 pb-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Pesquisar por nome ou e-mail…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input py-2 text-sm w-full max-w-xs"
          />
          <select
            value={filtroCargo}
            onChange={e => setFiltroCargo(e.target.value)}
            className="input py-2 text-sm"
          >
            <option value="">Todos os cargos</option>
            {cargosDistinct.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filtroPerfil}
            onChange={e => setFiltroPerfil(e.target.value)}
            className="input py-2 text-sm"
          >
            <option value="">Todos os perfis</option>
            {perfisDistinct.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filtroDiretoria}
            onChange={e => setFiltroDiretoria(e.target.value)}
            className="input py-2 text-sm"
          >
            <option value="">Todas as diretorias</option>
            {diretoriasDistinct.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {(filtroCargo || filtroPerfil || filtroDiretoria) && (
            <button
              onClick={() => { setFiltroCargo(''); setFiltroPerfil(''); setFiltroDiretoria('') }}
              className="text-xs px-2.5 py-2 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
            >
              ✕ Limpar filtros
            </button>
          )}
        </div>
        {(filtroCargo || filtroPerfil || filtroDiretoria) && (
          <p className="text-xs text-gray-400">{filtrados.length} usuário{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>E-mail</th>
              <th>Cargo</th>
              <th>Perfil</th>
              <th>Diretoria</th>
              <th>Área</th>
              <th>Status</th>
              {podeAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={podeAdmin ? 9 : 8} className="text-center py-8 text-megag-cinza-texto text-sm">Nenhum usuário encontrado.</td></tr>
            )}
            {filtrados.map(u => (
              <tr key={u.id} className={!u.ativo ? 'opacity-60' : ''}>
                <td className="font-medium text-sm">{u.nome}</td>
                <td className="font-mono text-xs">{u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
                <td className="text-sm">{u.email}</td>
                <td className="text-sm">{u.cargo || '—'}</td>
                <td><span className="badge bg-megag-azul/10 text-megag-azul text-xs">{u.perfil_codigo}</span></td>
                <td className="text-sm">{u.diretoria_nome || '—'}</td>
                <td className="text-sm">{u.area_nome || '—'}</td>
                <td><span className={`badge ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                {podeAdmin && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => abrirEdicao(u)} className="btn-ghost text-xs p-1" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { setConfirmExcluirId(u.id); setPodeInativar(false) }}
                        className="btn-ghost text-xs p-1 text-red-500"
                        title="Excluir"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal cadastro / edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-megag-cinza-claro">
              <h2 className="font-semibold text-megag-preto">{editId ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="input-label">Nome completo *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="input" required autoFocus />
                </div>
                <div>
                  <label className="input-label">CPF {!editId && '*'}</label>
                  <input
                    value={form.cpf}
                    onChange={e => setForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '') }))}
                    className="input"
                    placeholder="00000000000"
                    maxLength={11}
                    required={!editId}
                  />
                </div>
                <div>
                  <label className="input-label">E-mail *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="input-label">Cargo</label>
                  <input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="input-label">Perfil *</label>
                  <select value={form.perfil_id} onChange={e => setForm(f => ({ ...f, perfil_id: e.target.value }))} className="input" required>
                    <option value="1">Administrador</option>
                    <option value="2">PMO</option>
                    <option value="3">Diretor</option>
                    <option value="4">Gestor</option>
                    <option value="5">Solicitante</option>
                    <option value="6">CEO</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Diretoria</label>
                  <select value={form.diretoria_id} onChange={e => setForm(f => ({ ...f, diretoria_id: e.target.value, area_id: '' }))} className="input">
                    <option value="">Selecionar…</option>
                    {diretorias.filter(d => d.ativo).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Área</label>
                  <select value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} className="input">
                    <option value="">Selecionar…</option>
                    {areasFiltradas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Status</label>
                  <select value={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: Number(e.target.value) }))} className="input">
                    <option value={1}>Ativo</option>
                    <option value={0}>Inativo</option>
                  </select>
                </div>
                <div className={editId ? '' : 'col-span-2'}>
                  <label className="input-label">{editId ? 'Nova senha (deixe em branco para não alterar)' : 'Senha inicial *'}</label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                    className="input"
                    placeholder="Mínimo 8 caracteres"
                    minLength={editId ? undefined : 8}
                    required={!editId}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-sm">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary text-sm">
                  {loading ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação exclusão */}
      {confirmExcluirId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="font-semibold text-megag-preto">Excluir Usuário</h2>
            <p className="text-sm text-megag-cinza-texto">
              Tem certeza que deseja excluir o usuário <strong className="text-megag-preto">{nomeUsuExcluir}</strong>?
            </p>
            {podeInativar && (
              <>
                <p className="text-sm text-amber-700 font-medium">
                  Este usuário possui vínculos com projetos ou registros do sistema e não pode ser excluído. Você pode apenas inativá-lo.
                </p>
                <div>
                  <p className="text-xs font-semibold text-megag-azul uppercase tracking-wide mb-2">Projetos Vinculados</p>
                  {projetosVinculados.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhum projeto vinculado.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                      {projetosVinculados.map(proj => (
                        <a
                          key={proj.id}
                          href={`/projetos/${proj.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-3 py-2.5 hover:bg-blue-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-megag-azul">
                            {proj.codigo} — {proj.nome}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {proj.diretoria_nome ?? 'Sem diretoria'}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="text-xs text-gray-600">Status: <span className="font-medium">{proj.status}</span></span>
                            {proj.papeis.map(p => (
                              <span key={p} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                {p}
                              </span>
                            ))}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end flex-wrap">
              <button onClick={() => { setConfirmExcluirId(null); setPodeInativar(false); setProjetosVinculados([]) }} className="btn-secondary text-sm">Cancelar</button>
              {podeInativar ? (
                <button onClick={inativarUsuario} disabled={loading} className="btn-primary text-sm bg-amber-600 hover:bg-amber-700">
                  {loading ? 'Inativando…' : 'Inativar'}
                </button>
              ) : (
                <button onClick={confirmarExclusao} disabled={loading} className="btn-primary text-sm bg-red-600 hover:bg-red-700">
                  {loading ? 'Excluindo…' : 'Excluir'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AreasTab({
  initialAreas, diretorias, podeAdmin, onSucesso, onErro,
}: {
  initialAreas: AreaConfigItem[]
  diretorias: DiretoriaItem[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState(initialAreas)
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [confirmExcluirId, setConfirmExcluirId] = useState<number | null>(null)
  const [podeInativar, setPodeInativar] = useState(false)
  const [form, setForm] = useState({ nome: '', sigla: '', diretoria_id: '', descricao: '', ativo: 1 })
  const [loading, setLoading] = useState(false)

  const filtradas = lista
    .filter(a => !busca || a.nome.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  async function recarregar() {
    const r = await fetch('/api/configuracoes/areas')
    if (r.ok) setLista((await r.json()).areas ?? [])
  }

  function abrirNova() {
    setEditId(null)
    setForm({ nome: '', sigla: '', diretoria_id: '', descricao: '', ativo: 1 })
    setShowModal(true)
  }

  function abrirEdicao(a: AreaConfigItem) {
    setEditId(a.id)
    setForm({ nome: a.nome, sigla: a.sigla ?? '', diretoria_id: String(a.diretoria_id), descricao: a.descricao ?? '', ativo: a.ativo })
    setShowModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.diretoria_id) { onErro('Diretoria é obrigatória.'); return }
    setLoading(true)
    try {
      const url = editId ? `/api/configuracoes/areas/${editId}` : '/api/configuracoes/areas'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, sigla: form.sigla || undefined, diretoria_id: Number(form.diretoria_id), descricao: form.descricao || null, ativo: form.ativo }),
      })
      if (!res.ok) { onErro(await safeError(res, 'Erro ao salvar.')); return }
      onSucesso(editId ? 'Área atualizada.' : 'Área criada.')
      setShowModal(false)
      await recarregar()
    } finally { setLoading(false) }
  }

  async function confirmarExclusao() {
    if (!confirmExcluirId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/areas/${confirmExcluirId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        if (data.pode_inativar) {
          setPodeInativar(true)
          onErro(data.error)
        } else {
          onErro(data.error || 'Erro ao excluir.')
          setConfirmExcluirId(null)
        }
        return
      }
      onSucesso('Área excluída.')
      setConfirmExcluirId(null)
      setPodeInativar(false)
      await recarregar()
    } finally { setLoading(false) }
  }

  async function inativarArea() {
    if (!confirmExcluirId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracoes/areas/${confirmExcluirId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: 0 }),
      })
      if (!res.ok) { onErro(await safeError(res, 'Erro ao inativar.')); return }
      onSucesso('Área inativada.')
      setConfirmExcluirId(null)
      setPodeInativar(false)
      await recarregar()
    } finally { setLoading(false) }
  }

  const nomeAreaExcluir = lista.find(a => a.id === confirmExcluirId)?.nome ?? ''

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Áreas</h3>
        {podeAdmin && (
          <button onClick={abrirNova} className="btn-primary text-sm flex items-center gap-1">
            <Plus size={14} /> Nova Área
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <input
          type="text"
          placeholder="Pesquisar por nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input py-2 text-sm w-full max-w-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Diretoria</th>
              <th>Descrição</th>
              <th>Status</th>
              <th>Projetos</th>
              <th>Última alteração</th>
              {podeAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={podeAdmin ? 7 : 6} className="text-center py-8 text-megag-cinza-texto text-sm">Nenhuma área encontrada.</td></tr>
            )}
            {filtradas.map(a => (
              <tr key={a.id}>
                <td className="font-medium text-sm">{a.nome}</td>
                <td className="text-sm">{a.diretoria_nome}</td>
                <td className="text-sm text-megag-cinza-texto">{a.descricao || '—'}</td>
                <td>
                  <span className={`badge ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="text-sm text-center">{a.projeto_count}</td>
                <td className="text-xs text-megag-cinza-texto">
                  {a.updated_at ? new Date(a.updated_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                {podeAdmin && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => abrirEdicao(a)} className="btn-ghost text-xs p-1" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { setConfirmExcluirId(a.id); setPodeInativar(false) }}
                        className="btn-ghost text-xs p-1 text-red-500"
                        title="Excluir"
                        disabled={a.projeto_count > 0}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal cadastro / edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-megag-cinza-claro">
              <h2 className="font-semibold text-megag-preto">{editId ? 'Editar Área' : 'Nova Área'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <div>
                <label className="input-label">Nome *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="input"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Diretoria *</label>
                <select
                  value={form.diretoria_id}
                  onChange={e => setForm(f => ({ ...f, diretoria_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Selecionar…</option>
                  {diretorias.filter(d => d.ativo).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Sigla</label>
                <input
                  value={form.sigla}
                  onChange={e => setForm(f => ({ ...f, sigla: e.target.value }))}
                  className="input"
                  placeholder="Ex.: TI"
                />
              </div>
              <div>
                <label className="input-label">Descrição</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="input"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="input-label">Status</label>
                <select value={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: Number(e.target.value) }))} className="input">
                  <option value={1}>Ativa</option>
                  <option value={0}>Inativa</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-sm">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary text-sm">
                  {loading ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação exclusão */}
      {confirmExcluirId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="font-semibold text-megag-preto">Excluir Área</h2>
            <p className="text-sm text-megag-cinza-texto">
              Tem certeza que deseja excluir a área <strong className="text-megag-preto">{nomeAreaExcluir}</strong>?
              {podeInativar && (
                <span className="block mt-2 text-amber-700 font-medium">
                  Existem registros vinculados a esta área. A exclusão não é permitida. Você pode apenas inativá-la.
                </span>
              )}
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button onClick={() => { setConfirmExcluirId(null); setPodeInativar(false) }} className="btn-secondary text-sm">Cancelar</button>
              {podeInativar ? (
                <button onClick={inativarArea} disabled={loading} className="btn-primary text-sm bg-amber-600 hover:bg-amber-700">
                  {loading ? 'Inativando…' : 'Inativar'}
                </button>
              ) : (
                <button onClick={confirmarExclusao} disabled={loading} className="btn-primary text-sm bg-red-600 hover:bg-red-700">
                  {loading ? 'Excluindo…' : 'Excluir'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DiretoriasTab({
  initialDiretorias, diretoresUsuarios, podeAdmin, onSucesso, onErro,
}: {
  initialDiretorias: DiretoriaItem[]
  diretoresUsuarios: { id: number; nome: string }[]
  podeAdmin: boolean
  onSucesso: (msg: string) => void
  onErro: (msg: string) => void
}) {
  const [lista, setLista] = useState(initialDiretorias)
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [confirmExcluirId, setConfirmExcluirId] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', ativo: 1, diretor_responsavel_id: '' })
  const [loading, setLoading] = useState(false)

  const filtradas = lista
    .filter(d => !busca || d.nome.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  async function recarregar() {
    const r = await fetch('/api/configuracoes/diretorias')
    if (r.ok) setLista((await r.json()).diretorias)
  }

  function abrirNova() {
    setEditId(null)
    setForm({ nome: '', descricao: '', ativo: 1, diretor_responsavel_id: '' })
    setShowModal(true)
  }

  function abrirEdicao(d: DiretoriaItem) {
    setEditId(d.id)
    setForm({
      nome: d.nome,
      descricao: d.descricao ?? '',
      ativo: d.ativo,
      diretor_responsavel_id: d.diretor_responsavel_id ? String(d.diretor_responsavel_id) : '',
    })
    setShowModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = editId ? `/api/configuracoes/diretorias/${editId}` : '/api/configuracoes/diretorias'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          descricao: form.descricao || null,
          ativo: form.ativo,
          diretor_responsavel_id: form.diretor_responsavel_id ? Number(form.diretor_responsavel_id) : null,
        }),
      })
      if (!res.ok) { onErro(await safeError(res, 'Erro ao salvar.')); return }
      onSucesso(editId ? 'Diretoria atualizada.' : 'Diretoria criada.')
      setShowModal(false)
      await recarregar()
    } finally { setLoading(false) }
  }

  async function confirmarExclusao() {
    if (!confirmExcluirId) return
    setLoading(true)
    try {
      console.log('[Diretorias] DELETE payload:', { id: confirmExcluirId })
      const res = await fetch(`/api/configuracoes/diretorias/${confirmExcluirId}`, { method: 'DELETE' })
      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch { /* resposta vazia */ }
      console.log('[Diretorias] DELETE response:', res.status, data)
      if (!res.ok) {
        onErro((data.error as string) || 'Erro ao excluir a diretoria.')
        setConfirmExcluirId(null)
        return
      }
      onSucesso('Diretoria excluída com sucesso.')
      setConfirmExcluirId(null)
      await recarregar()
    } catch (e) {
      console.error('[Diretorias] DELETE exception:', e)
      onErro('Falha de comunicação com o servidor.')
      setConfirmExcluirId(null)
    } finally {
      setLoading(false)
    }
  }

  const nomeDirExcluir = lista.find(d => d.id === confirmExcluirId)?.nome ?? ''

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Diretorias</h3>
        {podeAdmin && (
          <button onClick={abrirNova} className="btn-primary text-sm flex items-center gap-1">
            <Plus size={14} /> Nova Diretoria
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="px-4 pb-3">
        <input
          type="text"
          placeholder="Pesquisar por nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input py-2 text-sm w-full max-w-xs"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Diretor Responsável</th>
              <th>Status</th>
              <th>Projetos</th>
              <th>Criação</th>
              <th>Última alteração</th>
              {podeAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={podeAdmin ? 8 : 7} className="text-center py-8 text-megag-cinza-texto text-sm">Nenhuma diretoria encontrada.</td></tr>
            )}
            {filtradas.map(d => (
              <tr key={d.id}>
                <td className="font-medium text-sm">{d.nome}</td>
                <td className="text-sm text-megag-cinza-texto">{d.descricao || '—'}</td>
                <td className="text-sm">{d.diretor_responsavel_nome || <span className="text-megag-cinza-texto text-xs">Não definido</span>}</td>
                <td>
                  <span className={`badge ${d.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {d.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="text-sm text-center">{d.projeto_count}</td>
                <td className="text-xs text-megag-cinza-texto">
                  {d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="text-xs text-megag-cinza-texto">
                  {d.updated_at ? new Date(d.updated_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                {podeAdmin && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => abrirEdicao(d)} className="btn-ghost text-xs p-1" title="Editar">
                        <Pencil size={13} />
                      </button>
                      {(() => {
                        const impedimentos = [
                          d.projeto_count > 0 && `${d.projeto_count} projeto${d.projeto_count > 1 ? 's' : ''}`,
                          d.area_count    > 0 && `${d.area_count} área${d.area_count > 1 ? 's' : ''}`,
                          d.usuario_count > 0 && `${d.usuario_count} usuário${d.usuario_count > 1 ? 's' : ''}`,
                        ].filter(Boolean) as string[]
                        const temImpedimento = impedimentos.length > 0
                        return (
                          <button
                            onClick={() => {
                              if (temImpedimento) {
                                onErro(`Não é possível excluir "${d.nome}": possui ${impedimentos.join(', ')} vinculado${impedimentos.length > 1 ? 's' : ''}.`)
                                return
                              }
                              setConfirmExcluirId(d.id)
                            }}
                            className="btn-ghost text-xs p-1 text-red-500"
                            title={temImpedimento ? `Possui ${impedimentos.join(', ')}` : 'Excluir diretoria'}
                          >
                            <X size={13} />
                          </button>
                        )
                      })()}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal cadastro / edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-megag-cinza-claro">
              <h2 className="font-semibold text-megag-preto">{editId ? 'Editar Diretoria' : 'Nova Diretoria'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <div>
                <label className="input-label">Nome *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="input"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Descrição</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="input"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="input-label">Diretor Responsável</label>
                <select
                  value={form.diretor_responsavel_id}
                  onChange={e => setForm(f => ({ ...f, diretor_responsavel_id: e.target.value }))}
                  className="input"
                >
                  <option value="">— Não definido —</option>
                  {diretoresUsuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Status</label>
                <select
                  value={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: Number(e.target.value) }))}
                  className="input"
                >
                  <option value={1}>Ativa</option>
                  <option value={0}>Inativa</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-sm">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary text-sm">
                  {loading ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação exclusão */}
      {confirmExcluirId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="font-semibold text-megag-preto">Excluir Diretoria</h2>
            <p className="text-sm text-megag-cinza-texto">
              Tem certeza que deseja excluir a diretoria <strong className="text-megag-preto">{nomeDirExcluir}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmExcluirId(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={confirmarExclusao} disabled={loading} className="btn-primary text-sm bg-red-600 hover:bg-red-700">
                {loading ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConfiguracoesClient({ diretorias, diretoresUsuarios, areas, usuarios, configFinanceira, configStatus, tiposParticipacao, contasContabeis, centrosCusto, tiposTarefa, criticidades, responsavelPadraoImportacaoId, motivosPausa, session }: Props) {
  const [abaAtiva, setAbaAtiva] = useState('Usuários')
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  const podeAdmin = session.perfil === 'ADMIN'

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Settings size={24} className="text-megag-azul" />
            Configurações
          </h1>
          <p className="page-subtitle">Cadastros e premissas do sistema</p>
        </div>
      </div>

      {sucesso && (
        <div className="mb-4 flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <span className="flex items-center gap-2"><CheckCircle size={16} /> {sucesso}</span>
          <button onClick={() => setSucesso('')} className="text-green-500 hover:text-green-700"><X size={14} /></button>
        </div>
      )}

      {erro && (
        <div className="mb-4 flex items-center justify-between gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {erro}</span>
          <button onClick={() => setErro('')} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      <div className="tab-list">
        {TABS.map(t => (
          <button key={t} className={`tab-item ${abaAtiva === t ? 'active' : ''}`} onClick={() => setAbaAtiva(t)}>{t}</button>
        ))}
      </div>

      {/* USUÁRIOS */}
      {abaAtiva === 'Usuários' && (
        <UsuariosTab
          initialUsuarios={usuarios}
          diretorias={diretorias}
          areas={areas}
          podeAdmin={podeAdmin}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* DIRETORIAS */}
      {abaAtiva === 'Diretorias' && (
        <DiretoriasTab
          initialDiretorias={diretorias}
          diretoresUsuarios={diretoresUsuarios}
          podeAdmin={podeAdmin}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* ÁREAS */}
      {abaAtiva === 'Áreas' && (
        <AreasTab
          initialAreas={areas}
          diretorias={diretorias}
          podeAdmin={podeAdmin}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* STATUS DE PROJETOS */}
      {abaAtiva === 'Status de Projetos' && (
        <StatusProjetosTab
          configStatus={configStatus}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* PREMISSAS FINANCEIRAS */}
      {abaAtiva === 'Premissas Financeiras' && (
        <PremissasFinanceiras
          configFinanceira={configFinanceira}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* TIPOS DE PARTICIPAÇÃO */}
      {abaAtiva === 'Tipos de Participação' && (
        <TiposParticipacaoTab
          initialTipos={tiposParticipacao}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* CONTAS CONTÁBEIS */}
      {abaAtiva === 'Contas Contábeis' && (
        <ContasContabeisTab
          initialContas={contasContabeis}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* CENTROS DE CUSTO */}
      {abaAtiva === 'Centros de Custo' && (
        <CentrosCustoTab
          initialCentros={centrosCusto}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* TIPOS DE TAREFA */}
      {abaAtiva === 'Tipos de Tarefa' && (
        <TiposTarefaTab
          initialTipos={tiposTarefa}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* CRITICIDADES */}
      {abaAtiva === 'Criticidades' && (
        <CriticidadesTab
          initialCriticidades={criticidades}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* CRONOGRAMA */}
      {abaAtiva === 'Cronograma' && (
        <CronogramaConfigTab
          usuarios={usuarios}
          responsavelPadraoId={responsavelPadraoImportacaoId}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

      {/* MOTIVOS DE PAUSA */}
      {abaAtiva === 'Motivos de Pausa' && (
        <MotivosPausaTab
          motivosPausa={motivosPausa}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={(msg) => { setErro(msg); setTimeout(() => setErro(''), 6000) }}
        />
      )}

    </div>
  )
}
