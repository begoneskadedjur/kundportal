// src/pages/shared/intranet/guider/guide-aterkommande-schema.tsx
// Guidemodul: Lägg upp ett återkommande schema (admin och koordinator, dator).
// Etiketterna följer RonderingSchedulePage (Rondering & Schemaläggning, Nytt schema,
// Nytt återkommande schema, Kund, Sök kund..., Ärendetyp, Stationskontroll, Ansvarig
// tekniker, Välj tekniker..., Fortsätt till schemaläggning) och RecurringScheduleWizard
// (Återkommande kontroller, Steg N av 5: Startdatum / Tid per besök / Frekvens & dag /
// Klockslag / Förhandsvisning, Enligt avtalet, Kvartalsvis, Första helgfria vardagen,
// Nästa, Tillbaka, Skapa N kontrolltillfällen, N kontrolltillfällen skapade). Påhittad kund.

import { useState, type ReactNode } from 'react'
import {
  Dator, DatorSida, Falt, Knapprad, Notis, OvningRam, PKnapp, Status,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'

type Vy = 'lista' | 'valj' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'klart'

interface Lage {
  vy: Vy
  kund: boolean
  tekniker: boolean
  datum: boolean
  langd: number
  frekvens: 'kvartal' | 'manad' | 'halvar'
  dag: 'forsta' | 'mandag' | null
  timme: number | null
  bort: number[]
}

const MENY = ['Öppna schema', 'Ärenden', 'Rondering & Schema', 'Befintliga kunder']
const STEG = ['Startdatum', 'Tid per besök', 'Frekvens & dag', 'Klockslag', 'Förhandsvisning']
const DATUM = ['måndag 2 november 2026', 'tisdag 2 februari 2027', 'måndag 3 maj 2027', 'måndag 2 augusti 2027']
const LANGDER: [number, string][] = [[30, '30 min'], [45, '45 min'], [60, '1 timme'], [90, '1,5 timmar']]
const FREKVENSER: { id: Lage['frekvens']; namn: string; text: string }[] = [
  { id: 'manad', namn: 'Månadsvis', text: '1 besök per månad' },
  { id: 'kvartal', namn: 'Kvartalsvis', text: 'Var 3:e månad' },
  { id: 'halvar', namn: 'Halvårsvis', text: 'Var 6:e månad' },
]

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Knapp({ vald, onClick, children }: { vald?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full rounded-lg border p-2 text-left text-[12px] ${vald ? 'border-[#20c58f] bg-[#20c58f]/20 text-[#20c58f]' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
      {children}
    </button>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const wizard = l.vy.startsWith('w') || l.vy === 'klart'
  const steg = wizard && l.vy !== 'klart' ? Number(l.vy.slice(1)) : 5
  const antal = DATUM.length - l.bort.length
  const tid = l.timme ?? 8
  return (
    <Dator adress="koordinator › rondering-schema">
      <div className="relative h-[480px]">
        <DatorSida meny={MENY} aktiv="Rondering & Schema" titel="Rondering & Schemaläggning">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400">Återkommande kontroller och egenkontroller</p>
            <PKnapp prim ikon="allman.plus" onClick={() => tryck('nytt')} markor={mk(markera, 'nytt', nr)}>Nytt schema</PKnapp>
          </div>
          <div className="grid gap-1.5">
            {[['Exempel AB Lager', 'Månadsvis · Anna Exempel'], ['Exempel AB Kontor', 'Kvartalsvis · Erik Exempel']].map(([k, t]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-2.5 py-2">
                <span><span className="block text-[12px] font-medium text-white">{k}</span><span className="block text-[11px] text-slate-400">{t}</span></span>
                <Status text="Aktiv" farg="bg-[#20c58f]" />
              </div>
            ))}
          </div>
        </DatorSida>

        {l.vy === 'valj' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
            <div className="grid w-full max-w-md gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 p-3.5 shadow-2xl">
              <p className="text-sm font-semibold text-white">Nytt återkommande schema</p>
              <Falt etikett="Kund" varde={l.kund ? 'Brf Exempelgården' : 'Sök kund...'} tom={!l.kund} onClick={() => tryck('kund')} />
              <Falt etikett="Ärendetyp" varde="Stationskontroll" onClick={() => tryck('arendetyp')} />
              <Falt etikett="Ansvarig tekniker" varde={l.tekniker ? 'Anna Exempel' : 'Välj tekniker...'} tom={!l.tekniker} onClick={() => tryck('tekniker')} />
              <Knapprad>
                <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
                <PKnapp prim inaktiv={!l.kund || !l.tekniker} onClick={() => tryck('fortsatt')} markor={mk(markera, 'fortsatt', nr)}>Fortsätt till schemaläggning</PKnapp>
              </Knapprad>
            </div>
          </div>
        )}

        {wizard && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
            <div className="grid max-h-full w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="border-b border-slate-700 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-white">Återkommande kontroller</p>
                <p className="text-[11px] text-slate-400">Brf Exempelgården</p>
              </div>
              <div className="border-b border-slate-800 px-3.5 py-2">
                <div className="flex gap-1">{STEG.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i + 1 <= steg ? 'bg-[#20c58f]' : 'bg-slate-700'}`} />)}</div>
                <p className="mt-1 text-[11px] text-slate-500">Steg {steg} av 5: {STEG[steg - 1]}</p>
              </div>
              <div className="grid gap-1.5 px-3.5 py-2.5">
                {steg === 1 && (
                  <>
                    <p className="text-[12px] text-slate-300">När ska kontrollerna börja? Välj startdatum för det återkommande schemat.</p>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                      {['må', 'ti', 'on', 'to', 'fr', 'lö', 'sö'].map(d => <span key={d} className="text-slate-500">{d}</span>)}
                      {Array.from({ length: 14 }, (_, i) => i + 2).map(d => (
                        <button key={d} type="button" onClick={() => tryck(d === 2 ? 'datum' : 'datum-annat')}
                          className={`rounded py-0.5 ${d === 2 && l.datum ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-300 hover:bg-slate-800'}`}>{d}</button>
                      ))}
                    </div>
                    <p className="text-center text-[11px] text-slate-500">Första kontroll: {l.datum ? 'måndag 2 november 2026' : 'fredag 16 oktober 2026'}</p>
                    <p className="text-center text-[11px] text-slate-500">Kontroller läggs ut för hela avtalsperioden, till 1 sep 2027. Sägs avtalet inte upp senast 1 jul 2027 läggs ett år till ut automatiskt dagen efter.</p>
                  </>
                )}
                {steg === 2 && (
                  <>
                    <p className="text-[12px] text-slate-300">Hur lång tid tar en kontrollrunda hos denna kund? Detta används för att undvika krockar med andra ärenden.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LANGDER.map(([v, t]) => <Knapp key={v} vald={l.langd === v} onClick={() => tryck(`langd-${v}`)}>{t}</Knapp>)}
                    </div>
                  </>
                )}
                {steg === 3 && (
                  <>
                    <p className="rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10 px-2.5 py-1.5 text-[11px] text-[#7fe0bf]">Enligt avtalet: <b className="text-[#20c58f]">4 besök per år</b> (kvartalsvis). Förvalt nedan, ändra om schemat ska läggas annorlunda.</p>
                    {FREKVENSER.map(f => <Knapp key={f.id} vald={l.frekvens === f.id} onClick={() => tryck(`frekvens-${f.id}`)}>{f.namn} <span className="text-slate-500">{f.text}</span></Knapp>)}
                    <p className="pt-1 text-[11.5px] text-slate-300">Vilken dag i varje period ska kontrollen läggas?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Knapp vald={l.dag === 'forsta'} onClick={() => tryck('dag-forsta')}>Första helgfria vardagen</Knapp>
                      <Knapp vald={l.dag === 'mandag'} onClick={() => tryck('dag-mandag')}>Första måndagen</Knapp>
                    </div>
                  </>
                )}
                {steg === 4 && (
                  <>
                    <p className="text-[12px] text-slate-300">Vilken tid på dagen ska kontrollen börja?</p>
                    <div className="flex justify-center gap-1.5">
                      {[7, 8, 9, 10].map(h => (
                        <button key={h} type="button" onClick={() => tryck(`timme-${h}`)}
                          className={`rounded-lg border px-3 py-2 text-base ${l.timme === h ? 'border-[#20c58f] bg-[#20c58f]/20 text-[#20c58f]' : 'border-slate-700 bg-slate-800 text-white'}`}>{String(h).padStart(2, '0')}:00</button>
                      ))}
                    </div>
                  </>
                )}
                {steg === 5 && (
                  <>
                    <p className="text-[12px] text-slate-300">{antal} kontrolltillfällen</p>
                    {DATUM.map((d, i) => {
                      const bort = l.bort.includes(i)
                      return (
                        <button key={d} type="button" onClick={() => tryck(`datum-${i}`)}
                          className={`flex items-center gap-2 rounded-lg border p-1.5 text-left text-[11.5px] ${bort ? 'border-slate-800 opacity-40' : 'border-slate-700 bg-slate-800'}`}>
                          <span className={`h-4 w-4 flex-none rounded border-2 ${bort ? 'border-slate-600' : 'border-[#20c58f] bg-[#20c58f]'}`} aria-hidden />
                          <span className={bort ? 'text-slate-600 line-through' : 'text-slate-200'}>{d}</span>
                          <span className="text-slate-500">{String(tid).padStart(2, '0')}:00-{String(tid + 1).padStart(2, '0')}:00</span>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-700 px-3.5 py-2.5">
                <PKnapp onClick={() => tryck('tillbaka')}>{steg === 1 ? 'Avbryt' : 'Tillbaka'}</PKnapp>
                {steg < 5
                  ? <PKnapp prim onClick={() => tryck('nasta')} markor={mk(markera, 'nasta', nr)}>Nästa</PKnapp>
                  : <PKnapp prim ikon="allman.bock" onClick={() => tryck('skapa')} markor={mk(markera, 'skapa', nr)}>Skapa {antal} kontrolltillfällen</PKnapp>}
              </div>
            </div>
          </div>
        )}
        {l.vy === 'klart' && <Notis text={`${antal} kontrolltillfällen skapade`} />}
      </div>
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'lista', kund: false, tekniker: false, datum: false, langd: 60, frekvens: 'kvartal', dag: null, timme: null, bort: [] }
const KLAR: Lage = { ...BAS, kund: true, tekniker: true, datum: true, dag: 'forsta', timme: 8 }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'nytt' },
  { lage: { ...BAS, vy: 'valj', kund: true, tekniker: true }, markera: 'fortsatt' },
  { lage: { ...KLAR, vy: 'w1' }, markera: 'nasta' },
  { lage: { ...KLAR, vy: 'w2' }, markera: 'nasta' },
  { lage: { ...KLAR, vy: 'w3' }, markera: 'nasta' },
  { lage: { ...KLAR, vy: 'w4' }, markera: 'nasta' },
  { lage: { ...KLAR, vy: 'w5' }, markera: 'skapa' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i Rondering & Schema. Leta upp knappen för ett nytt schema.' }

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (vy: Vy, titel: string, text: string) => { setL(prev => ({ ...prev, vy })); tips(titel, text) }

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    switch (l.vy) {
      case 'lista':
        if (id === 'nytt') ga('valj', 'Rutan är öppen', 'Välj kund och tekniker. Ärendetypen är redan Stationskontroll.')
        else miss('Knappen Nytt schema finns uppe till höger.')
        return
      case 'valj':
        if (id === 'kund') { setL({ ...l, kund: true }); tips('Kunden är vald', 'Brf Exempelgården. Välj tekniker.') }
        else if (id === 'tekniker') { setL({ ...l, tekniker: true }); tips('Anna Exempel', 'Fortsätt till schemaläggningen.') }
        else if (id === 'arendetyp') tips('Stationskontroll', 'Det är rätt typ för kontroller av stationerna. Behåll den.')
        else if (id === 'fortsatt') {
          if (!l.kund || !l.tekniker) miss('Knappen fungerar först när kund och tekniker är valda.')
          else ga('w1', 'Steg 1 av 5', 'Uppdraget var start måndag 2 november.')
        } else miss('Avbryt stänger rutan. Välj kund och tekniker i stället.')
        return
      case 'w1':
        if (id === 'datum') { setL({ ...l, datum: true }); tips('Startdatum valt', 'Måndag 2 november 2026. Tryck Nästa.') }
        else if (id === 'datum-annat') miss('Uppdraget var måndag den 2:a.')
        else if (id === 'nasta') { if (!l.datum) miss('Välj den 2:a i kalendern först.'); else ga('w2', 'Tid per besök', 'Hur lång tid tar en runda hos kunden? Uppdraget var 1 timme.') }
        else miss('Avbryt stänger guiden. Välj datum och tryck Nästa.')
        return
      case 'w2':
        if (id.startsWith('langd-')) {
          const v = Number(id.slice(6)); setL({ ...l, langd: v })
          if (v === 60) tips('1 timme', 'Tiden används för att undvika krockar. Tryck Nästa.'); else miss('Uppdraget var 1 timme per besök.')
        } else if (id === 'nasta') { if (l.langd !== 60) miss('Välj 1 timme först.'); else ga('w3', 'Frekvens & dag', 'Avtalets takt står överst och är förvald.') }
        else if (id === 'tillbaka') setL({ ...l, vy: 'w1' })
        return
      case 'w3':
        if (id.startsWith('frekvens-')) {
          const f = id.slice(9) as Lage['frekvens']; setL({ ...l, frekvens: f })
          if (f === 'kvartal') tips('Kvartalsvis', 'Som i avtalet. Välj dag.'); else miss('Avtalet säger 4 besök per år. Det är kvartalsvis.')
        } else if (id === 'dag-forsta') { setL({ ...l, dag: 'forsta' }); tips('Första helgfria vardagen', 'Röda dagar hoppas över automatiskt. Tryck Nästa.') }
        else if (id === 'dag-mandag') { setL({ ...l, dag: 'mandag' }); miss('Uppdraget var första helgfria vardagen.') }
        else if (id === 'nasta') {
          if (l.frekvens !== 'kvartal') miss('Välj Kvartalsvis, som i avtalet.')
          else if (l.dag !== 'forsta') miss('Välj Första helgfria vardagen.')
          else ga('w4', 'Klockslag', 'Uppdraget var 08:00.')
        } else if (id === 'tillbaka') setL({ ...l, vy: 'w2' })
        return
      case 'w4':
        if (id.startsWith('timme-')) {
          const h = Number(id.slice(6)); setL({ ...l, timme: h })
          if (h === 8) tips('08:00', 'Tryck Nästa för att se datumen.'); else miss('Uppdraget var 08:00.')
        } else if (id === 'nasta') { if (l.timme !== 8) miss('Välj 08:00 först.'); else ga('w5', 'Förhandsvisning', 'Kontrollera datumen. Alla fyra passar, så du kan skapa schemat.') }
        else if (id === 'tillbaka') setL({ ...l, vy: 'w3' })
        return
      case 'w5':
        if (id.startsWith('datum-')) {
          const i = Number(id.slice(6))
          const bort = l.bort.includes(i) ? l.bort.filter(x => x !== i) : [...l.bort, i]
          setL({ ...l, bort })
          if (bort.length) miss('Ett tryck på ett datum tar bort det. Alla fyra skulle vara med, tryck igen för att ta tillbaka det.')
          else tips('Alla fyra är med', 'Tryck Skapa 4 kontrolltillfällen.')
        } else if (id === 'skapa') {
          if (l.bort.length) miss('Ett datum är bortvalt. Ta tillbaka det först.')
          else {
            setL({ ...l, vy: 'klart' })
            setSvar({
              typ: 'ok',
              titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
              text: `Fyra stationskontroller är bokade på Anna Exempel för hela avtalsperioden, och därefter läggs ett år i taget ut automatiskt. De syns i schemat som vanliga ärenden och kan flyttas en och en.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
            })
          }
        } else if (id === 'tillbaka') setL({ ...l, vy: 'w4' })
        return
    }
  }

  const ordning: Vy[] = ['lista', 'valj', 'w1', 'w2', 'w3', 'w4', 'w5', 'klart']
  return (
    <OvningRam bred framsteg={ordning.indexOf(l.vy)} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
