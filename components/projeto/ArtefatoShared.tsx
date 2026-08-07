'use client'

// Componentes visuais compartilhados por TapEditor e ViabilidadeEditor.
// Não contêm lógica de negócio — apenas apresentação.

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    APROVADO:           { bg: 'bg-green-100', text: 'text-green-700',  label: '✓ Aprovado' },
    PENDENTE_APROVACAO: { bg: 'bg-amber-100', text: 'text-amber-700',  label: '⏳ Pendente de Aprovação' },
    RASCUNHO:           { bg: 'bg-gray-100',  text: 'text-gray-600',   label: 'Rascunho' },
    REPROVADO:          { bg: 'bg-red-100',   text: 'text-red-700',    label: '✕ Reprovado' },
  }
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export function SectionBlock({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: '#003087' }}>
        <span className="text-white text-xs font-mono bg-white/20 px-2 py-0.5 rounded">{number}</span>
        <span className="text-white font-semibold text-sm">{title}</span>
      </div>
      <div className="p-4 bg-white">{children}</div>
    </div>
  )
}

export function TextValue({
  value,
  placeholder,
}: {
  value?: string | number | null
  placeholder?: string
}) {
  const display = value !== undefined && value !== null && value !== '' ? String(value) : null
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap">
      {display ?? <span className="text-gray-400 italic">{placeholder ?? 'Não preenchido'}</span>}
    </p>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="mb-3">
      <label className="input-label">{label}</label>
      <textarea
        className="input w-full resize-y"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
