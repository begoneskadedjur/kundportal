// src/components/ui/Select.tsx
// Custom dropdown som ersätter native <select> — full kontroll över styling,
// renderar listan via portal så att den aldrig klipps av overflow i modaler.

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  error?: string
  id?: string
  required?: boolean
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Välj...',
  label,
  disabled = false,
  className = '',
  error,
  id,
  required,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''

  const openMenu = useCallback(() => {
    if (disabled) return
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = Math.min(options.length * 36 + 8, 260)
    const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8

    setMenuStyle({
      position: 'fixed',
      left: rect.left + window.scrollX,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top - window.scrollY, top: 'auto' }
        : { top: rect.bottom + window.scrollY + 4, bottom: 'auto' }),
      zIndex: 9999,
    })
    setOpen(true)
  }, [disabled, options.length])

  // Stäng vid klick utanför
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Stäng vid Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleSelect = (optValue: string, optDisabled?: boolean) => {
    if (optDisabled) return
    onChange(optValue)
    setOpen(false)
  }

  const menu = open
    ? createPortal(
        <ul
          role="listbox"
          style={menuStyle}
          className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-y-auto py-1 max-h-64"
          onMouseDown={e => e.preventDefault()} // förhindra blur på knappen
        >
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value, opt.disabled)}
                className={`
                  flex items-center justify-between px-3 py-2 text-sm cursor-pointer select-none
                  ${opt.disabled
                    ? 'text-slate-600 cursor-not-allowed'
                    : isSelected
                      ? 'text-white bg-slate-700/60'
                      : 'text-slate-200 hover:bg-slate-700/50 hover:text-white'
                  }
                `}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#20c58f] shrink-0 ml-2" />}
              </li>
            )
          })}
        </ul>,
        document.body
      )
    : null

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-slate-400 mb-1"
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`
          w-full flex items-center justify-between
          px-3 py-2 text-sm text-left
          bg-slate-800/50 border rounded-lg
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error
            ? 'border-red-500 focus:ring-red-500/50'
            : open
              ? 'border-[#20c58f] ring-2 ring-[#20c58f]/25'
              : 'border-slate-700 hover:border-slate-600'
          }
        `}
      >
        <span className={selectedLabel ? 'text-white' : 'text-slate-500'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}

      {menu}
    </div>
  )
}
