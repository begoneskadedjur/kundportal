// src/pages/shared/intranet/skarmkit/nyvy.tsx
// Skärmkitet för nya arbetsvyn (2026-10-24). Guiderna för tekniker visar nya vyn,
// i telefonen eller på datorn. Enheten väljs per läsare: guiden öppnas i den vy som
// passar skärmen man läser på, och väljaren ovanför guiden byter.
//
// Menyerna och stegen hämtas från portalens egna konfigurationer (nyNavConfig,
// stegKonfig), så etiketterna och ikonerna är alltid desamma som i portalen.
//
// Användning i en guidemodul:
//   const enhet = useGuideEnhet()
//   <NySkarm sida="arenden" titel="Mina ärenden" markor={...}>...innehåll...</NySkarm>
//   <NyArende typ="privat" aktivt="framme" nr="BE-0001234" kund="Familjen Exempel" ...>...</NyArende>

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { stegForArende, type ArendeStegTyp, type StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import { Dator, Markor, Telefon, type MarkorProps } from './index'

// ─── Enhet ─────────────────────────────────────────

export type GuideEnhet = 'mobil' | 'dator'

interface EnhetVal { enhet: GuideEnhet; setEnhet: (e: GuideEnhet) => void; dubbel: boolean }
const GuideEnhetCtx = createContext<EnhetVal>({ enhet: 'mobil', setEnhet: () => {}, dubbel: false })

const NYCKEL = 'guide-enhet'

function startEnhet(): GuideEnhet {
  try {
    const sparad = localStorage.getItem(NYCKEL)
    if (sparad === 'mobil' || sparad === 'dator') return sparad
  } catch { /* privat läge */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches) return 'dator'
  return 'mobil'
}

/**
 * Omsluter en guide. dubbel = guidemodulen ritar både telefon och dator, då styr
 * läsarens val. Annars gäller guidens egen enhet (intro.enhet).
 */
export function GuideEnhetProvider({ dubbel, fast, children }: { dubbel: boolean; fast: GuideEnhet; children: ReactNode }) {
  const [vald, setVald] = useState<GuideEnhet>(() => (dubbel ? startEnhet() : fast))
  useEffect(() => { if (!dubbel) setVald(fast) }, [dubbel, fast])
  const setEnhet = (e: GuideEnhet) => {
    setVald(e)
    try { localStorage.setItem(NYCKEL, e) } catch { /* privat läge */ }
  }
  return <GuideEnhetCtx.Provider value={{ enhet: dubbel ? vald : fast, setEnhet, dubbel }}>{children}</GuideEnhetCtx.Provider>
}

/** Har guiden både telefon och dator */
export function useGuideDubbel(): boolean {
  return useContext(GuideEnhetCtx).dubbel
}

/** Enheten guiden visas för just nu */
export function useGuideEnhet(): GuideEnhet {
  return useContext(GuideEnhetCtx).enhet
}

/** Väljaren ovanför guiden: Telefon eller Dator. Syns bara när guiden har båda. */
export function EnhetValjare() {
  const { enhet, setEnhet, dubbel } = useContext(GuideEnhetCtx)
  if (!dubbel) return null
  const knapp = (e: GuideEnhet, ikon: IconName, text: string) => (
    <button type="button" role="radio" aria-checked={enhet === e} onClick={() => setEnhet(e)}
      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${enhet === e ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-300 hover:bg-slate-800'}`}>
      <Icon name={ikon} size={20} />
      {text}
    </button>
  )
  return (
    <div className="mb-5 grid gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <p className="text-sm text-slate-300">
        Skärmarna i guiden visar nya arbetsvyn {enhet === 'mobil' ? 'i telefonen' : 'på datorn'}. Byt om du jobbar på det andra sättet.
      </p>
      <div role="radiogroup" aria-label="Visa guiden för" className="flex gap-1 rounded-xl border border-slate-700 bg-slate-900/60 p-1 sm:w-64">
        {knapp('mobil', 'guide.mobil', 'Telefon')}
        {knapp('dator', 'guide.dator', 'Dator')}
      </div>
    </div>
  )
}

// ─── Markörer ──────────────────────────────────────

/** Mål i ramen som kan markeras: nav:Idag, nav:Karta, nav:Skapa, nav:Ärenden, nav:Mer,
 *  nav:<menynamn på datorn>, sok, tillbud, tickets, visamig, skapa */
export interface NyMarkor extends MarkorProps { mal: string }

const pa = (m: NyMarkor | undefined, mal: string): MarkorProps | undefined => (m && m.mal === mal ? m : undefined)

// ─── Ramen: sidhuvud, bottenmeny, sidomeny ────────

export type NySida = 'idag' | 'karta' | 'arenden' | 'mer' | 'schema' | 'tickets' | 'stationer' | 'specialrapporter'
  | 'avtal' | 'dokumentsignering' | 'kundresa' | 'leads' | 'provision' | 'intranat' | 'konto' | 'tillbud' | 'ingen'

const SIDA_TILL_MENY: Partial<Record<NySida, string>> = {
  idag: 'Idag', karta: 'Karta', schema: 'Schema', arenden: 'Mina ärenden', tickets: 'Tickets',
  stationer: 'Stationer', specialrapporter: 'Specialrapporter', avtal: 'Skapa avtal eller offert',
  dokumentsignering: 'Dokumentsignering', kundresa: 'Min kundresa', leads: 'Leads och tips',
  provision: 'Provision', intranat: 'Intranät och guider',
}

function Raknare({ antal }: { antal: number }) {
  if (!antal) return null
  return <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#20c58f] text-[9px] font-bold text-[#04281c]">{antal > 9 ? '9+' : antal}</span>
}

function HuvudIkon({ ikon, etikett, onClick, markor, antal, varning }: { ikon: IconName; etikett: string; onClick?: () => void; markor?: MarkorProps; antal?: number; varning?: boolean }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} aria-label={etikett} title={etikett}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${varning ? 'text-amber-600/80' : 'text-slate-400'}`}>
        <Icon name={ikon} size={20} />
        {antal ? <Raknare antal={antal} /> : null}
      </button>
    </Markor>
  )
}

interface NySkarmProps {
  /** Vilken sida som är aktiv i menyn */
  sida: NySida
  /** Rubriken i sidhuvudet, som portalen (Idag, Mina ärenden ...) */
  titel: string
  /** Raden under rubriken, till exempel "Lördag 24 oktober, 4 besök" */
  under?: string
  /** Siffran på Tickets-klockan */
  tickets?: number
  /** Klick på menyer och ikoner i ramen: mal enligt NyMarkor */
  onRam?: (mal: string) => void
  markor?: NyMarkor
  /** Lager ovanpå sidan, inne i ramen (Ark, Notis, ärendet) */
  over?: ReactNode
  children: ReactNode
}

/** Nya arbetsvyn: telefon (sidhuvud + bottenmeny) eller dator (sidomeny + sidhuvud) enligt läsarens val */
export function NySkarm({ sida, titel, under, tickets = 0, onRam, markor, over, children }: NySkarmProps) {
  const enhet = useGuideEnhet()
  const ram = (mal: string) => () => onRam?.(mal)

  if (enhet === 'dator') {
    const aktivMeny = SIDA_TILL_MENY[sida]
    return (
      <Dator adress={titel}>
        <div className="flex min-h-[440px]">
          <nav className="hidden w-44 flex-none border-r border-slate-700 bg-slate-950/40 p-2 sm:block" aria-label="Sidomeny i exemplet">
            <p className="mb-2 px-2 text-[12px] font-bold text-[#20c58f]">BeGone</p>
            {NY_NAV_GRUPPER.map(g => (
              <div key={g.label} className="mb-2">
                <p className="px-2 pb-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
                {g.lankar.flatMap(l => [l, ...(l.under ?? [])]).filter((l, i, a) => a.findIndex(x => x.label === l.label) === i).map(l => {
                  const indrag = g.lankar.every(x => x.label !== l.label)
                  const aktiv = l.label === aktivMeny
                  return (
                    <Markor key={l.label} markor={pa(markor, `nav:${l.label}`)} block>
                      <button type="button" onClick={ram(`nav:${l.label}`)}
                        className={`flex w-full items-center gap-1.5 rounded-md py-1 text-left text-[11px] ${indrag ? 'pl-6 pr-1.5' : 'px-1.5'} ${aktiv ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400 hover:text-white'}`}>
                        {!indrag && <Icon name={l.ikon} size={16} className="h-3.5 w-3.5 flex-none" />}
                        <span className="truncate">{l.label}</span>
                        {l.badge === 'tickets' && tickets > 0 && <span className="ml-auto rounded-full bg-[#20c58f] px-1.5 text-[9px] font-bold text-[#04281c]">{tickets}</span>}
                      </button>
                    </Markor>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900/90 px-3 py-2">
              <div className="w-28 min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">{titel}</p>
                {under && <p className="truncate text-[10.5px] text-slate-400">{under}</p>}
              </div>
              <Markor markor={pa(markor, 'sok')}>
                <button type="button" onClick={ram('sok')} className="flex h-7 w-40 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 text-[10.5px] text-slate-400 sm:w-52">
                  <Icon name="allman.sok" size={16} className="h-3 w-3" />Sök kund, adress eller ärende
                </button>
              </Markor>
              <div className="ml-auto flex items-center gap-0.5">
                <Markor markor={pa(markor, 'skapa')}>
                  <button type="button" onClick={ram('skapa')} className="mr-1 flex h-7 items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 text-[11px] font-semibold text-[#04281c]">
                    <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Skapa
                  </button>
                </Markor>
                <HuvudIkon ikon="falt.visamig" etikett="Visa mig hur sidan fungerar" onClick={ram('visamig')} markor={pa(markor, 'visamig')} />
                <HuvudIkon ikon="rapport.avvikelse" etikett="Rapportera tillbud, avvikelse eller olycka" onClick={ram('tillbud')} markor={pa(markor, 'tillbud')} varning />
                <HuvudIkon ikon="upphandling.notis" etikett="Tickets" onClick={ram('tickets')} markor={pa(markor, 'tickets')} antal={tickets} />
              </div>
            </div>
            <div className="relative min-h-0 flex-1 p-3">{children}</div>
            {over}
          </div>
        </div>
      </Dator>
    )
  }

  const botten: { mal: string; text: string; ikon: IconName; aktiv: boolean }[] = [
    { mal: 'nav:Idag', text: 'Idag', ikon: 'falt.idag', aktiv: sida === 'idag' },
    { mal: 'nav:Karta', text: 'Karta', ikon: 'falt.karta', aktiv: sida === 'karta' },
    { mal: 'nav:Skapa', text: 'Skapa', ikon: 'allman.plus', aktiv: false },
    { mal: 'nav:Ärenden', text: 'Ärenden', ikon: 'arende.arende', aktiv: sida === 'arenden' },
    { mal: 'nav:Mer', text: 'Mer', ikon: 'allman.meny', aktiv: !['idag', 'karta', 'arenden', 'ingen'].includes(sida) },
  ]
  return (
    <Telefon>
      <div className="flex h-full flex-col">
        <div className="flex h-12 flex-none items-center justify-between border-b border-slate-700/60 bg-slate-900 pl-3 pr-1">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight text-white">{titel}</p>
            {under && <p className="truncate text-[10.5px] text-slate-400">{under}</p>}
          </div>
          <div className="flex flex-none items-center">
            <HuvudIkon ikon="allman.sok" etikett="Sök kund, adress eller ärende" onClick={ram('sok')} markor={pa(markor, 'sok')} />
            <HuvudIkon ikon="rapport.avvikelse" etikett="Rapportera tillbud, avvikelse eller olycka" onClick={ram('tillbud')} markor={pa(markor, 'tillbud')} varning />
            <HuvudIkon ikon="upphandling.notis" etikett="Tickets" onClick={ram('tickets')} markor={pa(markor, 'tickets')} antal={tickets} />
            <HuvudIkon ikon="falt.visamig" etikett="Visa mig hur sidan fungerar" onClick={ram('visamig')} markor={pa(markor, 'visamig')} />
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden p-2.5">{children}</div>
        <div className="flex h-14 flex-none items-stretch border-t border-slate-700/60 bg-slate-900 px-0.5">
          {botten.map(b => (
            <Markor key={b.mal} markor={pa(markor, b.mal)} block>
              <button type="button" onClick={ram(b.mal)}
                className={`flex h-full w-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${b.aktiv ? 'text-[#20c58f]' : 'text-slate-400'}`}>
                {b.text === 'Skapa'
                  ? <span className="-mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-[#20c58f] text-[#04281c]"><Icon name="allman.plus" size={20} /></span>
                  : <Icon name={b.ikon} size={20} />}
                {b.text}
              </button>
            </Markor>
          ))}
        </div>
      </div>
      {over}
    </Telefon>
  )
}

// ─── Ärendet i stegflödet ──────────────────────────

interface NyArendeProps {
  /** Ärendetypen styr stegen, samma som portalen (privat, inspection, establishment ...) */
  typ: ArendeStegTyp
  aktivt: StegId
  nr: string
  /** Status som punkt och text, till exempel "Bokad" */
  status: string
  statusFarg?: string
  kund: string
  /** Texten på den gröna knappen, standard "Vidare till <nästa steg>" */
  nastaText?: string
  onNasta?: () => void
  /** Nästa som vit knapp med kant, som när stationskontrollen pågår */
  nastaSekundar?: boolean
  onTillbaka?: () => void
  /** Klick på en stegikon */
  onSteg?: (id: StegId) => void
  /** Markör: mal = 'nasta', 'tillbaka', 'steg:<id>', 'verktyg', 'flikvy', 'stang' */
  markor?: NyMarkor
  onIkon?: (mal: 'verktyg' | 'flikvy' | 'stang') => void
  /** Utöver avtalet i stället för Pris och fakturering (avtalsbesök) */
  ingarIAvtalet?: boolean
  children: ReactNode
}

/**
 * Ärendemodalen i nya vyn: huvud med nummer, status och kund, stegraden med
 * ikonerna, innehållet och Tillbaka / den gröna knappen längst ner.
 * Telefon: hela skärmen. Dator: modal i mitten av sidan.
 */
export function NyArende({ typ, aktivt, nr, status, statusFarg = 'bg-amber-400', kund, nastaText, onNasta, nastaSekundar, onTillbaka, onSteg, markor, onIkon, ingarIAvtalet, children }: NyArendeProps) {
  const enhet = useGuideEnhet()
  const steg = stegForArende(typ, ingarIAvtalet === undefined ? {} : { ingarIAvtalet })
  const idx = Math.max(0, steg.findIndex(s => s.id === aktivt))
  const aktuellt = steg[idx]
  const nasta = steg[idx + 1]
  const gron = nastaText ?? (nasta ? `Vidare till ${nasta.namn.toLowerCase()}` : undefined)

  const innehall = (
    <div className="flex h-full min-h-0 flex-col bg-slate-900">
      <div className="flex flex-none items-start justify-between gap-2 border-b border-slate-700/60 px-3 py-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[12.5px] font-semibold text-white">
            {nr}
            <span className="inline-flex items-center gap-1 font-sans text-[10.5px] font-normal text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${statusFarg}`} />{status}</span>
          </p>
          <p className="truncate text-[10.5px] text-slate-400">{kund}</p>
        </div>
        <div className="flex flex-none">
          <HuvudIkon ikon="falt.uppgifter" etikett="Alla uppgifter i ärendet, den vanliga flikvyn" onClick={() => onIkon?.('flikvy')} markor={pa(markor, 'flikvy')} />
          <HuvudIkon ikon="falt.verktyg" etikett="Ärendets verktyg" onClick={() => onIkon?.('verktyg')} markor={pa(markor, 'verktyg')} />
          <HuvudIkon ikon="allman.stang" etikett="Stäng ärendet" onClick={() => onIkon?.('stang')} markor={pa(markor, 'stang')} />
        </div>
      </div>
      <div className="flex-none border-b border-slate-700/50 px-3 pb-2.5 pt-2">
        <p className="mb-2 flex items-baseline justify-between gap-2">
          <span className="truncate text-[12.5px] font-bold text-white">{aktuellt.namn}{aktuellt.valfritt && <span className="ml-1.5 text-[10px] font-medium text-slate-400">Valfritt</span>}</span>
          <span className="flex-none text-[11px] font-semibold text-[#20c58f]">Steg {idx + 1} av {steg.length}</span>
        </p>
        <ol className="relative m-0 flex list-none justify-between p-0">
          <li aria-hidden className="absolute left-[14px] right-[14px] top-[13px] h-0.5 bg-slate-700" />
          {steg.map((s, i) => {
            const stil = i === idx ? 'bg-[#20c58f] text-[#04281c] border-[#20c58f]' : i < idx ? 'border-[#20c58f] text-[#20c58f] bg-slate-900' : 'border-slate-600 text-slate-400 bg-slate-900'
            return (
              <li key={s.id} className="relative">
                <Markor markor={pa(markor, `steg:${s.id}`)}>
                  <button type="button" onClick={() => onSteg?.(s.id)} aria-label={`Gå till steget ${s.namn}`} title={s.namn}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${stil}`}>
                    <Icon name={s.ikon} size={16} className="h-3.5 w-3.5" />
                  </button>
                </Markor>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2.5">{children}</div>
      <div className="flex flex-none items-center gap-1.5 border-t border-slate-700/50 px-2.5 py-2">
        <Markor markor={pa(markor, 'tillbaka')}>
          <button type="button" onClick={onTillbaka} disabled={idx === 0 && !onTillbaka}
            className="h-9 rounded-xl border border-slate-600 bg-slate-800/60 px-3 text-[12px] font-semibold text-white disabled:opacity-40">Tillbaka</button>
        </Markor>
        {gron && (
          <span className="min-w-0 flex-1">
            <Markor markor={pa(markor, 'nasta')} block>
              <button type="button" onClick={onNasta}
                className={`flex h-9 w-full items-center justify-center gap-1 truncate rounded-xl px-2 text-[12.5px] font-bold ${nastaSekundar ? 'border border-slate-600 bg-slate-800/60 text-white' : 'bg-[#20c58f] text-[#04281c]'}`}>
                <span className="truncate">{gron}</span>
              </button>
            </Markor>
          </span>
        )}
      </div>
    </div>
  )

  if (enhet === 'dator') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
        <div className="flex h-full max-h-[420px] w-full max-w-[460px] flex-col overflow-hidden rounded-xl border border-slate-700 shadow-2xl">{innehall}</div>
      </div>
    )
  }
  return <div className="absolute inset-0 z-20">{innehall}</div>
}

/** Rad i en lista, som Mina ärenden och Idag: kund, tid, typ och status */
export function NyRad({ titel, tid, under, status, statusFarg = 'bg-sky-400', onClick, markor }: {
  titel: string; tid?: string; under?: string; status?: string; statusFarg?: string; onClick?: () => void; markor?: MarkorProps
}) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className="grid w-full grid-cols-[1fr_auto] gap-x-2 border-b border-slate-700/60 bg-slate-800/30 px-2.5 py-2 text-left first:rounded-t-lg last:rounded-b-lg last:border-b-0 hover:bg-slate-800/60">
        <span className="truncate text-[12.5px] font-semibold text-white">{titel}</span>
        {tid && <span className="text-[11px] text-slate-400">{tid}</span>}
        {under && <span className="truncate text-[11px] text-slate-400">{under}</span>}
        {status && <span className="inline-flex items-center gap-1 text-[11px] text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${statusFarg}`} />{status}</span>}
      </button>
    </Markor>
  )
}

/** Rubrik för en grupp i en lista, med förklaringen under */
export function NyGrupp({ titel, antal, text, children }: { titel: string; antal?: number; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-2.5">
      <p className="flex items-center justify-between text-[12px] font-semibold text-white">{titel}{antal != null && <span className="text-slate-400">{antal}</span>}</p>
      {text && <p className="mb-1.5 text-[10.5px] text-slate-400">{text}</p>}
      <div className="overflow-hidden rounded-lg border border-slate-700/60">{children}</div>
    </div>
  )
}

/** Hjälptext under en rubrik i ett steg (grå), som portalens HjalpText */
export function NyHjalp({ rubrik, children }: { rubrik: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[12.5px] font-semibold text-white">{rubrik}</p>
      <p className="text-[11px] leading-snug text-slate-400">{children}</p>
    </div>
  )
}
