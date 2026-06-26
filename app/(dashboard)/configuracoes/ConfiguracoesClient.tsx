'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Users, Building2, DollarSign, Plus, CheckCircle } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface Props {
  diretorias: { id: number; codigo: string; nome: string; sigla: string; ativo: number }[]
  areas: { id: number; codigo: string; nome: string; sigla: string; diretoria_id: number; diretoria_nome: string; ativo: number }[]
  usuarios: { id: number; cpf: string; nome: string; email: string; cargo: string; perfil_codigo: string; diretoria_nome: string; ativo: number }[]
  configFinanceira: { id: number; chave: string; valor: string; descricao: string }[]
  session: SessionUser
}

const TABS = ['Usuários', 'Diretorias', 'Áreas', 'Premissas Financeiras']

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
        Estas premissas são usadas nos cálculos de VPL, TIR e Payback de todos os projetos.
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

export default function ConfiguracoesClient({ diretorias, areas, usuarios, configFinanceira, session }: Props) {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState('Usuários')
  const [showNovoUsuario, setShowNovoUsuario] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState({ nome:'', cpf:'', email:'', cargo:'', perfil_id:'2', diretoria_id:'', area_id:'', senha:'' })
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  const podeAdmin = session.perfil === 'ADMIN'

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoUsuario),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao criar usuário.'); return }
      setSucesso('Usuário criado com sucesso!')
      setShowNovoUsuario(false)
      router.refresh()
      setTimeout(() => setSucesso(''), 3000)
    } finally { setLoading(false) }
  }

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
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle size={16} /> {sucesso}
        </div>
      )}

      <div className="tab-list">
        {TABS.map(t => (
          <button key={t} className={`tab-item ${abaAtiva === t ? 'active' : ''}`} onClick={() => setAbaAtiva(t)}>{t}</button>
        ))}
      </div>

      {/* USUÁRIOS */}
      {abaAtiva === 'Usuários' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-megag-cinza-texto">{usuarios.length} usuários cadastrados</p>
            {podeAdmin && (
              <button className="btn-primary text-sm" onClick={() => setShowNovoUsuario(true)}>
                <Plus size={15} /> Novo Usuário
              </button>
            )}
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-megag">
              <thead>
                <tr><th>Nome</th><th>CPF</th><th>E-mail</th><th>Cargo</th><th>Perfil</th><th>Diretoria</th><th>Status</th></tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium text-sm">{u.nome}</td>
                    <td className="font-mono text-xs">{u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</td>
                    <td className="text-sm">{u.email}</td>
                    <td className="text-sm">{u.cargo || '—'}</td>
                    <td><span className="badge bg-megag-azul/10 text-megag-azul text-xs">{u.perfil_codigo}</span></td>
                    <td className="text-sm">{u.diretoria_nome || '—'}</td>
                    <td><span className={`badge ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIRETORIAS */}
      {abaAtiva === 'Diretorias' && (
        <div className="card p-0 overflow-hidden">
          <table className="table-megag">
            <thead><tr><th>Código</th><th>Sigla</th><th>Nome</th><th>Status</th></tr></thead>
            <tbody>
              {diretorias.map(d => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.codigo}</td>
                  <td><span className="badge bg-megag-azul/10 text-megag-azul">{d.sigla}</span></td>
                  <td className="font-medium text-sm">{d.nome}</td>
                  <td><span className={`badge ${d.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.ativo ? 'Ativa' : 'Inativa'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ÁREAS */}
      {abaAtiva === 'Áreas' && (
        <div className="card p-0 overflow-hidden">
          <table className="table-megag">
            <thead><tr><th>Sigla</th><th>Nome</th><th>Diretoria</th><th>Status</th></tr></thead>
            <tbody>
              {areas.map(a => (
                <tr key={a.id}>
                  <td><span className="badge bg-purple-100 text-purple-700">{a.sigla}</span></td>
                  <td className="font-medium text-sm">{a.nome}</td>
                  <td className="text-sm">{a.diretoria_nome}</td>
                  <td><span className={`badge ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.ativo ? 'Ativa' : 'Inativa'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PREMISSAS FINANCEIRAS */}
      {abaAtiva === 'Premissas Financeiras' && (
        <PremissasFinanceiras
          configFinanceira={configFinanceira}
          podeAdmin={podeAdmin || session.perfil === 'PMO'}
          onSucesso={(msg) => { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }}
          onErro={setErro}
        />
      )}

      {/* Modal novo usuário */}
      {showNovoUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNovoUsuario(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-megag-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold font-display text-lg text-megag-preto mb-4">Novo Usuário</h3>
            {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>}
            <form onSubmit={criarUsuario} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="input-label">Nome completo *</label>
                  <input value={novoUsuario.nome} onChange={e => setNovoUsuario(f => ({...f, nome:e.target.value}))} className="input" required />
                </div>
                <div>
                  <label className="input-label">CPF *</label>
                  <input value={novoUsuario.cpf} onChange={e => setNovoUsuario(f => ({...f, cpf:e.target.value.replace(/\D/g,'')}))}
                    className="input" placeholder="00000000000" maxLength={11} required />
                </div>
                <div>
                  <label className="input-label">E-mail *</label>
                  <input type="email" value={novoUsuario.email} onChange={e => setNovoUsuario(f => ({...f, email:e.target.value}))} className="input" required />
                </div>
                <div>
                  <label className="input-label">Cargo</label>
                  <input value={novoUsuario.cargo} onChange={e => setNovoUsuario(f => ({...f, cargo:e.target.value}))} className="input" />
                </div>
                <div>
                  <label className="input-label">Perfil *</label>
                  <select value={novoUsuario.perfil_id} onChange={e => setNovoUsuario(f => ({...f, perfil_id:e.target.value}))} className="input" required>
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
                  <select value={novoUsuario.diretoria_id} onChange={e => setNovoUsuario(f => ({...f, diretoria_id:e.target.value}))} className="input">
                    <option value="">Selecionar...</option>
                    {diretorias.filter(d => d.ativo).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="input-label">Senha inicial *</label>
                  <input type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(f => ({...f, senha:e.target.value}))}
                    className="input" placeholder="Mínimo 8 caracteres" minLength={8} required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowNovoUsuario(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
