// src/pages/shared/intranet/guider/guide-merforsaljning-avtal-kontor.tsx
// Guidemodul: Fakturera extraarbeten hos avtalskunder (admin och koordinator, dator), 3.126.0.
// Fliken Merförsäljning Avtal i läget Att hantera (queue/AdhocQueue.tsx, 3.123.0):
// gruppen Utfört arbete utan faktura med Skapa faktura (ersatte den gula rutan
// Ofakturerad merförsäljning), Kräver godkännande, Godkända, redo för Fortnox,
// Godkänn markerade och Skicka godkända till Fortnox som skapar utkast en i taget
// (FortnoxBatchDialog, 3.125.0). Notisen Faktura skapad för <kund> kommer från
// handleGenerate. Fakturamodalen: InvoiceDetailModal (Märkning faktura, Godkänn,
// Skapa utkast i Fortnox, Makulera). Skärmdelarna i _fakturakoer.tsx.
// Påhittade kunder, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, PKnapp, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'
import {
  BatchDialog, FaktureringSida, MedSidopanel, MerforsaljningLista, MerforsaljningSidopanel, NyckeltalRad,
  Valrad, type MRad, type Tryck,
} from './_fakturakoer'

// ─── Exemplen (idag 2026-11-05) ───

interface Faktura { rad: MRad; tal: number; nr: string; godkand: boolean }

const BYGG_UTAN: MRad = { id: 'bygg', utfort: '2026-10-27', status: 'Utfört för 9 dagar sedan', ton: 'red', kund: 'Exempel Bygg AB', arende: 'BE-0003456 · Getingbekämpning · 2 rader', markning: 'Anna Exempel', order: 'AO 4471', tekniker: 'Erik Exempel', belopp: '2 031' }

const START: Record<string, Faktura> = {
  brf: { nr: 'INV-202611-0029', tal: 3125, godkand: false, rad: { id: 'brf', utfort: '2026-11-02', status: 'Utfört för 3 dagar sedan', ton: 'grey', kund: 'Brf Exempelgården', arende: 'BE-0003401 · Råttbekämpning', markning: 'Styrelsen', tekniker: 'Anna Exempel', belopp: '3 125' } },
  lager: { nr: 'INV-202610-0207', tal: 4375, godkand: true, rad: { id: 'lager', utfort: '2026-10-30', status: 'Godkänd av Anna Exempel', ton: 'green', kund: 'Exempel Lager AB', arende: 'BE-0003420 · Tätning', markning: 'Lager 2', order: 'Objekt 12', tekniker: 'Erik Exempel', belopp: '4 375' } },
}
const BYGG: Faktura = { nr: 'INV-202611-0031', tal: 2031, godkand: false, rad: { ...BYGG_UTAN, arende: 'BE-0003456 · Getingbekämpning', status: 'Utfört för 9 dagar sedan', ton: 'orange' } }
const FORTNOX_NR: Record<string, string> = { lager: '1250', bygg: '1251', brf: '1252' }

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

interface Lage {
  flik: number
  skapad: boolean
  godkanda: Set<string>
  valda: Set<string>
  oppen: string | null
  batch: 'confirm' | 'done' | null
  batchRader: string[]
}

const TOM: Lage = { flik: 0, skapad: false, godkanda: new Set(['lager']), valda: new Set(), oppen: null, batch: null, batchRader: [] }

type Bas = { l: Lage; tryck: Tryck; markera?: string; nr: number }

function fakturor(l: Lage): Faktura[] {
  return [...(l.skapad ? [BYGG] : []), START.brf, START.lager]
}
const hitta = (id: string) => (id === 'bygg' ? BYGG : START[id])

function radFor(f: Faktura, l: Lage): MRad {
  return l.godkanda.has(f.rad.id) ? { ...f.rad, status: 'Godkänd av Anna Exempel', ton: 'green' } : f.rad
}

function attSkicka(l: Lage): string[] {
  const alla = fakturor(l).map(f => f.rad.id)
  return (l.valda.size > 0 ? [...l.valda] : alla).filter(id => l.godkanda.has(id))
}

function Lista({ l, tryck, markera, nr }: Bas) {
  const alla = fakturor(l)
  const vantar = alla.filter(f => !l.godkanda.has(f.rad.id))
  const godk = alla.filter(f => l.godkanda.has(f.rad.id))
  const valda = alla.filter(f => l.valda.has(f.rad.id))
  const sum = (lista: Faktura[]) => kr(lista.reduce((s, f) => s + f.tal, 0))
  return (
    <div className="grid gap-2">
      <NyckeltalRad tal={[
        { rubrik: 'Utfört, saknar faktura', ton: 'red', antal: l.skapad ? 0 : 1, summa: l.skapad ? '0 kr' : '2 031 kr', hint: 'Ärendet är stängt men ingen faktura finns' },
        { rubrik: 'Kräver godkännande', ton: 'orange', antal: vantar.length, summa: sum(vantar), hint: vantar.length ? `Äldsta utfört för ${l.skapad ? 9 : 3} dagar sedan` : 'Inget väntar' },
        { rubrik: 'Godkända, att skicka', ton: 'green', antal: godk.length, summa: sum(godk), hint: 'Redo för Fortnox' },
        { rubrik: 'Skickat i november', ton: 'blue', antal: 2, summa: '6 250 kr', hint: 'Se arkivet' },
      ]} />
      <MedSidopanel panel={<MerforsaljningSidopanel skickatText="2 fakturor skickade sedan 1 nov, 6 250 kr inkl. moms." tryck={tryck} />}>
        <Valrad antal={valda.length} summa={`${sum(valda)} inkl. moms`}
          godkannAntal={valda.filter(f => !l.godkanda.has(f.rad.id)).length}
          skickaAntal={attSkicka(l).length} tryck={tryck} markera={markera} nr={nr} />
        <p className="text-[9.5px] text-slate-500">En faktura per ärende. Märkning, arbetsorder, objekt och adress hämtas från ärendet. Klicka på en faktura för att öppna den, där makuleras den också.</p>
        <MerforsaljningLista
          utan={l.skapad ? [] : [BYGG_UTAN]}
          vantar={vantar.map(f => radFor(f, l))}
          godkanda={godk.map(f => radFor(f, l))}
          valda={l.valda} tryck={tryck} markera={markera} nr={nr}
        />
      </MedSidopanel>
    </div>
  )
}

function FakturaModal({ l, tryck, markera, nr }: Bas) {
  const f = hitta(l.oppen ?? 'bygg')
  const godkand = l.godkanda.has(f.rad.id)
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-3 py-2">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-sm font-semibold text-white">{f.nr}</span>
            <span className="font-mono text-[11px] text-slate-400">{f.rad.arende.split(' · ')[0]}</span>
            <Status text={godkand ? 'Redo för Fortnox' : 'Kräver godkännande'} farg={godkand ? 'bg-sky-400' : 'bg-amber-400'} />
          </span>
          <Markor markor={mk(markera, 'stang', nr)}>
            <button type="button" aria-label="Stäng" onClick={() => tryck('stang')} className="rounded p-1 text-slate-400 hover:text-white"><Icon name="allman.stang" size={16} /></button>
          </Markor>
        </div>
        <div className="grid gap-2 px-3 py-2 sm:grid-cols-2">
          <div className="grid content-start gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-[11px] text-slate-300">
            <p className="text-[12px] font-semibold text-white">{f.rad.kund}</p>
            <p className="flex justify-between"><span>Getingbekämpning</span><span>1 250 kr</span></p>
            <p className="flex justify-between"><span>Arbetstid, 1 tim</span><span>375 kr</span></p>
            <p className="flex justify-between border-t border-slate-700 pt-1 font-semibold text-white"><span>Totalt inkl. moms</span><span>{kr(f.tal)}</span></p>
          </div>
          <div className="grid content-start gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-[11px] text-slate-300">
            <p className="text-[10.5px] font-medium text-slate-400">Märkning faktura</p>
            <p className="text-white">{f.rad.markning}</p>
            {f.rad.order && <p className="text-slate-400">{f.rad.order}</p>}
            <p className="mt-1 text-[10.5px] font-medium text-slate-400">Utfört arbete</p>
            <p>{f.rad.utfort}, {f.rad.tekniker}</p>
          </div>
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

function Skarm({ l, tryck, markera, nr, notis }: Bas & { notis?: string }) {
  const overlay = l.oppen ? <FakturaModal l={l} tryck={tryck} markera={markera} nr={nr} />
    : l.batch ? (
      <BatchDialog fas={l.batch} moms="inkl. moms"
        total={kr(l.batchRader.reduce((s, id) => s + hitta(id).tal, 0))}
        rader={l.batchRader.map(id => ({ id, kund: hitta(id).rad.kund, faktura: hitta(id).nr, belopp: kr(hitta(id).tal), utfall: { ton: 'green' as const, text: `Fortnox nr ${FORTNOX_NR[id]}` } }))}
        tryck={tryck} markera={markera} nr={nr} />
    ) : undefined
  return (
    <FaktureringSida flik={l.flik} tryck={tryck} markera={markera} nr={nr} overlay={overlay} notis={notis}>
      {l.flik !== 2
        ? <p className="py-6 text-center text-[11.5px] text-slate-400">Tryck på fliken Merförsäljning Avtal.</p>
        : <Lista l={l} tryck={tryck} markera={markera} nr={nr} />}
    </FaktureringSida>
  )
}

// ─── Visning ───

const LISTA: Lage = { ...TOM, flik: 2 }
const SKAPAD: Lage = { ...LISTA, skapad: true }
const GODKANDA: Lage = { ...SKAPAD, godkanda: new Set(['lager', 'bygg', 'brf']) }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: TOM, markera: 'flik-merforsaljning' },
  { lage: LISTA, markera: 'skapa-bygg' },
  { lage: SKAPAD, markera: 'rad-bygg' },
  { lage: { ...SKAPAD, oppen: 'bygg' }, markera: 'stang' },
  { lage: { ...SKAPAD, valda: new Set(['bygg', 'brf']) }, markera: 'godkann-markerade' },
  { lage: GODKANDA, markera: 'skicka-godkanda' },
  { lage: { ...GODKANDA, batch: 'confirm', batchRader: ['bygg', 'brf', 'lager'] }, markera: 'skapa-utkast' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Jobbet hos Exempel Bygg AB är utfört men saknar faktura. Skapa fakturan, godkänn den tillsammans med Brf Exempelgården och skapa utkasten i Fortnox.' }

const TIPS: Record<string, string> = {
  'flik-privat': 'Privat & Företag är engångsärenden. Extraarbeten hos avtalskunder ligger under Merförsäljning Avtal.',
  'flik-avtal': 'Avtalskunder är premierna. Extraarbeten hos avtalskunder ligger under Merförsäljning Avtal.',
  arkiv: 'Arkivet visar skickade fakturor. Exempel Bygg AB har ingen faktura än.',
  'visa-arkivet': 'Arkivet visar skickade fakturor. Exempel Bygg AB har ingen faktura än.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(TOM)
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
    tips(alla ? 'Avmarkerat' : 'Markerat', alla ? 'Rutan är tom igen.' : 'Knappraden visar hur många som är markerade och summan inkl. moms.')
  }

  const tryck = (id: string) => {
    if (klar && id !== 'stang-batch') return
    setNotis(undefined)

    if (l.oppen) {
      if (id === 'stang') { setL({ ...l, oppen: null }); tips('Fakturan stängd', 'Du är tillbaka i listan.') }
      else if (id === 'godkann') {
        setL({ ...l, oppen: null, godkanda: new Set([...l.godkanda, l.oppen]) }); setNotis('Faktura godkänd')
        tips('Godkänd', 'Det går också. Godkänn resten med kryssrutorna och skicka.')
      } else if (id === 'makulera') miss('Makulera stryker fakturan. Den ska skickas, inte makuleras.')
      else miss('Fakturan väntar på godkännande. Godkänn den, eller stäng den och godkänn flera på en gång i listan.')
      return
    }
    if (l.batch === 'confirm') {
      if (id === 'skapa-utkast') {
        setL({ ...l, batch: 'done' }); setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `${l.batchRader.length} utkast är skapade i Fortnox, ett i taget. Bokför och skicka dem i Fortnox.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else { setL({ ...l, batch: null, batchRader: [] }); tips('Avbrutet', 'Ingenting skickades.') }
      return
    }
    if (l.batch === 'done') { if (id === 'stang-batch') setL({ ...l, batch: null }); return }

    if (id === 'flik-merforsaljning') { setL({ ...l, flik: 2 }); tips('Arbetslistan', 'Hitta Exempel Bygg AB under Utfört arbete utan faktura.'); return }
    if (l.flik !== 2) { miss(TIPS[id] ?? 'Tryck på fliken Merförsäljning Avtal.'); return }

    if (id === 'skapa-bygg') {
      setL({ ...l, skapad: true }); setNotis('Faktura skapad för Exempel Bygg AB')
      tips('Fakturan är skapad', 'Den ligger under Kräver godkännande. Godkänn den tillsammans med Brf Exempelgården.')
    } else if (id === 'grupp-vantar') vaxla(fakturor(l).filter(f => !l.godkanda.has(f.rad.id)).map(f => f.rad.id))
    else if (id === 'grupp-godkanda') vaxla(fakturor(l).filter(f => l.godkanda.has(f.rad.id)).map(f => f.rad.id))
    else if (id.startsWith('ruta-')) vaxla([id.slice(5)])
    else if (id === 'avmarkera') { setL({ ...l, valda: new Set() }); tips('Avmarkerat', 'Inga fakturor är markerade.') }
    else if (id.startsWith('rad-')) { setL({ ...l, oppen: id.slice(4) }); tips('Fakturan är öppen', 'Granska raderna och märkningen. Stäng den med krysset.') }
    else if (id === 'godkann-markerade') {
      const lista = [...l.valda].filter(x => !l.godkanda.has(x))
      if (lista.length === 0) miss(l.skapad ? 'Inga markerade fakturor väntar på godkännande. Bocka i gruppraden Kräver godkännande.' : 'Skapa fakturan för Exempel Bygg AB först.')
      else {
        setL({ ...l, godkanda: new Set([...l.godkanda, ...lista]), valda: new Set() })
        setNotis(`${lista.length} ${lista.length === 1 ? 'faktura godkänd' : 'fakturor godkända'}`)
        tips('Godkända', 'De ligger under Godkända, redo för Fortnox. Skicka dem.')
      }
    } else if (id === 'skicka-godkanda') {
      const lista = attSkicka(l)
      if (!l.skapad) miss('Exempel Bygg AB har ingen faktura än. Tryck Skapa faktura på raden.')
      else if (!lista.includes('bygg') || !lista.includes('brf')) miss('Exempel Bygg AB och Brf Exempelgården ska med och måste vara godkända. Bocka i gruppraden Kräver godkännande och tryck Godkänn markerade.')
      else { setL({ ...l, batch: 'confirm', batchRader: lista }); tips('Bekräfta', 'Rutan visar fakturorna och totalen inkl. moms. Skapa utkasten.') }
    } else miss(TIPS[id] ?? 'Skapa fakturan, godkänn och skicka till Fortnox.')
  }

  const framsteg = klar ? 4 : l.batch ? 3 : l.godkanda.has('bygg') && l.godkanda.has('brf') ? 2 : l.skapad ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(TOM); setSvar(BORJA); setFel(0); setNotis(undefined); setKlar(false) }}>
      <Skarm l={l} tryck={tryck} nr={0} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
