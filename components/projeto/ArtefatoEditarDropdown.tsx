'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, PenLine, Upload, Download } from 'lucide-react'

interface Props {
  onEditarManual: () => void
  onImportar: () => void
  onExportar: () => void
  exportando?: boolean
}

export default function ArtefatoEditarDropdown({
  onEditarManual, onImportar, onExportar, exportando,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-secondary text-sm flex items-center gap-1.5"
        onClick={() => setOpen(o => !o)}
      >
        Editar <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-56 py-1 text-sm">
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700"
            onClick={() => { setOpen(false); onEditarManual() }}
          >
            <PenLine size={15} className="text-gray-400 shrink-0" />
            Editar manualmente
          </button>
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700"
            onClick={() => { setOpen(false); onImportar() }}
          >
            <Upload size={15} className="text-blue-500 shrink-0" />
            Importar arquivo preenchido
          </button>
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 disabled:opacity-50"
            disabled={!!exportando}
            onClick={() => { setOpen(false); onExportar() }}
          >
            <Download size={15} className="text-green-600 shrink-0" />
            {exportando ? 'Gerando arquivo…' : 'Exportar modelo de arquivo'}
          </button>
        </div>
      )}
    </div>
  )
}
