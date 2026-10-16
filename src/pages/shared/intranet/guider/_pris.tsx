// src/pages/shared/intranet/guider/_pris.tsx
// Delade hjälpdelar för prisguiderna (guide-prissattning-kontor).
// KontorSida är som skärmkitets DatorSida, men menyraderna är knappar som kan
// få markören, eftersom guiden går mellan Prislistor, Tjänsteutbud och
// Godkännanden i adminmenyn (adminNavConfig.ts).

import type { ReactNode } from 'react'
import { Markor, type MarkorProps } from '../skarmkit'

export const ADMIN_MENY = ['Ekonomisk översikt', 'Fakturering', 'Godkännanden', 'Tjänsteutbud', 'Artiklar (Inköp)', 'Prislistor'] as const
export type AdminMeny = (typeof ADMIN_MENY)[number]

export function KontorSida({ aktiv, titel, under, onMeny, menyMarkor, children }: {
  aktiv: AdminMeny
  titel: string
  under?: string
  onMeny: (m: AdminMeny) => void
  /** Markören på en menyrad: { rad, ...markor } */
  menyMarkor?: { rad: AdminMeny } & MarkorProps
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[380px]">
      <nav className="w-36 flex-none border-r border-slate-700 bg-slate-950/40 p-2">
        <p className="mb-2 px-2 text-[11px] font-bold text-[#20c58f]">BeGone</p>
        {ADMIN_MENY.map(m => {
          const knapp = (
            <button key={m} type="button" onClick={() => onMeny(m)}
              className={`block w-full truncate rounded-md px-2 py-1 text-left text-[11.5px] ${m === aktiv ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400 hover:text-white'}`}>
              {m}
            </button>
          )
          return menyMarkor && menyMarkor.rad === m
            ? <Markor key={m} markor={menyMarkor} block>{knapp}</Markor>
            : knapp
        })}
      </nav>
      <div className="min-w-0 flex-1 p-3">
        <p className="text-sm font-semibold text-white">{titel}</p>
        {under && <p className="mb-2 text-[11.5px] text-slate-400">{under}</p>}
        {children}
      </div>
    </div>
  )
}
