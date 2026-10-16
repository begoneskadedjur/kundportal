// src/pages/shared/intranet/guider/guide-skapa-arenden.tsx
// Guidemodul: Skapa ett ärende och välj rätt ärendetyp (admin och koordinator, dator).
// Etiketterna kommer från ScheduleHeader (Nytt ärende, Engångsärenden, Avtalskunder och
// typnamnen) och CreateCaseModal (Nytt ärende: Engångsjobb Privatperson, Intelligent Bokning,
// Adress *, Tjänst *, Tidsåtgång, Hitta bästa tid & tekniker, Bokningsförslag, Bokning & Detaljer,
// Kund & Kontakt, Kontaktperson *, Telefonnummer *, Personnummer *, Företagsnamn *, Kundgrupp,
// Starttid *, Sluttid *, Skapa & Boka Ärende, toasten Ärendet har skapats!).
// Påhittade kunder, ingenting sparas.

import { useState, type ReactNode } from 'react'
import { Dator, Falt, Notis, OvningRam, PKnapp, Val, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { DatorModal, NyttMeny, SchemaHuvud, SchemaRutnat, gorMk, type Besok, type Mk, type TeknikerRad, type Tryck } from './_arenden'

type Typ = 'private' | 'business'
type Vy = 'schema' | 'meny' | 'form' | 'klart'

interface Lage {
  vy: Vy
  typ: Typ
  adress: boolean
  tjanst: boolean
  forslag: boolean
  vald: boolean
  falt: string[]
}

const RADER: TeknikerRad[] = [
  { id: 'anna', namn: 'Anna Exempel' },
  { id: 'erik', namn: 'Erik Exempel' },
  { id: 'sara', namn: 'Sara Exempel' },
]
const BESOK: Besok[] = [
  { id: 'b1', kund: 'Brf Exempelgården', fran: 8, till: 10, rad: 'anna' },
  { id: 'b2', kund: 'Familjen Exempel', fran: 10.5, till: 11.5, rad: 'erik' },
]

const KUND: Record<Typ, { namn: string; adress: string; tjanst: string }> = {
  private: { namn: 'Familjen Exempel', adress: 'Exempelvägen 4, Södertälje', tjanst: 'Råttor' },
  business: { namn: 'Exempel AB', adress: 'Exempelgatan 12, Solna', tjanst: 'Möss' },
}

const FALT: Record<Typ, { id: string; etikett: string; varde: string }[]> = {
  private: [
    { id: 'falt-kontakt', etikett: 'Kontaktperson *', varde: 'Anna Exempel' },
    { id: 'falt-telefon', etikett: 'Telefonnummer *', varde: '070-123 45 67' },
    { id: 'falt-personnr', etikett: 'Personnummer *', varde: '19800101-1234' },
  ],
  business: [
    { id: 'falt-kontakt', etikett: 'Kontaktperson *', varde: 'Anna Exempel' },
    { id: 'falt-telefon', etikett: 'Telefonnummer *', varde: '070-123 45 67' },
    { id: 'falt-foretag', etikett: 'Företagsnamn *', varde: 'Exempel AB' },
    { id: 'falt-kundgrupp', etikett: 'Kundgrupp', varde: 'Företag Privat lokalt' },
  ],
}

const FORSLAG = [
  { id: 'forslag-1', tid: 'tisdag 20 oktober, 13:00 till 14:00', vem: 'Erik Exempel · 12 min restid' },
  { id: 'forslag-2', tid: 'onsdag 21 oktober, 08:00 till 09:00', vem: 'Sara Exempel · 25 min restid' },
]

const TITEL: Record<Typ, string> = {
  private: 'Nytt ärende: Engångsjobb Privatperson',
  business: 'Nytt ärende: Engångsjobb Företag',
}

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  const kund = KUND[l.typ]
  if (l.vy === 'form') {
    return (
      <Dator adress="koordinator › schema">
        <DatorModal titel={TITEL[l.typ]} fot={
          <div className="flex justify-end gap-1.5">
            <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
            <PKnapp prim ikon="station.klar" onClick={() => tryck('skapa')} markor={mk('skapa')}>Skapa & Boka Ärende</PKnapp>
          </div>
        }>
          <div className="grid gap-2.5 p-3 sm:grid-cols-2">
            <div className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="allman.blixt" size={16} className="text-blue-400" />Intelligent Bokning</p>
              <Falt etikett="Adress *" varde={l.adress ? kund.adress : 'Fullständig adress...'} tom={!l.adress} onClick={() => tryck('adress')} markor={mk('adress')} />
              <Falt etikett="Tjänst *" varde={l.tjanst ? kund.tjanst : 'Välj tjänst'} tom={!l.tjanst} onClick={() => tryck('tjanst')} markor={mk('tjanst')} />
              <Falt etikett="Tidsåtgång" varde="1 timme" onClick={() => tryck('tidsatgang')} />
              <div><PKnapp prim ikon="allman.blixt" onClick={() => tryck('hitta')} markor={mk('hitta')}>Hitta bästa tid & tekniker</PKnapp></div>
              {l.forslag && (
                <div className="grid gap-1.5 border-t border-slate-700 pt-2">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="bokning.forslag" size={16} className="text-purple-400" />Bokningsförslag ({FORSLAG.length} st)</p>
                  {FORSLAG.map(f => (
                    <Val key={f.id} titel={f.tid} text={f.vem} vald={l.vald && f.id === 'forslag-1'} onClick={() => tryck(f.id)} markor={mk(f.id)} />
                  ))}
                </div>
              )}
            </div>
            <div className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="allman.kalender" size={16} className="text-green-400" />Bokning & Detaljer</p>
              <MarkorGrupp mk={mk}>
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="rapport.person" size={16} className="h-3.5 w-3.5" />Kund & Kontakt</p>
                {FALT[l.typ].map(f => (
                  <Falt key={f.id} etikett={f.etikett} varde={l.falt.includes(f.id) ? f.varde : ''} tom={!l.falt.includes(f.id)} onClick={() => tryck(f.id)} />
                ))}
              </MarkorGrupp>
              <div className="grid gap-1.5 rounded-lg border border-slate-700/60 p-2">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="bokning.team" size={16} className="h-3.5 w-3.5" />Bokning & Team</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Falt etikett="Starttid *" varde={l.vald ? '2026-10-20 13:00' : 'Välj starttid...'} tom={!l.vald} onClick={() => tryck('starttid')} />
                  <Falt etikett="Sluttid *" varde={l.vald ? '2026-10-20 14:00' : 'Välj sluttid...'} tom={!l.vald} onClick={() => tryck('sluttid')} />
                </div>
                <p className="text-[11px] text-slate-400">Tekniker: <span className={l.vald ? 'font-semibold text-[#20c58f]' : 'text-slate-500'}>{l.vald ? 'Erik Exempel (Ansvarig)' : 'Ingen vald'}</span></p>
              </div>
            </div>
          </div>
        </DatorModal>
      </Dator>
    )
  }

  const klar = l.vy === 'klart'
  return (
    <Dator adress="koordinator › schema">
      <SchemaHuvud datum="måndag 19 oktober 2026" mk={mk} tryck={tryck}
        nyttMeny={l.vy === 'meny' ? <NyttMeny mk={mk} tryck={tryck} /> : undefined} />
      <SchemaRutnat rader={RADER} besok={BESOK} mk={mk} tryck={tryck} />
      {klar && <Notis text="Ärendet har skapats!" />}
    </Dator>
  )
}

/** Kund & Kontakt som en markerbar grupp: visningen markerar hela gruppen i steg 5 */
function MarkorGrupp({ mk, children }: { mk: Mk; children: ReactNode }) {
  const m = mk('kontakt')
  return (
    <div className={`relative grid gap-1.5 rounded-lg border p-2 ${m ? 'z-10 border-[#20c58f] ring-[2.5px] ring-[#20c58f] ring-offset-2 ring-offset-slate-900 motion-safe:animate-pulse' : 'border-slate-700/60'}`}>
      {children}
      {m && <span className="pointer-events-none absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#20c58f] text-[11px] font-bold text-[#fff] shadow" aria-hidden>{m.nr}</span>}
    </div>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'schema', typ: 'private', adress: false, tjanst: false, forslag: false, vald: false, falt: [] }
const ALLA_PRIVAT = FALT.private.map(f => f.id)

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'nytt' },
  { lage: { ...BAS, vy: 'meny' }, markera: 'typ-private' },
  { lage: { ...BAS, vy: 'form', adress: true, tjanst: true }, markera: 'hitta' },
  { lage: { ...BAS, vy: 'form', adress: true, tjanst: true, forslag: true }, markera: 'forslag-1' },
  { lage: { ...BAS, vy: 'form', adress: true, tjanst: true, forslag: true, vald: true }, markera: 'kontakt' },
  { lage: { ...BAS, vy: 'form', adress: true, tjanst: true, forslag: true, vald: true, falt: ALLA_PRIVAT }, markera: 'skapa' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const mk = gorMk(v.markera, steg + 1)
  return <Skarm l={v.lage} mk={mk} tryck={id => {
    if (id === v.markera || (v.markera === 'kontakt' && id.startsWith('falt-'))) onNasta()
  }} />
}

// ─── Övning: Exempel AB, utan avtal, möss ───

const START: Lage = { ...BAS, typ: 'business' }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i schemat. Leta upp knappen för ett nytt ärende uppe till höger.' }

const TIPS: Record<string, string> = {
  'typ-private': 'Exempel AB är ett företag, inte en privatperson.',
  'typ-contract': 'Exempel AB har inget avtal. Extrabesök Avtalskund är bara för avtalskunder.',
  'typ-inspection': 'Exempel AB har inget avtal och inga stationer.',
  'typ-establishment': 'Etablering är bara utplacering av stationer hos en avtalskund. Ett engångsjobb blir fel i hela kedjan.',
  'typ-rondering': 'Rondering Trafikkontoret är bara för regionalkundernas egenkontrollprogram.',
  'typ-egenkontroll': 'Egenkontroll är bara för regionalkundernas egenkontrollprogram.',
  franvaro: 'Frånvaro är för tekniker som är lediga eller sjuka.',
  filter: 'Filtret väljer vad schemat visar. Det skapar inga ärenden.',
  sok: 'Sökfältet hittar befintliga ärenden. Du ska skapa ett nytt.',
  avbryt: 'Avbryt stänger formuläret och allt du fyllt i försvinner.',
  'forslag-2': 'Uppdraget var det första förslaget.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const allaFalt = FALT.business.map(f => f.id)
  const saknas = allaFalt.filter(f => !l.falt.includes(f))

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'schema') {
      if (id === 'nytt') { setL({ ...l, vy: 'meny' }); tips('Listan är öppen', 'Exempel AB är ett företag utan avtal. Vilken typ passar?') }
      else miss(TIPS[id] ?? 'Ärendet skapar du med den gröna knappen Nytt ärende uppe till höger.')
      return
    }
    if (l.vy === 'meny') {
      if (id === 'typ-business') { setL({ ...l, vy: 'form' }); tips('Rätt typ', 'Fyll i adress och tjänst. Då kan bokningsassistenten leta tider.') }
      else if (id === 'nytt') { setL({ ...l, vy: 'schema' }); tips('Listan stängdes', 'Öppna den igen och välj typ.') }
      else miss(TIPS[id] ?? 'Välj den typ som passar ett företag utan avtal.')
      return
    }
    // Formuläret
    if (id === 'adress') { setL({ ...l, adress: true }); tips('Adressen är ifylld', 'Exempelgatan 12, Solna. Välj tjänst också.') }
    else if (id === 'tjanst') { setL({ ...l, tjanst: true }); tips('Tjänsten är vald', 'Möss. Nu kan portalen leta tider.') }
    else if (id === 'hitta') {
      if (!l.adress || !l.tjanst) miss('Det står Adress och Tjänst måste vara ifyllda. Fyll i båda först.')
      else { setL({ ...l, forslag: true }); tips('Här är förslagen', 'Välj det första förslaget.') }
    } else if (id === 'forslag-1') { setL({ ...l, vald: true }); tips('Tid och tekniker är valda', 'Starttid, Sluttid och Erik som ansvarig är ifyllda. Fyll i kunduppgifterna under Kund & Kontakt.') }
    else if (id.startsWith('falt-')) {
      const nya = l.falt.includes(id) ? l.falt : [...l.falt, id]
      setL({ ...l, falt: nya })
      const kvar = allaFalt.filter(f => !nya.includes(f)).length
      tips(kvar === 0 ? 'Kunduppgifterna är klara' : 'Ifyllt', kvar === 0 ? 'Tryck Skapa & Boka Ärende.' : `Fyll i ${kvar} fält till under Kund & Kontakt.`)
    } else if (id === 'skapa') {
      if (!l.vald) miss('Det står Alla fält med * under \'Bokning & Detaljer\' måste vara ifyllda. Välj ett förslag först, så fylls tid och tekniker i.')
      else if (saknas.includes('falt-kundgrupp')) miss('Det står Välj kundgrupp för företagskunden. Fyll i Kundgrupp under Kund & Kontakt.')
      else if (saknas.length > 0) miss('Fält med * saknas under Kund & Kontakt.')
      else {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Ärendet för Exempel AB är skapat som Engångsjobb Företag och bokat hos Erik tisdag 13:00. Det faktureras som ett eget engångsjobb när det avslutas.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Fyll i adress och tjänst, hitta en tid, fyll i kunden och skapa.')
  }

  const framsteg = l.vy === 'schema' ? 0 : l.vy === 'meny' ? 1 : l.vy === 'klart' ? 6
    : !l.forslag ? 2 : !l.vald ? 3 : saknas.length > 0 ? 4 : 5
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
