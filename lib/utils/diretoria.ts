const SIGLAS_OFICIAIS: Record<string, string> = {
  'Diretoria Financeira': 'DF',
  'Diretoria Comercial': 'DC',
  'MKT e Novos Negócios': 'DMN',
  'Diretoria Logística': 'DL',
}

const IGNORADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function gerarSiglaDiretoria(nome: string): string {
  if (!nome) return ''
  if (SIGLAS_OFICIAIS[nome]) return SIGLAS_OFICIAIS[nome]
  return nome
    .trim()
    .split(/\s+/)
    .filter(w => !IGNORADAS.has(w.toLowerCase()))
    .map(w => w[0].toUpperCase())
    .join('')
}
