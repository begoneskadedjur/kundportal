// src/pages/shared/intranet/guider/guide-placera-stationer.tsx
// Guidemodul: Gör en etablering och placera stationerna (tekniker, nya arbetsvyn,
// telefon och dator). Slugen behålls för länkar och läsloggen.
// Etiketterna följer EditContractCaseModal i stegflödet (service_type establishment:
// Framme, Arbetet, Foton och preparat, Rapport, Utöver avtalet, Klart; Jag är framme;
// HjalpText Placera ut stationerna; Gå till utplacering som går till Stationer med
// ?customer=), AddStationWizard (Välj typ, Vald kund, Var ska stationen placeras?,
// Utomhus, Inomhus), EtableringsFlode (Placera station utomhus, Stäng och avsluta
// placeringen, Stationen är placerad, N stationer placerade nu, Placera fler utomhus,
// Placera inomhus, Färdig med etablering, Återkommande kontroller, Senare, Lägg upp
// schema), EquipmentPlacementForm (Utrustningstyp *, Tillägg utöver avtal, GPS-position *,
// Hämta GPS, Välj på karta, GPS hämtad, Noggrannhet, Avbryt, Skapa placering, felet
// GPS-position krävs. Tryck på Hämta GPS.) och PagaendeEtablering/AvslutaEtablering
// (Pågående etablering, X av Y stationer placerade, Placera station, Avsluta etablering,
// Avsluta ändå). Kontrollerat 2026-10-24. Påhittad kund.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { NyArende, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import {
  FrammeSteg, Hjalp, PlaceraUtomhus, Placerad, SchemaFraga, StationerSida, Toast, ValjTyp,
  type Placering, type TypNyckel,
} from './_nyvy_stationer'

type Vy = 'framme' | 'arbete' | 'typ' | 'form' | 'placerad' | 'schema' | 'klar'

interface Lage {
  vy: Vy
  p: Placering
  placerade: number
  toast: string | null
}

const KUND = 'Exempel AB'
const AVTALAT = 3

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  if (l.vy === 'framme' || l.vy === 'arbete') {
    return (
      <NySkarm sida="arenden" titel="Mina ärenden" under="3 att ta hand om nu" onRam={tryck}
        over={
          <NyArende typ="establishment" aktivt={l.vy} nr="BE-0004512" status="Bokad" kund={`${KUND}, Exempelgatan 12, Gävle`}
            nastaText={l.vy === 'framme' ? 'Jag är framme' : undefined} onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')}
            onSteg={id => tryck(`steg:${id}`)} onIkon={tryck} markor={markera === 'nasta' ? { pa: true, nr, mal: 'nasta' } : undefined}>
            {l.vy === 'framme' && <FrammeSteg kontakt="Anna Exempel" />}
            {l.vy === 'arbete' && (
              <div className="grid gap-1.5">
                <Hjalp rubrik="Placera ut stationerna">Utplaceringen görs på sidan Stationer. När du trycker Färdig med etablering där avslutas ärendet.</Hjalp>
                <span className={markera === 'utplacering' ? 'block rounded-xl ring-[2.5px] ring-[#20c58f] ring-offset-2 ring-offset-slate-900 motion-safe:animate-pulse' : 'block'}>
                  <button type="button" onClick={() => tryck('utplacering')} className="relative flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/60 text-[12.5px] font-semibold text-white">
                    <Icon name="bokning.etablering" size={20} />Gå till utplacering
                    {markera === 'utplacering' && <span className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#20c58f] text-[11px] font-bold text-[#fff]">{nr}</span>}
                  </button>
                </span>
                <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-2 text-[10.5px] text-slate-400">
                  <p className="font-semibold text-slate-200">Ärendeinformation</p>
                  <p>Etablering enligt avtal: {AVTALAT} betongstationer runt fastigheten.</p>
                </div>
              </div>
            )}
          </NyArende>
        }>
        <p className="text-[11px] text-slate-400">Mina ärenden</p>
      </NySkarm>
    )
  }
  const etablering = { kund: KUND, placerade: l.placerade, avtalat: AVTALAT }
  return (
    <NySkarm sida="stationer" titel="Stationer" under="3 kunder, 26 stationer" onRam={tryck}
      over={<>
        {l.vy === 'typ' && <ValjTyp kund={KUND} tryck={tryck} markera={markera} nr={nr} />}
        {l.vy === 'form' && <PlaceraUtomhus kund={KUND} p={l.p} tryck={tryck} markera={markera} nr={nr} />}
        {l.vy === 'placerad' && <Placerad kund={KUND} antal={l.placerade} tryck={tryck} markera={markera} nr={nr} />}
        {l.vy === 'schema' && <SchemaFraga kund={KUND} tryck={tryck} markera={markera} nr={nr} />}
        {l.toast && <Toast text={l.toast} />}
      </>}>
      <StationerSida etablering={l.vy === 'klar' || l.vy === 'schema' ? undefined : etablering} tryck={tryck} nr={nr} />
    </NySkarm>
  )
}

// ─── Visning ───

const TOM: Placering = { typ: null, tillagg: false, betalas: null, gps: false, fel: null, placerade: 0 }
const BAS: Lage = { vy: 'framme', p: TOM, placerade: 0, toast: null }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'nasta' },
  { lage: { ...BAS, vy: 'arbete' }, markera: 'utplacering' },
  { lage: { ...BAS, vy: 'typ' }, markera: 'utomhus' },
  { lage: { ...BAS, vy: 'form' }, markera: 'typ-betong' },
  { lage: { ...BAS, vy: 'form', p: { ...TOM, typ: 'betong' } }, markera: 'gps' },
  { lage: { ...BAS, vy: 'form', p: { ...TOM, typ: 'betong', gps: true } }, markera: 'skapa' },
  { lage: { ...BAS, vy: 'placerad', placerade: 1 }, markera: 'fardig' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: tre betongstationer enligt avtalet ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `Du står utanför ${KUND}. Avtalet har ${AVTALAT} betongstationer runt fastigheten. Tala om att du är framme.` }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte riktigt', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klar') return
    if (l.vy === 'framme') {
      if (id === 'nasta') { setL({ ...l, vy: 'arbete' }); tips('Du är framme', 'Steget Arbetet har knappen som tar dig till utplaceringen.') }
      else miss('Tryck på den gröna knappen Jag är framme längst ner.')
      return
    }
    if (l.vy === 'arbete') {
      if (id === 'utplacering') { setL({ ...l, vy: 'typ' }); tips('Sidan Stationer', 'Kunden är redan vald. Var ska stationerna stå?') }
      else if (id === 'nasta') miss('Vidare går till nästa steg i ärendet. Stationerna placerar du med Gå till utplacering.')
      else miss('Tryck Gå till utplacering i steget Arbetet.')
      return
    }
    if (l.vy === 'typ') {
      if (id === 'utomhus') { setL({ ...l, vy: 'form', p: { ...TOM, placerade: l.placerade } }); tips('Placera station utomhus', 'Välj typ och hämta positionen vid stationen.') }
      else if (id === 'inomhus') miss('Stationerna ska stå ute runt fastigheten. Välj Utomhus.')
      else miss('Välj Utomhus.')
      return
    }
    if (l.vy === 'form') {
      if (id.startsWith('typ-')) {
        const k = id.slice(4) as TypNyckel
        setL({ ...l, p: { ...l.p, typ: k, fel: null } })
        if (k === 'betong') tips('Betongstation vald', 'Stå vid stationen och hämta positionen.')
        else miss('Avtalet gäller betongstationer. Välj Betongstation.')
      } else if (id === 'tillagg') {
        setL({ ...l, p: { ...l.p, tillagg: !l.p.tillagg } })
        if (!l.p.tillagg) miss('Stationerna ingår i avtalet. Tillägg utöver avtal är bara för stationer kunden betalar för utöver avtalet. Bocka ur den.')
        else tips('Rätt', 'Stationen ingår i avtalet.')
      } else if (id === 'gps' || id === 'karta') {
        setL({ ...l, p: { ...l.p, gps: true, fel: null } })
        tips('Positionen är hämtad', 'Tryck Skapa placering.')
      } else if (id === 'skapa') {
        if (l.p.typ !== 'betong') miss('Välj Betongstation under Utrustningstyp först.')
        else if (l.p.tillagg) miss('Bocka ur Tillägg utöver avtal. Avtalsstationerna faktureras inte.')
        else if (!l.p.gps) { setL({ ...l, p: { ...l.p, fel: 'GPS-position krävs. Tryck på Hämta GPS.' } }); miss('Portalen sparar inte utan position. Tryck Hämta GPS först.') }
        else {
          const n = l.placerade + 1
          setL({ ...l, vy: 'placerad', placerade: n, toast: 'Utrustning placerad!' })
          tips(`${n} av ${AVTALAT}`, n < AVTALAT ? 'Avtalet har fler stationer. Fortsätt med nästa.' : 'Alla tre är ute. Avsluta etableringen.')
        }
      } else if (id === 'form-stang' || id === 'avbryt') {
        miss('Krysset och Avbryt avslutar placeringen och går vidare till avslutet av etableringen. Placera stationen först.')
      } else miss('Välj typ, hämta GPS och tryck Skapa placering.')
      return
    }
    if (l.vy === 'placerad') {
      if (id === 'fler') { setL({ ...l, vy: 'form', toast: null, p: { ...TOM, typ: 'betong', placerade: l.placerade } }); tips('Typen är kvar', 'Betongstation är redan vald från förra stationen. Gå till nästa plats och hämta GPS.') }
      else if (id === 'inne') miss('Alla stationer i avtalet står ute.')
      else if (id === 'fardig') {
        if (l.placerade < AVTALAT) miss(`Avtalet har ${AVTALAT} stationer och du har placerat ${l.placerade}. Tryck Placera fler utomhus.`)
        else { setL({ ...l, vy: 'schema', toast: null }); tips('Etableringen är stängd', 'Kunden har inget schema än, därför frågar portalen om kontrollerna.') }
      }
      return
    }
    if (l.vy === 'schema' && (id === 'senare' || id === 'schema')) {
      setL({ ...l, vy: 'klar' })
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Tre betongstationer är ute med position och etableringsärendet är stängt. Etableringen ingår i avtalet och faktureras inte. ${id === 'senare' ? 'Schemat lägger du upp senare under kundens Schema.' : 'Nu öppnas schemaläggningen.'}${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` })
    }
  }

  const framsteg = l.vy === 'framme' ? 0 : l.vy === 'arbete' ? 1 : l.vy === 'klar' ? 7 : l.vy === 'schema' ? 6 : 2 + l.placerade
  return (
    <OvningRam framsteg={Math.min(framsteg, 7)} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
