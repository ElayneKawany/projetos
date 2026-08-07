'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, GitBranch, AlertTriangle } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface CronogramaItem {
  id: number; projeto_id: number; projeto_codigo: string; projeto_nome: string
  versao: number; label: string; is_baseline: number; status: string
  criador_nome: string; total_tarefas: number; progresso_medio: number
  aprovado_em?: string; created_at: string
}

interface Props {
  cronogramas: CronogramaItem[]
  projetos: { id: number; codigo: string; nome: string }[]
  session: SessionUser
}

export default function CronogramasClient({ cronogramas, projetos, session }: Props) {
  const router = useRouter()

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cronogramas</h1>
          <p className="page-subtitle">Baseline e replanejamentos por projeto</p>
        </div>
      </div>

      {cronogramas.length === 0 ? (
        <div className="card text-center py-16 text-megag-cinza-texto">
          <CalendarDays size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum cronograma cadastrado.</p>
          <p className="text-sm mt-1">Cronogramas são criados a partir da página do projeto quando ele atinge a fase &quot;Cronograma Oficial&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {cronogramas.map(c => (
            <div
              key={c.id}
              className="card cursor-pointer hover:shadow-megag-md transition-all"
              onClick={() => router.push(`/cronogramas/${c.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {c.is_baseline ? (
                    <span className="badge bg-megag-azul/10 text-megag-azul">Baseline</span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-700">{c.label}</span>
                  )}
                  <span className={`badge ${c.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.status}
                  </span>
                </div>
                {!c.is_baseline && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <GitBranch size={12} /> Replanejo
                  </span>
                )}
              </div>

              <p className="font-mono text-megag-azul text-xs font-semibold mb-1">{c.projeto_codigo}</p>
              <h3 className="font-semibold text-megag-preto mb-3 leading-snug">{c.projeto_nome}</h3>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-megag-cinza-texto">
                  <span>{c.total_tarefas} tarefas</span>
                  <span>{c.progresso_medio.toFixed(0)}% concluído</span>
                </div>
                <div className="w-full bg-megag-cinza-medio rounded-full h-2">
                  <div
                    className="bg-megag-azul h-2 rounded-full"
                    style={{ width: `${Math.min(100, c.progresso_medio)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 text-xs text-megag-cinza-texto">
                <span>{c.criador_nome}</span>
                <span>{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 card border-megag-azul/20 bg-megag-azul/5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-megag-azul flex-shrink-0 mt-0.5" />
          <div className="text-sm text-megag-cinza-escuro">
            <p className="font-semibold">Regra de Baseline</p>
            <p className="mt-1 text-megag-cinza-texto">
              Após aprovação, o cronograma vira Baseline imutável. Alterações criam Replanejamento V2, V3, etc.
              Todo histórico é mantido para rastreabilidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
