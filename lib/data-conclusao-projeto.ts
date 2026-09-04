import { ProjetosRepository } from '@/lib/repositories'

/**
 * Fonte única de verdade para a data de conclusão de um projeto.
 * Retorna a maior data_fim entre todas as tarefas do cronograma ativo.
 * Retorna null quando não há cronograma — exibir "Sem cronograma" na UI.
 */
export async function getDataConclusaoProjetoById(cronograma_id: number): Promise<string | null> {
  return ProjetosRepository.findDataFimCronograma(cronograma_id)
}
