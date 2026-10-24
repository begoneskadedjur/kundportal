// src/pages/shared/intranet/guider/_nyvy_salja.tsx
// Delade delar för teknikerguiderna om att sälja och om kontot i nya arbetsvyn
// (guide-skapa-avtal-offert, guide-dokumentsignering-tekniker, guide-min-kundresa,
// guide-leads-tekniker, guide-provision, guide-mitt-konto).
//
// Efterbildningar av:
//   NyMer.tsx          Mer-sidan i telefonen: grupperna ur nyNavConfig utan Idag, Karta och
//                      Mina ärenden, Uppdateringar under Hjälp, och Konto (Mitt konto och
//                      visning, temaraden ur ThemeToggle, Rapportera bugg, Logga ut)
//   Vaxel.tsx          växlarna (Arbetskö/Statistik, Offerter/Avtal, Intjänat/Lönen)
//   dokumentUi.tsx     statuspunkten (Punkt), aldrig piller
// Etiketterna kommer från portalens egna konfigurationer där det går.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { Ark, Markor, type MarkorProps } from '../skarmkit'

export type Mk = (id: string) => MarkorProps | undefined
export type Tryck = (id: string) => void

/** Markören på det id som ska tryckas i visningen, annars ingen */
export const mkFor = (markera: string | undefined, nr: number): Mk => (id: string) => (markera === id ? { pa: true, nr } : undefined)
export const ingenMk: Mk = () => undefined

// --- Statuspunkt (Punkt i dokumentUi) ---

export type Ton = 'gron' | 'gul' | 'rod' | 'bla' | 'gra'

const PUNKT: Record<Ton, string> = {
  gron: 'bg-[#20c58f]', gul: 'bg-amber-500', rod: 'bg-red-500', bla: 'bg-sky-500', gra: 'bg-slate-500',
}
const TEXT: Record<Ton, string> = {
  gron: 'text-[#20c58f]', gul: 'text-amber-500', rod: 'text-red-400', bla: 'text-sky-400', gra: 'text-slate-300',
}
export const RUTA: Record<Ton, string> = {
  gron: 'bg-[#20c58f]/10 border-[#20c58f]/30',
  gul: 'bg-amber-500/10 border-amber-500/30',
  rod: 'bg-red-500/10 border-red-500/30',
  bla: 'bg-sky-500/10 border-sky-500/30',
  gra: 'bg-slate-800/60 border-slate-700',
}

export function Punkt({ ton, children, liten }: { ton: Ton; children: ReactNode; liten?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium leading-snug ${liten ? 'text-[10.5px]' : 'text-[11.5px]'} ${TEXT[ton]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${PUNKT[ton]}`} />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

// --- Knappar ---

/** Knapp i portalens stil med markör. prim = grön, full = hela bredden. */
export function Knapp({ id, text, ikon, prim, full, inaktiv, tryck, mk }: {
  id: string; text: string; ikon?: IconName; prim?: boolean; full?: boolean; inaktiv?: boolean; tryck: Tryck; mk: Mk
}) {
  return (
    <Markor markor={mk(id)} block={full}>
      <button type="button" onClick={() => tryck(id)} aria-disabled={inaktiv}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${full ? 'w-full' : ''} ${prim ? 'border-transparent bg-[#20c58f] text-[#04281c]' : 'border-slate-600 bg-slate-800/60 text-white'} ${inaktiv ? 'opacity-50' : ''}`}>
        {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5 flex-none" />}
        <span className="truncate">{text}</span>
      </button>
    </Markor>
  )
}

/** Växlar som portalens Vaxel: grön bakgrund på det valda */
export function Vaxlar({ val, valt, tryck, mk, prefix }: {
  val: { id: string; text: string; ikon?: IconName }[]; valt: string; tryck: Tryck; mk: Mk; prefix: string
}) {
  return (
    <div className="flex gap-0.5 rounded-xl border border-slate-700/60 bg-slate-900 p-0.5">
      {val.map(v => (
        <span key={v.id} className="min-w-0 flex-1">
          <Markor markor={mk(`${prefix}:${v.id}`)} block>
            <button type="button" onClick={() => tryck(`${prefix}:${v.id}`)}
              className={`flex h-7 w-full min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-medium ${v.id === valt ? 'bg-[#20c58f] text-[#04281c]' : 'text-slate-300'}`}>
              {v.ikon && <Icon name={v.ikon} size={16} className="h-3.5 w-3.5 flex-none" />}
              <span className="truncate">{v.text}</span>
            </button>
          </Markor>
        </span>
      ))}
    </div>
  )
}

/** Rubrik med ikon och antal, som gruppernas rubriker i nya vyn */
export function Rubrik({ ikon, farg, text, antal, under }: { ikon: IconName; farg: string; text: string; antal?: number; under?: string }) {
  return (
    <div className="mb-1 flex items-start gap-1.5">
      <Icon name={ikon} size={16} className={`mt-0.5 flex-none ${farg}`} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between text-[12.5px] font-semibold text-white">{text}{antal !== undefined && <span className="font-mono text-[11px] text-slate-400">{antal}</span>}</p>
        {under && <p className="text-[10.5px] leading-snug text-slate-400">{under}</p>}
      </div>
    </div>
  )
}

// --- Mer-sidan i telefonen ---

/** Temaraden i Konto, som ThemeToggle variant row: nuvarande tema och vad nästa tryck byter till */
export const TEMA_ORDNING = ['Mörkt tema', 'Ljust tema', 'Följer systemet'] as const
export type Tema = typeof TEMA_ORDNING[number]
export const nastaTema = (t: Tema): Tema => TEMA_ORDNING[(TEMA_ORDNING.indexOf(t) + 1) % TEMA_ORDNING.length]

/**
 * Mer-sidan (NyMer). Länkarna trycks med id nav:<menynamn>, samma id som
 * sidomenyn på datorn i NySkarm, så att samma tryck-funktion fungerar för båda.
 * Konto: 'konto' (Mitt konto och visning), 'tema', 'bugg', 'loggaut'. Hjälp: 'uppdateringar'.
 */
export function MerSida({ tryck, mk, tema = 'Mörkt tema', grupper }: { tryck: Tryck; mk: Mk; tema?: Tema; grupper?: string[] }) {
  // grupper = de grupper som syns, som när man har scrollat (telefonens skärm rymmer inte alla)
  const syns = (g: string) => !grupper || grupper.includes(g)
  const iBotten = new Set(['Idag', 'Karta', 'Mina ärenden'])
  const rad = (id: string, ikon: IconName | null, text: string, indrag = false) => (
    <Markor key={id} markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`flex min-h-[26px] w-full items-center gap-2 rounded-md py-1 pr-1.5 text-left text-[11.5px] text-slate-200 hover:bg-slate-800 ${indrag ? 'pl-7' : 'pl-1.5'}`}>
        {ikon && <Icon name={ikon} size={16} className="flex-none text-slate-400" />}
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <Icon name="allman.chevron" size={16} className="h-3 w-3 flex-none text-slate-500" />
      </button>
    </Markor>
  )
  return (
    <div className="grid gap-1.5">
      {NY_NAV_GRUPPER.map(g => {
        const lankar = g.lankar.filter(l => !iBotten.has(l.label))
        if (!lankar.length || !syns(g.label)) return null
        return (
          <div key={g.label}>
            <p className="px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900 p-0.5">
              {lankar.map(l => l.under ? (
                <div key={l.label}>
                  <p className="flex items-center gap-2 px-1.5 py-1 text-[11.5px] text-slate-300"><Icon name={l.ikon} size={16} className="text-slate-400" />{l.label}</p>
                  {l.under.map(u => rad(`nav:${u.label}`, null, u.label, true))}
                </div>
              ) : rad(`nav:${l.label}`, l.ikon, l.label))}
              {g.label === 'Hjälp' && rad('uppdateringar', 'upphandling.annons', 'Uppdateringar')}
            </div>
          </div>
        )
      })}
      {syns('Konto') && <div>
        <p className="px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Konto</p>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900 p-0.5">
          {rad('konto', 'rapport.person', 'Mitt konto och visning')}
          <Markor markor={mk('tema')} block>
            <button type="button" onClick={() => tryck('tema')} className="flex min-h-[26px] w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] text-slate-400 hover:bg-slate-800">
              <Icon name="allman.tema" size={16} className="flex-none" />
              <span className="font-medium">{tema}</span>
              <span className="ml-auto truncate text-[9.5px] text-slate-500">Byt till {nastaTema(tema).toLowerCase()}</span>
            </button>
          </Markor>
          {rad('bugg', 'falt.bugg', 'Rapportera bugg')}
          <button type="button" onClick={() => tryck('loggaut')} className="flex min-h-[26px] w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11.5px] text-red-400">
            <Icon name="allman.logga-ut" size={16} className="flex-none" />Logga ut
          </button>
        </div>
      </div>}
    </div>
  )
}

/** Fel tryck i ramen: ett vanligt tips om var sidan ligger */
export function vagTill(sida: string, enhet: 'mobil' | 'dator', grupp = 'Sälja'): string {
  return enhet === 'dator'
    ? `${sida} står i sidomenyn till vänster under ${grupp}.`
    : `${sida} ligger under Mer. Tryck Mer längst ner till höger och sedan ${sida} under ${grupp}.`
}

// --- Skapa-arket (SkapaArk) ---

const SKAPA_VAL: { rubrik: string; text: string; ikon: IconName }[] = [
  { rubrik: 'Avtal eller offert', text: 'Skickas till kunden som signerar i mobilen.', ikon: 'dok.avtal' },
  { rubrik: 'Specialrapport', text: 'Inspektion, sanering eller annan rapport med bilder.', ikon: 'falt.specialrapport' },
  { rubrik: 'Ny station', text: 'Välj kunden på Stationer och placera stationen på kartan.', ikon: 'falt.nystation' },
  { rubrik: 'Tips om ny kund', text: 'Någon som behöver hjälp? Skriv namn och vad det gäller.', ikon: 'lead.tips' },
  { rubrik: 'Ticket till en kollega', text: 'Till en kollega, en roll eller alla, om ett ärende.', ikon: 'dok.konversation' },
]

/** Skapa-arket, valen som id skapa:<rubrik> */
export function SkapaArket({ tryck, mk }: { tryck: Tryck; mk: Mk }) {
  return (
    <Ark titel="Vad vill du göra?" under="Välj en ruta. Du kan alltid gå tillbaka.">
      <div className="grid gap-0.5">
        {SKAPA_VAL.map(s => (
          <Markor key={s.rubrik} markor={mk(`skapa:${s.rubrik}`)} block>
            <button type="button" onClick={() => tryck(`skapa:${s.rubrik}`)} className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-800">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f]/10 text-[#20c58f]"><Icon name={s.ikon} size={16} /></span>
              <span className="min-w-0"><span className="block text-[12px] font-semibold text-white">{s.rubrik}</span><span className="block text-[10.5px] leading-snug text-slate-400">{s.text}</span></span>
            </button>
          </Markor>
        ))}
      </div>
    </Ark>
  )
}

