// src/pages/shared/intranet/guider/guide-aterbesok.tsx
// Guidemodul: Boka ett återbesök (tekniker, telefon). Facit för guidemallen.
// Etiketterna är desamma som i EditCaseModal (fotspåren, Vad vill du göra?) och
// RevisitModal (Datum för återbesök, Visa förslag →, Skapa delfaktura för nuvarande
// tjänster, Boka återbesök). Påhittad kund, ingenting sparas.

import { useState } from 'react'
import {
  Ark, ArendeHuvud, Falt, Flikar, IkonKnapp, Knapprad, Kort, Kryssruta, Notis, OvningRam, PKnapp, Rad, Status, Telefon, Val,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'

const RADER: [string, string][] = [['Råttbekämpning, första besöket', '1 800 kr'], ['Tätning av ventil', '950 kr']]
const TIDER = [
  { id: 't1', tid: '08:00 till 09:00' },
  { id: 't2', tid: '13:30 till 14:30' },
  { id: 't3', tid: '15:00 till 16:00' },
]

type Vy = 'arende' | 'val' | 'steg1' | 'steg2' | 'klart'

interface Lage {
  vy: Vy
  datum: boolean
  tid: string | null
  delfaktura: boolean
}

/** Markör bara på det element som är steg nr i visningen */
const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const klar = l.vy === 'klart'
  return (
    <Telefon>
      <ArendeHuvud
        nr="BE-0001234"
        status={klar ? <Status text="Återbesök" farg="bg-[#20c58f]" /> : <Status text="Bokad" />}
        kund="Familjen Exempel · Exempelvägen 4, Södertälje"
        ikoner={<>
          <IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} markor={mk(markera, 'fotspar', nr)} />
          <IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />
        </>}
      />
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
      <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Råttor i källaren, spår vid tvättstugan." /></Kort>
      <Kort titel="Schemaläggning" ikon="allman.kalender">
        <Rad v={klar ? 'Tisdag 2026-10-20, 08:00 till 09:00' : 'Tisdag 2026-10-13, 08:00 till 09:00'} />
      </Kort>
      {/* Tjänster & fakturarader ligger under fliken Ekonomi i portalen */}

      {l.vy === 'val' && (
        <Ark titel="Vad vill du göra?">
          <Val titel="Boka återbesök" text="Flytta ärendet till ett framtida datum för uppföljning av skadedjursstatus" onClick={() => tryck('val-aterbesok')} markor={mk(markera, 'val-aterbesok', nr)} />
          <Val titel="Skapa nytt ärende" text="Nytt problem hos samma kund (annat skadedjur)" onClick={() => tryck('val-nytt')} />
          <Val titel="Duplicera ärende" text="Skapa en kopia och välj vad som följer med" onClick={() => tryck('val-duplicera')} />
        </Ark>
      )}

      {l.vy === 'steg1' && (
        <Ark titel="Boka återbesök" under="Välj datum och längd">
          <Falt etikett="Datum för återbesök *" varde={l.datum ? 'tisdag 2026-10-20' : 'Välj datum'} tom={!l.datum} onClick={() => tryck('datum')} markor={mk(markera, 'datum', nr)} />
          <Falt etikett="Besökslängd" varde="1 timme" onClick={() => tryck('langd')} />
          <div className="grid gap-1">
            <span className="text-[11.5px] font-medium text-slate-400">Tekniker för återbesök</span>
            <Kryssruta pa text="Anna Exempel" onClick={() => tryck('tekniker')} />
          </div>
          <Knapprad>
            <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
            <PKnapp prim inaktiv={!l.datum} onClick={() => tryck('visa')} markor={mk(markera, 'visa', nr)}>Visa förslag →</PKnapp>
          </Knapprad>
        </Ark>
      )}

      {l.vy === 'steg2' && (
        <Ark titel="Boka återbesök" under="Förslag · tisdag 20 oktober">
          {TIDER.map((t, i) => (
            <Val key={t.id} titel={t.tid} text="Anna Exempel" vald={l.tid === t.id} onClick={() => tryck(`tid-${t.id}`)} markor={i === 0 ? mk(markera, 'tid-t1', nr) : undefined} />
          ))}
          <button type="button" onClick={() => tryck('manuellt')} className="w-max text-[11.5px] text-[#20c58f] underline">Ange tid manuellt</button>
          <div className="grid gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
            <Kryssruta pa={l.delfaktura} text="Skapa delfaktura för nuvarande tjänster" onClick={() => tryck('delfaktura')} markor={mk(markera, 'delfaktura', nr)} />
            {l.delfaktura && <>
              {RADER.map(r => <Rad key={r[0]} v={r[0]} h={r[1]} />)}
              <Rad v="Totalt (exkl. moms)" h={<span className="text-[#20c58f]">2 750 kr</span>} />
            </>}
          </div>
          <Knapprad>
            <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
            <PKnapp prim ikon="allman.kalender" inaktiv={!l.tid} onClick={() => tryck('boka')} markor={mk(markera, 'boka', nr)}>Boka återbesök</PKnapp>
          </Knapprad>
        </Ark>
      )}

      {klar && <Notis text={l.delfaktura ? 'Återbesök bokat och delfaktura INV-202610-0042 skapad!' : 'Återbesök bokat!'} />}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'arende', datum: false, tid: null, delfaktura: false }, markera: 'fotspar' },
  { lage: { vy: 'val', datum: false, tid: null, delfaktura: false }, markera: 'val-aterbesok' },
  { lage: { vy: 'steg1', datum: true, tid: null, delfaktura: false }, markera: 'visa' },
  { lage: { vy: 'steg2', datum: true, tid: null, delfaktura: false }, markera: 'tid-t1' },
  { lage: { vy: 'steg2', datum: true, tid: 't1', delfaktura: false }, markera: 'delfaktura' },
  { lage: { vy: 'steg2', datum: true, tid: 't1', delfaktura: true }, markera: 'boka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const START: Lage = { vy: 'arende', datum: false, tid: null, delfaktura: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendet. Leta upp knappen för återbesök och tryck på den.' }

const TIPS: Record<string, string> = {
  historik: 'Klockan är ärendehistoriken. Där ser du gamla besök, men du bokar inget där.',
  flik: 'Flikarna byter vy i ärendet. Återbesöket bokar du med fotspåren uppe till höger.',
  'val-nytt': 'Skapa nytt ärende är för ett nytt problem, till exempel getingar hos samma kund. Det här är samma råttproblem.',
  'val-duplicera': 'Duplicera gör en kopia. Då blir det två ärenden som inte hänger ihop.',
  avbryt: 'Avbryt stänger rutan och du får börja om. Fortsätt i stället.',
  langd: 'En timme passar. Välj datum först.',
  tekniker: 'Anna är redan vald. Välj datum först.',
  manuellt: 'Det går också, men det finns redan en bra tid på tisdag morgon.',
  'tid-t2': 'Det är eftermiddag. Uppdraget var tisdag morgon.',
  'tid-t3': 'Det är eftermiddag. Uppdraget var tisdag morgon.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'arende') {
      if (id === 'fotspar') { setL({ ...l, vy: 'val' }); tips('Bra', 'Det här är samma problem som förut. Vilket val passar?') }
      else miss(TIPS[id] ?? 'Leta efter fotspåren uppe till höger.')
    } else if (l.vy === 'val') {
      if (id === 'val-aterbesok') { setL({ ...l, vy: 'steg1' }); tips('Rätt val', 'Välj datum för återbesöket.') }
      else miss(TIPS[id] ?? 'Välj det som passar samma problem.')
    } else if (l.vy === 'steg1') {
      if (id === 'datum') { setL({ ...l, datum: true }); tips('Datum valt', 'Tisdag 2026-10-20. Nu kan portalen leta tider.') }
      else if (id === 'visa') {
        if (!l.datum) miss('Knappen fungerar först när du har valt datum.')
        else { setL({ ...l, vy: 'steg2' }); tips('Här är förslagen', 'Välj en tid som passar uppdraget.') }
      } else miss(TIPS[id] ?? 'Välj datum först.')
    } else {
      if (id === 'tid-t1') { setL({ ...l, tid: 't1' }); tips('Bra tid', l.delfaktura ? 'Tryck Boka återbesök.' : 'Kunden ska faktureras för det som är gjort. Vad behöver du kryssa i?') }
      else if (id === 'delfaktura') {
        const pa = !l.delfaktura
        setL({ ...l, delfaktura: pa })
        tips(pa ? 'Delfakturan är med' : 'Delfakturan är bortkryssad', pa ? (l.tid ? 'Du ser raderna och summan. Tryck Boka återbesök.' : 'Välj också en tid.') : 'Uppdraget var att fakturera det som är gjort.')
      } else if (id === 'boka') {
        if (!l.tid) miss('Välj en tid först.')
        else if (!l.delfaktura) miss('Uppdraget var att fakturera det som är gjort. Kryssa i Skapa delfaktura först.')
        else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Återbesöket är bokat på tisdag 08:00 och delfakturan på 2 750 kr exkl. moms är skapad. Raderna försvann från ärendet, så nästa besök börjar från noll.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Välj en tid, kryssa i delfakturan och boka.')
    }
  }

  const framsteg = l.vy === 'arende' ? 0 : l.vy === 'val' ? 1 : l.vy === 'steg1' ? (l.datum ? 3 : 2) : l.vy === 'klart' ? 6 : l.delfaktura && l.tid ? 5 : 4
  return (
    <OvningRam framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
