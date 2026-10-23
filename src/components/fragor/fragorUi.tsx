// src/components/fragor/fragorUi.tsx
// Små delar för Frågor och uppdrag: status som punkt och text (aldrig piller),
// initial-rund, text med markerade @-nämningar och knappklasser.

import type { ReactNode } from 'react'
import type { CaseComment } from '../../types/communication'
import type { Ton } from './fragorLogik'

const PUNKT: Record<Ton, string> = {
  gron: 'bg-[#20c58f]',
  gul: 'bg-amber-500',
  bla: 'bg-sky-500',
  gra: 'bg-slate-500',
}

const TEXT: Record<Ton, string> = {
  gron: 'text-[#20c58f]',
  gul: 'text-amber-500',
  bla: 'text-sky-400',
  gra: 'text-slate-400',
}

export function StatusText({ ton, children, className = '' }: { ton: Ton; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium leading-snug ${TEXT[ton]} ${className}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${PUNKT[ton]}`} />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

export function Initial({ namn, stor = false }: { namn: string; stor?: boolean }) {
  const bokstav = (namn || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden="true"
      className={`${stor ? 'w-10 h-10' : 'w-9 h-9'} flex-shrink-0 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm font-semibold`}
    >
      {bokstav}
    </span>
  )
}

/** Texten med @-nämningar markerade (personer ur mentioned_user_names och rollerna) */
export function TextMedNamningar({ kommentar }: { kommentar: CaseComment }) {
  const text = kommentar.content || ''
  const traffar: { start: number; slut: number }[] = []
  const lagg = (start: number, langd: number) => {
    if (traffar.some(t => start < t.slut && start + langd > t.start)) return
    traffar.push({ start, slut: start + langd })
  }
  const lag = text.toLowerCase()
  for (const n of kommentar.mentioned_user_names || []) {
    if (!n) continue
    const s = `@${n}`.toLowerCase()
    let i = lag.indexOf(s)
    while (i !== -1) {
      lagg(i, s.length)
      i = lag.indexOf(s, i + s.length)
    }
  }
  const roll = /@(tekniker|koordinator|admin|alla)\b/gi
  let m: RegExpExecArray | null
  while ((m = roll.exec(text)) !== null) lagg(m.index, m[0].length)
  traffar.sort((a, b) => a.start - b.start)

  const delar: ReactNode[] = []
  let pos = 0
  traffar.forEach((t, i) => {
    if (t.start > pos) delar.push(text.slice(pos, t.start))
    delar.push(<span key={i} className="font-semibold text-[#20c58f]">{text.slice(t.start, t.slut)}</span>)
    pos = t.slut
  })
  if (pos < text.length) delar.push(text.slice(pos))
  return <>{delar}</>
}

export const KNAPP_PRIMAR =
  'h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#20c58f] text-[#04281c] text-[15px] font-semibold hover:bg-[#1bb07f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f] whitespace-nowrap'

export const KNAPP_SEKUNDAR =
  'h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-white text-[15px] font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] whitespace-nowrap'

export const IKONKNAPP =
  'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
