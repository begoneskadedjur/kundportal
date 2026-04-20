// src/components/coordinator/follow-up/CoordinatorStatusDropdown.tsx
// Delad dropdown för koordinatorns case-status (Ny, Mottagen, Pågår, Kontaktad, Inbokad, Klar)
// Används i CasePipeline-tabellen och i FollowUpTable-korten.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CoordinatorCaseStatus } from '../../../types/casePipeline'
import { COORDINATOR_STATUS_CONFIG } from '../../../types/casePipeline'

interface CoordinatorStatusDropdownProps {
  value: CoordinatorCaseStatus
  onChange: (status: CoordinatorCaseStatus) => void
  size?: 'sm' | 'md'
}

export default function CoordinatorStatusDropdown({
  value,
  onChange,
  size = 'sm',
}: CoordinatorStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cfg = COORDINATOR_STATUS_CONFIG[value]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const triggerClasses = size === 'md'
    ? 'px-2 py-1 text-[11px]'
    : 'px-1.5 py-0.5 text-[10px]'

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className={`flex items-center gap-1 rounded font-medium cursor-pointer transition-colors ${triggerClasses} ${cfg.bgColor} ${cfg.color}`}
      >
        {cfg.label}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
          {(Object.entries(COORDINATOR_STATUS_CONFIG) as [CoordinatorCaseStatus, typeof cfg][]).map(([key, val]) => (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation()
                onChange(key)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-medium hover:bg-slate-700/50 transition-colors ${val.color} ${key === value ? val.bgColor : ''}`}
            >
              {val.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
