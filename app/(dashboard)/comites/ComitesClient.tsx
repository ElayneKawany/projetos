'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface Comite {
  id: number; titulo: string; tipo: string; data_realizacao: string
  local: string; status: string; criador_nome: string
  num_participantes: number; num_projetos: number
}

interface Props {
  comites: Comite[]
  projetos: { id: number; codigo: string; nome: string }[]
  usuarios: { id: number; nome: string; cargo: string }[]
  session: SessionUser
}

const TIPO_BADGE: Record<string, string> = {
  IDEIAS: 'bg-blue-100 text-blue-700',
  APROVACAO: 'bg-amber-100 text-amber-700',
  REVISAO: 'bg-purple-100 text-purple-700',
}
const STATUS_ICON: Record<string, React.ElementType> = {
  AGENDADO: Clock, REALIZADO: CheckCircle, CANCELADO: XCircle,
}

export default function ComitesClient({ comites, projetos, usuarios, session }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', tipo: 'IDEIAS', data_realizacao: '', local: '', pauta: '' })
  const [loading, setLoading] = useState(false)

  const podeGerenciar = ['ADMIN','PMO'].includes(session.perfil)

  async function criarComite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/comites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setShowModal(false); router.refresh() }
    } finally { setLoading(false) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comitês</h1>
          <p className="page-subtitle">{comites.length} comitê{comites.length !== 1 ? 's' : ''}</p>
        </div>
        {podeGerenciar && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Novo Comitê
          </button>
        )}
      </div>

      {/* Cards de comitês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {comites.length === 0 ? (
          <div className="col-span-full card text-center py-12 text-megag-cinza-texto">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum comitê cadastrado.</p>
          </div>
        ) : comites.map(c => {
          const StatusIcon = STATUS_ICON[c.status] || Clock
          const passado = new Date(c.data_realizacao) < new Date()
          return (
            <div
              key={c.id}
              className="card cursor-pointer hover:shadow-megag-md transition-all"
              onClick={() => router.push(`/comites/${c.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${TIPO_BADGE[c.tipo] || 'bg-gray-100 text-gray-600'}`}>{c.tipo.replace('_',' ')}</span>
                  <span className={`badge ${c.status === 'REALIZADO' ? 'bg-green-100 text-green-700' : c.status === 'CANCELADO' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                    {c.status}
                  </span>
                </div>
                <StatusIcon size={16} className={c.status === 'REALIZADO' ? 'text-emerald-500' : c.status === 'CANCELADO' ? 'text-red-400' : 'text-amber-500'} />
              </div>

              <h3 className="font-semibold text-megag-preto mb-2 leading-snug">{c.titulo}</h3>

              <div className="flex items-center gap-2 text-xs text-megag-cinza-texto mb-3">
                <Calendar size={12} />
                <span className={passado && c.status === 'AGENDADO' ? 'text-red-500 font-medium' : ''}>
                  {new Date(c.data_realizacao).toLocaleString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </span>
                {c.local && <><span>•</span><span>{c.local}</span></>}
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-3">
                  <span className="text-megag-cinza-texto"><span className="font-semibold text-megag-preto">{c.num_participantes}</span> participantes</span>
                  <span className="text-megag-cinza-texto"><span className="font-semibold text-megag-preto">{c.num_projetos}</span> projetos</span>
                </div>
                <span className="text-megag-cinza-texto">{c.criador_nome?.split(' ')[0]}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal novo comitê */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-megag-lg animate-fade-in">
            <h3 className="font-bold font-display text-lg text-megag-preto mb-4">Novo Comitê</h3>
            <form onSubmit={criarComite} className="space-y-3">
              <div>
                <label className="input-label">Título *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))} className="input">
                    <option value="IDEIAS">Comitê de Projetos</option>
                    <option value="APROVACAO">Aprovação</option>
                    <option value="REVISAO">Revisão</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Data e Hora *</label>
                  <input type="datetime-local" value={form.data_realizacao} onChange={e => setForm(f => ({...f, data_realizacao: e.target.value}))} className="input" required />
                </div>
              </div>
              <div>
                <label className="input-label">Local</label>
                <input value={form.local} onChange={e => setForm(f => ({...f, local: e.target.value}))} className="input" placeholder="Sala de reuniões / link" />
              </div>
              <div>
                <label className="input-label">Pauta</label>
                <textarea value={form.pauta} onChange={e => setForm(f => ({...f, pauta: e.target.value}))} className="input resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Comitê'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
