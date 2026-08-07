'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, FolderKanban, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import type { Projeto, StatusProjeto, Prioridade, StatusCronograma } from '@/types'
import { STATUS_LABELS, PRIORIDADE_LABELS } from '@/types'
import { STATUS_MACRO_ORDER, STATUS_MACRO_LABELS, getStatusOperacionais } from '@/lib/status-macro'
import type { SessionUser } from '@/lib/auth'
import NovoprojetoModal from './NovoProjetoModal'
import { formatDistanceToNow } from 'date-fns'

function fmtDataBR(d: string | null | undefined): string {
  if (!d) return '—'
  const s = d.slice(0, 10)
  const [y, m, day] = s.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}
import { ptBR } from 'date-fns/locale'

const STATUS_BADGE: Record<string, string> = {
  PROPOSTA: 'badge-proposta', TRIAGEM: 'badge-triagem', COMITE_IDEIAS: 'badge-comite',
  VIABILIDADE: 'badge-viabilidade', COMPLEMENTACAO_TAP: 'badge-viabilidade',
  APROVACAO: 'badge-aprovacao', ESTRUTURACAO: 'badge-estruturacao',
  CRONOGRAMA: 'badge-cronograma', EXECUCAO: 'badge-execucao',
  PROJETO_CONCLUIDO: 'badge-golive', PAYBACK_ACOMPANHAMENTO: 'badge-roi',
  PAYBACK_ENCERRADO: 'badge-encerramento', PROJETO_ENCERRADO: 'badge-encerramento',
  GOLIVE: 'badge-golive', ROI: 'badge-roi', ENCERRAMENTO: 'badge-encerramento',
  CANCELADO: 'badge-cancelado', SUSPENSO: 'badge-cancelado', PAUSADO: 'badge-cancelado',
}

const STATUS_CRON_CONFIG: Record<StatusCronograma, { emoji: string; label: string; cls: string }> = {
  NO_PRAZO:       { emoji: '🟢', label: 'No Prazo',       cls: 'bg-green-100 text-green-700' },
  ATENCAO:        { emoji: '🟡', label: 'Atenção',        cls: 'bg-amber-100 text-amber-700' },
  ATRASADO:       { emoji: '🔴', label: 'Atrasado',       cls: 'bg-red-100 text-red-700' },
  SEM_CRONOGRAMA: { emoji: '⚪', label: 'Sem Cronograma', cls: 'bg-gray-100 text-gray-600' },
}

function calcularStatusCronograma(p: Projeto): StatusCronograma {
  if (!p.has_cronograma) return 'SEM_CRONOGRAMA'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataFim = p.data_fim_prev ? new Date(p.data_fim_prev) : null
  if (dataFim) {
    dataFim.setHours(0, 0, 0, 0)
    if (dataFim < hoje) return 'ATRASADO'
    const diasRestantes = Math.round((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    if ((p.tarefas_atrasadas ?? 0) > 0 || diasRestantes <= 10) return 'ATENCAO'
  } else if ((p.tarefas_atrasadas ?? 0) > 0) {
    return 'ATENCAO'
  }
  return 'NO_PRAZO'
}

interface Props {
  projetos: Projeto[]
  diretorias: { id: number; nome: string; sigla: string }[]
  areas: { id: number; nome: string; diretoria_id: number; diretoria_nome: string }[]
  usuarios: { id: number; nome: string; email: string; cargo: string }[]
  session: SessionUser
  initialDiretoria?: string
  initialStatus?: string
}

export default function ProjetosClient({ projetos: initial, diretorias, areas, usuarios, session, initialDiretoria = '', initialStatus = '' }: Props) {
  const router = useRouter()
  const [projetos, setProjetos] = useState(initial)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState(initialStatus)
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroDiretoria, setFiltroDiretoria] = useState(initialDiretoria)
  const [filtroStatusCron, setFiltroStatusCron] = useState('')
  const [filtroGerente, setFiltroGerente] = useState('')
  const [filtroPmo, setFiltroPmo] = useState('')
  const [showModal, setShowModal] = useState(false)

  const gerentesUnicos = Array.from(new Set(projetos.map(p => p.gerente_nome ?? undefined).filter((v): v is string => !!v))).sort()
  const pmosUnicos = Array.from(new Set(projetos.map(p => p.pmo_responsavel_nome ?? undefined).filter((v): v is string => !!v))).sort()

  const filtrados = projetos.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()) &&
        !p.codigo.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroStatus) {
      const statuses = filtroStatus.split(',')
      if (!statuses.includes(p.status)) return false
    }
    if (filtroPrioridade && p.prioridade !== filtroPrioridade) return false
    if (filtroDiretoria && String(p.diretoria_id) !== filtroDiretoria) return false
    if (filtroStatusCron && calcularStatusCronograma(p) !== filtroStatusCron) return false
    if (filtroGerente && p.gerente_nome !== filtroGerente) return false
    if (filtroPmo && p.pmo_responsavel_nome !== filtroPmo) return false
    return true
  })

  const hoje = new Date()
  const atrasados = projetos.filter(p =>
    p.data_fim_prev && new Date(p.data_fim_prev) < hoje &&
    !['ENCERRAMENTO','CANCELADO','SUSPENSO','PAUSADO','PROJETO_CONCLUIDO','PAYBACK_ENCERRADO','PROJETO_ENCERRADO'].includes(p.status)
  ).length

  async function onProjetoCriado(novoProjeto: Projeto) {
    setProjetos(prev => [novoProjeto, ...prev])
    setShowModal(false)
  }

  const limparFiltros = () => {
    setBusca(''); setFiltroStatus(''); setFiltroPrioridade('')
    setFiltroDiretoria(''); setFiltroStatusCron(''); setFiltroGerente(''); setFiltroPmo('')
  }
  const temFiltro = busca || filtroStatus || filtroPrioridade || filtroDiretoria || filtroStatusCron || filtroGerente || filtroPmo

  return (
    <div className="animate-fade-in">
      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projetos</h1>
          <p className="page-subtitle">
            {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} •{' '}
            {atrasados > 0 && <span className="text-red-500 font-medium">{atrasados} atrasado{atrasados !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        {['ADMIN','PMO','GESTOR','SOLICITANTE'].includes(session.perfil) && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Novo Projeto
          </button>
        )}
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', valor: projetos.length, icon: FolderKanban, cor: 'text-megag-azul', bg: 'bg-megag-azul/10' },
          { label: 'Em Execução', valor: projetos.filter(p => p.status === 'EXECUCAO').length, icon: TrendingUp, cor: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Atrasados', valor: atrasados, icon: AlertTriangle, cor: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Aguardando Aprovação', valor: projetos.filter(p => p.status === 'APROVACAO').length, icon: Clock, cor: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(kpi => (
          <div key={kpi.label} className="card flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
              <kpi.icon size={20} className={kpi.cor} />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-megag-preto">{kpi.valor}</p>
              <p className="text-xs text-megag-cinza-texto font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-megag-cinza-texto" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input pl-8 py-2 text-sm"
            />
          </div>

          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="input w-48 py-2 text-sm">
            <option value="">Todos os status</option>
            {STATUS_MACRO_ORDER.map(macro => (
              <option key={macro} value={getStatusOperacionais(macro).join(',')}>
                {STATUS_MACRO_LABELS[macro]}
              </option>
            ))}
          </select>

          <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)} className="input w-36 py-2 text-sm">
            <option value="">Prioridade</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Média</option>
            <option value="BAIXA">Baixa</option>
          </select>

          <select value={filtroDiretoria} onChange={e => setFiltroDiretoria(e.target.value)} className="input w-44 py-2 text-sm">
            <option value="">Diretoria</option>
            {diretorias.map(d => (
              <option key={d.id} value={String(d.id)}>{d.sigla} – {d.nome}</option>
            ))}
          </select>

          <select value={filtroStatusCron} onChange={e => setFiltroStatusCron(e.target.value)} className="input w-44 py-2 text-sm">
            <option value="">Status do Projeto</option>
            <option value="NO_PRAZO">🟢 No Prazo</option>
            <option value="ATENCAO">🟡 Atenção</option>
            <option value="ATRASADO">🔴 Atrasado</option>
            <option value="SEM_CRONOGRAMA">⚪ Sem Cronograma</option>
          </select>

          {gerentesUnicos.length > 0 && (
            <select value={filtroGerente} onChange={e => setFiltroGerente(e.target.value)} className="input w-44 py-2 text-sm">
              <option value="">Gerente</option>
              {gerentesUnicos.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          {pmosUnicos.length > 0 && (
            <select value={filtroPmo} onChange={e => setFiltroPmo(e.target.value)} className="input w-44 py-2 text-sm">
              <option value="">PMO</option>
              {pmosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {temFiltro && (
            <button className="btn-ghost text-sm" onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-megag">
            <thead>
              <tr>
                <th>Código</th>
                <th>Projeto</th>
                <th>Diretoria</th>
                <th>Status</th>
                <th>Status do Projeto</th>
                <th>Prioridade</th>
                <th>Gerente</th>
                <th>Previsão Entrega</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-megag-cinza-texto">
                    <FolderKanban size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Nenhum projeto encontrado.</p>
                  </td>
                </tr>
              ) : filtrados.map(p => {
                const sc = calcularStatusCronograma(p)
                const scCfg = STATUS_CRON_CONFIG[sc]
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/projetos/${p.id}`)}
                  >
                    <td>
                      <span className="font-mono text-megag-azul font-semibold text-xs">{p.codigo}</span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-megag-preto text-sm">{p.nome}</p>
                        {p.solicitante_nome && (
                          <p className="text-xs text-megag-cinza-texto mt-0.5">
                            Solicitante: {p.solicitante_nome}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-sm">{p.diretoria_nome || '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[p.status] || 'badge-proposta'}`}>
                        {STATUS_LABELS[p.status as StatusProjeto] || p.status}
                      </span>
                      {!!p.tem_revisao_pendente && (
                        <span className="ml-1 badge" style={{ backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
                          ↩ Em revisão
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge text-xs ${scCfg.cls}`}>
                        {scCfg.emoji} {scCfg.label}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${p.prioridade.toLowerCase()}`}>
                        {PRIORIDADE_LABELS[p.prioridade as Prioridade]}
                      </span>
                    </td>
                    <td className="text-sm">{p.gerente_nome || <span className="text-megag-cinza-texto text-xs">Não definido</span>}</td>
                    <td className="text-sm">
                      {(p.data_fim_efetiva ?? p.data_fim_prev) ? (
                        <span className={new Date(p.data_fim_efetiva ?? p.data_fim_prev ?? '') < hoje && !['ENCERRAMENTO','CANCELADO'].includes(p.status) ? 'text-red-500 font-medium' : ''}>
                          {fmtDataBR(p.data_fim_efetiva ?? p.data_fim_prev)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs text-megag-cinza-texto">
                      {formatDistanceToNow(new Date(p.created_at), { locale: ptBR, addSuffix: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-megag-cinza-medio text-xs text-megag-cinza-texto">
          Exibindo {filtrados.length} de {projetos.length} projeto{projetos.length !== 1 ? 's' : ''}
        </div>
      </div>

      {showModal && (
        <NovoprojetoModal
          diretorias={diretorias}
          areas={areas}
          usuarios={usuarios}
          session={session}
          onClose={() => setShowModal(false)}
          onSuccess={onProjetoCriado}
        />
      )}
    </div>
  )
}
