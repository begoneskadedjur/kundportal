// EventHoverCard.tsx — Hover-tooltip med full ärendeinformation
import { BeGoneCaseRow } from '../../../types/database'
import { formatAddress, formatTime } from './scheduleUtils'
import { getStatusStyle } from './scheduleConstants'
import { MapPin, Users, Bug, Clock } from 'lucide-react'

interface EventHoverCardProps {
  caseData: BeGoneCaseRow
}

export function EventHoverCard({ caseData }: EventHoverCardProps) {
  const style = getStatusStyle(caseData.status, caseData.case_type)
  const address = formatAddress(caseData.adress)
  const startTime = caseData.start_date ? formatTime(new Date(caseData.start_date)) : ''
  const endTime = caseData.due_date ? formatTime(new Date(caseData.due_date)) : ''
  const isContract = caseData.case_type === 'contract'

  const technicians = [
    caseData.primary_assignee_name,
    caseData.secondary_assignee_name,
    caseData.tertiary_assignee_name,
  ].filter(Boolean)

  return (
    <div className="w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 text-sm">
      {/* Kundnamn + ärendenummer + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-white leading-tight">
            {isContract && <span className="text-purple-400 mr-1">★</span>}
            {caseData.company_name || caseData.bestallare || caseData.kontaktperson || caseData.title}
          </p>
          {caseData.case_number && (
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{caseData.case_number}</p>
          )}
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${style.bg} ${style.text}`}>
          {caseData.status?.split(' - ')[0] || 'Okänd'}
        </span>
      </div>

      {/* Detaljer */}
      <div className="space-y-1.5 text-xs text-slate-300">
        {(startTime || endTime) && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{startTime}{endTime ? ` – ${endTime}` : ''}</span>
          </div>
        )}
        {address && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
            <span className="break-words">{address}</span>
          </div>
        )}
        {((caseData as any).service?.name || caseData.skadedjur) && (
          <div className="flex items-center gap-1.5">
            <Bug className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{(caseData as any).service?.name || caseData.skadedjur}</span>
          </div>
        )}
        {technicians.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{technicians.join(', ')}</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-700">
        Klicka för att redigera
      </p>
    </div>
  )
}
