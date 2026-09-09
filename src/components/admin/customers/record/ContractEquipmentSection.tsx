// src/components/admin/customers/record/ContractEquipmentSection.tsx
// § 6 Utrustning i avtalet på avtalspappret i Avtalskartan.
//
// Ingen ny datamängd: utrustningen är avtalsinnehållets rader
// (case_billing_items, case_type = contract). Tjänsteraderna bär
// faktureringsläget (premium, per_year, per_month, per_round), artikelraderna
// är den interna kostnaden som § 5 räknar marginal på.
//
// EN RAD PER STATIONSTYP OCH ENHET. Stationstypen (Ljusfälla, 2 st, 1 686 kr)
// och dess produkt (PW Titan 300, kostnad 4 838) är samma sak sedd från två
// håll, så produkten är en underrad under sin stationstyp, inte en egen rad i
// en egen grupp. Faktureringsläget står som suffix på beloppet och byts i
// inställningspanelen, inte i en select på pappret. Enheten är en rubrik, inte
// ett suffix på varje rad. Se artifacten "Avtalskartan i tre lager".

import type { CaseBillingItemWithRelations } from '../../../../types/caseBilling'
import { formatDateSv, formatKr } from '../../../../hooks/useCustomerRecord'
import { PAPER_GEAR_CLASS, type PaperInk } from './paperInk'
import type { AddonBrick } from '../../../../types/addonStations'
import { formatMonthYearSv, ledgerRowKey, type AddonLedger } from '../../../../shared/addonLedger'
import { FoldLink, FoldSummary, foldBodyClass, usePaperFold, useSeenRows } from './paperFold'

export type BillingModel = 'premium' | 'per_year' | 'per_month' | 'per_round'

export const MODEL_LABEL: Record<BillingModel, string> = {
  premium: 'ingår i premien',
  per_year: 'per styck och år',
  per_month: 'per styck och månad',
  per_round: 'per kontrollrunda',
}

export function billingModelOf(item: CaseBillingItemWithRelations): BillingModel {
  const m = (item as unknown as { billing_model?: string | null }).billing_model
  return m === 'per_year' || m === 'per_month' || m === 'per_round' ? m : 'premium'
}

export function siteOf(item: CaseBillingItemWithRelations): string | null {
  return (item as unknown as { site_customer_id?: string | null }).site_customer_id ?? null
}

/** Tilläggsrader (per år/månad/runda) med antal, synkade rader med 0 st göms */
export function equipmentRows(services: CaseBillingItemWithRelations[]): CaseBillingItemWithRelations[] {
  return services.filter((s) => {
    if (billingModelOf(s) === 'premium') return false
    return !(siteOf(s) && Number(s.quantity) === 0)
  })
}

/**
 * Artikelrader faktureras aldrig, så deras eget billing_model säger inget.
 * Vad de hör till avgörs av vad de är mappade mot: produkter för
 * tilläggsstationer (site_customer_id, eller mappade mot en per år/månad-
 * tjänsterad) hör till sin stationstyp, övriga ingår i premien.
 */
export function isAddonArticle(a: CaseBillingItemWithRelations, services: CaseBillingItemWithRelations[]): boolean {
  if (siteOf(a)) return true
  const mapped = a.mapped_service_id ? services.find((sv) => sv.id === a.mapped_service_id) : null
  return !!mapped && billingModelOf(mapped) !== 'premium'
}

interface Props {
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
  loading: boolean
  ink: PaperInk
  archived: boolean
  /** Öppna inställningspanelen på Innehåll och utrustning */
  onOpenSettings?: () => void
  /** Aktiva stationer (ute + inne) på avtalets enheter, ur utplaceringarna */
  stationCount?: { outdoor: number; indoor: number; addon: number } | null
  /** Tilläggsstationer per år/månad utan beslutat läge: brickor att dra till § 7 eller § 6 */
  bricks?: AddonBrick[]
  onBrickPointerDown?: (e: React.PointerEvent, brick: AddonBrick) => void
  /** Enhetens namn för § 6-rader som avser en enhet */
  unitNameOf?: (unitId: string) => string
  /** Var per år-rader faktureras (kundens läge) */
  equipmentInvoiceMode?: 'with_premium' | 'separate' | null
  /** Nästa tilläggsfaktura, från fakturaplanen */
  nextEquipmentInvoice?: { periodStart: string; subtotal: number; monthly: boolean } | null
  /** Resultat över tid per rad (enhet + stationstyp), ur stationerna */
  ledger?: AddonLedger | null
  /** Hopfällning: stängd tills något behöver beslutas eller rader ändrats */
  contractId?: string
  /** En bricka dras över § 6: öppna efter 400 ms */
  dragOver?: boolean
}

export default function ContractEquipmentSection({
  services,
  articles,
  loading,
  ink,
  archived,
  onOpenSettings,
  stationCount,
  bricks,
  onBrickPointerDown,
  unitNameOf,
  equipmentInvoiceMode,
  nextEquipmentInvoice,
  ledger = null,
  contractId,
  dragOver = false,
}: Props) {
  const extra = equipmentRows(services)
  // Hopfällning: stängd när det finns rader men inget att besluta. Brickor
  // eller nya/borttagna rader sedan senast sedd öppnar stycket, alltid.
  const hasBricks = !!bricks && bricks.length > 0
  // Premiens artiklar (arbetstid, förbrukning) visas bara i § 4 under
  // avtalsraden. § 6 är tilläggen: tjänsterader per år/månad/runda och
  // produkterna under dem. En siffra, ett ställe.
  const addonArticles = articles.filter((a) => isAddonArticle(a, services))
  const rowIds = [...extra.map((s) => s.id), ...addonArticles.map((a) => a.id)]
  const foldId = contractId ?? 'none'
  // Under laddning räknas stycket som hopfällt så att det inte hoppar
  const foldable = !!contractId && (loading || extra.length > 0)
  const rowsChanged = useSeenRows({ contractId: foldId, para: 'utrustning', ids: rowIds, ready: !!contractId && !loading }) && !!contractId
  const fold = usePaperFold({
    contractId: foldId,
    para: 'utrustning',
    closedByRule: foldable,
    forceOpen: hasBricks || rowsChanged,
    dragOver,
  })
  // Produkterna under sin stationstyp, via mapped_service_id
  const articlesByService = new Map<string, CaseBillingItemWithRelations[]>()
  for (const a of articles) {
    if (!isAddonArticle(a, services) || !a.mapped_service_id) continue
    const list = articlesByService.get(a.mapped_service_id) ?? []
    list.push(a)
    articlesByService.set(a.mapped_service_id, list)
  }
  // Tilläggsprodukter utan tjänsterad att hänga på (t.ex. rad borttagen): visas sist
  const strayAddonArticles = articles.filter(
    (a) => isAddonArticle(a, services) && !(a.mapped_service_id && extra.some((s) => s.id === a.mapped_service_id))
  )

  // Gruppera tilläggsraderna per enhet. Bara en enhet: ingen enhetsrubrik.
  const bySite = new Map<string, CaseBillingItemWithRelations[]>()
  for (const s of extra) {
    const key = siteOf(s) ?? ''
    bySite.set(key, [...(bySite.get(key) ?? []), s])
  }
  const siteKeys = Array.from(bySite.keys())
  const showSiteHeaders = siteKeys.length > 1

  const annualExtra = extra.reduce((s, it) => {
    const m = billingModelOf(it)
    return s + (m === 'per_year' ? Number(it.total_price) : m === 'per_month' ? Number(it.total_price) * 12 : 0)
  }, 0)
  const addonStationCount = extra.reduce((s, it) => s + Number(it.quantity ?? 0), 0)

  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }
  let rowNo = 0
  const nextNo = () => `6.${++rowNo}`

  const modelSuffix = (m: BillingModel) => (m === 'per_year' ? '/år' : m === 'per_month' ? '/mån' : m === 'per_round' ? '/runda' : '')

  const renderAddonRow = (s: CaseBillingItemWithRelations) => {
    const model = billingModelOf(s)
    const products = articlesByService.get(s.id) ?? []
    const qty = Number(s.quantity ?? 0)
    return (
      <div key={s.id}>
        <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
          <span className="font-sans text-[10.5px] w-6 tabular-nums shrink-0" style={numStyle}>{nextNo()}</span>
          <span className="font-semibold truncate" style={{ color: ink.primary }}>
            {s.service_name ?? s.article_name}
            <span className="font-normal font-sans text-[11.5px] ml-1.5 tabular-nums" style={{ color: ink.secondary }}>
              {qty.toLocaleString('sv-SE')} st
            </span>
          </span>
          <span className="flex-1 border-b border-dotted translate-y-[-3px] min-w-3" style={rowStyle} />
          <span className="font-sans text-[12px] tabular-nums whitespace-nowrap shrink-0" style={{ color: ink.primary }}>
            {formatKr(Number(s.unit_price))}
            <span style={{ color: ink.muted }}>/st</span>
            {model !== 'per_round' && (
              <>
                <span style={{ color: ink.muted }}> · </span>
                <b>{formatKr(Number(s.total_price))}</b>
                <span style={{ color: ink.muted }}>{modelSuffix(model)}</span>
              </>
            )}
            {model === 'per_round' && <span style={{ color: ink.muted }}>/runda</span>}
          </span>
        </div>
        {products.map((p) => (
          <div key={p.id} className="flex items-baseline gap-2 pl-[2.1rem] py-0.5 font-sans text-[11px]" style={{ color: ink.muted }}>
            <span className="truncate">
              {p.article_name}
              {Number(p.quantity ?? 1) !== 1 ? ` × ${Number(p.quantity)}` : ''}
              {p.article?.is_durable && (
                <span className="ml-1.5 text-[10px] uppercase tracking-[0.08em]" title="Står kvar hos kunden i flera år: engångskostnad i marginalen, inte löpande">
                  varaktig
                </span>
              )}
            </span>
            <span className="flex-1" />
            <span className="tabular-nums shrink-0">−{formatKr(Number(p.total_price))}</span>
          </div>
        ))}
        {(() => {
          // Resultatet över avtalsperioden för radens stationer, låst vid borttagning
          const site = siteOf(s)
          const typeId = (s as unknown as { station_type_id?: string | null }).station_type_id ?? null
          const lt = site && ledger ? ledger.byRow.get(ledgerRowKey(site, typeId)) : null
          if (!lt) return null
          const endTxt = ledger?.horizon.contractEnd ? new Date(ledger.horizon.contractEnd - 1).toISOString().slice(0, 10) : null
          const first = ledger?.stations.filter((x) => x.unitId === site && x.stationTypeId === typeId).reduce<number | null>((m, x) => (m == null || x.startAt < m ? x.startAt : m), null)
          const sign = (v: number) => `${v >= 0 ? '+' : '−'}${formatKr(Math.abs(v))}`
          return (
            <div className="flex items-baseline gap-2 pl-[2.1rem] py-0.5 font-sans text-[11px] tabular-nums" style={{ color: ink.muted }}>
              <span className="truncate">
                {first != null ? `satta ${formatDateSv(new Date(first).toISOString().slice(0, 10))}` : 'satta'}
                {lt.removed > 0 ? ` · ${lt.removed} borttagna` : ''} · brytpunkt {formatMonthYearSv(lt.breakEvenAt)}
              </span>
              <span className="flex-1" />
              <span className="shrink-0 whitespace-nowrap">
                hittills {sign(lt.resultToDate)}
                {endTxt && (
                  <>
                    {' · '}
                    <span style={{ color: lt.resultToEnd < 0 ? '#9b3535' : ink.positive }}>{sign(lt.resultToEnd)} till {endTxt}</span>
                  </>
                )}
              </span>
            </div>
          )
        })()}
      </div>
    )
  }

  const empty = !loading && extra.length === 0 && addonArticles.length === 0 && !(bricks && bricks.length > 0)

  return (
    <div className="mt-3.5 group/para">
      <div
        className={`flex items-baseline gap-2 border-b-[1.5px] pb-1 ${foldable ? 'cursor-pointer' : ''}`}
        style={{ borderColor: ink.primary }}
        onClick={foldable ? fold.onHeaderClick : undefined}
      >
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          § 6 · Utrustning i avtalet
        </h4>
        {onOpenSettings && !archived && (
          <button
            type="button"
            onClick={onOpenSettings}
            className={PAPER_GEAR_CLASS}
            style={{ borderColor: ink.rule, color: ink.muted }}
            title="Inställningar för innehåll och utrustning"
            aria-label="Inställningar för innehåll och utrustning"
          >
            ⚙
          </button>
        )}
        <span className="ml-auto font-sans text-[10.5px] tabular-nums" style={{ color: ink.muted }}>
          {loading ? 'hämtar' : annualExtra > 0 ? `${formatKr(annualExtra)}/år utöver premien` : extra.length > 0 ? `${extra.length} rader` : ''}
          {foldable && !loading && (
            <>
              {' · '}
              <FoldLink fold={fold} label={`visa ${extra.length} rader`} ink={ink} />
            </>
          )}
        </span>
      </div>

      {foldable && !loading && !fold.open && (
        <FoldSummary onClick={fold.toggle} ink={ink}>
          {extra.length} tilläggsrad{extra.length === 1 ? '' : 'er'} på {siteKeys.filter((k) => k).length || 1} enhet{siteKeys.filter((k) => k).length === 1 ? '' : 'er'}
          {addonStationCount > 0 ? ` · ${addonStationCount} stationer` : ''}
        </FoldSummary>
      )}

      <div className={foldBodyClass(!foldable || fold.open)}>
      {empty ? (
        <p className="font-serif text-[12.5px] italic py-2" style={{ color: ink.muted }}>
          Ingen utrustning i avtalet.
          {onOpenSettings && !archived && (
            <>
              {' '}
              <button type="button" onClick={onOpenSettings} className="font-sans not-italic text-[11px] underline decoration-dotted" style={{ color: ink.warn }}>
                lägg till under Innehåll
              </button>
            </>
          )}
        </p>
      ) : (
        <>
          {/* Brickor: tilläggsstationer som väntar på beslut. En rad, dragbar. */}
          {bricks && bricks.length > 0 && (
            <div className="mt-2 space-y-1">
              {bricks.map((b) => (
                <div
                  key={`${b.unitId}|${b.stationTypeId ?? ''}|${b.model}`}
                  onPointerDown={onBrickPointerDown && !archived ? (e) => onBrickPointerDown(e, b) : undefined}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border border-dashed font-sans text-[11.5px] select-none ${
                    onBrickPointerDown && !archived ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                  style={{ borderColor: ink.rule, color: ink.secondary, touchAction: 'none', background: 'rgba(255,255,255,.35)' }}
                  title="Dra till § 7 för att baka in i årspremien, eller till § 6 för tillägg utöver avtalet"
                >
                  <span className="tracking-[-2px]" style={{ color: ink.muted }}>⠿</span>
                  <span>
                    {b.count} st {b.stationTypeName} · {unitNameOf ? unitNameOf(b.unitId) : 'enhet'} · {b.model === 'per_month' ? 'per månad' : 'per år'}
                  </span>
                  {onOpenSettings && !archived && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onOpenSettings}
                      className="ml-auto text-[11px] underline decoration-dotted whitespace-nowrap"
                      style={{ color: ink.warn }}
                    >
                      att besluta →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tillägg utöver premien, per enhet */}
          {siteKeys.map((siteKey) => {
            const rows = bySite.get(siteKey) ?? []
            const count = rows.reduce((s, it) => s + Number(it.quantity ?? 0), 0)
            return (
              <div key={siteKey || 'all'}>
                {showSiteHeaders ? (
                  <div className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] pt-2.5 pb-0.5 flex" style={{ color: ink.muted }}>
                    {siteKey && unitNameOf ? unitNameOf(siteKey) : 'Tilläggsstationer'}
                    <span className="ml-auto font-normal normal-case tracking-normal text-[10.5px] tabular-nums">
                      {count} tilläggsstation{count === 1 ? '' : 'er'}
                    </span>
                  </div>
                ) : null}
                {rows.map(renderAddonRow)}
              </div>
            )
          })}
          {strayAddonArticles.map((p) => (
            <div key={p.id} className="flex items-baseline gap-2 pl-[2.1rem] py-0.5 font-sans text-[11px]" style={{ color: ink.muted }}>
              <span className="truncate">
                {p.article_name}
                {Number(p.quantity ?? 1) !== 1 ? ` × ${Number(p.quantity)}` : ''}
                {siteOf(p) && unitNameOf ? ` · ${unitNameOf(siteOf(p) as string)}` : ''}
              </span>
              <span className="flex-1" />
              <span className="tabular-nums shrink-0">−{formatKr(Number(p.total_price))}</span>
            </div>
          ))}

          {/* Vad som faktiskt händer med just det här avtalets tillägg */}
          {stationCount && stationCount.outdoor + stationCount.indoor > 0 && (
            <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums shrink-0" style={numStyle}>{nextNo()}</span>
              <span className="font-semibold" style={{ color: ink.primary }}>Utplacerat på avtalets enheter</span>
              <span className="flex-1 border-b border-dotted translate-y-[-3px] min-w-3" style={rowStyle} />
              <span className="font-sans text-[12px] tabular-nums whitespace-nowrap shrink-0" style={{ color: ink.secondary }}>
                {stationCount.outdoor} ute · {stationCount.indoor} inne
                {stationCount.addon > 0 ? ` · varav ${stationCount.addon} tillägg` : ''}
              </span>
            </div>
          )}
          {extra.length > 0 && (
            <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums shrink-0" style={numStyle}>{nextNo()}</span>
              <span className="font-semibold" style={{ color: ink.primary }}>Tilläggen faktureras</span>
              <span className="flex-1 border-b border-dotted translate-y-[-3px] min-w-3" style={rowStyle} />
              <span className="font-sans text-[12px] tabular-nums whitespace-nowrap shrink-0" style={{ color: ink.secondary }}>
                {equipmentInvoiceMode === 'separate' ? 'egna fakturor' : 'på premiefakturan'}
                {nextEquipmentInvoice
                  ? ` · nästa ${formatDateSv(nextEquipmentInvoice.periodStart)} · ${formatKr(nextEquipmentInvoice.subtotal)}${nextEquipmentInvoice.monthly ? '/mån' : ''}`
                  : addonStationCount > 0
                    ? ` · ${addonStationCount} stationer`
                    : ''}
              </span>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
