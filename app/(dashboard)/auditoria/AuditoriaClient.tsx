'use client'

import React, { useState } from 'react'
import { ShieldCheck, Search } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface AuditoriaLog {
  id: number; acao: string; entidade: string; entidade_id?: number
  projeto_id?: number; descricao: string; usuario_nome?: string
  dados_antes?: string; dados_depois?: string; ip?: string; created_at: string
}

interface Props {
  logs: AuditoriaLog[]
  projetos: { id: number; codigo: string; nome: string }[]
  session: SessionUser
}

const ACAO_BADGE: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  STATUS_CHANGE: 'bg-purple-100 text-purple-700',
  PRIORITY_CHANGE: 'bg-amber-100 text-amber-700',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-red-100 text-red-600',
  LOGIN: 'bg-gray-100 text-gray-600',
  LOGOUT: 'bg-gray-100 text-gray-500',
  UPLOAD: 'bg-sky-100 text-sky-600',
  VERSIONING: 'bg-violet-100 text-violet-700',
  DELETE_SOFT: 'bg-orange-100 text-orange-600',
}

export default function AuditoriaClient({ logs, projetos, session }: Props) {
  const [busca, setBusca] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroEntidade, setFiltroEntidade] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)

  const filtrados = logs.filter(l => {
    if (busca && !l.descricao.toLowerCase().includes(busca.toLowerCase()) &&
        !(l.usuario_nome || '').toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroAcao && l.acao !== filtroAcao) return false
    if (filtroEntidade && l.entidade !== filtroEntidade) return false
    return true
  })

  const acoes = [...new Set(logs.map(l => l.acao))].sort()
  const entidades = [...new Set(logs.map(l => l.entidade))].sort()

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-subtitle">{logs.length} registros imutáveis</p>
        </div>
      </div>

      <div className="mb-4 p-3 bg-megag-azul/5 border border-megag-azul/20 rounded-xl flex items-center gap-3">
        <ShieldCheck size={18} className="text-megag-azul flex-shrink-0" />
        <p className="text-sm text-megag-cinza-escuro">
          Registros de auditoria nunca são excluídos ou modificados. Esta trilha é imutável.
        </p>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-megag-cinza-texto" />
            <input type="text" placeholder="Buscar descrição ou usuário..." value={busca}
              onChange={e => setBusca(e.target.value)} className="input pl-8 py-2 text-sm" />
          </div>
          <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)} className="input w-44 py-2 text-sm">
            <option value="">Todas as ações</option>
            {acoes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)} className="input w-44 py-2 text-sm">
            <option value="">Todas as tabelas</option>
            {entidades.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-megag">
            <thead>
              <tr>
                <th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Descrição</th><th>IP</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-megag-cinza-texto">Nenhum registro encontrado.</td></tr>
              ) : filtrados.map(log => (
                <React.Fragment key={log.id}>
                  <tr>
                    <td className="text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="text-sm">{log.usuario_nome || <span className="text-megag-cinza-texto">Sistema</span>}</td>
                    <td>
                      <span className={`badge ${ACAO_BADGE[log.acao] || 'bg-gray-100 text-gray-600'} text-xs`}>{log.acao}</span>
                    </td>
                    <td className="text-xs font-mono text-megag-cinza-texto">{log.entidade}</td>
                    <td className="text-sm max-w-[300px]"><p className="truncate">{log.descricao}</p></td>
                    <td className="text-xs text-megag-cinza-texto font-mono">{log.ip || '—'}</td>
                    <td>
                      {(log.dados_antes || log.dados_depois) && (
                        <button
                          className="text-xs text-megag-azul hover:underline"
                          onClick={() => setExpandido(expandido === log.id ? null : log.id)}
                        >
                          {expandido === log.id ? 'ocultar' : 'detalhes'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandido === log.id && (
                    <tr key={`exp-${log.id}`} className="bg-megag-cinza-claro/50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          {log.dados_antes && (
                            <div>
                              <p className="text-xs font-semibold text-megag-cinza-texto uppercase mb-1">Antes</p>
                              <pre className="text-xs text-megag-cinza-escuro bg-white border border-megag-cinza-medio rounded p-2 overflow-auto max-h-40">
                                {JSON.stringify(JSON.parse(log.dados_antes), null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.dados_depois && (
                            <div>
                              <p className="text-xs font-semibold text-megag-cinza-texto uppercase mb-1">Depois</p>
                              <pre className="text-xs text-megag-cinza-escuro bg-white border border-megag-cinza-medio rounded p-2 overflow-auto max-h-40">
                                {JSON.stringify(JSON.parse(log.dados_depois), null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-megag-cinza-medio text-xs text-megag-cinza-texto">
          {filtrados.length} de {logs.length} registros
        </div>
      </div>
    </div>
  )
}
