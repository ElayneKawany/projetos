/**
 * Camada de Repositórios — ponto único de importação.
 *
 * Fluxo obrigatório para novo código:
 *   API Route → Service (lib/) → Repository (lib/repositories/) → Database (lib/database/)
 *
 * O código legado em lib/projetos.ts, lib/financeiro.ts, etc. continua
 * funcionando. A migração para repositórios é incremental — cada módulo
 * é refatorado em sprints subsequentes.
 */

export { ProjetosRepository } from './projetos'
export type { ProjetoFiltros } from './projetos'

export { TapRepository } from './tap'
export type { TapVersao } from './tap'

export { ViabilidadeRepository } from './viabilidade'
export type { Viabilidade } from './viabilidade'

export { CronogramaRepository } from './cronograma'
export type { Cronograma, CronogramaTarefa } from './cronograma'

export { FinanceiroRepository } from './financeiro'
export type { FinanceiroContrato, FinanceiroPagamento, ResumoFinanceiro } from './financeiro'

export { ComitesRepository } from './comites'
export type { Comite } from './comites'

export { UsuariosRepository } from './usuarios'
export type { Usuario } from './usuarios'

export { ConfiguracoesRepository } from './configuracoes'
