// ScheduleFilterPopover.tsx — Kompakt filter-popover för status + tekniker
import { motion } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import { Technician } from '../../../types/database'
import { FILTER_STATUSES } from './scheduleConstants'

interface ScheduleFilterPopoverProps {
  activeStatuses: Set<string>
  setActiveStatuses: (s: Set<string>) => void
  technicians: Technician[]
  selectedTechnicianIds: Set<string>
  setSelectedTechnicianIds: (ids: Set<string>) => void
  defaultStatuses: Set<string>
}

export function ScheduleFilterPopover({
  activeStatuses,
  setActiveStatuses,
  technicians,
  selectedTechnicianIds,
  setSelectedTechnicianIds,
  defaultStatuses,
}: ScheduleFilterPopoverProps) {

  // ─── Status-helpers ───

  const isStatusActive = (key: string, group?: string[]) => {
    if (group) return group.every(s => activeStatuses.has(s))
    return activeStatuses.has(key)
  }

  const toggleStatus = (key: string, group?: string[]) => {
    const next = new Set(activeStatuses)
    const keys = group || [key]
    const allActive = keys.every(k => next.has(k))
    for (const k of keys) {
      if (allActive) next.delete(k)
      else next.add(k)
    }
    setActiveStatuses(next)
  }

  const allStatusKeys = FILTER_STATUSES.flatMap(s => s.group || [s.key])
  const allStatusesActive = allStatusKeys.every(k => activeStatuses.has(k))

  const toggleAllStatuses = () => {
    const next = new Set(activeStatuses)
    if (allStatusesActive) {
      for (const k of allStatusKeys) next.delete(k)
    } else {
      for (const k of allStatusKeys) next.add(k)
    }
    setActiveStatuses(next)
  }

  // ─── Tekniker-helpers ───

  const allTechsSelected = technicians.every(t => selectedTechnicianIds.has(t.id))

  const toggleTechnician = (id: string) => {
    const next = new Set(selectedTechnicianIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedTechnicianIds(next)
  }

  const toggleAllTechnicians = () => {
    if (allTechsSelected) {
      setSelectedTechnicianIds(new Set())
    } else {
      setSelectedTechnicianIds(new Set(technicians.map(t => t.id)))
    }
  }

  const resetToDefaults = () => {
    setActiveStatuses(new Set(defaultStatuses))
    const defaultTechs = technicians.filter(t => t.role === 'Skadedjurstekniker').map(t => t.id)
    setSelectedTechnicianIds(new Set(defaultTechs))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute top-full right-0 mt-1.5 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          Filtrera schema
        </h3>
        <button
          onClick={resetToDefaults}
          className="text-[10px] font-medium text-slate-400 hover:text-[#20c58f] transition-colors"
        >
          Återställ standard
        </button>
      </div>

      {/* Status-filter */}
      <div className="px-4 py-3 border-b border-slate-700/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
          <button onClick={toggleAllStatuses} className="text-[10px] text-slate-500 hover:text-white transition-colors">
            {allStatusesActive ? 'Avmarkera alla' : 'Markera alla'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {FILTER_STATUSES.map(s => {
            const active = isStatusActive(s.key, s.group)
            return (
              <button
                key={s.key}
                onClick={() => toggleStatus(s.key, s.group)}
                className={`
                  flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors duration-150
                  ${active
                    ? 'bg-slate-800/50 text-white'
                    : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-400'
                  }
                `}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${!active ? 'opacity-30' : ''}`} />
                <span className="text-xs">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tekniker-filter */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tekniker</span>
          <button onClick={toggleAllTechnicians} className="text-[10px] text-slate-500 hover:text-white transition-colors">
            {allTechsSelected ? 'Avmarkera alla' : 'Markera alla'}
          </button>
        </div>
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {technicians.map(tech => {
            const selected = selectedTechnicianIds.has(tech.id)
            return (
              <button
                key={tech.id}
                onClick={() => toggleTechnician(tech.id)}
                className={`
                  w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors duration-150
                  ${selected
                    ? 'bg-slate-800/50 text-white'
                    : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-400'
                  }
                `}
              >
                <div className={`
                  w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold
                  ${selected ? 'ring-1 ring-[#20c58f]/50 text-white' : 'opacity-40 text-slate-400'}
                `}>
                  {tech.name.charAt(0)}
                </div>
                <span className="text-xs truncate">{tech.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
