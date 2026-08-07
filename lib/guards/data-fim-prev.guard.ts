import { apiLogger } from '@/lib/logger'

/**
 * Registra aviso quando data_fim_prev é acessada para regra de negócio.
 *
 * data_fim_prev é um campo LEGADO do projeto. A fonte oficial de
 * data de conclusão é o cronograma (MAX data_fim das tarefas),
 * disponível em projeto.data_fim_efetiva.
 *
 * Usos legítimos (não chamar este guard):
 *  - Formulário de edição da Visão Geral (salva no banco)
 *  - Snapshot final histórico (projeto_snapshots_finais.data_fim_prev)
 *  - Schema SQL e migrations
 *
 * Usos indevidos (chamar este guard e corrigir):
 *  - Cálculo de prazo ou status
 *  - Exibição de data de conclusão ao usuário
 *  - Filtros, KPIs e dashboards
 *
 * @see lib/data-conclusao-projeto.ts — helper oficial
 * @see Projeto.data_fim_efetiva — campo correto para display/lógica
 */
export function bloquearUsoDataFimPrev(contexto: string): void {
  apiLogger.warn(
    { contexto, campo: 'data_fim_prev' },
    '[GUARD] Uso de data_fim_prev detectado em regra de negócio. Use projeto.data_fim_efetiva.'
  )
}
