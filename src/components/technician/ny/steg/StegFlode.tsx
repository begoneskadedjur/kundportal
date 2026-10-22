// src/components/technician/ny/steg/StegFlode.tsx
// Stegraden och stegknapparna i ärendet för nya arbetsvyn (skissen PaPlats.dc.html).
//
// Tre delar, så att en modal kan lägga raden överst och knapparna i sin sidfot:
//
//   <StegRad steg={steg} aktivt={aktivt} onValj={setAktivt} hinder={['pris']} />
//   ... stegens innehåll, varje steg göms med stegKlass() ur stegKonfig.ts ...
//   <StegKnappar steg={steg} aktivt={aktivt} onTillbaka={...} onNasta={...} nastaText="Vidare" />
//
// eller allt i ett för en enkel värd:
//
//   <StegFlode steg={steg} aktivt={aktivt} onValj={setAktivt} onNasta={...}>
//     <div className={stegKlass('framme', aktivt)}>...</div>
//     <div className={stegKlass('arbete', aktivt)}>...</div>
//   </StegFlode>
//
// Regler:
//  - Alla steg som visas är ikonknappar på 44 px. Bara det aktiva stegets namn
//    skrivs ut, med "Steg X av N". Steg som inte gäller typen finns inte i listan.
//  - Steg med hinder (från kontrolleraAvslut) får orange ram.
//  - Stegens innehåll avmonteras ALDRIG vid stegbyte, det göms med CSS (hidden),
//    precis som flikarna i ärendemodalerna. Annars tappas timer, uppladdningar
//    och barnkomponenternas state.

import type { ReactNode, Ref } from 'react'
import { Icon } from '../../../icons/Icon'
import type { StegDef, StegId } from './stegKonfig'

interface StegRadProps {
  steg: StegDef[]
  aktivt: StegId
  onValj: (steg: StegId) => void
  /** Steg där något saknas innan ärendet kan stängas, får orange ram */
  hinder?: StegId[]
  /** Text till höger om stegnamnet, standard "Steg X av N" */
  undertext?: string
  className?: string
  radRef?: Ref<HTMLElement>
}

export function StegRad({ steg, aktivt, onValj, hinder = [], undertext, className = '', radRef }: StegRadProps) {
  const index = Math.max(0, steg.findIndex(s => s.id === aktivt))
  const aktuellt = steg[index]
  if (!aktuellt) return null

  return (
    <nav
      ref={radRef}
      aria-label="Ärendets steg"
      className={`sticky top-0 z-10 px-4 pt-2.5 pb-3 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 ${className}`}
    >
      <p className="mb-2.5 flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold text-white truncate">
          {aktuellt.namn}
          {aktuellt.valfritt && <span className="ml-2 text-xs font-medium text-slate-400">Valfritt</span>}
        </span>
        <span className="text-[13px] font-semibold text-[#20c58f] flex-shrink-0">
          {undertext ?? `Steg ${index + 1} av ${steg.length}`}
        </span>
      </p>
      <ol className="relative flex justify-between list-none m-0 p-0">
        <li aria-hidden="true" className="absolute left-[22px] right-[22px] top-[21px] h-0.5 bg-slate-700" />
        {steg.map((s, i) => {
          const arAktivt = i === index
          const klart = i < index
          const harHinder = hinder.includes(s.id)
          const stil = arAktivt
            ? 'bg-[#20c58f] text-[#04281c] border-0'
            : harHinder
              ? 'bg-amber-500/15 text-amber-300 border-[1.5px] border-amber-500'
              : klart
                ? 'bg-[#20c58f]/15 text-[#20c58f] border-[1.5px] border-[#20c58f]'
                : 'bg-slate-900 text-slate-400 border-[1.5px] border-slate-600 hover:text-white hover:border-slate-400'
          return (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => onValj(s.id)}
                aria-label={`Gå till steget ${s.namn}${harHinder ? ', något saknas' : ''}`}
                aria-current={arAktivt ? 'step' : undefined}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${stil}`}
              >
                <Icon name={s.ikon} size={20} />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface StegKnapparProps {
  steg: StegDef[]
  aktivt: StegId
  onTillbaka?: () => void
  /** Utelämnad: Nästa-knappen visas inte (till exempel i steget Klart, som har egna knappar) */
  onNasta?: () => void
  tillbakaText?: string
  /** Standard "Vidare till <nästa steg>" */
  nastaText?: string
  /** Pågår (sparar): knapparna är avstängda och Nästa visar en snurra */
  upptagen?: boolean
  nastaAvstangd?: boolean
  /** Extra innehåll till vänster om knapparna, till exempel Stäng */
  extra?: ReactNode
  className?: string
}

export function StegKnappar({
  steg,
  aktivt,
  onTillbaka,
  onNasta,
  tillbakaText = 'Tillbaka',
  nastaText,
  upptagen = false,
  nastaAvstangd = false,
  extra,
  className = '',
}: StegKnapparProps) {
  const index = steg.findIndex(s => s.id === aktivt)
  const nasta = index >= 0 && index < steg.length - 1 ? steg[index + 1] : null
  const forstaSteget = index <= 0
  const text = nastaText ?? (nasta ? `Vidare till ${nasta.namn.toLowerCase()}` : 'Vidare')

  return (
    <div className={`px-4 py-3 flex items-center gap-2 ${className}`}>
      {extra}
      <button
        type="button"
        onClick={onTillbaka}
        disabled={forstaSteget || !onTillbaka || upptagen}
        className="flex-1 h-14 rounded-2xl border border-slate-600 bg-slate-800/60 text-white text-[15px] font-semibold transition-colors hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      >
        {tillbakaText}
      </button>
      {onNasta && (
        <button
          type="button"
          onClick={onNasta}
          disabled={upptagen || nastaAvstangd}
          className="flex-[2] h-14 rounded-2xl bg-[#20c58f] text-[#04281c] text-base font-bold flex items-center justify-center gap-2 px-2 transition-colors hover:bg-[#1bb07f] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {upptagen ? (
            <Icon name="allman.laddar" size={20} className="animate-spin" />
          ) : null}
          <span className="truncate">{text}</span>
          {!upptagen && <Icon name="allman.chevron" size={20} />}
        </button>
      )}
    </div>
  )
}

interface StegFlodeProps {
  steg: StegDef[]
  aktivt: StegId
  onValj: (steg: StegId) => void
  hinder?: StegId[]
  onTillbaka?: () => void
  onNasta?: () => void
  nastaText?: string
  upptagen?: boolean
  /** Stegens innehåll. Varje steg göms med stegKlass(), aldrig villkorad rendering. */
  children: ReactNode
}

/** Stegraden, innehållet och knapparna i ett. För värdar utan egen sidfot. */
export function StegFlode({ steg, aktivt, onValj, hinder, onTillbaka, onNasta, nastaText, upptagen, children }: StegFlodeProps) {
  return (
    <div className="flex flex-col min-h-0">
      <StegRad steg={steg} aktivt={aktivt} onValj={onValj} hinder={hinder} />
      <div className="p-4 flex flex-col gap-3">{children}</div>
      <div className="sticky bottom-0 border-t border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
        <StegKnappar
          steg={steg}
          aktivt={aktivt}
          onTillbaka={onTillbaka}
          onNasta={onNasta}
          nastaText={nastaText}
          upptagen={upptagen}
        />
      </div>
    </div>
  )
}

export default StegFlode
