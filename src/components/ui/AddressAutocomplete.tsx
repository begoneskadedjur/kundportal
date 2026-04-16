// src/components/ui/AddressAutocomplete.tsx
// Adressinput med autocomplete via Google Maps Geocoding API.
// Visar förslag medan användaren skriver, portalar dropdownen via #modal-root
// så att den aldrig klipps av overflow i modaler — samma mönster som Select.tsx.

import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MapPin } from 'lucide-react'
import { searchAddresses, type GeocodeResult } from '../../services/geocoding'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string | GeocodeResult) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  id?: string
  required?: boolean
  className?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Fullständig adress...',
  label,
  error,
  disabled = false,
  id,
  required,
  className = '',
}: AddressAutocompleteProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Synka externt value-prop (t.ex. vid reset eller pre-fill från kunddata)
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Rensa debounce vid unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // Stäng dropdown vid klick utanför
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const computeDropdownStyle = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = Math.min(suggestions.length * 40 + 8, 260)
    const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
      zIndex: 9999,
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)
    onChange(raw) // löpande uppdatering vid fri text

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (raw.trim().length < 3) {
      setIsOpen(false)
      setSuggestions([])
      setNoResults(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true)
      const res = await searchAddresses(raw.trim(), 5)
      setIsLoading(false)

      computeDropdownStyle()

      if (res.success && res.results.length > 0) {
        setSuggestions(res.results)
        setNoResults(false)
      } else {
        setSuggestions([])
        setNoResults(true)
      }
      setActiveIndex(-1)
      setIsOpen(true)
    }, 300)
  }

  const handleSelect = (result: GeocodeResult) => {
    setInputValue(result.formatted_address)
    setSuggestions([])
    setIsOpen(false)
    setNoResults(false)
    setActiveIndex(-1)
    onChange(result)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          e.preventDefault()
          handleSelect(suggestions[activeIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  const dropdown = isOpen
    ? createPortal(
        <ul
          ref={dropdownRef}
          role="listbox"
          style={{ ...dropdownStyle, pointerEvents: 'auto' }}
          className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-y-auto py-1 max-h-64"
          onMouseDown={e => e.preventDefault()} // förhindra blur på input vid klick
        >
          {noResults ? (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 italic">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              Inga adresser hittades
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={s.place_id}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none
                  ${i === activeIndex
                    ? 'bg-slate-700/60 text-white'
                    : 'text-slate-200 hover:bg-slate-700/50 hover:text-white'
                  }
                `}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                {s.formatted_address}
              </li>
            ))
          )}
        </ul>,
        document.getElementById('modal-root') ?? document.body
      )
    : null

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-400 mb-1">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className={`
            w-full px-3 py-1.5 pr-8
            bg-slate-900/50 border rounded-lg
            text-sm text-white placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            ${error
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-slate-700 hover:border-slate-600'
            }
          `}
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {dropdown}
    </div>
  )
}
