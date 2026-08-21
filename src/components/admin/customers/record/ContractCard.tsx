// src/components/admin/customers/record/ContractCard.tsx
// Avtalskortet — det enda "kortet" på kundsidan. Visar ett avtal med status,
// placering (organisation/enhet), belopp i avtalets egen faktureringsrytm och
// ett expanderbart innehåll (avtalstext, produkter, tidslinje, senaste fakturor).

import { useMemo, useState } from 'react'
import { Archive, Building2, ChevronDown, ExternalLink, MapPin } from 'lucide-react'
import {
  BILLING_FREQUENCY_LABEL,
  contractAnnualValue,
  contractDisplayName,
  currentPremiumEvent,
  customerRowName,
  formatDateSv,
  formatKr,
  formatMonthSv,
  isEndedContract,
  isImportedContract,
  isTerminatedButRunning,
  nextPremiumEvent,
  PREMIUM_EVENT_LABEL,
  type RecordAddition,
  type RecordBillingItem,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordPremiumEvent,
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
  /** Premietrappa: contract_premium_events för DETTA avtal (etapp 4) */
  premiumEvents?: RecordPremiumEvent[]
  /** Omfattning: contract_sites-rader för DETTA avtal (etapp 4) */
  contractSites?: RecordContractSite[]
  /** Kundrader i familjen (för enhetsnamn i OMFATTAR-listan) */
  customerById?: Map<string, RecordCustomer>
  /** Kompakt läge för Översikt-fliken: ingen expander, färre rader */
  compact?: boolean
}

export default function ContractCard({
  contract,
  owner,
  root,
  additions,
  billingItems,
  premiumEvents = [],
  contractSites = [],
  customerById,
  compact = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const imported = isImportedContract(contract)
  const ended = isEndedContract(contract)
  const terminatedRunning = isTerminatedButRunning(contract)
  const isUnitContract = !!owner.parent_customer_id
  const annual = contractAnnualValue(contract)

  const timelineEvents = useMemo(
    () => buildSingleContractTimeline(contract, additions, billingItems, premiumEvents),
    [contract, additions, billingItems, premiumEvents]
  )

  // Etapp 5: fakturarader kopplade till DETTA avtal via contract_id.
  // Fallback: kundradens alla rader när ingen rad är avtalskopplad (äldre data).
  const scopedBillingItems = useMemo(() => {
    const hasLinks = billingItems.some((i) => i.contract_id != null)
    return hasLinks ? billingItems.filter((i) => i.contract_id === contract.id) : billingItems
  }, [billingItems, contract.id])

  const latestInvoiceRows = useMemo(
    () =>
      [...scopedBillingItems]
        .filter((i) => i.status !== 'cancelled')
        .sort((a, b) => b.billing_period_start.localeCompare(a.billing_period_start))
        .slice(0, 3),
    [scopedBillingItems]
  )

  const products = useMemo(() => parseSelectedProducts(contract.selected_products), [contract.selected_products])

  // Premietrappa (etapp 4): aktuellt + nästa trappsteg när events finns
  const currentStep = useMemo(() => currentPremiumEvent(premiumEvents), [premiumEvents])
  const nextStep = useMemo(() => nextPremiumEvent(premiumEvents), [premiumEvents])

  // Belopp i avtalets egen rytm
  const inRhythm = (value: number) =>
    contract.billing_frequency === 'monthly'
      ? `${Math.round(value / 12).toLocaleString('sv-SE')} kr/mån`
      : `${formatKr(value)}/år`

  const moneyLine = (() => {
    if (premiumEvents.length > 0) {
      const currentValue = Number(currentStep?.annual_value ?? annual)
      const base = `Just nu: ${inRhythm(currentValue)}`
      if (nextStep) {
        return `${base} (→ ${inRhythm(Number(nextStep.annual_value ?? 0))} från ${formatDateSv(nextStep.effective_from)})`
      }
      return base
    }
    if (!annual) return 'Avropsavtal — fasta priser per ärende'
    if (contract.billing_frequency === 'monthly') {
      return `${Math.round(annual / 12).toLocaleString('sv-SE')} kr/mån (${formatKr(annual)}/år)`
    }
    return `${formatKr(annual)}/år`
  })()

  // Omfattning: enheter som avtalet täcker, med namn från familjens kundrader
  const todayKey = new Date().toISOString().slice(0, 10)
  const coveredSites = contractSites.map((cs) => {
    const site = customerById?.get(cs.customer_id)
    return {
      row: cs,
      name: site ? customerRowName(site) : 'Okänd enhet',
      isFuture: !!cs.active_from && cs.active_from > todayKey,
      isEnded: !!cs.active_to && cs.active_to < todayKey,
    }
  })

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
            {contract.fromCustomerRow ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5" title="Avtalsdatan kommer från kundkortet — ingen separat avtalsrad finns ännu">
                Från kundkortet
              </span>
            ) : imported ? (
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

        {/* Varför avtalet är avslutat. Utan detta ser flera avslutade avtal på
            samma kund ut som oförklarade dubbletter. */}
        {ended && (contract.termination_reason || contract.effective_end_date) && (
          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
            <Archive className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              {contract.effective_end_date && (
                <span className="tabular-nums">
                  Gällde t.o.m. {formatDateSv(contract.effective_end_date)}
                </span>
              )}
              {contract.effective_end_date && contract.termination_reason && <span> · </span>}
              {contract.termination_reason}
            </span>
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

          {/* Premietrappa (etapp 4) */}
          {premiumEvents.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Premietrappa</h4>
              <ul className="space-y-1">
                {premiumEvents.map((event) => {
                  const isFuture = event.effective_from > todayKey
                  const isCurrent = currentStep?.id === event.id
                  return (
                    <li key={event.id} className="flex items-baseline gap-2 text-sm min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 self-center ${
                          isFuture ? 'border border-slate-500 bg-transparent' : 'bg-[#20c58f]'
                        }`}
                        aria-hidden
                      />
                      <span className={`text-xs tabular-nums shrink-0 w-24 ${isFuture ? 'text-slate-600' : 'text-slate-500'}`}>
                        {formatDateSv(event.effective_from)}
                      </span>
                      <span className={`shrink-0 ${isFuture ? 'text-slate-500' : 'text-slate-300'}`}>
                        {PREMIUM_EVENT_LABEL[event.event_type] ?? event.event_type}
                      </span>
                      <span className={`tabular-nums shrink-0 ${isFuture ? 'text-slate-500' : 'text-slate-200'}`}>
                        {formatKr(Number(event.annual_value ?? 0))}/år
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wide text-[#20c58f] shrink-0">Just nu</span>
                      )}
                      {event.note && <span className="text-xs text-slate-500 truncate">· {event.note}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Omfattning (etapp 4): enheter som avtalet täcker */}
          {coveredSites.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">
                Omfattar ({coveredSites.length})
              </h4>
              <ul className="space-y-1">
                {coveredSites.map(({ row, name, isFuture, isEnded }) => (
                  <li key={row.id} className="flex items-baseline gap-2 text-sm min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 self-center ${
                        isFuture || isEnded ? 'border border-slate-500 bg-transparent' : 'bg-[#20c58f]'
                      }`}
                      aria-hidden
                    />
                    <span className={`truncate ${isEnded ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{name}</span>
                    {isFuture && row.active_from && (
                      <span className="text-xs text-slate-500 shrink-0">startar {formatDateSv(row.active_from)}</span>
                    )}
                    {isEnded && row.active_to && (
                      <span className="text-xs text-slate-600 shrink-0">t.o.m. {formatDateSv(row.active_to)}</span>
                    )}
                    {row.note && <span className="text-xs text-slate-500 truncate">· {row.note}</span>}
                  </li>
                ))}
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
