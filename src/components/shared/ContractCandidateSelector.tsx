// Väljare för kunder som täcks av flera gällande avtal.
//
// En adress kan ha flera jämbördiga avtal samtidigt — betongstation, mekaniska
// fällor, sanering — med olika premie och löptid. Tidigare valde systemet tyst
// det senast tecknade. Här får koordinatorn se dem och välja.
//
// Renderar ingenting vid noll eller ett avtal: det vanliga fallet ska se ut som
// förut.

import { FileText } from 'lucide-react'
import type { ContractCandidateInfo, ContractMatchMechanism } from '../../services/contractResolver'

interface ContractCandidateSelectorProps {
  candidates: ContractCandidateInfo[]
  value: string | null
  onChange: (contractId: string) => void
  /** Visas ovanför listan. Standard passar ärendeskapande. */
  hint?: string
}

const MECHANISM_TEXT: Record<ContractMatchMechanism, string> = {
  owned: 'Eget avtal',
  site_scope: 'Omfattas via avtalet',
  covers_all_sites: 'Huvudkontorets avtal',
}

const formatPremium = (value: number | null): string | null =>
  value == null || value <= 0 ? null : `${Math.round(value).toLocaleString('sv-SE')} kr/år`

/** Kort identifierare att stämma av mot avtalskartan. */
const shortId = (c: ContractCandidateInfo): string =>
  c.oneflow_contract_id || c.id.slice(0, 8)

export default function ContractCandidateSelector({
  candidates,
  value,
  onChange,
  hint,
}: ContractCandidateSelectorProps) {
  if (candidates.length < 2) return null

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-[#20c58f]" />
        Välj avtal *
      </label>
      <p className="text-xs text-slate-500 mb-2">
        {hint ??
          `Kunden har ${candidates.length} gällande avtal. Välj vilket ärendet hör till.`}
      </p>

      <div className="space-y-2" role="radiogroup" aria-label="Gällande avtal">
        {candidates.map((c) => {
          const selected = c.id === value
          const premium = formatPremium(c.annual_value)
          // Uppsagt men löpande: gäller fortfarande, men ska inte väljas i onödan.
          const terminated = !!c.terminated_at
          const endsAt = c.effective_end_date || c.contract_end_date

          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                selected
                  ? 'bg-[#20c58f]/10 border-[#20c58f]/40'
                  : 'border-transparent hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    selected ? 'bg-[#20c58f]' : terminated ? 'bg-amber-400' : 'bg-slate-600'
                  }`}
                />
                <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{c.label}</span>
                {premium && (
                  <span className="text-xs text-slate-300 tabular-nums shrink-0">{premium}</span>
                )}
              </div>

              <div className="pl-3.5 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500">{MECHANISM_TEXT[c.mechanism]}</span>
                {c.contract_start_date && (
                  <>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-500">{c.contract_start_date}</span>
                  </>
                )}
                <span className="text-[11px] text-slate-600">·</span>
                <span className="font-mono text-[10px] text-slate-600">{shortId(c)}</span>
              </div>

              {terminated && endsAt && (
                <div className="pl-3.5 mt-0.5 text-[11px] text-amber-300">
                  Uppsagt, gäller t.o.m. {endsAt}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
