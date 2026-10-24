// src/pages/shared/intranet/guider/_nyvy_stationer.tsx
// Delade delar för teknikerguiderna om stationer i nya arbetsvyn (2026-10-24):
// kontrollrundan i steget Arbetet (StationInspectionPanel inbäddad med hideHeader),
// stationsarket, bekräftelserna, placeringen (EtableringsFlode, AddStationWizard,
// EquipmentPlacementForm) och sidan Stationer (NyUtrustning, KundLista, NyKundStationer).
// Etiketterna är kontrollerade mot källkoden 2026-10-24. Ingen modul: filen börjar
// med _ och hittas inte av registret. Ritar både telefon och dator (useGuideEnhet).

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { StationIcon } from '../../../../components/shared/stationIcons'
import { Markor, type MarkorProps } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import { Dubbelknapp, LokalIkon, TYPER, TypRuta, type StationTyp, type TypNyckel } from './_stationer'

export { TYPER, type StationTyp, type TypNyckel }

/** Markör på ett mål om det är det som ska tryckas nu */
export const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

// ─── Stationer och gränser ─────────────────────────

export interface Stn {
  nr: number
  typ: StationTyp
  /** Läge på den förenklade kartan, procent */
  x: number
  y: number
  tillagg?: boolean
}

/** Förbrukning och gränser per typ, som station_types (2026-10-24) */
export interface Matning { etikett: string; enhet: string; steg: number; varning: number | null; kritisk: number | null }

export const MATNING: Partial<Record<TypNyckel, Matning>> = {
  betong: { etikett: 'Förbrukning (g)', enhet: 'g', steg: 5, varning: 10, kritisk: 25 },
  betes: { etikett: 'Förbrukning (g)', enhet: 'g', steg: 5, varning: 10, kritisk: 25 },
  mekanisk: { etikett: 'Antal avdödade (st)', enhet: 'st', steg: 1, varning: 5, kritisk: 8 },
  ljus: { etikett: 'Antal fångade', enhet: 'st', steg: 1, varning: 20, kritisk: 40 },
}

export function matningFor(typ: StationTyp): Matning | null {
  const nyckel = (Object.keys(TYPER) as TypNyckel[]).find(k => TYPER[k].namn === typ.namn)
  return nyckel ? MATNING[nyckel] ?? null : null
}

export type Farg = 'gron' | 'gul' | 'rod' | 'ingen'

/** Samma färg som rutan i stationsarket (getMeasurementColor) */
export function matFarg(varde: number | null, m: Matning | null): Farg {
  if (varde === null || !m) return 'ingen'
  if (m.kritisk !== null && varde >= m.kritisk) return 'rod'
  if (m.varning !== null && varde >= m.varning) return 'gul'
  return 'gron'
}

const FARG_RAM: Record<Farg, string> = { gron: 'border-green-500', gul: 'border-amber-500', rod: 'border-red-500', ingen: 'border-slate-700' }
const FARG_TEXT: Record<Farg, string> = { gron: 'text-green-400', gul: 'text-amber-400', rod: 'text-red-400', ingen: 'text-white' }

// ─── Små delar ─────────────────────────────────────

/** Stationstypens ruta med ikon, som StationTypeTile. tillagg = liten markering. */
export function TypRutaLiten({ typ, storlek = 30, tillagg }: { typ: StationTyp; storlek?: number; tillagg?: boolean }) {
  return (
    <span className="relative inline-flex flex-none" aria-hidden>
      <span className="flex items-center justify-center rounded-[9px] text-[#fff]" style={{ backgroundColor: typ.farg, width: storlek, height: storlek }}>
        <StationIcon name={typ.ikon} className="h-[60%] w-[60%]" />
      </span>
      {tillagg && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold leading-none text-[#fff]">+</span>}
    </span>
  )
}

export const PRIM = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#20c58f] px-3 font-semibold text-[#04281c]'
export const SEK = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/60 px-3 font-semibold text-white'

/** Knapp i nya vyns stil */
export function NyKnapp({ children, ikon, prim, tyst, liten, onClick, markor, block, inaktiv }: {
  children: ReactNode; ikon?: IconName; prim?: boolean; tyst?: boolean; liten?: boolean; onClick?: () => void; markor?: MarkorProps; block?: boolean; inaktiv?: boolean
}) {
  const stil = prim ? PRIM : tyst ? 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 font-semibold text-slate-300' : SEK
  return (
    <Markor markor={markor} block={block}>
      <button type="button" onClick={onClick} aria-disabled={inaktiv}
        className={`${stil} ${liten ? 'h-8 text-[11.5px]' : 'h-9 text-[12.5px]'} ${block ? 'w-full' : ''} ${inaktiv ? 'opacity-50' : ''}`}>
        {ikon && <Icon name={ikon} size={16} />}
        {children}
      </button>
    </Markor>
  )
}

/** Grå hjälptext med rubrik, som HjalpText i stegen */
export function Hjalp({ rubrik, children }: { rubrik: string; children?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <p className="text-[12.5px] font-semibold text-white">{rubrik}</p>
      {children && <p className="text-[10.5px] leading-snug text-slate-400">{children}</p>}
    </div>
  )
}

/** Lager över hela skärmen: ark nerifrån i telefonen, ruta i mitten på datorn */
export function Lager({ children, mitten }: { children: ReactNode; mitten?: boolean }) {
  const enhet = useGuideEnhet()
  const iMitten = mitten || enhet === 'dator'
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${iMitten ? 'items-center justify-center p-3' : 'items-end'}`}>
      <div className={`flex max-h-full flex-col overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl ${iMitten ? 'w-full max-w-[300px] rounded-xl' : 'w-full rounded-t-2xl'}`}>
        {children}
      </div>
    </div>
  )
}

/** Bekräftelse i mitten, som snabb-OK och Klarmarkera ärende? */
export function Fraga({ titel, children, knappar }: { titel?: string; children?: ReactNode; knappar: ReactNode }) {
  return (
    <Lager mitten>
      <div className="grid gap-2 p-3">
        {titel && <p className="text-[13px] font-semibold text-white">{titel}</p>}
        {children}
        <div className="grid grid-cols-2 gap-1.5">{knappar}</div>
      </div>
    </Lager>
  )
}

/** Notis längst ner, som portalens toast */
export function Toast({ text }: { text: string }) {
  return (
    <div className="absolute bottom-3 left-2 right-2 z-40 flex items-start gap-2 rounded-xl bg-white px-2.5 py-2 text-[11.5px] text-slate-900 shadow-xl">
      <Icon name="allman.bock" size={16} className="text-[#20c58f]" />
      <span>{text}</span>
    </div>
  )
}

// ─── Kartan ────────────────────────────────────────

/** Förenklad karta med numrerade stationer. Kontrollerad = grön med bock, puls = blå ring. */
export function NyKarta({ stationer, kontrollerade, puls, hojd = 120, onStation, markor, markorPa, nedtonade }: {
  stationer: Stn[]; kontrollerade?: Set<number>; puls?: number | null; hojd?: number
  onStation?: (nr: number) => void; markor?: MarkorProps; markorPa?: number; nedtonade?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-[#1d2b24]" style={{ height: hojd }}>
      <div className="absolute inset-y-0 left-[38%] w-3 bg-slate-600/60" aria-hidden />
      <div className="absolute inset-x-0 top-[62%] h-3 bg-slate-600/60" aria-hidden />
      <div className="absolute left-[8%] top-[12%] h-[38%] w-[24%] rounded-sm bg-slate-500/40" aria-hidden />
      <div className="absolute left-[50%] top-[10%] h-[40%] w-[40%] rounded-sm bg-slate-500/40" aria-hidden />
      <div className="absolute left-[52%] top-[72%] h-[20%] w-[30%] rounded-sm bg-slate-500/30" aria-hidden />
      {stationer.map(s => {
        const klar = kontrollerade?.has(s.nr)
        const pulsar = puls === s.nr
        const knapp = (
          <button type="button" onClick={() => onStation?.(s.nr)} aria-label={`Station ${s.nr}`}
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold text-[#fff] shadow ${pulsar ? 'border-[3px] border-blue-500 motion-safe:animate-pulse' : klar ? 'border-[3px] border-green-600' : 'border-2 border-white'} ${nedtonade ? 'opacity-40' : ''}`}
            style={{ backgroundColor: klar ? '#22c55e' : s.typ.farg }}>
            {klar ? '✓' : s.nr}
          </button>
        )
        return (
          <span key={s.nr} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            {markorPa === s.nr ? <Markor markor={markor}>{knapp}</Markor> : knapp}
          </span>
        )
      })}
    </div>
  )
}

// ─── Kontrollrundan i steget Arbetet ───────────────

export interface Runda {
  stationer: Stn[]
  kontrollerade: Set<number>
  /** Förbrukning per station som sparats, för raden Kontrollerad nu · 15 g */
  varden?: Record<number, number>
  /** Rundan är startad: kön i nummerordning */
  runda: boolean
  /** Stationen som pulserar i rundan */
  puls?: number | null
}

/** Stationslistans rad: typruta, nummer och typ, senaste kontrollen, OK-bocken */
export function StationRad({ s, klar, varde, tryck, markera, nr }: {
  s: Stn; klar: boolean; varde?: number; tryck: (id: string) => void; markera?: string; nr: number
}) {
  const m = matningFor(s.typ)
  const detalj = klar
    ? <span className="text-[#20c58f]">Kontrollerad nu{varde !== undefined && m ? ` · ${varde} ${m.enhet}` : ''}</span>
    : <span className="text-slate-500">Senast 2026-09-28 · ingen aktivitet</span>
  return (
    <Markor markor={mk(markera, `rad:${s.nr}`, nr)} block>
      <div className={`flex items-center gap-2 rounded-lg border bg-slate-900 py-1 pl-1.5 pr-1 ${klar ? 'border-[#20c58f]/35' : 'border-slate-800'}`}>
        <button type="button" onClick={() => tryck(`rad:${s.nr}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <TypRutaLiten typ={s.typ} storlek={26} tillagg={s.tillagg} />
          <span className="min-w-0">
            <span className="block truncate text-[11.5px] font-semibold text-white">{s.nr} <span className="font-normal text-slate-400">{s.typ.namn}</span></span>
            <span className="block truncate text-[9.5px]">{detalj}</span>
          </span>
        </button>
        {klar ? (
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f] text-[#04140d]" aria-label="Kontrollerad"><Icon name="station.ok" size={16} /></span>
        ) : (
          <Markor markor={mk(markera, `ok:${s.nr}`, nr)}>
            <button type="button" onClick={() => tryck(`ok:${s.nr}`)} aria-label={`Station ${s.nr} OK`}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/10 text-[#20c58f]">
              <Icon name="station.ok" size={16} />
            </button>
          </Markor>
        )}
      </div>
    </Markor>
  )
}

/**
 * Kontrollen inbäddad i steget Arbetet: bocken Klarmarkera ärende, förloppet,
 * kommentaren, Ute/Inne med Starta runda, rundraden, kartan och listan.
 * Mål: 'klar', 'starta', 'avsluta-runda', 'hoppa', 'stn:N', 'rad:N', 'ok:N'.
 */
export function KontrollRunda({ r, tryck, markera, nr }: { r: Runda; tryck: (id: string) => void; markera?: string; nr: number }) {
  const enhet = useGuideEnhet()
  const totalt = r.stationer.length
  const klara = r.stationer.filter(s => r.kontrollerade.has(s.nr)).length
  const procent = totalt ? Math.round((klara / totalt) * 100) : 0
  const kvar = r.stationer.some(s => !r.kontrollerade.has(s.nr))
  const ko = r.stationer.filter(s => !r.kontrollerade.has(s.nr))
  const plats = r.puls ? ko.findIndex(s => s.nr === r.puls) + 1 : 0
  const sorterade = [...r.stationer].sort((a, b) => a.nr - b.nr)

  const karta = (
    <NyKarta stationer={r.stationer} kontrollerade={r.kontrollerade} puls={r.runda ? r.puls : null}
      hojd={enhet === 'dator' ? 150 : 104} onStation={n => tryck(`stn:${n}`)}
      markor={markera?.startsWith('stn:') ? { pa: true, nr } : undefined} markorPa={markera?.startsWith('stn:') ? Number(markera.slice(4)) : undefined} />
  )
  const lista = (
    <div className="grid gap-1">
      <p className="px-0.5 text-[10px] text-slate-400">{totalt} utomhusstationer</p>
      {sorterade.map(s => <StationRad key={s.nr} s={s} klar={r.kontrollerade.has(s.nr)} varde={r.varden?.[s.nr]} tryck={tryck} markera={markera} nr={nr} />)}
    </div>
  )

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex justify-between text-[10.5px] text-slate-300"><span>{klara} av {totalt} stationer</span><span className="tabular-nums">{procent} %</span></p>
          <div className="mt-0.5 h-1 w-full rounded-full bg-slate-700"><div className="h-1 rounded-full bg-[#20c58f]" style={{ width: `${procent}%` }} /></div>
        </div>
        {klara > 0 && (
          <Markor markor={mk(markera, 'klar', nr)}>
            <button type="button" onClick={() => tryck('klar')} aria-label="Klarmarkera ärende" title="Klarmarkera ärende"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#20c58f] text-[#04140d]">
              <Icon name="station.klar" size={20} />
            </button>
          </Markor>
        )}
      </div>
      <div className="flex gap-1">
        <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 text-[10.5px] text-slate-500"><Icon name="allman.anteckning" size={16} className="h-3.5 w-3.5" />Kommentar om besöket</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300"><Icon name="allman.foto" size={16} /></span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300"><Icon name="station.summa" size={16} /></span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="grid flex-1 grid-cols-2 gap-0.5 rounded-lg border border-slate-800 bg-slate-900 p-0.5">
          <span className="flex h-6 items-center justify-center gap-1 rounded-md bg-[#20c58f] text-[10.5px] font-semibold text-[#04140d]"><Icon name="station.ute" size={16} className="h-3.5 w-3.5" />Ute {klara}/{totalt}</span>
          <button type="button" onClick={() => tryck('inne')} className="flex h-6 items-center justify-center gap-1 rounded-md text-[10.5px] text-slate-300"><Icon name="station.inne" size={16} className="h-3.5 w-3.5" />Inne 0/0</button>
        </div>
        {!r.runda && kvar && (
          <Markor markor={mk(markera, 'starta', nr)}>
            <button type="button" onClick={() => tryck('starta')} className="flex h-7 items-center gap-1 rounded-lg bg-[#20c58f] px-2 text-[10.5px] font-semibold text-[#04140d]">
              <Icon name="station.runda" size={16} />Starta runda
            </button>
          </Markor>
        )}
      </div>
      {r.runda && kvar && (
        <div className="flex items-center justify-between rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10 px-2 py-1">
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-white">
            Station {plats || 1} av {ko.length}
            <Markor markor={mk(markera, 'hoppa', nr)}>
              <button type="button" onClick={() => tryck('hoppa')} aria-label="Hoppa över station" title="Hoppa över station" className="flex h-5 w-5 items-center justify-center rounded bg-slate-800/60 text-slate-300">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 5.5 14 12l-9 6.5z" /><path d="M18.5 5.5v13" /></svg>
              </button>
            </Markor>
          </span>
          <Markor markor={mk(markera, 'avsluta-runda', nr)}>
            <button type="button" onClick={() => tryck('avsluta-runda')} className="text-[10px] text-slate-300">Avsluta kontrollrunda</button>
          </Markor>
        </div>
      )}
      {!kvar && <p className="text-right text-[10px] text-[#20c58f]">Alla stationer kontrollerade. Tryck på en station för att ändra.</p>}
      {enhet === 'dator' ? (
        <div className="grid grid-cols-2 gap-2">{karta}<div className="max-h-[150px] overflow-hidden">{lista}</div></div>
      ) : (
        <>{karta}{lista}</>
      )}
    </div>
  )
}

// ─── Stationsarket ─────────────────────────────────

/**
 * Stationsarket i kontrollrundan: rubrik, verktygsraden Flytta, Byt typ, Historik
 * (och Hämta upp för tillägg), Senast, förbrukningen med − och +, gränserna,
 * Preparat (valfritt), Foto och Anteckning, Spara.
 * Mål: 'flytta', 'byttyp', 'historik', 'hamtaupp', 'minus', 'plus', 'preparat', 'foto', 'anteckning', 'spara', 'stang'.
 */
export function StationsArk({ s, varde, tryck, markera, nr, typLast, hamtaUpp }: {
  s: Stn; varde: number | null; tryck: (id: string) => void; markera?: string; nr: number
  /** Kunden har betalat stationen framåt: Byt typ är avstängd */
  typLast?: string
  /** Hämta upp är vald, knappen heter Spara och hämta upp */
  hamtaUpp?: boolean
}) {
  const m = matningFor(s.typ)
  const farg = matFarg(varde, m)
  const verktyg: { id: string; ikon: IconName; text: string; av?: boolean }[] = [
    { id: 'flytta', ikon: 'station.flytta', text: 'Flytta' },
    { id: 'byttyp', ikon: 'station.byttyp', text: 'Byt typ', av: !!typLast },
    { id: 'historik', ikon: 'station.historik', text: 'Historik' },
    ...(s.tillagg ? [{ id: 'hamtaupp', ikon: 'station.hamtaupp' as IconName, text: 'Hämta upp' }] : []),
  ]
  return (
    <Lager>
      <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-2">
        <TypRutaLiten typ={s.typ} storlek={32} tillagg={s.tillagg} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white">Station {s.nr}</p>
          <p className="truncate text-[10.5px] text-slate-400">{s.typ.namn}{s.tillagg && <span className="text-violet-400"> · tillägg</span>}</p>
        </div>
        <button type="button" onClick={() => tryck('stang')} aria-label="Stäng" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="allman.stang" size={16} /></button>
      </div>
      <div className="border-b border-slate-800 px-2.5 py-1.5">
        <div className={`grid gap-1 ${verktyg.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {verktyg.map(v => (
            <Markor key={v.id} markor={mk(markera, v.id, nr)} block>
              <button type="button" onClick={() => tryck(v.id)} aria-disabled={v.av}
                className={`flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl border text-[9.5px] ${v.id === 'hamtaupp' ? (hamtaUpp ? 'border-violet-400 bg-violet-500/20 text-violet-200' : 'border-violet-500/40 text-violet-300') : 'border-[#20c58f]/30 text-[#20c58f]'} ${v.av ? 'opacity-40' : ''}`}>
                <Icon name={v.ikon} size={16} />{v.text}
              </button>
            </Markor>
          ))}
        </div>
        {typLast && <p className="mt-1 text-[9.5px] text-slate-400">Typen kan inte bytas, kunden har betalat för stationen till och med {typLast}.</p>}
      </div>
      <div className="grid gap-1.5 px-2.5 py-2">
        <p className="text-[10px] text-slate-400">Senast 2026-09-28 · ingen aktivitet · Anna Exempel</p>
        {m && (
          <div className="grid gap-1">
            <p className="text-[10.5px] font-medium text-slate-300">{m.etikett}</p>
            <div className="flex items-stretch gap-1.5">
              <Markor markor={mk(markera, 'minus', nr)}>
                <button type="button" onClick={() => tryck('minus')} aria-label={`Minska med ${m.steg}`} className="flex h-10 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-lg text-slate-200">−</button>
              </Markor>
              <span className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border bg-slate-950 ${FARG_RAM[farg]}`}>
                <span className={`text-[20px] font-bold tabular-nums ${varde === null ? 'text-slate-600' : FARG_TEXT[farg]}`}>{varde ?? 0}</span>
                <span className="text-[10px] text-slate-400">{m.enhet}</span>
              </span>
              <Markor markor={mk(markera, 'plus', nr)}>
                <button type="button" onClick={() => tryck('plus')} aria-label={`Öka med ${m.steg}`} className="flex h-10 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-lg text-slate-200">+</button>
              </Markor>
            </div>
            <p className="flex gap-3 text-[10px]">
              {m.varning !== null && <span className="text-amber-400">Varning: {m.varning}</span>}
              {m.kritisk !== null && <span className="text-red-400">Kritisk: {m.kritisk}</span>}
            </p>
          </div>
        )}
        <div className="grid gap-0.5">
          <p className="text-[10.5px] font-medium text-slate-300">Preparat (valfritt)</p>
          <button type="button" onClick={() => tryck('preparat')} className="h-7 rounded-lg border border-slate-700 bg-slate-800 px-2 text-left text-[10.5px] text-white">Inget preparat</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => tryck('foto')} className="flex h-8 items-center justify-center gap-1 rounded-xl border border-dashed border-slate-600 text-[10.5px] text-slate-300"><Icon name="allman.foto" size={16} />Foto</button>
          <button type="button" onClick={() => tryck('anteckning')} className="flex h-8 items-center justify-center gap-1 rounded-xl border border-dashed border-slate-600 text-[10.5px] text-slate-300"><Icon name="allman.anteckning" size={16} />Anteckning</button>
        </div>
        {hamtaUpp && <p className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-1.5 text-[9.5px] text-violet-200">Stationen tas bort när du sparar. Den faktureras en sista gång i den här rundan.</p>}
      </div>
      <div className="border-t border-slate-800 px-2.5 py-2">
        <Markor markor={mk(markera, 'spara', nr)} block>
          <button type="button" onClick={() => tryck('spara')}
            className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-bold ${hamtaUpp ? 'bg-violet-400 text-[#04140d]' : 'bg-[#20c58f] text-[#04140d]'}`}>
            <Icon name="station.ok" size={16} />{hamtaUpp ? 'Spara och hämta upp' : 'Spara'}
          </button>
        </Markor>
      </div>
    </Lager>
  )
}

/** Bekräftelsen för snabb-OK: Markera Station N som OK? */
export function SnabbOk({ stn, tryck, markera, nr }: { stn: number; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <Fraga knappar={<>
      <NyKnapp liten block onClick={() => tryck('ok-avbryt')}>Avbryt</NyKnapp>
      <Markor markor={mk(markera, 'ok-ja', nr)} block>
        <button type="button" onClick={() => tryck('ok-ja')} className="h-8 w-full rounded-lg bg-green-600 text-[11.5px] font-medium text-[#fff]">OK</button>
      </Markor>
    </>}>
      <p className="text-center text-[12px] text-white">Markera <span className="font-bold text-green-400">Station {stn}</span> som OK?</p>
    </Fraga>
  )
}

/** Klarmarkera ärende? med antalen. Ja, klarmarkera går bara när alla är kontrollerade. */
export function Klarmarkera({ klara, totalt, tryck, markera, nr }: { klara: number; totalt: number; tryck: (id: string) => void; markera?: string; nr: number }) {
  const alla = klara >= totalt
  return (
    <Fraga titel="Klarmarkera ärende?" knappar={<>
      <NyKnapp liten block onClick={() => tryck('klar-avbryt')}>Avbryt</NyKnapp>
      <Markor markor={mk(markera, 'klar-ja', nr)} block>
        <button type="button" onClick={() => tryck('klar-ja')} aria-disabled={!alla}
          className={`h-8 w-full rounded-lg bg-green-600 text-[11.5px] font-medium text-[#fff] ${alla ? '' : 'opacity-50'}`}>Ja, klarmarkera</button>
      </Markor>
    </>}>
      {alla
        ? <p className="text-[11px] text-slate-300">Alla stationer är inspekterade.</p>
        : <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-[10.5px] text-amber-400">Du har inte inspekterat alla stationer ännu.</p>}
      <div className="rounded-lg bg-slate-950/50 p-1.5 text-[10.5px] text-slate-400">
        <p className="flex justify-between"><span>Utomhus:</span><span className={alla ? 'text-green-400' : 'text-amber-400'}>{klara}/{totalt}</span></p>
        <p className="flex justify-between"><span>Inomhus:</span><span className="text-green-400">0/0</span></p>
      </div>
    </Fraga>
  )
}

/** Steget Klart när ärendet är avslutat */
export function KlartAvslutat() {
  return (
    <div className="grid gap-2">
      <div className="flex items-start gap-2 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/10 p-2.5">
        <Icon name="falt.klart" size={20} className="flex-none text-[#20c58f]" />
        <div>
          <p className="text-[12.5px] font-semibold text-white">Ärendet är avslutat</p>
          <p className="text-[10.5px] text-slate-300">Status Avslutat, avslutsdatum 2026-10-26. Ändringar du gör nu sparar du med knappen nedan.</p>
        </div>
      </div>
      <span className={`${SEK} h-9 text-[12px]`}>Spara ändringar</span>
    </div>
  )
}

/** Steget Framme: hjälptexten, Öppna i kartor och Ring */
export function FrammeSteg({ kontakt }: { kontakt: string }) {
  return (
    <div className="grid gap-1.5">
      <Hjalp rubrik="Är du framme hos kunden?">Tryck på den gröna knappen när du står på plats. Kontrollera kontakten.</Hjalp>
      <div className="grid grid-cols-2 gap-1.5">
        <span className={`${SEK} h-9 text-[11px]`}><Icon name="falt.navigera" size={16} />Öppna i kartor</span>
        <span className={`${SEK} h-9 truncate text-[11px]`}><Icon name="kontakt.telefon" size={16} />Ring {kontakt}</span>
      </div>
      <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-2 text-[10.5px] text-slate-400">
        <p className="font-semibold text-slate-200">Kunden</p>
        <p>Exempelgatan 12, Gävle</p>
      </div>
    </div>
  )
}

// ─── Placeringen ───────────────────────────────────

/** Välj typ i placeringen (AddStationWizard): kunden vald, Utomhus eller Inomhus */
export function ValjTyp({ kund, tryck, markera, nr }: { kund: string; tryck: (id: string) => void; markera?: string; nr: number }) {
  const val = (id: string, titel: string, text: string, ikon: 'nal' | 'hus') => (
    <Markor markor={mk(markera, id, nr)} block>
      <button type="button" onClick={() => tryck(id)} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-800/50 p-2 text-left">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-700/60 text-slate-200"><LokalIkon namn={ikon} storlek={18} /></span>
        <span><span className="block text-[12.5px] font-semibold text-white">{titel}</span><span className="block text-[10.5px] text-slate-400">{text}</span></span>
      </button>
    </Markor>
  )
  return (
    <Lager>
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <p className="text-[13px] font-semibold text-white">Välj typ</p>
        <button type="button" onClick={() => tryck('wizard-stang')} aria-label="Stäng" className="text-slate-400"><Icon name="allman.stang" size={16} /></button>
      </div>
      <div className="grid gap-2 p-3">
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2">
          <p className="text-[10px] text-slate-400">Vald kund</p>
          <p className="text-[12px] font-medium text-white">{kund}</p>
        </div>
        <p className="text-[10.5px] text-slate-400">Var ska stationen placeras?</p>
        {val('utomhus', 'Utomhus', 'Placera på karta med GPS-position', 'nal')}
        {val('inomhus', 'Inomhus', 'Placera på planritning', 'hus')}
      </div>
    </Lager>
  )
}

export type Betalas = 'per år' | 'per månad' | 'per kontroll'

export interface Placering {
  typ: TypNyckel | null
  tillagg: boolean
  betalas: Betalas | null
  gps: boolean
  fel: string | null
  /** Placerade nu i den här omgången, för rubriken "station 2 nu" */
  placerade: number
  /** Kunden saknar avtal i avtalskartan: per år och per månad är avstängda */
  utanAvtal?: boolean
}

const RUTOR: TypNyckel[] = ['betes', 'betong', 'mekanisk', 'plat', 'ljus', 'krypande']

/**
 * Placera station utomhus (EtableringsFlode med EquipmentPlacementForm).
 * Mål: 'typ-<nyckel>', 'tillagg', 'betalas-<per år|per månad|per kontroll>', 'gps', 'karta', 'skapa', 'avbryt', 'form-stang'.
 */
export function PlaceraUtomhus({ kund, p, tryck, markera, nr }: { kund: string; p: Placering; tryck: (id: string) => void; markera?: string; nr: number }) {
  const enhet = useGuideEnhet()
  const modeller: { id: Betalas; hjalp: string }[] = [
    { id: 'per år', hjalp: 'Betalas för månaderna kvar till avtalets nästa år.' },
    { id: 'per månad', hjalp: 'Faktureras månadsvis, årspriset delat med tolv.' },
    { id: 'per kontroll', hjalp: 'Debiteras etablering och varje kontrollrunda.' },
  ]
  return (
    <Lager>
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">Placera station utomhus</p>
          <p className="truncate text-[10.5px] text-slate-400">{kund}{p.placerade > 0 ? `, station ${p.placerade + 1} nu` : ''}</p>
        </div>
        <Markor markor={mk(markera, 'form-stang', nr)}>
          <button type="button" onClick={() => tryck('form-stang')} aria-label="Stäng och avsluta placeringen" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </Markor>
      </div>
      <div className="grid min-h-0 gap-1.5 overflow-hidden px-3 py-2">
        <p className="text-[10.5px] font-medium text-slate-400">Utrustningstyp *</p>
        <div className={`grid gap-1 ${enhet === 'dator' ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {RUTOR.map(k => <TypRuta key={k} typ={TYPER[k]} vald={p.typ === k} onClick={() => tryck(`typ-${k}`)} markor={mk(markera, `typ-${k}`, nr)} />)}
        </div>
        <Markor markor={mk(markera, 'tillagg', nr)} block>
          <button type="button" onClick={() => tryck('tillagg')} role="checkbox" aria-checked={p.tillagg}
            className="flex w-full items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/30 p-1.5 text-left">
            <span className={`mt-0.5 flex h-3.5 w-3.5 flex-none items-center justify-center rounded border ${p.tillagg ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>{p.tillagg && <Icon name="allman.bock" size={16} className="h-2.5 w-2.5" />}</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-slate-200">Tillägg utöver avtal</span>
              <span className="block text-[9.5px] leading-snug text-slate-400">Stationen ingår inte i avtalets årspremie. Välj hur den betalas: priserna kommer från kundens prislista.</span>
            </span>
          </button>
        </Markor>
        {p.tillagg && (
          <div className="grid gap-0.5" role="radiogroup" aria-label="Betalas">
            <p className="text-[10px] font-medium text-slate-400">Betalas</p>
            {modeller.map(mo => {
              const av = !!p.utanAvtal && mo.id !== 'per kontroll'
              return (
                <Markor key={mo.id} markor={mk(markera, `betalas-${mo.id}`, nr)} block>
                  <button type="button" role="radio" aria-checked={p.betalas === mo.id} onClick={() => tryck(`betalas-${mo.id}`)}
                    className={`w-full rounded-lg border px-2 py-1 text-left ${p.betalas === mo.id ? 'border-[#20c58f]/60 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/40'} ${av ? 'opacity-50' : ''}`}>
                    <span className="block text-[10.5px] text-slate-200">{mo.id}</span>
                    <span className="block text-[9px] leading-snug text-slate-500">{av ? 'Kräver att kunden har ett avtal i avtalskartan' : mo.hjalp}</span>
                  </button>
                </Markor>
              )
            })}
          </div>
        )}
        <p className="text-[10.5px] font-medium text-slate-400">GPS-position *</p>
        <div className="grid grid-cols-2 gap-1">
          <Dubbelknapp titel={p.gps ? 'GPS hämtad' : 'Hämta GPS'} klar={p.gps} ikon={<LokalIkon namn="gps" storlek={18} />} onClick={() => tryck('gps')} markor={mk(markera, 'gps', nr)} />
          <Dubbelknapp titel="Välj på karta" ikon={<LokalIkon namn="karta" storlek={18} />} onClick={() => tryck('karta')} markor={mk(markera, 'karta', nr)} />
        </div>
        {p.gps && <p className="flex justify-between text-[10.5px] text-slate-400"><span>Noggrannhet</span><span className="text-green-400">4 m (Utmärkt)</span></p>}
        {p.fel && <p className="text-[10.5px] text-red-400">{p.fel}</p>}
      </div>
      <div className="grid grid-cols-2 gap-1.5 border-t border-slate-700 px-3 py-2">
        <NyKnapp liten block onClick={() => tryck('avbryt')} markor={mk(markera, 'avbryt', nr)}>Avbryt</NyKnapp>
        <NyKnapp liten block prim onClick={() => tryck('skapa')} markor={mk(markera, 'skapa', nr)}>Skapa placering</NyKnapp>
      </div>
    </Lager>
  )
}

/** Stationen är placerad: Placera fler utomhus, Placera inomhus, Färdig med etablering */
export function Placerad({ kund, antal, tryck, markera, nr }: { kund: string; antal: number; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <Lager>
      <div className="grid justify-items-center gap-1 p-4 text-center">
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[#20c58f]/15 text-[#20c58f]"><Icon name="station.klar" size={24} /></span>
        <p className="text-[13.5px] font-semibold text-white">Stationen är placerad</p>
        <p className="text-[11.5px] text-slate-300">{kund}</p>
        <p className="mb-2 text-[10.5px] text-slate-400">{antal} {antal === 1 ? 'station' : 'stationer'} placerade nu</p>
        <div className="grid w-full gap-1.5">
          <NyKnapp prim block ikon="station.ute" onClick={() => tryck('fler')} markor={mk(markera, 'fler', nr)}>Placera fler utomhus</NyKnapp>
          <NyKnapp block ikon="station.inne" onClick={() => tryck('inne')} markor={mk(markera, 'inne', nr)}>Placera inomhus</NyKnapp>
          <NyKnapp tyst block ikon="allman.bock" onClick={() => tryck('fardig')} markor={mk(markera, 'fardig', nr)}>Färdig med etablering</NyKnapp>
        </div>
      </div>
    </Lager>
  )
}

/** Frågan efter etableringen när kunden saknar schema */
export function SchemaFraga({ kund, tryck, markera, nr }: { kund: string; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <Lager>
      <div className="grid gap-2 p-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#20c58f]/15 text-[#20c58f]"><Icon name="kund.schema" size={20} /></span>
        <p className="text-[13.5px] font-semibold text-white">Återkommande kontroller</p>
        <p className="text-[11px] text-slate-400">{kund} har inget schema. Vill du lägga upp kontrollerna nu? Du kan också göra det senare under kundens Schema.</p>
        <div className="grid grid-cols-2 gap-1.5">
          <NyKnapp block onClick={() => tryck('senare')} markor={mk(markera, 'senare', nr)}>Senare</NyKnapp>
          <NyKnapp block prim onClick={() => tryck('schema')} markor={mk(markera, 'schema', nr)}>Lägg upp schema</NyKnapp>
        </div>
      </div>
    </Lager>
  )
}

// ─── Sidan Stationer ───────────────────────────────

/** Pågående etablering, som rutan på kundsidan och i Att göra: X av Y stationer placerade */
export function PagaendeRuta({ kund, placerade, avtalat, tillagg = 0, tryck, markera, nr, kompakt }: {
  kund: string; placerade: number; avtalat: number; tillagg?: number; tryck: (id: string) => void; markera?: string; nr: number; kompakt?: boolean
}) {
  const klar = placerade >= avtalat
  const punkt = klar ? 'bg-[#20c58f]' : placerade === 0 ? 'bg-amber-500' : 'bg-slate-500'
  return (
    <div className="rounded-xl border border-[#20c58f]/40 bg-slate-800/30 p-2">
      {!kompakt && <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="bokning.etablering" size={16} className="text-violet-400" />Pågående etablering</p>}
      <p className="text-[12px] font-semibold text-white">{kund}</p>
      <p className="flex items-center gap-1.5 text-[10.5px] text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${punkt}`} />{placerade} av {avtalat} {kompakt ? 'placerade, Bokad idag 08:00' : 'stationer placerade'}</p>
      {tillagg > 0 && <p className="text-[10px] text-slate-400">{tillagg} {tillagg === 1 ? 'tilläggsstation' : 'tilläggsstationer'} utöver avtalet</p>}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <NyKnapp liten block prim={!klar} ikon="utrustning.placera" onClick={() => tryck('placera')} markor={mk(markera, 'placera', nr)}>Placera station</NyKnapp>
        <NyKnapp liten block prim={klar} ikon="station.klar" onClick={() => tryck('avsluta')} markor={mk(markera, 'avsluta', nr)}>Avsluta etablering</NyKnapp>
      </div>
    </div>
  )
}

/** Väljaren Kunder / Karta / Kontroller, eller kundsidans Karta / Lista / Planritning / Schema */
export function Vaxel({ val, valt, tryck, markera, nr }: { val: { id: string; text: string; ikon: IconName; antal?: number }[]; valt: string; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
      {val.map(v => (
        <Markor key={v.id} markor={mk(markera, `flik:${v.id}`, nr)} block>
          <button type="button" onClick={() => tryck(`flik:${v.id}`)}
            className={`flex h-7 w-full items-center justify-center gap-1 rounded-md px-1 text-[10.5px] ${valt === v.id ? 'bg-slate-700 font-semibold text-white' : 'text-slate-400'}`}>
            <Icon name={v.ikon} size={16} className="h-3.5 w-3.5" />{v.text}{v.antal != null && <span className="text-slate-500">{v.antal}</span>}
          </button>
        </Markor>
      ))}
    </div>
  )
}

export interface Kund { namn: string; ort: string; ute: number; inne: number; typer: TypNyckel[]; status: { text: string; ton: 'gron' | 'gul' }; schema: boolean; egen: boolean }

export const KUNDER: Kund[] = [
  { namn: 'Brf Exempelgården', ort: 'Gävle', ute: 8, inne: 4, typer: ['betong', 'mekanisk'], status: { text: 'Nästa kontroll 2026-11-02', ton: 'gron' }, schema: true, egen: false },
  { namn: 'Exempel AB', ort: 'Sandviken', ute: 6, inne: 0, typer: ['betong'], status: { text: 'Inget schema', ton: 'gul' }, schema: false, egen: true },
  { namn: 'Exempellagret AB', ort: 'Gävle', ute: 4, inne: 4, typer: ['betong', 'ljus'], status: { text: 'Enstaka avvikelser', ton: 'gul' }, schema: true, egen: true },
]

/** En kundrad i Stationer, smal yta: namn, ort och antal, typrutor, status och Schema eller Schemalägg */
export function KundRad({ k, tryck, markera, nr }: { k: Kund; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-slate-700/60 bg-slate-900 px-2 py-1.5 last:border-b-0">
      <Markor markor={mk(markera, `kund:${k.namn}`, nr)} block>
        <button type="button" onClick={() => tryck(`kund:${k.namn}`)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[12px] font-semibold text-white">{k.namn}</span>
          <span className="block truncate text-[10px] text-slate-400">{k.ort}, {k.ute} ute, {k.inne} inne</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {k.typer.map(t => <TypRutaLiten key={t} typ={TYPER[t]} storlek={14} />)}
            <span className="inline-flex items-center gap-1 text-[9.5px] text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${k.status.ton === 'gron' ? 'bg-[#20c58f]' : 'bg-amber-400'}`} />{k.status.text}</span>
          </span>
        </button>
      </Markor>
      <NyKnapp liten ikon={k.schema ? 'kund.schema' : 'arendelista.boka'} onClick={() => tryck(k.schema ? `schema:${k.namn}` : `schemalagg:${k.namn}`)} markor={mk(markera, k.schema ? `schema:${k.namn}` : `schemalagg:${k.namn}`, nr)}>
        {k.schema ? 'Schema' : 'Schemalägg'}
      </NyKnapp>
    </div>
  )
}

/** Sökrutan, sorteringen och Alla / Mina */
export function KundVerktyg({ sok, mina, tryck, markera, nr }: { sok: string; mina: boolean; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <div className="grid gap-1">
      <Markor markor={mk(markera, 'sok', nr)} block>
        <button type="button" onClick={() => tryck('sok')} className={`flex h-8 w-full items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 text-left text-[10.5px] ${sok ? 'text-white' : 'text-slate-500'}`}>
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-500" />{sok || 'Sök kund, enhet, adress eller org.nr'}
        </button>
      </Markor>
      <div className="flex gap-1">
        <Markor markor={mk(markera, 'sortera', nr)} block>
          <button type="button" onClick={() => tryck('sortera')} className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10.5px] text-white">
            <Icon name="utrustning.sortera" size={16} className="h-3.5 w-3.5 text-slate-500" />A till Ö
          </button>
        </Markor>
        <div className="flex flex-none rounded-lg border border-slate-700 bg-slate-900 p-0.5" role="tablist" aria-label="Vems stationer">
          {(['Alla', 'Mina'] as const).map(t => (
            <Markor key={t} markor={mk(markera, t === 'Alla' ? 'alla' : 'mina', nr)}>
              <button type="button" role="tab" aria-selected={(t === 'Mina') === mina} onClick={() => tryck(t === 'Alla' ? 'alla' : 'mina')}
                className={`h-7 min-w-[40px] rounded-md px-2 text-[10.5px] font-medium ${(t === 'Mina') === mina ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>{t}</button>
            </Markor>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Exemplets stationer hos Exempel AB: fyra betongstationer och två mekaniska fällor */
export const SEX: Stn[] = [
  { nr: 1, typ: TYPER.betong, x: 18, y: 26 },
  { nr: 2, typ: TYPER.betong, x: 30, y: 80 },
  { nr: 3, typ: TYPER.mekanisk, x: 47, y: 22 },
  { nr: 4, typ: TYPER.betong, x: 62, y: 56 },
  { nr: 5, typ: TYPER.mekanisk, x: 75, y: 85 },
  { nr: 6, typ: TYPER.betong, x: 88, y: 30 },
]

/** Avsluta etableringen hos X? (AvslutaEtablering): Avsluta etablering när alla är ute, annars Avsluta ändå */
export function AvslutaFraga({ kund, placerade, avtalat, tryck, markera, nr }: { kund: string; placerade: number; avtalat: number; tryck: (id: string) => void; markera?: string; nr: number }) {
  const klar = placerade >= avtalat
  return (
    <Lager>
      <div className="grid gap-2 p-3.5">
        <p className="text-[13.5px] font-semibold leading-snug text-white">Avsluta etableringen hos {kund}?</p>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {klar ? `Alla ${avtalat} stationer är placerade.` : `${placerade} av ${avtalat} stationer är placerade, ${avtalat - placerade} saknas.`} Ärendet stängs och tilläggsstationer faktureras.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <NyKnapp block onClick={() => tryck('avsluta-avbryt')} markor={mk(markera, 'avsluta-avbryt', nr)}>Avbryt</NyKnapp>
          <NyKnapp block prim={klar} onClick={() => tryck('avsluta-ja')} markor={mk(markera, 'avsluta-ja', nr)}>{klar ? 'Avsluta etablering' : 'Avsluta ändå'}</NyKnapp>
        </div>
      </div>
    </Lager>
  )
}

export interface Etablering { kund: string; placerade: number; avtalat: number; tillagg?: number }

/**
 * Sidan Stationer (NyUtrustning): Att göra med Pågående etablering, väljaren
 * Kunder / Karta / Kontroller och kundlistan med sök, sortering och Alla / Mina.
 * På datorn står Placera station uppe till höger och Att göra i en kolumn bredvid.
 */
export function StationerSida({ etablering, flik = 'kunder', mina = false, sok = '', kunder = KUNDER, tryck, markera, nr, kontroller }: {
  etablering?: Etablering; flik?: 'kunder' | 'karta' | 'kontroller'; mina?: boolean; sok?: string; kunder?: Kund[]
  tryck: (id: string) => void; markera?: string; nr: number; kontroller?: ReactNode
}) {
  const enhet = useGuideEnhet()
  const synliga = kunder.filter(k => (!mina || k.egen) && (!sok || k.namn.toLowerCase().includes(sok.toLowerCase())))
  const attGora = etablering && (
    <div className="grid content-start gap-1">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-white"><Icon name="arendelista.att-gora" size={16} className="text-[#20c58f]" />Att göra</p>
      <PagaendeRuta kund={etablering.kund} placerade={etablering.placerade} avtalat={etablering.avtalat} tillagg={etablering.tillagg} tryck={tryck} markera={markera} nr={nr} />
    </div>
  )
  const huvud = (
    <div className="grid content-start gap-1.5">
      <Vaxel valt={flik} tryck={tryck} markera={markera} nr={nr} val={[
        { id: 'kunder', text: 'Kunder', ikon: 'allman.foretag' },
        { id: 'karta', text: 'Karta', ikon: 'falt.karta' },
        { id: 'kontroller', text: 'Kontroller', ikon: 'utrustning.kontroller', antal: 1 },
      ]} />
      {flik === 'kunder' && (
        <>
          <KundVerktyg sok={sok} mina={mina} tryck={tryck} markera={markera} nr={nr} />
          <div className="overflow-hidden rounded-lg border border-slate-700/60">
            {synliga.length ? synliga.map(k => <KundRad key={k.namn} k={k} tryck={tryck} markera={markera} nr={nr} />)
              : <p className="p-3 text-center text-[11px] text-slate-300">{sok ? 'Ingen kund matchar sökningen.' : 'Inga kunder med stationer än.'}</p>}
          </div>
        </>
      )}
      {flik === 'karta' && (
        <>
          <p className="text-[10px] text-slate-400">Kartan visar stationerna du själv har placerat, oavsett Alla eller Mina.</p>
          <NyKarta stationer={SEX} hojd={170} />
        </>
      )}
      {flik === 'kontroller' && kontroller}
    </div>
  )
  if (enhet === 'dator') {
    return (
      <div className="grid gap-2">
        <div className="flex justify-end gap-1.5">
          <span className={`${SEK} h-8 text-[11px]`}><Icon name="utrustning.uppdatera" size={16} />Uppdatera</span>
          <NyKnapp liten prim ikon="falt.nystation" onClick={() => tryck('placera-ny')} markor={mk(markera, 'placera-ny', nr)}>Placera station</NyKnapp>
        </div>
        <div className={`grid gap-2 ${attGora ? 'grid-cols-[minmax(0,1fr)_170px]' : ''}`}>
          {huvud}
          {attGora}
        </div>
      </div>
    )
  }
  return (
    <div className="relative grid h-full content-start gap-2 overflow-hidden">
      {attGora}
      {huvud}
      <span className="absolute bottom-1 right-1">
        <NyKnapp liten prim ikon="falt.nystation" onClick={() => tryck('placera-ny')} markor={mk(markera, 'placera-ny', nr)}>Placera station</NyKnapp>
      </span>
    </div>
  )
}

/**
 * Kundens sida (NyKundStationer): kundhuvudet med Ring, Mejla och Navigera,
 * Pågående etablering eller Placera ny station, väljaren Karta / Lista /
 * Planritning / Schema och innehållet.
 */
export function KundSida({ kund, adress, stationer, flik = 'karta', etablering, tryck, markera, nr, schema }: {
  kund: string; adress: string; stationer: Stn[]; flik?: 'karta' | 'lista' | 'planritning' | 'schema'; etablering?: Etablering
  tryck: (id: string) => void; markera?: string; nr: number; schema?: ReactNode
}) {
  const enhet = useGuideEnhet()
  const kontakt = (ikon: IconName, text: string) => <span className={`${SEK} h-7 text-[10.5px]`}><Icon name={ikon} size={16} className="h-3.5 w-3.5" />{text}</span>
  return (
    <div className="grid content-start gap-1.5 overflow-hidden">
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-2">
        <div className="flex items-start gap-1.5">
          <button type="button" onClick={() => tryck('tillbaka-stationer')} aria-label="Tillbaka till Stationer" className="flex h-6 w-6 items-center justify-center rounded text-slate-400"><Icon name="allman.chevron" size={16} className="rotate-180" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{kund}</p>
            <p className="truncate text-[10.5px] text-slate-400">{adress}</p>
            <p className="flex gap-2 text-[10px] text-slate-300"><span>{stationer.length} ute</span><span>0 inne</span><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Inga avvikelser</span></p>
          </div>
          {enhet === 'dator'
            ? <span className={`${SEK} h-7 text-[10.5px]`}><Icon name="utrustning.stationskarta" size={16} className="h-3.5 w-3.5" />Stationskarta, PDF</span>
            : <Icon name="utrustning.stationskarta" size={20} className="text-slate-400" />}
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1">{kontakt('kontakt.telefon', 'Ring')}{kontakt('kontakt.mejl', 'Mejla')}{kontakt('falt.navigera', 'Navigera')}</div>
      </div>
      {etablering
        ? <PagaendeRuta kund={etablering.kund} placerade={etablering.placerade} avtalat={etablering.avtalat} tillagg={etablering.tillagg} tryck={tryck} markera={markera} nr={nr} />
        : <NyKnapp block prim ikon="falt.nystation" onClick={() => tryck('placera-ny')} markor={mk(markera, 'placera-ny', nr)}>Placera ny station</NyKnapp>}
      <Vaxel valt={flik} tryck={tryck} markera={markera} nr={nr} val={[
        { id: 'karta', text: 'Karta', ikon: 'falt.karta', antal: stationer.length },
        { id: 'lista', text: 'Lista', ikon: 'allman.lista', antal: stationer.length },
        { id: 'planritning', text: enhet === 'dator' ? 'Planritning' : 'Ritning', ikon: 'utrustning.planritning', antal: 0 },
        { id: 'schema', text: 'Schema', ikon: 'kund.schema' },
      ]} />
      {flik === 'karta' && (
        <NyKarta stationer={stationer} hojd={enhet === 'dator' ? 170 : 150} onStation={n => tryck(`stn:${n}`)}
          markor={markera?.startsWith('stn:') ? { pa: true, nr } : undefined} markorPa={markera?.startsWith('stn:') ? Number(markera.slice(4)) : undefined} />
      )}
      {flik === 'lista' && (
        <div className="grid gap-1">{stationer.map(s => (
          <button key={s.nr} type="button" onClick={() => tryck(`stn:${s.nr}`)} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 p-1 text-left">
            <TypRutaLiten typ={s.typ} storlek={22} tillagg={s.tillagg} /><span className="text-[11px] font-semibold text-white">Station {s.nr}</span><span className="text-[10px] text-slate-400">{s.typ.namn}</span>
          </button>
        ))}</div>
      )}
      {flik === 'planritning' && <p className="rounded-lg border border-slate-700 p-3 text-center text-[11px] text-slate-400">Inga planritningar</p>}
      {flik === 'schema' && schema}
    </div>
  )
}
