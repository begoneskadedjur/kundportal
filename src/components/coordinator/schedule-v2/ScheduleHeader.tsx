// ScheduleHeader.tsx — Header med datumnavigation, vy-växlare, filter och knappar
import { useState, useRef, useEffect, useMemo } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, CalendarOff, SlidersHorizontal } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import Button from '../../ui/Button'
import { StatusLegend } from './StatusLegend'
import { getWeekNumber } from './scheduleUtils'
import { FILTER_STATUSES } from './scheduleConstants'
import { ScheduleFilterPopover } from './ScheduleFilterPopover'
import type { Technician } from '../../../types/database'

export type ViewMode = 'day' | 'week'

interface ScheduleHeaderProps {
  currentDate: Date
  viewMode: ViewMode
  onChangeDate: (date: Date) => void
  onChangeView: (mode: ViewMode) => void
  onCreateCase: () => void
  onCreateAbsence: () => void
  stats: { scheduled: number; toBook: number; technicians: number }
  // Filter-props
  activeStatuses: Set<string>
  setActiveStatuses: (s: Set<string>) => void
  defaultStatuses: Set<string>
  technicians: Technician[]
  selectedTechnicianIds: Set<string>
  setSelectedTechnicianIds: (ids: Set<string>) => void
}

export function ScheduleHeader({
  currentDate,
  viewMode,
  onChangeDate,
  onChangeView,
  onCreateCase,
  onCreateAbsence,
  stats,
  activeStatuses,
  setActiveStatuses,
  defaultStatuses,
  technicians,
  selectedTechnicianIds,
  setSelectedTechnicianIds,
}: ScheduleHeaderProps) {
  const weekNum = getWeekNumber(currentDate)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Stäng popover vid klick utanför
  useEffect(() => {
    if (!filterOpen) return
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterOpen])

  // Stäng vid Escape
  useEffect(() => {
    if (!filterOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [filterOpen])

  // Beräkna om filter avviker från default
  const activeFilterCount = useMemo(() => {
    const allStatusKeys = FILTER_STATUSES.flatMap(s => s.group || [s.key])
    const hiddenStatuses = allStatusKeys.filter(k => defaultStatuses.has(k) && !activeStatuses.has(k))
    const extraStatuses = allStatusKeys.filter(k => !defaultStatuses.has(k) && activeStatuses.has(k))
    const defaultTechIds = new Set(technicians.filter(t => t.role === 'Skadedjurstekniker').map(t => t.id))
    const techDiff = technicians.filter(t => defaultTechIds.has(t.id) !== selectedTechnicianIds.has(t.id))
    return hiddenStatuses.length + extraStatuses.length + techDiff.length
  }, [activeStatuses, defaultStatuses, technicians, selectedTechnicianIds])

  const hasActiveFilters = activeFilterCount > 0

  const navigateDate = (delta: number) => {
    const d = new Date(currentDate)
    if (viewMode === 'day') d.setDate(d.getDate() + delta)
    else d.setDate(d.getDate() + delta * 7)
    onChangeDate(d)
  }

  const goToday = () => onChangeDate(new Date())

  const dateLabel = viewMode === 'day'
    ? currentDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `Vecka ${weekNum}`

  const dateSubLabel = viewMode === 'week'
    ? (() => {
        const start = new Date(currentDate)
        const day = start.getDay() || 7
        start.setDate(start.getDate() - day + 1)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        return `${start.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      })()
    : null

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between gap-4 z-10 flex-shrink-0">
      {/* Vänster: titel + stats */}
      <div className="flex items-center gap-3 min-w-0">
        <CalendarDays className="w-5 h-5 text-blue-400 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white truncate">Schemaöversikt</h1>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{stats.scheduled} schemalagda</span>
            {stats.toBook > 0 && (
              <>
                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                <span className="text-amber-400">{stats.toBook} att boka in</span>
              </>
            )}
            <span className="w-1 h-1 bg-slate-600 rounded-full" />
            <span>{stats.technicians} tekniker</span>
          </div>
        </div>
      </div>

      {/* Mitten: datum-navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigateDate(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center min-w-[180px]">
          <p className="text-sm font-semibold text-white">{dateLabel}</p>
          {dateSubLabel && <p className="text-[10px] text-slate-400">{dateSubLabel}</p>}
        </div>

        <button
          onClick={() => navigateDate(1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Vy-växlare */}
        <div className="flex rounded-lg bg-slate-800/50 border border-slate-700/50 p-0.5 ml-2">
          {(['day', 'week'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onChangeView(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === mode
                  ? 'bg-[#20c58f] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'day' ? 'Dag' : 'Vecka'}
            </button>
          ))}
        </div>

        <button
          onClick={goToday}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 border border-slate-700/50 transition-colors ml-1"
        >
          Idag
        </button>
      </div>

      {/* Höger: legend + filter + knappar */}
      <div className="flex items-center gap-3">
        <div className="hidden xl:block">
          <StatusLegend />
        </div>

        {/* Filter-knapp + popover */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              border transition-colors duration-200
              ${hasActiveFilters
                ? 'border-[#20c58f]/40 bg-[#20c58f]/10 text-[#20c58f] hover:bg-[#20c58f]/15'
                : 'border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800/50'
              }
            `}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#20c58f] text-white min-w-[18px] text-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {filterOpen && (
              <ScheduleFilterPopover
                activeStatuses={activeStatuses}
                setActiveStatuses={setActiveStatuses}
                technicians={technicians}
                selectedTechnicianIds={selectedTechnicianIds}
                setSelectedTechnicianIds={setSelectedTechnicianIds}
                defaultStatuses={defaultStatuses}
              />
            )}
          </AnimatePresence>
        </div>

        <Button onClick={onCreateCase} variant="primary" className="text-sm">
          <FileText className="w-4 h-4 mr-1.5" />
          Nytt ärende
        </Button>
        <Button onClick={onCreateAbsence} variant="secondary" className="text-sm">
          <CalendarOff className="w-4 h-4 mr-1.5" />
          Frånvaro
        </Button>
      </div>
    </header>
  )
}
