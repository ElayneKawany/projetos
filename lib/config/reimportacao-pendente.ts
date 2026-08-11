/**
 * Projetos aguardando reimportação dos documentos oficiais (TAP e Estudo de Viabilidade).
 *
 * CONDIÇÃO TEMPORÁRIA — Os documentos existentes foram redefinidos para RASCUNHO
 * para permitir a importação dos arquivos oficiais. Após importação e aprovação
 * dos novos documentos, o fluxo volta ao normal automaticamente.
 *
 * Para aplicar o reset no banco: node scripts/reset-artefatos-importacao.js
 *
 * Regra: NÃO importar esta lista nos componentes de runtime — o controle
 * é feito diretamente pelo status no banco de dados (RASCUNHO vs APROVADO).
 * Este arquivo serve como documentação centralizada e fonte para o script.
 */
export const PROJETOS_PENDENTES_REIMPORTACAO = [
  'PRJ-2026-0001',
  'PRJ-2026-0002',
  'PRJ-2026-0007',
  'PRJ-2026-0008',
  'PRJ-2026-0009',
  'PRJ-2026-0010',
  'PRJ-2026-0011',
  'PRJ-2026-0012',
  'PRJ-2026-0014',
  'PRJ-2026-0020',
  'PRJ-2026-0021',
  'PRJ-2026-0025',
  'PRJ-2026-0026',
  'PRJ-2026-0027',
  'PRJ-2026-0028',
  'PRJ-2026-0031',
  'PRJ-2026-0032',
  'PRJ-2026-0033',
] as const

export type ProjetoPendenteReimportacao = typeof PROJETOS_PENDENTES_REIMPORTACAO[number]
