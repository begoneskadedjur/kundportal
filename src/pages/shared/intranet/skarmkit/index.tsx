// src/pages/shared/intranet/skarmkit/index.tsx
// Skärmkitet för handbokens guider (guidemallen 2026-10-16). Små efterbildningar
// av portalens delar, så att guiderna visar skärmen som teknikern eller kontoret
// faktiskt ser den. Samma Tailwind-klasser som portalen, så ljust och mörkt tema
// följer med automatiskt.
//
// Regler:
// - Etiketter och knappnamn ska vara exakt samma ord som i portalen.
// - Telefon för det som görs ute hos kunden, Dator för det som görs på kontoret.
// - markor={{ pa, nr }} på en klickbar del ger den gröna markören i visningen.
// - Inga piller: status visas som punkt och text (Status).

import { createContext, useContext, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'

type Enhet = 'mobil' | 'dator'
const EnhetCtx = createContext<Enhet>('mobil')

export interface MarkorProps {
  /** Markören syns (visningen). I övningen lämnas den bort. */
  pa: boolean
  /** Siffran i markören, samma som stegets nummer */
  nr: number
}

// ─── Ramar ─────────────────────────────────────────

/** Telefonram, 300 px bred och 540 px hög. Allt innehåll ritas inuti. */
export function Telefon({ children, text }: { children: ReactNode; text?: string }) {
  return (
    <EnhetCtx.Provider value="mobil">
      <figure className="mx-auto w-[300px] max-w-full">
        <div className="relative overflow-hidden rounded-[34px] border-[9px] border-[#0b0f14] bg-slate-900 shadow-2xl">
          <div className="flex h-5 items-center justify-center bg-slate-900" aria-hidden>
            <span className="h-1.5 w-16 rounded bg-slate-700" />
          </div>
          <div className="relative h-[520px] overflow-hidden text-[13px] text-white">{children}</div>
        </div>
        {text && <figcaption className="mt-2 text-center text-xs text-slate-500">{text}</figcaption>}
      </figure>
    </EnhetCtx.Provider>
  )
}

/** Datorfönster med adressrad. Innehållet bestämmer höjden (minst 380 px). */
export function Dator({ children, adress, text }: { children: ReactNode; adress?: string; text?: string }) {
  return (
    <EnhetCtx.Provider value="dator">
      <figure className="w-full">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800/60 px-3 py-1.5" aria-hidden>
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <span className="h-2 w-2 rounded-full bg-slate-600" />
            </span>
            <span className="ml-2 truncate rounded bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-400">
              portal.begone.se{adress ? ` › ${adress}` : ''}
            </span>
          </div>
          <div className="relative min-h-[380px] overflow-hidden text-[13px] text-white">{children}</div>
        </div>
        {text && <figcaption className="mt-2 text-center text-xs text-slate-500">{text}</figcaption>}
      </figure>
    </EnhetCtx.Provider>
  )
}

/** Sidmeny + innehåll, som portalens sidor på datorn */
export function DatorSida({ meny, aktiv, titel, children }: { meny: string[]; aktiv: string; titel: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[380px]">
      <nav className="hidden w-36 flex-none border-r border-slate-700 bg-slate-950/40 p-2 sm:block" aria-hidden>
        <p className="mb-2 px-2 text-[11px] font-bold text-[#20c58f]">BeGone</p>
        {meny.map(m => (
          <p key={m} className={`truncate rounded-md px-2 py-1 text-[11.5px] ${m === aktiv ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400'}`}>{m}</p>
        ))}
      </nav>
      <div className="min-w-0 flex-1 p-3">
        <p className="mb-2 text-sm font-semibold text-white">{titel}</p>
        {children}
      </div>
    </div>
  )
}

// ─── Markör ────────────────────────────────────────

/** Grön ram + siffra runt det man ska trycka på. block = full bredd. */
export function Markor({ markor, block, children }: { markor?: MarkorProps; block?: boolean; children: ReactNode }) {
  const pa = !!markor?.pa
  return (
    <span className={`relative ${block ? 'block' : 'inline-flex'} ${pa ? 'z-10 rounded-lg ring-[2.5px] ring-[#20c58f] ring-offset-2 ring-offset-slate-900 motion-safe:animate-pulse' : ''}`}>
      {children}
      {pa && (
        <span className="pointer-events-none absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#20c58f] text-[11px] font-bold text-[#fff] shadow" aria-hidden>
          {markor?.nr}
        </span>
      )}
    </span>
  )
}

// ─── Delar ─────────────────────────────────────────

/** Status som punkt och text, aldrig piller */
export function Status({ text, farg = 'bg-amber-400' }: { text: string; farg?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${farg}`} aria-hidden />
      {text}
    </span>
  )
}

/** Ärendets sidhuvud: nummer, status, kund och ikonknappar uppe till höger */
export function ArendeHuvud({ nr, status, kund, ikoner }: { nr: string; status: ReactNode; kund: string; ikoner?: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-700 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-white">{nr}</p>
          {status}
        </div>
        {ikoner && <div className="flex flex-none gap-0.5">{ikoner}</div>}
      </div>
      <p className="truncate text-xs text-slate-400">{kund}</p>
    </div>
  )
}

/** Ikonknapp, som fotspåren och klockan i ärendets sidhuvud */
export function IkonKnapp({ ikon, etikett, onClick, markor }: { ikon: IconName; etikett: string; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} aria-label={etikett} title={etikett}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <Icon name={ikon} size={20} />
      </button>
    </Markor>
  )
}

/** Flikrad, som Ärende / Utförande / Ekonomi */
export function Flikar({ flikar, aktiv, onClick, markor }: { flikar: string[]; aktiv: number; onClick?: (i: number) => void; markor?: { flik: number } & MarkorProps }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-700 px-2.5 py-2">
      {flikar.map((f, i) => {
        const knapp = (
          <button key={f} type="button" onClick={() => onClick?.(i)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs ${i === aktiv ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        )
        return markor && markor.flik === i ? <Markor key={f} markor={markor}>{knapp}</Markor> : knapp
      })}
    </div>
  )
}

/** Kort i ärendet, som Ärendeinformation eller Tjänster & fakturarader */
export function Kort({ titel, ikon, children }: { titel: string; ikon?: IconName; children?: ReactNode }) {
  return (
    <div className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
        {ikon && <Icon name={ikon} className="text-[#20c58f]" />}
        {titel}
      </p>
      {children}
    </div>
  )
}

/** Rad med text till vänster och värde till höger */
export function Rad({ v, h }: { v: ReactNode; h?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs text-slate-400">
      <span className="min-w-0">{v}</span>
      {h != null && <span className="flex-none font-semibold text-white">{h}</span>}
    </div>
  )
}

/** Dialog. I telefonen ett ark nerifrån, på datorn en ruta i mitten. */
export function Ark({ titel, under, children }: { titel: string; under?: string; children: ReactNode }) {
  const enhet = useContext(EnhetCtx)
  return (
    <div className={`absolute inset-0 z-20 flex bg-black/60 ${enhet === 'mobil' ? 'items-end' : 'items-center justify-center p-4'}`}>
      <div className={`grid max-h-full gap-2 overflow-hidden bg-slate-900 p-3.5 ${enhet === 'mobil' ? 'w-full rounded-t-2xl border-t border-slate-700' : 'w-full max-w-md rounded-xl border border-slate-700 shadow-2xl'}`}>
        <div>
          <p className="text-sm font-bold text-white">{titel}</p>
          {under && <p className="text-xs text-slate-400">{under}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

/** Valkort i en dialog, som Boka återbesök / Skapa nytt ärende */
export function Val({ titel, text, onClick, markor, vald }: { titel: string; text?: string; onClick?: () => void; markor?: MarkorProps; vald?: boolean }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className={`grid w-full gap-0.5 rounded-lg border p-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'}`}>
        <span className="text-[13px] font-semibold text-white">{titel}</span>
        {text && <span className="text-[11.5px] leading-snug text-slate-400">{text}</span>}
      </button>
    </Markor>
  )
}

/** Fält med etikett. tom = platshållartext i grått. */
export function Falt({ etikett, varde, tom, onClick, markor }: { etikett: string; varde: string; tom?: boolean; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11.5px] font-medium text-slate-400">{etikett}</span>
      <Markor markor={markor} block>
        <button type="button" onClick={onClick}
          className={`block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-left text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${tom ? 'text-slate-500' : 'text-white'}`}>
          {varde}
        </button>
      </Markor>
    </div>
  )
}

/** Kryssruta med text */
export function Kryssruta({ pa, text, onClick, markor }: { pa: boolean; text: ReactNode; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} role="checkbox" aria-checked={pa}
        className="flex items-center gap-2 py-0.5 text-left text-[12.5px] text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <span className={`flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] ${pa ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>
          {pa && <Icon name="allman.bock" size={16} className="h-3 w-3" strokeWidth={2.6} />}
        </span>
        {text}
      </button>
    </Markor>
  )
}

/** Knapp i portalens stil. prim = grön. inaktiv = nedtonad men klickbar (övningen förklarar varför). */
export function PKnapp({ children, prim, fara, inaktiv, ikon, onClick, markor }: {
  children: ReactNode; prim?: boolean; fara?: boolean; inaktiv?: boolean; ikon?: IconName; onClick?: () => void; markor?: MarkorProps
}) {
  const stil = fara
    ? 'bg-red-500/90 text-[#fff] border-transparent'
    : prim ? 'bg-[#20c58f] text-[#fff] border-transparent' : 'bg-slate-800 text-slate-200 border-slate-600'
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} aria-disabled={inaktiv}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${stil} ${inaktiv ? 'opacity-50' : ''}`}>
        {ikon && <Icon name={ikon} size={16} />}
        {children}
      </button>
    </Markor>
  )
}

/** Knapprad längst ner i en dialog, höger */
export function Knapprad({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex flex-wrap justify-end gap-1.5">{children}</div>
}

/** Notis längst ner på skärmen, som portalens bekräftelser */
export function Notis({ text, fel }: { text: string; fel?: boolean }) {
  return (
    <div className="absolute bottom-4 left-3 right-3 z-30 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-[12.5px] text-slate-900 shadow-xl">
      <Icon name={fel ? 'allman.stang' : 'allman.bock'} size={16} className={fel ? 'text-red-500' : 'text-[#20c58f]'} />
      <span>{text}</span>
    </div>
  )
}

// ─── Övningen ──────────────────────────────────────

export interface OvningSvar {
  typ: 'tips' | 'fel' | 'ok'
  titel: string
  text: string
}

/**
 * Ram runt övningen: framstegsstreck, svarsrutan och Börja om till vänster,
 * skärmen till höger (under på smal skärm). Guidemodulen äger logiken.
 */
export function OvningRam({ framsteg, totalt, svar, onBorjaOm, bred, children }: {
  framsteg: number; totalt: number; svar: OvningSvar; onBorjaOm: () => void
  /** Datorskärm: skärmen läggs under svarsrutan i full bredd */
  bred?: boolean
  children: ReactNode
}) {
  const stil = svar.typ === 'ok' ? 'border-[#20c58f]/40 bg-[#20c58f]/10' : svar.typ === 'fel' ? 'border-red-500/40 bg-red-500/10' : 'border-slate-700 bg-slate-800/40'
  const titelFarg = svar.typ === 'ok' ? 'text-[#20c58f]' : svar.typ === 'fel' ? 'text-red-300' : 'text-white'
  return (
    <div className={`grid items-start gap-5 rounded-xl border border-slate-700 bg-slate-900/40 p-4 ${bred ? "" : "lg:grid-cols-[minmax(0,1fr)_auto]"}`}>
      <div className="grid gap-3">
        <div className="flex gap-1.5" aria-label={`Steg ${Math.min(framsteg, totalt)} av ${totalt}`}>
          {Array.from({ length: totalt }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded ${i < framsteg ? 'bg-[#20c58f]' : 'bg-slate-700'}`} />
          ))}
        </div>
        <div className={`rounded-xl border p-3 ${stil}`} role="status" aria-live="polite">
          <p className={`text-sm font-semibold ${titelFarg}`}>{svar.titel}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{svar.text}</p>
        </div>
        <div>
          <button type="button" onClick={onBorjaOm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700">
            <Icon name="allman.aterstall" size={16} />
            Börja om
          </button>
        </div>
      </div>
      <div className={bred ? "min-w-0" : "lg:w-[300px]"}>{children}</div>
    </div>
  )
}
