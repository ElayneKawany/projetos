'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, AlertTriangle,
  DollarSign, Clock, TrendingUp, History, Info, Pencil
} from 'lucide-react'
import type { Projeto } from '@/types'
import { STATUS_LABELS, PRIORIDADE_LABELS, STATUS_ORDER } from '@/types'
import type { SessionUser } from '@/lib/auth'
import ProjectTimeline from '@/components/projeto/ProjectTimeline'
import TapEditor from '@/components/projeto/TapEditor'
import ViabilidadeEditor from '@/components/projeto/ViabilidadeEditor'
import CronogramaEditor from '@/components/projeto/CronogramaEditor'
import FinanceiroTab from '@/components/projeto/FinanceiroTab'
import PaybackTab from '@/components/projeto/PaybackTab'
import ConcluirProjetoModal from '@/components/projeto/ConcluirProjetoModal'
import CicloVidaTimeline from '@/components/projeto/CicloVidaTimeline'

/** Formata campo DATE (YYYY-MM-DD) sem criar objeto Date — evita deslocamento de fuso horário */
function fmtDataBR(d: string | null | undefined): string {
  if (!d) return '—'
  const s = d.slice(0, 10)
  const [y, m, day] = s.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}

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

const CAMPO_LABELS: Record<string, string> = {
  nome: 'Nome', ponto_focal: 'Ponto Focal', contato: 'Contato',
  objetivo: 'Objetivo', justificativa: 'Justificativa', descricao: 'Descrição',
  beneficios: 'Benefícios', gerente_id: 'Gerente', capex_aprovado: 'CAPEX Aprovado',
  opex_aprovado: 'OPEX Aprovado', data_inicio_prev: 'Previsão de Início',
  data_fim_prev: 'Previsão de Entrega', classificacao: 'Classificação',
  complexidade: 'Complexidade', prioridade: 'Prioridade', status: 'Status',
  tap_status: 'Status da TAP', viabilidade_status: 'Status do Estudo de Viabilidade',
  viabilidade_capex: 'CAPEX (Viabilidade)', viabilidade_opex: 'OPEX (Viabilidade)',
  viabilidade_opex_periodicidade: 'Periodicidade do OPEX',
  viabilidade_economia_estimada: 'Economia Estimada', viabilidade_economia_periodicidade: 'Periodicidade da Economia',
  viabilidade_tipo_payback: 'Tipo de Payback', viabilidade_payback_informado: 'Payback Informado',
  viabilidade_payback_unidade: 'Unidade do Payback',
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

interface HistoricoStatusItem {
  id: number; status_de: string; status_para: string; motivo: string
  usuario_nome: string; created_at: string
}

interface HistoricoPrioridadeItem {
  id: number; prioridade_de: string; prioridade_para: string; motivo: string
  usuario_nome: string; created_at: string
}

interface HistoricoAlteracaoItem {
  id: number; campo: string; valor_anterior: string | null; valor_novo: string | null
  usuario_nome: string | null; acao: string; created_at: string
}

interface ConfigStatusItem {
  id: number; codigo: string; label: string; cor: string; ordem: number
  ativo: number; is_initial: number
}

interface Props {
  projeto: Projeto
  historicoStatus: HistoricoStatusItem[]
  historicoPrioridade: HistoricoPrioridadeItem[]
  historicoAlteracoes: HistoricoAlteracaoItem[]
  configStatus: ConfigStatusItem[]
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
  workflowTap: import('@/lib/workflow').WorkflowAprovacao | null
  workflowViabilidade: import('@/lib/workflow').WorkflowAprovacao | null
  workflowCronograma: import('@/lib/workflow').WorkflowAprovacao | null
  cronogramaAprovadoData: { data_fim_prev?: string } | null
  snapshotFinal: {
    roi_previsto: number | null; roi_atual: number | null
    capex_previsto: number | null; capex_executado: number | null
    opex_previsto: number | null; opex_executado: number | null
    economia_prevista: number | null; economia_realizada: number | null
    data_fim_prev: string | null; data_conclusao_real: string | null
    dias_desvio: number | null; responsavel: string | null; created_at: string
  } | null
  tarefasPendentes: number
  initialTab?: string
  session: SessionUser
}

interface DashboardData {
  cronograma: { total: number; concluidas: number; atrasadas: number; pct: number }
  financeiro: {
    capex_planejado: number; capex_realizado: number; capex_saldo: number; capex_pct: number
    opex_planejado: number; opex_realizado: number; opex_saldo: number; opex_pct: number
    total_planejado: number; total_realizado: number; total_saldo: number; total_pct: number
  }
  payback: { pct: number; label: string; is_concluido: boolean }
}

function resolveInitialTab(tab?: string): string {
  if (tab === 'TAP') return 'TAP'
  if (tab === 'viabilidade') return 'Estudo de Viabilidade'
  if (tab === 'cronograma') return 'Cronograma'
  return 'Visão Geral'
}

// Ordem das abas conforme especificação 001
const TABS = [
  'Visão Geral',
  'TAP',
  'Estudo de Viabilidade',
  'Cronograma',
  'Financeiro',
  'Acompanhamento de Payback',
  'Timeline',
]

export default function ProjetoDetalheClient(props: Props) {
  const {
    projeto, historicoStatus, historicoPrioridade, historicoAlteracoes,
    configStatus, tapVersoes, triagem, viabilidadeData, cronogramaData, lancamentos,
    capexRealizado, opexRealizado, usuarios, session, aprovacoesProjeto,
    workflowTap, workflowViabilidade, workflowCronograma, cronogramaAprovadoData,
    snapshotFinal, tarefasPendentes, initialTab,
  } = props

  const sessionUser = { id: session.id, nome: session.nome }

  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState(() => resolveInitialTab(initialTab))
  const podeGerenciar = ['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)
  const podeSubmeter  = ['ADMIN', 'PMO'].includes(session.perfil)

  const [modalConcluir, setModalConcluir] = useState(false)
  const [iniciandoPayback, setIniciandoPayback] = useState(false)
  const [encerrando, setEncerrando] = useState(false)

  // Visão Geral — edição
  const [editandoVG, setEditandoVG] = useState(false)
  const [salvandoVG, setSalvandoVG] = useState(false)
  const [erroVG, setErroVG] = useState<string | null>(null)

  const vgInicial = {
    nome: projeto.nome,
    descricao: projeto.descricao ?? '',
    objetivo: projeto.objetivo,
    solicitante_id: String(projeto.solicitante_id ?? ''),
    contato: projeto.contato ?? '',
    gerente_id: projeto.gerente_id ?? '',
    pmo_responsavel_id: projeto.pmo_responsavel_id ?? '',
    ponto_focal: projeto.ponto_focal ?? '',
    diretoria_id: String(projeto.diretoria_id ?? ''),
    area_id: String(projeto.area_id ?? ''),
    prioridade: projeto.prioridade,
    tipo_beneficio: projeto.tipo_beneficio ?? '',
    data_inicio_prev: projeto.data_inicio_prev ?? '',
    data_fim_prev: projeto.data_fim_prev ?? '',
    complexidade: projeto.complexidade ?? '',
    classificacao: projeto.classificacao ?? '',
  }
  const [formVG, setFormVG] = useState(vgInicial)
  const [vgOriginal, setVgOriginal] = useState<typeof vgInicial | null>(null)

  const VG_OBRIGATORIOS = ['nome', 'descricao', 'objetivo', 'solicitante_id', 'diretoria_id', 'area_id', 'gerente_id', 'pmo_responsavel_id', 'prioridade', 'tipo_beneficio'] as const
  const canSaveVG = VG_OBRIGATORIOS.every(c => String(formVG[c] ?? '').trim() !== '')

  function vgFieldCls(campo: keyof typeof vgInicial, required = false): string {
    const changed = vgOriginal != null && String(formVG[campo] ?? '') !== String(vgOriginal[campo] ?? '')
    const empty = required && !String(formVG[campo] ?? '').trim()
    if (empty) return 'input ring-2 ring-red-400 focus:ring-red-500'
    if (changed) return 'input ring-2 ring-blue-400 focus:ring-blue-500'
    return 'input'
  }

  // Projeto encerrado bloqueia edição de artefatos (TAP, Viabilidade, Cronograma)
  // Exceção: projeto_migrado = 1 libera edição temporária para conclusão do cadastro histórico
  const projetoConcluido = ['PROJETO_CONCLUIDO', 'PAYBACK_ACOMPANHAMENTO', 'PAYBACK_ENCERRADO', 'PROJETO_ENCERRADO'].includes(projeto.status)
  const projetoEncerrado = ['PAYBACK_ENCERRADO', 'PROJETO_ENCERRADO'].includes(projeto.status)
  const canEditArtefatos = podeGerenciar && (!projetoConcluido || !!projeto.projeto_migrado)

  const [dashData, setDashData] = useState<DashboardData | null>(null)

  useEffect(() => {
    const fetchDash = () =>
      fetch(`/api/projetos/${projeto.id}/dashboard`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setDashData(d) })
        .catch(() => {})

    fetchDash()
    const timer = setInterval(fetchDash, 30_000)
    return () => clearInterval(timer)
  }, [projeto.id])

  const tapAtual         = tapVersoes[0] ?? null
  const viabilidadeAtual = viabilidadeData as { status?: string } | null
  const cronogramaAtual  = cronogramaData  as { status?: string } | null
  const cronogramaAprovado = cronogramaAtual?.status === 'APROVADO'

  // Validação: verifica se o status atual existe e está ativo na configuração
  const statusConfig = configStatus.find(s => s.codigo === projeto.status)
  const statusInexistente = !statusConfig
  const statusInativo     = statusConfig ? statusConfig.ativo === 0 : false
  const statusInvalido    = statusInexistente || statusInativo

  const idx = STATUS_ORDER.indexOf(projeto.status)
  const progresso = idx >= 0 ? Math.round(((idx + 1) / STATUS_ORDER.length) * 100) : 0

  // Statuses disponíveis para movimentação (apenas ativos na config)

  const capexSaldo = projeto.capex_aprovado - capexRealizado
  const opexSaldo  = projeto.opex_aprovado  - opexRealizado

  // ── Indicador de Saúde do Projeto ──────────────────────────────────────────
  const allTasks = props.cronogramaTarefas as { nivel: string; data_conclusao: string | null; data_fim: string | null; status: string }[]
  const hoje = new Date().toISOString().slice(0, 10)
  const totalTasks     = dashData ? dashData.cronograma.total     : allTasks.length
  const concludedTasks = dashData ? dashData.cronograma.concluidas : allTasks.filter(t => t.data_conclusao || t.status === 'CONCLUIDA').length
  const overdueTasks   = dashData ? dashData.cronograma.atrasadas  : allTasks.filter(t => !t.data_conclusao && t.status !== 'CONCLUIDA' && t.data_fim && t.data_fim < hoje).length
  const overduePct     = totalTasks > 0 ? overdueTasks / totalTasks : 0

  // Financeiro — use live API data when available
  const capexPlanejado  = dashData ? dashData.financeiro.capex_planejado  : (projeto.capex_aprovado ?? 0)
  const opexPlanejado   = dashData ? dashData.financeiro.opex_planejado   : (projeto.opex_aprovado  ?? 0)
  const capexRealiz     = dashData ? dashData.financeiro.capex_realizado  : capexRealizado
  const opexRealiz      = dashData ? dashData.financeiro.opex_realizado   : opexRealizado
  const totalAprovado   = capexPlanejado + opexPlanejado
  const totalRealizado  = capexRealiz + opexRealiz
  const financPct       = totalAprovado > 0 ? totalRealizado / totalAprovado : 0
  const capexSaldoCalc  = dashData ? dashData.financeiro.capex_saldo : (capexPlanejado - capexRealiz)
  const opexSaldoCalc   = dashData ? dashData.financeiro.opex_saldo  : (opexPlanejado  - opexRealiz)

  // Payback — use live API data when available
  const paybackPct   = dashData ? dashData.payback.pct   : (projetoEncerrado ? 100 : 0)
  const paybackLabel = dashData ? dashData.payback.label : (projetoConcluido ? 'Em acompanhamento' : 'Disponível após conclusão')

  type Saude = '🟢' | '🟡' | '🔴'
  let saude: Saude = '🟢'
  let saudeLabel = 'Saudável'
  let saudeColor = 'text-green-700 bg-green-50 border-green-200'

  if (overduePct > 0.20 || financPct > 1.10) {
    saude = '🔴'; saudeLabel = 'Crítico'; saudeColor = 'text-red-700 bg-red-50 border-red-200'
  } else if (overduePct > 0 || financPct > 0.80) {
    saude = '🟡'; saudeLabel = 'Atenção'; saudeColor = 'text-amber-700 bg-amber-50 border-amber-200'
  }

  // Prazo: usa data_fim_efetiva (campo oficial per lib/guards/data-fim-prev.guard.ts)
  // null = sem cronograma, não exibir badge
  const prazoAtrasado: boolean | null = projeto.data_fim_efetiva
    ? projeto.data_fim_efetiva < hoje
    : null

  // ── KPIs de progresso ──────────────────────────────────────────────────────
  const cronogramaPct = dashData ? dashData.cronograma.pct : (totalTasks > 0 ? Math.round((concludedTasks / totalTasks) * 100) : 0)
  const financeiroPct = dashData ? dashData.financeiro.total_pct : (totalAprovado > 0 ? Math.min(100, Math.round((totalRealizado / totalAprovado) * 100)) : 0)

  // ── Status do Cronograma ───────────────────────────────────────────────────
  const statusCronograma = (() => {
    if (!cronogramaAprovado) return 'SEM_CRONOGRAMA'
    const hj = new Date(); hj.setHours(0,0,0,0)
    const dataFimStr = projeto.data_fim_efetiva
    const dataFim = dataFimStr ? new Date(dataFimStr) : null
    if (dataFim) {
      const df = new Date(dataFim); df.setHours(0,0,0,0)
      if (df < hj) return 'ATRASADO'
      const dias = Math.round((df.getTime() - hj.getTime()) / 86400000)
      if (overdueTasks > 0 || dias <= 10) return 'ATENCAO'
    } else if (overdueTasks > 0) {
      return 'ATENCAO'
    }
    return 'NO_PRAZO'
  })()

  const STATUS_CRON_CFG: Record<string, { emoji: string; label: string; cls: string }> = {
    NO_PRAZO:       { emoji: '🟢', label: 'No Prazo',       cls: 'text-green-700 bg-green-50 border-green-200' },
    ATENCAO:        { emoji: '🟡', label: 'Atenção',        cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    ATRASADO:       { emoji: '🔴', label: 'Atrasado',       cls: 'text-red-700 bg-red-50 border-red-200' },
    SEM_CRONOGRAMA: { emoji: '⚪', label: 'Sem Cronograma', cls: 'text-gray-600 bg-gray-50 border-gray-200' },
  }
  const scCfg = STATUS_CRON_CFG[statusCronograma]

  // Dias restantes ou de atraso
  const diasInfo = (() => {
    const dataFimPrev = projeto.data_fim_efetiva
    if (!dataFimPrev) return null
    const hj = new Date(); hj.setHours(0,0,0,0)
    const df = new Date(dataFimPrev); df.setHours(0,0,0,0)
    const diff = Math.round((df.getTime() - hj.getTime()) / 86400000)
    if (diff < 0) return `${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''} de atraso`
    if (diff === 0) return 'Entrega hoje'
    return `${diff} dia${diff !== 1 ? 's' : ''} restante${diff !== 1 ? 's' : ''}`
  })()

  async function salvarVG() {
    setErroVG(null)
    if (!canSaveVG) {
      setErroVG('Preencha todos os campos obrigatórios antes de salvar.')
      return
    }
    setSalvandoVG(true)
    try {
      const res = await fetch(`/api/projetos/${projeto.id}/visao-geral`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formVG,
          solicitante_id: formVG.solicitante_id !== '' ? Number(formVG.solicitante_id) : null,
          gerente_id: formVG.gerente_id !== '' ? Number(formVG.gerente_id) : null,
          pmo_responsavel_id: formVG.pmo_responsavel_id !== '' ? Number(formVG.pmo_responsavel_id) : null,
          diretoria_id: formVG.diretoria_id !== '' ? Number(formVG.diretoria_id) : null,
          area_id: formVG.area_id !== '' ? Number(formVG.area_id) : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErroVG(d.error ?? 'Erro ao salvar.')
      } else {
        setEditandoVG(false)
        setVgOriginal(null)
        router.refresh()
      }
    } catch {
      setErroVG('Falha na comunicação com o servidor.')
    } finally {
      setSalvandoVG(false)
    }
  }

  function cancelarVG() {
    setFormVG(vgInicial)
    setVgOriginal(null)
    setErroVG(null)
    setEditandoVG(false)
  }

  const areasFiltradas = props.areas.filter(a => !formVG.diretoria_id || String(a.diretoria_id) === formVG.diretoria_id)

  return (
    <div className="animate-fade-in">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="mb-6">
        <button className="btn-ghost text-sm mb-3" onClick={() => router.back()}>
          <ArrowLeft size={15} /> Projetos
        </button>

        {/* Alerta: status inválido */}
        {statusInvalido && (
          <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {statusInexistente
                  ? `Status "${projeto.status}" não existe na configuração`
                  : `Status "${statusConfig?.label ?? projeto.status}" está inativo`}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                As movimentações de status estão bloqueadas. Um administrador deve corrigir a configuração de status ou atualizar este projeto.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="font-mono text-megag-azul font-bold text-sm bg-megag-azul/10 px-2 py-1 rounded">
                {projeto.codigo}
              </span>
              <span className={`badge ${STATUS_BADGE[projeto.status] || 'badge-proposta'}`}>
                {statusConfig?.label ?? STATUS_LABELS[projeto.status] ?? projeto.status}
                {statusInativo && <span className="ml-1 text-amber-600">⚠</span>}
              </span>
              <span className={`badge badge-${projeto.prioridade.toLowerCase()}`}>
                {PRIORIDADE_LABELS[projeto.prioridade]}
              </span>
              {/* Saúde do Projeto — apenas durante execução */}
              {['EXECUCAO', 'PROJETO_CONCLUIDO', 'PAYBACK_ACOMPANHAMENTO'].includes(projeto.status) && (
                <span className={`badge border text-xs ${saudeColor}`}>
                  {saude} {saudeLabel}
                </span>
              )}
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
              {viabilidadeAtual && (
                <span className={`badge text-xs ${
                  viabilidadeAtual.status === 'APROVADO'
                    ? 'bg-green-100 text-green-700'
                    : viabilidadeAtual.status === 'PENDENTE_APROVACAO'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  Viabilidade {viabilidadeAtual.status === 'APROVADO' ? '✓' : viabilidadeAtual.status === 'PENDENTE_APROVACAO' ? '⏳' : '—'}
                </span>
              )}
              {cronogramaAtual && (
                <span className={`badge text-xs ${
                  cronogramaAtual.status === 'APROVADO'
                    ? 'bg-green-100 text-green-700'
                    : cronogramaAtual.status === 'PENDENTE_APROVACAO'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  Cronograma {cronogramaAtual.status === 'APROVADO' ? '✓' : cronogramaAtual.status === 'PENDENTE_APROVACAO' ? '⏳' : '—'}
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

          {/* Badge prazo — sempre visível */}
          <div className="shrink-0 self-start">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${scCfg.cls}`}>
              {scCfg.emoji} {scCfg.label}
            </span>
          </div>

          {/* Botão Concluir Projeto — visível apenas em EXECUCAO + cronograma aprovado */}
          {podeGerenciar && projeto.status === 'EXECUCAO' && cronogramaAprovado && (
            <div className="shrink-0">
              <button
                className="btn-primary flex items-center gap-2 text-sm"
                onClick={() => setModalConcluir(true)}
              >
                ✓ Concluir Projeto
              </button>
            </div>
          )}

          {/* Botão Iniciar Payback — visível apenas em PROJETO_CONCLUIDO */}
          {podeGerenciar && projeto.status === 'PROJETO_CONCLUIDO' && (
            <div className="shrink-0">
              <button
                className="btn-primary flex items-center gap-2 text-sm"
                disabled={iniciandoPayback}
                onClick={async () => {
                  if (!confirm('Iniciar o Acompanhamento de Payback? O status do projeto será atualizado.')) return
                  setIniciandoPayback(true)
                  try {
                    const res = await fetch(`/api/projetos/${projeto.id}/payback/iniciar`, { method: 'POST' })
                    if (!res.ok) {
                      const d = await res.json()
                      alert(d.error ?? 'Erro ao iniciar payback.')
                    } else {
                      router.refresh()
                    }
                  } catch {
                    alert('Falha na comunicação com o servidor.')
                  } finally {
                    setIniciandoPayback(false)
                  }
                }}
              >
                {iniciandoPayback ? 'Iniciando…' : '▶ Iniciar Payback'}
              </button>
            </div>
          )}

          {/* Botão Encerrar Projeto — visível apenas em PAYBACK_ENCERRADO para PMO/ADMIN */}
          {['ADMIN','PMO'].includes(session.perfil) && projeto.status === 'PAYBACK_ENCERRADO' && (
            <div className="shrink-0">
              <button
                className="btn-primary flex items-center gap-2 text-sm"
                disabled={encerrando}
                onClick={async () => {
                  const motivo = prompt('Motivo do encerramento oficial (opcional):') ?? ''
                  if (!confirm('Encerrar o projeto oficialmente? Esta ação é irreversível.')) return
                  setEncerrando(true)
                  try {
                    const res = await fetch(`/api/projetos/${projeto.id}/encerrar`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ motivo }),
                    })
                    if (!res.ok) {
                      const d = await res.json()
                      alert(d.error ?? 'Erro ao encerrar projeto.')
                    } else {
                      router.refresh()
                    }
                  } catch {
                    alert('Falha na comunicação com o servidor.')
                  } finally {
                    setEncerrando(false)
                  }
                }}
              >
                {encerrando ? 'Encerrando…' : '■ Encerrar Projeto'}
              </button>
            </div>
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

      {/* ── Linha do Ciclo de Vida ───────────────────────── */}
      <CicloVidaTimeline
        statusAtual={projeto.status}
        historicoStatus={historicoStatus as never[]}
        temViabilidadeAprovada={viabilidadeAtual?.status === 'APROVADO'}
        temCronogramaAprovado={cronogramaAprovado}
      />

      {/* ── Banner de Revisão Pendente ──────────────────── */}
      {(() => {
        const tap = tapVersoes[0]
        const via = viabilidadeData as { id?: number; status?: string } | null
        const cron = cronogramaData as { id?: number; status?: string } | null

        const revisoes = (aprovacoesProjeto as {
          id: number; tipo: string; referencia_id: number; status: string
          observacao_apr: string | null; aprovado_em: string | null; aprovador_nome: string | null
        }[]).filter(a => a.status === 'REJEITADO').filter(a =>
          (a.tipo === 'TAP' && tap?.id === a.referencia_id && tap?.status === 'RASCUNHO') ||
          (a.tipo === 'VIABILIDADE' && via?.id === a.referencia_id && via?.status === 'RASCUNHO') ||
          (a.tipo === 'CRONOGRAMA' && cron?.id === a.referencia_id && cron?.status === 'RASCUNHO')
        )

        if (!revisoes.length) return null

        const r = revisoes[0]
        const tipoLabel: Record<string, string> = {
          TAP: 'TAP', VIABILIDADE: 'Estudo de Viabilidade', CRONOGRAMA: 'Cronograma',
        }
        const tabMap: Record<string, string> = {
          TAP: 'TAP', VIABILIDADE: 'Estudo de Viabilidade', CRONOGRAMA: 'Cronograma',
        }

        return (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 mt-2">
            <span className="text-amber-500 text-lg mt-0.5">↩</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-amber-800 text-sm">
                  Revisão solicitada — {tipoLabel[r.tipo] ?? r.tipo}
                </span>
                {r.aprovado_em && (
                  <span className="text-xs text-amber-600">
                    {new Date(r.aprovado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {r.observacao_apr && (
                <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                  &ldquo;{r.observacao_apr}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {r.aprovador_nome && (
                  <span className="text-xs text-amber-600">Aprovador: <strong>{r.aprovador_nome}</strong></span>
                )}
                <button
                  className="text-xs text-amber-800 underline font-medium"
                  onClick={() => setAbaAtiva(tabMap[r.tipo] ?? 'TAP')}
                >
                  Ir para {tipoLabel[r.tipo] ?? r.tipo} →
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
            {/* Dados do Projeto — editável */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Dados do Projeto</span>
                {podeGerenciar && !editandoVG && (
                  <button className="btn-ghost text-sm flex items-center gap-1" onClick={() => {
                    setVgOriginal({ ...formVG })
                    setErroVG(null)
                    setEditandoVG(true)
                  }}>
                    <Pencil size={14} /> Editar
                  </button>
                )}
                {editandoVG && (
                  <div className="flex gap-2 items-center">
                    <button className="btn-ghost text-sm" onClick={cancelarVG}>Cancelar</button>
                    <button className="btn-primary text-sm" disabled={salvandoVG || !canSaveVG} onClick={salvarVG}>
                      {salvandoVG ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                )}
              </div>

              {editandoVG ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {erroVG && (
                    <div className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {erroVG}
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="input-label">Nome <span className="text-red-500">*</span></label>
                    <input type="text" className={vgFieldCls('nome', true)} value={formVG.nome}
                      onChange={e => setFormVG(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="input-label">Objetivo <span className="text-red-500">*</span></label>
                    <textarea rows={3} className={vgFieldCls('objetivo', true)} value={formVG.objetivo}
                      onChange={e => setFormVG(f => ({ ...f, objetivo: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="input-label">Descrição <span className="text-red-500">*</span></label>
                    <textarea rows={2} className={vgFieldCls('descricao', true)} value={formVG.descricao}
                      onChange={e => setFormVG(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Solicitante <span className="text-red-500">*</span></label>
                    <select className={vgFieldCls('solicitante_id', true)} value={formVG.solicitante_id}
                      onChange={e => setFormVG(f => ({ ...f, solicitante_id: e.target.value }))}>
                      <option value="">— Não definido —</option>
                      {props.usuarios.map(u => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Contato</label>
                    <input type="text" className={vgFieldCls('contato')} value={formVG.contato}
                      onChange={e => setFormVG(f => ({ ...f, contato: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Gerente Responsável <span className="text-red-500">*</span></label>
                    <select className={vgFieldCls('gerente_id', true)} value={String(formVG.gerente_id)}
                      onChange={e => setFormVG(f => ({ ...f, gerente_id: e.target.value }))}>
                      <option value="">— Não definido —</option>
                      {props.usuarios.map(u => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">PMO Responsável <span className="text-red-500">*</span></label>
                    <select className={vgFieldCls('pmo_responsavel_id', true)} value={String(formVG.pmo_responsavel_id)}
                      onChange={e => setFormVG(f => ({ ...f, pmo_responsavel_id: e.target.value }))}>
                      <option value="">— Não definido —</option>
                      {props.usuarios.map(u => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Ponto Focal</label>
                    <select className={vgFieldCls('ponto_focal')} value={formVG.ponto_focal}
                      onChange={e => setFormVG(f => ({ ...f, ponto_focal: e.target.value }))}>
                      <option value="">— Não definido —</option>
                      {props.usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Tipo de Benefício <span className="text-red-500">*</span></label>
                    <input type="text" className={vgFieldCls('tipo_beneficio', true)} value={formVG.tipo_beneficio}
                      onChange={e => setFormVG(f => ({ ...f, tipo_beneficio: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Diretoria <span className="text-red-500">*</span></label>
                    <select className={vgFieldCls('diretoria_id', true)} value={formVG.diretoria_id}
                      onChange={e => setFormVG(f => ({ ...f, diretoria_id: e.target.value, area_id: '' }))}>
                      <option value="">— Selecione —</option>
                      {props.diretorias.map(d => <option key={d.id} value={String(d.id)}>{d.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Área <span className="text-red-500">*</span></label>
                    <select className={vgFieldCls('area_id', true)} value={formVG.area_id}
                      onChange={e => setFormVG(f => ({ ...f, area_id: e.target.value }))}>
                      <option value="">— Selecione —</option>
                      {areasFiltradas.map(a => <option key={a.id} value={String(a.id)}>{a.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Prioridade <span className="text-red-500">*</span></label>
                    <select className={vgFieldCls('prioridade', true)} value={formVG.prioridade}
                      onChange={e => setFormVG(f => ({ ...f, prioridade: e.target.value as typeof formVG.prioridade }))}>
                      <option value="ALTA">Alta</option>
                      <option value="MEDIA">Média</option>
                      <option value="BAIXA">Baixa</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Data Prevista de Início</label>
                    <input type="date" className={vgFieldCls('data_inicio_prev')} value={formVG.data_inicio_prev}
                      onChange={e => setFormVG(f => ({ ...f, data_inicio_prev: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Data Prevista de Término</label>
                    <input type="date" className={vgFieldCls('data_fim_prev')} value={formVG.data_fim_prev}
                      onChange={e => setFormVG(f => ({ ...f, data_fim_prev: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Complexidade</label>
                    <select className={vgFieldCls('complexidade')} value={formVG.complexidade}
                      onChange={e => setFormVG(f => ({ ...f, complexidade: e.target.value }))}>
                      <option value="">— Não definida —</option>
                      <option value="BAIXA">Baixa</option>
                      <option value="MEDIA">Média</option>
                      <option value="ALTA">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Classificação</label>
                    <select className={vgFieldCls('classificacao')} value={formVG.classificacao}
                      onChange={e => setFormVG(f => ({ ...f, classificacao: e.target.value }))}>
                      <option value="">— Não definida —</option>
                      <option value="PROJETO">Projeto</option>
                      <option value="MELHORIA_CONTINUA">Melhoria Contínua</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Solicitante',       projeto.solicitante_nome],
                    ['Ponto Focal',       projeto.ponto_focal || '—'],
                    ['Contato',           projeto.contato    || '—'],
                    ['Gerente',           projeto.gerente_nome || 'Não definido'],
                    ['PMO Responsável',   projeto.pmo_responsavel_nome || projeto.pmo_responsavel || '—'],
                    ['Tipo de Benefício', projeto.tipo_beneficio || '—'],
                    ['Previsão Início',   fmtDataBR(projeto.data_inicio_prev)],
                    ['Conclusão (Cronograma)', projeto.data_fim_efetiva ? fmtDataBR(projeto.data_fim_efetiva) : 'Sem cronograma'],
                    ['Classificação',     projeto.classificacao?.replace('_', ' ') || '—'],
                    ['Complexidade',      projeto.complexidade || '—'],
                    ...(projeto.status === 'PAUSADO' ? [
                      ['Motivo da Pausa', projeto.motivo_pausa_nome || '—'],
                      ['Data da Pausa',   fmtDataBR(projeto.data_pausa)],
                    ] : []),
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs font-semibold text-megag-cinza-texto uppercase tracking-wide">{k}</p>
                      <p className="font-medium mt-0.5 text-megag-preto">{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!editandoVG && (
              <>
                <div className="card">
                  <div className="card-header"><span className="card-title">Objetivo</span></div>
                  <p className="text-sm text-megag-cinza-escuro leading-relaxed">{projeto.objetivo}</p>
                </div>

                {projeto.justificativa && (
                  <div className="card">
                    <div className="card-header"><span className="card-title">Justificativa</span></div>
                    <p className="text-sm text-megag-cinza-escuro leading-relaxed">{projeto.justificativa}</p>
                  </div>
                )}

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
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Status do Projeto */}
            <div className={`card border ${scCfg.cls.includes('green') ? 'border-green-200' : scCfg.cls.includes('amber') ? 'border-amber-200' : scCfg.cls.includes('red') ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="card-header">
                <span className="card-title">Status do Projeto</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{scCfg.emoji}</span>
                  <div>
                    <p className={`font-bold text-base ${scCfg.cls.split(' ')[0]}`}>{scCfg.label}</p>
                    {diasInfo && (
                      <p className="text-xs text-megag-cinza-texto mt-0.5">{diasInfo}</p>
                    )}
                    {!projeto.data_fim_efetiva && statusCronograma !== 'SEM_CRONOGRAMA' && (
                      <p className="text-xs text-megag-cinza-texto mt-0.5">Sem data de entrega definida</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Executivo — 3 cards de progresso */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Dashboard Executivo</span>
              </div>
              <div className="p-3 space-y-3">
                {[
                  {
                    label: 'Cronograma',
                    pct: cronogramaPct,
                    sub: totalTasks > 0 ? `${concludedTasks} de ${totalTasks} atividades concluídas` : 'Sem atividades',
                    color: overduePct > 0.2 ? 'bg-red-500' : overduePct > 0 ? 'bg-amber-500' : 'bg-green-500',
                    onClick: () => setAbaAtiva('Cronograma'),
                  },
                  {
                    label: 'Financeiro',
                    pct: financeiroPct,
                    sub: `R$ ${totalRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} / R$ ${totalAprovado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
                    color: financPct > 1.1 ? 'bg-red-500' : financPct > 0.8 ? 'bg-amber-500' : 'bg-megag-azul',
                    onClick: () => setAbaAtiva('Financeiro'),
                  },
                  {
                    label: 'Payback',
                    pct: paybackPct,
                    sub: paybackLabel,
                    color: paybackPct > 0 ? 'bg-green-500' : 'bg-gray-300',
                    onClick: () => setAbaAtiva('Acompanhamento de Payback'),
                  },
                ].map(item => (
                  <button key={item.label} className="w-full text-left hover:bg-megag-cinza-claro rounded-lg p-2 transition-colors" onClick={item.onClick}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-megag-cinza-texto">{item.label}</span>
                      <span className="text-xs font-bold text-megag-preto">{item.pct}%</span>
                    </div>
                    <div className="w-full bg-megag-cinza-medio rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <p className="text-[10px] text-megag-cinza-texto mt-0.5">{item.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo CAPEX / OPEX */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Financeiro</span>
                <button className="text-xs text-megag-azul" onClick={() => setAbaAtiva('Financeiro')}>Ver tudo →</button>
              </div>
              <div className="space-y-3 p-4 pt-0">
                {[
                  { label: 'CAPEX', planejado: capexPlanejado, realizado: capexRealiz },
                  { label: 'OPEX',  planejado: opexPlanejado,  realizado: opexRealiz  },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.label === 'CAPEX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{item.label}</span>
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
                      <span>Exec: R$ {item.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      <span>Plan: R$ {item.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ))}
                {/* Saldo total */}
                <div className="border-t border-megag-cinza-medio pt-2 flex justify-between text-xs">
                  <span className="font-semibold text-megag-cinza-texto">Saldo</span>
                  <span className={`font-bold ${(capexSaldoCalc + opexSaldoCalc) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    R$ {(capexSaldoCalc + opexSaldoCalc).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
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

      {/* TAP */}
      {abaAtiva === 'TAP' && (
        <div className="mt-4">
          <TapEditor
            tap={tapAtual}
            projetoId={projeto.id}
            projetoNome={projeto.nome}
            projetoCodigo={projeto.codigo}
            canEdit={canEditArtefatos}
            canSubmit={podeSubmeter}
            isAdmin={session.perfil === 'ADMIN'}
            workflow={workflowTap as never}
            sessionUser={sessionUser}
            usuarios={usuarios as { id: number; nome: string }[]}
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

      {/* ESTUDO DE VIABILIDADE */}
      {abaAtiva === 'Estudo de Viabilidade' && (
        <div className="mt-4">
          <ViabilidadeEditor
            viabilidade={viabilidadeData as never}
            projetoId={projeto.id}
            canEdit={canEditArtefatos}
            canSubmit={podeSubmeter}
            workflow={workflowViabilidade as never}
            sessionUser={sessionUser}
            usuarios={usuarios as { id: number; nome: string }[]}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}

      {/* CRONOGRAMA */}
      {abaAtiva === 'Cronograma' && (
        <div className="mt-4">
          {cronogramaAtual?.status === 'PRONTO_PARA_ENCERRAMENTO' && (
            <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 flex items-center gap-3">
              <span className="text-green-600 text-xl">✅</span>
              <div>
                <p className="font-semibold text-green-800">Cronograma concluído — todas as tarefas foram finalizadas.</p>
                <p className="text-sm text-green-700">O cronograma está pronto para encerramento. Conclua o projeto para finalizá-lo.</p>
              </div>
            </div>
          )}
          <CronogramaEditor
            projetoId={projeto.id}
            canEdit={canEditArtefatos}
            canApprove={podeSubmeter}
            canSubmit={podeSubmeter}
            workflow={workflowCronograma as never}
            sessionUser={sessionUser}
            usuarios={usuarios as { id: number; nome: string }[]}
            projetoMigrado={!!projeto.projeto_migrado}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}

      {/* ACOMPANHAMENTO DE PAYBACK */}
      {abaAtiva === 'Acompanhamento de Payback' && (() => {
        // dataFimPrev vem do cronograma (última tarefa) — fonte única de verdade
        const dataFimPrev = projeto.data_fim_efetiva ?? null
        const dataReal    = projeto.data_conclusao_real ?? null

        let diasPrevistos: number | null = null
        let diasExecutados: number | null = null
        let desvio: number | null = null
        let desvioLabel = '—'
        let desvioCor = '#374151'

        if (projeto.data_inicio_prev && dataFimPrev) {
          diasPrevistos = Math.round(
            (new Date(dataFimPrev).getTime() - new Date(projeto.data_inicio_prev).getTime()) / 86400000
          )
        }
        if (projeto.data_inicio_prev && dataReal) {
          diasExecutados = Math.round(
            (new Date(dataReal).getTime() - new Date(projeto.data_inicio_prev).getTime()) / 86400000
          )
        }
        if (diasPrevistos !== null && diasExecutados !== null) {
          desvio = diasExecutados - diasPrevistos
          if (desvio > 0)       { desvioLabel = `+${desvio} dia(s) de atraso`; desvioCor = '#DC2626' }
          else if (desvio < 0)  { desvioLabel = `${Math.abs(desvio)} dia(s) adiantado`; desvioCor = '#16A34A' }
          else                  { desvioLabel = 'No prazo exato'; desvioCor = '#16A34A' }
        }

        return (
          <div className="mt-4 space-y-4">
            {/* Painel de Prazo — disponível após conclusão */}
            {projetoConcluido ? (
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-megag-azul" />
                    <span className="card-title">Análise de Prazo</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                  {[
                    { titulo: 'Início Previsto',    valor: fmtDataBR(projeto.data_inicio_prev) },
                    { titulo: 'Conclusão Prevista', valor: fmtDataBR(dataFimPrev) },
                    { titulo: 'Conclusão Real',     valor: fmtDataBR(dataReal), destaque: true },
                    { titulo: 'Desvio de Prazo',    valor: desvioLabel, cor: desvioCor },
                  ].map(card => (
                    <div key={card.titulo} className="bg-megag-cinza-claro rounded-xl p-3">
                      <p className="text-xs text-megag-cinza-texto">{card.titulo}</p>
                      <p className="text-sm font-bold mt-1" style={{ color: card.cor ?? (card.destaque ? '#003087' : '#111827') }}>
                        {card.valor}
                      </p>
                    </div>
                  ))}
                </div>
                {diasPrevistos !== null && diasExecutados !== null && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                    <div className="bg-megag-cinza-claro rounded-xl p-3">
                      <p className="text-xs text-megag-cinza-texto">Dias Previstos</p>
                      <p className="text-base font-bold text-megag-preto mt-1">{diasPrevistos}</p>
                    </div>
                    <div className="bg-megag-cinza-claro rounded-xl p-3">
                      <p className="text-xs text-megag-cinza-texto">Dias Executados</p>
                      <p className="text-base font-bold mt-1" style={{ color: desvioCor }}>{diasExecutados}</p>
                    </div>
                  </div>
                )}
                {projeto.responsavel_conclusao && (
                  <div className="px-4 pb-4 text-xs text-megag-cinza-texto">
                    Concluído por <strong>{projeto.responsavel_conclusao}</strong>
                    {projeto.hora_conclusao ? ` às ${projeto.hora_conclusao}` : ''}
                    {projeto.motivo_conclusao ? ` · ${projeto.motivo_conclusao}` : ''}
                  </div>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-megag-cinza-texto" />
                    <span className="card-title">Análise de Prazo</span>
                  </div>
                  <span className="badge bg-amber-100 text-amber-700 text-xs">Disponível após conclusão</span>
                </div>
                <div className="py-6 text-center text-sm text-megag-cinza-texto">
                  Os dados de desvio de prazo serão calculados quando o projeto for concluído oficialmente.
                </div>
              </div>
            )}

            {/* Snapshot Final */}
            {snapshotFinal && (
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-megag-azul" />
                    <span className="card-title">Snapshot Final do Projeto</span>
                  </div>
                  <span className="text-xs text-megag-cinza-texto">
                    {new Date(snapshotFinal.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-megag-cinza-claro">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-megag-cinza-texto">Indicador</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-megag-cinza-texto">Planejado</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-megag-cinza-texto">Realizado</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-megag-cinza-texto">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-megag-cinza-claro">
                      {[
                        {
                          label: 'CAPEX',
                          plan: snapshotFinal.capex_previsto,
                          real: snapshotFinal.capex_executado,
                          fmt: (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—',
                          inverse: true,
                        },
                        {
                          label: 'OPEX',
                          plan: snapshotFinal.opex_previsto,
                          real: snapshotFinal.opex_executado,
                          fmt: (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—',
                          inverse: true,
                        },
                        {
                          label: 'Total Financeiro',
                          plan: (snapshotFinal.capex_previsto ?? 0) + (snapshotFinal.opex_previsto ?? 0),
                          real: (snapshotFinal.capex_executado ?? 0) + (snapshotFinal.opex_executado ?? 0),
                          fmt: (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—',
                          inverse: true,
                        },
                        {
                          label: 'Economia Estimada',
                          plan: snapshotFinal.economia_prevista,
                          real: snapshotFinal.economia_realizada,
                          fmt: (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—',
                          inverse: false,
                        },
                        {
                          label: 'Prazo (dias)',
                          plan: snapshotFinal.data_fim_prev ? (() => {
                            const s = projeto.data_inicio_prev
                            const e = snapshotFinal.data_fim_prev
                            if (!s || !e) return null
                            return Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)
                          })() : null,
                          real: snapshotFinal.data_conclusao_real ? (() => {
                            const s = projeto.data_inicio_prev
                            const e = snapshotFinal.data_conclusao_real
                            if (!s || !e) return null
                            return Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)
                          })() : null,
                          fmt: (v: number | null) => v != null ? `${v} dias` : '—',
                          inverse: true,
                        },
                        {
                          label: 'ROI Previsto',
                          plan: snapshotFinal.roi_previsto,
                          real: snapshotFinal.roi_atual,
                          fmt: (v: number | null) => v != null ? `${v.toFixed(1)}%` : '—',
                          inverse: false,
                        },
                      ].map(row => {
                        const diff = row.plan != null && row.real != null ? (row.real - row.plan) : null
                        const isOver = diff != null && (row.inverse ? diff > 0 : diff < 0)
                        const isUnder = diff != null && (row.inverse ? diff < 0 : diff > 0)
                        return (
                          <tr key={row.label} className="hover:bg-megag-cinza-claro/50">
                            <td className="px-4 py-2 font-medium text-megag-preto">{row.label}</td>
                            <td className="px-4 py-2 text-right text-megag-cinza-texto">{row.fmt(row.plan)}</td>
                            <td className="px-4 py-2 text-right font-semibold">{row.fmt(row.real)}</td>
                            <td className={`px-4 py-2 text-right text-xs font-bold ${isOver ? 'text-red-600' : isUnder ? 'text-green-600' : 'text-gray-400'}`}>
                              {diff != null ? (diff > 0 ? `+${row.fmt(diff)}` : row.fmt(diff)) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {snapshotFinal.responsavel && (
                  <div className="px-4 py-2 text-xs text-megag-cinza-texto border-t border-megag-cinza-claro">
                    Responsável: <strong>{snapshotFinal.responsavel}</strong>
                    {snapshotFinal.dias_desvio != null && (
                      <span className={`ml-3 font-semibold ${snapshotFinal.dias_desvio > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {snapshotFinal.dias_desvio > 0 ? `+${snapshotFinal.dias_desvio} dias de atraso` : `${Math.abs(snapshotFinal.dias_desvio)} dias adiantado`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Módulo de Payback */}
            <PaybackTab
              projetoId={projeto.id}
              canEdit={canEditArtefatos}
              session={session}
              onRefresh={() => router.refresh()}
            />
          </div>
        )
      })()}

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

      {/* TIMELINE + HISTÓRICO */}
      {abaAtiva === 'Timeline' && (
        <div className="mt-4 space-y-6">
          {/* Linha do tempo do ciclo de vida */}
          <ProjectTimeline
            statusAtual={projeto.status}
            historicoStatus={historicoStatus}
            temTapAprovado={tapAtual?.status === 'APROVADO'}
            temViabilidadeAprovada={viabilidadeAtual?.status === 'APROVADO'}
            temCronogramaAprovado={cronogramaAprovado}
          />

          {/* Histórico de Alterações por Campo */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <History size={16} className="text-megag-azul" />
                <span className="card-title">Histórico de Alterações</span>
              </div>
              <span className="text-xs text-megag-cinza-texto">{historicoAlteracoes.length} registro(s)</span>
            </div>
            {historicoAlteracoes.length === 0 ? (
              <p className="text-megag-cinza-texto text-sm text-center py-4">Nenhuma alteração registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-megag">
                  <thead>
                    <tr>
                      <th>Data / Hora</th>
                      <th>Usuário</th>
                      <th>Campo</th>
                      <th>Valor Anterior</th>
                      <th>Novo Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoAlteracoes.map(h => (
                      <tr key={h.id}>
                        <td className="text-xs whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="text-sm">{h.usuario_nome || '—'}</td>
                        <td>
                          <span className="badge bg-megag-azul/10 text-megag-azul text-xs">
                            {CAMPO_LABELS[h.campo] ?? h.campo}
                          </span>
                        </td>
                        <td className="text-sm text-megag-cinza-texto max-w-[180px] truncate">
                          {h.acao === 'CREATE' ? (
                            <span className="text-xs text-green-700 font-medium">— criação —</span>
                          ) : (
                            h.valor_anterior || '—'
                          )}
                        </td>
                        <td className="text-sm font-medium max-w-[180px] truncate">
                          {h.valor_novo || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Histórico de Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><span className="card-title">Histórico de Status</span></div>
              <div className="space-y-0">
                {historicoStatus.length === 0 ? (
                  <p className="text-megag-cinza-texto text-sm text-center py-4">Sem histórico ainda.</p>
                ) : historicoStatus.map(h => (
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
                ) : historicoPrioridade.map(h => (
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
          </div>

          {/* Últimos lançamentos financeiros */}
          {lancamentos.length > 0 && (
            <div className="card p-0 overflow-hidden">
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
                  {lancamentos.slice(0, 5).map(l => (
                    <tr key={l.id}>
                      <td>
                        <span className={`badge text-xs ${l.tipo === 'CAPEX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {l.tipo}
                        </span>
                      </td>
                      <td className="text-sm">{l.descricao}</td>
                      <td className="font-semibold">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="text-sm">{fmtDataBR(l.data_lancamento)}</td>
                      <td className="text-sm text-megag-cinza-texto">{l.criador_nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Concluir Projeto ── */}
      {modalConcluir && (
        <ConcluirProjetoModal
          projetoId={projeto.id}
          projetoNome={projeto.nome}
          sessionNome={session.nome}
          tarefasPendentes={tarefasPendentes}
          onClose={() => setModalConcluir(false)}
          onConcluido={() => {
            setModalConcluir(false)
            router.refresh()
          }}
        />
      )}

    </div>
  )
}
