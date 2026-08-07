'use client'

import { useState, useEffect } from 'react'
import { X, CheckSquare, Square } from 'lucide-react'

interface ChecklistItem {
  id: number
  codigo: string
  label: string
  obrigatorio: number
}

interface Props {
  projetoId: number
  projetoNome: string
  sessionNome: string
  tarefasPendentes: number
  onClose: () => void
  onConcluido: () => void
}

export default function ConcluirProjetoModal({ projetoId, projetoNome, sessionNome, tarefasPendentes, onClose, onConcluido }: Props) {
  const hoje = new Date()
  const dataDefault = hoje.toISOString().slice(0, 10)
  const horaDefault = hoje.toTimeString().slice(0, 5)

  // Se há tarefas pendentes, começa na tela de aviso; caso contrário, vai direto ao checklist
  const [telaAviso, setTelaAviso] = useState(tarefasPendentes > 0)
  const [data_conclusao_real, setData] = useState(dataDefault)
  const [hora_conclusao, setHora] = useState(horaDefault)
  const [responsavel_conclusao, setResponsavel] = useState(sessionNome)
  const [motivo_conclusao, setMotivo] = useState('')
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [loadingChecklist, setLoadingChecklist] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/configuracoes/checklist-conclusao')
      .then(r => r.json())
      .then((items: ChecklistItem[]) => {
        setChecklistItems(items)
        setChecklist(Object.fromEntries(items.map(i => [i.codigo, false])))
      })
      .catch(() => { /* mantém vazio, não bloqueia o fluxo */ })
      .finally(() => setLoadingChecklist(false))
  }, [])

  function toggleCheck(codigo: string) {
    setChecklist(prev => ({ ...prev, [codigo]: !prev[codigo] }))
  }

  async function handleSalvar() {
    if (!data_conclusao_real) { setError('Data de conclusão é obrigatória.'); return }
    if (!responsavel_conclusao.trim()) { setError('Responsável é obrigatório.'); return }

    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/projetos/${projetoId}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_conclusao_real,
          hora_conclusao,
          responsavel_conclusao,
          motivo_conclusao,
          checklist_conclusao: checklist,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erro ao concluir projeto.')
        return
      }
      onConcluido()
    } catch {
      setError('Falha na comunicação com o servidor.')
    } finally {
      setSaving(false)
    }
  }

  // ── Tela de aviso: tarefas pendentes ─────────────────────────────────────
  if (telaAviso) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio">
            <div>
              <h3 className="card-title text-megag-azul">Concluir Projeto</h3>
              <p className="text-xs text-megag-cinza-texto mt-0.5">{projetoNome}</p>
            </div>
            <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-4">
              <p className="font-semibold text-amber-800 mb-1">⚠️ Tarefas pendentes no cronograma</p>
              <p className="text-sm text-amber-700">
                Existem <strong>{tarefasPendentes}</strong> tarefa{tarefasPendentes > 1 ? 's' : ''} ainda não concluída{tarefasPendentes > 1 ? 's' : ''} no cronograma.
                Você pode concluir o projeto mesmo assim, mas isso ficará registrado na auditoria.
              </p>
            </div>
            <p className="text-sm text-megag-cinza-texto">Deseja continuar com a conclusão do projeto?</p>
          </div>

          <div className="flex justify-end gap-3 px-6 pb-6 border-t border-megag-cinza-medio pt-4">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={() => setTelaAviso(false)}>Concluir mesmo assim</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-megag-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-megag-cinza-medio sticky top-0 bg-white z-10">
          <div>
            <h3 className="card-title text-megag-azul">Concluir Projeto</h3>
            <p className="text-xs text-megag-cinza-texto mt-0.5">{projetoNome}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Data de Conclusão *</label>
              <input
                className="input"
                type="date"
                value={data_conclusao_real}
                onChange={e => setData(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Hora</label>
              <input
                className="input"
                type="time"
                value={hora_conclusao}
                onChange={e => setHora(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="input-label">Responsável *</label>
            <input
              className="input"
              value={responsavel_conclusao}
              onChange={e => setResponsavel(e.target.value)}
              placeholder="Nome do responsável pela conclusão"
            />
          </div>

          <div>
            <label className="input-label">Motivo / Observações da Conclusão</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={motivo_conclusao}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o contexto da conclusão, entregas realizadas, observações relevantes…"
            />
          </div>

          <div>
            <p className="input-label mb-2">Checklist de Encerramento</p>
            {loadingChecklist ? (
              <p className="text-sm text-megag-cinza-texto py-2">Carregando checklist…</p>
            ) : checklistItems.length === 0 ? (
              <p className="text-sm text-megag-cinza-texto py-2">Nenhum item configurado.</p>
            ) : (
              <div className="space-y-2">
                {checklistItems.map(item => (
                  <button
                    key={item.codigo}
                    type="button"
                    className="flex items-center gap-2 w-full text-left hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                    onClick={() => toggleCheck(item.codigo)}
                  >
                    {checklist[item.codigo]
                      ? <CheckSquare size={16} className="text-green-600 shrink-0" />
                      : <Square size={16} className="text-gray-400 shrink-0" />
                    }
                    <span className={`text-sm ${checklist[item.codigo] ? 'text-green-700 font-medium' : 'text-megag-cinza-texto'}`}>
                      {item.label}{item.obrigatorio ? ' *' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            Esta ação irá alterar o status do projeto para <strong>Projeto Concluído</strong> e habilitará o módulo de Acompanhamento de Payback. Esta operação não pode ser desfeita.
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6 sticky bottom-0 bg-white border-t border-megag-cinza-medio pt-4">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleSalvar} disabled={saving}>
            {saving ? 'Concluindo…' : '✓ Concluir Projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}
