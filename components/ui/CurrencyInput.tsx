'use client'

import { useRef } from 'react'

interface Props {
  label?: string
  id?: string
  name?: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  helpText?: string
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export default function CurrencyInput({ label, id, name, value, onChange, placeholder, className, disabled, helpText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = value !== null && value !== undefined ? formatBRL(Math.round(value * 100)) : ''

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (allowed.includes(e.key)) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        const currentCents = value !== null && value !== undefined ? Math.round(value * 100) : 0
        const newCents = Math.floor(currentCents / 10)
        onChange(newCents === 0 ? null : newCents / 100)
      }
      return
    }
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      const currentCents = value !== null && value !== undefined ? Math.round(value * 100) : 0
      const newCents = currentCents * 10 + parseInt(e.key, 10)
      onChange(newCents / 100)
    }
  }

  function handleFocus() {
    // Move cursor to end
    const el = inputRef.current
    if (el) {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!text) return
    const cents = parseInt(text, 10)
    onChange(isNaN(cents) ? null : cents / 100)
  }

  return (
    <div className={className}>
      {label && <label className="input-label" htmlFor={id}>{label}</label>}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        className="input w-full tabular-nums"
        value={displayValue}
        placeholder={placeholder ?? 'R$ 0,00'}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onPaste={handlePaste}
        onChange={() => {/* controlled via keydown */}}
        disabled={disabled}
        readOnly={disabled}
      />
      {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
    </div>
  )
}
