import { CronogramaRepository, type DistribuicaoMacroFase } from '@/lib/repositories/cronograma'

export type { DistribuicaoMacroFase }

export function buscarDistribuicaoMacroFases(projetoId: number): DistribuicaoMacroFase[] {
  const cronograma = CronogramaRepository.findAtivoSimples(projetoId)
  if (!cronograma) return []
  const today = new Date().toISOString().slice(0, 10)
  return CronogramaRepository.findDistribuicaoMacroFases(cronograma.id, today)
}
