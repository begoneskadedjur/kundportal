// src/components/admin/invoicing/queue/ContractSchedule.tsx
// Fliken Avtalskunder i läget Att hantera (3.121.0): ej skickade avtalsfakturor
// som ett faktureringsschema. Grupper efter läge (perioden har börjat,
// försenade, skicka denna vecka, kommande, väntar på beslut), kryssrutor för
// att godkänna flera och sidopanel med kalender, regler och det som skickats.
// Datumlogiken bor i src/shared/invoiceSchedule.ts. Klick på en rad öppnar
// den befintliga fakturamodalen.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { fetchAllRows } from '../../../../lib/fetchAllRows'
import { useAuth } from '../../../../contexts/AuthContext'
import { PaymentTermsService } from '../../../../services/paymentTermsService'
import { ContractReviewService, type InvoiceReviewInfo } from '../../../../services/contractReviewService'
import type { Invoice } from '../../../../types/invoice'
import { Icon } from '../../../icons/Icon'
import InvoiceDetailModal from '../InvoiceDetailModal'
import { ContractReviewMark } from '../ContractReviewMark'
import {
  FREQUENCY_LABEL,
  addDaysIso,
  dueNoteText,
  frequencyFromPeriod,
  invoiceSchedule,
  scheduleStatusText,
  shortDay,
  swedishDay,
  type InvoiceSchedule,
} from '../../../../shared/invoiceSchedule'
import {
  Checkbox,
  GroupHeader,
  KpiRow,
  RuleList,
  SelectionBar,
  SideCard,
  StatusText,
  type Kpi,
} from './QueueParts'
import { fakturor, fmtKr, fmtNum, groupCheckState, toggleGroup, toggleOne, type Tone } from './queueUtils'
import { MonthCalendar } from './MonthCalendar'
import { approveInvoices, exportReadyInvoices } from './queueActions'

type ContractInvoice = Invoice & {
  contract_id: string | null
  contract_invoice_kind: string | null
  is_consolidated: boolean | null
}

interface SentInvoice {
  id: string
  invoice_number: string | null
  customer_name: string
  subtotal: number
  fortnox_document_number: string | null
  sent_at: string | null
  booked_at: string | null
}

interface ContractMeta {
  billing_frequency: string | null
  premium_needs_review: boolean
}

type GroupKey = 'started' | 'late' | 'this_week' | 'upcoming' | 'waiting'

interface Row {
  inv: ContractInvoice
  s: InvoiceSchedule
  group: GroupKey
  frequency: string | null
  customerNumber: string | null
}

const GROUPS: { key: GroupKey; title: string; desc: string; tone: Tone }[] = [
  { key: 'started', title: 'Perioden har börjat', desc: 'Skulle ha skickats, kunden har redan fått tjänsten', tone: 'red' },
  { key: 'late', title: 'Försenade', desc: 'Skicka idag, perioden har inte börjat än', tone: 'orange' },
  { key: 'this_week', title: 'Skicka denna vecka', desc: 'Skickas på sitt datum', tone: 'green' },
  { key: 'upcoming', title: 'Kommande', desc: 'Skickas på sitt datum', tone: 'green' },
  { key: 'waiting', title: 'Väntar på beslut', desc: 'Premien bekräftas i avtalskartan innan fakturan kan godkännas', tone: 'grey' },
]

const STATUS_TONE: Record<InvoiceSchedule['status'], Tone> = {
  started: 'red',
  late: 'orange',
  this_week: 'green',
  upcoming: 'green',
}

/** Kommande visas så här långt fram innan man väljer Visa alla. */
const UPCOMING_HORIZON_DAYS = 60

type ReviewFilter = 'alla' | 'ok' | 'ej'
const REVIEW_FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'alla', label: 'Alla' },
  { id: 'ok', label: 'Kontrollerade' },
  { id: 'ej', label: 'Ej kontrollerade' },
]

const KIND_NOTE: Record<string, string> = {
  equipment_monthly: 'Tillägg per månad',
  equipment: 'Tillägg per år',
  equipment_gap: 'Tillägg från utsättning',
}

const MONTH_NAMES = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

const RULES = [
  { title: 'Årsvis, halvårsvis och kvartalsvis', text: 'Skickas 40 dagar före periodstart. Kunden betalar innan perioden börjar.' },
  { title: 'Månadsvis', text: 'Skickas den 1:a i den månad fakturan gäller. Utkastet syns en vecka innan.' },
  { title: 'Tillägg per månad', text: 'Skickas den 1:a, tillsammans med månadens premie.' },
]

const chunks = <T,>(list: T[], size = 100): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Dagen fakturan skickades till Fortnox, så nära som portalen vet. */
const sentDayOf = (s: SentInvoice): string | null => {
  const ts = s.booked_at ?? s.sent_at
  return ts ? swedishDay(ts) : null
}

export default function ContractSchedule({ onShowArchive }: { onShowArchive?: () => void }) {
  const { user, profile } = useAuth()
  const canApprove = !!profile?.can_approve_invoices
  const approverName = profile?.display_name || profile?.technicians?.name || profile?.email || 'Okänd'

  const [unsent, setUnsent] = useState<ContractInvoice[]>([])
  const [sent, setSent] = useState<SentInvoice[]>([])
  const [meta, setMeta] = useState<Map<string, ContractMeta>>(new Map())
  const [customerNumbers, setCustomerNumbers] = useState<Map<string, string>>(new Map())
  const [reviews, setReviews] = useState<Map<string, InvoiceReviewInfo>>(new Map())
  const [termsDays, setTermsDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('alla')
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)

  const today = swedishDay(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sentFrom = addDaysIso(today, -75)
      const [unsentRows, sentRows, terms] = await Promise.all([
        fetchAllRows<ContractInvoice>((from, to) =>
          supabase
            .from('invoices')
            .select('*')
            .eq('invoice_type', 'contract')
            .in('status', ['pending_approval', 'ready'])
            .is('fortnox_document_number', null)
            .eq('is_historical', false)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: ContractInvoice[] | null; error: unknown }>
        ),
        fetchAllRows<SentInvoice>((from, to) =>
          supabase
            .from('invoices')
            .select('id, invoice_number, customer_name, subtotal, fortnox_document_number, sent_at, booked_at')
            .eq('invoice_type', 'contract')
            .not('fortnox_document_number', 'is', null)
            .or(`booked_at.gte.${sentFrom},sent_at.gte.${sentFrom}`)
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: SentInvoice[] | null; error: unknown }>
        ),
        PaymentTermsService.getDays('contract'),
      ])
      setUnsent(unsentRows)
      setSent(sentRows)
      setTermsDays(terms)
      setSelected(new Set())

      // Avtalens frekvens och premiespärren
      const contractIds = [...new Set(unsentRows.map((i) => i.contract_id).filter((x): x is string => !!x))]
      const metaMap = new Map<string, ContractMeta>()
      for (const part of chunks(contractIds)) {
        let res = await supabase.from('contracts').select('id, billing_frequency, premium_needs_review').in('id', part)
        if (res.error) res = await supabase.from('contracts').select('id, billing_frequency').in('id', part) as typeof res
        for (const c of (res.data ?? []) as Array<{ id: string; billing_frequency: string | null; premium_needs_review?: boolean | null }>) {
          metaMap.set(c.id, { billing_frequency: c.billing_frequency, premium_needs_review: !!c.premium_needs_review })
        }
      }
      setMeta(metaMap)

      // Kundnummer
      const customerIds = [...new Set(unsentRows.map((i) => i.customer_id).filter((x): x is string => !!x))]
      const numMap = new Map<string, string>()
      for (const part of chunks(customerIds)) {
        const { data } = await supabase.from('customers').select('id, customer_number').in('id', part)
        for (const c of (data ?? []) as Array<{ id: string; customer_number: number | string | null }>) {
          if (c.customer_number != null) numMap.set(c.id, String(c.customer_number))
        }
      }
      setCustomerNumbers(numMap)

      ContractReviewService.getInvoiceReviewStates(unsentRows)
        .then(setReviews)
        .catch((err) => console.warn('[Fakturering] Avtalskontrollen kunde inte läsas:', err))
    } catch (error) {
      console.error('Fel vid laddning av faktureringsschemat:', error)
      toast.error('Kunde inte ladda fakturorna')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { load() }, [load])

  const rows: Row[] = useMemo(() => {
    return unsent.map((inv) => {
      const s = invoiceSchedule(inv, today, termsDays)
      const m = inv.contract_id ? meta.get(inv.contract_id) : undefined
      const frequency =
        inv.contract_invoice_kind === 'equipment_monthly'
          ? 'monthly'
          : inv.contract_invoice_kind === 'equipment_gap'
            ? null
            : m?.billing_frequency ?? frequencyFromPeriod(inv.billing_period_start, inv.billing_period_end)
      const group: GroupKey = m?.premium_needs_review ? 'waiting' : s.status
      return { inv, s, group, frequency, customerNumber: inv.customer_id ? customerNumbers.get(inv.customer_id) ?? null : null }
    })
  }, [unsent, meta, customerNumbers, today, termsDays])

  const isReviewedOk = useCallback((id: string) => reviews.get(id)?.state === 'ok', [reviews])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (reviewFilter === 'ok' && !isReviewedOk(r.inv.id)) return false
      if (reviewFilter === 'ej' && isReviewedOk(r.inv.id)) return false
      if (!q) return true
      return (
        r.inv.customer_name.toLowerCase().includes(q) ||
        (r.inv.invoice_number ?? '').toLowerCase().includes(q) ||
        (r.customerNumber ?? '').includes(q)
      )
    })
  }, [rows, search, reviewFilter, isReviewedOk])

  // Markeringar som inte längre syns släpps
  useEffect(() => {
    const visible = new Set(visibleRows.map((r) => r.inv.id))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleRows])

  const horizon = addDaysIso(today, UPCOMING_HORIZON_DAYS)
  const grouped = GROUPS.map((g) => {
    const all = visibleRows
      .filter((r) => r.group === g.key)
      .sort((a, b) => a.s.sendDate.localeCompare(b.s.sendDate) || a.inv.customer_name.localeCompare(b.inv.customer_name, 'sv'))
    const shown = g.key === 'upcoming' && !showAllUpcoming && !search ? all.filter((r) => r.s.sendDate <= horizon) : all
    return { ...g, all, shown }
  }).filter((g) => g.all.length > 0)

  const sum = (list: Row[]) => list.reduce((s, r) => s + Number(r.inv.subtotal || 0), 0)
  const byGroup = (k: GroupKey) => rows.filter((r) => r.group === k)
  const in30 = addDaysIso(today, 30)
  const upcoming30 = rows.filter((r) => (r.group === 'this_week' || r.group === 'upcoming') && r.s.sendDate <= in30)
  const monthKey = today.slice(0, 7)
  const sentThisMonth = sent.filter((s) => sentDayOf(s)?.slice(0, 7) === monthKey)
  const waiting = byGroup('waiting')

  const kpis: Kpi[] = [
    { key: 'started', label: 'Perioden har börjat', tone: 'red', count: byGroup('started').length, sum: fmtKr(sum(byGroup('started'))), hint: 'Skicka först' },
    { key: 'late', label: 'Försenade', tone: 'orange', count: byGroup('late').length, sum: fmtKr(sum(byGroup('late'))), hint: 'Skulle ha skickats, perioden har inte börjat' },
    { key: 'next30', label: 'Kommande 30 dagar', tone: 'green', count: upcoming30.length, sum: fmtKr(sum(upcoming30)), hint: 'Skickas på sitt datum' },
    ...(waiting.length > 0
      ? [{ key: 'waiting', label: 'Väntar på beslut', tone: 'grey' as Tone, count: waiting.length, sum: fmtKr(sum(waiting)), hint: 'Premien bekräftas i avtalskartan' }]
      : []),
    {
      key: 'sent',
      label: `Skickat i ${MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1]}`,
      tone: 'blue',
      count: sentThisMonth.length,
      sum: fmtKr(sentThisMonth.reduce((s, i) => s + Number(i.subtotal || 0), 0)),
      hint: 'Skapade i Fortnox, exkl. moms',
    },
  ]

  // Kalendern: skickdatum för ej skickade och skickade fakturor
  const marks = useMemo(() => {
    const map = new Map<string, Tone[]>()
    const add = (day: string, t: Tone) => {
      const list = map.get(day) ?? []
      if (!list.includes(t)) list.push(t)
      map.set(day, list)
    }
    for (const r of rows) add(r.s.sendDate, r.s.status === 'started' || r.s.status === 'late' ? 'red' : 'green')
    for (const s of sent) {
      const d = sentDayOf(s)
      if (d) add(d, 'blue')
    }
    for (const [k, v] of map) map.set(k, (['red', 'green', 'blue'] as Tone[]).filter((t) => v.includes(t)))
    return map
  }, [rows, sent])

  const weekAgo = addDaysIso(today, -7)
  const sentLastWeek = sent
    .map((s) => ({ s, day: sentDayOf(s) }))
    .filter((x): x is { s: SentInvoice; day: string } => !!x.day && x.day >= weekAgo)
    .sort((a, b) => b.day.localeCompare(a.day))

  // Knappraden
  const selectedRows = rows.filter((r) => selected.has(r.inv.id))
  const approveList = selectedRows.filter((r) => r.inv.status === 'pending_approval').map((r) => r.inv)
  const sendList = (selectedRows.length > 0 ? selectedRows : rows).filter((r) => r.inv.status === 'ready').map((r) => r.inv)

  const handleApprove = async () => {
    if (!user || !canApprove) return
    setBusy(true)
    try {
      await approveInvoices(approveList, user.id, approverName)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const handleSend = async () => {
    setBusy(true)
    try {
      await exportReadyInvoices(sendList.map((i) => i.id))
    } finally {
      setBusy(false)
    }
  }

  const GRID = 'grid grid-cols-[120px_minmax(200px,1.6fr)_118px_150px_100px_120px_16px] gap-3 items-center'

  const renderRow = (r: Row) => {
    const { inv, s } = r
    const on = selected.has(inv.id)
    const kindNote = inv.contract_invoice_kind ? KIND_NOTE[inv.contract_invoice_kind] : undefined
    const note = [
      inv.is_consolidated ? 'Samlingsfaktura' : null,
      kindNote ?? null,
      r.group === 'waiting' ? 'Premien är inte bekräftad' : null,
    ].filter(Boolean).join(' · ')
    const dueAfter = s.paysAfterPeriodStart
    return (
      <div key={inv.id} className={`flex items-stretch border-b border-slate-800/70 ${on ? 'bg-[#20c58f]/5' : ''}`}>
        <Checkbox checked={on} onChange={() => setSelected((prev) => toggleOne(inv.id, prev))} label={`Markera ${inv.invoice_number ?? 'faktura'}`} />
        <button
          type="button"
          onClick={() => setOpenId(inv.id)}
          aria-label={`Öppna ${inv.invoice_number ?? 'faktura'}, ${inv.customer_name}`}
          className={`flex-1 min-w-0 ${GRID} py-2.5 pr-4 text-left hover:bg-slate-800/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]`}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-mono text-[13px] text-white">{s.sendDate}</span>
            <StatusText tone={r.group === 'waiting' ? 'grey' : STATUS_TONE[s.status]}>{scheduleStatusText(s)}</StatusText>
            {inv.status === 'ready' && <span className="text-[11px] text-slate-400">Godkänd</span>}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-white truncate">{inv.customer_name}</span>
            <span className="text-xs text-slate-500 truncate">
              {r.customerNumber && <>{r.customerNumber} · </>}
              <span className="font-mono">{inv.invoice_number ?? '-'}</span>
              {r.frequency && FREQUENCY_LABEL[r.frequency] && <> · {FREQUENCY_LABEL[r.frequency]}</>}
            </span>
            {note && <span className="text-[11px] text-slate-500 truncate">{note}</span>}
          </div>
          <div className="flex flex-col gap-0.5 font-mono text-xs">
            <span className="text-slate-200">{s.periodStart ?? '-'}</span>
            {inv.billing_period_end && <span className="text-slate-500">till {inv.billing_period_end.slice(0, 10)}</span>}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={`font-mono text-xs ${dueAfter ? 'text-red-400' : 'text-slate-200'}`}>{s.dueIfSentToday}</span>
            <span className={`text-[11px] ${dueAfter ? 'text-red-400' : 'text-slate-500'}`}>{dueNoteText(s)}</span>
          </div>
          <span className="text-right text-sm font-semibold text-white tabular-nums">{fmtNum(Number(inv.subtotal || 0))}</span>
          <span className="min-w-0 overflow-hidden">
            <ContractReviewMark review={reviews.get(inv.id)} />
          </span>
          <Icon name="allman.chevron" size={16} className="text-slate-500" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <KpiRow kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="min-w-0 space-y-3">
          {/* Verktygsrad */}
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Kontroll" className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
              {REVIEW_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={reviewFilter === f.id}
                  onClick={() => setReviewFilter(f.id)}
                  className={`px-3 min-h-[36px] text-xs border-r border-slate-700 last:border-r-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
                    reviewFilter === f.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="relative flex-1 min-w-[200px]">
              <span className="sr-only">Sök</span>
              <Icon name="allman.sok" size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök kund, fakturanummer eller kundnummer"
                className="w-full pl-8 pr-3 py-1.5 min-h-[36px] text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f]"
              />
            </label>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              aria-label="Uppdatera"
              title="Uppdatera"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Icon name="allman.aterstall" size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <SelectionBar
            count={selectedRows.length}
            sumText={`${fmtKr(sum(selectedRows))} exkl. moms`}
            onClear={() => setSelected(new Set())}
            canApprove={canApprove}
            approveCount={approveList.length}
            onApprove={handleApprove}
            busy={busy}
            sendCount={sendList.length}
            onSend={handleSend}
            sendTitle="Godkända fakturor exporteras till Fortnox. Utan markering tas alla godkända."
          />
          <p className="text-xs text-slate-500">
            Bocka i fakturor för att godkänna flera samtidigt. Klicka på en faktura för att öppna den, där makuleras den också.
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="flex items-center border-b border-slate-800">
                <span className="w-11 flex-none" />
                <div className={`flex-1 ${GRID} py-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500`}>
                  <span>Skicka</span>
                  <span>Kund och faktura</span>
                  <span>Perioden</span>
                  <span>Förfaller om skickad idag</span>
                  <span className="text-right">Belopp exkl.</span>
                  <span title="Tillfälligt, tills alla avtal är kontrollerade">Kontroll</span>
                  <span />
                </div>
              </div>
              {loading && unsent.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
                  <Icon name="allman.laddar" size={16} className="animate-spin" /> Laddar...
                </div>
              ) : grouped.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  {search || reviewFilter !== 'alla' ? 'Inga fakturor hittades' : 'Inga avtalsfakturor att skicka just nu'}
                </div>
              ) : (
                grouped.map((g) => {
                  const ids = g.shown.map((r) => r.inv.id)
                  const st = groupCheckState(ids, selected)
                  const hidden = g.all.length - g.shown.length
                  return (
                    <div key={g.key}>
                      <GroupHeader
                        tone={g.tone}
                        title={g.title}
                        desc={g.desc}
                        total={`${fakturor(g.all.length)} · ${fmtKr(sum(g.all))}`}
                        checked={st.checked}
                        indeterminate={st.indeterminate}
                        onToggle={() => setSelected((prev) => toggleGroup(ids, prev))}
                      />
                      {g.shown.map(renderRow)}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAllUpcoming(true)}
                          className="w-full min-h-[44px] text-xs text-slate-400 hover:text-white hover:bg-slate-800/40 border-b border-slate-800"
                        >
                          Visa alla kommande ({hidden} till, skickas efter {shortDay(horizon)})
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidopanel */}
        <div className="space-y-4">
          <SideCard title="Skickdatum">
            <MonthCalendar
              today={today}
              marks={marks}
              legend={[
                { tone: 'red', label: 'Försenat' },
                { tone: 'green', label: 'Ska skickas' },
                { tone: 'blue', label: 'Skickat' },
              ]}
            />
          </SideCard>
          <SideCard title="Så faktureras avtalen">
            <RuleList rules={RULES} footer={`Fakturadatum i Fortnox blir alltid den dag fakturan skickas. Förfallodag är ${termsDays} dagar senare.`} />
          </SideCard>
          <SideCard
            title="Skickat senaste veckan"
            action={onShowArchive && (
              <button type="button" onClick={onShowArchive} className="text-xs text-[#20c58f] hover:underline">Visa alla</button>
            )}
          >
            {sentLastWeek.length === 0 ? (
              <p className="text-xs text-slate-500">Inget skickat de senaste sju dagarna.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {sentLastWeek.map(({ s, day }) => (
                  <li key={s.id} className="py-1.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-slate-300">
                      {s.customer_name}
                      <span className="text-slate-500"> · Fortnox {s.fortnox_document_number} · {shortDay(day)}</span>
                    </span>
                    <span className="text-slate-200 tabular-nums whitespace-nowrap">{fmtKr(Number(s.subtotal || 0))}</span>
                  </li>
                ))}
              </ul>
            )}
          </SideCard>
        </div>
      </div>

      <InvoiceDetailModal
        isOpen={openId !== null}
        onClose={() => setOpenId(null)}
        invoiceId={openId}
        onStatusChange={load}
      />
    </div>
  )
}
