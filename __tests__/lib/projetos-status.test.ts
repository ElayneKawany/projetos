/**
 * Testa a ordem dos status do ciclo de vida do projeto.
 * STATUS_ORDER é uma constante pura sem dependência de DB.
 */
import { STATUS_ORDER } from '@/types/index'

describe('STATUS_ORDER — ciclo de vida do projeto', () => {
  it('tem 13 fases', () => {
    expect(STATUS_ORDER).toHaveLength(13)
  })

  it('começa com PROPOSTA', () => {
    expect(STATUS_ORDER[0]).toBe('PROPOSTA')
  })

  it('termina com PROJETO_ENCERRADO', () => {
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('PROJETO_ENCERRADO')
  })

  it('contém VIABILIDADE após PROPOSTA', () => {
    const idxProposta = STATUS_ORDER.indexOf('PROPOSTA')
    const idxViabilidade = STATUS_ORDER.indexOf('VIABILIDADE')
    expect(idxViabilidade).toBeGreaterThan(idxProposta)
  })

  it('contém EXECUCAO após ESTRUTURACAO', () => {
    const idxEstruturacao = STATUS_ORDER.indexOf('ESTRUTURACAO')
    const idxExecucao = STATUS_ORDER.indexOf('EXECUCAO')
    expect(idxExecucao).toBeGreaterThan(idxEstruturacao)
  })

  it('não tem status duplicados', () => {
    const unique = new Set(STATUS_ORDER)
    expect(unique.size).toBe(STATUS_ORDER.length)
  })
})
