// src/components/admin/customers/record/BillingChainSection.tsx
// Fakturering-fliken: faktureringskedjan grupperad PER AVTAL (etapp 5).
// Rader med contract_id hamnar under sitt avtal; äldre/ej entydiga rader utan
// koppling samlas i en restgrupp "Ej avtalskopplade rader" per kundrad.
// Perioder aggregeras per faktureringsperiod och faktura, med status,
// fakturanummer och förfallodatum.

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'
import {
  contractDisplayName,
  customerRowName,
  formatDateSv,
  formatKr,
  formatMonthSv,
  type RecordBillingItem,
  type RecordContract,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'

type AggStatus = 'paid' | 'sent' | 'pending' | 'overdue' | 'cancelled'

const STATUS_META: Record<AggStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  paid: { label: 'Betald', className: 'text-[#20c58f]', Icon: CheckCircle2 },
  sent: { label: 'Skickad', className: 'text-blue-400', Icon: Clock },
  pending: { label: 'Väntar', className: 'text-slate-500', Icon: Circle },
  overdue: { label: 'Förfallen', className: 'text-red-400', Icon: AlertTriangle },
  cancelled: { label: 'Makulerad', className: 'text-slate-600', Icon: XCircle },
}

function aggregateStatus(statuses: string[]): AggStatus {
  if (statuses.some((s) => s === 'overdue')) return 'overdue'
  if (statuses.length > 0 && statuses.every((s) => s === 'cancelled')) return 'cancelled'
  const live = statuses.filter((s) => s !== 'cancelled')
  if (live.length > 0 && live.every((s) => s === 'paid')) return 'paid'
  if (live.some((s) => ['sent', 'invoiced', 'booked', 'paid'].includes(s))) return 'sent'
  return 'pending'
}

interface PeriodRow {
  key: string
  periodStart: string
  total: number
  status: AggStatus
  invoiceNumber: string | null
  dueDate: string | null
}

function buildPeriodRows(items: RecordBillingItem[]): PeriodRow[] {
  const groups = new Map<string, RecordBillingItem[]>()
  for (const item of items) {
    const invoice = item.fortnox_document_number ?? item.invoice_number ?? ''
    const key = item.billing_period_start.slice(0, 10) + '|' + invoice
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return Array.from(groups.entries())
    .map(([key, rows]) => ({
      key,
      periodStart: rows[0].billing_period_start,
      total: rows.reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
      status: aggregateStatus(rows.map((r) => r.status)),
      invoiceNumber: rows[0].fortnox_document_number ?? rows[0].invoice_number,
      dueDate: rows.find((r) => r.due_date)?.due_date ?? null,
    }))
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
}

const INITIAL_VISIBLE = 8

/** Kundnummer/via HK-noten för raden som fakturorna hör till */
function CustomerNote({ customer, root }: { customer: RecordCustomer; root: RecordCustomer }) {
  const isUnit = !!customer.parent_customer_id
  if (isUnit) {
    return customer.customer_number != null ? (
      <span className="text-xs font-mono text-slate-500">#{customer.customer_number}</span>
    ) : (
      <span className="text-xs text-slate-500">
        faktureras via HK{root.customer_number != null && <span className="font-mono"> #{root.customer_number}</span>}
      </span>
    )
  }
  return customer.customer_number != null ? (
    <span className="text-xs font-mono text-slate-500">#{customer.customer_number} · org</span>
  ) : null
}

function BillingGroup({
  title,
  customer,
  root,
  items,
}: {
  title: string
  /** Kundraden som raderna faktureras på (avtalets ägare eller restgruppens rad) */
  customer: RecordCustomer | null
  root: RecordCustomer
  items: RecordBillingItem[]
}) {
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(() => buildPeriodRows(items), [items])

  const invoicedThisYear = useMemo(() => {
    const year = new Date().getFullYear()
    return items
      .filter(
        (i) =>
          new Date(i.billing_period_start).getFullYear() === year &&
          ['sent', 'invoiced', 'booked', 'paid', 'overdue'].includes(i.status)
      )
      .reduce((sum, i) => sum + Number(i.total_price ?? 0), 0)
  }, [items])

  const visibleRows = showAll ? rows : rows.slice(0, INITIAL_VISIBLE)

  return (
    <div>
      {/* Gruppheader: avtal/restgrupp + kundrad med kundnummer/via HK */}
      <div className="flex items-baseline gap-2 pb-1.5 border-b border-slate-800 min-w-0">
        <h3 className="text-sm font-semibold text-slate-100 truncate">{title}</h3>
        {customer && (
          <span className="flex items-baseline gap-1.5 min-w-0 shrink-0">
            <span className="text-xs text-slate-400 truncate">{customerRowName(customer)}</span>
            <CustomerNote customer={customer} root={root} />
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500 tabular-nums shrink-0">
          Fakturerat i år: {formatKr(invoicedThisYear)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">Inga fakturarader ännu.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {visibleRows.map((row) => {
            const meta = STATUS_META[row.status]
            return (
              <li key={row.key} className="flex items-baseline gap-3 py-1.5 text-sm group">
                <span className="text-slate-300 tabular-nums w-20 shrink-0">{formatMonthSv(row.periodStart)}</span>
                <span
                  className={`text-slate-200 tabular-nums w-24 shrink-0 text-right ${
                    row.status === 'cancelled' ? 'line-through text-slate-600' : ''
                  }`}
                >
                  {formatKr(row.total)}
                </span>
                <span className={`flex items-center gap-1.5 w-28 shrink-0 ${meta.className}`}>
                  <meta.Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{meta.label}</span>
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {row.invoiceNumber && <span className="font-mono">{row.invoiceNumber}</span>}
                  {row.invoiceNumber && row.dueDate && row.status !== 'paid' && ' · '}
                  {row.dueDate && row.status !== 'paid' && `förfaller ${formatDateSv(row.dueDate)}`}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {rows.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
        >
          {showAll ? 'Visa färre' : `Visa alla ${rows.length} perioder`}
        </button>
      )}
    </div>
  )
}

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  /** Familjens avtal i visningsordning (från CustomerRecordContent) */
  contracts: RecordContract[]
  billingItems: RecordBillingItem[]
}

export default function BillingChainSection({ root, units, contracts, billingItems }: Props) {
  const { contractGroups, orphanGroups } = useMemo(() => {
    const contractIds = new Set(contracts.map((c) => c.id))
    const byContract = new Map<string, RecordBillingItem[]>()
    const orphansByCustomer = new Map<string, RecordBillingItem[]>()

    for (const item of billingItems) {
      // Rader mot avtal som inte längre visas (t.ex. bortfiltrerade trashed)
      // behandlas som ej avtalskopplade så att de inte försvinner ur kedjan.
      if (item.contract_id && contractIds.has(item.contract_id)) {
        const list = byContract.get(item.contract_id) ?? []
        list.push(item)
        byContract.set(item.contract_id, list)
      } else {
        const list = orphansByCustomer.get(item.customer_id) ?? []
        list.push(item)
        orphansByCustomer.set(item.customer_id, list)
      }
    }

    const family = [root, ...units]
    const customerById = new Map(family.map((c) => [c.id, c]))

    return {
      contractGroups: contracts.map((contract) => ({
        contract,
        owner: customerById.get(contract.customer_id ?? '') ?? root,
        items: byContract.get(contract.id) ?? [],
      })),
      // Restgrupper i familjeordning: org först, sedan enheterna
      orphanGroups: family
        .filter((c) => (orphansByCustomer.get(c.id) ?? []).length > 0)
        .map((c) => ({ customer: c, items: orphansByCustomer.get(c.id)! })),
    }
  }, [root, units, contracts, billingItems])

  if (contractGroups.length === 0 && orphanGroups.length === 0) {
    return (
      <section>
        <p className="text-sm text-slate-500">Inga fakturarader ännu.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {contractGroups.map(({ contract, owner, items }) => (
        <BillingGroup
          key={contract.id}
          title={contractDisplayName(contract)}
          customer={owner}
          root={root}
          items={items}
        />
      ))}
      {orphanGroups.map(({ customer, items }) => (
        <BillingGroup
          key={`orphan-${customer.id}`}
          title="Ej avtalskopplade rader"
          customer={customer}
          root={root}
          items={items}
        />
      ))}
    </section>
  )
}
