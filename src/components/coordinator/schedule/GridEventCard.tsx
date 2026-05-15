// GridEventCard.tsx — Kompakt ärende-kort för vecko- och månadsvy
import { useState, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { BeGoneCaseRow } from '../../../types/database'
import { getStatusStyle } from './scheduleConstants'
import { formatTime, cityAddress } from './scheduleUtils'
import { EventHoverCard } from './EventHoverCard'

interface GridEventCardProps {
  caseData: BeGoneCaseRow
  onClick: () => void
  technicianName?: string
  techColor?: string
  compact?: boolean
  isDragging?: boolean
}

export const GridEventCard = memo(function GridEventCard({
  caseData,
  onClick,
  technicianName,
  techColor,
  compact = false,
  isDragging = false,
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
  const addr = cityAddress((caseData as any).adress)
  const serviceAndAddr = [service, addr].filter(Boolean).join(' · ')

  // Initialer
  const initials = technicianName
    ? technicianName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : ''

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
        onMouseEnter={isDragging ? undefined : handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        className={`
          rounded-md border-l-4 cursor-pointer select-none
          hover:brightness-110 hover:shadow-md transition-all duration-100
          ${style.bg} ${style.border}
          ${isContract ? 'ring-1 ring-purple-400/20' : ''}
          ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
          ${isDragging ? 'opacity-40 pointer-events-none' : ''}
        `}
      >
        {/* Rad 1: ärendenummer + initialer-badge */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          {caseNumber && (
            <p className={`font-mono font-semibold truncate leading-tight ${style.text} ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              {isContract && <span className="mr-0.5 opacity-70">★</span>}
              {caseNumber}
            </p>
          )}
          {initials && (
            <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold leading-none border-2 border-[#20c58f] bg-[#20c58f]/20 text-[#20c58f]">
              {initials}
            </span>
          )}
        </div>

        {/* Kundnamn */}
        {customerName && (
          <p className={`truncate leading-tight text-white ${compact ? 'text-[9px]' : 'text-xs'}`}>
            {customerName}
          </p>
        )}

        {/* Tjänst + adress (ej compact) */}
        {!compact && serviceAndAddr && (
          <p className="text-[10px] text-slate-500 truncate leading-tight">
            {serviceAndAddr}
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
