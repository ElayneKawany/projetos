'use client'

import { useState } from 'react'
import { X, FolderKanban } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'
import type { Projeto } from '@/types'

interface Props {
  diretorias: { id: number; nome: string; sigla: string }[]
  areas: { id: number; nome: string; diretoria_id: number; diretoria_nome: string }[]
  usuarios: { id: number; nome: string; email: string; cargo: string }[]
  session: SessionUser
  onClose: () => void
  onSuccess: (p: Projeto) => void
}

export default function NovoProjetoModal({ diretorias, areas, usuarios, session, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    nome: '',
    solicitante_id: String(session.id),
    diretoria_id: '',
    area_id: '',
    objetivo: '',
    justificativa: '',
    categoria: '',
    prioridade: 'MEDIA',
    ponto_focal: '',
    contato: '',
    descricao: '',
    beneficios: '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const areasFiltradas = form.diretoria_id
    ? areas.filter(a => String(a.diretoria_id) === form.diretoria_id)
    : areas

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/projetos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          solicitante_id: form.solicitante_id,
          diretoria_id: form.diretoria_id,
          area_id: form.area_id,
          objetivo: form.objetivo,
          justificativa: form.justificativa,
          classificacao: form.categoria || undefined,
          prioridade: form.prioridade,
          ponto_focal: form.ponto_focal || undefined,
          contato: form.contato || undefined,
          descricao: form.descricao || undefined,
          beneficios: form.beneficios || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao criar projeto.'); return }
      onSuccess(data.projeto)
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-megag-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-megag-azul/10 rounded-xl flex items-center justify-center">
              <FolderKanban size={18} className="text-megag-azul" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-megag-preto">Novo Projeto</h2>
              <p className="text-xs text-megag-cinza-texto">Código gerado automaticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-megag-cinza-claro rounded-lg transition-colors">
            <X size={20} className="text-megag-cinza-texto" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome do Projeto */}
            <div className="sm:col-span-2">
              <label className="input-label">Nome do Projeto *</label>
              <input value={form.nome} onChange={e => set('nome', e.target.value)}
                className="input" placeholder="Nome descritivo do projeto" required />
            </div>

            {/* Solicitante */}
            <div>
              <label className="input-label">Solicitante *</label>
              <select value={form.solicitante_id} onChange={e => set('solicitante_id', e.target.value)} className="input" required>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>

            {/* Ponto Focal */}
            <div>
              <label className="input-label">Ponto Focal</label>
              <input
                value={form.ponto_focal}
                onChange={e => set('ponto_focal', e.target.value)}
                className="input"
                placeholder="Nome do ponto focal"
              />
            </div>

            {/* Diretoria Responsável */}
            <div>
              <label className="input-label">Diretoria Responsável *</label>
              <select value={form.diretoria_id} onChange={e => { set('diretoria_id', e.target.value); set('area_id', '') }} className="input" required>
                <option value="">Selecionar...</option>
                {diretorias.map(d => <option key={d.id} value={d.id}>{d.sigla} – {d.nome}</option>)}
              </select>
            </div>

            {/* Área Responsável */}
            <div>
              <label className="input-label">Área Responsável *</label>
              <select value={form.area_id} onChange={e => set('area_id', e.target.value)} className="input" required>
                <option value="">Selecionar...</option>
                {areasFiltradas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            {/* Categoria */}
            <div>
              <label className="input-label">Categoria *</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="input" required>
                <option value="">Selecionar...</option>
                <option value="PROJETO">Projeto</option>
                <option value="MELHORIA_CONTINUA">Melhoria Contínua</option>
              </select>
            </div>

            {/* Prioridade */}
            <div>
              <label className="input-label">Prioridade *</label>
              <select value={form.prioridade} onChange={e => set('prioridade', e.target.value)} className="input" required>
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
              </select>
            </div>

            {/* Objetivo */}
            <div className="sm:col-span-2">
              <label className="input-label">Objetivo *</label>
              <textarea value={form.objetivo} onChange={e => set('objetivo', e.target.value)}
                className="input resize-none" rows={3} placeholder="Objetivo principal do projeto" required />
            </div>

            {/* Justificativa */}
            <div className="sm:col-span-2">
              <label className="input-label">Justificativa *</label>
              <textarea value={form.justificativa} onChange={e => set('justificativa', e.target.value)}
                className="input resize-none" rows={3} placeholder="Por que este projeto é necessário?" required />
            </div>

            {/* Problema ou Oportunidade (antes: Descrição) */}
            <div className="sm:col-span-2">
              <label className="input-label">Problema ou Oportunidade</label>
              <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
                className="input resize-none" rows={3}
                placeholder="Descreva o problema que será resolvido ou a oportunidade que será aproveitada." />
            </div>

            {/* Benefícios Esperados */}
            <div className="sm:col-span-2">
              <label className="input-label">Benefícios Esperados</label>
              <textarea value={form.beneficios} onChange={e => set('beneficios', e.target.value)}
                className="input resize-none" rows={3} placeholder="Quais benefícios este projeto trará?" />
              <p className="text-xs text-megag-cinza-texto mt-1.5 leading-relaxed">
                Descreva os principais benefícios esperados, como redução de custos, aumento de produtividade,
                melhoria operacional, redução de riscos ou atendimento a requisitos legais.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-megag-cinza-medio">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Criando...</>
              ) : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
