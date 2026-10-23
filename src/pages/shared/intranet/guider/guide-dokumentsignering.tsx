// src/pages/shared/intranet/guider/guide-dokumentsignering.tsx
// Guidemodul: Följ upp offerter och avtal i Dokumentsignering (admin och koordinator, dator).
// Kontorets sida byggdes om 2026-10-23 (KontorDokumentsignering). Säljaren har kvar den
// gamla sidan och sin egen guide (guide-dokumentsignering-saljare).
// Efterbildning av KontorLista (Att boka in, Väntar på kontoret, Fastnat hos tekniker med
// Påminn Erik, hopfällda Väntar på kunden och Klara), KontorDetalj (Nästa steg-rutan:
// "Förföll för 2 dagar sedan", "påminn Erik att förlänga och ringa kunden, eller förläng
// och ring själv.", Påminn Erik, Ring, Logga kontakt, Förläng frist, Svara kunden, Skriv av),
// PaminnTekniker (Påminnelsen till Erik, Skicka påminnelsen, toasten "Erik har fått
// påminnelsen") och LoggaSamtal (Logga kontakt med, Kanal, Hur gick det, Ring igen,
// Spara samtalet, toasten "Samtalet är loggat, du ringer igen 2026-10-24").
// Påhittad kund och kollegor, ingenting skickas.

import { useState } from 'react'
import { Notis, OvningRam, PKnapp, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { gorMk, type Mk, type Tryck } from './_arenden'
import {
  DetaljHuvud, Grupp, Hopfalld, KoRad, KontaktloggFlik, KontorSida, NastaRuta, UnderRubrik,
  type KoRadData, type LoggPost,
} from './_dokument'

type Panel = null | 'paminn' | 'samtal'
interface Lage {
  vald: 'brf' | 'ab'
  panel: Panel
  paminnd: boolean
  utfall: 'reached' | 'no_answer'
  ring: boolean
  loggat: boolean
  notis: string | null
}

const IDAG = '2026-10-23'
const IMORGON = '2026-10-24'

const BRF: KoRadData = { id: 'rad-brf', namn: 'Brf Exempelgården', ton: 'gron', status: 'Signerad igår 14:05', detalj: 'Ingen kontakt sedan signeringen', belopp: '4 900 kr', typ: 'Offert, Erik' }
const FAMILJ: KoRadData = { id: 'rad-familj', namn: 'Familjen Exempel', ton: 'bla', status: 'Skrev idag 09:12, inget svar än', detalj: 'Kunden i Oneflow: "Kan ni komma en fredag?"', belopp: '2 750 kr', typ: 'Offert, Sara' }

function abRad(l: Lage): KoRadData {
  const detalj = l.loggat ? `Ringd ${IDAG} av Sara, inget svar` : l.paminnd ? `Teknikern påmind ${IDAG}` : 'Ingen kontakt loggad'
  return { id: 'rad-ab', namn: 'Exempel AB', ton: 'rod', status: 'Förföll för 2 dagar sedan', detalj, belopp: '12 500 kr', typ: 'Avtal, Erik' }
}

function Val({ id, text, vald, mk, tryck }: { id: string; text: string; vald: boolean; mk: Mk; tryck: Tryck }) {
  const m = mk(id)
  return (
    <span className={`relative ${m ? 'z-10 rounded-lg ring-[2.5px] ring-[#20c58f] ring-offset-2 ring-offset-slate-900 motion-safe:animate-pulse' : ''}`}>
      <button type="button" onClick={() => tryck(id)}
        className={`w-full rounded-lg border px-2 py-1 text-left text-[11px] font-medium ${vald ? 'border-[#20c58f] bg-[#20c58f]/15 text-white' : 'border-slate-600 bg-slate-900 text-slate-300'}`}>
        {text}
      </button>
      {m && <span className="pointer-events-none absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#20c58f] text-[10px] font-bold text-[#fff]" aria-hidden>{m.nr}</span>}
    </span>
  )
}

function PaminnPanel({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <div className="grid gap-1.5 rounded-lg border border-slate-700 bg-slate-900 p-2.5">
      <p className="text-[12px] font-semibold text-white">Påminnelsen till Erik</p>
      <p className="text-[10.5px] text-slate-300">Går som notis i portalen och öppnar dokumentet i Eriks Dokumentsignering.</p>
      <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1.5">
        <p className="text-[11px] font-semibold text-white">Påminnelse: följ upp avtal 1234567, Exempel AB</p>
        <p className="text-[10.5px] text-slate-300">Sara Exempel vill att du följer upp avtal 1234567 till Exempel AB. Öppna dokumentet i Dokumentsignering.</p>
      </div>
      <p className="text-[10px] text-slate-400">Påminnelsen blir en post i kontaktloggen.</p>
      <div className="flex justify-end gap-1.5">
        <PKnapp onClick={() => tryck('paminn-avbryt')}>Avbryt</PKnapp>
        <PKnapp prim ikon="upphandling.notis" onClick={() => tryck('skicka-paminnelse')} markor={mk('skicka-paminnelse')}>Skicka påminnelsen</PKnapp>
      </div>
    </div>
  )
}

function SamtalPanel({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  return (
    <div className="grid gap-1.5 rounded-lg border border-slate-700 bg-slate-900 p-2.5">
      <p className="text-[12px] font-semibold text-white">Logga kontakt med Anna Exempel</p>
      <p className="text-[10.5px] font-semibold text-slate-300">Kanal</p>
      <div className="grid grid-cols-3 gap-1.5">
        <Val id="kanal-telefon" text="Telefon" vald mk={mk} tryck={tryck} />
        <Val id="kanal-mejl" text="Mejl" vald={false} mk={mk} tryck={tryck} />
        <Val id="kanal-sms" text="Sms" vald={false} mk={mk} tryck={tryck} />
      </div>
      <p className="text-[10.5px] font-semibold text-slate-300">Hur gick det</p>
      <div className="grid grid-cols-3 gap-1.5">
        <Val id="utfall-nadde" text="Nådde kunden" vald={l.utfall === 'reached'} mk={mk} tryck={tryck} />
        <Val id="utfall-rost" text="Röstbrevlåda" vald={false} mk={mk} tryck={tryck} />
        <Val id="utfall-inget" text="Inget svar" vald={l.utfall === 'no_answer'} mk={mk} tryck={tryck} />
      </div>
      <p className="text-[10.5px] font-semibold text-slate-300">Ring igen</p>
      <div className="flex flex-wrap gap-1.5">
        <Val id="ring-ingen" text="Ingen" vald={!l.ring} mk={mk} tryck={tryck} />
        <Val id="ring-imorgon" text="Imorgon" vald={l.ring} mk={mk} tryck={tryck} />
        <Val id="ring-tre" text="Om 3 dagar" vald={false} mk={mk} tryck={tryck} />
        <Val id="ring-mandag" text="Måndag" vald={false} mk={mk} tryck={tryck} />
      </div>
      <div className="flex justify-end gap-1.5">
        <PKnapp onClick={() => tryck('samtal-avbryt')}>Avbryt</PKnapp>
        <PKnapp prim ikon="allman.bock" onClick={() => tryck('spara-samtal')} markor={mk('spara-samtal')}>Spara samtalet</PKnapp>
      </div>
    </div>
  )
}

function Detalj({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vald === 'brf') {
    const poster: LoggPost[] = [
      { ikon: 'rapport.skicka', vem: 'Erik Exempel', etikett: 'skickade i Oneflow', nar: '2026-10-15 10:02' },
      { ikon: 'falt.signera', vem: 'Oneflow', etikett: 'signeringshändelse', nar: '2026-10-22 14:05' },
    ]
    return (
      <>
        <DetaljHuvud namn="Brf Exempelgården" rad1="Offert, 4 900 kr, BE-0001200, säljare Erik Exempel" rad2="Skickad 2026-10-15 av Erik Exempel" kontakt="Karin Exempel" tryck={tryck} />
        <NastaRuta ton="gron" status="Signerad igår 14:05" text="boka in och schemalägg. Ursprungsärendet stängs och offertens rader följer med till det nya ärendet.">
          <div className="flex flex-wrap gap-1.5">
            <PKnapp prim ikon="arendelista.boka" onClick={() => tryck('boka-in')}>Boka in</PKnapp>
            <PKnapp ikon="kontakt.telefon" onClick={() => tryck('ring')}>Ring Karin Exempel</PKnapp>
            <PKnapp ikon="allman.anteckning" onClick={() => tryck('logga-brf')}>Logga kontakt</PKnapp>
          </div>
        </NastaRuta>
        <KontaktloggFlik poster={poster} tryck={tryck} />
      </>
    )
  }

  const poster: LoggPost[] = [
    { ikon: 'rapport.skicka', vem: 'Erik Exempel', etikett: 'skickade i Oneflow', nar: '2026-10-07 09:40' },
    { ikon: 'allman.klocka', vem: 'Oneflow', etikett: 'signeringshändelse', nar: '2026-10-21 00:05' },
  ]
  if (l.paminnd) poster.push({ ikon: 'upphandling.notis', vem: 'Kontoret', etikett: 'påminnelse', nar: `${IDAG} 10:15`, text: 'Påminnelse till Erik Exempel skickad av Sara Exempel' })
  if (l.loggat) poster.push({ ikon: 'kontakt.telefon', vem: 'Du', etikett: 'samtal', nar: `${IDAG} 10:20`, text: 'Inget svar.' })

  return (
    <>
      <DetaljHuvud namn="Exempel AB" rad1="Avtal, 12 500 kr, säljare Erik Exempel" rad2="Skickad 2026-10-07 av Erik Exempel, fristen gick ut 2026-10-21" kontakt="Anna Exempel" tryck={tryck} />
      <NastaRuta
        ton="rod"
        status={`Förföll för 2 dagar sedan${l.paminnd || l.loggat ? `, senaste kontakt ${IDAG}` : ''}`}
        text="påminn Erik att förlänga och ringa kunden, eller förläng och ring själv."
        fot="Samtal, förlängning och påminnelse hamnar i kontaktloggen. Skriv av är för döda affärer: du anger en anledning och dokumentet flyttas till Klara."
      >
        {l.panel !== 'paminn' && (
          <div><PKnapp prim ikon="upphandling.notis" onClick={() => tryck('paminn')} markor={mk('paminn')}>Påminn Erik</PKnapp></div>
        )}
        {l.panel === 'paminn' && <PaminnPanel mk={mk} tryck={tryck} />}
        {l.panel === 'samtal' && <SamtalPanel l={l} mk={mk} tryck={tryck} />}
        <div className="flex flex-wrap gap-1.5">
          <PKnapp ikon="kontakt.telefon" onClick={() => tryck('ring')}>Ring Anna Exempel</PKnapp>
          <PKnapp ikon="allman.anteckning" onClick={() => tryck('logga')} markor={mk('logga')}>Logga kontakt</PKnapp>
          <PKnapp ikon="upphandling.forlangning" onClick={() => tryck('forlang')}>Förläng frist</PKnapp>
          <PKnapp ikon="dok.konversation" onClick={() => tryck('svara')}>Svara kunden</PKnapp>
          <PKnapp ikon="allman.arkiv" onClick={() => tryck('skriv-av')}>Skriv av</PKnapp>
        </div>
      </NastaRuta>
      <KontaktloggFlik poster={poster} tryck={tryck} />
    </>
  )
}

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  const lista = (
    <>
      <Grupp ikon="arendelista.boka" farg="text-[#20c58f]" rubrik="Att boka in" antal={1} text="Signerade och inte inbokade, äldst först.">
        <KoRad r={BRF} vald={l.vald === 'brf'} mk={mk} tryck={tryck} />
      </Grupp>
      <Grupp ikon="falt.attgora" farg="text-sky-400" rubrik="Väntar på kontoret" antal={1}>
        <UnderRubrik>Kunden har skrivit <span className="font-mono font-medium text-slate-400">1</span></UnderRubrik>
        <KoRad r={FAMILJ} mk={mk} tryck={tryck} />
      </Grupp>
      <Grupp ikon="allman.hand" farg="text-amber-500" rubrik="Fastnat hos tekniker" antal={1} text="Förfallna, nära fristen, aldrig öppnade, obesvarade och utkast. Per tekniker.">
        <UnderRubrik>
          <span className="text-white">Erik Exempel</span>
          <span className="font-normal text-slate-400">1 dokument</span>
          <button type="button" onClick={() => tryck('paminn-alla')} className="ml-auto rounded-md border border-slate-600 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">Påminn Erik</button>
        </UnderRubrik>
        <KoRad r={abRad(l)} vald={l.vald === 'ab'} mk={mk} tryck={tryck} />
      </Grupp>
      <div className="grid gap-1.5">
        <Hopfalld ikon="falt.vantar" rubrik="Väntar på kunden" antal={3} onClick={() => tryck('vantar')} />
        <Hopfalld ikon="falt.klart" rubrik="Klara" antal={5} onClick={() => tryck('klara')} />
      </div>
    </>
  )
  return (
    <KontorSida
      raknare="1 att boka in, 1 väntar på kontoret, 1 fastnat hos tekniker, 0 bokade"
      lista={lista}
      detalj={<Detalj l={l} mk={mk} tryck={tryck} />}
      notis={l.notis ? <Notis text={l.notis} /> : undefined}
    />
  )
}

// ─── Visning ───

const BAS: Lage = { vald: 'brf', panel: null, paminnd: false, utfall: 'reached', ring: false, loggat: false, notis: null }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'rad-ab' },
  { lage: { ...BAS, vald: 'ab' }, markera: 'paminn' },
  { lage: { ...BAS, vald: 'ab', panel: 'paminn' }, markera: 'skicka-paminnelse' },
  { lage: { ...BAS, vald: 'ab', paminnd: true, notis: 'Erik har fått påminnelsen' }, markera: 'logga' },
  { lage: { ...BAS, vald: 'ab', paminnd: true, panel: 'samtal' }, markera: 'utfall-inget' },
  { lage: { ...BAS, vald: 'ab', paminnd: true, panel: 'samtal', utfall: 'no_answer' }, markera: 'ring-imorgon' },
  { lage: { ...BAS, vald: 'ab', paminnd: true, panel: 'samtal', utfall: 'no_answer', ring: true }, markera: 'spara-samtal' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Avtalet till Exempel AB har förfallit och ligger hos Erik under Fastnat hos tekniker. Öppna det.' }

const TIPS: Record<string, string> = {
  'rad-brf': 'Brf Exempelgården är signerad och ska bokas in. Det är en annan uppgift. Exempel AB ligger under Fastnat hos tekniker.',
  'rad-familj': 'Familjen Exempel har skrivit i Oneflow och väntar på svar från kontoret. Ditt uppdrag gäller Exempel AB.',
  'boka-in': 'Boka in är för signerade dokument. Exempel AB har inte signerat. Öppna Exempel AB under Fastnat hos tekniker.',
  'paminn-alla': 'Påminn Erik på teknikerns rad skickar en påminnelse för vart och ett av Eriks dokument efter en fråga. Använd knappen i Nästa steg-rutan, där ser du notisen först.',
  oneflow: 'Du behöver inte öppna Oneflow. Allt görs härifrån.',
  vantar: 'Väntar på kunden är dokument inom fristen. Exempel AB har förfallit och ligger under Fastnat hos tekniker.',
  klara: 'Klara är avböjda, avskrivna och bokade sedan länge. Exempel AB är inte klar.',
  forlang: 'Förläng frist går, men uppdraget är att låta Erik göra det. Påminn honom först.',
  svara: 'Svara kunden skriver i Oneflow. Uppdraget är att påminna Erik och logga ditt samtal.',
  'skriv-av': 'Skriv av är för döda affärer. Avtalet går fortfarande att rädda.',
  ring: 'Telefonen ringer på riktigt i portalen. Här har du redan ringt: logga samtalet med Logga kontakt.',
  innehall: 'Innehåll visar dokumentets rader. Du följer upp, du granskar inte.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    if (l.panel === 'samtal') {
      if (id === 'utfall-inget') { setL({ ...l, utfall: 'no_answer' }); tips('Inget svar', 'Välj när du ska ringa igen under Ring igen.'); return }
      if (id === 'utfall-nadde' || id === 'utfall-rost') { miss('Anna svarade inte. Välj Inget svar.'); return }
      if (id === 'ring-imorgon') { setL({ ...l, ring: true }); tips('Imorgon är vald', 'Tryck Spara samtalet.'); return }
      if (id.startsWith('ring-')) { miss('Uppdraget säger imorgon. Välj Imorgon.'); return }
      if (id.startsWith('kanal-')) { if (id !== 'kanal-telefon') miss('Du ringde. Kanalen ska vara Telefon.'); return }
      if (id === 'samtal-avbryt') { setL({ ...l, panel: null }); miss('Avbryt sparar ingenting. Tryck Logga kontakt igen.'); return }
      if (id === 'spara-samtal') {
        if (l.utfall !== 'no_answer') { miss('Välj Inget svar under Hur gick det först.'); return }
        if (!l.ring) { miss('Välj Imorgon under Ring igen, så kommer dokumentet tillbaka till dig.'); return }
        setL({ ...l, panel: null, loggat: true, notis: `Samtalet är loggat, du ringer igen ${IMORGON}` })
        setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Erik har fått en notis och samtalet står i kontaktloggen. I morgon ligger Exempel AB under Ring idag i Väntar på kontoret.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
        return
      }
      miss('Fyll i rutan Logga kontakt: Inget svar, Imorgon och Spara samtalet.')
      return
    }
    if (l.panel === 'paminn') {
      if (id === 'skicka-paminnelse') {
        setL({ ...l, panel: null, paminnd: true, notis: 'Erik har fått påminnelsen' })
        tips('Erik är påmind', 'Du ringde också Anna Exempel utan att få svar. Logga samtalet med Logga kontakt.')
        return
      }
      if (id === 'paminn-avbryt') { setL({ ...l, panel: null }); miss('Avbryt skickar ingenting. Tryck Påminn Erik igen.'); return }
      miss('Läs notisen och tryck Skicka påminnelsen.')
      return
    }
    if (id === 'rad-ab') {
      if (l.vald !== 'ab') { setL({ ...l, vald: 'ab' }); tips('Exempel AB är öppet', 'Läs Nästa steg och påminn Erik.') }
      return
    }
    if (id === 'paminn') {
      if (l.vald !== 'ab') { miss('Öppna Exempel AB först.'); return }
      if (l.paminnd) { miss('Erik är redan påmind. Logga ditt samtal med Logga kontakt.'); return }
      setL({ ...l, panel: 'paminn', notis: null }); tips('Påminnelsen visas', 'Så här ser Eriks notis ut. Tryck Skicka påminnelsen.')
      return
    }
    if (id === 'logga') {
      if (!l.paminnd) { miss('Påminn Erik först, som Nästa steg säger.'); return }
      setL({ ...l, panel: 'samtal', notis: null }); tips('Logga kontakt', 'Anna svarade inte. Välj Inget svar.')
      return
    }
    if (id === 'logga-brf') { miss(TIPS['rad-brf']); return }
    miss(TIPS[id] ?? 'Öppna Exempel AB, påminn Erik och logga samtalet.')
  }

  const framsteg = klar ? 7 : l.panel === 'samtal' ? (l.ring ? 6 : l.utfall === 'no_answer' ? 5 : 4) : l.paminnd ? 3 : l.panel === 'paminn' ? 2 : l.vald === 'ab' ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0); setKlar(false) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
