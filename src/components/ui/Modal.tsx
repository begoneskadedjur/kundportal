// src/components/ui/Modal.tsx - Förbättrad modal base komponent
import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Button from './Button'
import Card from './Card'
import Portal from './Portal'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string | React.ReactNode
  subtitle?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  footer?: React.ReactNode
  preventClose?: boolean
  zIndex?: number
  usePortal?: boolean
  headerActions?: React.ReactNode // Extra actions to show in header between title and close button
  className?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'lg',
  children,
  footer,
  preventClose = false,
  zIndex = 100,
  usePortal = false,
  headerActions,
  className
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Förhindra body scroll när modal är öppen
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Focus på modal för accessibility
      modalRef.current?.focus()
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // ESC key för att stänga modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, preventClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !preventClose) {
      onClose()
    }
  }

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ 
        zIndex: usePortal ? 9999 : zIndex,
        pointerEvents: 'auto' // Återställ pointer events för modalen
      }}
      onClick={handleBackdropClick}
      ref={modalRef}
      tabIndex={-1}
    >
      <Card 
        className={`
          w-full ${sizeClasses[size]} 
          ${usePortal ? 'min-h-[600px] max-h-[90vh]' : 'max-h-[95vh]'}
          overflow-hidden flex flex-col 
          bg-slate-900/95 backdrop-blur border-slate-600 shadow-2xl
          animate-in zoom-in-95 duration-200
        `}
        style={{
          minHeight: usePortal ? '600px' : 'auto' // Ensure proper minimum height for modals
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white truncate">{title}</h2>
            {subtitle && (
              <p className="text-slate-400 mt-1 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {headerActions}
            {!preventClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 border-t border-slate-700 bg-slate-900/95">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );

  // Använd Portal om usePortal är true, annars rendera normalt
  if (usePortal) {
    return <Portal>{modalContent}</Portal>;
  }

  return modalContent;
}