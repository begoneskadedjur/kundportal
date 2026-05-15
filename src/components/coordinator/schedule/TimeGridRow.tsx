// TimeGridRow.tsx — En teknikers tidsrad med events och frånvaro
import { useMemo, memo, useState, useRef } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { HOUR_WIDTH, DAY_START_HOUR, TOTAL_HOURS, WEEK_DAY_COL_WIDTH, WEEK_HOUR_WIDTH, ROW_HEIGHT, getGridWidth, SNAP_MINUTES } from './scheduleConstants'
import { assignLanes, formatTime } from './scheduleUtils'
import { EventBlock } from './EventBlock'
import { AbsenceBlock, type Absence } from './AbsenceBlock'
import type { ViewMode } from './ScheduleHeader'

interface TimeGridRowProps {
  technician: Technician
  cases: BeGoneCaseRow[]
  absences: Absence[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onAbsenceClick?: (absence: Absence) => void
  onCaseMoved?: (caseId: string, newStart: Date, caseData: BeGoneCaseRow, newTechnicianId?: string) => void
  viewMode: ViewMode
  weekStart: Date
  allCases: BeGoneCaseRow[]
}

export const TimeGridRow = memo(function TimeGridRow({ technician, cases, absences, currentDate, onCaseClick, onAbsenceClick, onCaseMoved, viewMode, weekStart, allCases }: TimeGridRowProps) {
  const gridWidth = getGridWidth(viewMode)
  const rowRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dropPreviewX, setDropPreviewX] = useState<number | null>(null)
  const [dropPreviewTime, setDropPreviewTime] = useState<Date | null>(null)

  // Beräkna lanes för överlappande events
  const laneMap = useMemo(() => assignLanes(cases), [cases])

  function xToTime(clientX: number): Date {
    if (!rowRef.current) return new Date(currentDate)
    const rect = rowRef.current.getBoundingClientRect()
    const relX = clientX - rect.left
    const totalMinutes = (relX / HOUR_WIDTH) * 60 + DAY_START_HOUR * 60
    const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
    const clamped = Math.max(DAY_START_HOUR * 60, Math.min(23 * 60 + 45, snapped))
    const d = new Date(currentDate)
    d.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0)
    return d
  }

  // Arbetstidsbakgrund (dagvy)
  const workBg = useMemo(() => {
    if (viewMode === 'week') return null
    const ws = technician.work_schedule as Record<string, { start: string; end: string; active: boolean }> | null
    if (!ws) return null
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayKey = days[currentDate.getDay()]
    const day = ws[dayKey]
    if (!day?.active) return null
    const [sh, sm] = day.start.split(':').map(Number)
    const [eh, em] = day.end.split(':').map(Number)
    const startHour = sh + sm / 60
    const endHour = eh + em / 60
    const left = (startHour - DAY_START_HOUR) * HOUR_WIDTH
    const width = (endHour - startHour) * HOUR_WIDTH
    return { left, width }
  }, [technician.work_schedule, currentDate, viewMode])

  if (viewMode === 'week') {
    return (
      <div className="relative border-b border-slate-800/60" style={{ width: gridWidth, height: ROW_HEIGHT }}>
        {/* 7 dagkolumner */}
        {Array.from({ length: 7 }, (_, dayIdx) => (
          <div
            key={dayIdx}
            className="absolute top-0 h-full border-l border-slate-700/30"
            style={{ left: dayIdx * WEEK_DAY_COL_WIDTH, width: WEEK_DAY_COL_WIDTH }}
          >
            {Array.from({ length: TOTAL_HOURS }, (_, h) => (
              <div
                key={h}
                className="absolute top-0 h-full border-l border-slate-800/15"
                style={{ left: h * WEEK_HOUR_WIDTH }}
              />
            ))}
          </div>
        ))}

        {/* Frånvaro-block */}
        {absences.map(a => (
          <AbsenceBlock key={a.id} absence={a} onClick={onAbsenceClick} viewMode={viewMode} weekStart={weekStart} />
        ))}

        {/* Event-block med lanes */}
        {cases.map(c => {
          const la = laneMap.get(c.id)
          return (
            <EventBlock key={c.id} caseData={c} onClick={onCaseClick} viewMode={viewMode} weekStart={weekStart} lane={la?.lane} totalLanes={la?.totalLanes} />
          )
        })}
      </div>
    )
  }

  // Dagvy
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i)

  return (
    <div
      ref={rowRef}
      className={`relative border-b border-slate-800/60 transition-colors ${dragOver ? 'bg-blue-500/5' : ''}`}
      style={{ width: gridWidth, height: ROW_HEIGHT }}
      onDragOver={e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOver(true)
        const snapped = xToTime(e.clientX)
        const snappedX = ((snapped.getHours() - DAY_START_HOUR) * 60 + snapped.getMinutes()) / 60 * HOUR_WIDTH
        setDropPreviewX(snappedX)
        setDropPreviewTime(snapped)
      }}
      onDragLeave={() => { setDragOver(false); setDropPreviewX(null); setDropPreviewTime(null) }}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        setDropPreviewX(null)
        setDropPreviewTime(null)
        const caseId = e.dataTransfer.getData('caseId')
        if (!caseId || !onCaseMoved) return
        const caseData = allCases.find(c => c.id === caseId)
        if (!caseData) return
        onCaseMoved(caseId, xToTime(e.clientX), caseData, technician.id)
      }}
    >
      {/* Arbetstids-bakgrund */}
      {workBg && (
        <div
          className="absolute top-0 h-full bg-slate-800/15 pointer-events-none"
          style={{ left: workBg.left, width: workBg.width }}
        />
      )}

      {/* Drop-preview: vertikal blå linje + tidsetikett */}
      {dragOver && dropPreviewX !== null && dropPreviewTime !== null && (
        <div
          className="absolute top-0 h-full w-[2px] bg-blue-400 pointer-events-none z-20"
          style={{ left: dropPreviewX }}
        >
          <span className="absolute top-1 left-2 text-[10px] text-blue-300 bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap font-mono">
            {formatTime(dropPreviewTime)}
          </span>
          <div className="absolute -left-[3px] top-0 w-2 h-2 rounded-full bg-blue-400" />
        </div>
      )}

      {/* Timrutnät */}
      {hours.map(i => (
        <div
          key={i}
          className="absolute top-0 h-full border-l border-slate-800/30"
          style={{ left: i * HOUR_WIDTH }}
        >
          <div
            className="absolute top-0 h-full border-l border-slate-800/15"
            style={{ left: HOUR_WIDTH / 2 }}
          />
        </div>
      ))}

      {/* Frånvaro-block */}
      {absences.map(a => (
        <AbsenceBlock key={a.id} absence={a} onClick={onAbsenceClick} viewMode={viewMode} weekStart={weekStart} />
      ))}

      {/* Event-block med lanes */}
      {cases.map(c => {
        const la = laneMap.get(c.id)
        return (
          <EventBlock key={c.id} caseData={c} onClick={onCaseClick} viewMode={viewMode} weekStart={weekStart} lane={la?.lane} totalLanes={la?.totalLanes} />
        )
      })}
    </div>
  )
})
