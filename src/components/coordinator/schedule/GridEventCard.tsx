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
  heightPx?: number   // faktisk höjd på wrappern — styr vilka rader som visas
  widthPct?: number   // procentuell bredd (100 / totalLanes) — styr kompakthet vid smala lanes
}

export const GridEventCard = memo(function GridEventCard({
  caseData,
  onClick,
  technicianName: _technicianName,
  techColor,
  compact = false,
  isDragging = false,
  heightPx = 999,
  widthPct = 100,
}: GridEventCardProps) {
  const [hovered, setHovered] = useState(false)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0, above: false })
  const blockRef = useRef<HTMLDivElement>(null)

  const style = getStatusStyle(caseData.status, (caseData as any).case_type)
  const startRaw = caseData.start_date || caseData.due_date
  const endRaw = caseData.due_date || caseData.start_date
  const start = startRaw ? new Date(startRaw) : null
  const end = endRaw ? new Date(endRaw) : null

  const isContract = (caseData as any).case_type === 'contract'

  const caseNumber = caseData.case_number || caseData.title || ''

  const customerName = caseData.company_name ||
    (caseData as any).bestallare ||
    (caseData as any).kontaktperson ||
    ''

  const service = caseData.service?.name || (caseData as any).skadedjur || ''
  const addr = cityAddress((caseData as any).adress)
  const serviceAndAddr = [service, addr].filter(Boolean).join(' · ')

  const categoryLabel = (caseData as any).case_type === 'private' ? 'Privatperson'
    : (caseData as any).case_type === 'business' ? 'Företag'
    : (caseData as any).case_type === 'inspection' ? 'Avtalat Servicebesök'
    : null

  const displayPrimary = (caseData as any).case_type === 'inspection'
    ? (customerName || caseNumber)
    : caseNumber

  // Bestäm vad som ska visas baserat på tillgänglig höjd och bredd
  const isNarrow = widthPct < 40          // smal lane — bara det allra viktigaste
  const isTiny = heightPx < 36            // under ~30 min — bara en rad
  const isShort = heightPx < 56           // under ~50 min — hoppa över adress+tjänst
  const effectiveCompact = compact || isNarrow

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
          h-full rounded-md border-l-4 cursor-pointer select-none overflow-hidden
          hover:brightness-110 hover:shadow-md transition-all duration-100
          ${style.bg} ${style.border}
          ${isContract ? 'ring-1 ring-purple-400/20' : ''}
          ${effectiveCompact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
          ${isDragging ? 'opacity-40 pointer-events-none' : ''}
        `}
        style={techColor ? { borderLeftColor: techColor } : undefined}
      >
        {/* Kategori-label — bara om tillräckligt högt och inte smal/compact */}
        {!effectiveCompact && !isShort && categoryLabel && (
          <p className="text-[9px] text-slate-500 leading-tight truncate">{categoryLabel}</p>
        )}

        {/* Rad 1: kundnamn för inspection, annars ärendenummer */}
        {displayPrimary && (
          <p className={`font-mono font-semibold truncate leading-tight ${style.text} ${effectiveCompact ? 'text-[9px]' : 'text-[10px]'}`}>
            {isContract && <span className="mr-0.5 opacity-70">★</span>}
            {displayPrimary}
          </p>
        )}

        {/* Kundnamn — alltid om det finns plats för minst en rad till */}
        {!isTiny && customerName && (
          <p className={`truncate leading-tight text-white ${effectiveCompact ? 'text-[9px]' : 'text-xs'}`}>
            {customerName}
          </p>
        )}

        {/* Tjänst + adress — bara om inte för kort/smal */}
        {!effectiveCompact && !isShort && serviceAndAddr && (
          <p className="text-[10px] text-slate-500 truncate leading-tight">
            {serviceAndAddr}
          </p>
        )}

        {/* Tid — bara om tillräckligt högt och inte smal */}
        {!isNarrow && !isShort && start && end && (
          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
            {formatTime(start)}–{formatTime(end)}
          </p>
        )}
        {effectiveCompact && !isTiny && start && (
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
