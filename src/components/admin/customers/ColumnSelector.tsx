// src/components/admin/customers/ColumnSelector.tsx — Kolumnväljare med localStorage-persistering

import React, { useState, useRef, useEffect } from 'react'
import { Settings, ChevronDown } from 'lucide-react'

export interface TableColumn {
  id: string
  label: string
  defaultVisible: boolean
  required: boolean
}

export const AVAILABLE_COLUMNS: TableColumn[] = [
  { id: 'company',        label: 'Organisation & Kontakt', defaultVisible: true,  required: true },
  { id: 'annualValue',    label: 'Årspremie',             defaultVisible: true,  required: false },
  { id: 'casesValue',     label: 'Debiterat utöver avtal', defaultVisible: true,  required: false },
  { id: 'contractValue',  label: 'Avtalsvärde',           defaultVisible: true,  required: false },
  { id: 'contractPeriod', label: 'Kontraktsperiod',       defaultVisible: true,  required: false },
  { id: 'healthScore',    label: 'Health Score',          defaultVisible: true,  required: false },
  { id: 'churnRisk',      label: 'Churn Risk',            defaultVisible: true,  required: false },
  { id: 'manager',        label: 'Säljare',               defaultVisible: true,  required: false },
  { id: 'actions',        label: 'Åtgärder',              defaultVisible: true,  required: true },
]

const STORAGE_KEY = 'begone_customer_columns'

export function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return new Set(JSON.parse(stored))
    } catch {}
    return new Set(AVAILABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
  })

  const toggleColumn = (columnId: string) => {
    const col = AVAILABLE_COLUMNS.find(c => c.id === columnId)
    if (col?.required) return

    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(columnId)) next.delete(columnId)
      else next.add(columnId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const resetToDefaults = () => {
    const defaults = new Set(AVAILABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
    setVisibleColumns(defaults)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...defaults]))
  }

  return { visibleColumns, toggleColumn, resetToDefaults }
}

interface ColumnSelectorProps {
  visibleColumns: Set<string>
  onToggle: (columnId: string) => void
  onReset: () => void
}

export default function ColumnSelector({ visibleColumns, onToggle, onReset }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hiddenCount = AVAILABLE_COLUMNS.filter(c => !c.required && !visibleColumns.has(c.id)).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
          hiddenCount > 0
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
        }`}
      >
        <Settings className="w-4 h-4" />
        Kolumner
        {hiddenCount > 0 && (
          <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {hiddenCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-slate-700">
            <h4 className="text-sm font-medium text-white">Visa/dölj kolumner</h4>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {AVAILABLE_COLUMNS.map(column => (
              <label
                key={column.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700/50 ${
                  column.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column.id)}
                  onChange={() => onToggle(column.id)}
                  disabled={column.required}
                  className="rounded bg-slate-700 border-slate-600 text-green-500 focus:ring-green-500"
                />
                <span className="text-sm text-slate-300">{column.label}</span>
                {column.required && (
                  <span className="ml-auto text-xs text-slate-500">Låst</span>
                )}
              </label>
            ))}
          </div>
          <div className="p-2 border-t border-slate-700 flex justify-between">
            <button onClick={onReset} className="text-xs text-slate-400 hover:text-white transition-colors">
              Återställ
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-green-400 hover:text-green-300 transition-colors">
              Stäng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
