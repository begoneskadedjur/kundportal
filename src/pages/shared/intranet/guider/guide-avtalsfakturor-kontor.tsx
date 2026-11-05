// src/pages/shared/intranet/guider/guide-avtalsfakturor-kontor.tsx
// Guidemodul: Skicka avtalsfakturor i tid (admin och koordinator, dator).
// Version 2 (3.126.0): faktureringsschemat med alla statusgrupper och sidopanelen,
// fakturan med datumraden, Godkänn markerade, Skicka godkända till Fortnox som
// skapar utkast en i taget (FortnoxBatchDialog) och varningen vid för tidig
// sändning (EarlySendDialog) i övningen. Arkivet har en egen guide,
// guide-fakturaarkiv-kontor. Skärmdelarna och etiketternas källor står i
// _fakturakoer.tsx. Fakturamodalen: InvoiceDetailModal (Skulle skickas, Perioden
// börjar, Förfaller om skickad idag, Godkänn, Skapa utkast i Fortnox, Makulera).
// Påhittade kunder, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, PKnapp, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'
import {
  AvtalSidopanel, Avtalsschema, BatchDialog, FaktureringSida, GRUPP_TEXT, MedSidopanel, NyckeltalRad,
  TidigVarning, Valrad, type AGrupp, type ARad, type BRad, type Tryck,
} from './_fakturakoer'

// ─── Exempelfakturorna (idag 2026-11-05, betalningsvillkor 30 dagar) ───

type Grupp = 'started' | 'late' | 'this_week' | 'upcoming' | 'waiting'

const RADER: (Omit<ARad, 'godkand'> & { grupp: Grupp; faktura: string; tal: number })[] = [
  { id: 'fast', grupp: 'started', skicka: '2026-09-22', status: 'Perioden började 1 nov', ton: 'red', kund: 'Exempel Fastigheter AB', under: '2210 · INV-202609-0310 · Kvartalsvis', faktura: 'INV-202609-0310', period: '2026-11-01', periodTill: '2027-01-31', forfaller: '2026-12-05', rod: true, belopp: '12 600', tal: 12600 },
  { id: 'brf', grupp: 'late', skicka: '2026-10-28', status: 'Försenad 8 dagar', ton: 'orange', kund: 'Brf Exempelgården', under: '1234 · INV-202610-0101 · Årsvis', faktura: 'INV-202610-0101', period: '2026-12-07', periodTill: '2027-12-06', forfaller: '2026-12-05', belopp: '24 400', tal: 24400 },
  { id: 'ab', grupp: 'late', skicka: '2026-11-03', status: 'Försenad 2 dagar', ton: 'orange', kund: 'Exempel AB', under: '5678 · INV-202610-0102 · Halvårsvis', faktura: 'INV-202610-0102', period: '2026-12-13', periodTill: '2027-06-12', forfaller: '2026-12-05', belopp: '7 000', tal: 7000 },
  { id: 'lager', grupp: 'this_week', skicka: '2026-11-09', status: 'Om 4 dagar', ton: 'green', kund: 'Exempel Lager AB', under: '3456 · INV-202611-0005 · Kvartalsvis', faktura: 'INV-202611-0005', period: '2026-12-19', periodTill: '2027-03-18', forfaller: '2026-12-05', belopp: '6 300', tal: 6300 },
  { id: 'parken', grupp: 'upcoming', skicka: '2026-12-23', status: 'Om 48 dagar', ton: 'green', kund: 'Brf Exempelparken', under: '4321 · INV-202611-0012 · Årsvis', faktura: 'INV-202611-0012', period: '2027-02-01', periodTill: '2028-01-31', forfaller: '2026-12-05', belopp: '15 200', tal: 15200 },
  { id: 'norr', grupp: 'waiting', skicka: '2026-11-20', status: 'Om 15 dagar', ton: 'grey', kund: 'Exempel Norr AB', under: '7890 · INV-202611-0008 · Årsvis', not: 'Premien är inte bekräftad', faktura: 'INV-202611-0008', period: '2026-12-30', periodTill: '2027-12-29', forfaller: '2026-12-05', belopp: '9 800', tal: 9800 },
]

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`
const ORDNING: Grupp[] = ['started', 'late', 'this_week', 'upcoming', 'waiting']
const FORTNOX_NR: Record<string, string> = { fast: '1240', brf: '1241', ab: '1242', lager: '1243', parken: '1244' }

interface Lage {
  flik: number
  valda: Set<string>
  /** Status Redo för Fortnox (Godkänd) */
  godkanda: Set<string>
  /** Utkast skapade, borta ur schemat */
  skickade: Set<string>
  oppen: string | null
  varning: boolean
  batch: 'confirm' | 'done' | null
  batchRader: string[]
}

const TOM: Lage = { flik: 0, valda: new Set(), godkanda: new Set(['fast']), skickade: new Set(), oppen: null, varning: false, batch: null, batchRader: [] }

type Bas = { l: Lage; tryck: Tryck; markera?: string; nr: number }

const synliga = (l: Lage) => RADER.filter(r => !l.skickade.has(r.id))

function grupper(l: Lage): AGrupp[] {
  return ORDNING.map(g => {
    const rader = synliga(l).filter(r => r.grupp === g)
    const t = GRUPP_TEXT[g]
    return {
      key: g, ...t,
      total: `${rader.length} ${rader.length === 1 ? 'faktura' : 'fakturor'} · ${kr(rader.reduce((s, r) => s + r.tal, 0))}`,
      rader: rader.map(r => ({ ...r, godkand: l.godkanda.has(r.id) })),
    }
  }).filter(g => g.rader.length > 0)
}

/** Det knappen Skicka godkända tar: markerade godkända, eller alla godkända utan markering */
function attSkicka(l: Lage): string[] {
  const bas = l.valda.size > 0 ? [...l.valda] : synliga(l).map(r => r.id)
  return bas.filter(id => l.godkanda.has(id) && !l.skickade.has(id))
}

function Schema({ l, tryck, markera, nr }: Bas) {
  const rader = synliga(l)
  const summa = (g: Grupp[]) => rader.filter(r => g.includes(r.grupp))
  const valda = rader.filter(r => l.valda.has(r.id))
  const skickat: [string, string, string][] = [
    ...RADER.filter(r => l.skickade.has(r.id)).map(r => [r.kund, `Fortnox ${FORTNOX_NR[r.id]} · 5 nov`, kr(r.tal)] as [string, string, string]),
    ['Exempel Bygg AB', 'Fortnox 1236 · 4 nov', '8 400 kr'],
    ['Exempelhuset AB', 'Fortnox 1235 · 2 nov', '5 200 kr'],
  ]
  const skickatTal = RADER.filter(r => l.skickade.has(r.id)).reduce((s, r) => s + r.tal, 0)
  return (
    <div className="grid gap-2">
      <NyckeltalRad tal={[
        { rubrik: 'Perioden har börjat', ton: 'red', antal: summa(['started']).length, summa: kr(summa(['started']).reduce((s, r) => s + r.tal, 0)), hint: 'Skicka först' },
        { rubrik: 'Försenade', ton: 'orange', antal: summa(['late']).length, summa: kr(summa(['late']).reduce((s, r) => s + r.tal, 0)), hint: 'Skulle ha skickats, perioden har inte börjat' },
        { rubrik: 'Kommande 30 dagar', ton: 'green', antal: 1, summa: '6 300 kr', hint: 'Skickas på sitt datum' },
        { rubrik: 'Väntar på beslut', ton: 'grey', antal: 1, summa: '9 800 kr', hint: 'Premien bekräftas i avtalskartan' },
        { rubrik: 'Skickat i november', ton: 'blue', antal: 3 + l.skickade.size, summa: kr(42100 + skickatTal), hint: 'Skapade i Fortnox, exkl. moms' },
      ]} />
      <MedSidopanel panel={<AvtalSidopanel skickat={skickat} tryck={tryck} />}>
        <Valrad
          antal={valda.length}
          summa={`${kr(valda.reduce((s, r) => s + r.tal, 0))} exkl. moms`}
          godkannAntal={valda.filter(r => !l.godkanda.has(r.id) && r.grupp !== 'waiting').length}
          skickaAntal={attSkicka(l).length}
          tryck={tryck} markera={markera} nr={nr}
        />
        <p className="text-[9.5px] text-slate-500">Bocka i fakturor för att godkänna flera samtidigt. Klicka på en faktura för att öppna den, där makuleras den också.</p>
        <Avtalsschema grupper={grupper(l)} valda={l.valda} tryck={tryck} markera={markera} nr={nr} />
      </MedSidopanel>
    </div>
  )
}

function FakturaModal({ l, tryck, markera, nr }: Bas) {
  const r = RADER.find(x => x.id === l.oppen) ?? RADER[1]
  const godkand = l.godkanda.has(r.id)
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-3 py-2">
          <span className="flex items-baseline gap-2"><span className="font-mono text-sm font-semibold text-white">{r.faktura}</span>
            <Status text={godkand ? 'Redo för Fortnox' : 'Kräver godkännande'} farg={godkand ? 'bg-sky-400' : 'bg-amber-400'} /></span>
          <Markor markor={mk(markera, 'stang', nr)}>
            <button type="button" aria-label="Stäng" onClick={() => tryck('stang')} className="rounded p-1 text-slate-400 hover:text-white"><Icon name="allman.stang" size={16} /></button>
          </Markor>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-slate-700/50 px-3 py-1.5 text-[10.5px] text-slate-400">
          <span>Skulle skickas <span className="font-mono text-white">{r.skicka}</span></span>
          <span>Perioden börjar <span className="font-mono text-white">{r.period}</span></span>
          <span>Förfaller om skickad idag <span className={`font-mono ${r.rod ? 'text-red-400' : 'text-white'}`}>{r.forfaller}</span>{r.rod && <> · Betalas efter periodstart</>}</span>
        </div>
        <div className="grid gap-1 px-3 py-2 text-[11.5px] text-slate-300">
          <p className="text-[12px] font-semibold text-white">{r.kund}</p>
          <p className="flex justify-between"><span>Premie, {r.period} t.o.m. {r.periodTill}</span><span>{kr(r.tal)}</span></p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 border-t border-slate-700 bg-slate-800/50 px-3 py-2">
          {!godkand && <PKnapp ikon="allman.bock" onClick={() => tryck('godkann')}>Godkänn</PKnapp>}
          <PKnapp prim ikon={godkand ? 'allman.anteckning' : 'allman.las'} inaktiv={!godkand} onClick={() => tryck('utkast')}>Skapa utkast i Fortnox</PKnapp>
          <PKnapp fara onClick={() => tryck('makulera')}>Makulera</PKnapp>
        </div>
      </div>
    </div>
  )
}

function batchRader(l: Lage): BRad[] {
  return l.batchRader.map(id => {
    const r = RADER.find(x => x.id === id)!
    return { id, kund: r.kund, faktura: r.faktura, belopp: kr(r.tal), utfall: { ton: 'green' as const, text: `Fortnox nr ${FORTNOX_NR[id]}` } }
  })
}

function Skarm({ l, tryck, markera, nr, notis }: Bas & { notis?: string }) {
  const rader = batchRader(l)
  const overlay = l.oppen ? <FakturaModal l={l} tryck={tryck} markera={markera} nr={nr} />
    : l.varning ? (
      <TidigVarning titel="Perioden börjar 2027-02-01" kund="Brf Exempelparken" faktura="INV-202611-0012" skaSkickas="2026-12-23"
        idagText="2026-11-05, 88 dagar före periodstart" tryck={tryck} markera={markera} nr={nr} />
    ) : l.batch ? (
      <BatchDialog fas={l.batch} rader={rader} moms="exkl. moms"
        total={kr(l.batchRader.reduce((s, id) => s + (RADER.find(x => x.id === id)?.tal ?? 0), 0))}
        tryck={tryck} markera={markera} nr={nr} />
    ) : undefined
  return (
    <FaktureringSida flik={l.flik} tryck={tryck} markera={markera} nr={nr} overlay={overlay} notis={notis}>
      {l.flik !== 1
        ? <p className="py-6 text-center text-[11.5px] text-slate-400">Tryck på fliken Avtalskunder.</p>
        : <Schema l={l} tryck={tryck} markera={markera} nr={nr} />}
    </FaktureringSida>
  )
}

// ─── Visning ───

const AVTAL: Lage = { ...TOM, flik: 1 }
const MARKERAD: Lage = { ...AVTAL, valda: new Set(['brf', 'ab']) }
const GODKAND: Lage = { ...AVTAL, godkanda: new Set(['fast', 'brf', 'ab']) }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: TOM, markera: 'flik-avtal' },
  { lage: AVTAL, markera: 'rad-brf' },
  { lage: { ...AVTAL, oppen: 'brf' }, markera: 'stang' },
  { lage: AVTAL, markera: 'grupp-late' },
  { lage: MARKERAD, markera: 'godkann-markerade' },
  { lage: GODKAND, markera: 'skicka-godkanda' },
  { lage: { ...GODKAND, batch: 'confirm', batchRader: ['fast', 'brf', 'ab'] }, markera: 'skapa-utkast' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const UPPDRAG = 'Godkänn de två försenade fakturorna och skapa utkasten i Fortnox, tillsammans med Exempel Fastigheter AB som redan är godkänd. Brf Exempelparken är också godkänd men ska vänta till sitt datum.'
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: UPPDRAG }
const START: Lage = { ...TOM, godkanda: new Set(['fast', 'parken']) }

const TIPS: Record<string, string> = {
  'flik-privat': 'Privat & Företag är engångsärenden. Avtalsfakturorna ligger under Avtalskunder.',
  'flik-merforsaljning': 'Merförsäljning Avtal är extraarbeten hos avtalskunder. Avtalsfakturorna ligger under Avtalskunder.',
  arkiv: 'Arkivet visar skickade fakturor. De här är inte skickade än.',
  'grupp-waiting': 'Väntar på beslut går inte att godkänna förrän premien är bekräftad i avtalskartan.',
  'ruta-norr': 'Exempel Norr AB väntar på beslut. Premien bekräftas i avtalskartan först.',
  'grupp-this_week': 'Skicka denna vecka skickas på sitt datum, 2026-11-09. Uppdraget gäller de försenade.',
  'ruta-lager': 'Exempel Lager AB skickas på sitt datum, 2026-11-09. Uppdraget gäller de försenade.',
  'visa-alla': 'Visa alla öppnar arkivet. Uppdraget gäller fakturor som inte är skickade än.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [notis, setNotis] = useState<string | undefined>()
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const vaxla = (ids: string[]) => {
    const alla = ids.every(id => l.valda.has(id))
    const valda = new Set(l.valda)
    ids.forEach(id => (alla ? valda.delete(id) : valda.add(id)))
    setL({ ...l, valda })
    tips(alla ? 'Avmarkerat' : 'Markerat', alla ? 'Rutan är tom igen.' : 'Knappraden visar hur många som är markerade och summan.')
  }

  const tryck = (id: string) => {
    if (klar && id !== 'stang-batch') return
    setNotis(undefined)

    if (l.oppen) {
      if (id === 'stang') { setL({ ...l, oppen: null }); tips('Fakturan stängd', 'Du är tillbaka i schemat.') }
      else if (id === 'makulera') miss('Makulera stryker fakturan. Den ska skickas, inte makuleras.')
      else miss('Godkänn flera på en gång i schemat i stället. Stäng fakturan med krysset.')
      return
    }
    if (l.varning) {
      if (id === 'vanta') {
        setL({ ...l, varning: false })
        tips('Ingenting skickades', 'Utan markering tar knappen alla godkända, också Brf Exempelparken. Bocka i grupperna Perioden har börjat och Försenade, så tar knappen bara dem.')
      } else miss('Då skapas utkastet för Brf Exempelparken nästan tre månader före perioden. Tryck Vänta till 2026-12-23.')
      return
    }
    if (l.batch === 'confirm') {
      if (id === 'skapa-utkast') {
        setL({ ...l, batch: 'done', skickade: new Set([...l.skickade, ...l.batchRader]), valda: new Set() })
        setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `${l.batchRader.length} utkast är skapade i Fortnox, ett i taget, och Brf Exempelparken ligger kvar till sitt datum. Bokför och skicka utkasten i Fortnox.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else { setL({ ...l, batch: null, batchRader: [] }); tips('Avbrutet', 'Ingenting skickades.') }
      return
    }
    if (l.batch === 'done') { if (id === 'stang-batch') setL({ ...l, batch: null }); return }

    if (id === 'flik-avtal') { setL({ ...l, flik: 1 }); tips('Faktureringsschemat', 'Hitta gruppen Försenade.'); return }
    if (l.flik !== 1) { miss(TIPS[id] ?? 'Tryck på fliken Avtalskunder.'); return }

    if (id === 'grupp-late') vaxla(['brf', 'ab'])
    else if (id === 'grupp-started') vaxla(['fast'])
    else if (id === 'grupp-upcoming' || id === 'ruta-parken') miss('Brf Exempelparken ska skickas 2026-12-23. Den ska vänta.')
    else if (id === 'ruta-brf' || id === 'ruta-ab' || id === 'ruta-fast') vaxla([id.slice(5)])
    else if (id === 'avmarkera') { setL({ ...l, valda: new Set() }); tips('Avmarkerat', 'Inga fakturor är markerade.') }
    else if (id.startsWith('rad-')) {
      setL({ ...l, oppen: id.slice(4) })
      tips('Fakturan är öppen', 'Datumraden visar när den skulle skickas, när perioden börjar och när den förfaller om du skickar idag. Stäng den med krysset.')
    } else if (id === 'godkann-markerade') {
      const lista = [...l.valda].filter(x => !l.godkanda.has(x))
      if (lista.length === 0) miss('Inga markerade fakturor väntar på godkännande. Bocka i gruppraden Försenade först.')
      else {
        setL({ ...l, godkanda: new Set([...l.godkanda, ...lista]), valda: new Set() })
        setNotis(`${lista.length} ${lista.length === 1 ? 'faktura godkänd' : 'fakturor godkända'}`)
        tips('Godkända', 'Markeringen släpps när listan laddas om. Skicka nu det som ska iväg.')
      }
    } else if (id === 'skicka-godkanda') {
      const lista = attSkicka(l)
      if (lista.length === 0) miss('Ingen markerad faktura är godkänd. Godkänn de försenade först.')
      else if (!l.godkanda.has('brf') || !l.godkanda.has('ab')) miss('De försenade är inte godkända än. Bocka i gruppraden Försenade och tryck Godkänn markerade.')
      else if (lista.includes('parken')) { setL({ ...l, varning: true }); tips('Portalen frågar först', 'Brf Exempelparken skickas för tidigt. Läs rutan och välj.') }
      else if (!lista.includes('brf') || !lista.includes('ab')) miss('Båda försenade fakturorna ska med. Bocka i gruppraden Försenade.')
      else { setL({ ...l, batch: 'confirm', batchRader: lista }); tips('Bekräfta', 'Rutan visar fakturorna och totalen. Skapa utkasten.') }
    } else miss(TIPS[id] ?? 'Godkänn de försenade och skicka dem till Fortnox, utan Brf Exempelparken.')
  }

  const framsteg = klar ? 4 : l.batch ? 3 : l.godkanda.has('brf') && l.godkanda.has('ab') ? 2 : l.flik === 1 ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0); setNotis(undefined); setKlar(false) }}>
      <Skarm l={l} tryck={tryck} nr={0} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul

