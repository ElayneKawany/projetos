'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, CheckCircle, XCircle, Clock, AlertTriangle, Settings, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface Aprovacao {
  id: number; tipo: string; status: string
  projeto_id: number; projeto_codigo: string; projeto_nome: string
  solicitante_nome: string; aprovador_nome?: string
  observacao_req?: string; observacao_apr?: string
  prazo?: string; aprovado_em?: string; created_at: string
}
interface Aprovador { id: number; tipo_documento: string; usuario_id: number; usuario_nome: string; cargo: string; ordem: number }
interface Usuario { id: number; nome: string; cargo: string }
interface Props { aprovacoes: Aprovacao[]; session: SessionUser }

const TIPO_LABEL: Record<string, string> = {
  TAP: 'TAP', VIABILIDADE: 'Estudo de Viabilidade',
  CRONOGRAMA: 'Cronograma', LANCAMENTO: 'Lançamento Financeiro',
  ENCERRAMENTO: 'Encerramento', DOCUMENTO: 'Documento',
}
const DOC_TIPOS = ['TAP', 'VIABILIDADE', 'CRONOGRAMA', 'LANCAMENTO', 'ENCERRAMENTO']

export default function AprovacoesClient({ aprovacoes, session }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<'todos'|'pendente'|'aprovado'|'rejeitado'>('pendente')
  const [modalId, setModalId] = useState<number|null>(null)
  const [modalAcao, setModalAcao] = useState<'APROVADO'|'REJEITADO'|null>(null)
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [aprovadores, setAprovadores] = useState<Aprovador[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [novoTipo, setNovoTipo] = useState('TAP')
  const [novoUsuario, setNovoUsuario] = useState('')
  const [novaOrdem, setNovaOrdem] = useState('1')
  const [addingAprovador, setAddingAprovador] = useState(false)

  const podeAprovar = ['ADMIN','PMO','DIRETOR','CEO'].includes(session.perfil)
  const podeConfigurar = ['ADMIN','PMO'].includes(session.perfil)
  const filtradas = aprovacoes.filter(a => filtro === 'todos' || a.status.toLowerCase() === filtro)
  const pendentes = aprovacoes.filter(a => a.status === 'PENDENTE').length
  const aprovacaoAtual = aprovacoes.find(a => a.id === modalId)

  async function carregarAprovadores() {
    setLoadingConfig(true)
    try {
      const [r1, r2] = await Promise.all([fetch('/api/aprovadores'), fetch('/api/usuarios?ativo=1')])
      const d1 = await r1.json(); const d2 = await r2.json()
      setAprovadores(d1.aprovadores || []); setUsuarios(d2.usuarios || [])
    } finally { setLoadingConfig(false) }
  }

  function toggleConfig() { if (!showConfig) carregarAprovadores(); setShowConfig(v => !v) }

  async function adicionarAprovador() {
    if (!novoUsuario) return
    setAddingAprovador(true)
    try {
      await fetch('/api/aprovadores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_documento: novoTipo, usuario_id: Number(novoUsuario), ordem: Number(novaOrdem) }) })
      setNovoUsuario(''); setNovaOrdem('1'); await carregarAprovadores()
    } finally { setAddingAprovador(false) }
  }

  async function removerAprovador(id: number) {
    await fetch(`/api/aprovadores?id=${id}`, { method: 'DELETE' })
    await carregarAprovadores()
  }

  async function responder(decisao: 'APROVADO'|'REJEITADO') {
    if (!modalId) return
    setLoading(true)
    try {
      await fetch(`/api/aprovacoes/${modalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decisao, observacao: obs }) })
      setModalId(null); setModalAcao(null); setObs(''); router.refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Aprovações</h1>
          <p className="page-subtitle">
            {pendentes > 0
              ? <span className="text-amber-600 font-medium">{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span>
              : 'Tudo em dia'}
          </p>
        </div>
        {podeConfigurar && (
          <button onClick={toggleConfig} className="btn-secondary text-sm flex items-center gap-2">
            <Settings size={15} />Configurar Aprovadores
            {showConfig ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        )}
      </div>

      {podeConfigurar && showConfig && (
        <div className="card mb-6 border-megag-azul/20">
          <div className="card-header mb-4">
            <span className="card-title flex items-center gap-2"><Settings size={16} className="text-megag-azul"/>Aprovadores por Tipo de Documento</span>
          </div>
          {loadingConfig ? <p className="text-sm text-megag-cinza-texto py-4 text-center">Carregando...</p> : (
            <div className="space-y-4">
              {DOC_TIPOS.map(tipo => {
                const lista = aprovadores.filter(a => a.tipo_documento === tipo)
                return (
                  <div key={tipo} className="border border-megag-cinza-medio rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-megag-preto">{TIPO_LABEL[tipo]}</h4>
                      <span className="text-xs text-megag-cinza-texto">{lista.length} aprovador{lista.length !== 1 ? 'es' : ''}</span>
                    </div>
                    {lista.length === 0 ? (
                      <p className="text-xs text-megag-cinza-texto italic">Nenhum aprovador configurado.</p>
                    ) : (
                      <div className="space-y-2">
                        {lista.sort((a, b) => a.ordem - b.ordem).map(apr => (
                          <div key={apr.id} className="flex items-center justify-between bg-megag-cinza-claro rounded-lg px-3 py-2">
                            <div>
                              <span className="text-sm font-medium text-megag-preto">{apr.usuario_nome}</span>
                              {apr.cargo && <span className="text-xs text-megag-cinza-texto ml-2">• {apr.cargo}</span>}
                              <span className="text-xs text-megag-cinza-texto ml-2">• Ordem {apr.ordem}</span>
                            </div>
                            <button onClick={() => removerAprovador(apr.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="border border-dashed border-megag-cinza-medio rounded-xl p-4">
                <h4 className="font-semibold text-sm text-megag-preto mb-3 flex items-center gap-2"><Plus size={14} className="text-megag-azul"/>Adicionar Aprovador</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="input-label">Tipo de Documento</label>
                    <select value={novoTipo} onChange={e => setNovoTipo(e.target.value)} className="input">
                      {DOC_TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Usuário</label>
                    <select value={novoUsuario} onChange={e => setNovoUsuario(e.target.value)} className="input">
                      <option value="">Selecionar...</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}{u.cargo ? ` (${u.cargo})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Ordem</label>
                    <input type="number" min={1} value={novaOrdem} onChange={e => setNovaOrdem(e.target.value)} className="input"/>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={adicionarAprovador} disabled={!novoUsuario || addingAprovador} className="btn-primary text-sm">
                    {addingAprovador ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {pendentes > 0 && podeAprovar && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0"/>
          <p className="text-sm text-amber-700 font-medium">{pendentes} aprovação{pendentes !== 1 ? 'ões' : ''} aguardando sua análise.</p>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['pendente','aprovado','rejeitado','todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === f ? 'bg-megag-azul text-white' : 'bg-white border border-megag-cinza-medio text-megag-cinza-escuro hover:bg-megag-cinza-claro'}`}>
            {f === 'pendente' ? `Pendente (${aprovacoes.filter(a => a.status === 'PENDENTE').length})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtradas.length === 0 ? (
          <div className="card text-center py-12 text-megag-cinza-texto">
            <CheckSquare size={32} className="mx-auto mb-2 opacity-30"/>
            <p>Nenhuma aprovação{filtro !== 'todos' ? ` com status "${filtro}"` : ''}.</p>
          </div>
        ) : filtradas.map(a => (
          <div key={a.id} className={`card flex items-center gap-4 ${a.status === 'PENDENTE' ? 'border-amber-200' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.status === 'APROVADO' ? 'bg-green-100' : a.status === 'REJEITADO' ? 'bg-red-100' : 'bg-amber-100'}`}>
              {a.status === 'APROVADO' ? <CheckCircle size={20} className="text-green-600"/> : a.status === 'REJEITADO' ? <XCircle size={20} className="text-red-500"/> : <Clock size={20} className="text-amber-600"/>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="badge bg-megag-azul/10 text-megag-azul text-xs">{TIPO_LABEL[a.tipo] || a.tipo}</span>
                <span className={`badge text-xs ${a.status === 'APROVADO' ? 'bg-green-100 text-green-700' : a.status === 'REJEITADO' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
              </div>
              <p className="font-semibold text-megag-preto text-sm">
                <span className="font-mono text-megag-azul">{a.projeto_codigo}</span> — {a.projeto_nome}
              </p>
              {a.observacao_req && <p className="text-xs text-megag-cinza-texto mt-0.5 truncate">{a.observacao_req}</p>}
              <p className="text-xs text-megag-cinza-texto mt-0.5">
                Solicitado por {a.solicitante_nome} • {new Date(a.created_at).toLocaleDateString('pt-BR')}
                {a.prazo && <span className="text-amber-600"> • Prazo: {new Date(a.prazo).toLocaleDateString('pt-BR')}</span>}
              </p>
              {a.aprovador_nome && a.status !== 'PENDENTE' && (
                <p className="text-xs text-megag-cinza-texto mt-0.5">
                  {a.status === 'APROVADO' ? 'Aprovado' : 'Rejeitado'} por {a.aprovador_nome}
                  {a.aprovado_em && ` • ${new Date(a.aprovado_em).toLocaleDateString('pt-BR')}`}
                </p>
              )}
              {a.observacao_apr && <p className="text-xs text-megag-cinza-texto mt-0.5 italic">"{a.observacao_apr}"</p>}
            </div>
            {a.status === 'PENDENTE' && podeAprovar && (
              <div className="flex gap-2 flex-shrink-0">
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  onClick={() => { setModalId(a.id); setModalAcao('APROVADO'); setObs('') }}>Aprovar</button>
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                  onClick={() => { setModalId(a.id); setModalAcao('REJEITADO'); setObs('') }}>Revisão</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modalId && aprovacaoAtual && modalAcao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setModalId(null); setModalAcao(null) }}/>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-megag-lg animate-fade-in">
            <h3 className="font-bold font-display text-lg text-megag-preto mb-1">
              {modalAcao === 'APROVADO' ? 'Aprovar Documento' : 'Solicitar Revisão'}
            </h3>
            <p className="text-sm text-megag-cinza-texto mb-4">
              {TIPO_LABEL[aprovacaoAtual.tipo]} — <span className="font-mono text-megag-azul">{aprovacaoAtual.projeto_codigo}</span> {aprovacaoAtual.projeto_nome}
            </p>
            {aprovacaoAtual.observacao_req && (
              <div className="mb-4 p-3 bg-megag-cinza-claro rounded-lg text-sm text-megag-cinza-escuro">
                <p className="font-semibold text-xs uppercase text-megag-cinza-texto mb-1">Observação do solicitante</p>
                {aprovacaoAtual.observacao_req}
              </div>
            )}
            <div className="mb-4">
              <label className="input-label">{modalAcao === 'APROVADO' ? 'Observação (opcional)' : 'Motivo da revisão'}</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} className="input resize-none" rows={3}
                placeholder={modalAcao === 'APROVADO' ? 'Comentário...' : 'O que precisa ser revisado...'}/>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => { setModalId(null); setModalAcao(null) }}>Cancelar</button>
              {modalAcao === 'REJEITADO' ? (
                <button className="flex-1 px-4 py-2 rounded-xl font-semibold text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                  onClick={() => responder('REJEITADO')} disabled={loading}>{loading ? 'Salvando...' : 'Solicitar Revisão'}</button>
              ) : (
                <button className="flex-1 px-4 py-2 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  onClick={() => responder('APROVADO')} disabled={loading}>{loading ? 'Salvando...' : 'Confirmar Aprovação'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
