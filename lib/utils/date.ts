/**
 * @file lib/utils/date.ts
 *
 * Utilitários de formatação de data compartilhados entre server e client.
 *
 * Problema resolvido: SQLite retorna datas no formato "2026-07-08 14:30:00"
 * (espaço, sem T). new Date("2026-07-08 14:30:00" + "T12:00:00") gera string
 * inválida e toLocaleDateString retorna "Invalid Date" sem lançar exceção.
 *
 * Solução: extrair apenas a parte da data (YYYY-MM-DD) antes de parsear.
 */

/**
 * Formata uma data SQLite (ou ISO) para exibição em pt-BR.
 * Aceita: "2026-07-08", "2026-07-08 14:30:00", "2026-07-08T14:30:00"
 * Retorna '—' para valores nulos/undefined/inválidos.
 */
export function formatarData(valor?: string | null): string {
  if (!valor) return '—'
  // Extrai apenas YYYY-MM-DD — funciona para todos os formatos SQLite e ISO
  const soData = valor.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soData)) return '—'
  try {
    return new Date(soData + 'T12:00:00').toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

/**
 * Normaliza uma data para o formato YYYY-MM-DD (para persistência).
 * Aceita dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd e Date objects.
 * Retorna null se a data for inválida.
 */
export function normalizarData(valor: unknown): string | null {
  if (!valor) return null

  // Já é um objeto Date (vindo do parser xlsx com cellDates: true)
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null
    return valor.toISOString().slice(0, 10)
  }

  if (typeof valor !== 'string') return null
  const s = valor.trim()
  if (!s) return null

  // dd/mm/yyyy ou dd-mm-yyyy
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (brMatch) {
    const [, d, m, y] = brMatch
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const dt = new Date(iso + 'T12:00:00')
    return isNaN(dt.getTime()) ? null : iso
  }

  // yyyy-mm-dd ou yyyy/mm/dd
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const dt = new Date(iso + 'T12:00:00')
    return isNaN(dt.getTime()) ? null : iso
  }

  return null
}

/**
 * Calcula duração em dias úteis entre duas datas (inclusive).
 * Retorna null se qualquer data for inválida ou fim < início.
 */
export function calcularDuracao(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null
  const a = new Date(inicio + 'T12:00:00')
  const b = new Date(fim   + 'T12:00:00')
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}
