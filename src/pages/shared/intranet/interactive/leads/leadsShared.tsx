// src/pages/shared/intranet/interactive/leads/leadsShared.tsx
// Gemensamt för leadsguiderna i handboken (variant och segment i leadsVariant.ts): ramen runt de
// klickbara skärmbilderna, statuspunkten och små textbitar.
//
// Etiketter och färger hämtas från src/types/leads.ts, samma som Leads-sidan,
// så att guiden aldrig visar ett annat namn än portalen.

import type { ReactNode } from 'react'
import { STAGE_ETIKETT, STAGE_FARG, type LeadStage } from '../../../../../types/leads'

/** Ram runt en klickbar skärmbild: fönsterlist med var i portalen bilden kommer ifrån. */
export function Ram({ where, children, caption }: { where: string; children: ReactNode; caption?: string }) {
  return (
    <figure className="my-5">
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700">
          <span className="flex gap-1" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          </span>
          <span className="text-[11px] text-slate-400 truncate">{where}</span>
          <span className="ml-auto text-[11px] text-slate-500 flex-none">Övning</span>
        </div>
        <div className="p-3">{children}</div>
      </div>
      <figcaption className="mt-1.5 text-xs text-slate-500">
        Påhittade företag och kollegor. Ingenting sparas.{caption ? ` ${caption}` : ''}
      </figcaption>
    </figure>
  )
}

/** Steget som färgad punkt och text, som på Leads-sidan. Aldrig piller. */
export function Steg({ stage, liten }: { stage: LeadStage; liten?: boolean }) {
  const f = STAGE_FARG[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 ${f.text} ${liten ? 'text-xs' : 'text-sm'}`}>
      <span className={`w-2 h-2 rounded-full flex-none ${f.punkt}`} aria-hidden />
      {STAGE_ETIKETT[stage]}
    </span>
  )
}

/** Knapp i portalens stil, för övningarna. */
export function Knapp({
  children,
  onClick,
  primar,
  fara,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  primar?: boolean
  fara?: boolean
  disabled?: boolean
}) {
  const stil = fara
    ? 'bg-red-500/90 hover:bg-red-500 text-[#fff] border-transparent'
    : primar
      ? 'bg-[#20c58f] hover:bg-[#1ab37e] text-[#fff] border-transparent'
      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 min-h-[32px] px-3 py-1 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${stil}`}
    >
      {children}
    </button>
  )
}

export const SEKTION = 'p-3 bg-slate-800/30 border border-slate-700 rounded-xl'
export const FALT =
  'w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'
export const ETIKETT = 'block text-xs font-medium text-slate-400 mb-1'

/** Svarsruta efter en övning: grön när det blev rätt, bärnsten när något saknas. */
export function Aterkoppling({ ok, titel, children }: { ok: boolean; titel: string; children?: ReactNode }) {
  return (
    <div className={`p-3 rounded-xl border ${ok ? 'bg-[#20c58f]/10 border-[#20c58f]/40' : 'bg-amber-500/10 border-amber-500/40'}`} role="status">
      <p className={`text-sm font-semibold ${ok ? 'text-[#20c58f]' : 'text-amber-300'}`}>{titel}</p>
      {children && <div className="mt-1 text-sm text-slate-300 leading-relaxed">{children}</div>}
    </div>
  )
}

/** Rad i en definitionslista: etikett till vänster, värde till höger. */
export function Rad({ etikett, children }: { etikett: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 py-1 border-b border-slate-700/40 last:border-0">
      <dt className="w-36 flex-none text-xs text-slate-400 pt-0.5">{etikett}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-200">{children}</dd>
    </div>
  )
}
