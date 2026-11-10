// src/components/shared/rotRut/InfoKnapp.tsx
// Rund i-knapp som öppnar en hjälpruta vid tryck eller klick (ROT/RUT 3.127.0).
// Stängs med ett nytt tryck, ett tryck utanför eller Esc (TooltipWrapper openOnClick).

import type { ReactNode } from 'react'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { Icon } from '../../icons/Icon'

export default function InfoKnapp({ rubrik, children, etikett }: {
  rubrik: string
  children: ReactNode
  /** Skärmläsarens namn på knappen, t.ex. "Om Arbetskostnad" */
  etikett: string
}) {
  return (
    <TooltipWrapper
      openOnClick
      position="bottom"
      panelClassName="bg-slate-800 text-slate-200 text-[13px] leading-relaxed rounded-lg px-3.5 py-3 shadow-xl border border-slate-600 w-[min(320px,calc(100vw-48px))] grid gap-1.5 normal-case tracking-normal font-normal text-left"
      content={
        <>
          <b className="text-[13.5px] font-semibold text-white">{rubrik}</b>
          <div>{children}</div>
        </>
      }
    >
      <button
        type="button"
        aria-label={etikett}
        className="w-[22px] h-[22px] rounded-full border border-slate-500 text-slate-400 inline-grid place-items-center hover:text-[#20c58f] hover:border-[#20c58f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#20c58f] focus-visible:outline-offset-2 transition-colors"
      >
        <Icon name="allman.info" className="w-3.5 h-3.5" strokeWidth={1.8} />
      </button>
    </TooltipWrapper>
  )
}
