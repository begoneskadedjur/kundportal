// src/pages/shared/intranet/guider/guide-provision.tsx
// Guidemodul: Förstå din provision (tekniker, nya arbetsvyn, telefon och dator).
//
// Efterbildning av:
//   NyProvision          sammanfattningen i klartext, Nästa utbetalning, utbetalningsregeln,
//                        växeln Intjänat / Lönen, månadsväljaren (Förra månaden, Nästa månad),
//                        diagrammet, posterna och rutorna I år och Väntar på kundens betalning
//   ProvisionLista       rad per post: kund, belopp, datum, BE-nummer, underlaget
//                        ("6 % av 8 000 kr, halva provisionen, före ROT/RUT-avdrag") och status
//   ProvisionForklaring  Så räknas och betalas provisionen (Så räknas den, När den betalas ut,
//                        Vad statusarna betyder)
//   CommissionSection    i steget Pris och fakturering: Ja, provisionsgrundande / Nej,
//                        Provisionsprocent och Grundbelopp, Fördelning mellan tekniker,
//                        Avdrag (underentreprenörskostnader), Total provision
// Texter och format kommer från provisionData.ts (kr, procent, manadNamn, lonerText,
// utbetalningsRegel, STATUS_FORKLARING). Inställningarna i dag: 6 %, lägst 4 000 kr exkl. moms,
// brytdag den 6. Dagens datum i exemplet är 2026-10-26. Påhittade kunder och kollega.

import { useState, type ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { STATUS_FORKLARING, kr, lonerText, manadNamn, procent, utbetalningsRegel, versal } from '../../../../components/technician/ny/provision/provisionData'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NyArende, NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { MerSida, Punkt, Vaxlar, ingenMk, mkFor, vagTill, type Mk, type Ton, type Tryck } from './_nyvy_salja'

// --- Data ---

const NU = new Date(2026, 9, 26)
const CUTOFF = 6
const PROCENT = 6
const GRANS = 4000

interface Post { kund: string; nr: string; dag: string; belopp: number; underlag: string; ton: Ton; status: string; detalj: string; ikon: 'arende.privat' | 'allman.foretag' }

const OKTOBER: Post[] = [
  { kund: 'Familjen Exempel', nr: 'BE-0001234', dag: '2026-10-21', belopp: 480, underlag: `${procent(6)} av ${kr(8000)}, före ROT/RUT-avdrag`, ton: 'gul', status: 'Väntar på kundens betalning', detalj: 'Registrerad för 5 dagar sedan', ikon: 'arende.privat' },
  { kund: 'Exempel AB', nr: 'BE-0001240', dag: '2026-10-14', belopp: 375, underlag: `${procent(6)} av ${kr(12500)}, halva provisionen`, ton: 'bla', status: 'Klar för utbetalning', detalj: 'Kunden betalade 2026-10-20, kommer med decemberlönen', ikon: 'allman.foretag' },
  { kund: 'Brf Exempelgården', nr: 'BE-0001211', dag: '2026-10-03', belopp: 360, underlag: `${procent(6)} av ${kr(6000)}`, ton: 'gron', status: 'Godkänd för lön', detalj: 'Betalas ut med novemberlönen', ikon: 'allman.foretag' },
]
const SEPTEMBER: Post[] = [
  { kund: 'Exempel AB', nr: 'BE-0001188', dag: '2026-09-22', belopp: 540, underlag: `${procent(6)} av ${kr(9000)}`, ton: 'gra', status: 'Utbetald', detalj: 'Med oktoberlönen, 2026-10-25', ikon: 'allman.foretag' },
  { kund: 'Familjen Exempel', nr: 'BE-0001160', dag: '2026-09-09', belopp: 300, underlag: `${procent(6)} av ${kr(5000)}`, ton: 'gra', status: 'Utbetald', detalj: 'Med oktoberlönen, 2026-10-25', ikon: 'arende.privat' },
]
const NOVEMBERLON: Post[] = [OKTOBER[2]]

type Lage = 'intjanat' | 'lon'
type Manad = '2026-10' | '2026-09' | '2026-11'

interface Vy {
  sida: 'start' | 'mer' | 'provision' | 'arende'
  lage: Lage
  manad: Manad
  forklaring: boolean
  steg: 'rapport' | 'pris'
  ja: boolean
  andel: number
}

const BAS: Vy = { sida: 'provision', lage: 'intjanat', manad: '2026-10', forklaring: false, steg: 'pris', ja: false, andel: 50 }

function poster(v: Vy): Post[] {
  if (v.lage === 'lon') return NOVEMBERLON
  return v.manad === '2026-09' ? SEPTEMBER : OKTOBER
}

function mening(v: Vy): { huvud: string; delar: string } {
  const p = poster(v)
  const totalt = p.reduce((s, x) => s + x.belopp, 0)
  const ar = (n: number) => `${n} ${n === 1 ? 'ärende' : 'ärenden'}`
  if (v.lage === 'lon') return { huvud: `Med novemberlönen får du ${kr(totalt)} i provision för ${ar(p.length)}.`, delar: `${kr(360)} är godkänt för lön.` }
  if (v.manad === '2026-09') return { huvud: `I ${manadNamn('2026-09', NU)} har du tjänat ${kr(totalt)} i provision på ${ar(p.length)}.`, delar: `${kr(totalt)} är utbetalt.` }
  return {
    huvud: `Den här månaden har du tjänat ${kr(totalt)} i provision på ${ar(p.length)}.`,
    delar: `${kr(735)} är klart för utbetalning med ${lonerText(['2026-11', '2026-12'])}. ${kr(480)} väntar på att kunden betalar.`,
  }
}

// --- Delar ---

function Rad({ p }: { p: Post }) {
  return (
    <div className="flex items-start gap-2 border-b border-slate-700/60 px-2 py-1.5 last:border-b-0">
      <Icon name={p.ikon} size={16} className="mt-0.5 flex-none text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2"><span className="truncate text-[11.5px] font-medium text-white">{p.kund}</span><span className="font-semibold tabular-nums text-[11.5px] text-white">{kr(p.belopp)}</span></p>
        <p className="font-mono text-[9.5px] text-slate-400">{p.dag} {p.nr}</p>
        <p className="text-[9.5px] text-slate-500">{p.underlag}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5"><Punkt ton={p.ton} liten>{p.status}</Punkt><span className="text-[9.5px] text-slate-400">{p.detalj}</span></p>
      </div>
    </div>
  )
}

function Forklaring({ oppen, tryck, mk }: { oppen: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
      <Markor markor={mk('forklaring')} block>
        <button type="button" onClick={() => tryck('forklaring')} className="flex w-full items-center gap-2 px-2 py-2 text-left">
          <Icon name="provision.procent" size={16} className="flex-none text-slate-400" />
          <span className="flex-1 text-[11.5px] font-medium text-white">Så räknas och betalas provisionen</span>
          <Icon name="allman.chevron" size={16} className={`text-slate-500 ${oppen ? 'rotate-90' : ''}`} />
        </button>
      </Markor>
      {oppen && (
        <div className="grid gap-1.5 px-2.5 pb-2.5 text-[10px] leading-snug text-slate-300">
          <p className="text-[11px] font-semibold text-white">Så räknas den</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Provision registreras när ett ärende avslutas, om ärendet är markerat som provisionsgrundande och du har en andel i det.</li>
            <li>Du får {procent(PROCENT)} av ärendets pris exklusive moms.</li>
            <li>Ärendet måste vara värt minst {kr(GRANS)} exklusive moms, annars blir det ingen provision.</li>
            <li>Vid ROT eller RUT räknas provisionen på priset före avdraget.</li>
            <li>Är ni flera på ärendet delas provisionen efter era andelar, till exempel hälften var.</li>
          </ul>
          <p className="text-[11px] font-semibold text-white">När den betalas ut</p>
          <p>{utbetalningsRegel(CUTOFF, NU)}</p>
          <p className="text-[11px] font-semibold text-white">Vad statusarna betyder</p>
          {STATUS_FORKLARING.slice(0, 2).map(s => <p key={s.status}><Punkt ton={s.ton} liten>{s.rubrik}</Punkt> <span className="text-slate-400">{s.text}</span></p>)}
        </div>
      )}
    </section>
  )
}

function Diagram({ v }: { v: Vy }) {
  const varden = v.lage === 'lon' ? [0, 0, 0, 120, 0, 610, 450, 380, 520, 840, 360, 855] : [210, 0, 380, 520, 0, 610, 450, 380, 520, 840, 840, 1215]
  const valt = v.lage === 'lon' ? 10 : v.manad === '2026-09' ? 10 : 11
  const max = Math.max(...varden)
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900 px-2 pb-1 pt-1.5">
      <p className="text-[9.5px] text-slate-400">{v.lage === 'intjanat' ? 'Intjänat per månad, senaste 12 månaderna' : 'Provision per lönemånad'}</p>
      <div className="flex h-12 items-end gap-0.5">
        {varden.map((x, i) => <span key={i} className={`flex-1 rounded-t ${i === valt ? 'bg-[#20c58f]' : 'bg-slate-600'}`} style={{ height: `${Math.max(2, (x / max) * 100)}%` }} />)}
      </div>
    </div>
  )
}

function ProvisionSida({ v, tryck, mk, dator }: { v: Vy; tryck: Tryck; mk: Mk; dator: boolean }) {
  const m = mening(v)
  const etikett = v.lage === 'lon' ? 'Novemberlönen 2026' : versal(manadNamn(v.manad, NU, true))
  const p = poster(v)
  const vanster: ReactNode = (
    <div className="grid gap-2">
      <section className="grid gap-1">
        <p className="text-[13px] font-semibold leading-snug text-white">{m.huvud}</p>
        <p className="text-[11px] leading-snug text-slate-300">{m.delar}</p>
        {v.lage === 'intjanat' && v.manad === '2026-10' && (
          <p className="flex gap-1.5 text-[11px] text-slate-300"><Icon name="provision.lon" size={16} className="flex-none text-[#20c58f]" /><span>Nästa utbetalning: <b className="text-white">{kr(360)}</b> med novemberlönen, godkänt för lön.</span></p>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="w-[150px]"><Vaxlar prefix="lage" valt={v.lage} tryck={tryck} mk={mk} val={[{ id: 'intjanat', text: 'Intjänat', ikon: 'provision.intjanat' }, { id: 'lon', text: 'Lönen', ikon: 'provision.lon' }]} /></span>
        <span className="flex items-center">
          <Markor markor={mk('forra')}><button type="button" onClick={() => tryck('forra')} aria-label="Förra månaden" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300"><Icon name="allman.chevron-vanster" size={16} /></button></Markor>
          <span className="min-w-[100px] text-center text-[11.5px] font-semibold text-white">{etikett}</span>
          <button type="button" onClick={() => tryck('nasta-manad')} aria-label="Nästa månad" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300"><Icon name="allman.chevron" size={16} /></button>
        </span>
      </div>
      <Diagram v={v} />
      <div>
        <p className="mb-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-white"><Icon name="falt.provision" size={16} className="text-slate-400" />{p.length} {p.length === 1 ? 'post' : 'poster'}</p>
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">{p.map(x => <Rad key={x.nr} p={x} />)}</div>
      </div>
    </div>
  )
  const hoger: ReactNode = (
    <div className="grid gap-2">
      <dl className="divide-y divide-slate-700/60 rounded-xl border border-slate-700/60 bg-slate-900 text-[10.5px]">
        <div className="px-2 py-1.5"><dt className="text-slate-400">I år, 2026</dt><dd className="text-white">{kr(9_870)} intjänat på 21 ärenden<span className="text-slate-400">, i snitt {kr(470)} per ärende</span></dd></div>
        <div className="px-2 py-1.5"><dt className="text-slate-400">Väntar på kundens betalning</dt><dd className="text-white">{kr(480)} på 1 post<span className="block text-slate-400">Äldsta registrerades för 5 dagar sedan</span></dd></div>
      </dl>
      <Forklaring oppen={v.forklaring} tryck={tryck} mk={mk} />
    </div>
  )
  if (dator) return <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-2">{vanster}{hoger}</div>
  // Telefonen: förklaringen ligger längst ner, sidan visas som om man har scrollat dit
  return v.forklaring ? <div className="grid gap-2"><Forklaring oppen tryck={tryck} mk={mk} /></div> : vanster
}

/** Provisionsdelen i steget Pris och fakturering (CommissionSection) */
function ProvisionIArendet({ v, tryck, mk }: { v: Vy; tryck: Tryck; mk: Mk }) {
  const grund = 8000
  const din = Math.round(grund * PROCENT / 100 * v.andel / 100)
  const hennes = Math.round(grund * PROCENT / 100 * (100 - v.andel) / 100)
  const radio = (id: string, text: string, pa: boolean) => (
    <Markor markor={mk(id)}>
      <button type="button" onClick={() => tryck(id)} className="flex items-center gap-1.5 text-[11px] text-slate-300">
        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${pa ? 'border-[#20c58f]' : 'border-slate-500'}`}>{pa && <span className="h-2 w-2 rounded-full bg-[#20c58f]" />}</span>{text}
      </button>
    </Markor>
  )
  return (
    <div className="grid gap-1.5">
      <p className="text-[10.5px] text-slate-400">Tjänster & fakturarader: Bekämpning av råttor, {kr(10000)} inkl. moms, ROT-avdrag på arbetet.</p>
      <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
        <p className="text-[11.5px] font-semibold text-slate-200">Provision</p>
        <div className="flex gap-3">{radio('prov:ja', 'Ja, provisionsgrundande', v.ja)}{radio('prov:nej', 'Nej', !v.ja)}</div>
        {v.ja && (
          <>
            <p className="rounded-lg border border-slate-700/50 bg-slate-800/20 px-1.5 py-1 text-[10px] text-slate-400">Provisionsprocent: <b className="text-slate-200">{PROCENT}%</b> · Grundbelopp: <b className="text-slate-200">{grund.toLocaleString('sv-SE')} kr</b> (belopp före ROT-avdrag)</p>
            <p className="text-[10px] font-medium text-slate-400">Fördelning mellan tekniker</p>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex-1 text-slate-300">Ditt namn</span>
              <Markor markor={mk('andel')}>
                <button type="button" onClick={() => tryck('andel')} className="w-12 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-slate-200">{v.andel}</button>
              </Markor>
              <span className="text-[10px] text-slate-400">%</span>
              <span className="w-14 text-right font-medium text-emerald-400">{din} kr</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex-1 text-slate-300">Anna Exempel</span>
              <span className="w-12 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-slate-200">{100 - v.andel}</span>
              <span className="text-[10px] text-slate-400">%</span>
              <span className="w-14 text-right font-medium text-emerald-400">{hennes} kr</span>
            </div>
            <p className="text-[10px] text-slate-400">Avdrag (underentreprenörskostnader): 0 kr</p>
            <p className="flex items-center justify-between border-t border-slate-700/50 pt-1 text-[11px] text-slate-400">Total provision:<b className="text-[14px] text-emerald-400">{din + hennes} kr</b></p>
          </>
        )}
      </div>
    </div>
  )
}

function Skarm({ v, mk, tryck, enhet, markor }: { v: Vy; mk: Mk; tryck: Tryck; enhet: GuideEnhet; markor?: { pa: boolean; nr: number; mal: string } }) {
  if (v.sida === 'start' || v.sida === 'mer') {
    return (
      <NySkarm sida={v.sida === 'mer' ? 'mer' : 'idag'} titel={v.sida === 'mer' ? 'Mer' : 'Idag'} under={v.sida === 'mer' ? undefined : 'Måndag 26 oktober, 3 besök'} onRam={tryck} markor={markor}>
        {v.sida === 'mer' ? <MerSida tryck={tryck} mk={mk} grupper={['Hos kunden', 'Sälja', 'Hjälp']} /> : <p className="text-[11px] text-slate-400">Dagens besök visas här.</p>}
      </NySkarm>
    )
  }
  if (v.sida === 'arende') {
    return (
      <NySkarm sida="arenden" titel="Mina ärenden" under="4 att ta hand om nu" onRam={tryck}
        over={
          <NyArende typ="privat" aktivt={v.steg} nr="BE-0001234" status="Pågående" kund="Familjen Exempel, Exempelvägen 4, Södertälje"
            markor={markor} onSteg={id => tryck(`steg:${id}`)} onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')} onIkon={m => tryck(m)}>
            {v.steg === 'pris' ? <ProvisionIArendet v={v} tryck={tryck} mk={mk} /> : <p className="text-[11px] text-slate-300">Rapporten till kunden är skriven. Priset och provisionen fyller du i nästa steg.</p>}
          </NyArende>
        }>
        <p className="text-[11px] text-slate-400">Mina ärenden</p>
      </NySkarm>
    )
  }
  return (
    <NySkarm sida="provision" titel="Provision" under="Dina provisionsposter, samma siffror som lönen" onRam={tryck} markor={markor}>
      <ProvisionSida v={v} tryck={tryck} mk={mk} dator={enhet === 'dator'} />
    </NySkarm>
  )
}

// --- Visning ---

const VISNING: { vy: Vy; markera: string; ram?: boolean }[] = [
  { vy: { ...BAS, sida: 'start' }, markera: 'oppna' },
  { vy: BAS, markera: 'forra' },
  { vy: { ...BAS, manad: '2026-09' }, markera: 'lage:lon' },
  { vy: { ...BAS, lage: 'lon', manad: '2026-11' }, markera: 'forklaring' },
  { vy: { ...BAS, sida: 'arende', steg: 'rapport' }, markera: 'steg:pris', ram: true },
  { vy: { ...BAS, sida: 'arende' }, markera: 'prov:ja' },
  { vy: { ...BAS, sida: 'arende', ja: true }, markera: 'andel' },
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
    if (enhet === 'dator') return <Skarm v={v.vy} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Provision' }} tryck={id => { if (id === 'nav:Provision') onNasta() }} />
    if (!merOppen) return <Skarm v={v.vy} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Mer' }} tryck={id => { if (id === 'nav:Mer') setMerOppen(true) }} />
    return <Skarm v={{ ...v.vy, sida: 'mer' }} enhet={enhet} mk={mkFor('nav:Provision', nr)} tryck={id => { if (id === 'nav:Provision') onNasta() }} />
  }
  if (v.ram) return <Skarm v={v.vy} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: v.markera }} tryck={id => { if (id === v.markera) onNasta() }} />
  return <Skarm v={v.vy} enhet={enhet} mk={mkFor(v.markera, nr)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Ta reda på hur mycket provision du får med novemberlönen. Öppna Provision.' }

function Ovning() {
  const enhet = useGuideEnhet()
  const [v, setV] = useState<Vy>({ ...BAS, sida: 'start' })
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    if (v.sida === 'start') {
      if (id === 'nav:Mer' && enhet === 'mobil') { setV({ ...v, sida: 'mer' }); tips('Mer', 'Provision står under Sälja.') }
      else if (id === 'nav:Provision') { setV({ ...v, sida: 'provision' }); tips('Provision', 'Sidan visar vad du tjänat den här månaden. Vilken lön det kommer med ser du i det andra läget.') }
      else miss(vagTill('Provision', enhet))
      return
    }
    if (v.sida === 'mer') {
      if (id === 'nav:Provision') { setV({ ...v, sida: 'provision' }); tips('Provision', 'Sidan visar vad du tjänat den här månaden. Vilken lön det kommer med ser du i det andra läget.') }
      else miss('Provision står under Sälja, längst ner i gruppen.')
      return
    }
    if (id === 'lage:lon') {
      setV({ ...v, lage: 'lon', manad: '2026-11' })
      setKlar(true)
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Med novemberlönen får du ${kr(360)}, för Brf Exempelgården. De ${kr(375)} från Exempel AB kom med decemberlönen, eftersom kunden betalade efter den ${CUTOFF} i månaden.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
      return
    }
    if (id === 'forra') { setV({ ...v, manad: '2026-09' }); miss('Förra månaden visar vad du tjänade i september. Vilken lön provisionen kommer med ser du under Lönen.'); return }
    if (id === 'nasta-manad') { miss('Pilarna byter månad. Vilken lön provisionen kommer med ser du under Lönen.'); return }
    if (id === 'forklaring') { setV({ ...v, forklaring: !v.forklaring }); tips('Så räknas den', 'Bra att läsa. Tryck nu Lönen för att se novemberlönen.'); return }
    if (id === 'lage:intjanat') { miss('Intjänat visar efter när du gjorde jobbet. Du vill se efter lön. Tryck Lönen.'); return }
    miss('Växla till Lönen överst på sidan.')
  }

  const framsteg = klar ? 2 : v.sida === 'provision' ? 1 : 0
  return (
    <OvningRam framsteg={framsteg} totalt={2} svar={svar} onBorjaOm={() => { setV({ ...BAS, sida: 'start' }); setSvar(BORJA); setFel(0); setKlar(false) }} bred={enhet === 'dator'}>
      <Skarm v={v} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
