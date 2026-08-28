/**
 * @file lib/utils/dias-uteis.ts
 *
 * Cálculo de dias úteis (segunda a sexta, exclui sábado/domingo). Usado
 * exclusivamente pelo painel de "Tarefas Próximas ao Vencimento" do Dashboard
 * (lib/meu-trabalho.ts) — Cronograma e Agenda continuam com o cálculo em dias
 * corridos que já usam hoje.
 */

function isFimDeSemana(d: Date): boolean {
  const dia = d.getDay()
  return dia === 0 || dia === 6
}

/**
 * Conta dias úteis estritamente após `inicio` até `fim` (inclusive), ignorando
 * horário. Retorna 0 se `fim` for igual ou anterior a `inicio`.
 */
export function diasUteisEntre(inicio: Date, fim: Date): number {
  const i = new Date(inicio); i.setHours(0, 0, 0, 0)
  const f = new Date(fim);    f.setHours(0, 0, 0, 0)
  if (f <= i) return 0

  let count = 0
  const cursor = new Date(i)
  cursor.setDate(cursor.getDate() + 1)
  while (cursor <= f) {
    if (!isFimDeSemana(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}
