// src/components/admin/customers/SetupStatus.tsx
// Uppläggningens status i Befintliga kunder (godkänd skiss 2026-10-22):
// fem ikoner i ordningen avtal, Fortnox, fakturaväg, schema, kundportal.
// Läget syns på formen i hörnet, inte bara på färgen: inget märke = klart,
// halv prick = påbörjat, ring med streck = saknas, snedstreck = gäller inte.
// Färgerna är -400-tonerna, som globals.css mörknar i ljust tema.

import type { ReactNode } from 'react'
import type { IconName } from '../../icons/Icon'
import { ICONS } from '../../icons/set'
import TooltipWrapper from '../../ui/TooltipWrapper'
import type { SetupItem, SetupState, SetupSummary, SetupTarget } from '../../../shared/customerSetupStatus'
import { SETUP_ICON, STATE_TEXT_TONE } from './setupStatusPaths'

const ICON_TONE: Record<SetupState, string> = {
  done: 'text-emerald-400',
  partial: 'text-amber-400',
  missing: 'text-slate-400',
  na: 'text-slate-600',
}

/** Ikonen med märket i hörnet. size 16 på telefon, 20 i listan, 22 i panelen. */
export function SetupGlyph({ name, state, size = 20 }: { name: IconName; state: SetupState; size?: 16 | 20 | 22 }) {
  const mark = size === 16 ? 8 : size === 22 ? 10 : 11
  const offset = size === 16 ? '-right-px -bottom-px' : 'right-0 bottom-0'
  return (
    <span className={`relative inline-flex ${ICON_TONE[state]}`} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={size === 16 ? 1.8 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[name]}
        {state === 'na' && <path d="M4 20L20 4" />}
      </svg>
      {state === 'partial' && (
        <svg viewBox="0 0 14 14" width={mark} height={mark} className={`absolute ${offset}`}>
          <circle cx="7" cy="7" r="5.6" className="fill-slate-900 stroke-amber-400" strokeWidth={size === 16 ? 2 : 1.8} />
          <path d="M7 1.4a5.6 5.6 0 0 1 0 11.2z" className="fill-amber-400" />
        </svg>
      )}
      {state === 'missing' && (
        <svg viewBox="0 0 14 14" width={mark} height={mark} className={`absolute ${offset}`}>
          <circle cx="7" cy="7" r="5.6" className="fill-slate-900 stroke-orange-400" strokeWidth={size === 16 ? 2 : 1.8} />
          <path d="M4.3 7h5.4" className="stroke-orange-400" strokeWidth={size === 16 ? 2 : 1.8} strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

/** Förklaringsrutan: namn, läge, orsak, vad ett tryck gör. */
export function ExplainPanel({ title, state, stateTone, reason, action }: {
  title: string
  state?: string
  stateTone?: string
  reason: ReactNode
  action?: string | null
}) {
  return (
    <span className="flex flex-col gap-1 text-[12.5px] leading-snug text-slate-300">
      <span className="text-[13px] font-bold text-white">{title}</span>
      {state && <span className={`font-semibold ${stateTone ?? ''}`}>{state}</span>}
      <span>{reason}</span>
      {action && <span className="font-semibold text-emerald-400">{action}</span>}
    </span>
  )
}

export const EXPLAIN_PANEL_CLASS =
  'relative w-[270px] rounded-[10px] border border-slate-700 bg-slate-900 px-3 py-2.5 shadow-xl'

function ariaFor(item: SetupItem): string {
  return `${item.label}: ${item.stateLabel}. ${item.reason}${item.action ? ` ${item.action}.` : ''}`
}

/** En statusikon som knapp med förklaring vid hovring och fokus. */
function SetupIconButton({ item, onNavigate }: { item: SetupItem; onNavigate: (t: SetupTarget) => void }) {
  const clickable = !!item.target
  return (
    <TooltipWrapper
      position="bottom"
      delay={120}
      showOnFocus
      panelClassName={EXPLAIN_PANEL_CLASS}
      content={
        <ExplainPanel
          title={item.label}
          state={item.stateLabel}
          stateTone={STATE_TEXT_TONE[item.state]}
          reason={item.reason}
          action={item.action}
        />
      }
    >
      <button
        type="button"
        aria-label={ariaFor(item)}
        aria-disabled={!clickable || undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (item.target) onNavigate(item.target)
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`inline-flex rounded-md p-[3px] transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
          clickable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <SetupGlyph name={SETUP_ICON[item.key]} state={item.state} />
      </button>
    </TooltipWrapper>
  )
}

/** Kolumnen Status på dator: ikonknappar plus Komplett eller "N kvar · nästa åtgärd". */
export function SetupStatusCell({ summary, onNavigate }: {
  summary: SetupSummary | null
  onNavigate: (t: SetupTarget) => void
}) {
  if (!summary) return <span className="text-xs text-slate-600" aria-label="Status hämtas">…</span>
  if (summary.terminated) {
    return <span className="text-xs text-slate-500 truncate">Avslutas, ingen uppläggning</span>
  }
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="inline-flex shrink-0 gap-px">
        {summary.items.map((item) => (
          <SetupIconButton key={item.key} item={item} onNavigate={onNavigate} />
        ))}
      </span>
      {summary.complete ? (
        <span className="text-xs font-medium text-emerald-400">Komplett</span>
      ) : (
        <span className="min-w-0 truncate text-xs font-semibold text-amber-400">
          {summary.remaining} kvar ·{' '}
          {summary.next?.target ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (summary.next?.target) onNavigate(summary.next.target)
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="underline underline-offset-[3px] hover:text-amber-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              {summary.next.nextLabel}
            </button>
          ) : (
            summary.next?.nextLabel
          )}
        </span>
      )}
    </span>
  )
}

/** Telefon: ikoner på 16 px utan bildtext, plus "N kvar". Raden öppnar kundpanelen. */
export function SetupStatusCompact({ summary }: { summary: SetupSummary | null }) {
  if (!summary) return null
  if (summary.terminated) return <span className="text-xs text-slate-500">Avslutas, ingen uppläggning</span>
  const sr = summary.items.map((i) => `${i.label} ${i.stateLabel.toLowerCase()}`).join(', ')
  return (
    <span className="flex items-center gap-2.5">
      <span className="inline-flex gap-1" aria-hidden>
        {summary.items.map((item) => (
          <span key={item.key} className="inline-flex p-px">
            <SetupGlyph name={SETUP_ICON[item.key]} state={item.state} size={16} />
          </span>
        ))}
      </span>
      <span className="sr-only">{sr}.</span>
      {summary.complete ? (
        <span className="text-xs text-emerald-400">Komplett</span>
      ) : (
        <span className="text-xs font-semibold text-amber-400">{summary.remaining} kvar</span>
      )}
    </span>
  )
}

/** Kundpanelen: sektionen Uppläggning med en rad per ikon och en åtgärdsknapp för det som saknas. */
export function SetupSection({ summary, onNavigate }: {
  summary: SetupSummary
  onNavigate: (t: SetupTarget) => void
}) {
  if (summary.terminated) {
    return (
      <section className="mb-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Uppläggning</h2>
        <p className="text-sm text-slate-400">Avslutas, ingen uppläggning.</p>
      </section>
    )
  }
  return (
    <section className="mb-5" aria-label="Uppläggning">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
        Uppläggning · {summary.complete ? 'Komplett' : `${summary.remaining} kvar`}
      </h2>
      <ul>
        {summary.items.map((item) => {
          const open = item.state === 'missing' || item.state === 'partial'
          return (
            <li key={item.key} className="flex items-center gap-3 border-t border-slate-800 py-2">
              <span className="inline-flex p-0.5">
                <SetupGlyph name={SETUP_ICON[item.key]} state={item.state} size={22} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-slate-100">{item.label}</span>
                <span className="text-xs text-slate-400">
                  <span className="sr-only">{item.stateLabel}: </span>
                  {item.short}
                </span>
              </span>
              {open && item.target && item.buttonLabel && (
                <button
                  type="button"
                  onClick={() => item.target && onNavigate(item.target)}
                  className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg border border-amber-400 px-3 text-[13px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                  aria-label={`${item.buttonLabel}: ${item.label}`}
                >
                  {item.buttonLabel}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
