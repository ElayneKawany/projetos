'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, MicOff, Square, Play, Pause, FileText, Sparkles,
  Save, CheckCircle, Clock, AlertCircle, Download, Edit, X,
  History, Shield, ChevronDown, ChevronUp, Loader2, User,
} from 'lucide-react'
import type { ComiteAta, ComiteAtaHistorico, AtaConteudoJson } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  comiteId: number
  ata: ComiteAta | null
  historico?: ComiteAtaHistorico[]
  podeGerenciar: boolean
  onRefresh: () => void
}

interface TranscriptLine {
  tempo: number
  texto: string
  falante?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTempo = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const fmtDatetime = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const STATUS_BADGE: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  PENDENTE_APROVACAO: 'bg-amber-100 text-amber-700',
  APROVADO: 'bg-green-100 text-green-700',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GravacaoAta({ comiteId, ata: ataInicial, historico: histInicial = [], podeGerenciar, onRefresh }: Props) {
  const [ata, setAta] = useState(ataInicial)
  const [historico, setHistorico] = useState(histInicial)

  // Recording state
  const [gravando, setGravando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const [transcricao, setTranscricao] = useState<TranscriptLine[]>([])
  const [transcricaoTexto, setTranscricaoTexto] = useState(ata?.transcricao || '')
  const [horaInicio, setHoraInicio] = useState<string>('')
  const [horaFim, setHoraFim] = useState<string>('')

  // AI generation state
  const [gerando, setGerando] = useState(false)
  const [jsonGerado, setJsonGerado] = useState<AtaConteudoJson | null>(null)
  const [streamBuffer, setStreamBuffer] = useState('')

  // Edit state
  const [editandoResumo, setEditandoResumo] = useState(false)
  const [editandoSecao, setEditandoSecao] = useState<string | null>(null)
  const [jsonEditado, setJsonEditado] = useState<AtaConteudoJson | null>(null)

  // UI state
  const [abaAtiva, setAbaAtiva] = useState<'gravar' | 'ata' | 'historico'>('gravar')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [mostrarTranscricao, setMostrarTranscricao] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcricaoEndRef = useRef<HTMLDivElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Parse JSON from ata on mount
  useEffect(() => {
    if (ata?.conteudo_json) {
      try {
        const parsed = JSON.parse(ata.conteudo_json)
        setJsonGerado(parsed)
        setJsonEditado(parsed)
      } catch { /* ignore */ }
    }
    if (ata?.transcricao) setTranscricaoTexto(ata.transcricao)
  }, [ata])

  // Auto-scroll transcript
  useEffect(() => {
    transcricaoEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcricao])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      recognitionRef.current?.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function refreshAta() {
    const res = await fetch(`/api/comites/${comiteId}/ata`)
    if (!res.ok) return
    const data = await res.json()
    setAta(data.ata)
    setHistorico(data.historico || [])
    if (data.ata?.conteudo_json) {
      try {
        const parsed = JSON.parse(data.ata.conteudo_json)
        setJsonGerado(parsed)
        setJsonEditado(parsed)
      } catch { /* ignore */ }
    }
    onRefresh()
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 4000)
  }

  function mostrarErro(msg: string) {
    setErro(msg)
    setTimeout(() => setErro(''), 6000)
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // MediaRecorder para capturar áudio
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start()

      const agora = new Date()
      setHoraInicio(agora.toTimeString().substring(0, 5))
      setGravando(true)
      setPausado(false)
      setTempoGravacao(0)
      setTranscricao([])

      // Timer
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000)

      // Speech Recognition
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRec) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recog: any = new SpeechRec()
        recog.continuous = true
        recog.interimResults = true
        recog.lang = 'pt-BR'
        recognitionRef.current = recog

        recog.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const texto = event.results[i][0].transcript.trim()
              if (texto) {
                setTranscricao(prev => [...prev, { tempo: tempoGravacao, texto }])
                setTranscricaoTexto(prev => prev + (prev ? '\n' : '') + texto)
              }
            }
          }
        }

        recog.onerror = (event: any) => {
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            console.warn('Speech recognition error:', event.error)
          }
        }

        recog.onend = () => {
          // Auto-restart se ainda estiver gravando
          if (gravando && !pausado && recognitionRef.current === recog) {
            try { recog.start() } catch { /* ignore */ }
          }
        }

        recog.start()
      } else {
        mostrarErro('Reconhecimento de voz não disponível neste navegador. Use o Chrome para transcrição automática. A gravação de áudio continua ativa.')
      }
    } catch (err) {
      mostrarErro('Não foi possível acessar o microfone. Verifique as permissões do navegador.')
    }
  }

  function pausarGravacao() {
    if (pausado) {
      // Retomar
      mediaRecorderRef.current?.resume()
      try { recognitionRef.current?.start() } catch { /* ignore */ }
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000)
      setPausado(false)
    } else {
      // Pausar
      mediaRecorderRef.current?.pause()
      recognitionRef.current?.stop()
      timerRef.current && clearInterval(timerRef.current)
      setPausado(true)
    }
  }

  async function encerrarGravacao() {
    timerRef.current && clearInterval(timerRef.current)
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())

    const agora = new Date()
    const hFim = agora.toTimeString().substring(0, 5)
    setHoraFim(hFim)
    setGravando(false)
    setPausado(false)

    // Salvar transcrição automaticamente
    if (transcricaoTexto.trim()) {
      await salvarTranscricao(hFim)
      setAbaAtiva('ata')
    }
  }

  async function salvarTranscricao(hFim?: string) {
    const durMin = Math.round(tempoGravacao / 60)
    await fetch(`/api/comites/${comiteId}/ata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcricao: transcricaoTexto,
        hora_inicio: horaInicio,
        hora_fim: hFim || horaFim,
        duracao_min: durMin,
      }),
    })
    await refreshAta()
    mostrarSucesso('Transcrição salva com sucesso.')
  }

  // ── AI Generation ──────────────────────────────────────────────────────────

  async function gerarAtaIA() {
    setGerando(true)
    setStreamBuffer('')
    setAbaAtiva('ata')
    let fullText = ''

    try {
      const res = await fetch(`/api/comites/${comiteId}/ata/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcricao: transcricaoTexto || ata?.transcricao,
          hora_inicio: horaInicio || ata?.hora_inicio,
          hora_fim: horaFim || ata?.hora_fim,
          duracao_min: Math.round(tempoGravacao / 60) || ata?.duracao_min,
        }),
      })

      if (!res.ok) { mostrarErro('Erro ao gerar ata com IA.'); return }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value)
        fullText += chunk
        setStreamBuffer(fullText)
      }

      // Tentar parsear como JSON
      const jsonMatch = fullText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed: AtaConteudoJson = JSON.parse(jsonMatch[0])
          setJsonGerado(parsed)
          setJsonEditado(parsed)

          // Salvar no banco
          await fetch(`/api/comites/${comiteId}/ata`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conteudo_json: JSON.stringify(parsed),
              conteudo: gerarTextoAta(parsed),
              gerado_por_ia: true,
            }),
          })
          await refreshAta()
          mostrarSucesso('Ata gerada e salva com sucesso.')
        } catch {
          // Salvar como texto simples se JSON falhar
          await fetch(`/api/comites/${comiteId}/ata`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conteudo: fullText, gerado_por_ia: true }),
          })
          await refreshAta()
        }
      }
    } catch (err) {
      mostrarErro('Erro de comunicação com a IA.')
    } finally {
      setGerando(false)
      setStreamBuffer('')
    }
  }

  function gerarTextoAta(json: AtaConteudoJson): string {
    const linhas: string[] = ['# ATA DE REUNIÃO\n']
    if (json.resumo) linhas.push(`## Resumo Executivo\n${json.resumo}\n`)
    if (json.decisoes?.length) {
      linhas.push('## Decisões')
      json.decisoes.forEach(d => linhas.push(`- ${d.descricao}${d.responsavel ? ` (${d.responsavel})` : ''}${d.prazo ? ` — ${d.prazo}` : ''}`))
      linhas.push('')
    }
    if (json.pendencias?.length) {
      linhas.push('## Pendências')
      json.pendencias.forEach(p => linhas.push(`- ${p.descricao}${p.responsavel ? ` (${p.responsavel})` : ''}${p.prazo ? ` — ${p.prazo}` : ''}`))
      linhas.push('')
    }
    if (json.riscos?.length) {
      linhas.push('## Riscos')
      json.riscos.forEach(r => linhas.push(`- ${r}`))
    }
    return linhas.join('\n')
  }

  // ── Approval & Saving ─────────────────────────────────────────────────────

  async function salvarEdicoes() {
    if (!jsonEditado) return
    setLoading(true)
    try {
      await fetch(`/api/comites/${comiteId}/ata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conteudo_json: JSON.stringify(jsonEditado),
          conteudo: gerarTextoAta(jsonEditado),
        }),
      })
      setJsonGerado(jsonEditado)
      setEditandoSecao(null)
      setEditandoResumo(false)
      await refreshAta()
      mostrarSucesso('Edições salvas.')
    } finally { setLoading(false) }
  }

  async function submeterAprovacao() {
    setLoading(true)
    try {
      await fetch(`/api/comites/${comiteId}/ata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDENTE_APROVACAO' }),
      })
      await refreshAta()
      mostrarSucesso('Ata submetida para aprovação.')
    } finally { setLoading(false) }
  }

  async function aprovarAta() {
    setLoading(true)
    try {
      await fetch(`/api/comites/${comiteId}/ata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APROVADO' }),
      })
      await refreshAta()
      mostrarSucesso('Ata aprovada e oficializada.')
    } finally { setLoading(false) }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function exportarPDF() {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const data = ata ? ata.created_at.substring(0, 10) : ''
    const titulo = `ATA — ${comiteId}`

    doc.setFontSize(18)
    doc.text(titulo, 14, 20)
    doc.setFontSize(11)
    doc.text(`Data: ${data} | Status: ${ata?.status || 'Rascunho'}`, 14, 28)

    let y = 38
    if (jsonGerado?.resumo) {
      doc.setFontSize(13)
      doc.text('Resumo Executivo', 14, y); y += 7
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(jsonGerado.resumo, 180)
      doc.text(lines, 14, y); y += lines.length * 5 + 6
    }

    if (jsonGerado?.decisoes?.length) {
      doc.addPage()
      doc.setFontSize(13)
      doc.text('Decisões', 14, 20)
      autoTable(doc, {
        startY: 28,
        head: [['Decisão', 'Responsável', 'Prazo']],
        body: jsonGerado.decisoes.map(d => [d.descricao, d.responsavel || '', d.prazo || '']),
      })
    }

    if (jsonGerado?.plano_acao?.length) {
      doc.addPage()
      doc.setFontSize(13)
      doc.text('Plano de Ação', 14, 20)
      autoTable(doc, {
        startY: 28,
        head: [['Ação', 'Responsável', 'Prazo', 'Status']],
        body: jsonGerado.plano_acao.map(a => [a.acao, a.responsavel, a.prazo, a.status]),
      })
    }

    doc.save(`ata-comite-${comiteId}.pdf`)
  }

  async function exportarWord() {
    window.location.href = `/api/comites/${comiteId}/ata/exportar`
  }

  async function exportarPPTX() {
    window.location.href = `/api/comites/${comiteId}/exportar?formato=pptx`
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Feedback banners */}
      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro('')}><X size={14} /></button>
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle size={16} className="shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {/* Status bar */}
      {ata && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[ata.status]}`}>
              {ata.status === 'RASCUNHO' ? 'Rascunho' : ata.status === 'PENDENTE_APROVACAO' ? 'Aguardando Aprovação' : 'Ata Oficial'}
            </span>
            <span className="text-gray-500">v{ata.versao}</span>
            {ata.gerado_por_ia === 1 && (
              <span className="flex items-center gap-1 text-amber-600 text-xs"><Sparkles size={11} /> Gerada por IA</span>
            )}
            {ata.duracao_min && <span className="text-gray-400 text-xs">{ata.duracao_min} min de gravação</span>}
          </div>

          {podeGerenciar && ata.status !== 'APROVADO' && (
            <div className="flex gap-2">
              {ata.status === 'RASCUNHO' && (
                <button onClick={submeterAprovacao} disabled={loading} className="btn-secondary text-xs py-1">
                  Submeter para Aprovação
                </button>
              )}
              {ata.status === 'PENDENTE_APROVACAO' && (
                <button onClick={aprovarAta} disabled={loading} className="btn-primary text-xs py-1 flex items-center gap-1">
                  <Shield size={12} /> Aprovar Oficialmente
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {[
          { id: 'gravar' as const, label: 'Gravação', icon: Mic },
          { id: 'ata' as const, label: 'Ata Estruturada', icon: FileText },
          { id: 'historico' as const, label: 'Histórico', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAbaAtiva(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
              abaAtiva === tab.id ? 'border-[#003087] text-[#003087]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ABA: Gravação ────────────────────────────────────────────── */}
      {abaAtiva === 'gravar' && (
        <div className="space-y-4">
          {/* Recording controls */}
          <div className="card p-6 text-center">
            {!gravando ? (
              <div>
                <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${gravando ? 'bg-red-100 animate-pulse' : 'bg-gray-100'}`}>
                  <Mic size={40} className="text-gray-400" />
                </div>
                <p className="text-gray-600 text-sm mb-6">
                  {ata?.transcricao ? 'Já existe uma transcrição salva. Você pode regravar.' : 'Inicie a gravação quando a reunião começar.'}
                </p>
                {podeGerenciar && (
                  <button onClick={iniciarGravacao} className="btn-primary flex items-center gap-2 mx-auto px-6 py-3 text-base">
                    <Mic size={18} /> Iniciar Gravação
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Recording indicator */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-600 font-semibold">GRAVANDO</span>
                  {pausado && <span className="text-amber-600 text-sm">(Pausado)</span>}
                </div>

                {/* Timer */}
                <div className="text-5xl font-mono font-bold text-gray-900 mb-2">{fmtTempo(tempoGravacao)}</div>
                <p className="text-sm text-gray-500 mb-6">Início: {horaInicio}</p>

                {/* Controls */}
                <div className="flex justify-center gap-3">
                  <button onClick={pausarGravacao} className="btn-secondary flex items-center gap-2">
                    {pausado ? <><Play size={16} /> Retomar</> : <><Pause size={16} /> Pausar</>}
                  </button>
                  <button onClick={encerrarGravacao} className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2">
                    <Square size={16} /> Encerrar Gravação
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live transcript */}
          {(gravando || transcricao.length > 0) && (
            <div className="card">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-t-xl"
                onClick={() => setMostrarTranscricao(v => !v)}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FileText size={15} />
                  Transcrição em tempo real
                  {transcricao.length > 0 && <span className="text-xs text-gray-400">({transcricao.length} segmentos)</span>}
                </div>
                {mostrarTranscricao ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {mostrarTranscricao && (
                <div className="p-3 border-t">
                  <div className="h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 text-sm space-y-1 font-mono">
                    {transcricao.map((line, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-gray-400 shrink-0 text-xs mt-0.5">{fmtTempo(line.tempo)}</span>
                        <span className="text-gray-800">{line.texto}</span>
                      </div>
                    ))}
                    {gravando && !pausado && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs italic">Ouvindo...</span>
                      </div>
                    )}
                    <div ref={transcricaoEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Saved transcript */}
          {!gravando && (ata?.transcricao || transcricaoTexto) && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                  <FileText size={15} /> Transcrição Salva
                </h3>
                <div className="flex gap-2">
                  {podeGerenciar && !gerando && (
                    <button onClick={gerarAtaIA} className="btn-primary flex items-center gap-2 text-sm">
                      <Sparkles size={14} /> Gerar Ata com IA
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className="input w-full font-mono text-xs"
                rows={8}
                value={transcricaoTexto || ata?.transcricao || ''}
                onChange={e => setTranscricaoTexto(e.target.value)}
                readOnly={!podeGerenciar}
                placeholder="Transcrição da reunião..."
              />
              {podeGerenciar && (
                <div className="flex justify-end mt-2">
                  <button onClick={() => salvarTranscricao()} className="btn-secondary text-sm flex items-center gap-1">
                    <Save size={13} /> Salvar Transcrição
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Generate button when no transcript */}
          {!gravando && !(ata?.transcricao || transcricaoTexto) && podeGerenciar && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">Ou gere a ata diretamente com base nos dados do comitê:</p>
              <button onClick={gerarAtaIA} disabled={gerando} className="btn-primary flex items-center gap-2 mx-auto">
                {gerando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {gerando ? 'Gerando...' : 'Gerar Ata com IA'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: Ata Estruturada ─────────────────────────────────────── */}
      {abaAtiva === 'ata' && (
        <div className="space-y-4">
          {/* Streaming indicator */}
          {gerando && (
            <div className="card p-4 bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="font-medium text-sm">IA analisando transcrição e gerando ata...</span>
              </div>
              {streamBuffer && (
                <div className="font-mono text-xs text-gray-600 max-h-32 overflow-auto bg-white rounded p-2">
                  {streamBuffer.substring(0, 400)}{streamBuffer.length > 400 ? '...' : ''}
                </div>
              )}
            </div>
          )}

          {jsonGerado ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {podeGerenciar && (
                    <>
                      <button onClick={gerarAtaIA} disabled={gerando} className="btn-secondary flex items-center gap-1 text-sm">
                        <Sparkles size={13} /> Regenerar com IA
                      </button>
                      <button onClick={salvarEdicoes} disabled={loading} className="btn-primary flex items-center gap-1 text-sm">
                        <Save size={13} /> Salvar
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={exportarPDF} className="btn-ghost text-sm flex items-center gap-1">
                    <Download size={13} /> PDF
                  </button>
                  <button onClick={exportarWord} className="btn-ghost text-sm flex items-center gap-1">
                    <Download size={13} /> Word
                  </button>
                  <button onClick={exportarPPTX} className="btn-ghost text-sm flex items-center gap-1">
                    <Download size={13} /> PPTX
                  </button>
                </div>
              </div>

              {/* Resumo */}
              <SecaoAta
                titulo="Resumo Executivo"
                editavel={podeGerenciar && ata?.status !== 'APROVADO'}
                editando={editandoResumo}
                onEditar={() => setEditandoResumo(true)}
                onCancelar={() => { setEditandoResumo(false); setJsonEditado(jsonGerado) }}
                onSalvar={salvarEdicoes}
              >
                {editandoResumo ? (
                  <textarea
                    className="input w-full text-sm"
                    rows={6}
                    value={jsonEditado?.resumo || ''}
                    onChange={e => setJsonEditado(j => ({ ...j, resumo: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-line">{jsonGerado.resumo || '—'}</p>
                )}
              </SecaoAta>

              {/* Participantes identificados */}
              {((jsonGerado.participantes_identificados ?? []).length > 0 || (jsonGerado.ausentes ?? []).length > 0) && (
                <SecaoAta titulo="Participantes" editavel={false}>
                  <div className="grid grid-cols-2 gap-4">
                    {(jsonGerado.participantes_identificados ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Identificados na transcrição</p>
                        {(jsonGerado.participantes_identificados ?? []).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                            <User size={12} className="text-gray-400" /> {p}
                          </div>
                        ))}
                      </div>
                    )}
                    {(jsonGerado.ausentes ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Ausentes</p>
                        {(jsonGerado.ausentes ?? []).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm py-0.5 text-gray-400">
                            <X size={12} /> {p}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SecaoAta>
              )}

              {/* Projetos discutidos */}
              {(jsonGerado.projetos_discutidos ?? []).length > 0 && (
                <SecaoAta titulo={`Projetos Discutidos (${(jsonGerado.projetos_discutidos ?? []).length})`} editavel={false}>
                  <div className="space-y-3">
                    {(jsonGerado.projetos_discutidos ?? []).map((proj, i) => (
                      <div key={i} className="border-l-4 border-[#003087] pl-3">
                        <p className="font-medium text-gray-900 text-sm">{proj.nome}</p>
                        {proj.status && <p className="text-xs text-gray-500 mt-0.5">Status: {proj.status}</p>}
                        {proj.pontos && <p className="text-sm text-gray-700 mt-1">{proj.pontos}</p>}
                        {proj.problemas && <p className="text-sm text-red-600 mt-0.5">⚠ {proj.problemas}</p>}
                        {proj.decisoes && <p className="text-sm text-green-700 mt-0.5">✓ {proj.decisoes}</p>}
                      </div>
                    ))}
                  </div>
                </SecaoAta>
              )}

              {/* Decisões */}
              {(jsonGerado.decisoes ?? []).length > 0 && (
                <SecaoAta titulo={`Decisões (${(jsonGerado.decisoes ?? []).length})`} editavel={false}>
                  <div className="space-y-2">
                    {(jsonGerado.decisoes ?? []).map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
                        <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">{d.descricao}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {d.responsavel && `Resp: ${d.responsavel}`}
                            {d.responsavel && d.prazo && ' · '}
                            {d.prazo && `Prazo: ${d.prazo}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SecaoAta>
              )}

              {/* Pendências */}
              {(jsonGerado.pendencias ?? []).length > 0 && (
                <SecaoAta titulo={`Pendências (${(jsonGerado.pendencias ?? []).length})`} editavel={false}>
                  <div className="space-y-2">
                    {(jsonGerado.pendencias ?? []).map((p, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                        <Clock size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">{p.descricao}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {p.responsavel && `Resp: ${p.responsavel}`}
                            {p.responsavel && p.prazo && ' · '}
                            {p.prazo && `Prazo: ${p.prazo}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SecaoAta>
              )}

              {/* Plano de Ação */}
              {(jsonGerado.plano_acao ?? []).length > 0 && (
                <SecaoAta titulo="Plano de Ação" editavel={false}>
                  <div className="overflow-x-auto">
                    <table className="table-megag">
                      <thead>
                        <tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {(jsonGerado.plano_acao ?? []).map((a, i) => (
                          <tr key={i}>
                            <td className="text-sm">{a.acao}</td>
                            <td className="text-sm">{a.responsavel}</td>
                            <td className="text-sm">{a.prazo}</td>
                            <td>
                              <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">{a.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SecaoAta>
              )}

              {/* Riscos */}
              {(jsonGerado.riscos ?? []).length > 0 && (
                <SecaoAta titulo="Riscos Identificados" editavel={false}>
                  <div className="space-y-1">
                    {(jsonGerado.riscos ?? []).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-orange-700">
                        <AlertCircle size={14} className="shrink-0" /> {r}
                      </div>
                    ))}
                  </div>
                </SecaoAta>
              )}

              {/* Observações */}
              {jsonGerado.observacoes && (
                <SecaoAta titulo="Observações" editavel={false}>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{jsonGerado.observacoes}</p>
                </SecaoAta>
              )}
            </>
          ) : !gerando ? (
            <div className="text-center py-12">
              <Sparkles size={40} className="mx-auto mb-3 text-amber-400" />
              <p className="text-gray-600 mb-2">A ata ainda não foi gerada.</p>
              <p className="text-sm text-gray-400 mb-6">Grave a reunião ou gere diretamente com IA.</p>
              {podeGerenciar && (
                <button onClick={gerarAtaIA} className="btn-primary flex items-center gap-2 mx-auto">
                  <Sparkles size={16} /> Gerar Ata com IA
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── ABA: Histórico ───────────────────────────────────────────── */}
      {abaAtiva === 'historico' && (
        <div>
          <h3 className="font-medium text-gray-700 mb-3 text-sm">Histórico de Versões</h3>
          {historico.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhum histórico disponível.</p>
          ) : (
            <div className="space-y-2">
              {historico.map(h => (
                <div key={h.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="w-8 h-8 rounded-full bg-[#003087] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    v{h.versao}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        h.acao === 'APROVAR' ? 'bg-green-100 text-green-700' :
                        h.acao === 'SUBMETER' ? 'bg-amber-100 text-amber-700' :
                        h.acao === 'CRIAR' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{h.acao}</span>
                      <span className="text-gray-600">{h.usuario_nome}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDatetime(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SecaoAta helper ──────────────────────────────────────────────────────────

function SecaoAta({
  titulo, children, editavel, editando, onEditar, onCancelar, onSalvar,
}: {
  titulo: string
  children: React.ReactNode
  editavel: boolean
  editando?: boolean
  onEditar?: () => void
  onCancelar?: () => void
  onSalvar?: () => void
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">{titulo}</h3>
        {editavel && !editando && (
          <button onClick={onEditar} className="text-xs text-[#003087] hover:underline flex items-center gap-1">
            <Edit size={11} /> Editar
          </button>
        )}
        {editando && (
          <div className="flex gap-2">
            <button onClick={onCancelar} className="text-xs text-gray-500 flex items-center gap-1"><X size={11} /> Cancelar</button>
            <button onClick={onSalvar} className="text-xs text-[#003087] font-medium flex items-center gap-1"><Save size={11} /> Salvar</button>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
