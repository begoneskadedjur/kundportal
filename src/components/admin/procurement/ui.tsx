// src/components/admin/procurement/ui.tsx
// Gemensamma byggstenar för upphandlingsportalen, i kundsidans lätta stil
// (CustomerPulseRow, ContractCard): tunna ramar i slate-800, sektionsrubriker
// som liten versal text, tabeller i 12 till 13 px med tabular-nums,
// statuspunkt plus text i stället för piller, brandgrönt bara som accent.
// Svenska format: datum ÅÅÅÅ-MM-DD i svensk tid, komma som decimal,
// mellanslag som tusentalsavgränsare.

import type { ReactNode } from 'react'
import { TONE_DOT, TONE_TEXT, type Tone } from './uiFormat'

export type { Tone }

/** Statuspunkt plus text. Aldrig piller. */
export function StatusDot({ tone = 'neutral', dotClass, children, className = '' }: { tone?: Tone; dotClass?: string; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] text-slate-300 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass ?? TONE_DOT[tone]}`} />
      {children}
    </span>
  )
}

/** Sektionsrubrik: liten versal text i slate-500, valfri åtgärd till höger */
export function SectionHeader({ title, action, hint }: { title: string; action?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2">
      <div className="min-w-0">
        <h2 className="text-xs uppercase tracking-wide text-slate-500">{title}</h2>
        {hint && <p className="text-[11px] text-slate-600 mt-0.5">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** En sektion med rubrik och tunn ram */
export function Section({ title, action, hint, children, className = '', bodyClassName = '' }: {
  title: string
  action?: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={className}>
      <SectionHeader title={title} action={action} hint={hint} />
      <div className={`rounded-xl border border-slate-800 bg-slate-900/40 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export interface PulseStat {
  label: string
  value: string
  hint?: string | null
  tone?: Tone
  icon?: ReactNode
}

/** Nyckeltalsrad i stil med CustomerPulseRow: en yta med hårfina avdelare */
export function PulseRow({ stats }: { stats: PulseStat[] }) {
  const cols = stats.length >= 5 ? 'lg:grid-cols-5' : stats.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${cols} rounded-2xl border border-slate-800 bg-slate-900/60 divide-x divide-y lg:divide-y-0 divide-slate-800 overflow-hidden`}>
      {stats.map((s) => (
        <div key={s.label} className="px-4 py-3.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
            {s.icon}
            <span className="truncate">{s.label}</span>
          </div>
          <div className={`text-[19px] font-semibold tabular-nums leading-none ${TONE_TEXT[s.tone ?? 'neutral']}`}>{s.value}</div>
          {s.hint && <div className="text-[11px] text-slate-500 mt-1 truncate">{s.hint}</div>}
        </div>
      ))}
    </div>
  )
}

/** Tom lista eller saknad data */
export function EmptyState({ title, hint, icon }: { title: string; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="py-8 px-4 text-center">
      {icon && <div className="flex justify-center mb-2 text-slate-600">{icon}</div>}
      <p className="text-sm text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

/** Liten textknapp i portalens stil */
export function LinkButton({ onClick, children, disabled, tone = 'accent', type = 'button', title }: {
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  tone?: 'accent' | 'muted' | 'danger'
  type?: 'button' | 'submit'
  title?: string
}) {
  const color = tone === 'accent' ? 'text-[#20c58f] hover:text-[#3ddba5]' : tone === 'danger' ? 'text-red-400 hover:text-red-300' : 'text-slate-400 hover:text-slate-200'
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`text-xs font-medium ${color} disabled:opacity-40 transition-colors`}>
      {children}
    </button>
  )
}
