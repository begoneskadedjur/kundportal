// src/pages/shared/intranet/guider/guide-prissattning.tsx
// Guidemodul: Sätt rätt pris i ärendet (tekniker, nya arbetsvyn, telefon och dator).
// Steget Pris och fakturering i EditCaseModal: CaseServiceSelector (Tjänster & fakturarader,
// Prisguide, Interna kostnader, Dela upp för ROT/RUT) och CommissionSection (Provision).
// Prisguiden är PriceCalculatorPanel (Tilldela interna kostnader till fakturarader,
// Justera påslag & marginal, Applicera priser). Rekommenderat påslag 40 % (pricing_settings).
// Exemplet: inköp 2 143 kr exkl. moms + 40 % = 3 000 kr exkl. moms = 3 750 kr inkl. moms,
// arbete 2 500 kr inkl. moms, ROT 30 % = 750 kr, kunden betalar 3 000 kr.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import { ArendeRam, Lager, PrisInnehall, RapportInnehall, mk, type PrisLage } from './_nyvy_arendet'
import type { GuideModul } from './registry'

const ARTIKLAR = ['Arbetstid tekniker', 'Tätningsmaterial']

interface Lage {
  steg: 'rapport' | 'pris'
  pris: PrisLage
  /** Prisguiden: null = stängd, annars om artiklarna är tilldelade */
  guide: null | { tilldelad: boolean }
}

const FORE: PrisLage = { rader: [{ namn: 'Tätning av ventil', pris: 2500 }], valbara: ARTIKLAR }
const EFTER: PrisLage = { rader: [{ namn: 'Tätning av ventil', pris: 3750 }], interna: ARTIKLAR, valbara: ARTIKLAR, marginal: '28,6%', marginalFarg: 'text-yellow-400' }

function Prisguide({ tilldelad, markera, nr, tryck }: { tilldelad: boolean; markera?: string; nr: number; tryck: (id: string) => void }) {
  return (
    <Lager>
      <div className="flex flex-none items-center justify-between border-b border-slate-700 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white"><Icon name="allman.kalkyl" size={16} className="text-[#20c58f]" />Prisguide</p>
        <button type="button" aria-label="Stäng" onClick={() => tryck('stang-guide')} className="text-slate-400"><Icon name="allman.stang" size={16} /></button>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-2.5">
        <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Tilldela interna kostnader till fakturarader</p>
        {ARTIKLAR.map((a, i) => (
          <div key={a} className="grid gap-1 rounded-xl border border-slate-700/50 bg-slate-800/40 p-2">
            <p className="text-[11.5px] font-medium text-white">{a}{i === 0 && <span className="ml-1 text-[10px] text-slate-500">×2</span>}</p>
            <p className="text-[10px] text-slate-400">{i === 0 ? '1 600 kr' : '543 kr'}</p>
            <Markor markor={i === 0 ? mk(markera, 'tilldela', nr) : undefined} block>
              <button type="button" onClick={() => tryck('tilldela')} className="flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-left text-[11px] text-white">
                {tilldelad ? 'Tätning av ventil' : 'Ej tilldelad'}<Icon name="allman.chevron" size={16} className="h-3 w-3 rotate-90 text-slate-400" />
              </button>
            </Markor>
          </div>
        ))}
        {tilldelad && (
          <div className="grid gap-1 rounded-xl border border-slate-700 p-2">
            <p className="text-[11px] font-semibold text-slate-300">Justera påslag & marginal</p>
            <p className="text-[11px] font-medium text-white">Tätning av ventil</p>
            <p className="flex justify-between text-[10px] text-slate-400"><span>Inköp: 2 143 kr</span><span><b className="text-[12px] text-white">3 750 kr</b> Inkl. moms</span></p>
            <p className="flex justify-between text-[10px] text-slate-400"><span>Påslag</span><span className="text-slate-300">40%</span></p>
            <div className="h-1 rounded bg-slate-700"><div className="h-1 w-[13%] rounded bg-[#20c58f]" /></div>
            <p className="text-[9.5px] leading-snug text-slate-500">Påslag räknas på inköpet, marginal på försäljningspriset.</p>
          </div>
        )}
      </div>
      <div className="flex flex-none justify-end gap-1.5 border-t border-slate-700/50 px-3 py-2">
        <button type="button" onClick={() => tryck('avbryt-guide')} className="px-2 text-[11px] text-slate-300">Avbryt</button>
        <Markor markor={mk(markera, 'applicera', nr)}>
          <button type="button" onClick={() => tryck('applicera')} aria-disabled={!tilldelad} className={`flex items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 py-1 text-[11px] font-semibold text-[#fff] ${tilldelad ? '' : 'opacity-50'}`}>
            <Icon name="allman.kalkyl" size={16} className="h-3.5 w-3.5" />Applicera priser
          </button>
        </Markor>
      </div>
    </Lager>
  )
}

function Skarm({ l, markera, nr, tryck }: { l: Lage; markera?: string; nr: number; tryck: (id: string) => void }) {
  return (
    <ArendeRam aktivt={l.steg} markera={markera} nr={nr} tryck={tryck}
      over={l.guide ? <Prisguide tilldelad={l.guide.tilldelad} markera={markera} nr={nr} tryck={tryck} /> : undefined}>
      {l.steg === 'rapport'
        ? <RapportInnehall nr={nr} tryck={tryck} skrivet skickad />
        : <PrisInnehall l={l.pris} markera={markera} nr={nr} tryck={tryck} />}
    </ArendeRam>
  )
}

// ─── Visning ───

const VISNING: { l: Lage; markera: string }[] = [
  { l: { steg: 'rapport', pris: FORE, guide: null }, markera: 'steg:pris' },
  { l: { steg: 'pris', pris: FORE, guide: null }, markera: 'interna' },
  { l: { steg: 'pris', pris: { ...FORE, interna: ARTIKLAR }, guide: null }, markera: 'prisguide' },
  { l: { steg: 'pris', pris: { ...FORE, interna: ARTIKLAR }, guide: { tilldelad: false } }, markera: 'tilldela' },
  { l: { steg: 'pris', pris: { ...FORE, interna: ARTIKLAR }, guide: { tilldelad: true } }, markera: 'applicera' },
  { l: { steg: 'pris', pris: { ...EFTER, interna: null }, guide: null }, markera: 'delaupp' },
  { l: { steg: 'pris', pris: { ...EFTER, interna: null, delform: { arbete: 2500, timmar: 2, typ: 'ROT' } }, guide: null }, markera: 'delaupp-ok' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.l} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: dela upp tätningen för ROT ───

interface OLage {
  steg: 'rapport' | 'pris'
  form: null | { arbete: number | null; timmar: number | null; typ: 'ROT' | 'RUT' | null }
  delad: boolean
  fastighet: boolean
}
const START: OLage = { steg: 'rapport', form: null, delad: false, fastighet: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Rapporten är skickad. Gå till steget där priset sätts.' }

const TIPS: Record<string, string> = {
  nasta: 'Det fungerar också, men stegraden tar dig direkt. Tryck på ikonen för Pris och fakturering.',
  prisguide: 'Priset är redan rätt, 3 750 kr. Nu ska arbetet delas ut för ROT.',
  interna: 'Interna kostnaderna är redan inlagda. Nu ska arbetet delas ut för ROT.',
  tillagg: 'Ingen ny tjänst behövs. Dela upp tätningen för ROT.',
  rut: 'RUT gäller hushållsnära tjänster. Tätning av ett hus är ROT.',
  'avbryt-delning': 'Avbryt stänger formuläret utan att spara. Fyll i och tryck Dela upp.',
  verktyg: 'Ärendets verktyg behövs inte. Allt finns i steget Pris och fakturering.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<OLage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    if (l.steg === 'rapport') {
      if (id === 'steg:pris') { setL({ ...l, steg: 'pris' }); tips('Pris och fakturering', 'Tätning av ventil kostar 3 750 kr inkl. moms. Av det är 2 500 kr arbete, två timmar. Familjen ska ha ROT.') }
      else miss(TIPS[id] ?? 'Tryck på ikonen Pris och fakturering i stegraden överst.')
      return
    }
    const f = l.form
    if (!l.delad && !f) {
      if (id === 'delaupp') { setL({ ...l, form: { arbete: null, timmar: null, typ: null } }); tips('Formuläret är öppet', 'Fyll i Varav arbetskostnad, Timmar och välj avdrag.') }
      else miss(TIPS[id] ?? 'Tryck Dela upp för ROT/RUT under tjänsten.')
      return
    }
    if (f) {
      if (id === 'arbetskostnad') { setL({ ...l, form: { ...f, arbete: 2500 } }); tips('Arbetskostnad 2 500 kr', 'Material och övrigt blir 1 250 kr. Fyll i timmarna.') }
      else if (id === 'timmar') { setL({ ...l, form: { ...f, timmar: 2 } }); tips('2 timmar', f.typ ? 'Tryck Dela upp.' : 'Välj ROT eller RUT.') }
      else if (id === 'rot') { setL({ ...l, form: { ...f, typ: 'ROT' } }); tips('ROT (30 %)', 'Avdraget blir 750 kr och kunden betalar 3 000 kr.') }
      else if (id === 'delaupp-ok') {
        if (f.arbete == null) miss('Ange arbetskostnaden i kronor.')
        else if (f.timmar == null) miss('Ange antal timmar (större än 0).')
        else if (!f.typ) miss('Välj ROT eller RUT.')
        else { setL({ ...l, form: null, delad: true }); tips('Uppdelat', 'Det står Arbetskostnaden uppdelad (ROT). Fyll i fastighetsbeteckningen Exempelby 1:23.') }
      } else miss(TIPS[id] ?? 'Fyll i formuläret och tryck Dela upp.')
      return
    }
    if (id === 'fastighet') {
      setL({ ...l, fastighet: true }); setKlar(true)
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Arbetet är en egen rad med ROT, 750 kr i avdrag och Att betala (kund) 3 000 kr. Totalen mot kunden är fortfarande 3 750 kr.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen.` : ''}` })
    } else miss(TIPS[id] ?? 'Fyll i Fastighetsbeteckning * under raden.')
  }

  const pris: PrisLage = { ...EFTER, interna: null, delform: l.form, delning: l.delad ? { arbete: 2500, timmar: 2, typ: 'ROT' } : null, fastighet: l.fastighet ? 'Exempelby 1:23' : null }
  const framsteg = l.steg === 'rapport' ? 0 : l.fastighet ? 4 : l.delad ? 3 : l.form ? 2 : 1
  return (
    <OvningRam framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0); setKlar(false) }} bred={enhet === 'dator'}>
      <ArendeRam aktivt={l.steg} nr={0} tryck={tryck}>
        {l.steg === 'rapport' ? <RapportInnehall nr={0} tryck={tryck} skrivet skickad /> : <PrisInnehall l={pris} nr={0} tryck={tryck} />}
      </ArendeRam>
    </OvningRam>
  )
}


export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
