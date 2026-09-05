// src/components/admin/customers/record/ContractContentSection.tsx
// § 4 Tjänster i avtalet + § 5 Marginal på avtalsdokumentet i Avtalskartan.
//
// Datamodellen är den befintliga: case_billing_items med case_type='contract'
// och case_id = contracts.id. Tjänsterader (item_type='service') är vad kunden
// får, artikelrader (item_type='article') är vår interna kostnad, kopplade till
// sin tjänst via mapped_service_id. Marginalen kommer från samma funktion som
// ärendena använder — ingen egen uträkning här.
//
// Läsvy på pappret; redigering sker i modal via ContractCaseServiceSelector
// (samma editor som Oneflow-wizarden och BillingSettingsModal).

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { CaseBillingService } from '../../../../services/caseBillingService'
import { PricingSettingsService } from '../../../../services/pricingSettingsService'
import type {
  CaseBillingItemWithRelations,
  CaseServiceSummary,
  AccumulatedCaseSummary,
} from '../../../../types/caseBilling'
import type { PricingSettings } from '../../../../types/pricingSettings'
import { formatKr } from '../../../../hooks/useCustomerRecord'
import { formatPayback, paybackTone, summarizeBillingLines } from '../../../../shared/marginEngine'

export interface ContractContent {
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
  summary: CaseServiceSummary | null
  settings: PricingSettings | null
}

const EMPTY: ContractContent = { services: [], articles: [], summary: null, settings: null }

/** Hämtar avtalets tjänster, interna artiklar och marginalsummering. */
export function useContractContent(contractId: string | null, reloadKey = 0) {
  const [content, setContent] = useState<ContractContent>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!contractId) {
      setContent(EMPTY)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const settings = await PricingSettingsService.get()
        if (cancelled) return
        const [items, summary] = await Promise.all([
          CaseBillingService.getCaseBillingItems(contractId, 'contract', 'all'),
          CaseBillingService.getContractMarginSummary(contractId, settings.min_margin_percent, settings),
        ])
        if (cancelled) return
        setContent({
          services: items.filter((i) => i.item_type === 'service'),
          articles: items.filter((i) => i.item_type === 'article'),
          summary,
          settings,
        })
      } catch (err) {
        console.error('Kunde inte hämta avtalsinnehåll:', err)
        if (!cancelled) setContent(EMPTY)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contractId, reloadKey])

  return { content, loading }
}

/**
 * Ackumulerat utfall från avtalets ärenden — § 5 på avropsavtal. Hämtar
 * faktureringsraderna för ALLA ärenden som hör till avtalet (samma ärendemängd
 * som § 3 Uppföljning räknar) och summerar dem med ärendemodalens prisregler.
 * Ärenden från gamla systemet saknar rader och bidrar med noll — avsiktligt.
 */
export function useAccumulatedCaseOutcome(caseIds: string[] | null, reloadKey = 0) {
  const [summary, setSummary] = useState<AccumulatedCaseSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const idsKey = caseIds ? caseIds.slice().sort().join(',') : ''

  useEffect(() => {
    if (!caseIds || caseIds.length === 0) {
      setSummary(null)
      return
    }
    let cancelled = false
    setLoading(true)
    CaseBillingService.getAccumulatedSummaryForCases(caseIds)
      .then((s) => { if (!cancelled) setSummary(s) })
      .catch((err) => {
        console.error('Kunde inte ackumulera ärendenas faktureringsrader:', err)
        if (!cancelled) setSummary(null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // idsKey representerar caseIds-innehållet — arrayreferensen byts varje render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, reloadKey])

  return { summary, loading }
}

/** Marginalfärg på papper (mörkare toner än portalens — ljus bakgrund) */
function marginInk(margin: number | null, settings: PricingSettings | null): string {
  if (margin === null) return '#5d6672'
  const target = settings?.target_margin_percent ?? 35
  const min = settings?.min_margin_percent ?? 20
  if (margin >= target) return '#157a5b'
  if (margin >= min) return '#b45309'
  return '#9b3535'
}

interface Props {
  content: ContractContent
  loading: boolean
  /**
   * Öppna redigeringsmodalen. Utelämnas på arkiverade avtal — innehållet i ett
   * avslutat avtal ska stå som det stod när avtalet gällde.
   */
  onEdit?: () => void
  /**
   * Avropsavtal: § 5 visar ackumulerat utfall från avtalets ärenden i stället
   * för avtalsinnehållet (som är 0 kr på avrop). Sätts av avtalskartan.
   */
  accumulated?: AccumulatedCaseSummary | null
  accumulatedLoading?: boolean
  showAccumulated?: boolean
}

/**
 * § 4 Tjänster i avtalet + § 5 Marginal, renderade som paragrafer på
 * avtalsdokumentet. Artiklarna visas som indragna kostnadsrader under den
 * tjänst de hör till — de är interna och når aldrig kunden.
 */
export default function ContractContentSection({
  content,
  loading,
  onEdit,
  accumulated,
  accumulatedLoading,
  showAccumulated,
}: Props) {
  const { services: allServices, articles, summary, settings } = content
  // § 4 visar det som ingår i premien. Rader med annat faktureringsläge
  // (per styck och år, per kontrollrunda) bor i § 6 Utrustning.
  const services = allServices.filter((s) => {
    const m = (s as unknown as { billing_model?: string | null }).billing_model
    return !m || m === 'premium'
  })

  // Artiklar grupperade per tjänsterad (mapped_service_id → tjänstens item-id)
  const articlesByService = new Map<string, CaseBillingItemWithRelations[]>()
  const unmappedArticles: CaseBillingItemWithRelations[] = []
  for (const art of articles) {
    if (art.mapped_service_id && services.some((s) => s.id === art.mapped_service_id)) {
      const list = articlesByService.get(art.mapped_service_id) ?? []
      list.push(art)
      articlesByService.set(art.mapped_service_id, list)
    } else {
      unmappedArticles.push(art)
    }
  }

  // Allt från motorn: revenue är årsintäkten (annual_value + tillägg), inte
  // radsumman, och huvudtalet är löpande marginal när avtalet bär varaktig
  // utrustning. Se docs/varaktig-utrustning-marginal-plan.md.
  const b = summary?.breakdown ?? null
  const margin = b?.headline_percent ?? null
  const revenue = b?.revenue ?? 0
  const cost = b?.cost_total ?? 0

  return (
    <>
      {/* § 4 Tjänster i avtalet */}
      <div className="mt-3.5">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 4 · Tjänster i avtalet</h4>
          <span className="ml-auto font-sans text-[10.5px] text-[#8a9099] tabular-nums">
            {loading ? '…' : `${services.length} tjänst${services.length === 1 ? '' : 'er'}`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-3 font-sans text-[12px] text-[#8a9099]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Hämtar avtalsinnehåll…
          </div>
        ) : services.length === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <span className="font-sans text-[12.5px] italic text-[#8a9099]">
              {onEdit
                ? 'Inga tjänster registrerade — lägg in vad kunden får och vad det kostar oss.'
                : 'Inga tjänster registrerade.'}
            </span>
            {onEdit && (
              <button
                onClick={onEdit}
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold text-[#5d6672] border border-[#d9d3c2] rounded-md px-2.5 py-1.5 bg-[#fff]/50 hover:text-[#262e38] transition-colors"
              >
                <Plus className="w-3 h-3" />
                Lägg till tjänster
              </button>
            )}
          </div>
        ) : (
          <>
            {services.map((svc, i) => {
              const svcArticles = articlesByService.get(svc.id) ?? []
              const svcRevenue = Number(svc.total_price ?? 0)
              const svcBreakdown = summarizeBillingLines([svc, ...svcArticles], { context: 'contract' })
              const svcMargin = svcBreakdown.headline_percent
              return (
                <div key={svc.id} className="border-b border-dotted border-[#d9d3c2] py-2">
                  <div className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">4.{i + 1}</span>
                    <span className="font-semibold text-[#262e38] truncate">
                      {svc.service_name || svc.article_name}
                    </span>
                    {Number(svc.quantity ?? 1) !== 1 && (
                      <span className="font-sans text-[11px] text-[#8a9099] shrink-0">
                        × {Number(svc.quantity)}
                      </span>
                    )}
                    <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                    <span className="tabular-nums text-[#262e38] whitespace-nowrap shrink-0">
                      {formatKr(svcRevenue)}
                    </span>
                  </div>
                  {/* Interna kostnadsrader — når aldrig kunden */}
                  {svcArticles.length > 0 && (
                    <div className="pl-8 pt-1 space-y-0.5">
                      {svcArticles.map((art) => (
                        <div
                          key={art.id}
                          className="flex items-center gap-2 font-sans text-[11px] text-[#8a9099]"
                        >
                          <span className="truncate">
                            {art.article_name}
                            {Number(art.quantity ?? 1) !== 1 && ` × ${Number(art.quantity)}`}
                          </span>
                          {art.article?.is_durable && (
                            <span className="text-[10px] uppercase tracking-[0.08em] shrink-0">varaktig</span>
                          )}
                          <span className="flex-1" />
                          <span className="tabular-nums shrink-0">−{formatKr(Number(art.total_price ?? 0))}</span>
                        </div>
                      ))}
                      {svcMargin !== null && (
                        <div className="flex items-center gap-2 font-sans text-[10.5px] pt-0.5">
                          <span className="flex-1" />
                          <span className="tabular-nums" style={{ color: marginInk(svcMargin, settings) }}>
                            {svcMargin.toFixed(1)} % {svcBreakdown.headline_label.toLowerCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {unmappedArticles.length > 0 && (
              <div className="pt-2 pl-8 space-y-0.5">
                <div className="font-sans text-[10px] uppercase tracking-wider text-[#8a9099] mb-0.5">
                  Övriga interna kostnader
                </div>
                {unmappedArticles.map((art) => (
                  <div key={art.id} className="flex items-center gap-2 font-sans text-[11px] text-[#8a9099]">
                    <span className="truncate">
                      {art.article_name}
                      {Number(art.quantity ?? 1) !== 1 && ` × ${Number(art.quantity)}`}
                    </span>
                    <span className="flex-1" />
                    <span className="tabular-nums shrink-0">−{formatKr(Number(art.total_price ?? 0))}</span>
                  </div>
                ))}
              </div>
            )}

            {onEdit && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold text-[#5d6672] border border-[#d9d3c2] rounded-md px-2.5 py-1.5 bg-[#fff]/50 hover:text-[#262e38] transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Redigera innehåll
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* § 5 Marginal — avropsavtal: ackumulerat utfall från avtalets ärenden */}
      {showAccumulated && (
        <div className="mt-3.5">
          <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">
              § 5 · Marginal — ackumulerat från ärenden
            </h4>
            <span className="ml-auto font-sans text-[10.5px] text-[#8a9099] tabular-nums">
              {accumulatedLoading ? '…' : accumulated ? `${accumulated.case_count} ärenden` : ''}
            </span>
          </div>

          {accumulatedLoading ? (
            <div className="flex items-center gap-2 py-3 font-sans text-[12px] text-[#8a9099]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Summerar ärendenas faktureringsrader…
            </div>
          ) : !accumulated || (accumulated.groups.length === 0 && accumulated.unmapped_articles.length === 0) ? (
            <p className="py-3 font-sans text-[12.5px] italic text-[#8a9099]">
              Inga faktureringsrader från ärenden ännu — fylls på när ärenden prissätts i ärendemodalen.
            </p>
          ) : (
            <>
              {accumulated.groups.map((g, i) => (
                <div key={g.service_name} className="border-b border-dotted border-[#d9d3c2] py-2">
                  <div className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">5.{i + 1}</span>
                    <span className="font-semibold text-[#262e38] truncate">{g.service_name}</span>
                    {g.occurrences !== 1 && (
                      <span className="font-sans text-[11px] text-[#8a9099] shrink-0">× {g.occurrences}</span>
                    )}
                    <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                    <span className="tabular-nums text-[#262e38] whitespace-nowrap shrink-0">
                      {formatKr(g.revenue)}
                    </span>
                  </div>
                  {g.articles.length > 0 && (
                    <div className="pl-8 pt-1 space-y-0.5">
                      {g.articles.map((a) => (
                        <div key={a.article_name} className="flex items-center gap-2 font-sans text-[11px] text-[#8a9099]">
                          <span className="truncate">
                            {a.article_name}
                            {a.quantity !== 1 && ` × ${a.quantity}`}
                          </span>
                          {a.is_durable && (
                            <span className="text-[10px] uppercase tracking-[0.08em] shrink-0">varaktig</span>
                          )}
                          <span className="flex-1" />
                          <span className="tabular-nums shrink-0">−{formatKr(a.cost)}</span>
                        </div>
                      ))}
                      {g.breakdown.headline_percent !== null && (
                        <div className="flex items-center gap-2 font-sans text-[10.5px] pt-0.5">
                          <span className="flex-1" />
                          <span className="tabular-nums" style={{ color: marginInk(g.breakdown.headline_percent, settings) }}>
                            {g.breakdown.headline_percent.toFixed(1)} % {g.breakdown.headline_label.toLowerCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {accumulated.unmapped_articles.length > 0 && (
                <div className="pt-2 pl-8 space-y-0.5">
                  <div className="font-sans text-[10px] uppercase tracking-wider text-[#8a9099] mb-0.5">
                    Övriga interna kostnader
                  </div>
                  {accumulated.unmapped_articles.map((a) => (
                    <div key={a.article_name} className="flex items-center gap-2 font-sans text-[11px] text-[#8a9099]">
                      <span className="truncate">
                        {a.article_name}
                        {a.quantity !== 1 && ` × ${a.quantity}`}
                      </span>
                      <span className="flex-1" />
                      <span className="tabular-nums shrink-0">−{formatKr(a.cost)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-2 font-sans">
                <span className="text-[12px] text-[#5d6672]">
                  Fakturerat värde{' '}
                  <b className="text-[13px] text-[#262e38] tabular-nums">{formatKr(accumulated.breakdown.revenue)}</b>
                </span>
                <span className="text-[12px] text-[#5d6672]">
                  {accumulated.breakdown.cost_durable > 0 ? 'Löpande kostnad' : 'Vår kostnad'}{' '}
                  <b className="text-[13px] text-[#262e38] tabular-nums">{formatKr(accumulated.breakdown.cost_ongoing)}</b>
                </span>
                {accumulated.breakdown.cost_durable > 0 && (
                  <span className="text-[12px] text-[#5d6672]">
                    Varaktig utrustning{' '}
                    <b className="text-[13px] text-[#262e38] tabular-nums">{formatKr(accumulated.breakdown.cost_durable)}</b>
                  </span>
                )}
                <span className="text-[12px] text-[#5d6672]">
                  Täckningsbidrag{' '}
                  <b
                    className="text-[13px] tabular-nums"
                    style={{ color: marginInk(accumulated.breakdown.headline_percent, settings) }}
                  >
                    {formatKr(accumulated.breakdown.contribution_ongoing)}
                  </b>
                </span>
                <span
                  className="ml-auto text-[15px] font-bold tabular-nums"
                  style={{ color: marginInk(accumulated.breakdown.headline_percent, settings) }}
                >
                  {accumulated.breakdown.headline_percent !== null ? `${accumulated.breakdown.headline_percent.toFixed(1)} %` : '–'}
                  <span className="text-[10.5px] font-normal text-[#8a9099]"> {accumulated.breakdown.headline_label.toLowerCase()}</span>
                </span>
              </div>
            </>
          )}
          <p className="mt-1 font-sans text-[10.5px] italic text-[#8a9099]">
            Ackumulerat från avtalets ärenden, prissatta i ärendemodalen. Ärenden från gamla
            systemet utan faktureringsrader ingår inte.
          </p>
        </div>
      )}

      {/* § 5 Marginal. Villkoret räknar alla tjänsterader, inte bara premien:
          ett avtal med enbart tilläggsstationer ska också ha en marginal. */}
      {!showAccumulated && !loading && allServices.length > 0 && summary && b && (
        <div className="mt-3.5">
          <div className="border-b-[1.5px] border-[#262e38] pb-1">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 5 · Marginal</h4>
          </div>
          {b.cost_durable > 0 ? (
            <>
              {/* Ledger i § 4/§ 6-rytmen. Fällor och stationer står kvar hos
                  kunden i flera år: en engångsutgift mot en återkommande intäkt,
                  som aldrig får dras från ett enda års avtalsvärde som om den
                  förbrukades. Avtalen är rullande, så det finns ingen avtalstid
                  att fördela över; i stället visas hur fort den betalar sig. */}
              <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted border-[#d9d3c2] text-[13.5px]">
                <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">5.1</span>
                <span className="font-semibold text-[#262e38]">Avtalsvärde per år</span>
                <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                <span className="tabular-nums text-[#262e38] whitespace-nowrap shrink-0">{formatKr(b.revenue)}</span>
              </div>
              <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted border-[#d9d3c2] text-[13.5px]">
                <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">5.2</span>
                <span className="font-semibold text-[#262e38] truncate">
                  Löpande kostnad per år
                  <span className="font-normal font-sans text-[11.5px] ml-1.5 text-[#5d6672]">
                    {[
                      b.labour_cost > 0 && `arbetstid ${formatKr(b.labour_cost)}`,
                      b.consumable_cost > 0 && `förbrukning ${formatKr(b.consumable_cost)}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                <span className="tabular-nums text-[#262e38] whitespace-nowrap shrink-0">−{formatKr(b.cost_ongoing)}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-2 font-sans">
                <span className="text-[12px] text-[#5d6672]">
                  Täckningsbidrag per år{' '}
                  <b className="text-[13px] text-[#262e38] tabular-nums">{formatKr(b.contribution_ongoing)}</b>
                </span>
                <span
                  className="ml-auto text-[15px] font-bold tabular-nums"
                  style={{ color: b.labour_missing ? '#9b3535' : marginInk(b.margin_percent_ongoing, settings) }}
                >
                  {b.labour_missing
                    ? 'arbetstid saknas'
                    : b.margin_percent_ongoing !== null ? `${b.margin_percent_ongoing.toFixed(1)} %` : '–'}
                  <span className="text-[10.5px] font-normal text-[#8a9099]"> löpande marginal</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 py-1.5 mt-1.5 border-t border-b border-dotted border-[#d9d3c2] text-[13.5px]">
                <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">5.3</span>
                <span className="font-semibold text-[#262e38] truncate">
                  Varaktig utrustning, engångs
                  <span className="font-normal font-sans text-[11.5px] ml-1.5 text-[#5d6672]">
                    {b.durable_lines
                      .map((l) => `${l.article_name}${l.quantity !== 1 ? ` × ${l.quantity}` : ''}`)
                      .join(' · ')}
                  </span>
                </span>
                <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                <span className="tabular-nums text-[#262e38] whitespace-nowrap shrink-0">−{formatKr(b.cost_durable)}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 pt-1.5 pl-8 font-sans text-[11px] text-[#8a9099]">
                {b.payback_never ? (
                  <span style={{ color: '#9b3535' }}>Återbetalas inte med nuvarande löpande kostnad</span>
                ) : (
                  <span>
                    Återbetald efter{' '}
                    <b
                      className="tabular-nums"
                      style={{ color: paybackTone(b, settings) === 'bad' ? '#9b3535' : '#5d6672' }}
                    >
                      {formatPayback(b.payback_years)}
                    </b>
                  </span>
                )}
                {b.margin_percent_3y !== null && (
                  <span>
                    Över tre år <b className="tabular-nums text-[#5d6672]">{b.margin_percent_3y.toFixed(1)} %</b>
                  </span>
                )}
                <span className="ml-auto">
                  År 1{' '}
                  <b className="tabular-nums">
                    {b.margin_percent_year1 !== null ? `${b.margin_percent_year1.toFixed(1)} %` : '–'}
                  </b>{' '}
                  marginal
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-2 font-sans">
              <span className="text-[12px] text-[#5d6672]">
                Avtalsvärde{' '}
                <b className="text-[13px] text-[#262e38] tabular-nums">{formatKr(revenue)}</b>
              </span>
              <span className="text-[12px] text-[#5d6672]">
                Vår kostnad{' '}
                <b className="text-[13px] text-[#262e38] tabular-nums">{formatKr(cost)}</b>
              </span>
              <span className="text-[12px] text-[#5d6672]">
                Täckningsbidrag{' '}
                <b className="text-[13px] tabular-nums" style={{ color: marginInk(margin, settings) }}>
                  {formatKr(revenue - cost)}
                </b>
              </span>
              <span
                className="ml-auto text-[15px] font-bold tabular-nums"
                style={{ color: b.labour_missing ? '#9b3535' : marginInk(margin, settings) }}
              >
                {b.labour_missing ? 'arbetstid saknas' : margin !== null ? `${margin.toFixed(1)} %` : '–'}
                <span className="text-[10.5px] font-normal text-[#8a9099]"> marginal</span>
              </span>
            </div>
          )}
          {!b.labour_missing && margin !== null && settings && margin < settings.min_margin_percent && (
            <div
              className="mt-1.5 font-sans text-[11px] px-2.5 py-1.5 rounded"
              style={{ background: 'rgba(155,53,53,.08)', color: '#9b3535' }}
            >
              Under lägsta marginal ({settings.min_margin_percent} %) — se över priser eller kostnader.
            </div>
          )}
          {b.labour_missing && (
            <div
              className="mt-1.5 font-sans text-[11px] px-2.5 py-1.5 rounded"
              style={{ background: 'rgba(155,53,53,.08)', color: '#9b3535' }}
            >
              Arbetstiden på avtalet täcker inte besöken ({b.labour_hours} h för avtalets besök). Lägg in
              årets arbetstid som intern kostnad, annars säger marginalen inget.
            </div>
          )}
          {!b.payback_never && paybackTone(b, settings) === 'bad' && settings && (
            <div
              className="mt-1.5 font-sans text-[11px] px-2.5 py-1.5 rounded"
              style={{ background: 'rgba(180,83,9,.08)', color: '#b45309' }}
            >
              Utrustningen tar över {settings.max_payback_years} år att tjäna in — se över årspriset.
            </div>
          )}
          {articles.length === 0 && (
            <p className="mt-1 font-sans text-[10.5px] italic text-[#8a9099]">
              Inga interna kostnader registrerade — marginalen visar hela avtalsvärdet.
            </p>
          )}
        </div>
      )}
    </>
  )
}
