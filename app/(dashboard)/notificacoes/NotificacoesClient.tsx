'use client'

import { useRouter } from 'next/navigation'
import { Bell, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import type { Notificacao } from '@/lib/notificacoes'

const TIPO_LABELS: Record<string, string> = {
  REVISAO_TAP:          'Revisão solicitada – TAP',
  REVISAO_VIABILIDADE:  'Revisão solicitada – Viabilidade',
  REVISAO_CRONOGRAMA:   'Revisão solicitada – Cronograma',
  APROVACAO:            'Aprovação',
  VENCIMENTO_30D:       'Vencimento em 30 dias',
  VENCIMENTO_15D:       'Vencimento em 15 dias',
  VENCIMENTO_7D:        'Vencimento em 7 dias',
  ATRASO:               'Atraso detectado',
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  REVISAO_TAP:          <AlertTriangle size={18} className="text-amber-500" />,
  REVISAO_VIABILIDADE:  <AlertTriangle size={18} className="text-amber-500" />,
  REVISAO_CRONOGRAMA:   <AlertTriangle size={18} className="text-amber-500" />,
  APROVACAO:            <CheckCircle   size={18} className="text-green-500" />,
  ATRASO:               <AlertTriangle size={18} className="text-red-500"   />,
  VENCIMENTO_30D:       <Clock         size={18} className="text-blue-500"  />,
  VENCIMENTO_15D:       <Clock         size={18} className="text-orange-400"/>,
  VENCIMENTO_7D:        <Clock         size={18} className="text-red-400"   />,
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function tabFromTipo(tipo: string): string {
  if (tipo === 'REVISAO_TAP') return 'TAP'
  if (tipo === 'REVISAO_VIABILIDADE') return 'viabilidade'
  if (tipo === 'REVISAO_CRONOGRAMA') return 'cronograma'
  return ''
}

export default function NotificacoesClient({ notificacoes }: { notificacoes: Notificacao[] }) {
  const router = useRouter()

  function handleClick(n: Notificacao) {
    if (!n.projeto_id) return
    const tab = tabFromTipo(n.tipo)
    const url = `/projetos/${n.projeto_id}${tab ? `?tab=${tab}` : ''}`
    router.push(url)
  }

  const revisoes = notificacoes.filter(n => n.tipo.startsWith('REVISAO'))
  const outras   = notificacoes.filter(n => !n.tipo.startsWith('REVISAO'))

  function Section({ titulo, items }: { titulo: string; items: Notificacao[] }) {
    if (!items.length) return null
    return (
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">{titulo}</h2>
        <div className="space-y-2">
          {items.map(n => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={`card p-4 flex gap-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                n.tipo.startsWith('REVISAO') ? 'border-l-amber-400' : 'border-l-transparent'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {TIPO_ICON[n.tipo] ?? <Bell size={18} className="text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{n.titulo}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{formatDate(n.created_at)}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{n.mensagem}</p>
                {n.projeto_nome && (
                  <span className="inline-flex items-center mt-2 text-xs text-megag-azul font-medium">
                    → {n.projeto_nome}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-megag-azul/10">
          <Bell size={20} style={{ color: '#003087' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#003087' }}>Central de Notificações</h1>
          <p className="text-sm text-gray-500">{notificacoes.length} notificação(ões) registrada(s)</p>
        </div>
      </div>

      {notificacoes.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma notificação no momento.</p>
        </div>
      ) : (
        <>
          <Section titulo="Revisões pendentes" items={revisoes} />
          <Section titulo="Outras notificações" items={outras} />
        </>
      )}
    </div>
  )
}
