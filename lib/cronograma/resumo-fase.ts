/**
 * @file lib/cronograma/resumo-fase.ts
 *
 * Cálculo de status automático de uma tarefa e do resumo agregado (datas/status/
 * percentual) de uma FASE a partir das tarefas filhas. Extraído de
 * components/projeto/CronogramaEditor.tsx para ser reaproveitado por qualquer
 * tela que precise exibir datas de FASE consistentes com a aba Cronograma
 * (Comitê, Timeline do projeto, dashboard) — evita que essas telas caiam para
 * a coluna bruta data_inicio/data_fim da FASE, que só é atualizada manualmente
 * e pode ficar desatualizada em relação às tarefas filhas.
 */

import { formatarData, normalizarData } from '@/lib/utils/date'

export interface TarefaParaStatus {
  data_conclusao?: string | null
  data_fim?: string | null
  status?: string | null
  percentual?: number | null
  prazo_status?: string | null
}

export type StatusAuto = 'PENDENTE' | 'PROXIMO_DO_VENCIMENTO' | 'ATRASADO' | 'CONCLUIDO' | 'CONCLUIDO_NO_PRAZO' | 'CONCLUIDO_COM_ATRASO'

/** Converte string de data (YYYY-MM-DD ou DD/MM/YYYY) para Date local sem desvio de fuso. */
export function parseDateLocal(s: string): Date {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const parts = s.split('T')[0].split(' ')[0].split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

export function calcStatusAuto(t: TarefaParaStatus): StatusAuto {
  // Tarefa concluída: data_conclusao definida, status CONCLUIDA, ou percentual 100
  if (t.data_conclusao || t.status === 'CONCLUIDA' || (t.percentual ?? 0) >= 100) {
    if (t.data_conclusao && t.data_fim) {
      const dc = parseDateLocal(t.data_conclusao)
      const df = parseDateLocal(t.data_fim)
      return dc > df ? 'CONCLUIDO_COM_ATRASO' : 'CONCLUIDO_NO_PRAZO'
    }
    // Sem data_conclusao real para comparar: usa prazo_status gravado
    if (t.prazo_status === 'FORA_DO_PRAZO') return 'CONCLUIDO_COM_ATRASO'
    return 'CONCLUIDO'
  }
  if (!t.data_fim) return 'PENDENTE'
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const fim  = parseDateLocal(t.data_fim)
  const dias = Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000)
  if (dias < 0)  return 'ATRASADO'
  if (dias <= 3) return 'PROXIMO_DO_VENCIMENTO'
  return 'PENDENTE'
}

/** Converte ISO (YYYY-MM-DD) para exibição em modo de edição (DD/MM/AAAA). Retorna '' para nulo. */
export function isoToDisplayEdit(iso?: string | null): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export type FaseStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'ATRASADA' | 'CONCLUIDA'

export interface FaseSummary {
  data_inicio:  string   // formatado para exibição
  data_fim:     string
  dias:         string
  percentual:   number
  status:       FaseStatus
  totalFilhos:  number
}

export interface TarefaParaResumoFase extends TarefaParaStatus {
  nivel: string
  data_inicio?: string | null
}

/**
 * Calcula o resumo automático da FASE a partir das tarefas filhas na lista.
 * Filhos = todos os itens do tipo TAREFA que aparecem imediatamente após a FASE
 * (até a próxima FASE ou fim da lista).
 * editMode = true: datas nas filhas estão em DD/MM/AAAA — converte antes de comparar.
 */
export function calcFaseSummaryFromList<T extends TarefaParaResumoFase>(
  faseIdx: number,
  lista: T[],
  editMode = false
): FaseSummary {
  const fase = lista[faseIdx]
  const filhos: T[] = []
  for (let i = faseIdx + 1; i < lista.length; i++) {
    if (lista[i].nivel === 'FASE') break
    if (lista[i].nivel === 'TAREFA') filhos.push(lista[i])
  }
  if (!filhos.length) {
    // Fase sem filhos visíveis: usa datas e status gravados no DB.
    const dbStatus = fase?.status?.toUpperCase()
    const faseStatus: FaseStatus = (dbStatus === 'CONCLUIDA' || !!fase?.data_conclusao) ? 'CONCLUIDA'
      : dbStatus === 'EM_ANDAMENTO'                         ? 'EM_ANDAMENTO'
      : dbStatus === 'ATRASADA'                             ? 'ATRASADA'
      : 'PENDENTE'
    const dbInicio = fase?.data_inicio ? fase.data_inicio.slice(0, 10) : null
    const dbFim    = fase?.data_fim    ? fase.data_fim.slice(0, 10)    : null
    const diasNum  = dbInicio && dbFim
      ? (Math.round(
          (new Date(dbFim + 'T12:00:00').getTime() - new Date(dbInicio + 'T12:00:00').getTime())
          / 86400000
        ) + 1)
      : null
    return {
      data_inicio: dbInicio ? formatarData(dbInicio) : '—',
      data_fim:    dbFim    ? formatarData(dbFim)    : '—',
      dias:        diasNum  ? `${diasNum}d`          : '—',
      percentual:  0,
      status:      faseStatus,
      totalFilhos: 0,
    }
  }

  // Converter datas para ISO
  const toISO = (d: string | undefined | null): string | null => {
    if (!d) return null
    return editMode ? normalizarData(d) : d.slice(0, 10)
  }

  const starts = filhos.map(t => toISO(t.data_inicio)).filter((d): d is string => !!d).sort()
  const ends   = filhos.map(t => toISO(t.data_fim)).filter((d): d is string => !!d).sort()

  const isoInicio = starts[0] ?? null
  const isoFim    = ends[ends.length - 1] ?? null

  // Dias inclusivos: (fim - inicio) em dias + 1
  const diasNum = isoInicio && isoFim
    ? (Math.round(
        (new Date(isoFim + 'T12:00:00').getTime() - new Date(isoInicio + 'T12:00:00').getTime())
        / 86400000
      ) + 1)
    : null

  const data_inicio = isoInicio
    ? (editMode ? isoToDisplayEdit(isoInicio) : formatarData(isoInicio))
    : '—'
  const data_fim = isoFim
    ? (editMode ? isoToDisplayEdit(isoFim) : formatarData(isoFim))
    : '—'

  // Status da fase (view only; em edit mode sempre PENDENTE)
  let status: FaseStatus = 'PENDENTE'
  if (!editMode) {
    const sts = filhos.map(f => calcStatusAuto(f))
    const isConcl = (s: StatusAuto) => s === 'CONCLUIDO' || s === 'CONCLUIDO_NO_PRAZO' || s === 'CONCLUIDO_COM_ATRASO'
    if (sts.every(isConcl))              status = 'CONCLUIDA'
    else if (sts.some(s => s === 'ATRASADO')) status = 'ATRASADA'
    else if (sts.some(isConcl))          status = 'EM_ANDAMENTO'
  }

  // Percentual: tarefas concluídas / total
  const concluidas = editMode ? 0 : filhos.filter(f => {
    const s = calcStatusAuto(f)
    return s === 'CONCLUIDO' || s === 'CONCLUIDO_NO_PRAZO' || s === 'CONCLUIDO_COM_ATRASO'
  }).length
  const percentual = filhos.length > 0 ? Math.round((concluidas / filhos.length) * 100) : 0

  return {
    data_inicio,
    data_fim,
    dias: diasNum != null ? `${diasNum}d` : '—',
    percentual,
    status,
    totalFilhos: filhos.length,
  }
}

/**
 * Intervalo agregado (início/fim) de uma lista de tarefas de nível raiz (FASE
 * ou TAREFA sem fase-pai), na ordem em que aparecem no cronograma. Usado para
 * derivar o intervalo de execução do projeto a partir do cronograma vigente —
 * início = menor data_inicio, fim = maior data_fim entre todos os itens
 * relevantes (respeitando a hierarquia: FASEs usam o resumo calculado a partir
 * de suas próprias filhas, não a coluna bruta).
 */
export function calcIntervaloCronograma<T extends TarefaParaResumoFase>(
  lista: T[]
): { inicio: string; fim: string } | null {
  const inicios: string[] = []
  const fins: string[] = []
  let dentroDeFase = false

  const toISO = (d: string) => {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : d.slice(0, 10)
  }

  lista.forEach((item, idx) => {
    if (item.nivel === 'FASE') {
      dentroDeFase = true
      const resumo = calcFaseSummaryFromList(idx, lista, false)
      if (resumo.data_inicio !== '—') inicios.push(toISO(resumo.data_inicio))
      if (resumo.data_fim !== '—') fins.push(toISO(resumo.data_fim))
      return
    }
    if (item.nivel === 'TAREFA' && !dentroDeFase) {
      // TAREFA de nível raiz (cronograma sem FASEs, ou tarefa antes da primeira FASE)
      if (item.data_inicio) inicios.push(item.data_inicio.slice(0, 10))
      if (item.data_fim) fins.push(item.data_fim.slice(0, 10))
    }
  })

  if (!inicios.length || !fins.length) return null

  return { inicio: inicios.sort()[0], fim: fins.sort().slice(-1)[0] }
}
