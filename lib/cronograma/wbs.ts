/**
 * @file lib/cronograma/wbs.ts
 *
 * Cálculo de códigos WBS (1, 1.1, 1.1.1...) a partir de uma lista de tarefas já
 * ordenada por `ordem`. Mesma regra usada em app/api/projetos/[id]/cronograma/route.ts
 * (calcularWBS, import/criação) e no DELETE de tarefa (recalculo pós-exclusão) —
 * extraída aqui para a rota de "mover tarefa entre fases" sem duplicar uma 4ª vez.
 */

export interface ItemWBS {
  nivel: string
}

export function calcularCodigosWBS(itens: ItemWBS[]): string[] {
  let faseCount = 0
  let tarefaCount = 0
  let subCount = 0
  let rootCount = 0

  return itens.map(item => {
    if (item.nivel === 'FASE') {
      faseCount++; tarefaCount = 0; subCount = 0
      return String(faseCount)
    }
    if (item.nivel === 'SUBTAREFA') {
      subCount++
      if (faseCount > 0 && tarefaCount > 0) return `${faseCount}.${tarefaCount}.${subCount}`
      if (tarefaCount > 0) return `${tarefaCount}.${subCount}`
      return `${rootCount}.${subCount}`
    }
    // TAREFA
    subCount = 0
    if (faseCount > 0) { tarefaCount++; return `${faseCount}.${tarefaCount}` }
    rootCount++; return String(rootCount)
  })
}
