// src/pages/shared/intranet/guider/guide-betalningssparr-kontor.tsx
// Guidemodul: Häva en betalningsspärr, för kontoret (admin och koordinator, dator).
// Efterbildning av betalningsspärren (3.128.0): den röda rutan i Skapa ärende
// (PaymentBlockNotice), den röda raden på kundkortet (PaymentBlockStrip),
// sektionen Betalningsspärr i fliken Fakturering och rutan Häv spärren
// (PaymentBlockSection). Påhittad kund: Exempel AB.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Dator, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'

type Vy = 'skapa' | 'kort' | 'fakt' | 'dialog' | 'klart'
interface Lage { vy: Vy; kommentar: boolean }

const START: Lage = { vy: 'skapa', kommentar: false }
const ORDNING: Vy[] = ['skapa', 'kort', 'fakt', 'dialog', 'klart']

const KUND = 'Exempel AB'
const SKULD = '3 750 kr'
const FAKTURA = 'INV-202610-10001'
const FORTNOX = '5123'
const FORFALL = '2026-10-07'
const DAGAR = 34
const SEDAN = '2026-10-28'
const IDAG = '2026-11-10'
const PAUS = '2026-11-24'
const KOMMENTAR = 'Kunden har lovat betala fredag'
const SAMMANFATTNING = `${SKULD} förfallet på 1 faktura, äldsta ${DAGAR} dagar efter förfallodagen`

function adress(vy: Vy) {
  return vy === 'skapa' ? 'koordinator › schema › Skapa ärende' : 'koordinator › befintliga-kunder › Exempel AB'
}

function SkapaArende({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <div className="grid gap-2 p-3">
      <p className="text-[13px] font-semibold text-white">Skapa ärende <span className="font-normal text-slate-400">· Avtalskund</span></p>
      <div className="rounded-md border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-[11px]">
        <span className="block text-[10px] text-slate-400">Kund</span>
        <span className="text-white">{KUND}</span>
      </div>
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-300">
          <Icon name="allman.las" size={16} />
          Kunden har betalningsspärr
        </div>
        <p className="mt-1 text-[11px] text-slate-300">{SAMMANFATTNING}</p>
        <p className="mt-1.5 text-[10.5px] tabular-nums text-slate-400">{FAKTURA} (Fortnox {FORTNOX}): {SKULD}, förföll {FORFALL} ({DAGAR} dagar)</p>
        <p className="mt-1.5 text-[10.5px] text-slate-400">
          Nya ärenden kan inte bokas. Spärren hävs bara på kundkortet.{' '}
          <Markor markor={mk('kundkort')}>
            <button type="button" onClick={() => tryck('kundkort')} className="text-red-300 underline">Öppna kundkortet</button>
          </Markor>
        </p>
      </div>
      <div className="mt-2 flex justify-end gap-2 border-t border-slate-700/50 pt-2">
        <button type="button" onClick={() => tryck('avbryt')} className="rounded-lg border border-slate-600 px-3 py-1.5 text-[12px] text-slate-200">Avbryt</button>
        <button type="button" onClick={() => tryck('skapa')} aria-disabled className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-[12px] font-semibold text-slate-400">
          <Icon name="station.klar" size={16} />
          Skapa & Boka Ärende
        </button>
      </div>
    </div>
  )
}

function Kundkort({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  const havd = l.vy === 'klart'
  const flikar = ['Översikt', 'Avtal (1)', 'Avtalskarta', 'Fakturering', 'Intäkter', 'Ärenden (12)']
  const aktiv = l.vy === 'kort' ? 'Översikt' : 'Fakturering'
  return (
    <div className="relative grid gap-2 p-3">
      <p className="text-[14px] font-semibold text-white">{KUND}</p>
      {!havd && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-red-300"><Icon name="allman.las" size={16} />Betalningsspärr</span>
          <span className="text-slate-300">Automatisk sedan {SEDAN}. {SAMMANFATTNING}</span>
          <Markor markor={mk('visa')}>
            <button type="button" onClick={() => tryck('visa')} className="text-red-300 underline">Visa i Fakturering</button>
          </Markor>
        </div>
      )}
      <div className="flex flex-wrap gap-3 border-b border-slate-700 text-[11px]">
        {flikar.map(f => (
          <button key={f} type="button" onClick={() => tryck(f === 'Fakturering' ? 'flik' : 'annan-flik')}
            className={`pb-1 ${f === aktiv ? 'border-b-2 border-[#20c58f] font-semibold text-white' : 'text-slate-400'}`}>{f}</button>
        ))}
      </div>

      {l.vy === 'kort' && (
        <div className="grid gap-1 text-[11px] text-slate-400">
          <p>Kundansvarig: Anna Exempel</p>
          <p>Avtal: Skadedjursavtal, 4 besök per år</p>
        </div>
      )}

      {l.vy !== 'kort' && (
        <div className="grid gap-2 text-[11px]">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Betalningsspärr</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${havd ? 'bg-[#20c58f]' : 'bg-red-400'}`} aria-hidden />
              <span className={havd ? 'text-slate-300' : 'text-red-300'}>{havd ? 'Ingen spärr' : `Automatisk spärr sedan ${SEDAN}`}</span>
            </span>
            {havd && <span className="text-slate-400">Automatiken pausad till {PAUS}</span>}
          </div>
          {!havd && <p className="text-slate-400">{SAMMANFATTNING}.</p>}
          <div className="flex flex-wrap gap-1.5">
            {havd ? (
              <button type="button" onClick={() => tryck('satt')} className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">Sätt manuell spärr</button>
            ) : (
              <Markor markor={mk('hav')}>
                <button type="button" onClick={() => tryck('hav')} className="rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-white">Häv spärren</button>
              </Markor>
            )}
            <button type="button" onClick={() => tryck('pausa')} className="rounded-lg px-2.5 py-1 text-[11px] text-slate-300">Pausa automatiken</button>
          </div>
          <p className="text-[10px] text-slate-500">Automatiken spärrar när förfallen skuld på portalens fakturor överstiger 100 kr och är äldre än 20 dagar efter förfallodagen. Fakturor som bara skickas direkt från Fortnox räknas inte.</p>

          <p className="text-[10px] text-slate-500">Obetalda portalfakturor</p>
          <div className="grid grid-cols-[minmax(0,1.6fr)_auto_auto_auto_auto] gap-x-2 text-[10.5px] tabular-nums">
            <span className="text-slate-500">Faktura</span><span className="text-slate-500">Förfallodag</span><span className="text-right text-slate-500">Kvar (kundens del)</span><span className="text-slate-500">Spärren</span><span />
            <span className="border-t border-slate-800 pt-1 text-slate-300">{FAKTURA} <span className="text-slate-500">· Fortnox {FORTNOX}</span></span>
            <span className="border-t border-slate-800 pt-1 text-red-300">{FORFALL}</span>
            <span className="border-t border-slate-800 pt-1 text-right text-slate-300">{SKULD}</span>
            <span className="border-t border-slate-800 pt-1 text-slate-400">Räknas</span>
            <button type="button" onClick={() => tryck('undanta')} className="border-t border-slate-800 pt-1 text-slate-400 underline">Undanta</button>
          </div>

          <p className="text-[10px] text-slate-500">Historik</p>
          <ul className="grid gap-1.5">
            {havd && (
              <li>
                <span className="text-slate-300">Spärr hävd</span> <span className="text-[10px] text-slate-500">{IDAG} 10:42 · manuellt · Anna Exempel</span>
                <p className="text-[10px] text-slate-400">{KOMMENTAR} · pausad till {PAUS}</p>
              </li>
            )}
            <li>
              <span className="text-slate-300">Spärr satt</span> <span className="text-[10px] text-slate-500">{SEDAN} 00:15 · automatiskt · Systemet</span>
              <p className="text-[10px] text-slate-400">Förfallen skuld {SKULD}, äldsta 21 dagar efter förfallodagen (gräns 20 dagar, 100 kr). · {SKULD} · {FAKTURA}</p>
            </li>
          </ul>
        </div>
      )}

      {l.vy === 'dialog' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/70 p-3">
          <div className="w-full max-w-[340px] rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
            <div className="border-b border-slate-700/50 px-3 py-2">
              <p className="text-[13px] font-semibold text-white">Häv spärren</p>
              <p className="text-[10.5px] text-slate-400">{KUND}</p>
            </div>
            <div className="grid gap-2 p-3 text-[11px]">
              <p className="text-slate-400">Spärren sattes automatiskt. Automatiken pausas till valt datum så att kunden inte spärras igen direkt.</p>
              <div>
                <span className="mb-1 block text-[10px] text-slate-400">Pausa automatiken till och med</span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-white">
                  <Icon name="allman.kalender" size={16} className="text-slate-400" />{PAUS}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] text-slate-400">Kommentar (krävs, syns bara internt)</span>
                <Markor markor={mk('kommentar')} block>
                  <button type="button" onClick={() => tryck('kommentar')} className="min-h-[40px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-left">
                    <span className={l.kommentar ? 'text-white' : 'text-slate-500'}>{l.kommentar ? KOMMENTAR : 'Till exempel: kunden har lovat betala fredag'}</span>
                  </button>
                </Markor>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700/50 px-3 py-2">
              <button type="button" onClick={() => tryck('avbryt')} className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] text-slate-200">Avbryt</button>
              <Markor markor={mk('spara')}>
                <button type="button" onClick={() => tryck('spara')} className="rounded-lg bg-[#20c58f] px-3 py-1 text-[11px] font-semibold text-[#052e22]">Spara</button>
              </Markor>
            </div>
          </div>
        </div>
      )}
      {havd && <Notis text={`Spärren hävd, automatiken pausad till ${PAUS}`} />}
    </div>
  )
}

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  return (
    <Dator adress={adress(l.vy)}>
      {l.vy === 'skapa' ? <SkapaArende mk={mk} tryck={tryck} /> : <Kundkort l={l} mk={mk} tryck={tryck} />}
    </Dator>
  )
}

const VISNING: { lage: Lage; markera?: string }[] = [
  { lage: START, markera: 'kundkort' },
  { lage: { vy: 'kort', kommentar: false }, markera: 'visa' },
  { lage: { vy: 'fakt', kommentar: false }, markera: 'hav' },
  { lage: { vy: 'dialog', kommentar: false }, markera: 'kommentar' },
  { lage: { vy: 'dialog', kommentar: true }, markera: 'spara' },
  { lage: { vy: 'klart', kommentar: true } },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

const BORJA: OvningSvar = {
  typ: 'tips',
  titel: 'Börja här',
  text: 'Exempel AB behöver ett besök i dag. Kunden har lovat betala fredag och ekonomi har sagt ja. Häv spärren och skriv varför. Du står i Skapa ärende.',
}

function ovningTryck(l: Lage, id: string): { lage?: Lage; svar: OvningSvar } | null {
  const fel = (text: string) => ({ svar: { typ: 'fel' as const, titel: 'Inte där', text } })
  switch (l.vy) {
    case 'skapa':
      if (id === 'kundkort') return { lage: { ...l, vy: 'kort' }, svar: { typ: 'tips', titel: 'Kundkortet', text: 'Den röda raden under sidhuvudet visar spärren i alla flikar. Tryck Visa i Fakturering.' } }
      if (id === 'skapa') return fel('Skapa & Boka Ärende går inte att trycka på så länge kunden har betalningsspärr. Spärren hävs på kundkortet. Tryck Öppna kundkortet.')
      return fel('Tryck Öppna kundkortet i den röda rutan.')
    case 'kort':
      if (id === 'visa' || id === 'flik') return { lage: { ...l, vy: 'fakt' }, svar: { typ: 'tips', titel: 'Fliken Fakturering', text: 'Under Betalningsspärr ser du spärren, den obetalda fakturan och historiken. Tryck Häv spärren.' } }
      return fel('Spärren hanteras i fliken Fakturering. Tryck Visa i Fakturering på den röda raden.')
    case 'fakt':
      if (id === 'hav') return { lage: { ...l, vy: 'dialog' }, svar: { typ: 'tips', titel: 'Häv spärren', text: `Datumet är ifyllt 14 dagar fram, ${PAUS}. Till dess spärras kunden inte igen. Skriv en kommentar.` } }
      if (id === 'pausa') return fel('Pausa automatiken används när kunden inte ska spärras under en period framöver. Nu ska spärren hävas. Tryck Häv spärren.')
      if (id === 'undanta') return fel('Undanta tar bort en enskild faktura ur spärren, till exempel en faktura som är bestridd. Här ska hela spärren hävas. Tryck Häv spärren.')
      return fel('Tryck Häv spärren.')
    case 'dialog':
      if (id === 'kommentar') return { lage: { ...l, kommentar: true }, svar: { typ: 'tips', titel: 'Kommentaren är skriven', text: 'Kommentaren syns bara internt, i historiken. Tryck Spara.' } }
      if (id === 'spara') {
        if (!l.kommentar) return fel('Portalen svarar Skriv en kommentar. Kommentaren krävs alltid. Tryck på fältet Kommentar.')
        return { lage: { ...l, vy: 'klart' }, svar: { typ: 'ok', titel: 'Klart', text: `Spärren är hävd och automatiken pausad till ${PAUS}. Historiken visar ditt namn och kommentaren. Välj kunden igen i Skapa ärende så kan du boka besöket.` } }
      }
      if (id === 'avbryt') return { lage: { ...l, vy: 'fakt', kommentar: false }, svar: { typ: 'fel', titel: 'Avbrutet', text: 'Ingenting sparades och spärren ligger kvar. Tryck Häv spärren igen.' } }
      return null
    default:
      return null
  }
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const tryck = (id: string) => {
    const r = ovningTryck(l, id)
    if (!r) return
    if (r.lage) setL(r.lage)
    setSvar(r.svar)
  }
  return (
    <OvningRam bred framsteg={ORDNING.indexOf(l.vy)} totalt={ORDNING.length - 1} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA) }}>
      <Skarm l={l} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
