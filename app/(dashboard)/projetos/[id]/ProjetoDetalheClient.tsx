'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronRight, FileText, AlertTriangle,
  DollarSign, History, Clock
} from 'lucide-react'
import type { Projeto } from '@/types'
import { STATUS_LABELS, PRIORIDADE_LABELS, STATUS_ORDER } from '@/types'
import type { SessionUser } from '@/lib/auth'
import ProjectTimeline from '@/components/projeto/ProjectTimeline'
import TapEditor from '@/components/projeto/TapEditor'
import ViabilidadeEditor from '@/components/projeto/ViabilidadeEditor'
import CronogramaEditor from '@/components/projeto/CronogramaEditor'
import FinanceiroTab from '@/components/projeto/FinanceiroTab'

const STATUS_BADGE: Record<string, string> = {
  PROPOSTA: 'badge-proposta', TRIAGEM: 'badge-triagem', COMITE_IDEIAS: 'badge-comite',
  VIABILIDADE: 'badge-viabilidade', COMPLEMENTACAO_TAP: 'badge-viabilidade',
  APROVACAO: 'badge-aprovacao', ESTRUTURACAO: 'badge-estruturacao',
  CRONOGRAMA: 'badge-cronograma', EXECUCAO: 'badge-execucao',
  GOLIVE: 'badge-golive', ROI: 'badge-roi', ENCERRAMENTO: 'badge-encerramento',
  CANCELADO: 'badge-cancelado', SUSPENSO: 'badge-cancelado',
}

interface TapVersao {
  id: number; versao: number; label: string; fase_origem: string; status: string
  objetivo_detalhado?: string; situacao_atual?: string
  escopo_fisico?: string; escopo_sistemico?: string; escopo_processo?: string
  setores_envolvidos?: string; etapas_projeto?: string
  entregaveis?: string; pontos_atencao?: string; pontos_definir?: string
  beneficios_tap?: string; escopo_inicial?: string; escopo_fora?: string
  investimento_total?: number; roi_previsto?: number; payback_meses?: number
  criador_nome?: string; aprovador_nome?: string; created_at: string
}

interface HistoricoItem {
  id: number; status_de: string; status_para: string; motivo: string
  usuario_nome: string; created_at: string
}

interface PrioridadeItem {
  id: number; prioridade_de: string; prioridade_para: string; motivo: string
  usuario_nome: string; created_at: string
}

interface Props {
  projeto: Projeto
  historicoStatus: HistoricoItem[]
  historicoPrioridade: PrioridadeItem[]
  tapVersoes: TapVersao[]
  triagem: { escopo_inicial: string; escopo_fora: string; beneficios: string; classificacao: string; complexidade: string } | null
  viabilidadeData: Record<string, unknown> | null
  cronogramaData: Record<string, unknown> | null
  cronogramaTarefas: Record<string, unknown>[]
  lancamentos: { id: number; tipo: string; descricao: string; valor: number; data_lancamento: string; criador_nome: string }[]
  aprovacoesProjeto: Record<string, unknown>[]
  capexRealizado: number
  opexRealizado: number
  diretorias: { id: number; nome: string; sigla: string }[]
  areas: { id: number; nome: string; diretoria_id: number }[]
  usuarios: { id: number; nome: string; cargo: string }[]
  session: SessionUser
}

const TABS = ['Visão Geral', 'Timeline', 'TAP', 'Viabilidade', 'Cronograma', 'Financeiro', 'Histórico']

export default function ProjetoDetalheClient(props: Props) {
  const {
    projeto, historicoStatus, historicoPrioridade, tapVersoes,
    triagem, viabilidadeData, lancamentos,
    capexRealizado, opexRealizado, session,
  } = props

  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState('Visão Geral')
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const [novoStatus, setNovoStatus] = useState('')
  const [motivoStatus, setMotivoStatus] = useState('')
  const [loadingStatus, setLoadingStatus] = useState(false)

  const podeGerenciar = ['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)
  const podeAprovar   = ['ADMIN', 'PMO', 'DIRETOR', 'CEO'].includes(session.perfil)

  const idx = STATUS_ORDER.indexOf(projeto.status)
  const progresso = idx >= 0 ? Math.round(((idx + 1) / STATUS_ORDER.length) * 100) : 0

  async function avancarStatus() {
    if (!novoStatus) return
    setLoadingStatus(true)
    try {
      await fetch(`/api/projetos/${projeto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus, motivo: motivoStatus }),
      })
      setMudandoStatus(false)
      router.refresh()
    } finally {
      setLoadingStatus(false)
    }
  }

  const capexSaldo = projeto.capex_aprovado - capexRealizado
  const opexSaldo  = projeto.opex_aprovado  - opexRealizado
  const tapAtual   = tapVersoes[0] ?? null

  return (
    <div className="animate-fade-in">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="mb-6">
        <button className="btn-ghost text-sm mb-3" onClick={() => router.back()}>
          <ArrowLeft size={15} /> Projetos
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="font-mono text-megag-azul font-bold text-sm bg-megag-azul/10 px-2 py-1 rounded">
                {projeto.codigo}
              </span>
              <span className={`badge ${STATUS_BADGE[projeto.status] || 'badge-proposta'}`}>
                {STATUS_LABELS[projeto.status]}
              </span>
              <span className={`badge badge-${projeto.prioridade.toLowerCase()}`}>
                {PRIORIDADE_LABELS[projeto.prioridade]}
              </span>
              {tapAtual && (
                <span className={`badge text-xs ${
                  tapAtual.status === 'APROVADO'
                    ? 'bg-green-100 text-green-700'
                    : tapAtual.status === 'PENDENTE_APROVACAO'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  TAP {tapAtual.status === 'APROVADO' ? '✓' : tapAtual.status === 'PENDENTE_APROVACAO' ? '⏳' : '—'}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold font-display text-megag-preto">{projeto.nome}</h1>
            <p className="text-sm text-megag-cinza-texto mt-1">
              {projeto.diretoria_nome}
              {projeto.area_nome ? ` • ${projeto.area_nome}` : ''}
              {projeto.gerente_nome ? ` • Gerente: ${projeto.gerente_nome}` : ''}
            </p>
          </div>

          {podeGerenciar && (
            <button className="btn-primary text-sm" onClick={() => setMudandoStatus(true)}>
              <ChevronRight size={15} /> Avançar Status
            </button>
          )}
        </div>

        {/* Barra de progresso compacta */}
        <div className="mt-4 bg-megag-cinza-claro rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-xs font-semibold text-megag-cinza-texto whitespace-nowrap">Ciclo de Vida</span>
          <div className="flex-1 bg-megag-cinza-medio rounded-full h-2">
            <div
              className="bg-gradient-megag h-2 rounded-full transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <span className="text-xs font-bold text-megag-azul whitespace-nowrap">{progresso}%</span>
          <button
            className="text-xs text-megag-azul underline whitespace-nowrap"
            onClick={() => setAbaAtiva('Timeline')}
          >
            Ver timeline →
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div className="tab-list mb-0 overflow-x-auto flex-nowrap">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-item whitespace-nowrap ${abaAtiva === tab ? 'active' : ''}`}
            onClick={() => setAbaAtiva(tab)}
          >
            {tab}
            {tab === 'TAP' && tapAtual?.status === 'PENDENTE_APROVACAO' && (
              <span className="ml-1.5 inline-flex w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ──────────────────────────────────────── */}

      {/* VISÃO GERAL */}
      {abaAtiva === 'Visão Geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="card-header"><span className="card-title">Dados do Projeto</span></div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Solicitante',       projeto.solicitante_nome],
                  ['Ponto Focal',       projeto.ponto_focal || '—'],
                  ['Contato',           projeto.contato    || '—'],
                  ['Gerente',           projeto.gerente_nome || 'Não definido'],
                  ['Previsão Início',   projeto.data_inicio_prev ? new Date(projeto.data_inicio_prev).toLocaleDateString('pt-BR') : '—'],
                  ['Previsão Entrega',  projeto.data_fim_prev   ? new Date(projeto.data_fim_prev).toLocaleDateString('pt-BR')   : '—'],
                  ['Classificação',     projeto.classificacao?.replace('_', ' ') || '—'],
                  ['Complexidade',      projeto.complexidade || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs font-semibold text-megag-cinza-texto uppercase tracking-wide">{k}</p>
                    <p className="text-megag-preto font-medium mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Objetivo</span></div>
              <p className="text-sm text-megag-cinza-escuro leading-relaxed">{projeto.objetivo}</p>
            </div>

            {projeto.descricao && (
              <div className="card">
                <div className="card-header"><span className="card-title">Descrição</span></div>
                <p className="text-sm text-megag-cinza-escuro leading-relaxed">{projeto.descricao}</p>
              </div>
            )}

            {projeto.beneficios && (
              <div className="card">
                <div className="card-header"><span className="card-title">Benefícios Esperados</span></div>
                <p className="text-sm text-megag-cinza-escuro leading-relaxed">{projeto.beneficios}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Resumo financeiro */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Financeiro</span>
                <button className="text-xs text-megag-azul" onClick={() => setAbaAtiva('Financeiro')}>
                  Ver tudo →
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'CAPEX Aprovado', planejado: projeto.capex_aprovado, realizado: capexRealizado },
                  { label: 'OPEX Aprovado',  planejado: projeto.opex_aprovado,  realizado: opexRealizado  },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-megag-cinza-texto">{item.label}</span>
                      <span className="text-xs text-megag-cinza-texto">
                        {item.planejado > 0 ? Math.round((item.realizado / item.planejado) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-megag-cinza-medio rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${item.realizado > item.planejado ? 'bg-red-400' : 'bg-megag-azul'}`}
                        style={{ width: `${Math.min(100, item.planejado > 0 ? (item.realizado / item.planejado) * 100 : 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-megag-cinza-texto mt-1">
                      <span>R$ {item.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      <span>/ R$ {item.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TAP resumo */}
            {tapVersoes.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">TAP</span>
                  <button className="text-xs text-megag-azul" onClick={() => setAbaAtiva('TAP')}>
                    Abrir →
                  </button>
                </div>
                <div className="space-y-2">
                  {tapVersoes.slice(0, 3).map(tap => (
                    <div key={tap.id} className="flex items-center justify-between p-2 bg-megag-cinza-claro rounded-lg">
                      <div>
                        <p className="text-sm font-semibold text-megag-preto">{tap.label}</p>
                        <p className="text-xs text-megag-cinza-texto">{tap.fase_origem}</p>
                      </div>
                      <span className={`badge text-xs ${
                        tap.status === 'APROVADO'
                          ? 'bg-green-100 text-green-700'
                          : tap.status === 'PENDENTE_APROVACAO'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tap.status === 'PENDENTE_APROVACAO' ? 'Pendente' : tap.status === 'APROVADO' ? 'Aprovado' : 'Rascunho'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Triagem */}
            {triagem && (
              <div className="card">
                <div className="card-header"><span className="card-title">Triagem</span></div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="input-label">Classificação</p>
                    <p>{triagem.classificacao?.replace('_', ' ') || '—'}</p>
                  </div>
                  <div>
                    <p className="input-label">Complexidade</p>
                    <p>{triagem.complexidade || '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TIMELINE */}
      {abaAtiva === 'Timeline' && (
        <div className="mt-4">
          <ProjectTimeline
            statusAtual={projeto.status}
            historicoStatus={historicoStatus}
          />
        </div>
      )}

      {/* TAP */}
      {abaAtiva === 'TAP' && (
        <div className="mt-4">
          <TapEditor
            tap={tapAtual}
            projetoId={projeto.id}
            projetoNome={projeto.nome}
            projetoCodigo={projeto.codigo}
            canEdit={podeGerenciar}
            canApprove={podeAprovar}
            onRefresh={() => router.refresh()}
          />
          {tapVersoes.length > 1 && (
            <div className="card mt-4">
              <div className="card-header"><span className="card-title">Versões Anteriores</span></div>
              <div className="space-y-2">
                {tapVersoes.slice(1).map(tap => (
                  <div key={tap.id} className="flex items-center justify-between p-3 bg-megag-cinza-claro rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-megag-preto">{tap.label}</p>
                      <p className="text-xs text-megag-cinza-texto">
                        {tap.fase_origem} • {new Date(tap.created_at).toLocaleDateString('pt-BR')}
                        {tap.criador_nome ? ` • ${tap.criador_nome}` : ''}
                      </p>
                    </div>
                    <span className={`badge text-xs ${tap.status === 'APROVADO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {tap.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIABILIDADE */}
      {abaAtiva === 'Viabilidade' && (
        <div className="mt-4">
          <ViabilidadeEditor
            viabilidade={viabilidadeData as never}
            projetoId={projeto.id}
            canEdit={podeGerenciar}
            canApprove={podeAprovar}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}

      {/* CRONOGRAMA */}
      {abaAtiva === 'Cronograma' && (
        <div className="mt-4">
          <CronogramaEditor
            projetoId={projeto.id}
            canEdit={podeGerenciar}
            canApprove={podeAprovar}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}

      {/* FINANCEIRO */}
      {abaAtiva === 'Financeiro' && (
        <div className="mt-4">
          <FinanceiroTab
            projetoId={projeto.id}
            capexAprovado={projeto.capex_aprovado}
            opexAprovado={projeto.opex_aprovado}
            canEdit={podeGerenciar}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}

      {/* HISTÓRICO */}
      {abaAtiva === 'Histórico' && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header"><span className="card-title">Histórico de Status</span></div>
            <div className="space-y-0">
              {historicoStatus.length === 0 ? (
                <p className="text-megag-cinza-texto text-sm text-center py-4">Sem histórico ainda.</p>
              ) : historicoStatus.map((h) => (
                <div key={h.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="ml-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge badge-proposta text-xs">
                        {STATUS_LABELS[h.status_de as keyof typeof STATUS_LABELS] || h.status_de}
                      </span>
                      <span className="text-megag-cinza-texto text-xs">→</span>
                      <span className={`badge ${STATUS_BADGE[h.status_para] || 'badge-proposta'} text-xs`}>
                        {STATUS_LABELS[h.status_para as keyof typeof STATUS_LABELS] || h.status_para}
                      </span>
                    </div>
                    {h.motivo && <p className="text-xs text-megag-cinza-escuro">{h.motivo}</p>}
                    <p className="text-xs text-megag-cinza-texto mt-0.5">
                      {h.usuario_nome} • {new Date(h.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Histórico de Prioridade</span></div>
            <div className="space-y-0">
              {historicoPrioridade.length === 0 ? (
                <p className="text-megag-cinza-texto text-sm text-center py-4">Sem alterações de prioridade.</p>
              ) : historicoPrioridade.map((h) => (
                <div key={h.id} className="timeline-item">
                  <div className="timeline-dot bg-megag-dourado" />
                  <div className="ml-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge badge-${h.prioridade_de.toLowerCase()} text-xs`}>{h.prioridade_de}</span>
                      <span className="text-megag-cinza-texto text-xs">→</span>
                      <span className={`badge badge-${h.prioridade_para.toLowerCase()} text-xs`}>{h.prioridade_para}</span>
                    </div>
                    {h.motivo && <p className="text-xs text-megag-cinza-escuro">{h.motivo}</p>}
                    <p className="text-xs text-megag-cinza-texto mt-0.5">
                      {h.usuario_nome} • {new Date(h.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lançamentos recentes */}
          {lancamentos.length > 0 && (
            <div className="lg:col-span-2 card p-0 overflow-hidden">
              <div className="p-4 border-b border-megag-cinza-medio flex items-center justify-between">
                <h3 className="card-title">Últimos Lançamentos Financeiros</h3>
                <button className="text-xs text-megag-azul" onClick={() => setAbaAtiva('Financeiro')}>
                  Ver todos →
                </button>
              </div>
              <table className="table-megag">
                <thead>
                  <tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Data</th><th>Por</th></tr>
                </thead>
                <tbody>
                  {lancamentos.slice(0, 5).map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className={`badge text-xs ${l.tipo === 'CAPEX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {l.tipo}
                        </span>
                      </td>
                      <td className="text-sm">{l.descricao}</td>
                      <td className="font-semibold">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="text-sm">{new Date(l.data_lancamento).toLocaleDateString('pt-BR')}</td>
                      <td className="text-sm text-megag-cinza-texto">{l.criador_nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Avançar Status ─────────────────────────── */}
      {mudandoStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMudandoStatus(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-megag-lg animate-fade-in">
            <h3 className="font-bold font-display text-lg text-megag-preto mb-4">Alterar Status</h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Novo Status</label>
                <select value={novoStatus} onChange={e => setNovoStatus(e.target.value)} className="input">
                  <option value="">Selecionar...</option>
                  {STATUS_ORDER.filter(s => s !== projeto.status).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                  <option value="CANCELADO">Cancelado</option>
                  <option value="SUSPENSO">Suspenso</option>
                </select>
              </div>
              <div>
                <label className="input-label">Motivo (opcional)</label>
                <textarea
                  value={motivoStatus}
                  onChange={e => setMotivoStatus(e.target.value)}
                  className="input resize-none" rows={3}
                  placeholder="Justificativa para a mudança..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setMudandoStatus(false)}>Cancelar</button>
              <button
                className="btn-primary flex-1"
                onClick={avancarStatus}
                disabled={!novoStatus || loadingStatus}
              >
                {loadingStatus ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
