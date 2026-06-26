'use client'

import { useState } from 'react'
import { FileText, Download, Eye, Zap } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface Documento {
  id: number; tipo: string; titulo: string; versao: number; status: string
  gerado_auto: number; projeto_codigo?: string; projeto_nome?: string
  criador_nome: string; aprovado_em?: string; publicado_em?: string; created_at: string
}

interface Props {
  documentos: Documento[]
  session: SessionUser
}

const TIPO_LABELS: Record<string, string> = {
  TAP: 'TAP', ESTUDO: 'Estudo de Viabilidade', ATA: 'Ata de Reunião',
  ONE_PAGE: 'One Page', COMITE: 'Relatório de Comitê', ENCERRAMENTO: 'Relatório de Encerramento',
  POLITICA: 'Política', PROCEDIMENTO: 'Procedimento', IT: 'Instrução de Trabalho',
}

const STATUS_BADGE: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-600',
  EM_APROVACAO: 'bg-amber-100 text-amber-700',
  APROVADO: 'bg-green-100 text-green-700',
  PUBLICADO: 'bg-megag-azul/10 text-megag-azul',
  OBSOLETO: 'bg-red-50 text-red-400',
}

export default function DocumentosClient({ documentos, session }: Props) {
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const filtrados = documentos.filter(d => {
    if (filtroTipo && d.tipo !== filtroTipo) return false
    if (filtroStatus && d.status !== filtroStatus) return false
    return true
  })

  const tipos = [...new Set(documentos.map(d => d.tipo))]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="page-subtitle">{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="mb-4 p-3 bg-megag-azul/5 border border-megag-azul/20 rounded-xl flex items-center gap-3">
        <Zap size={16} className="text-megag-azul flex-shrink-0" />
        <p className="text-sm text-megag-cinza-escuro">
          Documentos como TAP, Atas e Relatórios são <strong>gerados automaticamente</strong> pelo sistema a partir dos dados dos projetos.
          Nunca são sobrescritos — cada versão é preservada.
        </p>
      </div>

      {/* Filtros */}
      <div className="card mb-4 flex flex-wrap gap-3">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="input w-52 py-2 text-sm">
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="input w-44 py-2 text-sm">
          <option value="">Todos os status</option>
          {Object.keys(STATUS_BADGE).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-megag">
          <thead>
            <tr>
              <th>Título</th><th>Tipo</th><th>Projeto</th><th>Versão</th><th>Status</th><th>Geração</th><th>Data</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-megag-cinza-texto">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Nenhum documento encontrado.</p>
                </td>
              </tr>
            ) : filtrados.map(d => (
              <tr key={d.id}>
                <td>
                  <p className="font-medium text-sm text-megag-preto">{d.titulo}</p>
                  <p className="text-xs text-megag-cinza-texto">{d.criador_nome}</p>
                </td>
                <td><span className="badge bg-megag-azul/10 text-megag-azul text-xs">{TIPO_LABELS[d.tipo] || d.tipo}</span></td>
                <td>
                  {d.projeto_codigo ? (
                    <div>
                      <span className="font-mono text-megag-azul text-xs font-semibold">{d.projeto_codigo}</span>
                      <p className="text-xs text-megag-cinza-texto truncate max-w-[150px]">{d.projeto_nome}</p>
                    </div>
                  ) : <span className="text-xs text-megag-cinza-texto">Corporativo</span>}
                </td>
                <td><span className="badge bg-gray-100 text-gray-600">V{d.versao}</span></td>
                <td><span className={`badge ${STATUS_BADGE[d.status] || 'bg-gray-100 text-gray-500'}`}>{d.status.replace('_',' ')}</span></td>
                <td>
                  {d.gerado_auto ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Zap size={11} /> Automático
                    </span>
                  ) : (
                    <span className="text-xs text-megag-cinza-texto">Manual</span>
                  )}
                </td>
                <td className="text-xs text-megag-cinza-texto">
                  {new Date(d.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {true && (
                      <>
                        <button className="p-1.5 hover:bg-megag-cinza-claro rounded transition-colors" title="Visualizar">
                          <Eye size={14} className="text-megag-cinza-texto" />
                        </button>
                        <button className="p-1.5 hover:bg-megag-cinza-claro rounded transition-colors" title="Baixar">
                          <Download size={14} className="text-megag-cinza-texto" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
