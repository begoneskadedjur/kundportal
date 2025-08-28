// src/components/ui/CustomTooltip.tsx - Anpassad tooltip komponent för BeGone

import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface CustomTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  delay?: number
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  children,
  content,
  position = 'top',
  className = '',
  delay = 200
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<NodeJS.Timeout>()
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = (e: React.MouseEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        let x = 0
        let y = 0
        
        switch (position) {
          case 'top':
            x = rect.left + rect.width / 2
            y = rect.top - 8
            break
          case 'bottom':
            x = rect.left + rect.width / 2
            y = rect.bottom + 8
            break
          case 'left':
            x = rect.left - 8
            y = rect.top + rect.height / 2
            break
          case 'right':
            x = rect.right + 8
            y = rect.top + rect.height / 2
            break
        }
        
        setCoords({ x, y })
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'transform -translate-x-1/2 -translate-y-full'
      case 'bottom':
        return 'transform -translate-x-1/2 translate-y-0'
      case 'left':
        return 'transform -translate-x-full -translate-y-1/2'
      case 'right':
        return 'transform translate-x-0 -translate-y-1/2'
      default:
        return 'transform -translate-x-1/2 -translate-y-full'
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="relative inline-block cursor-pointer"
      >
        {children}
      </div>
      
      {isVisible && createPortal(
        <div
          className={`
            fixed z-50 px-3 py-2 max-w-xs
            bg-slate-900 border border-slate-600 rounded-lg shadow-xl
            text-xs text-slate-200
            pointer-events-none
            ${getPositionClasses()}
            ${className}
          `}
          style={{
            left: coords.x,
            top: coords.y
          }}
        >
          {content}
          
          {/* Arrow */}
          <div 
            className={`absolute w-2 h-2 bg-slate-900 border-slate-600 transform rotate-45 ${
              position === 'top' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r' :
              position === 'bottom' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l' :
              position === 'left' ? 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-r border-b' :
              'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t'
            }`}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export default CustomTooltip