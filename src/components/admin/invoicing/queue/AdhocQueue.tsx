// src/components/admin/invoicing/queue/AdhocQueue.tsx
// Fliken Merförsäljning avtal i läget Att hantera (3.123.0): utfört arbete
// som saknar faktura, fakturor som kräver godkännande och godkända fakturor
// som är redo för Fortnox. En faktura per ärende; märkning, arbetsorder och
// objekt hämtas från ärendet (src/shared/caseMarking.ts). Klick på en rad
// öppnar den befintliga fakturamodalen.
//
// Gruppen Utfört arbete utan faktura ersätter UnbilledAdhocBanner: samma
// urval (ad hoc-rader från ett ärende utan faktura, status pending eller
// approved, inte 0 kr) och samma Skapa faktura
// (ContractInvoiceGenerator.generateAdhocInvoiceForCase).

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { fetchAllRows } from '../../../../lib/fetchAllRows'
import { useAuth } from '../../../../contexts/AuthContext'
import type { Invoice } from '../../../../types/invoice'
import { caseMarkingOnInvoice } from '../../../../shared/caseMarking'
import { daysBetween, shortDay, swedishDay } from '../../../../shared/invoiceSchedule'
import { Icon } from '../../../icons/Icon'
import InvoiceDetailModal from '../InvoiceDetailModal'
import { Checkbox, GroupHeader, KpiRow, RuleList, SelectionBar, SideCard, StatusText, type Kpi } from './QueueParts'
import { fakturor, fmtKr, fmtNum, groupCheckState, toggleGroup, toggleOne, type Tone } from './queueUtils'
import { approveInvoices, exportReadyInvoices } from './queueActions'

interface CaseInfo {
  case_number: string | null
  title: string | null
  service_type: string | null
  completed_date: string | null
  invoice_marking: string | null
  work_order_number: string | null
  work_object: string | null
  room_number: string | null
  technicians: string[]
}

interface VisitInfo {
  visit_date: string | null
  technician_name: string | null
  technicians: Array<{ name: string }> | null
}

interface OrphanGroup {
  key: string
  caseId: string
  customerId: string
  customerName: string
  grouping: 'per_case' | 'monthly_batch'
  totalExcl: number
  totalIncl: number
  count: number
  invoiceDate: string | null
  hasPending: boolean
}

interface SentAdhoc {
  id: string
  subtotal: number
  total_amount: number
  booked_at: string | null
  sent_at: string | null
}

/** Utfört för mer än så många dagar sedan blir orange. */
const LATE_AFTER_DAYS = 7

const MONTH_NAMES = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

const RULES = [
  { title: 'När jobbet är utfört', text: 'Fakturan skapas när ärendet stängs och ska skickas inom en vecka. Lagens gräns är den 15:e månaden efter.' },
  { title: 'En faktura per ärende', text: 'Kundens märkning blir Er referens, arbetsorder och objekt blir Ert ordernummer, ärendets adress blir leveransadress.' },
  { title: 'Delfakturering', text: 'Ärenden med flera besök kan faktureras per besök. Nästa besök visas på fakturan.' },
]

const chunks = <T,>(list: T[], size = 100): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

const dagar = (n: number) => `${n} ${n === 1 ? 'dag' : 'dagar'}`

const caseTable = (caseType: string | null | undefined) =>
  caseType === 'private' ? 'private_cases' : caseType === 'business' ? 'business_cases' : 'cases'

/** Ärendefälten fakturalistan behöver, ur vilken ärendetabell som helst. */
function toCaseInfo(row: Record<string, unknown>): CaseInfo {
  const str = (k: string) => (typeof row[k] === 'string' && row[k] ? (row[k] as string) : null)
  const techs = ['primary_technician_name', 'secondary_technician_name', 'tertiary_technician_name']
    .map(str)
    .filter((x): x is string => !!x)
  return {
    case_number: str('case_number'),
    title: str('title'),
    service_type: str('service_type') ?? str('pest_type'),
    completed_date: str('completed_date'),
    invoice_marking: str('invoice_marking'),
    work_order_number: str('work_order_number'),
    work_object: str('work_object'),
    room_number: str('room_number'),
    technicians: techs,
  }
}

export default function AdhocQueue({ onShowArchive }: { onShowArchive?: () => void }) {
  const { user, profile } = useAuth()
  const canApprove = !!profile?.can_approve_invoices
  const approverName = profile?.display_name || profile?.technicians?.name || profile?.email || 'Okänd'

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [orphans, setOrphans] = useState<OrphanGroup[]>([])
  const [sent, setSent] = useState<SentAdhoc[]>([])
  const [cases, setCases] = useState<Map<string, CaseInfo>>(new Map())
  const [visits, setVisits] = useState<Map<string, VisitInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)

  const today = swedishDay(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const monthStart = `${today.slice(0, 7)}-01`
      const [invRows, orphanRes, sentRows] = await Promise.all([
        fetchAllRows<Invoice>((from, to) =>
          supabase
            .from('invoices')
            .select('*')
            .eq('invoice_type', 'adhoc')
            .in('status', ['pending_approval', 'ready'])
            .is('fortnox_document_number', null)
            .eq('is_historical', false)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: Invoice[] | null; error: unknown }>
        ),
        // Samma urval som UnbilledAdhocBanner hade: äkta läckage = rader från
        // ett ärende utan faktura. Historiska importrader (case_id null) aldrig.
        supabase
          .from('contract_billing_items')
          .select('id, case_id, customer_id, total_price, vat_rate, status, invoice_date, customer:customers(company_name, adhoc_invoice_grouping)')
          .eq('item_type', 'ad_hoc')
          .is('invoice_id', null)
          .not('case_id', 'is', null)
          .in('status', ['pending', 'approved']),
        fetchAllRows<SentAdhoc>((from, to) =>
          supabase
            .from('invoices')
            .select('id, subtotal, total_amount, booked_at, sent_at')
            .eq('invoice_type', 'adhoc')
            .not('fortnox_document_number', 'is', null)
            .or(`booked_at.gte.${monthStart},sent_at.gte.${monthStart}`)
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: SentAdhoc[] | null; error: unknown }>
        ),
      ])
      setInvoices(invRows)
      setSent(sentRows)
      setSelected(new Set())

      if (orphanRes.error) console.error('[Merförsäljning] Kunde inte hämta ofakturerade rader:', orphanRes.error)
      type OrphanRow = {
        case_id: string
        customer_id: string
        total_price: number
        vat_rate: number | null
        status: string
        invoice_date: string | null
        customer: { company_name: string; adhoc_invoice_grouping: string | null } | null
      }
      const byCase = new Map<string, OrphanGroup>()
      for (const row of (orphanRes.data ?? []) as unknown as OrphanRow[]) {
        const key = `${row.customer_id}|${row.case_id}`
        const excl = Number(row.total_price)
        const incl = excl * (1 + Number(row.vat_rate ?? 25) / 100)
        const g = byCase.get(key)
        if (g) {
          g.totalExcl += excl
          g.totalIncl += incl
          g.count += 1
          g.hasPending = g.hasPending || row.status === 'pending'
          if (row.invoice_date && (!g.invoiceDate || row.invoice_date < g.invoiceDate)) g.invoiceDate = row.invoice_date
        } else {
          byCase.set(key, {
            key,
            caseId: row.case_id,
            customerId: row.customer_id,
            customerName: row.customer?.company_name ?? 'Okänd kund',
            grouping: (row.customer?.adhoc_invoice_grouping ?? 'per_case') as 'per_case' | 'monthly_batch',
            totalExcl: excl,
            totalIncl: incl,
            count: 1,
            invoiceDate: row.invoice_date,
            hasPending: row.status === 'pending',
          })
        }
      }
      // Grupper på 0 kr blir aldrig faktura (0 kr-regeln i generatorn)
      const orphanList = [...byCase.values()].filter((g) => Math.abs(g.totalExcl) >= 0.005)
      setOrphans(orphanList)

      // Ärendena bakom fakturorna och de ofakturerade raderna
      const byTable = new Map<string, Set<string>>()
      const addCase = (table: string, id: string) => {
        const set = byTable.get(table) ?? new Set<string>()
        set.add(id)
        byTable.set(table, set)
      }
      for (const inv of invRows) if (inv.case_id) addCase(caseTable(inv.case_type), inv.case_id)
      for (const o of orphanList) addCase('cases', o.caseId)
      const caseMap = new Map<string, CaseInfo>()
      for (const [table, ids] of byTable) {
        for (const part of chunks([...ids])) {
          const { data } = await supabase.from(table as 'cases').select('*').in('id', part)
          for (const row of (data ?? []) as unknown as Array<Record<string, unknown> & { id: string }>) {
            caseMap.set(row.id, toCaseInfo(row))
          }
        }
      }
      setCases(caseMap)

      // Besöket bakom en delfaktura: utfört-datum och tekniker
      const visitIds = [...new Set(invRows.map((i) => i.visit_id).filter((x): x is string => !!x))]
      const visitMap = new Map<string, VisitInfo>()
      for (const part of chunks(visitIds)) {
        const { data } = await supabase.from('visits').select('id, visit_date, technician_name, technicians').in('id', part)
        for (const v of (data ?? []) as unknown as Array<VisitInfo & { id: string }>) visitMap.set(v.id, v)
      }
      setVisits(visitMap)
    } catch (error) {
      console.error('Fel vid laddning av merförsäljning:', error)
      toast.error('Kunde inte ladda fakturorna')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { load() }, [load])

  const handleGenerate = async (group: OrphanGroup) => {
    setGenerating(group.key)
    try {
      const { ContractInvoiceGenerator } = await import('../../../../services/contractInvoiceGenerator')
      // T12:00 undviker att datumet tippar över midnatt vid tidszonstolkning
      const completedAt = group.invoiceDate ? new Date(`${group.invoiceDate}T12:00:00`) : new Date()
      const invoiceId = await ContractInvoiceGenerator.generateAdhocInvoiceForCase({
        customerId: group.customerId,
        caseId: group.caseId,
        completedAt,
        grouping: group.grouping,
      })
      if (invoiceId) toast.success(`Faktura skapad för ${group.customerName}`)
      else toast('Inget att fakturera, raderna kan redan vara kopplade')
      await load()
    } catch (err) {
      toast.error(`Kunde inte skapa faktura: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(null)
    }
  }

  // Utfört-datum och tekniker per faktura
  const rowInfo = useCallback((inv: Invoice) => {
    const c = inv.case_id ? cases.get(inv.case_id) : undefined
    const v = inv.visit_id ? visits.get(inv.visit_id) : undefined
    const doneRaw = v?.visit_date ?? c?.completed_date ?? inv.created_at
    const done = swedishDay(doneRaw)
    const techs = v
      ? (v.technicians?.map((t) => t.name).filter(Boolean) ?? (v.technician_name ? [v.technician_name] : []))
      : c?.technicians ?? []
    return { c, done, techs }
  }, [cases, visits])

  const pending = useMemo(() => invoices.filter((i) => i.status === 'pending_approval'), [invoices])
  const ready = useMemo(() => invoices.filter((i) => i.status === 'ready'), [invoices])

  const byDone = (a: Invoice, b: Invoice) => rowInfo(a).done.localeCompare(rowInfo(b).done)
  const sumIncl = (list: Invoice[]) => list.reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const orphanSum = orphans.reduce((s, o) => s + o.totalIncl, 0)
  const oldestPending = pending.length > 0 ? pending.map((i) => rowInfo(i).done).sort()[0] : null
  const monthKey = today.slice(0, 7)
  const sentThisMonth = sent.filter((s) => {
    const ts = s.booked_at ?? s.sent_at
    return ts && swedishDay(ts).slice(0, 7) === monthKey
  })

  const kpis: Kpi[] = [
    { key: 'orphans', label: 'Utfört, saknar faktura', tone: 'red', count: orphans.length, sum: fmtKr(orphanSum), hint: 'Ärendet är stängt men ingen faktura finns' },
    {
      key: 'pending',
      label: 'Kräver godkännande',
      tone: 'orange',
      count: pending.length,
      sum: fmtKr(sumIncl(pending)),
      hint: oldestPending ? `Äldsta utfört för ${dagar(daysBetween(oldestPending, today))} sedan` : 'Inget väntar',
    },
    { key: 'ready', label: 'Godkända, att skicka', tone: 'green', count: ready.length, sum: fmtKr(sumIncl(ready)), hint: 'Redo för Fortnox' },
    {
      key: 'sent',
      label: `Skickat i ${MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1]}`,
      tone: 'blue',
      count: sentThisMonth.length,
      sum: fmtKr(sentThisMonth.reduce((s, i) => s + Number(i.total_amount || 0), 0)),
      hint: 'Se arkivet',
    },
  ]

  const selectedInvoices = invoices.filter((i) => selected.has(i.id))
  const approveList = selectedInvoices.filter((i) => i.status === 'pending_approval')
  const sendList = (selectedInvoices.length > 0 ? selectedInvoices : invoices).filter((i) => i.status === 'ready')

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

  const GRID = 'grid grid-cols-[140px_minmax(220px,1.6fr)_190px_130px_110px_16px] gap-3 items-center'

  const markingCell = (c: CaseInfo | undefined, invMarking: string | null) => {
    const ref = invMarking ?? c?.invoice_marking ?? null
    const order = c ? caseMarkingOnInvoice(c).orderNumber : null
    return (
      <div className="flex flex-col gap-0.5 text-xs min-w-0">
        <span className="text-slate-200 truncate">{ref ?? <span className="text-slate-500">Ingen märkning</span>}</span>
        {order && <span className="text-slate-500 truncate">{order}</span>}
      </div>
    )
  }

  const doneCell = (done: string, statusTone: Tone, statusText: string) => (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[13px] text-white">{done}</span>
      <StatusText tone={statusTone}>{statusText}</StatusText>
    </div>
  )

  const renderInvoice = (inv: Invoice, kind: 'pending' | 'ready') => {
    const { c, done, techs } = rowInfo(inv)
    const age = daysBetween(done, today)
    const on = selected.has(inv.id)
    const status: [Tone, string] = kind === 'ready'
      ? ['green', inv.approved_by_name ? `Godkänd av ${inv.approved_by_name}` : 'Godkänd']
      : [age > LATE_AFTER_DAYS ? 'orange' : 'grey', age <= 0 ? 'Utfört idag' : `Utfört för ${dagar(age)} sedan`]
    return (
      <div key={inv.id} className={`flex items-stretch border-b border-slate-800/70 ${on ? 'bg-[#20c58f]/5' : ''}`}>
        <Checkbox checked={on} onChange={() => setSelected((p) => toggleOne(inv.id, p))} label={`Markera ${inv.invoice_number ?? 'faktura'}`} />
        <button
          type="button"
          onClick={() => setOpenId(inv.id)}
          aria-label={`Öppna ${inv.invoice_number ?? 'faktura'}, ${inv.customer_name}`}
          className={`flex-1 min-w-0 ${GRID} py-2.5 pr-4 text-left hover:bg-slate-800/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]`}
        >
          {doneCell(done, status[0], status[1])}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-white truncate">{inv.customer_name}</span>
            <span className="text-xs text-slate-500 truncate">
              <span className="font-mono">{c?.case_number ?? inv.invoice_number ?? '-'}</span>
              {(c?.title || c?.service_type) && <> · {c?.title ?? c?.service_type}</>}
              {inv.visit_id && <> · delfaktura</>}
            </span>
          </div>
          {markingCell(c, inv.invoice_marking)}
          <span className="text-xs text-slate-300 truncate">{techs.join(', ') || '-'}</span>
          <span className="text-right text-sm font-semibold text-white tabular-nums">{fmtNum(Number(inv.total_amount || 0))}</span>
          <Icon name="allman.chevron" size={16} className="text-slate-500" />
        </button>
      </div>
    )
  }

  const renderOrphan = (o: OrphanGroup) => {
    const c = cases.get(o.caseId)
    const done = o.invoiceDate ? o.invoiceDate.slice(0, 10) : c?.completed_date ? swedishDay(c.completed_date) : null
    const age = done ? daysBetween(done, today) : null
    return (
      <div key={o.key} className="flex items-stretch border-b border-slate-800/70">
        <span className="w-11 flex-none" />
        <div className={`flex-1 min-w-0 ${GRID} py-2.5 pr-4`}>
          {doneCell(done ?? '-', 'red', age === null ? 'Utfört' : age <= 0 ? 'Utfört idag' : `Utfört för ${dagar(age)} sedan`)}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-white truncate">{o.customerName}</span>
            <span className="text-xs text-slate-500 truncate">
              <span className="font-mono">{c?.case_number ?? '-'}</span>
              {(c?.title || c?.service_type) && <> · {c?.title ?? c?.service_type}</>}
              {' · '}{o.count} {o.count === 1 ? 'rad' : 'rader'}
            </span>
            {o.hasPending && <span className="text-[11px] text-orange-400">Innehåller rad som väntar på rabattgodkännande</span>}
          </div>
          {markingCell(c, null)}
          <span className="text-xs text-slate-300 truncate">{c?.technicians.join(', ') || '-'}</span>
          <span className="text-right text-sm font-semibold text-white tabular-nums">{fmtNum(o.totalIncl)}</span>
          <span />
        </div>
        <div className="flex items-center pr-3">
          <button
            type="button"
            onClick={() => handleGenerate(o)}
            disabled={generating !== null}
            className="min-h-[36px] px-3 rounded-lg bg-[#20c58f] hover:bg-[#1bab7c] text-[#fff] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            <Icon name={generating === o.key ? 'allman.laddar' : 'allman.plus'} size={16} className={generating === o.key ? 'animate-spin' : ''} />
            Skapa faktura
          </button>
        </div>
      </div>
    )
  }

  const pendingSorted = [...pending].sort(byDone)
  const readySorted = [...ready].sort(byDone)
  const empty = orphans.length === 0 && invoices.length === 0

  const invoiceGroup = (key: string, tone: Tone, title: string, desc: string, list: Invoice[], kind: 'pending' | 'ready') => {
    if (list.length === 0) return null
    const ids = list.map((i) => i.id)
    const st = groupCheckState(ids, selected)
    return (
      <div key={key}>
        <GroupHeader
          tone={tone}
          title={title}
          desc={desc}
          total={`${fakturor(list.length)} · ${fmtKr(sumIncl(list))}`}
          checked={st.checked}
          indeterminate={st.indeterminate}
          onToggle={() => setSelected((p) => toggleGroup(ids, p))}
        />
        {list.map((i) => renderInvoice(i, kind))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <KpiRow kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-end">
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
            count={selectedInvoices.length}
            sumText={`${fmtKr(sumIncl(selectedInvoices))} inkl. moms`}
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
            En faktura per ärende. Märkning, arbetsorder, objekt och adress hämtas från ärendet. Klicka på en faktura för att öppna den, där makuleras den också.
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="flex items-center border-b border-slate-800">
                <span className="w-11 flex-none" />
                <div className={`flex-1 ${GRID} py-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500`}>
                  <span>Utfört</span>
                  <span>Kund och ärende</span>
                  <span>Märkning på fakturan</span>
                  <span>Tekniker</span>
                  <span className="text-right">Belopp inkl.</span>
                  <span />
                </div>
              </div>
              {loading && empty ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
                  <Icon name="allman.laddar" size={16} className="animate-spin" /> Laddar...
                </div>
              ) : empty ? (
                <div className="py-8 text-center text-sm text-slate-400">Ingen merförsäljning att fakturera just nu</div>
              ) : (
                <>
                  {orphans.length > 0 && (
                    <div>
                      <div className="flex items-center bg-slate-800/40 border-b border-slate-800">
                        <span className="w-11 flex-none" />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-3 py-2.5 pr-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-400" />
                            <span className="text-sm font-semibold text-white">Utfört arbete utan faktura</span>
                            <span className="text-xs text-slate-500 truncate">Skapa fakturan från ärendet</span>
                          </div>
                          <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                            {orphans.length} {orphans.length === 1 ? 'ärende' : 'ärenden'} · {fmtKr(orphanSum)}
                          </span>
                        </div>
                      </div>
                      {orphans
                        .slice()
                        .sort((a, b) => (a.invoiceDate ?? '').localeCompare(b.invoiceDate ?? ''))
                        .map(renderOrphan)}
                    </div>
                  )}
                  {invoiceGroup('pending', 'orange', 'Kräver godkännande', 'Granska och godkänn', pendingSorted, 'pending')}
                  {invoiceGroup('ready', 'green', 'Godkända, redo för Fortnox', 'Skickas med knappen ovan', readySorted, 'ready')}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SideCard title="Så faktureras merförsäljning">
            <RuleList rules={RULES} />
          </SideCard>
          {onShowArchive && (
            <SideCard
              title="Skickat i månaden"
              action={<button type="button" onClick={onShowArchive} className="text-xs text-[#20c58f] hover:underline">Visa arkivet</button>}
            >
              <p className="text-xs text-slate-400">
                {sentThisMonth.length === 0
                  ? `Inget skickat sedan ${shortDay(`${monthKey}-01`)}.`
                  : `${fakturor(sentThisMonth.length)} skickade sedan ${shortDay(`${monthKey}-01`)}, ${fmtKr(sentThisMonth.reduce((s, i) => s + Number(i.total_amount || 0), 0))} inkl. moms.`}
              </p>
            </SideCard>
          )}
        </div>
      </div>

      <InvoiceDetailModal isOpen={openId !== null} onClose={() => setOpenId(null)} invoiceId={openId} onStatusChange={load} />
    </div>
  )
}

