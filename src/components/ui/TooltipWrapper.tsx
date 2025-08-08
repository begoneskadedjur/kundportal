// src/components/ui/TooltipWrapper.tsx - Återanvändbar tooltip-komponent

import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'

interface TooltipWrapperProps {
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  children: React.ReactNode
  disabled?: boolean
}

export default function TooltipWrapper({
  content,
  position = 'top',
  delay = 200,
  className = '',
  children,
  disabled = false
}: TooltipWrapperProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleMouseEnter = () => {
    if (disabled) return
    
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
    }, delay)
  }

  const handleMouseLeave = () => {
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

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-block ${className}`}
      >
        {children}
      </div>
      
      {isVisible && content && ReactDOM.createPortal(
        <div
          style={tooltipStyle}
          className="pointer-events-none"
        >
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-700 max-w-sm whitespace-pre-line">
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