/**
 * Módulo centralizado de configuração por variáveis de ambiente.
 * Importar este módulo em vez de acessar process.env diretamente.
 *
 * Lança erro imediato na inicialização se alguma variável obrigatória
 * estiver ausente — impede que a aplicação suba em estado inseguro.
 */

const missing: string[] = []

function required(name: string): string {
  const val = process.env[name]
  if (!val) missing.push(name)
  return val ?? ''
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

export const env = {
  /** Segredo JWT — obrigatório. Usar mínimo 64 chars aleatórios em produção. */
  JWT_SECRET: required('JWT_SECRET'),

  /** Caminho do arquivo SQLite — opcional, padrão: ./data/megag-pmo.db */
  DATABASE_URL: optional('DATABASE_URL'),

  /** Chave da API Anthropic — obrigatório para funcionalidades de IA. */
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),

  /** Ambiente de execução. */
  NODE_ENV: optional('NODE_ENV', 'development'),
} as const

// Fail-fast: impede inicialização com variáveis obrigatórias ausentes
if (missing.length > 0) {
  const lista = missing.map(n => `  • ${n}`).join('\n')
  throw new Error(
    `\n\n[MegaG PMO] Variáveis de ambiente obrigatórias não definidas:\n${lista}\n\n` +
    `Copie o arquivo .env.example para .env.local e preencha os valores reais.\n`
  )
}
