// src/pages/shared/intranet/guider/guide-delfakturering.tsx
// Guidemodul: Delfakturera ett ärende (tekniker, telefon).
// Etiketterna kommer från EditCaseModal (fliken Ekonomi, fotspåren, Vad vill du göra?),
// CaseServiceSelector (Tjänster & fakturarader, Inga tjänster tillagda än) och
// RevisitModal (Visa förslag →, Skapa delfaktura för nuvarande tjänster, Boka återbesök,
// Återbesök bokat och delfaktura ... skapad!). Övningen är fallet en faktura per månad.
// Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { ArendeHuvud, Flikar, IkonKnapp, Notis, OvningRam, Status, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { RevisitSteg1, RevisitSteg2, TjansterKort, ValArk, mk, type FRad, type Tid } from './_fakturering'

type Vy = 'arende' | 'val' | 'steg1' | 'steg2' | 'klart'

interface Lage {
  vy: Vy
  flik: number
  datum: boolean
  tid: string | null
  delfaktura: boolean
}

interface Besok {
  /** Dagens besök, som står i schemaläggningen */
  idag: string
  /** Datumet som väljs för återbesöket */
  nasta: string
  nastaKort: string
  rader: FRad[]
  total: string
}

const VISNING_BESOK: Besok = {
  idag: 'Tisdag 2026-10-13, 08:00 till 09:00',
  nasta: 'tisdag 2026-10-20',
  nastaKort: 'tisdag 20 oktober',
  rader: [['Råttbekämpning, första besöket', '1 800 kr'], ['Tätning av ventil', '950 kr']],
  total: '2 750 kr',
}

const TIDER: Tid[] = [
  { id: 't1', tid: '08:00 till 09:00', tekniker: 'Anna Exempel' },
  { id: 't2', tid: '13:30 till 14:30', tekniker: 'Anna Exempel' },
]

function Skarm({ l, b, tryck, markera, nr, notis }: { l: Lage; b: Besok; tryck: (id: string) => void; markera?: string; nr: number; notis?: string }) {
  const klar = l.vy === 'klart'
  const rader = klar && l.delfaktura ? [] : b.rader
  return (
    <Telefon>
      <ArendeHuvud
        nr="BE-0001234"
        status={klar ? <Status text="Återbesök" farg="bg-[#20c58f]" /> : <Status text="Bokad" />}
        kund="Brf Exempelgården · Exempelgatan 12, Huddinge"
        ikoner={<>
          <IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} markor={mk(markera, 'fotspar', nr)} />
          <IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />
        </>}
      />
      <Flikar
        flikar={['Ärende', 'Utförande', 'Ekonomi']}
        aktiv={l.flik}
        onClick={i => tryck(i === 2 ? 'flik-ekonomi' : 'flik')}
        markor={markera === 'flik-ekonomi' ? { flik: 2, pa: true, nr } : undefined}
      />
      {l.flik === 2 ? (
        <TjansterKort rader={rader} summa={b.total} />
      ) : (
        <div className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5 text-xs text-slate-400">
          <p className="font-semibold text-white">Schemaläggning</p>
          <p>{b.idag}</p>
        </div>
      )}

      {l.vy === 'val' && <ValArk tryck={tryck} markera={markera} nr={nr} />}
      {l.vy === 'steg1' && <RevisitSteg1 datum={l.datum} datumText={b.nasta} tryck={tryck} markera={markera} nr={nr} />}
      {l.vy === 'steg2' && (
        <RevisitSteg2 under={`Förslag · ${b.nastaKort}`} tider={TIDER} tid={l.tid} delfaktura={l.delfaktura} rader={b.rader} total={b.total} tryck={tryck} markera={markera} nr={nr} />
      )}
      {notis && <Notis text={notis} />}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const V = (vy: Vy, flik: number, datum: boolean, tid: string | null, delfaktura: boolean): Lage => ({ vy, flik, datum, tid, delfaktura })

const VISNING: { lage: Lage; markera?: string; notis?: string }[] = [
  { lage: V('arende', 0, false, null, false), markera: 'flik-ekonomi' },
  { lage: V('arende', 2, false, null, false), markera: 'fotspar' },
  { lage: V('val', 2, false, null, false), markera: 'val-aterbesok' },
  { lage: V('steg1', 2, true, null, false), markera: 'visa' },
  { lage: V('steg2', 2, true, null, false), markera: 'tid-t1' },
  { lage: V('steg2', 2, true, 't1', false), markera: 'delfaktura' },
  { lage: V('steg2', 2, true, 't1', true), markera: 'boka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} b={VISNING_BESOK} markera={v.markera} nr={steg + 1} notis={v.notis} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: en faktura per månad ───
// Två besök i oktober. Mitt i månaden bokas återbesöket utan kryss, på månadens
// sista besök med kryss. Delfakturan tar då alla ofakturerade rader, hela oktober.

const OKT_13: Besok = {
  idag: 'Tisdag 2026-10-13, 08:00 till 09:00',
  nasta: 'tisdag 2026-10-27',
  nastaKort: 'tisdag 27 oktober',
  rader: [['Råttbekämpning, 2026-10-06', '1 800 kr'], ['Uppföljningsbesök, 2026-10-13', '1 200 kr']],
  total: '3 000 kr',
}

const OKT_27: Besok = {
  idag: 'Tisdag 2026-10-27, 08:00 till 09:00',
  nasta: 'tisdag 2026-11-03',
  nastaKort: 'tisdag 3 november',
  rader: [...OKT_13.rader, ['Uppföljningsbesök, 2026-10-27', '1 200 kr']],
  total: '4 200 kr',
}

const START: Lage = V('arende', 2, false, null, false)
const BORJA: OvningSvar = { typ: 'tips', titel: 'Besöket 2026-10-13', text: 'Det är mitt i oktober. Boka nästa besök, tisdag 2026-10-27 klockan 08:00.' }

const TIPS: Record<string, string> = {
  historik: 'Klockan visar ärendehistoriken. Återbesöket bokar du med fotspåren.',
  flik: 'Du behöver inte byta flik. Fotspåren uppe till höger finns i alla flikar.',
  'flik-ekonomi': 'Du är redan i Ekonomi. Här ser du raderna som väntar. Tryck på fotspåren.',
  'val-nytt': 'Det är samma råttproblem, så det är ett återbesök.',
  'val-duplicera': 'Duplicera gör ett nytt ärende. Raderna ska ligga kvar i det här.',
  'val-avbryt': 'Avbryt stänger rutan. Välj Boka återbesök.',
  avbryt: 'Avbryt stänger rutan och du får börja om. Fortsätt i stället.',
  langd: 'En timme passar. Välj datum.',
  manuellt: 'Det går också, men förslaget 08:00 passar redan.',
  'tid-t2': 'Det är eftermiddag. Uppdraget var 08:00.',
  'byt-datum': 'Datumet är rätt. Välj tiden 08:00.',
}

function Ovning() {
  const [fas, setFas] = useState<1 | 2>(1)
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [notis, setNotis] = useState<string | undefined>()

  const b = fas === 1 ? OKT_13 : OKT_27
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte riktigt', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    setNotis(undefined)
    if (l.vy === 'arende') {
      if (id === 'fotspar') { setL({ ...l, vy: 'val' }); tips('Bra', 'Välj det som passar samma problem.') }
      else miss(TIPS[id] ?? 'Leta efter fotspåren uppe till höger.')
    } else if (l.vy === 'val') {
      if (id === 'val-aterbesok') { setL({ ...l, vy: 'steg1' }); tips('Rätt val', `Välj datum, ${b.nasta}.`) }
      else miss(TIPS[id] ?? 'Välj Boka återbesök.')
    } else if (l.vy === 'steg1') {
      if (id === 'datum') { setL({ ...l, datum: true }); tips('Datum valt', 'Tryck Visa förslag →.') }
      else if (id === 'visa') {
        if (!l.datum) miss('Knappen fungerar först när du har valt datum.')
        else { setL({ ...l, vy: 'steg2' }); tips('Här är förslagen', 'Välj 08:00. Tänk sedan på krysset: ska det faktureras nu?') }
      } else miss(TIPS[id] ?? 'Välj datum först.')
    } else {
      if (id === 'tid-t1') { setL({ ...l, tid: 't1' }); tips('Bra tid', fas === 1 ? 'Ska kunden få en faktura nu, mitt i månaden?' : 'Det här är oktobers sista besök. Vad gör du med krysset?') }
      else if (id === 'delfaktura') {
        const pa = !l.delfaktura
        setL({ ...l, delfaktura: pa })
        if (fas === 1 && pa) tips('Tänk efter', 'Kryssar du i nu blir det en faktura bara för början av oktober. Kunden vill ha en för hela månaden.')
        else if (fas === 2 && pa) tips('Krysset är i', `Du ser alla tre besöken i oktober, totalt ${b.total}. Tryck Boka återbesök.`)
        else tips('Krysset är borta', fas === 1 ? 'Raderna ligger kvar på ärendet. Tryck Boka återbesök.' : 'Uppdraget var en faktura för oktober.')
      } else if (id === 'boka') {
        if (!l.tid) miss('Välj en tid först.')
        else if (fas === 1 && l.delfaktura) miss('Det här är mitt i månaden. Ta bort krysset i Skapa delfaktura, så kommer raderna med på månadens sista besök.')
        else if (fas === 2 && !l.delfaktura) miss('Det här är oktobers sista besök. Kryssa i Skapa delfaktura, annars kommer november med på samma faktura.')
        else if (fas === 1) {
          setFas(2)
          setL(START)
          setNotis('Återbesök bokat!')
          tips('Besöket 2026-10-27', 'Återbesöket bokades utan delfaktura. Nu är det oktobers sista besök. Raderna från 6 och 13 oktober ligger kvar. Boka nästa besök, tisdag 2026-11-03 klockan 08:00.')
        } else {
          setL({ ...l, vy: 'klart' })
          setNotis('Återbesök bokat och delfaktura INV-202610-0042 skapad!')
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, en faktura för oktober' : 'Klart, en faktura för oktober',
            text: `Delfakturan tog alla ofakturerade rader på ärendet, alltså alla tre besöken i oktober, ${b.total} exkl. moms. Ärendet börjar november från noll. Det sista besöket behöver inget kryss: det som är kvar blir slutfakturan när ärendet avslutas.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Välj tid, tänk på krysset och boka.')
    }
  }

  const iFas = l.vy === 'arende' ? 0 : l.vy === 'val' ? 1 : l.vy === 'steg1' ? (l.datum ? 3 : 2) : l.vy === 'klart' ? 6 : l.tid ? 5 : 4
  const framsteg = (fas === 1 ? 0 : 6) + iFas
  return (
    <OvningRam framsteg={framsteg} totalt={12} svar={svar} onBorjaOm={() => { setFas(1); setL(START); setSvar(BORJA); setFel(0); setNotis(undefined) }}>
      <Skarm l={l} b={b} tryck={tryck} nr={0} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
