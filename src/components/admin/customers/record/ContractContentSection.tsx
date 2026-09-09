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
import { Loader2 } from 'lucide-react'
import { CaseBillingService } from '../../../../services/caseBillingService'
import { PricingSettingsService } from '../../../../services/pricingSettingsService'
import type {
  CaseBillingItemWithRelations,
  CaseServiceSummary,
  AccumulatedCaseSummary,
} from '../../../../types/caseBilling'
import type { PricingSettings } from '../../../../types/pricingSettings'
import { formatKr } from '../../../../hooks/useCustomerRecord'
import { formatPayback, summarizeBillingLines } from '../../../../shared/marginEngine'
import { resolvePremiumShares } from '../../../../shared/premiumShares'
import { PAPER_GEAR_CLASS } from './paperInk'

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
  /** Kugghjulet: öppna inställningspanelen på Innehåll och utrustning */
  onOpenSettings?: () => void
  /**
   * Avropsavtal: § 5 visar ackumulerat utfall från avtalets ärenden i stället
   * för avtalsinnehållet (som är 0 kr på avrop). Sätts av avtalskartan.
   */
  accumulated?: AccumulatedCaseSummary | null
  accumulatedLoading?: boolean
  showAccumulated?: boolean
  /**
   * Årspremien som gäller nu (§ 7). § 4-radernas belopp är andelar av den,
   * aldrig lagrade priser. Null eller 0 = premie saknas, 4.1 visar "— kr".
   */
  annualInForce?: number | null
  /** Kugghjulet på § 7: "premie saknas" på 4.1 leder dit */
  onOpenPremium?: () => void
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
  onOpenSettings,
  accumulated,
  accumulatedLoading,
  showAccumulated,
  annualInForce = null,
  onOpenPremium,
}: Props) {
  const { services: allServices, articles, summary, settings } = content
  // § 4 visar det som ingår i premien. Rader med annat faktureringsläge
  // (per styck och år, per kontrollrunda) bor i § 6 Utrustning. Bärande
  // raden (avtalstypen) först: den är restposten av premien.
  const services = allServices
    .filter((s) => {
      const m = (s as unknown as { billing_model?: string | null }).billing_model
      return !m || m === 'premium'
    })
    .sort((a, b) => Number(!!b.is_premium_carrier) - Number(!!a.is_premium_carrier))
  const shareResult = resolvePremiumShares(services)
  const premium = annualInForce != null && annualInForce > 0 ? annualInForce : null
  const amountOf = (id: string) => (premium == null ? null : Math.round(premium * (shareResult.shares.get(id) ?? 0) * 100) / 100)
  const allocated = services.reduce((s, svc) => s + (amountOf(svc.id) ?? 0), 0)
  // Rader med lagrat pris men utan andel: priset räknas inte längre, granska
  const stalePriced = services.filter((s) => !s.is_premium_carrier && Number(s.total_price ?? 0) > 0 && !(Number(s.premium_share ?? 0) > 0))

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

  return (
    <>
      {/* § 4 Tjänster i avtalet */}
      <div className="mt-3.5 group/para">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 4 · Tjänster i avtalet</h4>
          {onOpenSettings && (
            <button type="button" onClick={onOpenSettings} className={PAPER_GEAR_CLASS} style={{ borderColor: '#d9d3c2', color: '#8a9099' }} title="Inställningar för innehåll och utrustning" aria-label="Inställningar för innehåll och utrustning">
              ⚙
            </button>
          )}
          <span className="ml-auto font-sans text-[10.5px] text-[#8a9099] tabular-nums">
            {loading ? '…' : `${services.length} tjänst${services.length === 1 ? '' : 'er'}${shareResult.carrierId ? ' · täcks av § 7' : ''}`}
          </span>
        </div>
        <div className="font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a9099] mt-1.5">
          Ingår i premien · kunden betalar inget per ärende
        </div>
        {!loading && services.length > 0 && (
          <div className="flex justify-between font-sans text-[9px] uppercase tracking-[0.12em] text-[#8a9099] mt-1.5 mb-0.5">
            <span>Tjänst</span>
            <span>Andel av premien</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-3 font-sans text-[12px] text-[#8a9099]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Hämtar avtalsinnehåll…
          </div>
        ) : services.length === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <span className="font-sans text-[12.5px] italic text-[#8a9099]">
              Inga tjänster registrerade.
              {(onOpenSettings ?? onEdit) && (
                <>
                  {' '}
                  <button type="button" onClick={onOpenSettings ?? onEdit} className="not-italic text-[11px] underline decoration-dotted text-[#b45309]">
                    lägg till under Innehåll
                  </button>
                </>
              )}
            </span>
          </div>
        ) : (
          <>
            {services.map((svc, i) => {
              const svcArticles = articlesByService.get(svc.id) ?? []
              const isCarrier = !!svc.is_premium_carrier
              const share = shareResult.shares.get(svc.id) ?? 0
              const svcRevenue = amountOf(svc.id)
              // Marginal per rad mot radens andel av premien, inte mot lagrat pris
              const svcBreakdown = summarizeBillingLines([svc, ...svcArticles], { context: 'contract', revenueOverride: svcRevenue ?? 0 })
              const svcMargin = svcRevenue != null && svcRevenue > 0 ? svcBreakdown.headline_percent : null
              const qualifier = isCarrier
                ? premium == null
                  ? 'premie saknas i § 7'
                  : share >= 0.999
                    ? 'hela premien'
                    : 'andel av premien'
                : share > 0
                  ? 'andel av premien'
                  : 'ingår'
              const warn = isCarrier && premium == null
              return (
                <div key={svc.id} className="border-b border-dotted border-[#d9d3c2] py-2">
                  <div className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">4.{i + 1}</span>
                    <span className="font-semibold text-[#262e38] truncate">
                      {svc.service_name || svc.article_name}
                    </span>
                    {Number(svc.quantity ?? 1) !== 1 && !isCarrier && (
                      <span className="font-sans text-[11px] text-[#8a9099] shrink-0">
                        × {Number(svc.quantity)}
                      </span>
                    )}
                    <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                    {warn && onOpenPremium ? (
                      <button type="button" onClick={onOpenPremium} className="font-sans text-[11px] underline decoration-dotted shrink-0" style={{ color: '#b45309' }}>
                        {qualifier} →
                      </button>
                    ) : (
                      <span className="font-sans text-[11px] shrink-0" style={{ color: warn ? '#b45309' : '#8a9099' }}>{qualifier}</span>
                    )}
                    <span className="tabular-nums whitespace-nowrap shrink-0" style={{ color: warn ? '#b45309' : '#262e38' }}>
                      {svcRevenue == null ? (isCarrier ? '— kr' : '0 kr') : formatKr(svcRevenue)}
                      {isCarrier && <span className="font-sans text-[10px] text-[#8a9099] ml-1" title="Beloppet följer § 7.1 och går inte att skriva i">🔒</span>}
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

            {/* Summeringsrad: § 4 ska stämma mot 7.1. Avvikelsen står här, inte i en text. */}
            {premium != null && (
              <div className="flex justify-end items-baseline gap-2 pt-1.5 font-sans text-[11.5px] text-[#5d6672]">
                <span>Summa fördelad premie</span>
                <b className="tabular-nums" style={{ color: Math.abs(allocated - premium) < 1 && !shareResult.overAllocated ? '#157a5b' : '#b45309' }}>
                  {formatKr(allocated)}
                </b>
                {Math.abs(allocated - premium) < 1 && !shareResult.overAllocated ? (
                  <span className="text-[#8a9099]">= 7.1</span>
                ) : (
                  <span style={{ color: '#b45309' }}>({shareResult.overAllocated ? 'överfördelat' : `av ${formatKr(premium)}`})</span>
                )}
              </div>
            )}
            {shareResult.carrierBelowTenPercent && (
              <div className="font-sans text-[11px] text-right" style={{ color: '#b45309' }}>
                4.1 under tio procent av premien: kontrollera de andra radernas andelar.
              </div>
            )}
            {stalePriced.length > 0 && (
              <div className="font-sans text-[11px] text-right" style={{ color: '#b45309' }}>
                {stalePriced.length} rad{stalePriced.length === 1 ? '' : 'er'} har ett gammalt pris som inte längre räknas. Sätt andel under Innehåll eller lämna som ingår.
              </div>
            )}

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

      {/* § 5 Marginal: två rader på pappret, hela uppdelningen i pulsen.
          Avtalen är rullande, så utrustningen (fällor, stationer) är en
          engångsutgift mot en återkommande intäkt och får aldrig dras från
          ett enda års avtalsvärde som om den förbrukades. Villkoret räknar
          alla tjänsterader: ett avtal med enbart tillägg har också marginal. */}
      {!showAccumulated && !loading && allServices.length > 0 && summary && b && (
        <div className="mt-3.5 group/para">
          <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 5 · Marginal</h4>
            <span className="ml-auto font-sans text-[10.5px] text-[#8a9099]">detaljer i pulsen</span>
          </div>
          <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted border-[#d9d3c2] text-[13.5px]">
            <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">5.1</span>
            <span className="font-semibold text-[#262e38]">{b.headline_label}</span>
            <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-[-3px] min-w-4" />
            {b.labour_missing ? (
              <span className="font-sans text-[12px] whitespace-nowrap" style={{ color: '#9b3535' }}>
                arbetstid saknas
                {onOpenSettings && (
                  <>
                    {' · '}
                    <button type="button" onClick={onOpenSettings} className="underline decoration-dotted">lägg in under Innehåll</button>
                  </>
                )}
              </span>
            ) : (
              <span className="font-sans text-[13px] font-bold tabular-nums whitespace-nowrap" style={{ color: marginInk(margin, settings) }}>
                {margin !== null ? `${margin.toFixed(1)} %` : '–'}
                <span className="text-[10.5px] font-normal text-[#8a9099]"> · täckningsbidrag {formatKr(b.contribution_ongoing)}/år</span>
              </span>
            )}
          </div>
          {b.cost_durable > 0 && (
            <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted border-[#d9d3c2] text-[13.5px]">
              <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">5.2</span>
              <span className="font-semibold text-[#262e38] truncate">
                Varaktig utrustning, engångs
                <span className="font-normal font-sans text-[11.5px] ml-1.5 text-[#5d6672]">
                  {b.payback_never ? 'återbetalas inte med nuvarande löpande kostnad' : `återbetald efter ${formatPayback(b.payback_years)}`}
                </span>
              </span>
              <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-[-3px] min-w-4" />
              <span className="font-sans text-[12.5px] tabular-nums whitespace-nowrap text-[#262e38]">−{formatKr(b.cost_durable)}</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
