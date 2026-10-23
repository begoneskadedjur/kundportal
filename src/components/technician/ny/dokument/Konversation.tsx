// src/components/technician/ny/dokument/Konversation.tsx
// Konversationen i dokumentdetaljen: Oneflow-meddelanden och interna anteckningar
// sammanflätade (samma källor som DocumentDetailPanel). Dina inlägg till höger,
// interna streckade med lås. Skrivrutan har två val: Till kunden i Oneflow och
// Intern anteckning. Ctrl+Enter skickar.
//
// Kontorsläget (Dokumentsignering för koordinator och admin) skickar in sin
// kontaktlogg som `lista` i stället för bubblorna och en egen förklaring för
// interna anteckningar (`internText`). Utan dem ser allt ut som i teknikerläget.

import { forwardRef, type ReactNode } from 'react'
import { Icon } from '../../../icons/Icon'
import { svDatum, svTid } from './dokumentData'
import { RADKNAPP } from './dokumentUi'

export interface Inlagg {
  key: string
  kanal: 'oneflow' | 'internal'
  forfattare: string
  arKund: boolean
  arMitt: boolean
  text: string
  at: string
}

export type Kanal = 'oneflow' | 'internal'

interface Props {
  inlagg: Inlagg[]
  laddar: boolean
  kanal: Kanal
  onKanal: (k: Kanal) => void
  kanOneflow: boolean
  utkast: string
  onUtkast: (s: string) => void
  skickar: boolean
  onSkicka: () => void
  kontakt: string
  /** Ersätter bubblorna (kontorets kontaktlogg). Skrivrutan är densamma. */
  lista?: ReactNode
  /** Förklaringen under valet när Intern anteckning är vald */
  internText?: string
}

function Bubbla({ i }: { i: Inlagg }) {
  const hoger = i.arMitt && i.kanal === 'oneflow'
  const ram = i.kanal === 'internal'
    ? 'bg-slate-800/30 border border-dashed border-slate-600'
    : i.arKund
      ? 'bg-slate-800 border border-slate-700'
      : 'bg-[#20c58f]/10 border border-[#20c58f]/30'
  return (
    <li className={`flex flex-col ${hoger ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[88%] px-3.5 py-3 rounded-2xl ${ram}`}>
        <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-400">
          <span className="font-semibold text-white">{i.arMitt ? 'Du' : i.forfattare}</span>
          {i.kanal === 'internal' ? (
            <span className="inline-flex items-center gap-1"><Icon name="allman.las" size={16} />intern anteckning</span>
          ) : (
            <span>{i.arKund ? 'kund, i Oneflow' : 'i Oneflow'}</span>
          )}
          <span className="font-mono">{svDatum(i.at)} {svTid(i.at)}</span>
        </p>
        <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">{i.text}</p>
      </div>
    </li>
  )
}

export const Konversation = forwardRef<HTMLTextAreaElement, Props>(function Konversation(
  { inlagg, laddar, kanal, onKanal, kanOneflow, utkast, onUtkast, skickar, onSkicka, kontakt, lista, internText },
  ref,
) {
  const val = (k: Kanal, text: string, ikon: 'dok.konversation' | 'allman.anteckning') => {
    const aktiv = kanal === k
    return (
      <button
        type="button"
        role="tab"
        aria-selected={aktiv}
        onClick={() => onKanal(k)}
        className={`h-11 px-3 flex items-center justify-center gap-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
          aktiv ? 'bg-slate-900 border border-slate-600 text-white font-semibold' : 'border border-transparent text-slate-300 hover:text-white font-medium'
        }`}
      >
        <Icon name={ikon} size={20} className={aktiv ? 'text-[#20c58f]' : ''} />
        {text}
      </button>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="p-4">
        {lista !== undefined ? lista : laddar && inlagg.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Hämtar konversationen</p>
        ) : inlagg.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Ingen konversation än.</p>
        ) : (
          <ol aria-label="Konversation" className="flex flex-col gap-3">
            {inlagg.map(i => <Bubbla key={i.key} i={i} />)}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4 border-t border-slate-700/60 bg-slate-950/20">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {kanOneflow && (
            <div role="tablist" aria-label="Vem ser meddelandet" className="flex gap-1 p-1 rounded-xl bg-slate-800">
              {val('oneflow', 'Till kunden i Oneflow', 'dok.konversation')}
              {val('internal', 'Intern anteckning', 'allman.anteckning')}
            </div>
          )}
          <span className="text-sm text-slate-400">
            {kanal === 'oneflow'
              ? 'Kunden får ett mejl från Oneflow och ser svaret i dokumentet.'
              : internText ?? 'Syns bara för dig och kontoret.'}
          </span>
        </div>
        <label className="flex flex-col">
          <span className="sr-only">Meddelande</span>
          <textarea
            ref={ref}
            value={utkast}
            onChange={e => onUtkast(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSkicka() } }}
            rows={3}
            placeholder={kanal === 'oneflow' ? `Skriv ditt svar till ${kontakt}` : 'Intern anteckning, syns inte för kunden'}
            className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-600 text-base lg:text-[15px] leading-relaxed text-white placeholder:text-slate-500 resize-y focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="hidden sm:inline text-sm text-slate-400">Ctrl + Enter skickar</span>
          <button type="button" onClick={onSkicka} disabled={!utkast.trim() || skickar} className={`${RADKNAPP} ml-auto`}>
            {skickar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name={kanal === 'oneflow' ? 'rapport.skicka' : 'allman.anteckning'} size={20} />}
            {kanal === 'oneflow' ? 'Skicka till kunden' : 'Spara anteckning'}
          </button>
        </div>
      </div>
    </div>
  )
})

export default Konversation
