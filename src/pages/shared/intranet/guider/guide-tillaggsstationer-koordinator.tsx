// src/pages/shared/intranet/guider/guide-tillaggsstationer-koordinator.tsx
// Guidemodul: Boka etablering för tilläggsstationer (koordinator och admin, dator).
// Etiketterna följer CoordinatorSidebar (Öppna schema), ScheduleHeader (Schemaöversikt,
// Nytt ärende, Engångsärenden, Avtalskunder, Etablering Avtalskund) och CreateCaseModal
// (Ny etablering, Välj avtalskund (nyetablering) *, Sök och välj avtalskund...,
// Välj anläggning/site *, Adress *, Starttid *, Sluttid *, Tekniker, Ansvarig,
// Beskrivning till tekniker, Skapa & Boka Ärende, Etablering inbokad för). Påhittad kund.

import { useState } from 'react'
import {
  Dator, DatorSida, Falt, Knapprad, Markor, Notis, OvningRam, PKnapp,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'

type Vy = 'schema' | 'meny' | 'form' | 'klart'

interface Lage {
  vy: Vy
  kundLista: boolean
  kund: boolean
  siteLista: boolean
  site: 'lager' | 'kontor' | null
  tid: boolean
  beskrivning: boolean
}

const MENY = ['Öppna schema', 'Ärenden', 'Rondering & Schema', 'Befintliga kunder']
const BESKRIVNING = '2 mekaniska fällor som tillägg utöver avtalet, per år. Kunden vill ha dem vid lastkajen.'

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function MenyRad({ text, onClick, markor }: { text: string; onClick: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick} className="w-full px-3 py-1.5 text-left text-[12px] text-slate-200 hover:bg-slate-700/60">{text}</button>
    </Markor>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const siteNamn = l.site === 'lager' ? 'Exempel AB Lager' : l.site === 'kontor' ? 'Exempel AB Kontor' : null
  return (
    <Dator adress="koordinator › schema">
      <div className="relative h-[480px]">
        <DatorSida meny={MENY} aktiv="Öppna schema" titel="Schemaöversikt">
          <div className="mb-2 flex justify-end gap-1.5">
            <div className="relative">
              <PKnapp prim onClick={() => tryck('nytt')} markor={mk(markera, 'nytt', nr)}>Nytt ärende</PKnapp>
              {l.vy === 'meny' && (
                <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-800 py-1.5 shadow-2xl">
                  <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">Engångsärenden</p>
                  <MenyRad text="Engångsjobb Privatperson" onClick={() => tryck('privat')} />
                  <MenyRad text="Engångsjobb Företag" onClick={() => tryck('foretag')} />
                  <div className="my-1.5 border-t border-slate-700" />
                  <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">Avtalskunder</p>
                  <MenyRad text="Extrabesök Avtalskund" onClick={() => tryck('extrabesok')} />
                  <MenyRad text="Stationskontroll Avtalskund" onClick={() => tryck('kontroll')} />
                  <MenyRad text="Etablering Avtalskund" onClick={() => tryck('etablering')} markor={mk(markera, 'etablering', nr)} />
                  <MenyRad text="Rondering Trafikkontoret" onClick={() => tryck('rondering')} />
                  <MenyRad text="Egenkontroll" onClick={() => tryck('egenkontroll')} />
                </div>
              )}
            </div>
            <PKnapp onClick={() => tryck('franvaro')}>Frånvaro</PKnapp>
          </div>
          <div className="grid gap-1.5">
            {['Anna Exempel', 'Erik Exempel', 'Lisa Exempel'].map((t, i) => (
              <div key={t} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 px-2 py-1.5">
                <span className="w-24 text-[11.5px] text-slate-300">{t}</span>
                <span className={`h-5 rounded bg-sky-500/30 ${i === 1 ? 'ml-20 w-24' : 'ml-4 w-32'}`} aria-hidden />
              </div>
            ))}
          </div>
        </DatorSida>

        {(l.vy === 'form' || l.vy === 'klart') && (
          <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 p-3">
            <div className="grid w-full max-w-lg gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
              <p className="text-sm font-bold text-white">Ny etablering</p>
              <div className="relative grid gap-2 rounded-xl border border-lime-500/30 bg-lime-500/10 p-2">
                <Falt etikett="Välj avtalskund (nyetablering) *" varde={l.kund ? 'Exempel AB (5012)' : 'Sök och välj avtalskund...'} tom={!l.kund} onClick={() => tryck('kund')} markor={mk(markera, 'kund', nr)} />
                {l.kundLista && (
                  <div className="absolute inset-x-2 top-[58px] z-30 grid rounded-lg border border-slate-700 bg-slate-800 shadow-2xl">
                    <button type="button" onClick={() => tryck('kund-exempel')} className="px-3 py-1.5 text-left text-[12px] text-white hover:bg-slate-700/60">Exempel AB <span className="text-slate-400">#5012</span></button>
                    <button type="button" onClick={() => tryck('kund-brf')} className="px-3 py-1.5 text-left text-[12px] text-white hover:bg-slate-700/60">Brf Exempelgården <span className="text-slate-400">#5020</span></button>
                  </div>
                )}
              </div>
              {l.kund && (
                <div className="relative grid gap-1 rounded-xl border border-purple-500/30 bg-purple-500/10 p-2">
                  <Falt etikett="Välj anläggning/site *" varde={siteNamn ?? 'Välj anläggning...'} tom={!siteNamn} onClick={() => tryck('site')} markor={mk(markera, 'site', nr)} />
                  <p className="text-[10.5px] text-slate-500">Välj vilken anläggning ärendet gäller</p>
                  {l.siteLista && (
                    <div className="absolute inset-x-2 top-[58px] z-30 grid rounded-lg border border-slate-700 bg-slate-800 shadow-2xl">
                      <button type="button" onClick={() => tryck('site-kontor')} className="px-3 py-1.5 text-left text-[12px] text-white hover:bg-slate-700/60">Exempel AB Kontor</button>
                      <button type="button" onClick={() => tryck('site-lager')} className="px-3 py-1.5 text-left text-[12px] text-white hover:bg-slate-700/60">Exempel AB Lager</button>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Falt etikett="Adress *" varde={l.tid ? 'Lagervägen 3, Västerås' : 'Fullständig adress...'} tom={!l.tid} onClick={() => tryck('tid')} markor={mk(markera, 'tid', nr)} />
                <Falt etikett="Starttid *" varde={l.tid ? '2026-10-22 08:00' : 'Välj starttid...'} tom={!l.tid} onClick={() => tryck('tid')} />
                <Falt etikett="Sluttid *" varde={l.tid ? '2026-10-22 10:00' : 'Välj sluttid...'} tom={!l.tid} onClick={() => tryck('tid')} />
                <Falt etikett="Tekniker: Ansvarig" varde={l.tid ? 'Anna Exempel' : 'Ingen'} tom={!l.tid} onClick={() => tryck('tid')} />
              </div>
              <Falt etikett="Beskrivning till tekniker" varde={l.beskrivning ? BESKRIVNING : 'Kort om ärendet, portkod, etc.'} tom={!l.beskrivning} onClick={() => tryck('beskrivning')} markor={mk(markera, 'beskrivning', nr)} />
              <Knapprad>
                <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
                <PKnapp prim ikon="station.klar" onClick={() => tryck('skapa')} markor={mk(markera, 'skapa', nr)}>Skapa &amp; Boka Ärende</PKnapp>
              </Knapprad>
            </div>
          </div>
        )}
        {l.vy === 'klart' && <Notis text="Etablering inbokad för Exempel AB Lager!" />}
      </div>
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'schema', kundLista: false, kund: false, siteLista: false, site: null, tid: false, beskrivning: false }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'nytt' },
  { lage: { ...BAS, vy: 'meny' }, markera: 'etablering' },
  { lage: { ...BAS, vy: 'form' }, markera: 'kund' },
  { lage: { ...BAS, vy: 'form', kund: true }, markera: 'site' },
  { lage: { ...BAS, vy: 'form', kund: true, site: 'lager' }, markera: 'tid' },
  { lage: { ...BAS, vy: 'form', kund: true, site: 'lager', tid: true }, markera: 'beskrivning' },
  { lage: { ...BAS, vy: 'form', kund: true, site: 'lager', tid: true, beskrivning: true }, markera: 'skapa' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i Schemaöversikt. Leta upp knappen för att skapa ett ärende.' }

const TIPS: Record<string, string> = {
  franvaro: 'Frånvaro är för teknikernas ledighet. Du ska skapa ett ärende.',
  privat: 'Engångsjobb är för kunder utan avtal. Exempel AB har avtal.',
  foretag: 'Engångsjobb är för kunder utan avtal. Exempel AB har avtal.',
  extrabesok: 'Extrabesök är en enstaka tjänst utöver avtalet. Stationer sätts ut i en etablering.',
  kontroll: 'Stationskontroll är för att kontrollera stationer som redan står ute.',
  rondering: 'Rondering Trafikkontoret är en egen sorts uppdrag.',
  egenkontroll: 'Egenkontroll är en egen sorts uppdrag.',
  'kund-brf': 'Det är Brf Exempelgården. Uppdraget var Exempel AB.',
  'site-kontor': 'Fällorna ska stå vid lagret. Välj Exempel AB Lager.',
  avbryt: 'Avbryt stänger rutan utan att spara.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'schema') {
      if (id === 'nytt') { setL({ ...l, vy: 'meny' }); tips('Menyn är öppen', 'Vilken ärendetyp sätter ut stationer hos en avtalskund?') }
      else miss(TIPS[id] ?? 'Knappen Nytt ärende finns uppe till höger.')
      return
    }
    if (l.vy === 'meny') {
      if (id === 'etablering') { setL({ ...l, vy: 'form' }); tips('Rätt typ', 'Välj kunden.') }
      else if (id === 'nytt') setL({ ...l, vy: 'schema' })
      else miss(TIPS[id] ?? 'Välj Etablering Avtalskund.')
      return
    }
    // Formuläret
    if (id === 'kund') { setL({ ...l, kundLista: !l.kundLista, siteLista: false }); return }
    if (id === 'kund-exempel') { setL({ ...l, kund: true, kundLista: false }); tips('Kunden är vald', 'Exempel AB har flera enheter. Vilken ska fällorna stå på?'); return }
    if (id === 'site') {
      if (!l.kund) { miss('Välj kunden först.'); return }
      setL({ ...l, siteLista: !l.siteLista, kundLista: false }); return
    }
    if (id === 'site-lager') { setL({ ...l, site: 'lager', siteLista: false }); tips('Rätt enhet', 'Fyll i adress, tid och tekniker.'); return }
    if (id === 'tid') { setL({ ...l, tid: true, kundLista: false, siteLista: false }); tips('Tid och tekniker klara', 'Anna Exempel på torsdag 08:00 till 10:00. Skriv nu till teknikern vad som ska ut.'); return }
    if (id === 'beskrivning') { setL({ ...l, beskrivning: true }); tips('Beskrivningen är skriven', 'Teknikern ser vad som ska ut och hur kunden vill betala. Spara.'); return }
    if (id === 'skapa') {
      if (!l.kund) miss('Det står Du måste välja en avtalskund. Välj Exempel AB först.')
      else if (l.site !== 'lager') miss('Kunden har flera enheter. Välj Exempel AB Lager under Välj anläggning/site.')
      else if (!l.tid) miss('Adress, tid och tekniker saknas. Fyll i dem först.')
      else if (!l.beskrivning) miss('Teknikern vet inte vad som ska ut. Skriv det i Beskrivning till tekniker.')
      else {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Etableringen är bokad på Exempel AB Lager hos Anna Exempel. Hon ser beskrivningen i ärendet och sätter ut fällorna med Gå till utplacering.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
      return
    }
    if (id.startsWith('kund-') || id.startsWith('site-')) setL({ ...l, kundLista: false, siteLista: false })
    miss(TIPS[id] ?? 'Fyll i fälten uppifrån och ned.')
  }

  const framsteg = l.vy === 'schema' ? 0 : l.vy === 'meny' ? 1 : l.vy === 'klart' ? 7
    : 2 + (l.kund ? 1 : 0) + (l.site === 'lager' ? 1 : 0) + (l.tid ? 1 : 0) + (l.beskrivning ? 1 : 0)
  return (
    <OvningRam bred framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
