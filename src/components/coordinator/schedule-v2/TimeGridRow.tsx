// TimeGridRow.tsx — En teknikers tidsrad med events och frånvaro
import { useMemo } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { HOUR_WIDTH, DAY_START_HOUR, TOTAL_HOURS, GRID_WIDTH, ROW_HEIGHT } from './scheduleConstants'
import { EventBlock } from './EventBlock'
import { AbsenceBlock, type Absence } from './AbsenceBlock'

interface TimeGridRowProps {
  technician: Technician
  cases: BeGoneCaseRow[]
  absences: Absence[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onAbsenceClick?: (absence: Absence) => void
}

export function TimeGridRow({ technician, cases, absences, currentDate, onCaseClick, onAbsenceClick }: TimeGridRowProps) {
  // Arbetstidsbakgrund
  const workBg = useMemo(() => {
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
  }, [technician.work_schedule, currentDate])

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i)

  return (
    <div className="relative border-b border-slate-800/60" style={{ width: GRID_WIDTH, height: ROW_HEIGHT }}>
      {/* Arbetstids-bakgrund */}
      {workBg && (
        <div
          className="absolute top-0 h-full bg-slate-800/15 pointer-events-none"
          style={{ left: workBg.left, width: workBg.width }}
        />
      )}

      {/* Timrutnät */}
      {hours.map(i => (
        <div
          key={i}
          className="absolute top-0 h-full border-l border-slate-800/30"
          style={{ left: i * HOUR_WIDTH }}
        >
          {/* Halvtimme-markering */}
          <div
            className="absolute top-0 h-full border-l border-slate-800/15"
            style={{ left: HOUR_WIDTH / 2 }}
          />
        </div>
      ))}

      {/* Frånvaro-block (renderas under events) */}
      {absences.map(a => (
        <AbsenceBlock key={a.id} absence={a} onClick={onAbsenceClick} />
      ))}

      {/* Event-block */}
      {cases.map(c => (
        <EventBlock key={c.id} caseData={c} onClick={onCaseClick} />
      ))}
    </div>
  )
}
