// src/pages/shared/intranet/guider/guide-mina-arenden.tsx
// Guidemodul: Håll koll på dina ärenden i Mina ärenden (tekniker, telefon och dator).
// Källor: NyMinaArenden.tsx (sammanfattningen överst, lägena Att göra, Kommande och
// Avslutade, Den här veckan, Väntar på dig med Behöver en tid och Passerade besök att
// avsluta, Övriga öppna ärenden, De närmaste 4 veckorna, Längre fram, Avslutade per månad),
// arenden/ArendeVerktyg (Filtrera listan, Filter med Typ och Ålder, Sortera), arenden/ArendeRad
// (telefon: tryck öppnar; dator: klick väljer, ikonen Öppna ärendet öppnar), ArendeForhandsvisning
// (Valt ärende) och arendeLogik (30 dagar, Äldst först, Nyast först, Kund A till Ö).

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { TYP_IKON } from '../../../../components/technician/ny/besokTyp'
import type { BesokTyp } from '../../../../services/teknikerDagService'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { ArendeFramme, IdagSida, Mal, Punkt, Rulla, UNDER_IDAG, gorMk, ingenMk, type ExBesok, type Mk, type Tryck } from './_nyvy_min_dag'

// ─── Exempelärenden ────────────────────────────────

type Ton = 'gron' | 'gul' | 'rod' | 'bla' | 'gra'
interface Rad {
  id: string; datum: string; tid?: string; kund: string; ort: string; typ: BesokTyp; beskr: string
  status: string; ton: Ton; extra?: string; ring?: boolean; nr: string
}

const VECKA: Rad[] = [
  { id: 'v1', datum: 'Idag', tid: '08:00', kund: 'Familjen Exempel', ort: 'Södertälje', typ: 'private', beskr: 'Privat, råttor', status: 'Bokad', ton: 'bla', nr: 'BE-0001234' },
  { id: 'v2', datum: 'Idag', tid: '10:30', kund: 'Exempel AB', ort: 'Södertälje', typ: 'inspection', beskr: 'Kontrollbesök', status: 'Bokad', ton: 'bla', nr: 'BE-0001190' },
  { id: 'v3', datum: 'Idag', tid: '13:00', kund: 'Brf Exempelgården', ort: 'Nykvarn', typ: 'establishment', beskr: 'Etablering', status: 'Bokad', ton: 'bla', nr: 'BE-0001301' },
  { id: 'v4', datum: 'Tis', tid: '08:00', kund: 'Brf Exempelgården', ort: 'Nykvarn', typ: 'inspection', beskr: 'Kontrollbesök', status: 'Bokad', ton: 'bla', nr: 'BE-0001302' },
]
const BOKA: Rad = { id: 'boka', datum: 'Ingen tid', kund: 'Exempel AB', ort: 'Södertälje', typ: 'business', beskr: 'Företag, getingar', status: 'Inte bokad', ton: 'gra', ring: true, nr: 'BE-0001340' }
const AVSLUTA: Rad = { id: 'avsluta', datum: '20 okt', tid: '13:00', kund: 'Familjen Exempel', ort: 'Södertälje', typ: 'private', beskr: 'Privat, möss', status: 'Inte avslutat', extra: '6 dagar sedan', ton: 'gra', nr: 'BE-0001198' }
const KOMMANDE: Rad[] = [
  { id: 'k1', datum: 'Mån 2 nov', tid: '09:00', kund: 'Exempel AB', ort: 'Södertälje', typ: 'routine', beskr: 'Rutinbesök', status: 'Bokad', ton: 'bla', nr: 'BE-0001350' },
  { id: 'k2', datum: 'Tor 5 nov', tid: '13:00', kund: 'Familjen Exempel', ort: 'Södertälje', typ: 'private', beskr: 'Privat, råttor', status: 'Återbesök', ton: 'bla', nr: 'BE-0001234' },
]
const AVSLUTADE: Rad[] = [
  { id: 'a1', datum: '23 okt', kund: 'Exempel AB', ort: 'Södertälje', typ: 'inspection', beskr: 'Kontrollbesök', status: 'Klart', ton: 'gron', nr: 'BE-0001170' },
  { id: 'a2', datum: '21 okt', kund: 'Brf Exempelgården', ort: 'Nykvarn', typ: 'business', beskr: 'Företag, vägglöss', status: 'Klart', ton: 'gron', nr: 'BE-0001160' },
]

const ANTAL = { attgora: 6, kommande: 5, avslutade: 12 }
const SAMMANFATTNING = '4 besök kvar den här veckan. 1 ärende behöver en tid och 1 passerat besök ska avslutas, det äldsta från 20 oktober.'

const SOM_BESOK: ExBesok = { id: 'avsluta', tid: '13:00', slut: '14:00', kund: 'Familjen Exempel', typ: 'private', beskr: 'Privat, möss', adress: 'Exempelvägen 4, Södertälje', ort: 'Södertälje', nr: 'BE-0001198', status: 'Bokad', telefon: '070-123 45 67' }

type Lage = 'attgora' | 'kommande' | 'avslutade'

// ─── Delar ─────────────────────────────────────────

function Sektion({ rubrik, ikon, antal, betonad, children, text }: { rubrik: string; ikon: IconName; antal: number; betonad?: boolean; text: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <div>
        <p className="flex items-center justify-between text-[12px] font-semibold text-white">
          <span className="flex items-center gap-1.5"><Icon name={ikon} size={16} className="h-3.5 w-3.5 text-[#20c58f]" />{rubrik}</span>
          <span className={`font-mono text-[11px] ${betonad ? 'text-white' : 'text-slate-400'}`}>{antal}</span>
        </p>
        <p className="text-[10px] leading-snug text-slate-400">{text}</p>
      </div>
      {children}
    </section>
  )
}

function Etikett({ text, antal }: { text: string; antal: number }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">{text}</span>
      <span className="font-mono text-[9.5px] text-slate-500">{antal}</span>
      <span aria-hidden className="h-px flex-1 bg-slate-700/60" />
    </div>
  )
}

function Hopfall({ rubrik, detalj, antal, oppen }: { rubrik: string; detalj?: string; antal: number; oppen?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 px-2 py-1.5">
      <Icon name="allman.chevron" size={16} className={`h-3 w-3 text-slate-400 ${oppen ? 'rotate-90' : ''}`} />
      <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-medium text-white">{rubrik}</span>{detalj && <span className="block truncate text-[9.5px] text-slate-400">{detalj}</span>}</span>
      <span className="font-mono text-[10.5px] text-slate-400">{antal}</span>
    </div>
  )
}

/** En rad. Telefon: två rader, tryck öppnar (mål rad:<id>). Dator: kolumner, klick väljer, ikonen öppnar (oppna:<id>). */
function ArendeRad({ r, vald, mk, tryck }: { r: Rad; vald?: boolean; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const sekundar: IconName = r.ring ? 'kontakt.telefon' : 'falt.navigera'
  if (enhet === 'dator') {
    return (
      <li className={`relative flex items-center gap-0.5 border-b border-slate-700/60 pr-0.5 last:border-b-0 ${vald ? 'bg-slate-800' : ''}`}>
        {vald && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#20c58f]" />}
        <Mal id={`rad:${r.id}`} mk={mk} tryck={tryck} className="grid min-w-0 flex-1 grid-cols-[52px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 py-1.5 pl-2">
          <span className="flex flex-col"><span className="text-[10.5px] font-medium text-white">{r.datum}</span>{r.tid && <span className="font-mono text-[9.5px] text-slate-400">{r.tid}</span>}</span>
          <span className="flex min-w-0 flex-col"><span className="truncate text-[11.5px] font-medium text-white">{r.kund}</span><span className="truncate text-[9.5px] text-slate-400">{r.ort}</span></span>
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-slate-300"><Icon name={TYP_IKON[r.typ]} size={16} className="h-3 w-3 flex-none text-slate-400" /><span className="truncate">{r.beskr}</span></span>
          <span className="flex min-w-0 flex-col"><Punkt ton={r.ton}>{r.status}</Punkt>{r.extra && <span className="pl-2.5 text-[9.5px] text-slate-400">{r.extra}</span>}</span>
        </Mal>
        {r.status !== 'Klart' && <span className="flex h-7 w-7 flex-none items-center justify-center text-slate-400"><Icon name={sekundar} size={16} /></span>}
        <Markor markor={mk(`oppna:${r.id}`)}>
          <button type="button" onClick={() => tryck?.(`oppna:${r.id}`)} aria-label={`Öppna ärendet ${r.kund}`} title="Öppna ärendet"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
            <Icon name="arende.arende" size={16} />
          </button>
        </Markor>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-0.5 border-b border-slate-700/60 pr-0.5 last:border-b-0">
      <Mal id={`rad:${r.id}`} mk={mk} tryck={tryck} className="grid min-w-0 flex-1 gap-0.5 py-1.5 pl-2">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[11.5px] font-medium text-white">{r.kund}</span>
          <span className="flex-none text-[10px] text-slate-300">{r.datum}{r.tid && <span className="font-mono text-slate-400"> {r.tid}</span>}</span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400"><Icon name={TYP_IKON[r.typ]} size={16} className="h-3 w-3 flex-none" /><span className="truncate">{r.beskr}, {r.ort}</span></span>
          <Punkt ton={r.ton}>{r.extra ?? r.status}</Punkt>
        </span>
      </Mal>
      {r.status !== 'Klart' && <span className="flex h-8 w-8 flex-none items-center justify-center text-slate-400"><Icon name={sekundar} size={16} /></span>}
    </li>
  )
}

function Lista({ rader, vald, mk, tryck }: { rader: Rad[]; vald?: string | null; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900">
      {enhet === 'dator' && (
        <div aria-hidden className="flex items-center border-b border-slate-700/60 pr-0.5">
          <div className="grid flex-1 grid-cols-[52px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 py-1 pl-2 text-[9px] font-medium text-slate-500"><span>Datum</span><span>Kund och ort</span><span>Typ</span><span>Status</span></div>
          <span className="w-14 pr-1 text-right text-[9px] font-medium text-slate-500">Åtgärd</span>
        </div>
      )}
      <ul>{rader.map(r => <ArendeRad key={r.id} r={r} vald={vald === r.id} mk={mk} tryck={tryck} />)}</ul>
    </div>
  )
}

function LageVal({ lage, mk, tryck }: { lage: Lage; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const val: { id: Lage; text: string; ikon: IconName }[] = [
    { id: 'attgora', text: 'Att göra', ikon: 'arendelista.att-gora' },
    { id: 'kommande', text: 'Kommande', ikon: 'arendelista.kommande' },
    { id: 'avslutade', text: 'Avslutade', ikon: 'arendelista.avslutade' },
  ]
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-800 p-0.5">
      {val.map(v => (
        <Markor key={v.id} markor={mk(`lage:${v.id}`)} block>
          <button type="button" onClick={() => tryck?.(`lage:${v.id}`)}
            className={`flex h-7 w-full items-center justify-center gap-1 rounded-md px-1 text-[10.5px] ${lage === v.id ? 'border border-slate-600 bg-slate-900 font-semibold text-white' : 'border border-transparent text-slate-300'}`}>
            {enhet === 'dator' && <Icon name={v.ikon} size={16} className={`h-3.5 w-3.5 ${lage === v.id ? 'text-[#20c58f]' : ''}`} />}
            <span className="truncate">{v.text}</span>
            <span className={`font-mono text-[10px] ${lage === v.id ? 'text-white' : 'text-slate-400'}`}>{ANTAL[v.id]}</span>
          </button>
        </Markor>
      ))}
    </div>
  )
}

function FilterRad({ sok, mk, tryck }: { sok?: string; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const knapp = (id: string, ikon: IconName, text: string) => (
    <Markor markor={mk(id)}>
      <button type="button" onClick={() => tryck?.(id)} aria-label={text}
        className="flex h-8 flex-none items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10.5px] font-semibold text-slate-300">
        <Icon name={ikon} size={16} className="h-3.5 w-3.5" />{enhet === 'dator' && text}
      </button>
    </Markor>
  )
  return (
    <div className="flex items-center gap-1">
      <Markor markor={mk('filtrera')} block>
        <button type="button" onClick={() => tryck?.('filtrera')}
          className={`flex h-8 w-full items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 text-left text-[11px] ${sok ? 'text-white' : 'text-slate-500'}`}>
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-500" />{sok || 'Filtrera listan'}
        </button>
      </Markor>
      {knapp('filter', 'allman.filter', 'Filter')}
      {knapp('sortera', 'arendelista.sortera', 'Äldst först')}
    </div>
  )
}

function FilterPanel() {
  return (
    <div className="absolute right-3 top-[86px] z-20 w-[210px] rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
      <p className="px-1 text-[10.5px] font-semibold text-slate-300">Typ</p>
      {([['private', 'Privat', 3], ['business', 'Företag', 1], ['inspection', 'Kontrollbesök', 2], ['establishment', 'Etablering', 1]] as const).map(([t, n, a]) => (
        <p key={t} className="flex items-center gap-1.5 px-1 py-1 text-[11px] text-white">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#20c58f] text-[#fff]"><Icon name="allman.bock" size={16} className="h-2.5 w-2.5" /></span>
          <Icon name={TYP_IKON[t]} size={16} className="h-3 w-3 text-slate-400" /><span className="flex-1">{n}</span><span className="font-mono text-[10px] text-slate-500">{a}</span>
        </p>
      ))}
      <p className="mt-1 flex items-center gap-1 border-t border-slate-700/60 px-1 pt-1.5 text-[10.5px] font-semibold text-slate-300"><Icon name="arendelista.alder" size={16} className="h-3 w-3 text-slate-400" />Ålder, räknat från besöksdagen</p>
      {['Alla', 'Högst 30 dagar gamla', 'Äldre än 30 dagar'].map((t, i) => (
        <p key={t} className="flex items-center gap-1.5 px-1 py-1 text-[11px] text-white">
          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${i === 0 ? 'border-[#20c58f]' : 'border-slate-600'}`}>{i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />}</span>{t}
        </p>
      ))}
    </div>
  )
}

const ADRESS: Record<string, string> = {
  'Familjen Exempel': 'Exempelvägen 4, Södertälje',
  'Exempel AB': 'Industrivägen 12, Södertälje',
  'Brf Exempelgården': 'Gårdsvägen 3, Nykvarn',
}

function ValtArende({ r, mk, tryck }: { r: Rad; mk: Mk; tryck?: Tryck }) {
  const tid = r.id === 'avsluta' ? 'Tisdag 20 oktober, 13:00 till 14:00' : r.tid ? `${r.datum}, ${r.tid}` : r.datum === 'Ingen tid' ? 'Ingen tid bokad' : r.datum
  return (
    <section className="grid gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 p-2">
      <p className="flex items-center gap-1 text-[10px] text-slate-300"><Icon name={TYP_IKON[r.typ]} size={16} className="h-3 w-3" />{r.beskr}</p>
      <p className="text-[12.5px] font-semibold text-white">{r.kund}</p>
      <Punkt ton={r.ton}>{r.id === 'avsluta' ? 'Inte avslutat, 6 dagar sedan' : r.status}</Punkt>
      <p className="flex items-start gap-1 text-[10px] text-slate-300"><Icon name="allman.kalender" size={16} className="h-3 w-3 flex-none text-slate-400" />{tid}</p>
      <p className="flex items-start gap-1 text-[10px] text-slate-300"><Icon name="rapport.adress" size={16} className="h-3 w-3 flex-none text-slate-400" />{ADRESS[r.kund]}</p>
      <p className="flex items-center gap-1 font-mono text-[9.5px] text-slate-300"><Icon name="arende.arende" size={16} className="h-3 w-3 text-slate-400" />{r.nr}</p>
      {r.id === 'avsluta' && (
        <div className="border-t border-slate-700/60 pt-1">
          <p className="text-[10px] font-semibold text-slate-300">Beskrivning</p>
          <p className="text-[10px] text-slate-400">Möss i källaren. Kunden vill ha besked om tätning.</p>
        </div>
      )}
      <Markor markor={mk('oppna-arendet')} block>
        <button type="button" onClick={() => tryck?.('oppna-arendet')} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#20c58f] text-[11px] font-semibold text-[#04281c]">
          <Icon name="arende.arende" size={16} />Öppna ärendet
        </button>
      </Markor>
      <div className="grid grid-cols-2 gap-1">
        <span className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-600 text-[10px] font-semibold text-white"><Icon name="falt.navigera" size={16} className="h-3 w-3" />Navigera</span>
        <span className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-600 text-[10px] font-semibold text-white"><Icon name="kontakt.telefon" size={16} className="h-3 w-3" />Ring</span>
      </div>
    </section>
  )
}

// ─── Skärmen ───────────────────────────────────────

interface Vy { sida: 'start' | 'arenden'; lage: Lage; vald: string | null; arende?: boolean; sok?: string; filter?: boolean }

function Innehall({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const sok = vy.sok?.toLowerCase()
  const f = (rader: Rad[]) => (sok ? rader.filter(r => r.kund.toLowerCase().includes(sok)) : rader)
  let lista: ReactNode
  if (vy.lage === 'attgora') {
    lista = (
      <div className="grid gap-2">
        <Sektion rubrik="Den här veckan" ikon="falt.vecka" antal={f(VECKA).length} betonad text="Dina besök från idag till och med söndag.">
          <Lista rader={f(VECKA).slice(0, enhet === 'dator' ? 4 : 2)} vald={vy.vald} mk={mk} tryck={tryck} />
        </Sektion>
        <Etikett text="Väntar på dig" antal={f([BOKA, AVSLUTA]).length} />
        {f([BOKA]).length > 0 && (
          <Sektion rubrik="Behöver en tid" ikon="arendelista.boka" antal={1} text="Ärendet har ingen bokad tid. Ring kunden och boka in besöket.">
            <Lista rader={[BOKA]} vald={vy.vald} mk={mk} tryck={tryck} />
          </Sektion>
        )}
        {f([AVSLUTA]).length > 0 && (
          <Sektion rubrik="Passerade besök att avsluta" ikon="arendelista.passerad" antal={1} text="Datumet har passerat men besöket är inte avslutat. Orange när det gått mer än 30 dagar.">
            <Lista rader={[AVSLUTA]} vald={vy.vald} mk={mk} tryck={tryck} />
          </Sektion>
        )}
        <Hopfall rubrik="Övriga öppna ärenden" detalj="Väntar på kunden eller kontoret, till exempel offert skickad eller ombokning" antal={2} />
      </div>
    )
  } else if (vy.lage === 'kommande') {
    lista = (
      <div className="grid gap-2">
        <Sektion rubrik="De närmaste 4 veckorna" ikon="falt.vecka" antal={3} betonad text="Besöken efter den här veckan, vecka för vecka. Inget här är försenat.">
          <p className="flex items-baseline gap-1.5 px-0.5 text-[10.5px]"><span className="font-semibold text-white">Vecka 45</span><span className="text-slate-400">2 till 8 nov</span><span className="ml-auto font-mono text-slate-400">2</span></p>
          <Lista rader={KOMMANDE} vald={vy.vald} mk={mk} tryck={tryck} />
        </Sektion>
        <Sektion rubrik="Längre fram" ikon="falt.manad" antal={2} text="Planerade besök längre fram, främst hos dina avtalskunder, samlade per kund. De flyttar upp av sig själva när det är dags och du behöver inte göra något med dem nu.">
          <Hopfall rubrik="Brf Exempelgården" detalj="2 planerade besök, nästa 7 dec" antal={2} />
        </Sektion>
      </div>
    )
  } else {
    lista = (
      <div className="grid gap-1.5">
        <Sektion rubrik="Avslutade" ikon="arendelista.avslutade" antal={ANTAL.avslutade} betonad text="Per månad, räknat från dagen ärendet avslutades.">
          <Hopfall rubrik="Oktober 2026" antal={8} oppen />
          <Lista rader={AVSLUTADE} vald={vy.vald} mk={mk} tryck={tryck} />
          <Hopfall rubrik="September 2026" antal={4} />
        </Sektion>
      </div>
    )
  }
  const huvud = (
    <div className="grid gap-1.5">
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><Icon name="falt.attgora" size={16} className="mt-px h-3.5 w-3.5 flex-none text-[#20c58f]" />{SAMMANFATTNING}</p>
      {enhet === 'dator'
        ? <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-1.5"><LageVal lage={vy.lage} mk={mk} tryck={tryck} /><FilterRad sok={vy.sok} mk={mk} tryck={tryck} /></div>
        : <><LageVal lage={vy.lage} mk={mk} tryck={tryck} /><FilterRad sok={vy.sok} mk={mk} tryck={tryck} /></>}
    </div>
  )
  if (enhet === 'dator') {
    const valt = [...VECKA, BOKA, AVSLUTA, ...KOMMANDE, ...AVSLUTADE].find(r => r.id === vy.vald) ?? (vy.lage === 'attgora' ? VECKA[0] : vy.lage === 'kommande' ? KOMMANDE[0] : AVSLUTADE[0])
    return (
      <div className="relative grid gap-2">
        {huvud}
        <div className="grid grid-cols-[minmax(0,1fr)_160px] items-start gap-2">
          <div className="min-w-0">{lista}</div>
          <ValtArende r={valt} mk={mk} tryck={tryck} />
        </div>
        {vy.filter && <FilterPanel />}
      </div>
    )
  }
  return <Rulla><div className="relative grid gap-2">{huvud}{lista}{vy.filter && <FilterPanel />}</div></Rulla>
}

function Skarm({ vy, markor, tryck }: { vy: Vy; markor?: NyMarkor; tryck: Tryck }) {
  const mk = markor ? gorMk(markor) : ingenMk
  if (vy.sida === 'start') {
    return <NySkarm sida="idag" titel="Idag" under={UNDER_IDAG} onRam={tryck} markor={markor}><IdagSida /></NySkarm>
  }
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under={`${ANTAL.attgora} att ta hand om nu`} onRam={tryck} markor={markor}
      over={vy.arende ? <ArendeFramme b={SOM_BESOK} markor={markor} tryck={tryck} /> : undefined}>
      <Innehall vy={vy} mk={mk} tryck={tryck} />
    </NySkarm>
  )
}

// ─── Visningen ─────────────────────────────────────

function stegLista(enhet: 'mobil' | 'dator'): { vy: Vy; mal: string }[] {
  return [
    { vy: { sida: 'start', lage: 'attgora', vald: null }, mal: enhet === 'dator' ? 'nav:Mina ärenden' : 'nav:Ärenden' },
    { vy: { sida: 'arenden', lage: 'attgora', vald: null }, mal: enhet === 'dator' ? 'oppna:avsluta' : 'rad:avsluta' },
    { vy: { sida: 'arenden', lage: 'attgora', vald: 'avsluta', arende: true }, mal: 'stang' },
    { vy: { sida: 'arenden', lage: 'attgora', vald: null }, mal: 'filtrera' },
    { vy: { sida: 'arenden', lage: 'attgora', vald: null, sok: 'Exempel AB' }, mal: 'filter' },
    { vy: { sida: 'arenden', lage: 'attgora', vald: null }, mal: 'lage:kommande' },
    { vy: { sida: 'arenden', lage: 'kommande', vald: null }, mal: 'lage:avslutade' },
  ]
}

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const lista = stegLista(enhet)
  const s = lista[Math.min(steg, lista.length - 1)]
  return <Skarm vy={s.vy} markor={{ pa: true, nr: steg + 1, mal: s.mal }} tryck={m => { if (m === s.mal) onNasta() }} />
}

// ─── Övningen ──────────────────────────────────────

function Ovning() {
  const enhet = useGuideEnhet()
  const startVy: Vy = { sida: 'arenden', lage: 'attgora', vald: null }
  const [vy, setVy] = useState<Vy>(startVy)
  const [framsteg, setFramsteg] = useState(0)
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Besöket hos Familjen Exempel den 2026-10-20 är inte avslutat. Öppna ärendet.' }
  const [svar, setSvar] = useState<OvningSvar>(start)

  const tryck = (mal: string) => {
    if (framsteg === 0) {
      const oppna = () => {
        setVy({ ...vy, vald: 'avsluta', arende: true }); setFramsteg(1)
        setSvar({ typ: 'tips', titel: 'Ärendet är öppet', text: 'Här går du igenom stegen och avslutar besöket. Stäng nu ärendet med krysset uppe till höger.' })
      }
      if (enhet === 'mobil' && mal === 'rad:avsluta') { oppna(); return }
      if (enhet === 'dator' && (mal === 'oppna:avsluta' || (mal === 'oppna-arendet' && vy.vald === 'avsluta'))) { oppna(); return }
      if (enhet === 'dator' && mal === 'rad:avsluta') {
        setVy({ ...vy, vald: 'avsluta' })
        setSvar({ typ: 'tips', titel: 'Raden är vald', text: 'Ärendet visas till höger. Tryck Öppna ärendet, eller tryck två gånger snabbt på raden.' })
        return
      }
      if (mal.startsWith('rad:') || mal.startsWith('oppna:')) {
        if (enhet === 'dator' && mal.startsWith('rad:')) setVy({ ...vy, vald: mal.slice(4) })
        setSvar({ typ: 'fel', titel: 'Fel ärende', text: 'Besöket från den 20 oktober står under Passerade besök att avsluta.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: 'Det står i Att göra, under Väntar på dig och Passerade besök att avsluta.' })
      return
    }
    if (framsteg === 1) {
      if (mal === 'stang') {
        setVy({ ...vy, arende: false }); setFramsteg(2)
        setSvar({ typ: 'tips', titel: 'Bra', text: 'Listan läses om när ärendet stängs. Titta nu på besöken efter den här veckan.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte den', text: 'Krysset uppe till höger i ärendet stänger det.' })
      return
    }
    if (framsteg === 2) {
      if (mal === 'lage:kommande') {
        setVy({ ...vy, lage: 'kommande', vald: null }); setFramsteg(3)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'Kommande visar de närmaste 4 veckorna vecka för vecka. Det som ligger längre fram är samlat per kund under Längre fram.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: 'Besöken efter den här veckan ligger i läget Kommande, bredvid Att göra.' })
    }
  }
  const borjaOm = () => { setVy(startVy); setFramsteg(0); setSvar(start) }

  return (
    <OvningRam framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={borjaOm} bred={enhet === 'dator'}>
      <Skarm vy={vy} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
