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
import type { CaseBillingItemWithRelations, CaseServiceSummary } from '../../../../types/caseBilling'
import type { PricingSettings } from '../../../../types/pricingSettings'
import { formatKr } from '../../../../hooks/useCustomerRecord'

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
          CaseBillingService.getCaseServiceSummary(contractId, 'contract', settings.min_margin_percent),
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
}

/**
 * § 4 Tjänster i avtalet + § 5 Marginal, renderade som paragrafer på
 * avtalsdokumentet. Artiklarna visas som indragna kostnadsrader under den
 * tjänst de hör till — de är interna och når aldrig kunden.
 */
export default function ContractContentSection({ content, loading, onEdit }: Props) {
  const { services, articles, summary, settings } = content

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

  const margin = summary?.margin_percent ?? null
  const revenue = summary?.services.subtotal ?? 0
  const cost = summary?.articles.total_purchase_cost ?? 0

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
              const svcCost = svcArticles.reduce((sum, a) => sum + Number(a.total_price ?? 0), 0)
              const svcRevenue = Number(svc.total_price ?? 0)
              const svcMargin = svcRevenue > 0 ? ((svcRevenue - svcCost) / svcRevenue) * 100 : null
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
                          <span className="flex-1" />
                          <span className="tabular-nums shrink-0">−{formatKr(Number(art.total_price ?? 0))}</span>
                        </div>
                      ))}
                      {svcMargin !== null && (
                        <div className="flex items-center gap-2 font-sans text-[10.5px] pt-0.5">
                          <span className="flex-1" />
                          <span className="tabular-nums" style={{ color: marginInk(svcMargin, settings) }}>
                            {svcMargin.toFixed(1)} % marginal
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

      {/* § 5 Marginal — bara när det finns tjänster att räkna på */}
      {!loading && services.length > 0 && summary && (
        <div className="mt-3.5">
          <div className="border-b-[1.5px] border-[#262e38] pb-1">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 5 · Marginal</h4>
          </div>
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
              style={{ color: marginInk(margin, settings) }}
            >
              {margin !== null ? `${margin.toFixed(1)} %` : '–'}
              <span className="text-[10.5px] font-normal text-[#8a9099]"> marginal</span>
            </span>
          </div>
          {margin !== null && settings && margin < settings.min_margin_percent && (
            <div
              className="mt-1.5 font-sans text-[11px] px-2.5 py-1.5 rounded"
              style={{ background: 'rgba(155,53,53,.08)', color: '#9b3535' }}
            >
              Under lägsta marginal ({settings.min_margin_percent} %) — se över priser eller kostnader.
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
