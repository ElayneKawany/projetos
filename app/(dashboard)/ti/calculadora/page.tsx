'use client'
import { useState, useMemo } from 'react'
import { Calculator, ArrowRight, Info } from 'lucide-react'

function fmtR(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function ResultCard({ label, value, sub, color = '#003087' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="font-black text-lg" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function CalculadoraPage() {
  const [salario, setSalario] = useState<string>('')
  const [horasAntes, setHorasAntes] = useState<string>('')
  const [horasDepois, setHorasDepois] = useState<string>('')
  const [freqMensal, setFreqMensal] = useState<string>('22')

  const sal = parseFloat(salario) || 0
  const hAntes = parseFloat(horasAntes) || 0
  const hDepois = parseFloat(horasDepois) || 0
  const freq = parseFloat(freqMensal) || 1

  const valorHora = useMemo(() => sal > 0 ? sal / 220 : null, [sal])
  const horasEconomizadas = useMemo(() => hAntes > hDepois ? hAntes - hDepois : null, [hAntes, hDepois])
  const economiaMensal = useMemo(
    () => valorHora !== null && horasEconomizadas !== null ? valorHora * horasEconomizadas * freq : null,
    [valorHora, horasEconomizadas, freq]
  )
  const economiaAnual = economiaMensal !== null ? economiaMensal * 12 : null
  const custoAtual = valorHora !== null ? valorHora * hAntes * freq : null
  const custoDepois = valorHora !== null ? valorHora * hDepois * freq : null

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003087' }}>
          <Calculator size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calculadora de Ganho por Tarefa</h1>
          <p className="text-sm text-gray-500">Meça o benefício financeiro de reduzir o tempo em uma atividade</p>
        </div>
      </div>

      {/* Fórmula resumida */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-xs text-blue-700 flex items-start gap-2">
        <Info size={14} className="shrink-0 mt-0.5" />
        <div>
          <strong>Fórmula:</strong>{' '}
          valor/hora = salário ÷ 220h &nbsp;·&nbsp;
          horas economizadas = horas antes − horas depois &nbsp;·&nbsp;
          economia mensal = valor/hora × horas economizadas × frequência mensal
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <p className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Dados da Atividade</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Salário Mensal (R$)</label>
            <input
              type="number" step="100" min="0" className="input w-full"
              value={salario}
              onChange={e => setSalario(e.target.value)}
              placeholder="Ex.: 5000"
            />
            {valorHora !== null && (
              <p className="text-xs text-blue-600 mt-1 font-semibold">Valor/hora: {fmtR(valorHora)}</p>
            )}
          </div>
          <div>
            <label className="input-label">Frequência Mensal (vezes)</label>
            <input
              type="number" step="1" min="1" className="input w-full"
              value={freqMensal}
              onChange={e => setFreqMensal(e.target.value)}
              placeholder="Ex.: 22"
            />
            <p className="text-xs text-gray-400 mt-1">Quantas vezes/mês a tarefa é executada</p>
          </div>
          <div>
            <label className="input-label">Tempo Atual por Execução (horas)</label>
            <input
              type="number" step="0.25" min="0" className="input w-full"
              value={horasAntes}
              onChange={e => setHorasAntes(e.target.value)}
              placeholder="Ex.: 2"
            />
          </div>
          <div>
            <label className="input-label">Tempo Previsto após Projeto (horas)</label>
            <input
              type="number" step="0.25" min="0" className="input w-full"
              value={horasDepois}
              onChange={e => setHorasDepois(e.target.value)}
              placeholder="Ex.: 0.5"
            />
          </div>
        </div>
      </div>

      {valorHora !== null && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Resultado</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <ResultCard
              label="Valor/hora"
              value={fmtR(valorHora)}
              sub="salário ÷ 220h"
              color="#003087"
            />
            {horasEconomizadas !== null && (
              <ResultCard
                label="Horas Economizadas"
                value={`${horasEconomizadas.toFixed(2).replace('.', ',')}h`}
                sub="por execução"
                color="#0369A1"
              />
            )}
            {economiaMensal !== null && (
              <ResultCard
                label="Economia Mensal"
                value={fmtR(economiaMensal)}
                color="#059669"
              />
            )}
          </div>

          {(custoAtual !== null || custoDepois !== null) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Comparativo de custo mensal</p>
              <div className="flex items-center gap-3">
                {custoAtual !== null && (
                  <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Custo Atual</p>
                    <p className="font-black text-base text-red-600">{fmtR(custoAtual)}</p>
                  </div>
                )}
                <ArrowRight size={16} className="text-gray-400 shrink-0" />
                {custoDepois !== null && (
                  <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Custo Após Projeto</p>
                    <p className="font-black text-base text-green-600">{fmtR(custoDepois)}</p>
                  </div>
                )}
              </div>
              {economiaAnual !== null && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Economia Anual Projetada</p>
                  <p className="font-black text-xl" style={{ color: '#003087' }}>{fmtR(economiaAnual)}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
            <strong>Para usar no Payback:</strong> copie o valor de <em>Economia Mensal</em> e cole no campo
            &ldquo;Economia Mensal Esperada&rdquo; no Estudo de Viabilidade do projeto. Alternativamente, use os
            indicadores <em>Ganho Tarefa</em> e <em>HC</em> diretamente no formulário de Viabilidade.
          </div>
        </div>
      )}
    </div>
  )
}
