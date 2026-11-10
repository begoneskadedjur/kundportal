// src/components/ui/TooltipWrapper.tsx - Återanvändbar tooltip-komponent
// showOnFocus (tillval): tooltipen öppnas också när något i triggern får
// tangentbordsfokus och stängs när fokus lämnar. Escape stänger alltid en öppen tooltip.
// openOnClick (tillval, 3.127.0): rutan öppnas och stängs med tryck eller klick
// på triggern, stängs vid tryck utanför och med Esc (fokus tillbaka till
// triggern), och är klickbar så länge den är öppen. Hovring öppnar då inte.
// Utan tillvalet fungerar komponenten exakt som förut.

import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'

interface TooltipWrapperProps {
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  children: React.ReactNode
  disabled?: boolean
  /** Visa även vid fokus (tangentbord), inte bara vid hovring */
  showOnFocus?: boolean
  /** Ersätter standardrutans klasser (bakgrund, padding, bredd) */
  panelClassName?: string
  /** Öppna och stäng med tryck eller klick i stället för hovring; rutan är klickbar */
  openOnClick?: boolean
}

export default function TooltipWrapper({
  content,
  position = 'top',
  delay = 200,
  className = '',
  children,
  disabled = false,
  showOnFocus = false,
  panelClassName,
  openOnClick = false,
}: TooltipWrapperProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Escape stänger en öppen tooltip
  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false)
        // Klickläget: fokus tillbaka till knappen som öppnade rutan
        if (openOnClick) triggerRef.current?.querySelector<HTMLElement>('button, [tabindex]')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isVisible, openOnClick])

  // Klickläget: tryck utanför triggern och rutan stänger
  useEffect(() => {
    if (!openOnClick || !isVisible) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setIsVisible(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [openOnClick, isVisible])

  const show = (wait: number) => {
    if (disabled) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const scrollY = window.scrollY
        const scrollX = window.scrollX

        let x = 0
        let y = 0

        switch (position) {
          case 'top':
            x = rect.left + rect.width / 2 + scrollX
            y = rect.top - 8 + scrollY
            break
          case 'bottom':
            x = rect.left + rect.width / 2 + scrollX
            y = rect.bottom + 8 + scrollY
            break
          case 'left':
            x = rect.left - 8 + scrollX
            y = rect.top + rect.height / 2 + scrollY
            break
          case 'right':
            x = rect.right + 8 + scrollX
            y = rect.top + rect.height / 2 + scrollY
            break
        }

        setCoords({ x, y })
        setIsVisible(true)
      }
    }, wait)
  }

  const handleMouseEnter = () => show(delay)

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: coords.x,
    top: coords.y,
    transform:
      position === 'top' ? 'translate(-50%, -100%)' :
      position === 'bottom' ? 'translate(-50%, 0)' :
      position === 'left' ? 'translate(-100%, -50%)' :
      'translate(0, -50%)',
    zIndex: 99999,
  }

  const clickProps = openOnClick
    ? {
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          // Klick i rutan bubblar hit genom portalen: rutan ska vara klickbar, inte stängas
          if (panelRef.current?.contains(e.target as Node)) return
          if (isVisible) hide()
          else show(0)
        },
      }
    : {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: hide,
      }

  const focusProps = showOnFocus && !openOnClick
    ? {
        onFocus: (e: React.FocusEvent<HTMLDivElement>) => {
          if ((e.target as HTMLElement).matches?.(':focus-visible')) show(0)
        },
        onBlur: hide,
      }
    : {}

  return (
    <>
      <div
        ref={triggerRef}
        {...clickProps}
        {...focusProps}
        className={`inline-block ${className}`}
      >
        {children}
      </div>

      {isVisible && content && ReactDOM.createPortal(
        <div
          ref={panelRef}
          style={tooltipStyle}
          className={openOnClick ? 'pointer-events-auto' : 'pointer-events-none'}
          role={openOnClick ? 'dialog' : 'tooltip'}
        >
          <div className={panelClassName ?? 'bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-700 max-w-sm whitespace-pre-line'}>
            {content}

            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-slate-900 border-slate-700 transform rotate-45 ${
                position === 'top'
                  ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b'
                  : position === 'bottom'
                  ? 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t'
                  : position === 'left'
                  ? 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r'
                  : 'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l'
              }`}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
