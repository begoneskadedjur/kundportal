// src/components/admin/customers/ContractTimeline.tsx
// Avtalshistorik: tidslinje över hur kundens avtal förändrats -
// start, avtalstillägg (produkt + direktdebitering + premieändring),
// fakturerade årspremieperioder, uppsägning och avtalsslut.
//
// Datakällor: customers (avtalsdatum, premie, uppsägning),
// contract_additions (tilläggslogg) och invoices (invoice_type='contract').

import { useEffect, useMemo, useState } from 'react'
import {
  Rocket,
  Repeat,
  Receipt,
  XCircle,
  CalendarClock,
  RefreshCw,
  History,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/customerMetrics'

interface TimelineEvent {
  date: string            // YYYY-MM-DD för sortering
  isFuture: boolean
  type: 'start' | 'addition' | 'invoice' | 'terminated' | 'end'
  title: string
  subtitle?: string
  chips?: { label: string; cls: string }[]
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: 'Betald',
  sent: 'Skickad',
  booked: 'Bokförd',
  ready: 'Redo',
  pending_approval: 'Godkännas',
  draft: 'Utkast',
}

const INVOICE_STATUS_CLS: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400',
  sent: 'bg-purple-500/15 text-purple-400',
  booked: 'bg-blue-500/15 text-blue-400',
  ready: 'bg-emerald-500/15 text-emerald-400',
  pending_approval: 'bg-amber-500/15 text-amber-400',
  draft: 'bg-slate-500/15 text-slate-400',
}

const TYPE_STYLE: Record<TimelineEvent['type'], { icon: React.ElementType; dot: string; iconColor: string }> = {
  start: { icon: Rocket, dot: 'bg-[#20c58f]/15 border-[#20c58f]/50', iconColor: 'text-[#20c58f]' },
  addition: { icon: Repeat, dot: 'bg-amber-500/15 border-amber-500/50', iconColor: 'text-amber-400' },
  invoice: { icon: Receipt, dot: 'bg-slate-700/60 border-slate-600', iconColor: 'text-slate-400' },
  terminated: { icon: XCircle, dot: 'bg-red-500/15 border-red-500/50', iconColor: 'text-red-400' },
  end: { icon: CalendarClock, dot: 'bg-cyan-500/15 border-cyan-500/50', iconColor: 'text-cyan-400' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtPeriod(start: string, end: string | null): string {
  const s = new Date(start).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
  if (!end) return s
  const e = new Date(end).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
  return s === e ? s : `${s} - ${e}`
}

export default function ContractTimeline({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(false)
      try {
        const [customerRes, additionsRes, invoicesRes] = await Promise.all([
          supabase
            .from('customers')
            .select('contract_start_date, contract_end_date, annual_value, terminated_at, notice_period_months')
            .eq('id', customerId)
            .single(),
          supabase
            .from('contract_additions')
            .select('description, annual_amount, prorated_amount, effective_from, previous_annual_value, new_annual_value, created_by_name, applied_at')
            .eq('customer_id', customerId)
            .order('applied_at', { ascending: true }),
          supabase
            .from('invoices')
            .select('billing_period_start, billing_period_end, amount, status')
            .eq('customer_id', customerId)
            .eq('invoice_type', 'contract')
            .order('billing_period_start', { ascending: true }),
        ])
        if (cancelled) return
        const customer = customerRes.data
        if (customerRes.error || !customer || !customer.contract_start_date) {
          setEvents([])
          setLoading(false)
          return
        }

        const additions = additionsRes.data || []
        const invoices = invoicesRes.data || []
        const todayIso = new Date().toISOString().slice(0, 10)
        const list: TimelineEvent[] = []

        // Start: ursprunglig premie = premien före första tillägget,
        // annars dagens (bästa tillgängliga rekonstruktion)
        const startPremium = additions.length > 0
          ? Number(additions[0].previous_annual_value)
          : Number(customer.annual_value ?? 0)
        list.push({
          date: customer.contract_start_date,
          isFuture: customer.contract_start_date > todayIso,
          type: 'start',
          title: 'Avtalet startade',
          chips: startPremium > 0
            ? [{ label: `Årspremie ${formatCurrency(startPremium)}/år`, cls: 'bg-[#20c58f]/15 text-[#20c58f]' }]
            : undefined,
        })

        // Fakturerade premieperioder
        for (const inv of invoices) {
          if (!inv.billing_period_start) continue
          list.push({
            date: inv.billing_period_start,
            isFuture: inv.billing_period_start > todayIso,
            type: 'invoice',
            title: `Årspremie ${fmtPeriod(inv.billing_period_start, inv.billing_period_end)}`,
            chips: [
              { label: formatCurrency(Number(inv.amount ?? 0)), cls: 'bg-slate-700/60 text-slate-300' },
              {
                label: INVOICE_STATUS_LABEL[inv.status] || inv.status,
                cls: INVOICE_STATUS_CLS[inv.status] || 'bg-slate-700/60 text-slate-300',
              },
            ],
          })
        }

        // Avtalstillägg
        for (const add of additions) {
          const appliedDate = String(add.applied_at).slice(0, 10)
          list.push({
            date: appliedDate,
            isFuture: false,
            type: 'addition',
            title: add.description.replace(/^Avtalstillägg:\s*/i, 'Tillägg: '),
            subtitle: add.created_by_name ? `Av ${add.created_by_name}` : undefined,
            chips: [
              { label: `Direktdebitering ${formatCurrency(Number(add.prorated_amount))}`, cls: 'bg-amber-500/15 text-amber-400' },
              {
                label: `Årspremie ${formatCurrency(Number(add.previous_annual_value))} → ${formatCurrency(Number(add.new_annual_value))}/år från ${fmtDate(add.effective_from)}`,
                cls: 'bg-[#20c58f]/15 text-[#20c58f]',
              },
            ],
          })
        }

        // Uppsägning + avtalsslut
        if (customer.terminated_at) {
          const termIso = String(customer.terminated_at).slice(0, 10)
          const notice = customer.notice_period_months ?? 2
          const termDate = new Date(customer.terminated_at)
          const contractEnd = customer.contract_end_date ? new Date(customer.contract_end_date) : null
          let cutoff: Date
          if (contractEnd && termDate <= contractEnd) {
            cutoff = contractEnd
          } else {
            cutoff = new Date(termDate)
            cutoff.setMonth(cutoff.getMonth() + notice)
          }
          const cutoffIso = cutoff.toISOString().slice(0, 10)
          list.push({
            date: termIso,
            isFuture: false,
            type: 'terminated',
            title: 'Avtalet uppsagt',
            subtitle: `Upphör ${fmtDate(cutoffIso)}`,
          })
          list.push({
            date: cutoffIso,
            isFuture: cutoffIso > todayIso,
            type: 'end',
            title: cutoffIso > todayIso ? 'Avtalet upphör' : 'Avtalet upphörde',
          })
        } else if (customer.contract_end_date) {
          const endIso = customer.contract_end_date
          if (endIso <= todayIso) {
            list.push({
              date: endIso,
              isFuture: false,
              type: 'end',
              title: 'Avtalstiden passerad - löper vidare',
              subtitle: 'Ingen uppsägning har registrerats, avtalet fortsätter tills vidare',
            })
          } else {
            list.push({
              date: endIso,
              isFuture: true,
              type: 'end',
              title: 'Avtalstiden löper ut',
              subtitle: 'Om ingen uppsägning sker fortsätter avtalet',
            })
          }
        }

        list.sort((a, b) => a.date.localeCompare(b.date))
        setEvents(list)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [customerId])

  const { pastEvents, futureEvents } = useMemo(() => ({
    pastEvents: events.filter(e => !e.isFuture),
    futureEvents: events.filter(e => e.isFuture),
  }), [events])

  if (loading) {
    return <div className="h-32 bg-slate-800/30 border border-slate-700/50 rounded-xl animate-pulse" />
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-sm text-slate-400">
        <RefreshCw className="w-4 h-4" />
        Avtalshistoriken kunde inte laddas.
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-sm text-slate-400">
        <History className="w-4 h-4" />
        Inga avtalsdatum registrerade - historiken visas när avtalet har start- och slutdatum.
      </div>
    )
  }

  const renderEvent = (event: TimelineEvent, index: number, total: number, dashed: boolean) => {
    const style = TYPE_STYLE[event.type]
    const Icon = style.icon
    const isInvoice = event.type === 'invoice'
    return (
      <div key={`${event.date}-${event.type}-${index}`} className={`relative flex gap-3 ${isInvoice ? 'pb-2.5' : 'pb-4'} last:pb-0 ${dashed ? 'opacity-80' : ''}`}>
        <div className="flex flex-col items-center flex-shrink-0">
          <span className={`${isInvoice ? 'w-6 h-6' : 'w-8 h-8'} rounded-full border flex items-center justify-center ${style.dot} ${dashed ? 'border-dashed' : ''}`}>
            <Icon className={`${isInvoice ? 'w-3 h-3' : 'w-4 h-4'} ${style.iconColor}`} />
          </span>
          {index < total - 1 && <span className={`w-px flex-1 mt-1 ${dashed ? 'border-l border-dashed border-slate-700' : 'bg-slate-700'}`} />}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className={`${isInvoice ? 'text-xs text-slate-300' : 'text-sm font-medium text-white'}`}>{event.title}</p>
            <span className="text-[11px] text-slate-500">{fmtDate(event.date)}</span>
          </div>
          {event.subtitle && <p className="text-xs text-slate-400 mt-0.5">{event.subtitle}</p>}
          {event.chips && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {event.chips.map((chip, i) => (
                <span key={i} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${chip.cls}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div>
        {pastEvents.map((event, i) => renderEvent(event, i, pastEvents.length + futureEvents.length, false))}
        {futureEvents.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-1.5 pl-11">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Kommande</span>
              <span className="flex-1 border-t border-dashed border-slate-700" />
            </div>
            {futureEvents.map((event, i) => renderEvent(event, i, futureEvents.length, true))}
          </>
        )}
      </div>
    </div>
  )
}
