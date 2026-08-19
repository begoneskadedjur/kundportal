// src/components/admin/customers/record/ContractCard.tsx
// Avtalskortet — det enda "kortet" på kundsidan. Visar ett avtal med status,
// placering (organisation/enhet), belopp i avtalets egen faktureringsrytm och
// ett expanderbart innehåll (avtalstext, produkter, tidslinje, senaste fakturor).

import { useMemo, useState } from 'react'
import { Building2, ChevronDown, ExternalLink, MapPin } from 'lucide-react'
import {
  BILLING_FREQUENCY_LABEL,
  contractAnnualValue,
  contractDisplayName,
  customerRowName,
  formatDateSv,
  formatKr,
  formatMonthSv,
  isEndedContract,
  isImportedContract,
  isTerminatedButRunning,
  type RecordAddition,
  type RecordBillingItem,
  type RecordContract,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'
import ContractTimelineList, { buildSingleContractTimeline } from './ContractTimelineList'

interface SelectedProduct {
  name?: string
  product_name?: string
  description?: string
  quantity?: number | string
  price?: number | string
}

function parseSelectedProducts(raw: unknown): SelectedProduct[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) return parsed as SelectedProduct[]
    if (typeof parsed === 'object') return [parsed as SelectedProduct]
  } catch {
    // ogiltig JSONB — visa inget istället för att krascha
  }
  return []
}

const BILLING_STATUS_LABEL: Record<string, string> = {
  paid: 'Betald',
  sent: 'Skickad',
  invoiced: 'Skickad',
  booked: 'Bokförd',
  overdue: 'Förfallen',
  pending: 'Väntar',
  approved: 'Väntar',
  draft: 'Väntar',
  cancelled: 'Makulerad',
}

interface Props {
  contract: RecordContract
  /** Kundraden som avtalet ligger på */
  owner: RecordCustomer
  /** Org-raden (huvudkontoret) */
  root: RecordCustomer
  /** Tillägg + fakturarader filtrerade på ägarens customer_id */
  additions: RecordAddition[]
  billingItems: RecordBillingItem[]
  /** Kompakt läge för Översikt-fliken: ingen expander, färre rader */
  compact?: boolean
}

export default function ContractCard({ contract, owner, root, additions, billingItems, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  const imported = isImportedContract(contract)
  const ended = isEndedContract(contract)
  const terminatedRunning = isTerminatedButRunning(contract)
  const isUnitContract = !!owner.parent_customer_id
  const annual = contractAnnualValue(contract)

  const timelineEvents = useMemo(
    () => buildSingleContractTimeline(contract, additions, billingItems),
    [contract, additions, billingItems]
  )

  const latestInvoiceRows = useMemo(
    () =>
      [...billingItems]
        .filter((i) => i.status !== 'cancelled')
        .sort((a, b) => b.billing_period_start.localeCompare(a.billing_period_start))
        .slice(0, 3),
    [billingItems]
  )

  const products = useMemo(() => parseSelectedProducts(contract.selected_products), [contract.selected_products])

  // Belopp i avtalets egen rytm
  const moneyLine = (() => {
    if (!annual) return 'Avropsavtal — fasta priser per ärende'
    if (contract.billing_frequency === 'monthly') {
      return `${Math.round(annual / 12).toLocaleString('sv-SE')} kr/mån (${formatKr(annual)}/år)`
    }
    return `${formatKr(annual)}/år`
  })()

  const frequencyLabel = contract.billing_frequency ? BILLING_FREQUENCY_LABEL[contract.billing_frequency] : null
  const startDate = contract.contract_start_date ?? contract.start_date

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50">
      <div className={compact ? 'px-4 py-3' : 'px-4 py-3.5'}>
        {/* Rubrikrad: namn + status + Oneflow/Importerat */}
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">{contractDisplayName(contract)}</h3>
          <span className="flex items-center gap-1.5 shrink-0 ml-auto">
            {terminatedRunning && (
              <span className="text-xs text-amber-400">Uppsagt</span>
            )}
            {ended ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full border border-slate-500" aria-hidden />
                Avslutat
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" aria-hidden />
                Aktivt
              </span>
            )}
            {imported ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                Importerat
              </span>
            ) : (
              contract.oneflow_contract_id && (
                <a
                  href={`https://app.oneflow.com/contracts/${contract.oneflow_contract_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#20c58f] hover:underline"
                >
                  Oneflow
                  <ExternalLink className="w-3 h-3" />
                </a>
              )
            )}
          </span>
        </div>

        {/* Placeringsrad: organisation eller enhet */}
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400 min-w-0">
          {isUnitContract ? (
            <>
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">
                Enhetsavtal · {customerRowName(owner)}
                {owner.customer_number == null && root.customer_number != null && (
                  <span className="text-slate-500"> · faktureras via HK #{root.customer_number}</span>
                )}
              </span>
            </>
          ) : (
            <>
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">
                Organisationsavtal · {root.company_name}
                {root.customer_number != null && <span className="font-mono"> (#{root.customer_number})</span>}
              </span>
            </>
          )}
        </div>

        {/* Belopp + period */}
        <div className="mt-1.5 text-sm text-slate-200 tabular-nums">
          {moneyLine}
          {frequencyLabel && annual > 0 && <span className="text-slate-400"> · {frequencyLabel}</span>}
          {(startDate || contract.contract_end_date) && (
            <span className="text-slate-400">
              {' '}· {startDate ? formatDateSv(startDate) : '?'} → {contract.contract_end_date ? formatDateSv(contract.contract_end_date) : 'tills vidare'}
            </span>
          )}
        </div>

        {/* Sekundärrad: uppsägningstid m.m. */}
        {!compact && (
          <div className="mt-1 text-xs text-slate-500">
            {contract.notice_period_months != null && <span>Uppsägningstid {contract.notice_period_months} mån</span>}
            {contract.notice_period_months != null && contract.contract_length && <span> · </span>}
            {contract.contract_length && <span>Avtalslängd {contract.contract_length}</span>}
          </div>
        )}

        {/* Expander */}
        {!compact && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Dölj detaljer' : 'Visa detaljer'}
          </button>
        )}
      </div>

      {!compact && (
        <div hidden={!expanded} className="border-t border-slate-800 px-4 py-3 space-y-4">
          {/* Avtalstext */}
          {contract.agreement_text && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Avtalstext</h4>
              <p className="text-sm text-slate-300 whitespace-pre-line max-h-48 overflow-y-auto">
                {contract.agreement_text}
              </p>
            </div>
          )}

          {/* Produkter */}
          {products.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Produkter & tjänster</h4>
              <ul className="divide-y divide-slate-800/70">
                {products.map((p, i) => {
                  const name = p.name || p.product_name || p.description || `Produkt ${i + 1}`
                  const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price
                  return (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                      <span className="text-slate-300 truncate">
                        {name}
                        {p.quantity != null && Number(p.quantity) > 1 && (
                          <span className="text-slate-500"> × {p.quantity}</span>
                        )}
                      </span>
                      {price != null && !Number.isNaN(price) && (
                        <span className="text-slate-400 tabular-nums shrink-0">{formatKr(Number(price))}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Tidslinje för avtalet */}
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Tidslinje</h4>
            <ContractTimelineList events={timelineEvents} compact emptyText="Inga händelser för avtalet ännu." />
          </div>

          {/* Senaste fakturarader */}
          {latestInvoiceRows.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Senaste fakturarader</h4>
              <ul className="divide-y divide-slate-800/70">
                {latestInvoiceRows.map((row) => (
                  <li key={row.id} className="flex items-baseline gap-3 py-1.5 text-sm">
                    <span className="text-slate-400 tabular-nums shrink-0 w-20">{formatMonthSv(row.billing_period_start)}</span>
                    <span className="text-slate-300 truncate flex-1">{row.article_name}</span>
                    <span className="text-slate-500 text-xs shrink-0">{BILLING_STATUS_LABEL[row.status] ?? row.status}</span>
                    <span className="text-slate-200 tabular-nums shrink-0">{formatKr(Number(row.total_price ?? 0))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
