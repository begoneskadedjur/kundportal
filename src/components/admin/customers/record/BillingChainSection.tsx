// src/components/admin/customers/record/BillingChainSection.tsx
//
// Fakturering-fliken. Läser INVOICES — det kanoniska intäktsspåret.
//
// Vyn läste tidigare contract_billing_items, som är faktureringsUNDERLAG:
// bara 13 av 73 rader blir fakturor. För HSB Tallen visades därför 19 400 kr
// av 52 976 kr, för Swedish Pelican 100 809 av 398 409.
//
// Fakturorna delas efter VAD kunden betalar för, med samma ord som
// faktureringssidan och avtalskartans § 6:
//   Årspremie            invoice_type contract, kind premium (samlad eller per avtal)
//   Merförsäljning avtal tilläggsstationer (kind equipment) + ärendefakturor (adhoc)
// Kommande fakturor räknas ur avtalskartans planerare och visas utan att
// finnas i databasen; klick öppnar en förhandsvisning.
//
// Fakturor skapade i portalen är klickbara och öppnar hela fakturan.
// Fortnox-importerad historik (is_historical) är läsbar men inte klickbar —
// det finns inget underlag i systemet att öppna.

import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Circle, Clock, XCircle } from 'lucide-react'
import {
  contractDisplayName,
  customerRowName,
  formatDateSv,
  formatKr,
  formatMonthSv,
  type RecordBillingItem,
  type RecordCase,
  type RecordContract,
  type RecordCustomer,
  type RecordInvoice,
} from '../../../../hooks/useCustomerRecord'
import { isCaseCompleted } from '../../../../utils/customerRevenue'
import type { BillingPlanEntry } from '../../../../services/contractInvoiceGenerator'
import { useUpcomingInvoices } from './useUpcomingInvoices'
import InvoiceSlip, { type SlipVariant } from './InvoiceSlip'
import PlannedInvoicePreviewModal from './PlannedInvoicePreviewModal'
import ImportedInvoicePreviewModal from './ImportedInvoicePreviewModal'

const InvoiceDetailModal = lazy(() => import('../../invoicing/InvoiceDetailModal'))

type AggStatus = 'paid' | 'sent' | 'partial' | 'pending' | 'overdue' | 'cancelled'

const STATUS_META: Record<AggStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  paid: { label: 'Betald', className: 'text-[#20c58f]', Icon: CheckCircle2 },
  sent: { label: 'Skickad', className: 'text-blue-400', Icon: Clock },
  partial: { label: 'Delbetald', className: 'text-amber-300', Icon: Clock },
  pending: { label: 'Väntar', className: 'text-slate-500', Icon: Circle },
  overdue: { label: 'Förfallen', className: 'text-red-400', Icon: AlertTriangle },
  cancelled: { label: 'Makulerad', className: 'text-slate-600', Icon: XCircle },
}

const STEP_ORDER: AggStatus[] = ['pending', 'sent', 'paid']

/** Statusar där fakturan faktiskt nått kunden och alltså KAN förfalla. */
const DELIVERED = ['sent', 'invoiced', 'booked']

/**
 * Fakturans status → visningsstatus.
 *
 * Förfallen kräver att fakturan är SKICKAD. Ett passerat förfallodatum ensamt
 * räcker inte: 40 fakturor på 927 tkr ligger i 'pending_approval' med gammalt
 * due_date — de har aldrig nått kunden och kan därför inte vara förfallna.
 * De är osända, vilket är ett internt ärende, inte en betalningspåminnelse.
 */
function invoiceStatus(inv: RecordInvoice): AggStatus {
  const s = (inv.status ?? '').toLowerCase()
  if (s === 'cancelled') return 'cancelled'
  if (s === 'paid') return 'paid'
  // Kvar att betala enligt Fortnox: 0 = betald även om statusen hängt kvar,
  // en rest = delbetald. Utan saldo gäller statusen.
  const balance = inv.balance_due != null ? Number(inv.balance_due) : null
  if (balance === 0) return 'paid'
  const today = new Date().toISOString().slice(0, 10)
  if (DELIVERED.includes(s)) {
    if (inv.due_date && inv.due_date < today) return 'overdue'
    return balance != null && balance > 0 && balance < Number(inv.total_amount ?? 0) ? 'partial' : 'sent'
  }
  return 'pending'
}

/** Kvar att betala exkl. moms, om Fortnox-saldot är känt och en del är betald. */
function remainingExVat(inv: RecordInvoice): number | null {
  const balance = inv.balance_due != null ? Number(inv.balance_due) : null
  const total = Number(inv.total_amount ?? 0)
  const subtotal = Number(inv.subtotal ?? 0)
  if (balance == null || balance <= 0 || total <= 0) return null
  return Math.round(balance * (subtotal / total) * 100) / 100
}

/** Vad fakturan avser: årspremie, tilläggsstationer eller arbete utöver avtalet. */
type InvoiceKind = 'premium' | 'equipment' | 'upsell'
function invoiceKind(inv: RecordInvoice): InvoiceKind {
  if ((inv.invoice_type ?? '') !== 'contract') return 'upsell'
  const k = inv.contract_invoice_kind ?? 'premium'
  if (k === 'equipment' || k === 'equipment_monthly') return 'equipment'
  return 'premium'
}

const PLAN_KIND_LABEL: Record<string, string> = {
  premium: 'Årspremie',
  equipment: 'Tilläggsstationer, per år',
  equipment_monthly: 'Tilläggsstationer, per månad',
}

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  contracts: RecordContract[]
  invoices: RecordInvoice[]
  /** Utförda ärenden utan faktura — intäkt från tiden före portalen */
  cases: RecordCase[]
  /** Faktureringsunderlag — Fortnox-rader som aldrig blev invoices */
  billingItems: RecordBillingItem[]
}

export default function BillingChainSection({ root, contracts, invoices, cases, billingItems }: Props) {
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)
  const [openPlanned, setOpenPlanned] = useState<BillingPlanEntry | null>(null)
  const [openImported, setOpenImported] = useState<RecordInvoice | null>(null)

  const contractNames = useMemo(() => new Map(contracts.map((c) => [c.id, contractDisplayName(c)])), [contracts])
  /** Radens beskrivning: vilket avtal, eller vad tillägget/ärendet avser. */
  const describe = (inv: RecordInvoice): string => {
    const kind = invoiceKind(inv)
    const contractName = inv.contract_id ? contractNames.get(inv.contract_id) : null
    if (kind === 'premium') {
      if (inv.is_consolidated) {
        const n = new Set((inv.items ?? []).map((i) => i.contract_id).filter(Boolean)).size
        return n > 1 ? `Samlad faktura · ${n} avtal` : 'Samlad faktura'
      }
      return contractName ?? 'Årspremie'
    }
    if (kind === 'equipment') {
      const monthly = inv.contract_invoice_kind === 'equipment_monthly'
      const units = new Set((inv.items ?? []).map((i) => i.article_name?.split(' · ')[1]).filter(Boolean))
      const where = contractName ?? (units.size > 0 ? Array.from(units).join(', ') : null)
      return `Tilläggsstationer${monthly ? ' per månad' : ''}${where ? ` · ${where}` : ''}`
    }
    const first = (inv.items ?? []).find((i) => i.article_name)?.article_name
    return first ? `Ärende · ${first}` : 'Ärende'
  }

  const groups = useMemo(() => {
    const byPeriod = (a: RecordInvoice, b: RecordInvoice) =>
      (b.billing_period_start ?? '').localeCompare(a.billing_period_start ?? '')
    return {
      premium: invoices.filter((i) => invoiceKind(i) === 'premium').sort(byPeriod),
      extra: invoices.filter((i) => invoiceKind(i) !== 'premium').sort(byPeriod),
    }
  }, [invoices])

  const totals = useMemo(() => {
    const live = invoices.filter((i) => (i.status ?? '') !== 'cancelled')
    const sum = (rows: RecordInvoice[]) => rows.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
    // Utförda ärenden utan egen faktura är intäkt som aldrig fakturerats i
    // portalen (ClickUp-eran). De hör till kundens totalsiffra men har ingen
    // fakturarad att visa — därför bara i summeringen, se noten under.
    const invoicedCaseIds = new Set(live.filter((i) => i.case_id).map((i) => i.case_id))
    const caseRevenue = cases
      .filter((c) => Number(c.price ?? 0) > 0 && isCaseCompleted(c) && !invoicedCaseIds.has(c.id))
      .reduce((s, c) => s + Number(c.price ?? 0), 0)

    // Fortnox-historik som bara finns i faktureringsunderlaget. 13 fakturor
    // hos 11 kunder (274 tkr) blev aldrig invoices-rader — bland annat Kiabs
    // F-348 och F-440, som annars försvinner helt ur portalen.
    const invoiceKeys = new Set(
      live.map((i) => `${i.customer_id}|${(i.billing_period_start ?? '').slice(0, 10)}`)
    )
    const orphanItems = billingItems.filter(
      (b) =>
        ['paid', 'invoiced', 'sent'].includes(b.status ?? '') &&
        !invoiceKeys.has(`${b.customer_id}|${(b.billing_period_start ?? '').slice(0, 10)}`)
    )
    const orphanRevenue = orphanItems.reduce((s, b) => s + Number(b.total_price ?? 0), 0)

    const equipment = sum(live.filter((i) => invoiceKind(i) === 'equipment'))
    const upsell = sum(live.filter((i) => invoiceKind(i) === 'upsell')) + caseRevenue
    return {
      all: sum(live) + caseRevenue + orphanRevenue,
      premium: sum(live.filter((i) => invoiceKind(i) === 'premium')),
      equipment,
      extra: equipment + upsell,
      // Förfallet = det som faktiskt kvarstår, inte hela fakturan när en del är betald
      overdue: live.filter((i) => invoiceStatus(i) === 'overdue').reduce((s, i) => s + (remainingExVat(i) ?? Number(i.subtotal ?? 0)), 0),
      historical: sum(live.filter((i) => i.is_historical)) + caseRevenue + orphanRevenue,
      caseRevenue,
      orphanItems,
      orphanRevenue,
    }
  }, [invoices, cases, billingItems])

  // Kommande fakturor ur avtalskartans planerare (delad med Översiktens
  // tidslinje): utkast som finns, perioder som skapas, och första perioden
  // efter horisonten. Se useUpcomingInvoices.
  const { upcoming, error: upcomingError, beyond } = useUpcomingInvoices(root.id, contracts, invoices.length)

  const describePlanned = (e: BillingPlanEntry): string => {
    const kind = PLAN_KIND_LABEL[e.kind ?? 'premium'] ?? 'Årspremie'
    if (e.consolidated) {
      const n = new Set((e.rows ?? []).map((r) => r.contract_id).filter(Boolean)).size
      return `${kind} · samlad faktura${n > 1 ? ` · ${n} avtal` : ''}`
    }
    const name = e.contractLabel ?? (e.contractId ? contractNames.get(e.contractId) : null)
    return name ? `${kind} · ${name}` : kind
  }

  if (invoices.length === 0 && totals.caseRevenue === 0 && totals.orphanItems.length === 0 && (upcoming?.length ?? 0) === 0) {
    return <p className="text-sm text-slate-500">Inga fakturor registrerade för kunden.</p>
  }

  return (
    <div className="space-y-5">
      {/* Sammanfattning: årspremie mot merförsäljning avtal, allt ex moms */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-800 bg-slate-900/60 divide-x divide-y lg:divide-y-0 divide-slate-800 overflow-hidden">
        <SumCell label="Fakturerat totalt" value={totals.all} hint="ex moms" />
        <SumCell label="Årspremie" value={totals.premium} hint="avtalens premie" tone="brand" />
        <SumCell
          label="Merförsäljning avtal"
          value={totals.extra}
          hint={totals.equipment > 0 ? `varav tilläggsstationer ${formatKr(totals.equipment)}` : 'tillägg och arbete utöver avtalet'}
          tone="brand"
        />
        {totals.overdue > 0 ? (
          <SumCell label="Förfallet" value={totals.overdue} hint="obetalt" tone="bad" />
        ) : (
          <SumCell label="Varav historik" value={totals.historical} hint="från Fortnox" tone="muted" />
        )}
      </div>

      {groups.premium.length > 0 && (
        <InvoiceGroup
          title="Årspremie"
          subtitle="avtalens premie, per period"
          rows={groups.premium}
          describe={describe}
          onOpen={setOpenInvoiceId}
          onOpenImported={setOpenImported}
        />
      )}

      {groups.extra.length > 0 && (
        <InvoiceGroup
          title="Merförsäljning avtal"
          subtitle="tilläggsstationer och arbete utöver avtalet"
          rows={groups.extra}
          describe={describe}
          onOpen={setOpenInvoiceId}
          onOpenImported={setOpenImported}
        />
      )}

      {/* Kommande fakturor: ur planeraren, finns inte i databasen. Klick visar
          fakturan som den kommer att se ut. */}
      {contracts.length > 0 && (
        <section>
          <div className="flex items-baseline gap-3 pb-1.5 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100">Kommande fakturor</h3>
            <span className="text-xs text-slate-500 truncate">
              ur avtalen, så länge de inte sägs upp
            </span>
            {upcoming && upcoming.length > 0 && (
              <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
                {formatKr(upcoming.reduce((s, e) => s + (e.planned?.subtotal ?? 0), 0))} <span className="text-slate-600">ex moms</span>
              </span>
            )}
          </div>
          {upcoming === null && !upcomingError && (
            <p className="text-xs text-slate-500 mt-2">Räknar ur avtalen …</p>
          )}
          {upcomingError && <p className="text-xs text-amber-300 mt-2">{upcomingError}</p>}
          {upcoming && upcoming.length === 0 && beyond.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">Inga kommande perioder: avtalet är uppsagt eller faktureringen pausad.</p>
          )}
          {upcoming && (upcoming.length > 0 || beyond.length > 0) && (
            <ul className="divide-y divide-slate-800/60 mt-1">
              {upcoming.map((e, i) => {
                const p = e.planned!
                const exists = e.action !== 'create' && !!e.existingId
                const existingNumber = exists ? invoices.find((inv) => inv.id === e.existingId)?.invoice_number : null
                return (
                  <li key={`${e.contractId ?? 'c'}-${e.kind ?? 'premium'}-${p.periodStart}-${i}`}>
                    <button
                      type="button"
                      onClick={() => (exists ? setOpenInvoiceId(e.existingId!) : setOpenPlanned(e))}
                      className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg text-left hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors group"
                      title={exists ? 'Öppna utkastet' : 'Visa fakturan som den kommer att se ut'}
                    >
                      {exists ? (
                        <InvoiceSlip variant="pending" size={24} />
                      ) : (
                        <span className="w-6 h-6 rounded-md border border-dashed border-slate-600 flex items-center justify-center shrink-0">
                          <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                        </span>
                      )}
                      <span className="text-xs text-slate-400 tabular-nums w-[76px] shrink-0">
                        {formatMonthSv(p.periodStart)}
                      </span>
                      <span className="text-sm text-slate-200 tabular-nums w-24 shrink-0 text-right">
                        {formatKr(p.subtotal)}
                      </span>
                      <span className="flex items-center gap-1.5 w-24 shrink-0 text-slate-500">
                        <Circle className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs">{exists ? 'Utkast finns' : 'Planerad'}</span>
                      </span>
                      <span className="text-xs text-slate-500 truncate min-w-0 flex-1">
                        {describePlanned(e)}
                        {existingNumber && <span className="font-mono"> · {existingNumber}</span>}
                        <span className="text-slate-600">
                          {exists ? ` · skickas till Fortnox när den godkänts` : ` · skapas ${formatDateSv(p.invoiceDate)}`}
                        </span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-[#20c58f] transition-colors shrink-0" />
                    </button>
                  </li>
                )
              })}
              {/* Därefter: avtalet rullar vidare. Nästa period efter de kända,
                  med datumet fakturan skapas och sista dag att säga upp. */}
              {beyond.map((b) => (
                <li key={`beyond-${b.contract.id}-${b.periodStart}`} className="flex items-center gap-3 px-2 py-2 -mx-2 text-slate-500">
                  <span className="w-6 h-6 rounded-md border border-dotted border-slate-700 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-slate-600" />
                  </span>
                  <span className="text-xs tabular-nums w-[76px] shrink-0">{formatMonthSv(b.periodStart)}</span>
                  <span className="text-sm tabular-nums w-24 shrink-0 text-right text-slate-400">{formatKr(b.amount)}</span>
                  <span className="flex items-center gap-1.5 w-24 shrink-0">
                    <Circle className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span className="text-xs">Därefter</span>
                  </span>
                  <span className="text-xs truncate min-w-0 flex-1">
                    {contracts.length > 1 ? `${contractDisplayName(b.contract)} · ` : ''}
                    {formatDateSv(b.periodStart)} till {formatDateSv(b.periodEnd)}
                    <span className="text-slate-600"> · skapas {formatDateSv(b.invoiceDate)}</span>
                    {b.noticeDeadline && (
                      <span className="text-slate-600"> · om avtalet inte sägs upp senast {formatDateSv(b.noticeDeadline)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Fortnox-fakturor som bara finns i faktureringsunderlaget. Läsbara men
          inte klickbara — det finns inget underlag i portalen att öppna. */}
      {totals.orphanItems.length > 0 && (
        <section>
          <div className="flex items-baseline gap-3 pb-1.5 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100">Importerad historik</h3>
            <span className="text-xs text-slate-500">från Fortnox</span>
            <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
              {formatKr(totals.orphanRevenue)} <span className="text-slate-600">ex moms</span>
            </span>
          </div>
          <ul className="divide-y divide-slate-800/60 mt-1">
            {totals.orphanItems.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-2 py-2 -mx-2 text-sm">
                <InvoiceSlip variant="historical" size={24} aged />
                <span className="text-xs text-slate-400 tabular-nums w-[76px] shrink-0">
                  {formatMonthSv(b.billing_period_start)}
                </span>
                <span className="text-sm text-slate-200 tabular-nums w-24 shrink-0 text-right">
                  {formatKr(Number(b.total_price ?? 0))}
                </span>
                <span className="flex items-center gap-1.5 w-24 shrink-0 text-[#20c58f]/70">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-xs">{b.status === 'paid' ? 'Betald' : 'Skickad'}</span>
                </span>
                <span className="text-xs text-slate-500 truncate min-w-0 flex-1">
                  {b.invoice_number && <span className="font-mono">F-{b.invoice_number}</span>}
                  {b.article_name && <span> · {b.article_name}</span>}
                </span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-600 border border-slate-700/70 rounded px-1.5 py-0.5">
                  Fortnox
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Intäkt från tiden före portalen: utförda ärenden som fakturerats
          utanför systemet. Ingår i totalen ovan men har ingen fakturarad. */}
      {totals.caseRevenue > 0 && (
        <section className="p-3 bg-slate-800/20 border border-slate-700/60 rounded-xl">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Fakturerat utanför portalen
            </span>
            <span className="ml-auto text-sm text-slate-300 tabular-nums">
              {formatKr(totals.caseRevenue)} <span className="text-slate-600">ex moms</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Utförda ärenden från tiden före portalen. Ingår i totalen men saknar fakturaunderlag
            här — se Ärenden för detaljerna.
          </p>
        </section>
      )}

      {openInvoiceId && (
        <Suspense fallback={null}>
          <InvoiceDetailModal
            isOpen
            invoiceId={openInvoiceId}
            onClose={() => setOpenInvoiceId(null)}
          />
        </Suspense>
      )}

      {openImported && (
        <ImportedInvoicePreviewModal invoice={openImported} customerName={customerRowName(root)} onClose={() => setOpenImported(null)} />
      )}

      {openPlanned && (
        <PlannedInvoicePreviewModal
          entry={openPlanned}
          customerName={customerRowName(root)}
          contractNames={contractNames}
          onClose={() => setOpenPlanned(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function SumCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone?: 'brand' | 'bad' | 'muted'
}) {
  return (
    <div className="px-4 py-3.5 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-1.5 truncate">{label}</div>
      <div
        className={`text-[19px] font-semibold tabular-nums leading-none ${
          tone === 'bad' ? 'text-red-400' : tone === 'brand' ? 'text-[#20c58f]' : tone === 'muted' ? 'text-slate-400' : 'text-slate-100'
        }`}
      >
        {formatKr(value)}
      </div>
      <div className="text-[11px] text-slate-500 mt-1 truncate">{hint}</div>
    </div>
  )
}

function InvoiceGroup({
  title,
  subtitle,
  rows,
  describe,
  onOpen,
  onOpenImported,
}: {
  title: string
  subtitle: string
  rows: RecordInvoice[]
  describe: (inv: RecordInvoice) => string
  onOpen: (id: string) => void
  onOpenImported: (inv: RecordInvoice) => void
}) {
  const groupTotal = rows
    .filter((r) => (r.status ?? '') !== 'cancelled')
    .reduce((s, r) => s + Number(r.subtotal ?? 0), 0)

  return (
    <section>
      <div className="flex items-baseline gap-3 pb-1.5 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100 truncate">{title}</h3>
        <span className="text-xs text-slate-500 truncate">{subtitle}</span>
        <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
          {formatKr(groupTotal)} <span className="text-slate-600">ex moms</span>
        </span>
      </div>
      <ul className="divide-y divide-slate-800/60 mt-1">
        {rows.map((inv) => {
          const status = invoiceStatus(inv)
          const meta = STATUS_META[status]
          const historical = !!inv.is_historical
          const variant: SlipVariant = historical ? 'historical' : status === 'partial' ? 'sent' : status
          const reachedIdx = status === 'partial' ? STEP_ORDER.indexOf('sent') : STEP_ORDER.indexOf(status)
          const remaining = remainingExVat(inv)
          const partlyPaid = remaining != null && remaining < Number(inv.subtotal ?? 0)

          const content = (
            <>
              <InvoiceSlip variant={variant} size={24} aged={historical} />
              <span className="text-xs text-slate-400 tabular-nums w-[76px] shrink-0">
                {formatMonthSv(inv.billing_period_start)}
              </span>
              <span className="text-sm text-slate-200 tabular-nums w-24 shrink-0 text-right">
                {formatKr(Number(inv.subtotal ?? 0))}
              </span>
              <span className={`flex items-center gap-1.5 w-24 shrink-0 ${meta.className}`}>
                <meta.Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs">{meta.label}</span>
              </span>
              {/* Mikrostegare: pending → skickad → betald */}
              {!historical && status !== 'cancelled' && (
                <span className="hidden sm:flex items-center gap-0.5 shrink-0" aria-hidden>
                  {STEP_ORDER.map((step, i) => (
                    <span key={step} className="flex items-center">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          status === 'overdue'
                            ? 'bg-red-400/70'
                            : reachedIdx >= i
                              ? 'bg-[#20c58f]'
                              : 'bg-slate-700'
                        }`}
                      />
                      {i < STEP_ORDER.length - 1 && (
                        <span
                          className={`w-2 h-px ${
                            status === 'overdue'
                              ? 'bg-red-400/40'
                              : reachedIdx > i
                                ? 'bg-[#20c58f]/50'
                                : 'bg-slate-700/60'
                          }`}
                        />
                      )}
                    </span>
                  ))}
                </span>
              )}
              <span className="text-xs text-slate-500 truncate min-w-0 flex-1">
                <span className="text-slate-400">{describe(inv)}</span>
                {inv.invoice_number && <span className="font-mono"> · {inv.invoice_number}</span>}
                {inv.due_date && status === 'overdue' && (
                  <span className="text-red-400"> · förföll {formatDateSv(inv.due_date)}</span>
                )}
                {partlyPaid && (status === 'overdue' || status === 'partial') && (
                  <span className={status === 'overdue' ? 'text-red-400' : 'text-amber-300'}>
                    {' '}· {formatKr(remaining)} kvar av {formatKr(Number(inv.subtotal ?? 0))}
                  </span>
                )}
              </span>
            </>
          )

          // Historik ägs av Fortnox eller det gamla systemet: öppnas i en läsvy
          // med rader, betalt och kvar att betala. Etiketten säger var den kommer från.
          if (historical) {
            // Bara F-nummer är hämtade ur Fortnox. Övrig historik skapades av
            // importen som antagande om betalda perioder och får inte se ut
            // som Fortnox-fakta (RBFG-fallet 2026-09-18).
            const fromFortnox = (inv.invoice_number ?? '').startsWith('F-') || !!inv.fortnox_document_number
            return (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => onOpenImported(inv)}
                  className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg text-left hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors group"
                  title={fromFortnox ? 'Hämtad från Fortnox, visa rader och saldo' : 'Skapad av importen som antagande om betald period, inte verifierad mot Fortnox'}
                >
                  {content}
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-600 border border-slate-700/70 rounded px-1.5 py-0.5">
                    {fromFortnox ? 'Fortnox' : 'Import'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-[#20c58f] transition-colors shrink-0" />
                </button>
              </li>
            )
          }

          return (
            <li key={inv.id}>
              <button
                type="button"
                onClick={() => onOpen(inv.id)}
                className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg text-left hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors group"
              >
                {content}
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-[#20c58f] transition-colors shrink-0" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
