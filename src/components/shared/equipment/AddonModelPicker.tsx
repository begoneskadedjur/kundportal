// src/components/shared/equipment/AddonModelPicker.tsx
// Val av betalningsmodell för en tilläggsstation (per år, per månad, per kontroll)
// i utsättningsformulären ute och inne. Priserna kommer ur kundens prislista.

import {
  ADDON_BILLING_MODEL_HELP,
  ADDON_BILLING_MODEL_LABEL,
  type AddonBillingModel,
  type AddonPrices,
} from '../../../types/addonStations'

interface Props {
  value: AddonBillingModel | null
  onChange: (model: AddonBillingModel) => void
  prices: AddonPrices | null | undefined
  /** Priserna hämtas fortfarande */
  loading?: boolean
  disabled?: boolean
}

const fmt = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr`

export function AddonModelPicker({ value, onChange, prices, loading, disabled }: Props) {
  const models: AddonBillingModel[] = ['per_year', 'per_month', 'per_round']
  const priceOf = (m: AddonBillingModel): number | null =>
    m === 'per_year' ? prices?.perYear ?? null : m === 'per_month' ? prices?.perMonth ?? null : prices?.perRound ?? null
  const contractMissing = prices ? !prices.hasContract : false

  return (
    <div className="mt-2 space-y-1.5" role="radiogroup" aria-label="Betalas">
      <div className="text-xs font-medium text-slate-400">Betalas</div>
      {models.map((m) => {
        const price = priceOf(m)
        const needsContract = m !== 'per_round' && contractMissing
        const isDisabled = disabled || needsContract
        return (
          <label
            key={m}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
              value === m ? 'border-[#20c58f]/60 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/40'
            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="addon-billing-model"
              value={m}
              checked={value === m}
              disabled={isDisabled}
              onChange={() => onChange(m)}
              className="mt-0.5 w-4 h-4 border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
            />
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-slate-200">{ADDON_BILLING_MODEL_LABEL[m]}</span>
                <span className="text-xs tabular-nums whitespace-nowrap text-slate-400">
                  {loading ? 'hämtar pris' : price != null && price > 0 ? `${fmt(price)}${m === 'per_year' ? '/år' : m === 'per_month' ? '/mån' : '/kontroll'}` : 'pris saknas'}
                </span>
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                {needsContract ? 'Kräver att kunden har ett avtal i avtalskartan' : ADDON_BILLING_MODEL_HELP[m]}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
