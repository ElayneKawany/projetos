'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Seletor de fase com posicionamento inteligente (abre para cima quando não há espaço
 * abaixo, altura limitada ao espaço disponível, texto longo quebra linha). Substitui um
 * <select> nativo nos pontos onde a lista de fases pode ter muitas opções com nomes longos —
 * o popup nativo do <select> não permite controlar altura/posição via CSS, e o menu é
 * renderizado num portal em document.body para não ser cortado por um ancestral com
 * overflow-y-auto (ex.: o corpo de um modal já com rolagem própria).
 */

interface FaseOption {
  id?: number | null
  nome: string
}

interface Props {
  value: string
  options: FaseOption[]
  onChange: (id: string) => void
  placeholder?: string
}

const MARGEM = 12
const ALTURA_MAX_MENU = 320

export default function SelectFase({ value, options, onChange, placeholder = '— Selecione —' }: Props) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selecionada = options.find(o => o.id != null && String(o.id) === value)

  function calcularPosicao() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const espacoAbaixo = window.innerHeight - rect.bottom - MARGEM
    const espacoAcima  = rect.top - MARGEM
    const abrirParaCima = espacoAbaixo < 160 && espacoAcima > espacoAbaixo

    const maxHeight = Math.max(120, Math.min(ALTURA_MAX_MENU, abrirParaCima ? espacoAcima : espacoAbaixo))
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - MARGEM * 2)
    const left = Math.min(rect.left, window.innerWidth - width - MARGEM)

    setMenuStyle(
      abrirParaCima
        ? { position: 'fixed', left, bottom: window.innerHeight - rect.top + 4, width, maxHeight }
        : { position: 'fixed', left, top: rect.bottom + 4, width, maxHeight }
    )
  }

  function handleAbrir() {
    calcularPosicao()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleFechar(e: MouseEvent) {
      const trigger = triggerRef.current
      if (trigger && trigger.contains(e.target as Node)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleScrollResize() { setOpen(false) }
    document.addEventListener('mousedown', handleFechar)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScrollResize, true)
    window.addEventListener('resize', handleScrollResize)
    return () => {
      document.removeEventListener('mousedown', handleFechar)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScrollResize, true)
      window.removeEventListener('resize', handleScrollResize)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="input w-full flex items-center justify-between text-left gap-2"
        onClick={() => (open ? setOpen(false) : handleAbrir())}
      >
        <span className={selecionada ? 'text-gray-800' : 'text-gray-400'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selecionada ? selecionada.nome : placeholder}
        </span>
        <span className="text-gray-400 text-xs shrink-0">▾</span>
      </button>

      {open && createPortal(
        <div
          className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto"
          style={menuStyle}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-400 italic hover:bg-gray-50"
            style={{ whiteSpace: 'normal' }}
            onClick={() => { onChange(''); setOpen(false) }}
          >
            {placeholder}
          </button>
          {options.filter(o => o.id != null).map(o => (
            <button
              key={o.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${String(o.id) === value ? 'bg-blue-50 text-megag-azul font-medium' : 'text-gray-800'}`}
              style={{ whiteSpace: 'normal', lineHeight: 1.3 }}
              onClick={() => { onChange(String(o.id)); setOpen(false) }}
            >
              {o.nome}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
