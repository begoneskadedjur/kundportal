// GridEventCard.tsx — Kompakt ärende-kort för vecko- och månadsvy
import { memo } from 'react'
import { BeGoneCaseRow } from '../../../types/database'
import { getStatusStyle } from './scheduleConstants'
import { formatTime, formatAddress } from './scheduleUtils'

interface GridEventCardProps {
  caseData: BeGoneCaseRow
  onClick: () => void
  technicianName?: string
  techColor?: string
  compact?: boolean  // månadsvy = ännu kompaktare
}

export const GridEventCard = memo(function GridEventCard({
  caseData,
  onClick,
  technicianName,
  techColor,
  compact = false,
}: GridEventCardProps) {
  const style = getStatusStyle(caseData.status, caseData.case_type)
  const startRaw = caseData.start_date || caseData.due_date
  const endRaw = caseData.due_date || caseData.start_date
  const start = startRaw ? new Date(startRaw) : null
  const end = endRaw ? new Date(endRaw) : null

  const customerName = caseData.company_name ||
    (caseData as any).customer_name ||
    (caseData as any).name ||
    caseData.title ||
    '–'

  const isContract = caseData.case_type === 'contract'

  return (
    <div
      onClick={onClick}
      className={`
        rounded-md border-l-4 cursor-pointer select-none
        hover:brightness-110 hover:shadow-md transition-all duration-100
        ${style.bg} ${style.border}
        ${isContract ? 'ring-1 ring-purple-400/20' : ''}
        ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
      `}
      style={techColor ? { borderLeftColor: techColor } : undefined}
    >
      {/* Kundnamn */}
      <p className={`font-medium truncate leading-tight ${style.text} ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {isContract && <span className="mr-0.5 opacity-70">★</span>}
        {customerName}
      </p>

      {/* Teknikernamn — döljs i compact */}
      {!compact && technicianName && (
        <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
          {technicianName}
        </p>
      )}

      {/* Tid */}
      {!compact && start && end && (
        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
          {formatTime(start)}–{formatTime(end)}
        </p>
      )}
    </div>
  )
})
