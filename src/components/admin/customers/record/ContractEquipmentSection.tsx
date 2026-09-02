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

type BillingModel = 'premium' | 'per_year' | 'per_round'

const MODEL_LABEL: Record<BillingModel, string> = {
  premium: 'ingår i premien',
  per_year: 'per styck och år',
  per_round: 'per kontrollrunda',
}

export function billingModelOf(item: CaseBillingItemWithRelations): BillingModel {
  const m = (item as unknown as { billing_model?: string | null }).billing_model
  return m === 'per_year' || m === 'per_round' ? m : 'premium'
}

interface Props {
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
  loading: boolean
  ink: PaperInk
  archived: boolean
  onEdit?: () => void
  onChangeModel?: (item: CaseBillingItemWithRelations, model: BillingModel) => Promise<void>
}

export default function ContractEquipmentSection({ services, articles, loading, ink, archived, onEdit, onChangeModel }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const extra = services.filter((s) => billingModelOf(s) !== 'premium')
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
        </span>
      </div>

      {!loading && articles.length === 0 && extra.length === 0 ? (
        <p className="font-sans text-[11px] italic py-2" style={{ color: ink.muted }}>
          Ingen utrustning registrerad. Lägg in stationer, fällor och materiel som intern kostnad, eller
          tilläggsutrustning som debiteras per styck och år.
        </p>
      ) : (
        <>
          {articles.length > 0 && (
            <div className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] pt-2 pb-0.5" style={{ color: ink.muted }}>
              Ingår i premien · intern kostnad
            </div>
          )}
          {articles.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>6.{i + 1}</span>
              <span className="font-semibold">
                {a.article_name}
                <span className="font-normal text-[11.5px] ml-1.5 tabular-nums" style={{ color: ink.secondary }}>
                  {Number(a.quantity).toLocaleString('sv-SE')} st
                </span>
              </span>
              <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
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
                <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>6.{articles.length + i + 1}</span>
                <span className="font-semibold">
                  {s.service_name ?? s.article_name}
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
                  {model === 'per_year' ? `${formatKr(Number(s.unit_price))} · ${formatKr(Number(s.total_price))}/år` : formatKr(Number(s.unit_price))}
                </span>
              </div>
            )
          })}
        </>
      )}
      <p className="font-sans text-[10.5px] leading-relaxed pt-1.5" style={{ color: ink.muted }}>
        Intern kostnad räknas i § 5. "Per styck och år" faktureras som egna rader på årspremiefakturan; tillägg som
        läggs till avtalet från ett ärende hamnar här automatiskt. "Per kontrollrunda" debiteras när rundan avslutas.
      </p>
    </div>
  )
}
