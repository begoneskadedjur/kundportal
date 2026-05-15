// GridEventCard.tsx — Kompakt ärende-kort för vecko- och månadsvy
import { useState, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { BeGoneCaseRow } from '../../../types/database'
import { getStatusStyle } from './scheduleConstants'
import { formatTime } from './scheduleUtils'
import { EventHoverCard } from './EventHoverCard'

interface GridEventCardProps {
  caseData: BeGoneCaseRow
  onClick: () => void
  technicianName?: string
  techColor?: string
  compact?: boolean
}

export const GridEventCard = memo(function GridEventCard({
  caseData,
  onClick,
  technicianName,
  techColor,
  compact = false,
}: GridEventCardProps) {
  const [hovered, setHovered] = useState(false)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0, above: false })
  const blockRef = useRef<HTMLDivElement>(null)

  const style = getStatusStyle(caseData.status, caseData.case_type)
  const startRaw = caseData.start_date || caseData.due_date
  const endRaw = caseData.due_date || caseData.start_date
  const start = startRaw ? new Date(startRaw) : null
  const end = endRaw ? new Date(endRaw) : null

  const isContract = caseData.case_type === 'contract'

  // Ärendenummer: case_number eller title om det ser ut som ett ärendenummer
  const caseNumber = caseData.case_number || caseData.title || ''

  // Kundnamn: company_name (business/contract) || bestallare || kontaktperson
  const customerName = caseData.company_name ||
    (caseData as any).bestallare ||
    (caseData as any).kontaktperson ||
    ''

  // Tjänst
  const service = caseData.service?.name || (caseData as any).skadedjur || ''

  const handleMouseEnter = () => {
    if (!blockRef.current) return
    const rect = blockRef.current.getBoundingClientRect()
    const above = rect.top > 300
    setHoverPos({
      x: rect.left,
      y: above ? rect.top : rect.bottom,
      above,
    })
    setHovered(true)
  }

  return (
    <>
      <div
        ref={blockRef}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        className={`
          rounded-md border-l-4 cursor-pointer select-none
          hover:brightness-110 hover:shadow-md transition-all duration-100
          ${style.bg} ${style.border}
          ${isContract ? 'ring-1 ring-purple-400/20' : ''}
          ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
        `}
        style={techColor ? { borderLeftColor: techColor } : undefined}
      >
        {/* Ärendenummer */}
        {caseNumber && (
          <p className={`font-mono font-semibold truncate leading-tight ${style.text} ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            {isContract && <span className="mr-0.5 opacity-70">★</span>}
            {caseNumber}
          </p>
        )}

        {/* Kundnamn */}
        {customerName && (
          <p className={`truncate leading-tight text-white ${compact ? 'text-[9px]' : 'text-xs'}`}>
            {customerName}
          </p>
        )}

        {/* Teknikernamn (ej compact) */}
        {!compact && technicianName && (
          <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
            {technicianName}
          </p>
        )}

        {/* Tjänst (ej compact) */}
        {!compact && service && (
          <p className="text-[10px] text-slate-500 truncate leading-tight">
            {service}
          </p>
        )}

        {/* Tid */}
        {!compact && start && end && (
          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
            {formatTime(start)}–{formatTime(end)}
          </p>
        )}
        {compact && start && (
          <p className="text-[9px] text-slate-500 leading-tight">
            {formatTime(start)}
          </p>
        )}
      </div>

      {hovered && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: Math.min(hoverPos.x, window.innerWidth - 310),
            top: hoverPos.above ? hoverPos.y - 8 : hoverPos.y + 8,
            transform: hoverPos.above ? 'translateY(-100%)' : 'translateY(0)',
          }}
        >
          <EventHoverCard caseData={caseData} />
        </div>,
        document.body
      )}
    </>
  )
})
