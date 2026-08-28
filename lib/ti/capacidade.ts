/**
 * @file lib/ti/capacidade.ts
 *
 * Cálculo de capacidade/alocação dos analistas de TI, em dias úteis — fonte
 * única reutilizada pela Agenda TI (`app/(dashboard)/ti/TIAgendaClient.tsx`).
 *
 * Jornada contratual: 44h/semana = 9h seg-qui (07:00–17:00, -1h almoço) +
 * 8h sex (07:00–16:00, -1h almoço). Essa jornada ocupa a semana de trabalho
 * inteira (5 dias), sem sobra nem falta — por isso capacidade em dias é
 * simplesmente a contagem de dias úteis do período; a jornada entra aqui só
 * como constante documentada, não como fator de conversão adicional.
 */

import { diasUteisEntre } from '@/lib/utils/dias-uteis'

export const JORNADA_SEMANAL_HORAS = 44

export interface PeriodoOcupado {
  /** ISO YYYY-MM-DD */
  inicio: string
  /** ISO YYYY-MM-DD */
  fim: string
}

export interface CapacidadeMes {
  capacidadeDias: number
  alocadoDias: number
  disponivelDias: number
  sobrecargaDias: number
}

/**
 * Capacidade/alocação de um analista num mês (`mes` 1-indexado).
 *
 * - `capacidadeDias`: dias úteis do mês inteiro.
 * - `alocadoDias`: dias úteis ocupados pelos períodos informados, recortados
 *   ao mês e MESCLADOS antes de contar — duas tarefas sobrepostas do mesmo
 *   analista nunca contam o mesmo dia duas vezes.
 * - Período cujo fim já passou (atrasado, ainda não concluído — chamador não
 *   deve passar tarefas já concluídas aqui) é tratado como ocupando até hoje:
 *   continua consumindo capacidade do mês corrente enquanto não for resolvido.
 */
export function calcularCapacidadeMes(
  ano: number,
  mes: number,
  periodos: PeriodoOcupado[],
  hoje: Date
): CapacidadeMes {
  const primeiroDia = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0)
  const antesDoPrimeiro = new Date(ano, mes - 1, 0)

  const capacidadeDias = diasUteisEntre(antesDoPrimeiro, ultimoDia)

  const hojeSemHora = new Date(hoje)
  hojeSemHora.setHours(0, 0, 0, 0)

  const intervalos: Array<{ ini: Date; fim: Date }> = []
  for (const p of periodos) {
    const iniRaw = new Date(p.inicio + 'T00:00:00')
    const fimRaw = new Date(p.fim + 'T00:00:00')
    const fimEfetivo = fimRaw < hojeSemHora ? hojeSemHora : fimRaw
    const ini = iniRaw < primeiroDia ? primeiroDia : iniRaw
    const fim = fimEfetivo > ultimoDia ? ultimoDia : fimEfetivo
    if (ini <= fim) intervalos.push({ ini, fim })
  }

  intervalos.sort((a, b) => a.ini.getTime() - b.ini.getTime())
  const mesclados: Array<{ ini: Date; fim: Date }> = []
  for (const iv of intervalos) {
    const ultimo = mesclados[mesclados.length - 1]
    if (ultimo && iv.ini <= ultimo.fim) {
      if (iv.fim > ultimo.fim) ultimo.fim = iv.fim
    } else {
      mesclados.push({ ini: iv.ini, fim: iv.fim })
    }
  }

  let alocadoDias = 0
  for (const iv of mesclados) {
    const antesIni = new Date(iv.ini)
    antesIni.setDate(antesIni.getDate() - 1)
    alocadoDias += diasUteisEntre(antesIni, iv.fim)
  }

  return {
    capacidadeDias,
    alocadoDias,
    disponivelDias: Math.max(0, capacidadeDias - alocadoDias),
    sobrecargaDias: Math.max(0, alocadoDias - capacidadeDias),
  }
}

/**
 * Meses (ano, mês 1-indexado) tocados pelos períodos informados, a partir de
 * `mesMinimo` (o mês atual) — usado para saber quantos cards de mês exibir
 * por analista: o mês atual sempre aparece; meses seguintes só aparecem se
 * alguma tarefa do analista realmente se estender até lá.
 */
export function mesesTocados(
  periodos: PeriodoOcupado[],
  mesMinimo: { ano: number; mes: number }
): Array<{ ano: number; mes: number }> {
  const chave = (a: number, m: number) => a * 12 + (m - 1)
  const minKey = chave(mesMinimo.ano, mesMinimo.mes)
  const chaves = new Set<number>([minKey])

  for (const p of periodos) {
    const ini = new Date(p.inicio + 'T00:00:00')
    const fim = new Date(p.fim + 'T00:00:00')
    const fimKey = chave(fim.getFullYear(), fim.getMonth() + 1)
    if (fimKey < minKey) continue
    const iniKey = Math.max(chave(ini.getFullYear(), ini.getMonth() + 1), minKey)
    for (let k = iniKey; k <= fimKey; k++) chaves.add(k)
  }

  return Array.from(chaves)
    .sort((a, b) => a - b)
    .map(k => ({ ano: Math.floor(k / 12), mes: (k % 12) + 1 }))
}
