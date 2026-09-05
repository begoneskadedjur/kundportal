// src/components/admin/customers/record/ContractEquipmentSection.tsx
// § 6 Utrustning i avtalet på avtalspappret i Avtalskartan.
//
// Ingen ny datamängd: utrustningen är avtalsinnehållets rader
// (case_billing_items, case_type = contract). Artikelraderna är den interna
// kostnaden som § 5 räknar marginal på. Tjänsteraderna bär faktureringsläget:
//   premium   = ingår i årspremien (visas i § 4)
//   per_year  = debiteras utöver premien, antal x pris per år, egen rad på årsfakturan
//   per_round = tilläggsstation som debiteras per kontrollrunda (tjänst 43)
// Läget byts här; beloppen redigeras i samma editor som § 4.

import { useState } from 'react'
import type { CaseBillingItemWithRelations } from '../../../../types/caseBilling'
import { formatKr } from '../../../../hooks/useCustomerRecord'
import { PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk } from './paperInk'
import type { AddonBrick } from '../../../../types/addonStations'

type BillingModel = 'premium' | 'per_year' | 'per_month' | 'per_round'

const MODEL_LABEL: Record<BillingModel, string> = {
  premium: 'ingår i premien',
  per_year: 'per styck och år',
  per_month: 'per styck och månad',
  per_round: 'per kontrollrunda',
}

export function billingModelOf(item: CaseBillingItemWithRelations): BillingModel {
  const m = (item as unknown as { billing_model?: string | null }).billing_model
  return m === 'per_year' || m === 'per_month' || m === 'per_round' ? m : 'premium'
}

interface Props {
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
  loading: boolean
  ink: PaperInk
  archived: boolean
  onEdit?: () => void
  onChangeModel?: (item: CaseBillingItemWithRelations, model: BillingModel) => Promise<void>
  /** Aktiva stationer (ute + inne) på avtalets enheter, ur utplaceringarna */
  stationCount?: { outdoor: number; indoor: number; addon: number } | null
  /** Tilläggsstationer per år/månad utan beslutat läge: brickor att dra till § 7 eller § 6 */
  bricks?: AddonBrick[]
  onBrickPointerDown?: (e: React.PointerEvent, brick: AddonBrick) => void
  /** Enhetens namn för § 6-rader som avser en enhet */
  unitNameOf?: (unitId: string) => string
  /** Var per år-rader faktureras */
  equipmentInvoiceMode?: 'with_premium' | 'separate' | null
  onChangeEquipmentInvoiceMode?: (mode: 'with_premium' | 'separate') => Promise<void>
}

export default function ContractEquipmentSection({
  services,
  articles,
  loading,
  ink,
  archived,
  onEdit,
  onChangeModel,
  stationCount,
  bricks,
  onBrickPointerDown,
  unitNameOf,
  equipmentInvoiceMode,
  onChangeEquipmentInvoiceMode,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [modeBusy, setModeBusy] = useState(false)
  // Synkade stationsrader med 0 st göms (stationerna är borttagna eller inbakade)
  const extra = services.filter((s) => {
    if (billingModelOf(s) === 'premium') return false
    const site = (s as unknown as { site_customer_id?: string | null }).site_customer_id
    return !(site && Number(s.quantity) === 0)
  })
  // Artikelrader faktureras aldrig, så deras eget billing_model säger inget.
  // Vad de hör till avgörs av vad de är mappade mot: produkter för
  // tilläggsstationer (site_customer_id, eller mappade mot en per år/månad-
  // tjänsterad) ligger utöver premien och ska inte etiketteras "ingår i premien".
  const isAddonArticle = (a: CaseBillingItemWithRelations): boolean => {
    const site = (a as unknown as { site_customer_id?: string | null }).site_customer_id
    if (site) return true
    const mapped = a.mapped_service_id ? services.find((sv) => sv.id === a.mapped_service_id) : null
    return !!mapped && billingModelOf(mapped) !== 'premium'
  }
  const premiumArticles = articles.filter((a) => !isAddonArticle(a))
  const addonArticles = articles.filter(isAddonArticle)
  const durableTag = (a: CaseBillingItemWithRelations) =>
    a.article?.is_durable ? (
      <span className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: ink.muted }} title="Står kvar hos kunden i flera år: engångskostnad i marginalen, inte löpande">
        varaktig
      </span>
    ) : null
  const rowUnitName = (s: CaseBillingItemWithRelations): string | null => {
    const site = (s as unknown as { site_customer_id?: string | null }).site_customer_id
    return site && unitNameOf ? unitNameOf(site) : null
  }
  const toggleMode = async () => {
    if (!onChangeEquipmentInvoiceMode) return
    setModeBusy(true)
    try {
      await onChangeEquipmentInvoiceMode(equipmentInvoiceMode === 'separate' ? 'with_premium' : 'separate')
    } finally {
      setModeBusy(false)
    }
  }
  const canEdit = !archived && !!onChangeModel
  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }

  const change = async (item: CaseBillingItemWithRelations, model: BillingModel) => {
    if (!onChangeModel) return
    setBusyId(item.id)
    try {
      await onChangeModel(item, model)
    } finally {
      setBusyId(null)
    }
  }

  const annualExtra = extra.reduce((s, it) => s + (billingModelOf(it) === 'per_year' ? Number(it.total_price) : 0), 0)

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          § 6 · Utrustning i avtalet
        </h4>
        <span className="ml-auto font-sans text-[10.5px] tabular-nums flex items-center gap-2" style={{ color: ink.muted }}>
          {loading
            ? 'hämtar'
            : `${articles.length + extra.length} rader${annualExtra > 0 ? ` · ${formatKr(annualExtra)}/år utöver premien` : ''}`}
          {!archived && onEdit && (
            <button onClick={onEdit} className={PAPER_LINK_CLASS} style={{ color: ink.muted }} title="Lägg till eller ändra utrustning och tjänster">
              redigera
            </button>
          )}
          {onChangeEquipmentInvoiceMode ? (
            <button
              onClick={() => void toggleMode()}
              disabled={archived || modeBusy}
              className={PAPER_LINK_CLASS}
              style={{ color: ink.muted }}
              title="Klicka för att byta: per år-rader på premiefakturan eller på egna fakturor parallellt med avtalet"
            >
              {equipmentInvoiceMode === 'separate' ? 'egna fakturor' : 'på premiefakturan'}
            </button>
          ) : equipmentInvoiceMode === 'separate' ? (
            <span>egna fakturor</span>
          ) : null}
        </span>
      </div>

      {!loading && articles.length === 0 && extra.length === 0 && !(bricks && bricks.length > 0) ? (
        <p className="font-sans text-[11px] italic py-2" style={{ color: ink.muted }}>
          Ingen utrustning registrerad. Lägg in stationer, fällor och materiel som intern kostnad, eller
          tilläggsutrustning som debiteras per styck och år.
        </p>
      ) : (
        <>
          {premiumArticles.length > 0 && (
            <div className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] pt-2 pb-0.5" style={{ color: ink.muted }}>
              Ingår i premien · intern kostnad
            </div>
          )}
          {premiumArticles.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>6.{i + 1}</span>
              <span className="font-semibold">
                {a.article_name}
                <span className="font-normal text-[11.5px] ml-1.5 tabular-nums" style={{ color: ink.secondary }}>
                  {Number(a.quantity).toLocaleString('sv-SE')} st
                </span>
              </span>
              <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
              {durableTag(a)}
              <span className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: ink.positive }}>
                ingår i premien
              </span>
              <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                kostnad {formatKr(Number(a.total_price))}
              </span>
            </div>
          ))}

          {extra.length > 0 && (
            <div className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] pt-2.5 pb-0.5" style={{ color: ink.muted }}>
              Utöver premien
            </div>
          )}
          {extra.map((s, i) => {
            const model = billingModelOf(s)
            return (
              <div key={s.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
                <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>6.{premiumArticles.length + i + 1}</span>
                <span className="font-semibold">
                  {s.service_name ?? s.article_name}
                  {rowUnitName(s) && (
                    <span className="font-normal text-[11.5px] ml-1.5" style={{ color: ink.secondary }}>
                      · {rowUnitName(s)}
                    </span>
                  )}
                  <span className="font-normal text-[11.5px] ml-1.5 tabular-nums" style={{ color: ink.secondary }}>
                    {Number(s.quantity).toLocaleString('sv-SE')} st
                  </span>
                </span>
                <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
                {canEdit ? (
                  <select
                    className={`${PAPER_INPUT_CLASS} py-0.5 text-[11px]`}
                    value={model}
                    disabled={busyId === s.id}
                    onChange={(e) => void change(s, e.target.value as BillingModel)}
                    title="Faktureringsläge för raden"
                  >
                    {(Object.keys(MODEL_LABEL) as BillingModel[]).map((m) => (
                      <option key={m} value={m}>
                        {MODEL_LABEL[m]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: ink.secondary }}>
                    {MODEL_LABEL[model]}
                  </span>
                )}
                <span className="font-bold tabular-nums" style={{ color: ink.primary }}>
                  {model === 'per_year'
                    ? `${formatKr(Number(s.unit_price))} · ${formatKr(Number(s.total_price))}/år`
                    : model === 'per_month'
                      ? `${formatKr(Number(s.unit_price))} · ${formatKr(Number(s.total_price))}/mån`
                      : formatKr(Number(s.unit_price))}
                </span>
              </div>
            )
          })}

          {addonArticles.length > 0 && (
            <div className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] pt-2.5 pb-0.5" style={{ color: ink.muted }}>
              Tilläggsstationer · intern kostnad
            </div>
          )}
          {addonArticles.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>
                6.{premiumArticles.length + extra.length + i + 1}
              </span>
              <span className="font-semibold">
                {a.article_name}
                {rowUnitName(a) && (
                  <span className="font-normal text-[11.5px] ml-1.5" style={{ color: ink.secondary }}>
                    · {rowUnitName(a)}
                  </span>
                )}
                <span className="font-normal text-[11.5px] ml-1.5 tabular-nums" style={{ color: ink.secondary }}>
                  {Number(a.quantity).toLocaleString('sv-SE')} st
                </span>
              </span>
              <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
              {durableTag(a)}
              <span className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: ink.secondary }}>
                tilläggsstation
              </span>
              <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                kostnad {formatKr(Number(a.total_price))}
              </span>
            </div>
          ))}
        </>
      )}
      {/* Brickor: tilläggsstationer som väntar på beslut. Dras till § 7 (inbakat) eller § 6 (tillägg). */}
      {bricks && bricks.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {bricks.map((b) => (
            <div
              key={`${b.unitId}|${b.stationTypeId ?? ''}|${b.model}`}
              onPointerDown={onBrickPointerDown && !archived ? (e) => onBrickPointerDown(e, b) : undefined}
              className={`px-2.5 py-1.5 rounded border border-dashed font-sans text-[10.5px] select-none ${
                onBrickPointerDown && !archived ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
              style={{ borderColor: ink.rule, color: ink.secondary, touchAction: 'none' }}
              title="Dra till § 7 för att baka in i årspremien, eller till § 6 för tillägg utöver avtalet"
            >
              <span className="font-semibold" style={{ color: ink.primary }}>Tilläggsstationer</span>
              {' · '}
              {unitNameOf ? unitNameOf(b.unitId) : 'enhet'} · {b.stationTypeName} · {b.count} st · {b.model === 'per_month' ? 'per månad' : 'per år'}
              <span className="block italic" style={{ color: ink.muted }}>
                att besluta: dra till § 7 för att baka in i premien, eller till § 6 för tillägg utöver avtalet
              </span>
            </div>
          ))}
        </div>
      )}
      {stationCount && stationCount.outdoor + stationCount.indoor > 0 && (
        <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
          <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>
            6.{articles.length + extra.length + 1}
          </span>
          <span className="font-semibold">Utplacerat på avtalets enheter</span>
          <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
          <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
            {stationCount.outdoor} ute · {stationCount.indoor} inne
            {stationCount.addon > 0 ? ` · varav ${stationCount.addon} tilläggsstation${stationCount.addon === 1 ? '' : 'er'}` : ''}
          </span>
        </div>
      )}
      <p className="font-sans text-[10.5px] leading-relaxed pt-1.5" style={{ color: ink.muted }}>
        Intern kostnad räknas i § 5. "Per styck och år" faktureras {equipmentInvoiceMode === 'separate' ? 'på egna fakturor parallellt med premien' : 'som egna rader på årspremiefakturan'};
        "per styck och månad" alltid på egna månadsfakturor. Tilläggsstationer per år eller månad synkas hit från utplaceringarna, antal vid varje debitering.
        "Per kontrollrunda" debiteras när rundan avslutas.
      </p>
    </div>
  )
}
