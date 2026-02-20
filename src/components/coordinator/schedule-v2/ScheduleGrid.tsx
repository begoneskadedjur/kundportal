// ScheduleGrid.tsx — Huvudgrid: sticky teknikerkolumn + scrollbar timgrid
import { useRef, useEffect, useMemo } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { TECH_COL_WIDTH, ROW_HEIGHT, getGridWidth, HOUR_WIDTH } from './scheduleConstants'
import { isSameDay, isInWeek, getWeekStart } from './scheduleUtils'
import { TechnicianRowHeader } from './TechnicianRowHeader'
import { TimeGridHeader } from './TimeGridHeader'
import { TimeGridRow } from './TimeGridRow'
import { NowIndicator } from './NowIndicator'
import type { Absence } from './AbsenceBlock'
import type { ViewMode } from './ScheduleHeader'

interface ScheduleGridProps {
  technicians: Technician[]
  cases: BeGoneCaseRow[]
  absences: Absence[]
  currentDate: Date
  viewMode: ViewMode
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onAbsenceClick?: (absence: Absence) => void
}

export function ScheduleGrid({
  technicians,
  cases,
  absences,
  currentDate,
  viewMode,
  onCaseClick,
  onAbsenceClick,
}: ScheduleGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const gridWidth = getGridWidth(viewMode)

  // Scrolla till 07:00 vid mount och vy-byte
  useEffect(() => {
    if (scrollRef.current) {
      if (viewMode === 'day') {
        // 07:00 = 1 timme efter DAY_START_HOUR(6), dvs 120px
        scrollRef.current.scrollLeft = HOUR_WIDTH
      } else {
        scrollRef.current.scrollLeft = 0
      }
    }
  }, [viewMode, currentDate])

  // Filtrera ärenden per datum
  const dateCases = useMemo(() => {
    return cases.filter(c => {
      const dateField = c.start_date || c.due_date
      if (!dateField) return false
      const caseDate = new Date(dateField)
      if (viewMode === 'day') return isSameDay(caseDate, currentDate)
      return isInWeek(caseDate, weekStart)
    })
  }, [cases, currentDate, viewMode, weekStart])

  // Gruppera ärenden per tekniker
  const casesByTech = useMemo(() => {
    const map = new Map<string, BeGoneCaseRow[]>()
    for (const t of technicians) map.set(t.id, [])

    for (const c of dateCases) {
      const ids = [c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id].filter(Boolean) as string[]
      for (const id of ids) {
        const arr = map.get(id)
        if (arr) arr.push(c)
      }
    }
    return map
  }, [technicians, dateCases])

  // Gruppera frånvaro per tekniker, filtrerad på aktuellt datum/vecka
  const absencesByTech = useMemo(() => {
    const map = new Map<string, Absence[]>()
    for (const t of technicians) map.set(t.id, [])

    for (const a of absences) {
      const aStart = new Date(a.start_date)
      const aEnd = new Date(a.end_date)

      if (viewMode === 'day') {
        const dayStart = new Date(currentDate)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(currentDate)
        dayEnd.setHours(23, 59, 59, 999)
        if (aStart <= dayEnd && aEnd >= dayStart) {
          const arr = map.get(a.technician_id)
          if (arr) arr.push(a)
        }
      } else {
        // Veckovy: visa frånvaro som överlappar med veckan
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        if (aStart < weekEnd && aEnd >= weekStart) {
          const arr = map.get(a.technician_id)
          if (arr) arr.push(a)
        }
      }
    }
    return map
  }, [technicians, absences, currentDate, viewMode, weekStart])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sticky teknikerkolumn */}
      <div className="flex-shrink-0 border-r border-slate-700/50 overflow-hidden" style={{ width: TECH_COL_WIDTH }}>
        {/* Tom header-cell ovanför teknikernamn */}
        <div className="border-b border-slate-700/50 bg-slate-900/95" style={{ height: 32 }}>
          <div className="px-3 h-full flex items-center">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Tekniker</span>
          </div>
        </div>
        {/* Teknikerrader */}
        <div className="overflow-hidden" id="tech-col-scroll">
          {technicians.map((tech, idx) => (
            <TechnicianRowHeader
              key={tech.id}
              technician={tech}
              cases={casesByTech.get(tech.id) || []}
              index={idx}
              currentDate={currentDate}
            />
          ))}
        </div>
      </div>

      {/* Scrollbar tidsgrid */}
      <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleSyncScroll}>
        {/* Timheader */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
          <TimeGridHeader viewMode={viewMode} weekStart={weekStart} />
        </div>

        {/* Rader med now-indicator */}
        <div className="relative" style={{ width: gridWidth }}>
          <NowIndicator viewMode={viewMode} weekStart={weekStart} currentDate={currentDate} />
          {technicians.map((tech) => (
            <TimeGridRow
              key={tech.id}
              technician={tech}
              cases={casesByTech.get(tech.id) || []}
              absences={absencesByTech.get(tech.id) || []}
              currentDate={currentDate}
              onCaseClick={onCaseClick}
              onAbsenceClick={onAbsenceClick}
              viewMode={viewMode}
              weekStart={weekStart}
            />
          ))}
        </div>
      </div>
    </div>
  )

  // Synka vertikal scroll mellan teknikerkolumn och grid
  function handleSyncScroll() {
    const grid = scrollRef.current
    const techCol = document.getElementById('tech-col-scroll')
    if (grid && techCol) {
      techCol.scrollTop = grid.scrollTop
    }
  }
}
