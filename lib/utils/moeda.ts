/**
 * @file lib/utils/moeda.ts
 *
 * Máscara de valor monetário (BRL) para inputs — extraída de
 * components/projeto/FinanceiroTab.tsx para reaproveitamento fora do módulo
 * Financeiro (ex.: Cronograma / Tarefa de Pagamento). O arquivo original não
 * foi alterado; esta é uma cópia dedicada, não uma dependência cruzada.
 *
 * Digitação livre, só dígitos e vírgula decimal — a vírgula final "vence": tudo
 * depois dela é a parte decimal (limitada a 2 dígitos), o resto é a parte inteira.
 */
export function maskValorMonetario(raw: string): { display: string; numero: number } {
  let cleaned = raw.replace(/[^\d,]/g, '')
  const primeiraVirgula = cleaned.indexOf(',')
  if (primeiraVirgula !== -1) {
    cleaned = cleaned.slice(0, primeiraVirgula + 1) + cleaned.slice(primeiraVirgula + 1).replace(/,/g, '')
  }
  if (cleaned === '') return { display: '', numero: NaN }

  const [intParteRaw, decParte] = cleaned.split(',') as [string, string | undefined]
  const decLimitada = decParte !== undefined ? decParte.slice(0, 2) : undefined

  let intParte = intParteRaw.replace(/^0+(?=\d)/, '')
  if (intParte === '') intParte = '0'
  const intFormatada = intParte.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const display = decLimitada !== undefined ? `R$ ${intFormatada},${decLimitada}` : `R$ ${intFormatada}`
  const numero = parseFloat(`${intParte}.${(decLimitada ?? '00').padEnd(2, '0')}`)
  return { display, numero }
}
