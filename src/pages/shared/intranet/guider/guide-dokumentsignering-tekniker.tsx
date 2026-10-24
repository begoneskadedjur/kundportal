// src/pages/shared/intranet/guider/guide-dokumentsignering-tekniker.tsx
// Guidemodul: Följ dina offerter och avtal i Dokumentsignering (tekniker, nya arbetsvyn,
// telefon och dator). Slugen behålls från guiden om att skicka en offert från ärendet.
//
// Efterbildning av NyDokumentsignering och components/technician/ny/dokument:
//   växeln Arbetskö / Statistik, raden Senaste 90 dagarna, sökrutan och Alla / Offerter / Avtal
//   DokumentLista   Att göra (Kunden har skrivit, Förfallna, Väntar länge på svar, Ring idag,
//                   Utkast att skicka), Väntar på kunden, Signerade, Klara
//   DokumentDetalj  huvudet (namn, typ och belopp, Skickad ... av dig), rutan med statusraden och
//                   "Nästa steg:", knapparna Ring <kontakt> (i telefonen bara första ordet),
//                   Logga samtal, Granska och skicka, Öppna i Oneflow, menyn Fler val
//   LoggaSamtal     Logga samtal med <kund>, Hur gick det (Nådde kunden, Röstbrevlåda, Inget svar),
//                   Anteckning, valfri, Avbryt, Spara samtalet. Ring igen visas bara för kontoret.
//   utkastets ruta  Offert, <namn>, Stäng, Skicka offerten, frågan "Skicka offerten till ... från
//                   info@begone.se?"
// Teknikern har inte Oneflow-behörighet (behorighet().oneflow är falsk): Förläng och påminn och
// svar till kunden i Oneflow gör kontoret. Teknikern ringer och loggar samtalet.
// Påhittade kunder, ingenting skickas.

import { useState, type ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { Knapp, MerSida, Punkt, RUTA, Rubrik, Vaxlar, ingenMk, mkFor, vagTill, type Mk, type Ton, type Tryck } from './_nyvy_salja'

// --- Data ---

interface Dok {
  id: string
  namn: string
  typ: 'Offert' | 'Avtal'
  belopp: string
  ton: Ton
  status: string
  detalj: string
}

const DOK: Record<string, Dok> = {
  brf: { id: 'brf', namn: 'Brf Exempelgården', typ: 'Avtal', belopp: '18 400 kr', ton: 'bla', status: 'Skrev igår 16:42', detalj: '"Ingår soprummet?"' },
  ab: { id: 'ab', namn: 'Exempel AB', typ: 'Offert', belopp: '6 200 kr', ton: 'gul', status: 'Inte öppnad, skickad för 5 dagar sedan', detalj: 'Fristen går ut 2026-11-04' },
  utkast: { id: 'utkast', namn: 'Familjen Exempel', typ: 'Offert', belopp: '2 750 kr', ton: 'gul', status: 'Utkast, inte skickat till kunden', detalj: 'Skapat idag' },
  vantar: { id: 'vantar', namn: 'Exempel AB', typ: 'Avtal', belopp: '24 000 kr', ton: 'gra', status: 'Öppnad igår', detalj: 'Skickad för 3 dagar sedan' },
  signerad: { id: 'signerad', namn: 'Familjen Exempel', typ: 'Offert', belopp: '3 400 kr', ton: 'gron', status: 'Signerad igår, kontoret bokar in', detalj: 'Du behöver inte göra något' },
}

const EPOST = 'familjen@exempel.se'

type Vy = 'start' | 'mer' | 'ko' | 'statistik' | 'ab' | 'samtal' | 'loggat' | 'utkast' | 'pdf' | 'fraga' | 'skickat'

interface Lage { vy: Vy; nadde: boolean }

// --- Listan ---

function Rad({ d, tryck, mk, dator, vald }: { d: Dok; tryck: Tryck; mk: Mk; dator: boolean; vald?: boolean }) {
  return (
    <Markor markor={mk(`rad:${d.id}`)} block>
      <button type="button" onClick={() => tryck(`rad:${d.id}`)}
        className={`relative grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-b border-slate-700/60 px-2 py-1.5 text-left last:border-b-0 ${vald ? 'bg-slate-800' : 'hover:bg-slate-800/60'}`}>
        {vald && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#20c58f]" />}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[12px] font-semibold text-white">{d.namn}</span>
          <Punkt ton={d.ton} liten>{d.status}</Punkt>
          <span className="truncate text-[10px] text-slate-400">{dator ? d.detalj : `${d.typ}, ${d.detalj}`}</span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-[10.5px] text-white">{d.belopp}</span>
          {dator && <span className="block text-[10px] text-slate-400">{d.typ}</span>}
        </span>
      </button>
    </Markor>
  )
}

function Lista({ tryck, mk, dator, valdId, skickat }: { tryck: Tryck; mk: Mk; dator: boolean; valdId?: string; skickat?: boolean }) {
  const ruta = 'overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900'
  const under = (t: string, n: number) => <p className="bg-slate-800/40 px-2 pb-0.5 pt-1 text-[10.5px] font-semibold text-slate-300">{t}<span className="ml-1 font-mono text-slate-400">{n}</span></p>
  return (
    <div className="grid gap-2">
      <div>
        <Rubrik ikon="falt.attgora" farg="text-orange-400" text="Att göra" antal={skickat ? 2 : 3} under="Kunden väntar på dig, eller dokumentet riskerar att tappas." />
        <div className={ruta}>
          {under('Kunden har skrivit', 1)}
          <Rad d={DOK.brf} tryck={tryck} mk={mk} dator={dator} vald={valdId === 'brf'} />
          {under('Väntar länge på svar', 1)}
          <Rad d={DOK.ab} tryck={tryck} mk={mk} dator={dator} vald={valdId === 'ab'} />
          {!skickat && <>{under('Utkast att skicka', 1)}<Rad d={DOK.utkast} tryck={tryck} mk={mk} dator={dator} vald={valdId === 'utkast'} /></>}
        </div>
      </div>
      <div>
        <Rubrik ikon="falt.vantar" farg="text-sky-400" text="Väntar på kunden" antal={skickat ? 2 : 1} under="Skickade och inom fristen. Inget att göra än." />
        <div className={ruta}>
          {skickat && <Rad d={{ ...DOK.utkast, ton: 'gra', status: 'Inte öppnad än', detalj: 'Skickad idag' }} tryck={tryck} mk={mk} dator={dator} />}
          <Rad d={DOK.vantar} tryck={tryck} mk={mk} dator={dator} />
        </div>
      </div>
      <div>
        <Rubrik ikon="falt.signera" farg="text-[#20c58f]" text="Signerade" antal={1} under="Kontoret registrerar kunden och bokar in, du behöver inte göra något. Här ser du när det är bokat." />
        <div className={ruta}><Rad d={DOK.signerad} tryck={tryck} mk={mk} dator={dator} /></div>
      </div>
    </div>
  )
}

function Topp({ tryck, mk, dator, statistik }: { tryck: Tryck; mk: Mk; dator: boolean; statistik?: boolean }) {
  return (
    <div className="mb-2 grid gap-1.5">
      <Vaxlar prefix="vy" valt={statistik ? 'statistik' : 'ko'} tryck={tryck} mk={mk}
        val={[{ id: 'ko', text: 'Arbetskö', ikon: 'falt.attgora' }, { id: 'statistik', text: 'Statistik', ikon: 'allman.statistik' }]} />
      {!statistik && (
        <>
          <button type="button" onClick={() => tryck('statrad')} className="flex flex-wrap items-center gap-x-2 rounded-xl border border-slate-700/60 bg-slate-900 px-2 py-1 text-left text-[10.5px] text-slate-300">
            <span className="text-slate-400">Senaste 90 dagarna</span>
            {dator
              ? <><span><b className="font-mono text-white">9</b> skickade</span><span><b className="font-mono text-white">6</b> signerade</span><span>signeringsgrad <b className="font-mono text-[#20c58f]">67 %</b></span></>
              : <span><b className="font-mono text-white">6</b> av <b className="font-mono text-white">9</b> signerade, <b className="font-mono text-[#20c58f]">67 %</b></span>}
          </button>
          <div className="flex gap-1">
            <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-2 text-[10.5px] text-slate-500"><Icon name="allman.sok" size={16} className="h-3.5 w-3.5" />{dator ? 'Sök kund, kontaktperson eller ärendenummer' : 'Sök'}</span>
            <span className="flex flex-none gap-0.5 rounded-lg bg-slate-800 p-0.5 text-[10px]">
              {['Alla', 'Offerter', 'Avtal'].map((t, i) => <span key={t} className={`rounded-md px-1.5 py-1 ${i === 0 ? 'border border-slate-600 bg-slate-900 font-semibold text-white' : 'text-slate-300'}`}>{t}</span>)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// --- Dokumentet ---

function Detalj({ l, tryck, mk, dator }: { l: Lage; tryck: Tryck; mk: Mk; dator: boolean }) {
  const utkast = l.vy === 'utkast' || l.vy === 'pdf' || l.vy === 'fraga'
  const d = utkast ? DOK.utkast : DOK.ab
  const samtal = l.vy === 'samtal'
  const ringText = dator ? 'Ring Exempel AB' : 'Ring Exempel'
  const knappar = utkast
    ? <Knapp id="granska" text="Granska och skicka" ikon="rapport.oppna" prim full={!dator} tryck={tryck} mk={mk} />
    : <>
        <Knapp id="ring" text={ringText} ikon="kontakt.telefon" prim full={!dator} tryck={tryck} mk={mk} />
        <Knapp id="logga" text="Logga samtal" ikon="allman.anteckning" full={!dator} tryck={tryck} mk={mk} />
      </>
  return (
    <div className={`relative flex flex-col ${dator ? 'rounded-xl border border-slate-700/60 bg-slate-900' : '-m-2.5 h-[calc(100%+20px)] bg-slate-950'}`}>
      {!dator && (
        <div className="flex flex-none items-center gap-1 border-b border-slate-700/60 bg-slate-900 px-1 py-1">
          <button type="button" onClick={() => tryck('tillbaka')} className="flex items-center gap-0.5 rounded-lg px-1 py-1 text-[12px] font-medium text-slate-300"><Icon name="allman.chevron-vanster" size={16} />Dokument</button>
          <span className="flex-1" />
          <Markor markor={mk('oneflow')}>
            <button type="button" onClick={() => tryck('oneflow')} aria-label="Öppna i Oneflow" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="rapport.oppna" size={16} /></button>
          </Markor>
          <button type="button" onClick={() => tryck('meny')} aria-label="Fler val för dokumentet" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="allman.meny" size={16} /></button>
        </div>
      )}
      <div className="grid gap-0.5 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[16px] font-bold leading-tight text-white">{d.namn}</p>
          {dator && (
            <span className="flex flex-none items-center gap-1">
              <Knapp id="oneflow" text="Öppna i Oneflow" ikon="rapport.oppna" tryck={tryck} mk={mk} />
              <button type="button" onClick={() => tryck('meny')} aria-label="Fler val för dokumentet" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 text-slate-400"><Icon name="allman.meny" size={16} /></button>
            </span>
          )}
        </div>
        <p className="text-[10.5px] text-slate-300">{d.typ}, <span className="font-mono">{d.belopp}</span></p>
        <p className="text-[10.5px] text-slate-400">{utkast ? 'Skapat' : 'Skickad'} <span className="font-mono">{utkast ? '2026-10-26' : '2026-10-21'}</span> av dig{utkast ? '' : ', fristen går ut 2026-11-04'}</p>
      </div>
      <div className={`mx-2.5 grid gap-1.5 rounded-xl border p-2 ${RUTA[d.ton]}`}>
        <Punkt ton={d.ton}>{d.status}</Punkt>
        <p className="text-[11px] leading-snug text-white"><b>Nästa steg:</b> {utkast ? 'granska PDF:en och skicka offerten till kunden.' : 'ring Exempel AB och hör om offerten kom fram.'}</p>
        {l.vy === 'loggat' && <p className="text-[10px] text-slate-400">1 samtal, senast 2026-10-26</p>}
        {samtal && (
          <div className="grid gap-1.5 rounded-lg border border-slate-700 bg-slate-900 p-2">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="kontakt.telefon" size={16} className="text-[#20c58f]" />Logga samtal med Exempel AB</p>
            <p className="text-[10px] font-semibold text-slate-300">Hur gick det</p>
            <div className="grid grid-cols-3 gap-1">
              {[['nadde', 'Nådde kunden'], ['rost', 'Röstbrevlåda'], ['inget', 'Inget svar']].map(([k, t]) => (
                <Markor key={k} markor={mk(`utfall:${k}`)} block>
                  <button type="button" onClick={() => tryck(`utfall:${k}`)} className={`w-full rounded-lg border px-1 py-1 text-[10px] ${k === 'nadde' && l.nadde ? 'border-[#20c58f] bg-[#20c58f]/15 text-white' : 'border-slate-600 text-slate-300'}`}>{t}</button>
                </Markor>
              ))}
            </div>
            <p className="text-[10px] font-semibold text-slate-300">Anteckning, valfri</p>
            <span className="h-7 rounded-lg border border-slate-600 bg-slate-950/40" />
            <div className="flex justify-end gap-1">
              <Knapp id="avbryt-samtal" text="Avbryt" tryck={tryck} mk={mk} />
              <Knapp id="spara-samtal" text="Spara samtalet" ikon="allman.bock" prim tryck={tryck} mk={mk} />
            </div>
          </div>
        )}
        {dator && !samtal && <div className="flex flex-wrap gap-1">{knappar}</div>}
      </div>
      <div className="mt-2 flex gap-1 border-b border-slate-700/60 px-2">
        {['Konversation', 'Aktivitet', 'Innehåll'].map((t, i) => (
          <button key={t} type="button" onClick={() => tryck(`flik:${t}`)} className={`border-b-2 px-1.5 py-1.5 text-[10.5px] ${i === 0 ? 'border-[#20c58f] font-semibold text-white' : 'border-transparent text-slate-300'}`}>{t}</button>
        ))}
      </div>
      <p className="px-2.5 py-3 text-center text-[10.5px] text-slate-400">Ingen konversation än.</p>
      {!dator && !samtal && (
        <div className="absolute inset-x-0 bottom-0 grid gap-1 border-t border-slate-700/60 bg-slate-900 px-2.5 py-2">
          {utkast ? knappar : <><Knapp id="ring" text={ringText} ikon="kontakt.telefon" prim full tryck={tryck} mk={mk} /><Knapp id="logga" text="Logga samtal" ikon="allman.anteckning" full tryck={tryck} mk={mk} /></>}
        </div>
      )}
    </div>
  )
}

/** Utkastets PDF-ruta och webbläsarens fråga innan offerten skickas */
function PdfRuta({ fraga, tryck, mk }: { fraga: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-slate-900">
      <div className="border-b border-slate-700 px-3 py-2">
        <p className="text-[13px] font-bold text-white">Offert, Familjen Exempel</p>
        <p className="text-[10.5px] text-slate-400">Utkast i Oneflow, id 1234567</p>
      </div>
      <div className="flex-1 p-3">
        <button type="button" onClick={() => tryck('pdf-yta')} className="grid w-full gap-0.5 rounded bg-white p-2.5 text-left text-[10px] text-slate-700 shadow">
          <span className="text-[11.5px] font-bold text-slate-900">Offert</span>
          <span>Kund: Familjen Exempel</span>
          <span>Bekämpning av getingbo</span>
          <span className="flex justify-between border-t border-slate-200 pt-0.5"><span>Totalt</span><span>2 750 kr</span></span>
        </button>
      </div>
      <div className="flex justify-end gap-1.5 border-t border-slate-700 px-3 py-2">
        <Knapp id="stang" text="Stäng" tryck={tryck} mk={mk} />
        <Knapp id="skicka" text="Skicka offerten" ikon="rapport.skicka" prim tryck={tryck} mk={mk} />
      </div>
      {fraga && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="grid w-full max-w-xs gap-2 rounded-xl bg-white p-3 text-slate-900 shadow-2xl">
            <p className="text-[11px] text-slate-500">portal.begone.se</p>
            <p className="text-[12.5px]">Skicka offerten till {EPOST} från info@begone.se?</p>
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => tryck('fraga-avbryt')} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-slate-600">Avbryt</button>
              <Markor markor={mk('fraga-ok')}>
                <button type="button" onClick={() => tryck('fraga-ok')} className="rounded-lg bg-sky-600 px-3 py-1 text-[12px] font-semibold text-[#fff]">OK</button>
              </Markor>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Skärmen ---

function Skarm({ l, mk, tryck, enhet, markor }: { l: Lage; mk: Mk; tryck: Tryck; enhet: GuideEnhet; markor?: { pa: boolean; nr: number; mal: string } }) {
  const dator = enhet === 'dator'
  const under = l.vy === 'skickat' ? '2 att göra, 2 väntar, 1 signerade' : dator ? '3 att göra, 1 väntar på kunden, 1 signerade' : '3 att göra, 1 väntar, 1 signerade'

  if (l.vy === 'start' || l.vy === 'mer') {
    return (
      <NySkarm sida={l.vy === 'mer' ? 'mer' : 'idag'} titel={l.vy === 'mer' ? 'Mer' : 'Idag'} under={l.vy === 'mer' ? undefined : 'Måndag 26 oktober, 3 besök'} onRam={tryck} markor={markor}>
        {l.vy === 'mer'
          ? <MerSida tryck={tryck} mk={mk} grupper={['Hos kunden', 'Sälja', 'Hjälp']} />
          : <p className="text-[11px] text-slate-400">Dagens besök visas här.</p>}
      </NySkarm>
    )
  }

  const visaDetalj = l.vy !== 'ko' && l.vy !== 'statistik' && l.vy !== 'skickat'
  const over: ReactNode = l.vy === 'pdf' || l.vy === 'fraga'
    ? <PdfRuta fraga={l.vy === 'fraga'} tryck={tryck} mk={mk} />
    : l.vy === 'loggat' ? <Notis text="Samtalet är loggat" />
      : l.vy === 'skickat' ? <Notis text="Offerten är skickad" /> : undefined

  const statistik = (
    <div className="grid gap-1.5 rounded-xl border border-slate-700/60 bg-slate-900 p-2.5 text-[11px] text-slate-300">
      <p className="font-semibold text-white">Statistik</p>
      <p>Dina egna offerter och avtal: hur många som skickats och signerats, och hur lång tid det tog.</p>
    </div>
  )

  let innehall: ReactNode
  if (dator) {
    innehall = (
      <>
        <Topp tryck={tryck} mk={mk} dator statistik={l.vy === 'statistik'} />
        {l.vy === 'statistik' ? statistik : (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2">
            <Lista tryck={tryck} mk={mk} dator valdId={visaDetalj ? (l.vy === 'utkast' || l.vy === 'pdf' || l.vy === 'fraga' ? 'utkast' : 'ab') : undefined} skickat={l.vy === 'skickat'} />
            {visaDetalj ? <Detalj l={l} tryck={tryck} mk={mk} dator /> : (
              <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 p-4 text-center">
                <Icon name="falt.klart" size={24} className="text-[#20c58f]" />
                <p className="text-[12px] font-semibold text-white">Inget att visa</p>
                <p className="text-[10.5px] text-slate-400">Välj ett dokument i listan.</p>
              </div>
            )}
          </div>
        )}
      </>
    )
  } else if (visaDetalj) {
    innehall = <Detalj l={l} tryck={tryck} mk={mk} dator={false} />
  } else {
    innehall = <><Topp tryck={tryck} mk={mk} dator={false} statistik={l.vy === 'statistik'} />{l.vy === 'statistik' ? statistik : <Lista tryck={tryck} mk={mk} dator={false} skickat={l.vy === 'skickat'} />}</>
  }

  return (
    <NySkarm sida="dokumentsignering" titel="Dokumentsignering" under={under} onRam={tryck} markor={markor} over={over}>
      {innehall}
    </NySkarm>
  )
}

// --- Visning ---

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'start', nadde: false }, markera: 'oppna' },
  { lage: { vy: 'ko', nadde: false }, markera: 'rad:ab' },
  { lage: { vy: 'ab', nadde: false }, markera: 'ring' },
  { lage: { vy: 'samtal', nadde: false }, markera: 'utfall:nadde' },
  { lage: { vy: 'samtal', nadde: true }, markera: 'spara-samtal' },
  { lage: { vy: 'loggat', nadde: true }, markera: 'oneflow' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  return <VisningSteg key={`${steg}-${enhet}`} steg={steg} onNasta={onNasta} enhet={enhet} />
}

function VisningSteg({ steg, onNasta, enhet }: { steg: number; onNasta: () => void; enhet: GuideEnhet }) {
  const [merOppen, setMerOppen] = useState(false)
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const nr = steg + 1
  if (v.markera === 'oppna') {
    // Första steget: i telefonen Mer och sedan Dokumentsignering, på datorn sidomenyn
    if (enhet === 'dator') {
      return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Dokumentsignering' }} tryck={id => { if (id === 'nav:Dokumentsignering') onNasta() }} />
    }
    if (!merOppen) return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Mer' }} tryck={id => { if (id === 'nav:Mer') setMerOppen(true) }} />
    return <Skarm l={{ ...v.lage, vy: 'mer' }} enhet={enhet} mk={mkFor('nav:Dokumentsignering', nr)} tryck={id => { if (id === 'nav:Dokumentsignering') onNasta() }} />
  }
  return <Skarm l={v.lage} enhet={enhet} mk={mkFor(v.markera, nr)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Offerten till Familjen Exempel ligger som utkast. Skicka den till kunden. Börja med att öppna Dokumentsignering.' }

const RAD_TIPS: Record<string, string> = {
  'rad:brf': 'Brf Exempelgården har skrivit en fråga. Den är viktig, men uppdraget gäller utkastet till Familjen Exempel.',
  'rad:ab': 'Exempel AB har inte öppnat offerten. Ring dem senare. Uppdraget gäller utkastet till Familjen Exempel.',
  'rad:vantar': 'Avtalet väntar på kunden. Inget att göra än. Leta under Utkast att skicka.',
  'rad:signerad': 'Den offerten är redan signerad. Kontoret bokar in. Leta under Utkast att skicka.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>({ vy: 'start', nadde: false })
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (vy: Vy) => setL({ vy, nadde: false })

  const tryck = (id: string) => {
    switch (l.vy) {
      case 'start':
        if (id === 'nav:Mer' && enhet === 'mobil') { ga('mer'); tips('Mer', 'Dokumentsignering står under Sälja.') }
        else if (id === 'nav:Dokumentsignering') { ga('ko'); tips('Arbetskön', 'Utkasten ligger under Att göra, Utkast att skicka.') }
        else miss(vagTill('Dokumentsignering', enhet))
        return
      case 'mer':
        if (id === 'nav:Dokumentsignering') { ga('ko'); tips('Arbetskön', 'Utkasten ligger under Att göra, Utkast att skicka.') }
        else miss('Dokumentsignering står under Sälja, indraget under Avtal och offerter.')
        return
      case 'ko':
      case 'ab':
        if (id === 'rad:utkast') { ga('utkast'); tips('Utkastet är öppet', 'Nästa steg står i rutan. Tryck Granska och skicka.') }
        else if (RAD_TIPS[id]) miss(RAD_TIPS[id])
        else if (id === 'vy:statistik' || id === 'statrad') miss('Statistik visar dina siffror. Utkastet hittar du i Arbetskö.')
        else if (id === 'tillbaka') ga('ko')
        else miss('Tryck på Familjen Exempel under Utkast att skicka.')
        return
      case 'utkast':
        if (id === 'granska') { ga('pdf'); tips('Oneflows PDF', 'Så ser kunden offerten. Ser den rätt ut, tryck Skicka offerten.') }
        else if (id === 'oneflow') miss('Öppna i Oneflow öppnar Oneflow i en ny flik. Du kan skicka direkt här med Granska och skicka.')
        else if (id === 'tillbaka') { ga('ko'); miss('Du gick tillbaka till listan. Öppna utkastet igen.') }
        else if (id.startsWith('rad:') && RAD_TIPS[id]) miss(RAD_TIPS[id])
        else miss('Tryck Granska och skicka.')
        return
      case 'pdf':
        if (id === 'skicka') { ga('fraga'); tips('En sista fråga', 'Portalen frågar om du vill skicka. Kontrollera e-postadressen och tryck OK.') }
        else if (id === 'stang') { ga('utkast'); miss('Stäng stänger PDF:en utan att skicka. Tryck Granska och skicka igen.') }
        else miss('Tryck Skicka offerten.')
        return
      case 'fraga':
        if (id === 'fraga-ok') {
          ga('skickat')
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Offerten är skickad från info@begone.se till ${EPOST}. Den flyttade till Väntar på kunden.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        } else if (id === 'fraga-avbryt') { ga('pdf'); miss('Avbryt skickar inget. Tryck Skicka offerten igen och sedan OK.') }
        return
    }
  }

  const ordning: Vy[] = enhet === 'dator' ? ['start', 'ko', 'utkast', 'pdf', 'fraga', 'skickat'] : ['start', 'mer', 'ko', 'utkast', 'pdf', 'fraga', 'skickat']
  const framsteg = Math.max(0, ordning.indexOf(l.vy))
  return (
    <OvningRam framsteg={framsteg} totalt={ordning.length - 1} svar={svar} onBorjaOm={() => { ga('start'); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
