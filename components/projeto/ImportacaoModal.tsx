'use client'

import { useRef, useState } from 'react'
import { useDownload } from './useDownload'

export interface DadosImportados {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: Record<string, any>
  camposFaltantes: string[]
  avisos: string[]
}

interface Props {
  titulo: string
  urlImportar: string
  urlExportarXlsx: string
  onConfirmar: (dados: DadosImportados['dados']) => void
  onFechar: () => void
  renderRevisao: (dados: DadosImportados['dados']) => React.ReactNode
}

type Etapa = 'selecao' | 'processando' | 'revisao' | 'erro'

export default function ImportacaoModal({
  titulo,
  urlImportar,
  urlExportarXlsx,
  onConfirmar,
  onFechar,
  renderRevisao,
}: Props) {
  const inputRef            = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa]   = useState<Etapa>('selecao')
  const { baixar, baixando } = useDownload()
  const [erro, setErro]     = useState<string | null>(null)
  const [resultado, setResultado] = useState<DadosImportados | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  async function handleArquivo(file: File) {
    setEtapa('processando')
    setErro(null)
    try {
      const fd = new FormData()
      fd.append('arquivo', file)
      const res = await fetch(urlImportar, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao processar o arquivo.')
      setResultado(json)
      setEtapa('revisao')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido.')
      setEtapa('erro')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleArquivo(file)
  }

  async function handleConfirmar() {
    if (!resultado) return
    setConfirmando(true)
    try {
      await onConfirmar(resultado.dados)
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ background: '#003087' }}>
          <h2 className="text-lg font-semibold text-white">{titulo}</h2>
          <button onClick={onFechar} className="text-white/70 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── ETAPA: seleção ── */}
          {(etapa === 'selecao' || etapa === 'erro') && (
            <>
              {/* Baixar modelo */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">1. Baixe o modelo oficial</p>
                <p className="text-xs text-blue-600 mb-3">
                  Faça o download, preencha os campos e importe o arquivo de volta.
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-50"
                    disabled={baixando === 'modelo.xlsx'}
                    onClick={() => baixar(urlExportarXlsx, 'modelo.xlsx')}
                  >
                    {baixando === 'modelo.xlsx' ? '⏳ Gerando…' : '📊 Baixar modelo XLSX'}
                  </button>
                </div>
              </div>

              {/* Upload */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">2. Importe o arquivo preenchido</p>
                <p className="text-xs text-gray-500 mb-3">Formatos aceitos: .docx · .xlsx</p>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="text-3xl mb-2">📁</div>
                  <p className="text-sm text-gray-600">Arraste o arquivo aqui ou <span className="text-blue-600 underline">clique para selecionar</span></p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".docx,.xlsx,.xls"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleArquivo(f) }}
                  />
                </div>
              </div>

              {etapa === 'erro' && erro && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  ⚠ {erro}
                </div>
              )}
            </>
          )}

          {/* ── ETAPA: processando ── */}
          {etapa === 'processando' && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="text-4xl mb-4 animate-spin">⚙️</div>
              <p className="text-sm text-gray-600">Lendo e mapeando o arquivo…</p>
            </div>
          )}

          {/* ── ETAPA: revisão ── */}
          {etapa === 'revisao' && resultado && (
            <>
              {/* Avisos e campos faltantes */}
              {resultado.camposFaltantes.length > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">
                    ⚠ {resultado.camposFaltantes.length} campo(s) não encontrado(s)
                  </p>
                  <ul className="text-xs text-yellow-700 list-disc list-inside space-y-0.5">
                    {resultado.camposFaltantes.map(c => <li key={c}>{c}</li>)}
                  </ul>
                  <p className="text-xs text-yellow-600 mt-2">Você pode preenchê-los manualmente após confirmar a importação.</p>
                </div>
              )}

              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5">
                <p className="text-sm text-green-800 font-medium">✓ Dados extraídos com sucesso. Revise abaixo antes de confirmar.</p>
              </div>

              {/* Prévia dos dados */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Prévia dos dados importados</p>
                {renderRevisao(resultado.dados)}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          {etapa === 'revisao' ? (
            <>
              <button
                className="btn-secondary text-sm"
                onClick={() => { setEtapa('selecao'); setResultado(null) }}
              >
                ← Voltar
              </button>
              <button
                className="btn-primary text-sm"
                disabled={confirmando}
                onClick={handleConfirmar}
              >
                {confirmando ? 'Aplicando…' : '✓ Confirmar e aplicar ao formulário'}
              </button>
            </>
          ) : (
            <button className="btn-secondary text-sm ml-auto" onClick={onFechar}>
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
