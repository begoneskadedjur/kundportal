// src/components/admin/invoicing/queue/InvoiceArchive.tsx
// Arkivet i flikarna Avtalskunder och Merförsäljning avtal (3.124.0):
// fakturor som skickats till Fortnox, betalda, krediterade och makulerade.
// Summering för vald period, filter, sök, export till CSV och tabell
// grupperad per månad. Läser med range() i block om 1 000 (fetchAllRows), så
// inget klipps. Klick på en rad öppnar den befintliga fakturamodalen.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { fetchAllRows } from '../../../../lib/fetchAllRows'
import { addDaysIso, daysBetween, swedishDay } from '../../../../shared/invoiceSchedule'
import { isRotRutAwaitingTaxAgency } from '../../../../shared/fortnoxInvoiceSync'
import { Icon } from '../../../icons/Icon'
import InvoiceDetailModal from '../InvoiceDetailModal'
import { KpiRow, StatusText, type Kpi } from './QueueParts'
import { fakturor, fmtKr, fmtNum, type Tone } from './queueUtils'

type ArchiveKind = 'contract' | 'adhoc'

interface ArchiveInvoice {
  id: string
  invoice_number: string | null
  fortnox_document_number: string | null
  customer_name: string
  case_id: string | null
  case_type: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  invoice_marking: string | null
  subtotal: number
  vat_amount: number
  total_amount: number
  due_date: string | null
  status: string
  paid_at: string | null
  sent_at: string | null
  booked_at: string | null
  created_at: string
  is_historical: boolean | null
  contract_invoice_kind?: string | null
  balance_due?: number | null
  rot_rut_fortnox_amount?: number | null
  rot_rut_claim_status?: string | null
}

type ArchiveState = 'paid' | 'overdue' | 'unpaid' | 'draft' | 'credited' | 'cancelled'

interface Row {
  inv: ArchiveInvoice
  date: string
  state: ArchiveState
  overdueDays: number
  caseNumber: string | null
}

type PeriodMode = 'month' | 'last30' | 'year' | 'custom'
type StatusFilter = 'alla' | 'obetalda' | 'forfallna' | 'betalda'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'alla', label: 'Alla' },
  { id: 'obetalda', label: 'Obetalda' },
  { id: 'forfallna', label: 'Förfallna' },
  { id: 'betalda', label: 'Betalda' },
]

const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']

const KIND_LABEL: Record<string, string> = {
  premium: 'Premie',
  equipment: 'Tillägg per år',
  equipment_monthly: 'Tillägg per månad',
  equipment_gap: 'Tillägg från utsättning',
}

const SELECT =
  'id, invoice_number, fortnox_document_number, customer_name, case_id, case_type, billing_period_start, billing_period_end, invoice_marking, subtotal, vat_amount, total_amount, due_date, status, paid_at, sent_at, booked_at, created_at, is_historical, balance_due, rot_rut_fortnox_amount, rot_rut_claim_status'

const chunks = <T,>(list: T[], size = 100): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Fakturadatum i arkivet: dagen den bokfördes eller skickades i Fortnox, annars portalens fakturadatum. */
function invoiceDay(inv: ArchiveInvoice): string {
  const ts = inv.fortnox_document_number && !inv.is_historical ? inv.booked_at ?? inv.sent_at ?? inv.created_at : inv.created_at
  return swedishDay(ts)
}

function stateOf(inv: ArchiveInvoice, today: string): { state: ArchiveState; overdueDays: number } {
  if (inv.status === 'cancelled') return { state: inv.fortnox_document_number ? 'credited' : 'cancelled', overdueDays: 0 }
  if (inv.status === 'paid') return { state: 'paid', overdueDays: 0 }
  if (inv.status === 'draft') return { state: 'draft', overdueDays: 0 }
  const due = inv.due_date?.slice(0, 10)
  // ROT/RUT där kunden betalat sin del: bara Skatteverkets del återstår
  if (isRotRutAwaitingTaxAgency(inv)) return { state: 'unpaid', overdueDays: 0 }
  if (inv.status === 'overdue' || (due && due < today)) {
    return { state: 'overdue', overdueDays: due ? Math.max(0, daysBetween(due, today)) : 0 }
  }
  return { state: 'unpaid', overdueDays: 0 }
}

const dagar = (n: number) => `${n} ${n === 1 ? 'dag' : 'dagar'}`

function statusView(r: Row): { tone: Tone; text: string; sub: string } {
  switch (r.state) {
    case 'paid':
      return { tone: 'green', text: 'Betald', sub: r.inv.paid_at ? swedishDay(r.inv.paid_at) : '' }
    case 'overdue':
      return { tone: 'red', text: `Förfallen ${dagar(r.overdueDays)}`, sub: 'Obetald' }
    case 'unpaid':
      return { tone: 'blue', text: 'Skickad', sub: 'Obetald' }
    case 'draft':
      return { tone: 'blue', text: 'Utkast i Fortnox', sub: 'Ej bokförd' }
    case 'credited':
      return { tone: 'grey', text: 'Krediterad', sub: '' }
    case 'cancelled':
      return { tone: 'grey', text: 'Makulerad', sub: 'Aldrig skickad' }
  }
}

/** Belopp med decimalkomma utan tusentalsavgränsare, för CSV. */
const csvNum = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')
const csvCell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export default function InvoiceArchive({ kind }: { kind: ArchiveKind }) {
  const [invoices, setInvoices] = useState<ArchiveInvoice[]>([])
  const [caseNumbers, setCaseNumbers] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const today = swedishDay(new Date())
  const [periodMode, setPeriodMode] = useState<PeriodMode>('last30')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [customFrom, setCustomFrom] = useState(addDaysIso(today, -90))
  const [customTo, setCustomTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alla')
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const select = kind === 'contract' ? `${SELECT}, contract_invoice_kind` : SELECT
      const rows = await fetchAllRows<ArchiveInvoice>((from, to) =>
        supabase
          .from('invoices')
          .select(select)
          .eq('invoice_type', kind)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: ArchiveInvoice[] | null; error: unknown }>
      )
      // Arkivet = allt som inte väntar på att skickas
      const archived = rows.filter(
        (i) => !(['pending_approval', 'ready'].includes(i.status) && !i.fortnox_document_number)
      )
      setInvoices(archived)

      if (kind === 'adhoc') {
        const byTable = new Map<string, Set<string>>()
        for (const i of archived) {
          if (!i.case_id) continue
          const t = i.case_type === 'private' ? 'private_cases' : i.case_type === 'business' ? 'business_cases' : 'cases'
          const set = byTable.get(t) ?? new Set<string>()
          set.add(i.case_id)
          byTable.set(t, set)
        }
        const map = new Map<string, string>()
        for (const [table, ids] of byTable) {
          for (const part of chunks([...ids])) {
            const { data } = await supabase.from(table as 'cases').select('id, case_number').in('id', part)
            for (const c of (data ?? []) as Array<{ id: string; case_number: string | null }>) {
              if (c.case_number) map.set(c.id, c.case_number)
            }
          }
        }
        setCaseNumbers(map)
      }
    } catch (error) {
      console.error('Fel vid laddning av arkivet:', error)
      toast.error('Kunde inte ladda arkivet')
    } finally {
      setLoading(false)
    }
  }, [kind])

  useEffect(() => { load() }, [load])

  const rows: Row[] = useMemo(
    () =>
      invoices.map((inv) => {
        const { state, overdueDays } = stateOf(inv, today)
        return { inv, date: invoiceDay(inv), state, overdueDays, caseNumber: inv.case_id ? caseNumbers.get(inv.case_id) ?? null : null }
      }),
    [invoices, caseNumbers, today]
  )

  const [from, to] = useMemo((): [string, string] => {
    switch (periodMode) {
      case 'month': {
        const [y, m] = month.split('-').map(Number)
        const last = new Date(y, m, 0).getDate()
        return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`]
      }
      case 'last30':
        return [addDaysIso(today, -30), today]
      case 'year':
        return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`]
      case 'custom':
        return customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom]
    }
  }, [periodMode, month, today, customFrom, customTo])

  const inPeriod = useMemo(() => rows.filter((r) => r.date >= from && r.date <= to), [rows, from, to])

  const matchesSearch = useCallback((r: Row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      r.inv.customer_name.toLowerCase().includes(q) ||
      (r.inv.invoice_number ?? '').toLowerCase().includes(q) ||
      (r.inv.fortnox_document_number ?? '').toLowerCase().includes(q) ||
      (r.caseNumber ?? '').toLowerCase().includes(q) ||
      (r.inv.invoice_marking ?? '').toLowerCase().includes(q)
    )
  }, [search])

  const searched = inPeriod.filter(matchesSearch)
  const cancelledCount = searched.filter((r) => r.state === 'cancelled').length
  const visible = searched.filter((r) => {
    if (r.state === 'cancelled' && !showCancelled) return false
    switch (statusFilter) {
      case 'obetalda':
        return r.state === 'unpaid' || r.state === 'overdue' || r.state === 'draft'
      case 'forfallna':
        return r.state === 'overdue'
      case 'betalda':
        return r.state === 'paid'
      default:
        return true
    }
  })

  // Summering för perioden (makulerade och krediterade räknas inte)
  const billed = searched.filter((r) => r.state !== 'cancelled' && r.state !== 'credited')
  const sumOf = (list: Row[]) => list.reduce((s, r) => s + Number(r.inv.total_amount || 0), 0)
  const paid = billed.filter((r) => r.state === 'paid')
  const open = billed.filter((r) => r.state === 'unpaid' || r.state === 'draft')
  const overdue = billed.filter((r) => r.state === 'overdue')
  const kpis: Kpi[] = [
    { key: 'billed', label: 'Fakturerat', tone: 'blue', count: billed.length, sum: fmtKr(sumOf(billed)), hint: 'Inkl. moms i perioden' },
    { key: 'paid', label: 'Betalt', tone: 'green', count: paid.length, sum: fmtKr(sumOf(paid)), hint: paid.length === 0 ? 'Inga betalda i perioden' : 'Betalda enligt Fortnox' },
    { key: 'open', label: 'Obetalt, ej förfallet', tone: 'grey', count: open.length, sum: fmtKr(sumOf(open)), hint: 'Inom betalningsvillkoret' },
    {
      key: 'overdue',
      label: 'Förfallet',
      tone: 'red',
      count: overdue.length,
      sum: fmtKr(sumOf(overdue)),
      hint: overdue.length === 0 ? 'Inget förfallet' : [...new Set(overdue.map((r) => r.inv.customer_name))].slice(0, 2).join(', '),
    },
  ]

  const months = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of visible) {
      const k = r.date.slice(0, 7)
      map.set(k, [...(map.get(k) ?? []), r])
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([k, list]) => [k, list.sort((a, b) => b.date.localeCompare(a.date) || (b.inv.invoice_number ?? '').localeCompare(a.inv.invoice_number ?? ''))] as const)
  }, [visible])

  const col4 = kind === 'contract' ? 'Period' : 'Er referens'

  const subText = (r: Row) => {
    if (kind === 'adhoc') return r.caseNumber ?? ''
    const k = r.inv.contract_invoice_kind ? KIND_LABEL[r.inv.contract_invoice_kind] : null
    return k ?? (r.inv.is_historical ? 'Importerad från Fortnox' : '')
  }
  const col4Text = (r: Row) =>
    kind === 'contract'
      ? r.inv.billing_period_start
        ? `${r.inv.billing_period_start.slice(0, 10)} till ${r.inv.billing_period_end?.slice(0, 10) ?? ''}`
        : ''
      : r.inv.invoice_marking ?? ''

  const handleExport = () => {
    if (visible.length === 0) {
      toast.error('Inga fakturor att exportera')
      return
    }
    const head = ['Fakturadatum', 'Fortnox-nr', 'Portalnr', 'Kund', kind === 'contract' ? 'Typ' : 'Ärende', col4, 'Belopp exkl. moms', 'Moms', 'Belopp inkl. moms', 'Förfaller', 'Status', 'Betald']
    const lines = [head.join(';')]
    for (const [, list] of months) {
      for (const r of list) {
        const st = statusView(r)
        lines.push(
          [
            r.date,
            r.inv.fortnox_document_number ?? '',
            r.inv.invoice_number ?? '',
            r.inv.customer_name,
            subText(r),
            col4Text(r),
            csvNum(Number(r.inv.subtotal || 0)),
            csvNum(Number(r.inv.vat_amount || 0)),
            csvNum(Number(r.inv.total_amount || 0)),
            r.inv.due_date?.slice(0, 10) ?? '',
            st.text,
            r.inv.paid_at ? swedishDay(r.inv.paid_at) : '',
          ].map((v) => csvCell(String(v))).join(';')
        )
      }
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fakturaarkiv-${kind === 'contract' ? 'avtal' : 'merforsaljning'}-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const GRID = 'grid grid-cols-[100px_120px_minmax(200px,1.6fr)_180px_110px_96px_150px] gap-3 items-center'
  const inputCls = 'px-3 py-1.5 min-h-[36px] text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#20c58f]'

  return (
    <div className="space-y-4">
      <KpiRow kpis={kpis} />

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Period
          <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as PeriodMode)} className={inputCls}>
            <option value="month">Månad</option>
            <option value="last30">Senaste 30 dagarna</option>
            <option value="year">I år</option>
            <option value="custom">Egen period</option>
          </select>
        </label>
        {periodMode === 'month' && (
          <input type="month" aria-label="Månad" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
        )}
        {periodMode === 'custom' && (
          <>
            <input type="date" aria-label="Från" value={customFrom} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} className={inputCls} />
            <span className="text-slate-500 text-sm">till</span>
            <input type="date" aria-label="Till" value={customTo} onChange={(e) => e.target.value && setCustomTo(e.target.value)} className={inputCls} />
          </>
        )}
        <div role="group" aria-label="Status" className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={statusFilter === f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 min-h-[36px] text-xs border-r border-slate-700 last:border-r-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
                statusFilter === f.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
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
            placeholder={kind === 'contract' ? 'Sök kund, fakturanummer eller Fortnox-nummer' : 'Sök kund, fakturanummer, Fortnox-nummer eller ärende'}
            className={`w-full pl-8 ${inputCls} placeholder-slate-500`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer min-h-[36px]">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={() => setShowCancelled((v) => !v)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
          />
          Visa makulerade ({cancelledCount})
        </label>
        <button
          type="button"
          onClick={handleExport}
          className="min-h-[36px] px-3 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center gap-2"
        >
          <Icon name="allman.ladda-ner" size={16} />
          Exportera
        </button>
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

      {/* Tabell */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
        <div className="min-w-[960px]">
          <div className={`${GRID} px-4 py-2 border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500`}>
            <span>Fakturadatum</span>
            <span>Fortnox / portal</span>
            <span>Kund</span>
            <span>{col4}</span>
            <span className="text-right">Belopp inkl.</span>
            <span>Förfaller</span>
            <span>Status</span>
          </div>
          {loading && invoices.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
              <Icon name="allman.laddar" size={16} className="animate-spin" /> Laddar...
            </div>
          ) : months.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Inga fakturor i perioden</div>
          ) : (
            months.map(([k, list]) => (
              <div key={k}>
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-800/40 border-b border-slate-800">
                  <span className="text-sm font-semibold text-white">{MONTHS[Number(k.slice(5, 7)) - 1]} {k.slice(0, 4)}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{fakturor(list.length)} · {fmtKr(sumOf(list))}</span>
                </div>
                {list.map((r) => {
                  const st = statusView(r)
                  const dim = r.state === 'cancelled' || r.state === 'credited'
                  return (
                    <button
                      key={r.inv.id}
                      type="button"
                      onClick={() => setOpenId(r.inv.id)}
                      aria-label={`Öppna ${r.inv.invoice_number ?? 'faktura'}`}
                      className={`w-full ${GRID} px-4 py-2.5 border-b border-slate-800/70 text-left hover:bg-slate-800/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${dim ? 'opacity-60' : ''}`}
                    >
                      <span className="font-mono text-[13px] text-white">{r.date}</span>
                      <span className="flex flex-col gap-0.5 font-mono text-xs min-w-0">
                        <span className="text-white truncate">{r.inv.fortnox_document_number ?? '-'}</span>
                        <span className="text-slate-500 truncate">{r.inv.invoice_number ?? ''}</span>
                      </span>
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium text-white truncate">{r.inv.customer_name}</span>
                        {subText(r) && <span className={`text-xs text-slate-500 truncate ${kind === 'adhoc' ? 'font-mono' : ''}`}>{subText(r)}</span>}
                      </span>
                      <span className="text-xs text-slate-300 font-mono truncate">{col4Text(r)}</span>
                      <span className="text-right text-sm font-semibold text-white tabular-nums">{fmtNum(Number(r.inv.total_amount || 0))}</span>
                      <span className={`font-mono text-xs ${r.state === 'overdue' ? 'text-red-400' : 'text-slate-300'}`}>{r.inv.due_date?.slice(0, 10) ?? '-'}</span>
                      <span className="flex flex-col gap-0.5">
                        <StatusText tone={st.tone}>{st.text}</StatusText>
                        {st.sub && <span className="text-[11px] text-slate-500">{st.sub}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Arkivet visar fakturor som skickats till Fortnox, betalda och krediterade. Betalning och kreditering hämtas från Fortnox. Makulerade utkast som aldrig skickades är dolda tills du bockar i Visa makulerade.
      </p>

      <InvoiceDetailModal isOpen={openId !== null} onClose={() => setOpenId(null)} invoiceId={openId} onStatusChange={load} />
    </div>
  )
}
