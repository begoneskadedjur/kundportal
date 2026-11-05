// src/components/admin/invoicing/queue/QueueParts.tsx
// Delade delar för arbetslistorna i /admin/fakturering (Avtalskunder och
// Merförsäljning avtal, 3.121.0 och framåt): nyckeltal, knappraden för
// markerade fakturor, gruppraden med kryssruta, sidopanelens kort och växeln
// Att hantera | Arkiv. Status visas som platt text med statuspunkt, aldrig piller.

import type { ReactNode } from 'react'
import { Icon } from '../../../icons/Icon'
import { TONE_DOT, TONE_TEXT, type Tone } from './queueUtils'

export type { Tone }

export function StatusText({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${TONE_TEXT[tone]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TONE_DOT[tone]}`} />
      {children}
    </span>
  )
}

export interface Kpi {
  key: string
  label: string
  tone: Tone
  count: number
  sum: string
  hint: string
}

export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${kpis.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
      {kpis.map((k) => (
        <div key={k.key} className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TONE_DOT[k.tone]}`} />
            <span className="truncate">{k.label}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-bold text-white">{k.count}</span>
            <span className="text-sm text-slate-300 truncate">{k.sum}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 truncate" title={k.hint}>{k.hint}</div>
        </div>
      ))}
    </div>
  )
}

/** Växeln Att hantera | Arkiv bredvid flikarna. */
export function ModeSwitch({ mode, onChange }: { mode: 'hantera' | 'arkiv'; onChange: (m: 'hantera' | 'arkiv') => void }) {
  const btn = (id: 'hantera' | 'arkiv', label: string) => (
    <button
      type="button"
      aria-pressed={mode === id}
      onClick={() => onChange(id)}
      className={`px-3.5 min-h-[36px] text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
        mode === id ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label="Läge" className="inline-flex border border-slate-700 rounded-lg overflow-hidden divide-x divide-slate-700">
      {btn('hantera', 'Att hantera')}
      {btn('arkiv', 'Arkiv')}
    </div>
  )
}

/** Knappraden överst: ligger kvar när man scrollar. */
export function SelectionBar({
  count,
  sumText,
  onClear,
  approveCount,
  onApprove,
  canApprove,
  busy,
  sendCount,
  onSend,
  sendTitle,
}: {
  count: number
  sumText: string
  onClear: () => void
  approveCount: number
  onApprove: () => void
  canApprove: boolean
  busy: boolean
  sendCount: number
  onSend: () => void
  sendTitle?: string
}) {
  const active = count > 0
  return (
    <div
      className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border backdrop-blur ${
        active ? 'border-[#20c58f]/40 bg-[#20c58f]/10' : 'border-slate-800 bg-slate-900/90'
      }`}
    >
      <div className="flex items-baseline gap-2 text-sm min-w-0">
        <span className="font-semibold text-white">
          {active ? `${count} ${count === 1 ? 'faktura markerad' : 'fakturor markerade'}` : 'Inga fakturor markerade'}
        </span>
        <span className="text-slate-400 truncate">{active ? sumText : 'Bocka i fakturor eller en hel grupp'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[40px] px-3 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Avmarkera
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            onClick={onApprove}
            disabled={busy || approveCount === 0}
            className="min-h-[40px] px-3.5 rounded-lg border border-[#20c58f] text-[#20c58f] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#20c58f]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="allman.bock" size={16} />
            Godkänn markerade ({approveCount})
          </button>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={busy || sendCount === 0}
          title={sendTitle}
          className="min-h-[40px] px-3.5 rounded-lg bg-[#20c58f] hover:bg-[#1bab7c] text-[#fff] text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="rapport.skicka" size={16} />
          Skicka godkända till Fortnox ({sendCount})
        </button>
      </div>
    </div>
  )
}

export function Checkbox({ checked, indeterminate, onChange, label }: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="w-11 min-h-[44px] flex-none flex items-center justify-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate && !checked }}
        onChange={onChange}
        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
      />
    </label>
  )
}

/** Gruppens rubrikrad i tabellen. */
export function GroupHeader({
  tone,
  title,
  desc,
  total,
  checked,
  indeterminate,
  onToggle,
}: {
  tone: Tone
  title: string
  desc: string
  total: string
  checked: boolean
  indeterminate: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center bg-slate-800/40 border-b border-slate-800">
      <Checkbox checked={checked} indeterminate={indeterminate} onChange={onToggle} label={`Markera alla i ${title}`} />
      <div className="flex-1 min-w-0 flex items-center justify-between gap-3 py-2.5 pr-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TONE_DOT[tone]}`} />
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="text-xs text-slate-500 truncate">{desc}</span>
        </div>
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">{total}</span>
      </div>
    </div>
  )
}

export function SideCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export interface RuleItem { title: string; text: string }

export function RuleList({ rules, footer }: { rules: RuleItem[]; footer?: string }) {
  return (
    <div>
      <ul className="divide-y divide-slate-800">
        {rules.map((r) => (
          <li key={r.title} className="py-2 first:pt-0">
            <div className="text-[13px] font-medium text-slate-200">{r.title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{r.text}</div>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500">{footer}</p>}
    </div>
  )
}

