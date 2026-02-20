// EventBlock.tsx — Enskilt event-block med layered information
import { useState, useRef } from 'react'
import { BeGoneCaseRow } from '../../../types/database'
import { eventX, eventWidth, clampToGrid, formatTime, shortAddress } from './scheduleUtils'
import { getStatusStyle, ROW_HEIGHT } from './scheduleConstants'
import { EventHoverCard } from './EventHoverCard'
import type { ViewMode } from './ScheduleHeader'

interface EventBlockProps {
  caseData: BeGoneCaseRow
  onClick: (caseData: BeGoneCaseRow) => void
  viewMode: ViewMode
  weekStart: Date
}

export function EventBlock({ caseData, onClick, viewMode, weekStart }: EventBlockProps) {
  const [hovered, setHovered] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)

  const startRaw = caseData.start_date || caseData.due_date
  const endRaw = caseData.due_date || caseData.start_date
  if (!startRaw || !endRaw) return null
  const start = new Date(startRaw)
  const end = new Date(endRaw)

  const rawX = eventX(start, viewMode, weekStart)
  const rawW = eventWidth(start, end, viewMode)
  const { x, width } = clampToGrid(rawX, rawW, viewMode)
  if (width <= 0) return null

  const style = getStatusStyle(caseData.status, caseData.case_type)
  const startStr = formatTime(start)
  const endStr = formatTime(end)
  const isContract = caseData.case_type === 'contract'
  const displayName = caseData.bestallare || caseData.kontaktperson || caseData.title || ''
  const addr = shortAddress(caseData.adress)
  const isWeek = viewMode === 'week'
  const showSecondLine = !isWeek && width > 150

  return (
    <div
      ref={blockRef}
      className={`
        absolute top-1 cursor-pointer rounded-md border-l-4 transition-all duration-150
        hover:brightness-110 hover:shadow-lg hover:z-30
        ${style.bg} ${style.border}
        ${isContract ? 'ring-1 ring-purple-400/20' : ''}
      `}
      style={{
        left: x,
        width,
        height: ROW_HEIGHT - 10,
      }}
      onClick={() => onClick(caseData)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-1.5 py-1 h-full flex flex-col justify-center overflow-hidden">
        {/* Rad 1: kundnamn + tidsspan */}
        <div className="flex items-center justify-between gap-0.5 min-w-0">
          <span className={`${isWeek ? 'text-[9px]' : 'text-xs'} font-semibold truncate ${style.text}`}>
            {isContract && <span className="text-purple-400 mr-0.5">★</span>}
            {displayName}
          </span>
          {!isWeek && (
            <span className={`text-[10px] font-mono shrink-0 ${style.text} opacity-80`}>
              {startStr}–{endStr}
            </span>
          )}
        </div>

        {/* Rad 2 (om bredd tillåter): skadedjur + adress */}
        {showSecondLine && (caseData.skadedjur || addr) && (
          <p className={`text-[10px] truncate mt-0.5 ${style.text} opacity-60`}>
            {[caseData.skadedjur, addr].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Hover card */}
      {hovered && (
        <div className="absolute left-0 bottom-full mb-2 z-50 pointer-events-none">
          <EventHoverCard caseData={caseData} />
        </div>
      )}
    </div>
  )
}
