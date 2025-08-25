// src/components/shared/PDFExportButton.tsx
// Reusable PDF export button following BeGone design patterns

import React, { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import Button from '../ui/Button'
import toast from 'react-hot-toast'

interface PDFExportButtonProps {
  onExport: () => Promise<void>
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  iconOnly?: boolean
  className?: string
  disabled?: boolean
  tooltip?: string
}

export default function PDFExportButton({
  onExport,
  variant = 'secondary',
  size = 'md',
  label = 'Exportera PDF',
  iconOnly = false,
  className = '',
  disabled = false,
  tooltip
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (isExporting || disabled) return

    try {
      setIsExporting(true)
      await onExport()
      toast.success('PDF exporterad framgångsrikt')
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Kunde inte exportera PDF. Försök igen.')
    } finally {
      setIsExporting(false)
    }
  }

  const buttonVariantClass = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600',
    ghost: 'bg-transparent hover:bg-slate-700 text-slate-300 border-slate-600 hover:text-white'
  }[variant]

  const sizeClass = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }[size]

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting || disabled}
      className={`
        ${buttonVariantClass} ${sizeClass} ${className}
        transition-all duration-200 
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${iconOnly ? 'p-2' : ''}
      `}
      title={tooltip || label}
    >
      {isExporting ? (
        <>
          <Loader2 className={`${iconOnly ? 'w-4 h-4' : size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} />
          {!iconOnly && (size === 'sm' ? 'Exporterar...' : 'Exporterar PDF...')}
        </>
      ) : (
        <>
          <FileDown className={`${iconOnly ? 'w-4 h-4' : size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
          {!iconOnly && label}
        </>
      )}
    </Button>
  )
}