// TimeGridRow.tsx — En teknikers tidsrad med events och frånvaro
import { useMemo } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { HOUR_WIDTH, DAY_START_HOUR, TOTAL_HOURS, WEEK_DAY_COL_WIDTH, WEEK_HOUR_WIDTH, ROW_HEIGHT, getGridWidth } from './scheduleConstants'
import { assignLanes } from './scheduleUtils'
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
  viewMode: ViewMode
  weekStart: Date
}

export function TimeGridRow({ technician, cases, absences, currentDate, onCaseClick, onAbsenceClick, viewMode, weekStart }: TimeGridRowProps) {
  const gridWidth = getGridWidth(viewMode)

  // Beräkna lanes för överlappande events
  const laneMap = useMemo(() => assignLanes(cases), [cases])

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
    <div className="relative border-b border-slate-800/60" style={{ width: gridWidth, height: ROW_HEIGHT }}>
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
}
