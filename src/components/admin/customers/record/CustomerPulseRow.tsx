// src/components/admin/customers/record/CustomerPulseRow.tsx
//
// Nyckeltalsraden överst på Översikt. Kundens hälsa på tre sekunder, utan att
// scrolla en lista.
//
// En yta med hårfina avdelare, inte fem separata kort — samma greppkänsla som
// Avtalskartans sammanfattningsrad. Alla tal i tabular-nums så kolumnerna står
// stilla vid omhämtning.

import { Briefcase, CalendarCheck, Receipt, Wallet } from 'lucide-react'
import {
  formatDateSv,
  formatKr,
  type RecordCase,
  type RecordContract,
  type RecordInspectionSession,
  type RecordInvoice,
} from '../../../../hooks/useCustomerRecord'
import { contractState } from '../../../../utils/contractLifecycle'
import { sessionLateness } from '../../../../utils/caseCategory'
import { ContractSeal } from './ContractGlyphs'

interface Props {
  contracts: RecordContract[]
  annualValue: number
  cases: RecordCase[]
  inspections: RecordInspectionSession[]
  invoices: RecordInvoice[]
}

type Tone = 'neutral' | 'warn' | 'bad' | 'good'

interface Stat {
  label: string
  value: string
  hint?: string | null
  tone: Tone
  icon: React.ReactNode
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'text-slate-100',
  good: 'text-[#20c58f]',
  warn: 'text-amber-400',
  bad: 'text-red-400',
}

export default function CustomerPulseRow({
  contracts,
  annualValue,
  cases,
  inspections,
  invoices,
}: Props) {
  const live = contracts.filter((c) => contractState(c) !== 'ended')
  const running = live.filter((c) => contractState(c) === 'terminated-running').length

  const today = new Date().toISOString()
  const nextVisit =
    inspections
      .filter((s) => s.status === 'scheduled' && (s.scheduled_at ?? '') >= today)
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))[0] ?? null
  const lateVisits = inspections.filter(
    (s) => sessionLateness(s.scheduled_at, s.status ?? '') !== 'ontime'
  ).length

  const liveInvoices = invoices.filter((i) => (i.status ?? '') !== 'cancelled')
  const latestInvoice =
    [...liveInvoices].sort((a, b) =>
      (b.billing_period_start ?? '').localeCompare(a.billing_period_start ?? '')
    )[0] ?? null
  const todayKey = today.slice(0, 10)
  // Bara SKICKADE fakturor kan förfalla — en faktura som väntar på godkännande
  // har aldrig nått kunden, hur gammalt förfallodatumet än är.
  const overdue = liveInvoices.filter(
    (i) =>
      i.due_date &&
      i.due_date < todayKey &&
      ['sent', 'invoiced', 'booked'].includes((i.status ?? '').toLowerCase())
  ).length

  const openCases = cases.filter(
    (c) => !c.completed_date && !['Avslutat', 'Stängt', 'Borttaget'].includes(c.status)
  ).length

  const stats: Stat[] = [
    {
      label: 'Årsvärde',
      value: annualValue > 0 ? formatKr(annualValue) : live.length > 0 ? 'Avrop' : '–',
      // Ett avropsavtal SAKNAR årspremie — allt prissätts per ärende. Noll
      // kronor betyder därför inte "inget avtal", vilket det tidigare påstod.
      hint:
        annualValue > 0
          ? 'ex moms'
          : live.length > 0
            ? 'fasta priser per ärende'
            : 'inget aktivt avtal',
      tone: 'neutral',
      icon: <Wallet className="w-3 h-3" />,
    },
    {
      label: 'Aktiva avtal',
      value: String(live.length),
      hint: running > 0 ? `${running} löper ut` : null,
      tone: running > 0 ? 'warn' : 'neutral',
      icon: <ContractSeal size={14} state="active" />,
    },
    {
      label: 'Nästa besök',
      value: nextVisit ? formatDateSv(nextVisit.scheduled_at) : '–',
      hint: nextVisit?.technician_name ?? (lateVisits > 0 ? `${lateVisits} försenade` : 'inget bokat'),
      tone: lateVisits > 0 ? 'warn' : nextVisit ? 'neutral' : 'warn',
      icon: <CalendarCheck className="w-3 h-3" />,
    },
    {
      label: 'Senaste faktura',
      value: latestInvoice ? formatKr(Number(latestInvoice.subtotal ?? 0)) : '–',
      hint: overdue > 0 ? `${overdue} förfallna` : latestInvoice?.billing_period_start ? formatDateSv(latestInvoice.billing_period_start) : null,
      tone: overdue > 0 ? 'bad' : 'neutral',
      icon: <Receipt className="w-3 h-3" />,
    },
    {
      label: 'Öppna ärenden',
      value: String(openCases),
      hint: openCases === 0 ? 'inget pågående' : null,
      tone: 'neutral',
      icon: <Briefcase className="w-3 h-3" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 rounded-2xl border border-slate-800 bg-slate-900/60 divide-x divide-y lg:divide-y-0 divide-slate-800 overflow-hidden">
      {stats.map((s) => (
        <div key={s.label} className="px-4 py-3.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
            {s.icon}
            <span className="truncate">{s.label}</span>
          </div>
          <div className={`text-[19px] font-semibold tabular-nums leading-none ${TONE_CLASS[s.tone]}`}>
            {s.value}
          </div>
          {s.hint && <div className="text-[11px] text-slate-500 mt-1 truncate">{s.hint}</div>}
        </div>
      ))}
    </div>
  )
}
