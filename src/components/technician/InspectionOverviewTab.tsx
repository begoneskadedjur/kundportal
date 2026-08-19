// src/components/technician/InspectionOverviewTab.tsx
// Kontroller-tabben: samlad överblick över kundernas inbokade stationskontroller.
// Visar vad som ska göras idag/veckan/månaden, varningsflagg för bokade
// kontroller som inte utförts i tid, samt vilken kund som står näst på tur.
// Ersätter INTE schemasidan — vyn skapar/flyttar aldrig bokningar.

import { useState, useEffect, useMemo } from 'react'
import { format, isToday, isSameWeek, isSameMonth, differenceInCalendarDays, addDays } from 'date-fns'
import { sv } from 'date-fns/locale'
import { AlertTriangle, CalendarClock, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  TechnicianEquipmentService,
  BookedInspection,
  frequencyLabel
} from '../../services/technicianEquipmentService'
import { CustomerStationSummary } from '../../services/equipmentService'

type Period = 'dag' | 'vecka' | 'manad'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'dag', label: 'Idag' },
  { value: 'vecka', label: 'Veckan' },
  { value: 'manad', label: 'Månaden' }
]

interface InspectionOverviewTabProps {
  technicianId: string
  customers: CustomerStationSummary[]
  onOpenSchedulePanel: (customerId: string, customerName: string) => void
}

function inspectionDisplayName(i: BookedInspection): string {
  return i.customer_name
}

// Rad för en inbokad kontroll: datum-bubbla, kund, frekvens/stationer, statuspill
function InspectionRow({
  inspection,
  onClick
}: {
  inspection: BookedInspection
  onClick: () => void
}) {
  const date = new Date(inspection.scheduled_at)
  const daysUntil = differenceInCalendarDays(date, new Date())
  const meta = [
    frequencyLabel(inspection.frequency),
    inspection.total_stations > 0 ? `${inspection.total_stations} stationer` : null
  ].filter(Boolean).join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-800/80 transition-colors text-left"
    >
      <div className="w-11 flex-shrink-0 text-center py-1 rounded-lg bg-slate-900/60 border border-slate-700/50">
        <span className="block text-base font-semibold text-white leading-tight">
          {format(date, 'd', { locale: sv })}
        </span>
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
          {format(date, 'MMM', { locale: sv })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="block font-medium text-white leading-snug break-words line-clamp-2">
          {inspectionDisplayName(inspection)}
        </span>
        {meta && <span className="block text-xs text-slate-500">{meta}</span>}
      </div>
      {inspection.isOverdue ? (
        <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
          Passerad
        </span>
      ) : isToday(date) ? (
        <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#20c58f]/15 text-[#20c58f]">
          Idag {format(date, 'HH:mm')}
        </span>
      ) : (
        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
          {daysUntil <= 14 ? `om ${daysUntil} ${daysUntil === 1 ? 'dag' : 'dagar'}` : format(date, 'd MMM', { locale: sv })}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
    </button>
  )
}

export function InspectionOverviewTab({
  technicianId,
  customers,
  onOpenSchedulePanel
}: InspectionOverviewTabProps) {
  const [period, setPeriod] = useState<Period>('dag')
  const [loading, setLoading] = useState(true)
  const [inspections, setInspections] = useState<BookedInspection[]>([])
  const [completedThisMonth, setCompletedThisMonth] = useState(0)
  const [customersWithSchedule, setCustomersWithSchedule] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!technicianId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        // Horisont 60 dagar framåt så "näst på tur" alltid har data,
        // även om nästa bokning ligger i nästa månad
        const overview = await TechnicianEquipmentService.getInspectionOverview(
          technicianId,
          addDays(new Date(), 60)
        )
        if (cancelled) return
        setInspections(overview.open)
        setCompletedThisMonth(overview.completedThisMonth)
      } catch (error) {
        console.error('Fel vid hämtning av kontrollöversikt:', error)
        if (!cancelled) toast.error('Kunde inte hämta kontroller')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [technicianId])

  // Kunder med stationer som saknar aktivt kontrollschema
  useEffect(() => {
    let cancelled = false
    const ids = customers.map(c => c.customer_id)
    if (ids.length === 0) {
      setCustomersWithSchedule(new Set())
      return
    }
    TechnicianEquipmentService.getActiveScheduleCustomerIds(ids).then(set => {
      if (!cancelled) setCustomersWithSchedule(set)
    })
    return () => { cancelled = true }
  }, [customers])

  const now = new Date()
  const overdue = useMemo(() => inspections.filter(i => i.isOverdue), [inspections])
  const upcoming = useMemo(() => inspections.filter(i => !i.isOverdue), [inspections])

  const periodInspections = useMemo(() => {
    const today = new Date()
    return upcoming.filter(i => {
      const d = new Date(i.scheduled_at)
      if (period === 'dag') return isToday(d)
      if (period === 'vecka') return isSameWeek(d, today, { weekStartsOn: 1 })
      return isSameMonth(d, today)
    })
  }, [upcoming, period])

  // Näst på tur: första kommande bokningen efter dagens
  const nextUp = useMemo(
    () => upcoming.find(i => !isToday(new Date(i.scheduled_at))),
    [upcoming]
  )

  const missingSchedule = useMemo(() => {
    if (!customersWithSchedule) return []
    return customers.filter(c => !customersWithSchedule.has(c.customer_id))
  }, [customers, customersWithSchedule])

  const monthOpen = useMemo(
    () => upcoming.filter(i => isSameMonth(new Date(i.scheduled_at), new Date())).length,
    [upcoming]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  const openSchedule = (i: BookedInspection) => onOpenSchedulePanel(i.customer_id, i.customer_name)

  return (
    <div className="space-y-4">
      {/* Periodväxlare */}
      <div className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700/50 rounded-xl w-full sm:w-auto sm:inline-flex">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 sm:flex-none sm:px-5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              period === p.value
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Kräver åtgärd: bokade kontroller som inte utförts i tid */}
      {overdue.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Kräver åtgärd — {overdue.length === 1 ? 'bokad kontroll har inte utförts' : `${overdue.length} bokade kontroller har inte utförts`}
          </div>
          {overdue.map(i => (
            <button
              key={i.id}
              onClick={() => openSchedule(i)}
              className="w-full flex items-center gap-3 p-2.5 bg-slate-900/50 rounded-lg hover:bg-slate-900/80 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-white leading-snug break-words line-clamp-2">
                  {inspectionDisplayName(i)}
                </span>
                <span className="block text-xs text-slate-400">
                  Bokad {format(new Date(i.scheduled_at), 'd MMM HH:mm', { locale: sv })} · ej utförd
                </span>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400">
                Hantera
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Månadssummering */}
      {period === 'manad' && (
        <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-white">
              {format(now, 'MMMM', { locale: sv }).replace(/^./, c => c.toUpperCase())}
            </span>
            <span className="text-slate-400 text-xs">
              {completedThisMonth} utförda · {overdue.length} passerade · {monthOpen} kvar
            </span>
          </div>
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#20c58f] rounded-full transition-all"
              style={{
                width: `${completedThisMonth + monthOpen + overdue.length > 0
                  ? Math.round(100 * completedThisMonth / (completedThisMonth + monthOpen + overdue.length))
                  : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Periodens inbokade kontroller */}
      <div className="space-y-2">
        {periodInspections.length > 0 ? (
          periodInspections.map(i => (
            <InspectionRow key={i.id} inspection={i} onClick={() => openSchedule(i)} />
          ))
        ) : (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">
              {period === 'dag' && 'Inga kontroller inbokade idag'}
              {period === 'vecka' && 'Inga fler kontroller inbokade denna vecka'}
              {period === 'manad' && 'Inga fler kontroller inbokade denna månad'}
            </p>
          </div>
        )}
      </div>

      {/* Näst på tur */}
      {nextUp && (
        <button
          onClick={() => openSchedule(nextUp)}
          className="w-full p-3 bg-[#20c58f]/10 border border-[#20c58f]/40 rounded-xl text-left hover:bg-[#20c58f]/15 transition-colors"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#20c58f] mb-1">
            Näst på tur
          </span>
          <span className="block font-medium text-white leading-snug break-words line-clamp-2">
            {inspectionDisplayName(nextUp)}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">
            {format(new Date(nextUp.scheduled_at), 'EEEE d MMMM HH:mm', { locale: sv })}
            {nextUp.total_stations > 0 && ` · ${nextUp.total_stations} stationer`}
          </span>
        </button>
      )}

      {/* Kunder utan kontrollschema */}
      {missingSchedule.length > 0 && (
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400/90 mb-1">
            <CalendarClock className="w-4 h-4" />
            {missingSchedule.length === 1 ? '1 kund saknar kontrollschema' : `${missingSchedule.length} kunder saknar kontrollschema`}
          </div>
          <div className="space-y-1">
            {missingSchedule.map(c => (
              <button
                key={c.customer_id}
                onClick={() => onOpenSchedulePanel(c.customer_id, c.customer_name)}
                className="w-full text-left text-sm text-slate-300 hover:text-white py-1 px-1.5 rounded hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{c.customer_name}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">Sätt upp schema ›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionOverviewTab
