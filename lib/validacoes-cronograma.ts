import { ProjetosRepository } from '@/lib/repositories'

/**
 * Verifica se um cronograma possui pelo menos uma tarefa com data_fim válida.
 * Usada antes de avançar o projeto para EXECUCAO.
 *
 * @returns null se válido; string com mensagem de erro se inválido
 */
export function validarCronogramaParaExecucao(cronograma_id: number): string | null {
  const dataFim = ProjetosRepository.findDataFimCronograma(cronograma_id)
  if (!dataFim) {
    return 'O cronograma deve ter pelo menos uma tarefa com data de fim definida para avançar o projeto para Execução.'
  }
  return null
}
