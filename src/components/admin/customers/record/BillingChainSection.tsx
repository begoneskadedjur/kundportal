// src/components/admin/customers/record/BillingChainSection.tsx
//
// Fakturering-fliken. Läser INVOICES — det kanoniska intäktsspåret.
//
// Vyn läste tidigare contract_billing_items, som är faktureringsUNDERLAG:
// bara 13 av 73 rader blir fakturor. För HSB Tallen visades därför 19 400 kr
// av 52 976 kr, för Swedish Pelican 100 809 av 398 409.
//
// Fakturor skapade i portalen är klickbara och öppnar hela fakturan.
// Fortnox-importerad historik (is_historical) är läsbar men inte klickbar —
// det finns inget underlag i systemet att öppna.

import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Clock, XCircle } from 'lucide-react'
import {
  contractDisplayName,
  customerRowName,
  formatDateSv,
  formatKr,
  formatMonthSv,
  type RecordContract,
  type RecordCustomer,
  type RecordInvoice,
} from '../../../../hooks/useCustomerRecord'
import InvoiceSlip, { type SlipVariant } from './InvoiceSlip'

const InvoiceDetailModal = lazy(() => import('../../invoicing/InvoiceDetailModal'))

type AggStatus = 'paid' | 'sent' | 'pending' | 'overdue' | 'cancelled'

const STATUS_META: Record<AggStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  paid: { label: 'Betald', className: 'text-[#20c58f]', Icon: CheckCircle2 },
  sent: { label: 'Skickad', className: 'text-blue-400', Icon: Clock },
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
  const today = new Date().toISOString().slice(0, 10)
  if (DELIVERED.includes(s)) {
    return inv.due_date && inv.due_date < today ? 'overdue' : 'sent'
  }
  return 'pending'
}

/** Årspremie eller arbete utanför avtalet. */
function isContractRevenue(inv: RecordInvoice): boolean {
  return (inv.invoice_type ?? '') === 'contract'
}

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  contracts: RecordContract[]
  invoices: RecordInvoice[]
}

export default function BillingChainSection({ root, units, contracts, invoices }: Props) {
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const byContract = new Map<string, RecordInvoice[]>()
    const unlinked: RecordInvoice[] = []
    for (const inv of invoices) {
      if (inv.contract_id) {
        const list = byContract.get(inv.contract_id) ?? []
        list.push(inv)
        byContract.set(inv.contract_id, list)
      } else {
        unlinked.push(inv)
      }
    }

    const contractGroups = contracts
      .map((c) => ({
        key: c.id,
        title: contractDisplayName(c),
        subtitle: customerRowName(
          [root, ...units].find((r) => r.id === c.customer_id) ?? root
        ),
        rows: (byContract.get(c.id) ?? []).sort((a, b) =>
          (b.billing_period_start ?? '').localeCompare(a.billing_period_start ?? '')
        ),
      }))
      .filter((g) => g.rows.length > 0)

    return {
      contractGroups,
      // Merförsäljning och äldre rader utan avtalskoppling. De hör till kunden,
      // inte till ett specifikt avtal — merförsäljning mäts per kund.
      unlinked: unlinked.sort((a, b) =>
        (b.billing_period_start ?? '').localeCompare(a.billing_period_start ?? '')
      ),
    }
  }, [invoices, contracts, root, units])

  const totals = useMemo(() => {
    const live = invoices.filter((i) => (i.status ?? '') !== 'cancelled')
    const sum = (rows: RecordInvoice[]) => rows.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
    return {
      all: sum(live),
      contract: sum(live.filter(isContractRevenue)),
      extra: sum(live.filter((i) => !isContractRevenue(i))),
      overdue: sum(live.filter((i) => invoiceStatus(i) === 'overdue')),
      historical: sum(live.filter((i) => i.is_historical)),
    }
  }, [invoices])

  if (invoices.length === 0) {
    return <p className="text-sm text-slate-500">Inga fakturor registrerade för kunden.</p>
  }

  return (
    <div className="space-y-5">
      {/* Sammanfattning: avtalat mot merförsäljning, allt ex moms */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-800 bg-slate-900/60 divide-x divide-y lg:divide-y-0 divide-slate-800 overflow-hidden">
        <SumCell label="Fakturerat totalt" value={totals.all} hint="ex moms" />
        <SumCell label="Avtalsintäkt" value={totals.contract} hint="årspremie" tone="brand" />
        <SumCell label="Merförsäljning" value={totals.extra} hint="utanför avtalet" tone="brand" />
        {totals.overdue > 0 ? (
          <SumCell label="Förfallet" value={totals.overdue} hint="obetalt" tone="bad" />
        ) : (
          <SumCell label="Varav historik" value={totals.historical} hint="från Fortnox" tone="muted" />
        )}
      </div>

      {groups.contractGroups.map((g) => (
        <InvoiceGroup
          key={g.key}
          title={g.title}
          subtitle={g.subtitle}
          rows={g.rows}
          onOpen={setOpenInvoiceId}
        />
      ))}

      {groups.unlinked.length > 0 && (
        <InvoiceGroup
          title="Utan avtalskoppling"
          subtitle="merförsäljning och äldre rader"
          rows={groups.unlinked}
          onOpen={setOpenInvoiceId}
        />
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
  onOpen,
}: {
  title: string
  subtitle: string
  rows: RecordInvoice[]
  onOpen: (id: string) => void
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
          const variant: SlipVariant = historical ? 'historical' : status
          const reachedIdx = STEP_ORDER.indexOf(status)

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
                {inv.invoice_number && <span className="font-mono">{inv.invoice_number}</span>}
                {inv.due_date && status === 'overdue' && (
                  <span className="text-red-400"> · förföll {formatDateSv(inv.due_date)}</span>
                )}
              </span>
            </>
          )

          // Historik saknar underlag i systemet — läsbar, men inget att öppna.
          // Etiketten "Fortnox" förklarar varför raden beter sig annorlunda.
          if (historical) {
            return (
              <li key={inv.id} className="flex items-center gap-3 px-2 py-2 -mx-2">
                {content}
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-600 border border-slate-700/70 rounded px-1.5 py-0.5">
                  Fortnox
                </span>
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
