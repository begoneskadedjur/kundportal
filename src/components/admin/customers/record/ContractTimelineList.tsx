// src/components/admin/customers/record/ContractTimelineList.tsx
// Tidslinje v1 för kundsidan: vertikal lista med förflutna händelser (grön punkt),
// framtida händelser (ring + dämpad text) och en "IDAG"-avdelare emellan.
// Innehåller även byggarna som gör tidslinjehändelser av avtal, tillägg och fakturarader.

import { useMemo } from 'react'
import {
  contractDisplayName,
  formatDateSv,
  formatKr,
  formatMonthSv,
  isImportedContract,
  lastNoticeDate,
  type RecordAddition,
  type RecordBillingItem,
  type RecordContract,
} from '../../../../hooks/useCustomerRecord'

export interface RecordTimelineEvent {
  /** YYYY-MM-DD (eller full ISO) — används för sortering och datumkolumn */
  date: string
  kind: 'start' | 'signed' | 'addition' | 'index' | 'terminated' | 'notice' | 'end' | 'invoice'
  title: string
  detail?: string
  /** Taggning i den fulla strömmen: avtalets label eller kundradens namn */
  tag?: string
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

// ---------------------------------------------------------------------------
// Händelsebyggare (bara befintlig data — inga gissningar)
// ---------------------------------------------------------------------------

/** Avtalsbundna händelser: start, signering, uppsägning, sista uppsägningsdag, slut */
export function buildContractEvents(contract: RecordContract, tag?: string): RecordTimelineEvent[] {
  const events: RecordTimelineEvent[] = []
  const startDate = contract.contract_start_date ?? contract.start_date

  if (startDate) {
    events.push({ date: toDateKey(startDate), kind: 'start', title: 'Avtalsstart', tag })
  }

  if (contract.created_at && !isImportedContract(contract)) {
    events.push({
      date: toDateKey(contract.created_at),
      kind: 'signed',
      title: 'Avtalet signerat',
      detail: 'Via Oneflow',
      tag,
    })
  }

  if (contract.terminated_at) {
    events.push({
      date: toDateKey(contract.terminated_at),
      kind: 'terminated',
      title: 'Avtalet uppsagt',
      detail: contract.termination_reason ?? undefined,
      tag,
    })
  }

  const notice = lastNoticeDate(contract)
  if (notice && !contract.terminated_at) {
    events.push({
      date: notice.toISOString().slice(0, 10),
      kind: 'notice',
      title: 'Sista uppsägningsdag',
      detail: `${contract.notice_period_months} mån före avtalsslut`,
      tag,
    })
  }

  if (contract.contract_end_date) {
    events.push({
      date: toDateKey(contract.contract_end_date),
      kind: 'end',
      title: contract.terminated_at ? 'Avtalet löper ut' : 'Avtalet löper ut / förnyas',
      tag,
    })
  }

  return events
}

/** Avtalstillägg + indexjusteringar från contract_additions */
export function buildAdditionEvents(additions: RecordAddition[], tag?: string): RecordTimelineEvent[] {
  return additions
    .filter((a) => a.effective_from || a.applied_at)
    .map((a) => {
      const isIndex = a.kind === 'index_adjustment'
      const parts: string[] = []
      if (a.description) parts.push(a.description)
      if (a.previous_annual_value != null && a.new_annual_value != null) {
        parts.push(`${formatKr(Number(a.previous_annual_value))} → ${formatKr(Number(a.new_annual_value))}/år`)
      } else if (a.annual_amount != null) {
        parts.push(`+${formatKr(Number(a.annual_amount))}/år`)
      }
      return {
        date: toDateKey((a.effective_from ?? a.applied_at) as string),
        kind: (isIndex ? 'index' : 'addition') as RecordTimelineEvent['kind'],
        title: isIndex ? 'Indexjustering' : 'Avtalstillägg',
        detail: parts.join(' · ') || undefined,
        tag,
      }
    })
}

/** Fakturahändelser: aggregerar contract_billing_items per faktureringsperiod */
export function buildInvoiceEvents(items: RecordBillingItem[], tag?: string): RecordTimelineEvent[] {
  const byPeriod = new Map<string, RecordBillingItem[]>()
  for (const item of items) {
    if (item.status === 'cancelled') continue
    const key = toDateKey(item.billing_period_start)
    const list = byPeriod.get(key) ?? []
    list.push(item)
    byPeriod.set(key, list)
  }

  const statusLabel = (statuses: string[]): string => {
    if (statuses.some((s) => s === 'overdue')) return 'Förfallen'
    if (statuses.every((s) => s === 'paid')) return 'Betald'
    if (statuses.some((s) => ['sent', 'invoiced', 'booked'].includes(s))) return 'Skickad'
    return 'Väntar'
  }

  return Array.from(byPeriod.entries()).map(([date, rows]) => {
    const total = rows.reduce((sum, r) => sum + Number(r.total_price ?? 0), 0)
    return {
      date,
      kind: 'invoice' as const,
      title: `Faktura ${formatMonthSv(date)}`,
      detail: `${formatKr(total)} · ${statusLabel(rows.map((r) => r.status))}`,
      tag,
    }
  })
}

/** Komplett tidslinje för ETT avtal (tillägg + fakturor filtrerade på avtalets kundrad) */
export function buildSingleContractTimeline(
  contract: RecordContract,
  additions: RecordAddition[],
  billingItems: RecordBillingItem[]
): RecordTimelineEvent[] {
  return [
    ...buildContractEvents(contract),
    ...buildAdditionEvents(additions),
    ...buildInvoiceEvents(billingItems),
  ]
}

/** Full ström för Översikt: alla avtal taggade med sin label, fakturor per kundrad */
export function buildFamilyTimeline(
  contracts: RecordContract[],
  additionsByCustomer: Map<string, RecordAddition[]>,
  billingByCustomer: Map<string, RecordBillingItem[]>,
  customerNameById: Map<string, string>
): RecordTimelineEvent[] {
  const events: RecordTimelineEvent[] = []
  for (const contract of contracts) {
    events.push(...buildContractEvents(contract, contractDisplayName(contract)))
  }
  for (const [customerId, additions] of additionsByCustomer) {
    events.push(...buildAdditionEvents(additions, customerNameById.get(customerId)))
  }
  for (const [customerId, items] of billingByCustomer) {
    events.push(...buildInvoiceEvents(items, customerNameById.get(customerId)))
  }
  return events
}

/** Närmaste framtida händelse (för "Nästa"-raden i headern) */
export function nextUpcomingEvent(events: RecordTimelineEvent[]): RecordTimelineEvent | null {
  const todayKey = new Date().toISOString().slice(0, 10)
  const future = events
    .filter((e) => e.date > todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
  return future[0] ?? null
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

interface Props {
  events: RecordTimelineEvent[]
  /** Kompakt läge (i avtalskortets expander): tightare rader */
  compact?: boolean
  /** Max antal förflutna händelser som visas direkt (resten bakom "Visa alla") */
  emptyText?: string
}

function EventRow({ event, isFuture, compact }: { event: RecordTimelineEvent; isFuture: boolean; compact: boolean }) {
  return (
    <li className={`relative ${compact ? 'pl-5 pb-3' : 'pl-6 pb-4'} last:pb-0`}>
      {/* Punkt: fylld grön för förflutet, ring för framtid */}
      <span
        className={`absolute left-0 top-[5px] w-2.5 h-2.5 rounded-full ${
          isFuture ? 'border border-slate-500 bg-transparent' : 'bg-[#20c58f]'
        }`}
        aria-hidden
      />
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={`text-xs tabular-nums shrink-0 ${isFuture ? 'text-slate-600' : 'text-slate-500'}`}>
          {formatDateSv(event.date)}
        </span>
        <span className={`text-sm truncate ${isFuture ? 'text-slate-500' : 'text-slate-200'}`}>
          {event.title}
          {event.tag && <span className={isFuture ? 'text-slate-600' : 'text-slate-500'}> · {event.tag}</span>}
        </span>
      </div>
      {event.detail && (
        <div className={`text-xs mt-0.5 ${isFuture ? 'text-slate-600' : 'text-slate-400'}`}>{event.detail}</div>
      )}
    </li>
  )
}

export default function ContractTimelineList({ events, compact = false, emptyText }: Props) {
  const { past, future } = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
    return {
      past: sorted.filter((e) => e.date <= todayKey),
      future: sorted.filter((e) => e.date > todayKey),
    }
  }, [events])

  if (events.length === 0) {
    return <p className="text-sm text-slate-500 py-2">{emptyText ?? 'Inga händelser att visa.'}</p>
  }

  return (
    <ol className="relative">
      {/* Lodrät linje bakom punkterna */}
      <span className="absolute left-[4px] top-1 bottom-1 w-px bg-slate-800" aria-hidden />
      {past.map((event, i) => (
        <EventRow key={`p-${event.date}-${event.title}-${i}`} event={event} isFuture={false} compact={compact} />
      ))}
      {future.length > 0 && (
        <li className={`relative flex items-center gap-2 ${compact ? 'pl-5 pb-3' : 'pl-6 pb-4'}`}>
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-[#20c58f] rounded-full" aria-hidden />
          <span className="text-[10px] uppercase tracking-wide font-medium text-[#20c58f]">Idag</span>
          <span className="flex-1 border-t border-slate-800" aria-hidden />
        </li>
      )}
      {future.map((event, i) => (
        <EventRow key={`f-${event.date}-${event.title}-${i}`} event={event} isFuture compact={compact} />
      ))}
    </ol>
  )
}
