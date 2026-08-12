// src/components/shared/CaseModalSection.tsx
// Gemensamt sektionsskal för ärendemodalerna (EditContractCaseModal,
// EditCaseModal m.fl.). Ren presentationskomponent enligt projektets
// kompakta modal-standard - ingen kunskap om formData eller logik.
import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface CaseModalSectionProps {
  icon?: LucideIcon
  /** Färgklass för ikonen, t.ex. "text-blue-400" */
  iconClassName?: string
  title?: string
  /** Höger om rubriken, t.ex. en knapp eller badge */
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Dämpad variant för sub-sektioner */
  subtle?: boolean
}

export default function CaseModalSection({
  icon: Icon,
  iconClassName = 'text-slate-400',
  title,
  actions,
  children,
  className = '',
  subtle = false
}: CaseModalSectionProps) {
  return (
    <section
      className={`p-3 rounded-xl border ${
        subtle
          ? 'bg-slate-800/20 border-slate-700/50'
          : 'bg-slate-800/30 border-slate-700'
      } ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {title && (
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 min-w-0">
              {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconClassName}`} />}
              <span className="truncate">{title}</span>
            </h3>
          )}
          {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
