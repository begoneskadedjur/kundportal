// EventBlock.tsx — Enskilt event-block med layered information + lane-stacking
import { useState, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
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
  lane?: number
  totalLanes?: number
}

export const EventBlock = memo(function EventBlock({ caseData, onClick, viewMode, weekStart, lane = 0, totalLanes = 1 }: EventBlockProps) {
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

  // Lane-beräkning
  const totalHeight = ROW_HEIGHT - 10 // 78px tillgängligt
  const eventHeight = totalHeight / totalLanes
  const topOffset = 4 + (lane * eventHeight) // 4px baseline
  const isCompact = eventHeight < 40

  const style = getStatusStyle(caseData.status, caseData.case_type)
  const startStr = formatTime(start)
  const endStr = formatTime(end)
  const isContract = caseData.case_type === 'contract'
  const displayName = caseData.company_name || caseData.bestallare || caseData.kontaktperson || caseData.title || ''
  const caseNum = caseData.case_number
  const addr = shortAddress(caseData.adress)
  const isWeek = viewMode === 'week'
  const showSecondLine = !isWeek && !isCompact && width > 150

  return (
    <div
      ref={blockRef}
      className={`
        absolute cursor-pointer rounded-md border-l-4 transition-all duration-150
        hover:brightness-110 hover:shadow-lg hover:z-30
        ${style.bg} ${style.border}
        ${isContract ? 'ring-1 ring-purple-400/20' : ''}
      `}
      style={{
        left: x,
        width,
        top: topOffset,
        height: eventHeight - 2, // 2px gap mellan lanes
      }}
      onClick={() => onClick(caseData)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col justify-center overflow-hidden">
        {/* Rad 1: kundnamn + tidsspan */}
        <div className="flex items-center justify-between gap-0.5 min-w-0">
          <span className={`${isWeek || isCompact ? 'text-[9px]' : 'text-xs'} font-semibold truncate ${style.text}`}>
            {isContract && <span className="text-purple-400 mr-0.5">★</span>}
            {displayName}
          </span>
          {!isWeek && (
            <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} font-mono shrink-0 ${style.text} opacity-80`}>
              {startStr}–{endStr}
            </span>
          )}
        </div>

        {/* Rad 2 (om bredd och höjd tillåter): ärendenummer · skadedjur · adress */}
        {showSecondLine && (caseNum || caseData.skadedjur || addr) && (
          <p className={`text-[10px] truncate mt-0.5 ${style.text} opacity-60`}>
            {[caseNum, caseData.skadedjur, addr].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Hover card via portal — undviker stacking-context-problem med sticky header */}
      {hovered && blockRef.current && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={(() => {
            const rect = blockRef.current!.getBoundingClientRect()
            const showBelow = rect.top < 200
            return showBelow
              ? { left: rect.left, top: rect.bottom + 8 }
              : { left: rect.left, top: rect.top - 8, transform: 'translateY(-100%)' }
          })()}
        >
          <EventHoverCard caseData={caseData} />
        </div>,
        document.body
      )}
    </div>
  )
})
