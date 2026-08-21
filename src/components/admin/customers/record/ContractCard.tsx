// src/components/admin/customers/record/ContractCard.tsx
// Avtalskortet — det enda "kortet" på kundsidan. Visar ett avtal med status,
// placering (organisation/enhet), belopp i avtalets egen faktureringsrytm och
// ett expanderbart innehåll (avtalstext, produkter, tidslinje, senaste fakturor).

import { useMemo, useState } from 'react'
import { Archive, Building2, ChevronDown, ClockAlert, ExternalLink, MapPin, TrendingUp } from 'lucide-react'
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
  oneflowContractUrl,
  PREMIUM_EVENT_LABEL,
  type RecordAddition,
  type RecordBillingItem,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordPremiumEvent,
} from '../../../../hooks/useCustomerRecord'
import ContractTimelineList, { buildSingleContractTimeline } from './ContractTimelineList'
import { ContractSeal, ContractStatusMark, GLYPH_BY_STATE } from './ContractGlyphs'
import { contractState, daysUntilEnd } from '../../../../utils/contractLifecycle'

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
  const oneflowUrl = oneflowContractUrl(contract)
  // Livscykeln styr både glyf och kantfärg — aldrig egna if-kedjor på status
  const glyphState = GLYPH_BY_STATE[contractState(contract)]
  const edgeColor = { active: '#20c58f', terminated: '#f59e0b', ended: '#475569' }[glyphState]

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
    <div
      className={`relative rounded-xl border overflow-hidden transition-colors ${
        ended ? 'border-slate-800/60 bg-slate-900/25' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
      }`}
    >
      {/* Accentkant i statusfärgen — samma grepp som pappret i Avtalskartan */}
      <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: edgeColor }} aria-hidden />
      <div className={compact ? 'pl-5 pr-4 py-3' : 'pl-5 pr-4 py-4'}>
        {/* Rubrikrad: glyf + namn + statusmärke */}
        <div className="flex items-start gap-3 min-w-0">
          <ContractSeal state={glyphState} size={compact ? 32 : 40} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-slate-100 truncate leading-tight">
              {contractDisplayName(contract)}
            </h3>
          </div>
          <ContractStatusMark
            state={glyphState}
            subLabel={
              terminatedRunning && contract.effective_end_date
                ? `T.O.M. ${formatDateSv(contract.effective_end_date)}`
                : ended
                  ? formatDateSv(contract.effective_end_date ?? contract.contract_end_date)
                  : null
            }
          />
        </div>

        {/* Ursprungsmärkning: kundkort / importerat / Oneflow-länk */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="flex items-center gap-1.5 shrink-0 ml-auto">
            {contract.fromCustomerRow ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5" title="Avtalsdatan kommer från kundkortet — ingen separat avtalsrad finns ännu">
                Från kundkortet
              </span>
            ) : imported ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                Importerat
              </span>
            ) : (
              /* oneflowContractUrl ger null för portalskapade avtal. Tidigare
                 byggdes URL:en rakt av oneflow_contract_id, som är NOT NULL och
                 bär ett syntetiskt 'local-<uuid>' — länken pekade då alltid på
                 ett dokument som inte finns. */
              oneflowUrl && (
                <a
                  href={oneflowUrl}
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

        {/* Värdeblocket: beloppet är kortets svar på "vad kostar det" och ska
            gå att hitta utan att läsa en hel rad. Speglar pappret i § Värde. */}
        <div className="mt-3 rounded-lg bg-slate-950/40 border border-slate-800/80 px-3.5 py-2.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[21px] font-bold tabular-nums text-slate-50 leading-none">
              {annual > 0 ? formatKr(Number(currentStep?.annual_value ?? annual)) : 'Avrop'}
            </span>
            <span className="text-xs text-slate-400">
              {annual > 0
                ? `/år${frequencyLabel ? ` · faktureras ${frequencyLabel}` : ''}`
                : '— fasta priser per ärende'}
            </span>
            {contract.billing_frequency === 'monthly' && annual > 0 && (
              <span className="ml-auto text-xs text-slate-500 tabular-nums">
                {Math.round(Number(currentStep?.annual_value ?? annual) / 12).toLocaleString('sv-SE')} kr/mån
              </span>
            )}
          </div>
          {/* Nästa trappsteg — framåtblickande, inte på avslutade avtal */}
          {nextStep && !ended && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#20c58f]">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums">
                {formatKr(Number(nextStep.annual_value ?? 0))}/år från {formatDateSv(nextStep.effective_from)}
              </span>
            </div>
          )}
        </div>

        {/* Uppsägningsremsa: avtalet FUNGERAR fortfarande till slutdatumet.
            Tidigare stod bara ordet "Uppsagt" bredvid "Aktivt" i rubriken. */}
        {terminatedRunning && contract.effective_end_date && (() => {
          const left = daysUntilEnd(contract)
          const urgent = left !== null && left <= 30
          return (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 border border-amber-500/35 bg-amber-500/[0.08]">
              <ClockAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="text-[11.5px] text-amber-200/90 leading-relaxed">
                Uppsagt — gäller till och med{' '}
                <b className="tabular-nums text-amber-100">{formatDateSv(contract.effective_end_date)}</b>.
                Fakturering och schemaläggning fortsätter till dess.
              </span>
              <span className="ml-auto shrink-0 text-right">
                <span
                  className={`block text-[15px] tabular-nums leading-none font-bold ${
                    urgent ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {left === 0 ? 'Idag' : left}
                </span>
                <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  {left === 0 ? 'sista dagen' : 'dagar kvar'}
                </span>
              </span>
            </div>
          )
        })()}

        {/* Faktarader som definitionslista — etiketten i fast bredd gör att
            flera kort under varandra bildar kolumner */}
        {!compact && (
          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="w-[68px] shrink-0 text-slate-600 uppercase tracking-wider text-[10px] pt-px">
                Löper
              </dt>
              <dd className="text-slate-300 tabular-nums min-w-0">
                {startDate ? formatDateSv(startDate) : '–'} →{' '}
                {contract.contract_end_date ? formatDateSv(contract.contract_end_date) : 'tills vidare'}
                {contract.notice_period_months != null && (
                  <span className="text-slate-500"> · uppsägning {contract.notice_period_months} mån</span>
                )}
                {contract.contract_length && (
                  <span className="text-slate-500"> · {contract.contract_length}</span>
                )}
              </dd>
            </div>
          </dl>
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
