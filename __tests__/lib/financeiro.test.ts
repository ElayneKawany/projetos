import { calcularROI, calcularTIR, calcularPayback } from '@/lib/financeiro'

describe('calcularROI', () => {
  it('retorna null quando investimento é zero', () => {
    expect(calcularROI(0, 1000)).toBeNull()
  })

  it('retorna null quando investimento é undefined', () => {
    expect(calcularROI(undefined as unknown as number, 1000)).toBeNull()
  })

  it('calcula ROI positivo corretamente', () => {
    // investimento=100, benefício=150 → ROI = (150-100)/100 * 100 = 50%
    expect(calcularROI(100, 150)).toBeCloseTo(50)
  })

  it('calcula ROI negativo (prejuízo)', () => {
    // investimento=200, benefício=100 → ROI = (100-200)/200 * 100 = -50%
    expect(calcularROI(200, 100)).toBeCloseTo(-50)
  })

  it('ROI zero quando benefício igual ao investimento', () => {
    expect(calcularROI(500, 500)).toBeCloseTo(0)
  })
})

describe('calcularTIR', () => {
  it('retorna null para array vazio', () => {
    expect(calcularTIR([])).toBeNull()
  })

  it('retorna null quando primeiro fluxo é positivo (sem investimento inicial)', () => {
    expect(calcularTIR([100, 200, 300])).toBeNull()
  })

  it('calcula TIR para fluxo simples', () => {
    // investimento 1000, retorno 1200 em 1 ano → TIR ≈ 20%
    const tir = calcularTIR([-1000, 1200])
    expect(tir).not.toBeNull()
    expect(tir!).toBeCloseTo(20, 0)
  })

  it('calcula TIR para fluxo multi-período', () => {
    // investimento 1000, retorno 400/ano por 3 anos → TIR ≈ 9.7%
    const tir = calcularTIR([-1000, 400, 400, 400])
    expect(tir).not.toBeNull()
    expect(tir!).toBeGreaterThan(5)
    expect(tir!).toBeLessThan(15)
  })
})

describe('calcularPayback', () => {
  it('retorna null quando investimento é zero', () => {
    expect(calcularPayback(0, [1000])).toBeNull()
  })

  it('retorna null quando fluxo é vazio', () => {
    expect(calcularPayback(1000, [])).toBeNull()
  })

  it('calcula payback no primeiro mês quando retorno é suficiente', () => {
    // investimento 1000, retorno anual 12000 → payback no mês 1
    const meses = calcularPayback(1000, [12000])
    expect(meses).toBe(1)
  })

  it('calcula payback em 12 meses (1 ano exato)', () => {
    // investimento 1000, retorno anual 1000 → payback no mês 12
    const meses = calcularPayback(1000, [1000])
    expect(meses).toBe(12)
  })

  it('retorna null quando fluxo nunca recupera o investimento', () => {
    // investimento 10000, retorno anual 100 (apenas 1 ano de dados)
    const meses = calcularPayback(10000, [100])
    expect(meses).toBeNull()
  })
})
