// src/pages/shared/intranet/guider/guide-fakturaarkiv-kontor.tsx
// Guidemodul: Följ upp skickade fakturor i arkivet (admin och koordinator, dator), 3.126.0.
// Växeln Att hantera | Arkiv i flikarna Avtalskunder och Merförsäljning Avtal
// (src/pages/admin/invoicing/index.tsx, ModeSwitch) och arkivet
// queue/InvoiceArchive.tsx (3.124.0): nyckeltalen Fakturerat, Betalt, Obetalt, ej
// förfallet, Förfallet, Period (Månad, Senaste 30 dagarna, I år, Egen period),
// statusfiltret Alla, Obetalda, Förfallna, Betalda, Visa makulerade (n), Exportera,
// kolumnerna Fakturadatum, Fortnox / portal, Kund, Period eller Er referens,
// Belopp inkl., Förfaller, Status och statusarna Skickad, Förfallen n dagar, Betald,
// Utkast i Fortnox, Krediterad, Makulerad. Växeln är egen per flik och står på
// Att hantera när man byter flik. Påhittade kunder, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'
import { FaktureringSida, NyckeltalRad, Punkt, type Tone, type Tryck } from './_fakturakoer'

type Period = 'month' | 'last30' | 'year' | 'custom'
type Filter = 'alla' | 'obetalda' | 'forfallna' | 'betalda'
type Tillstand = 'betald' | 'skickad' | 'forfallen' | 'makulerad'

interface ArkRad {
  id: string
  datum: string
  fnx: string
  inv: string
  kund: string
  under: string
  kol4: string
  tal: number
  forfaller: string
  tillstand: Tillstand
  status: string
  sub: string
}

const AVTAL: ArkRad[] = [
  { id: 'a1', datum: '2026-11-04', fnx: '1236', inv: 'INV-202610-0095', kund: 'Exempel Bygg AB', under: 'Premie', kol4: '2026-12-14 till 2027-12-13', tal: 10500, forfaller: '2026-12-04', tillstand: 'skickad', status: 'Skickad', sub: 'Obetald' },
  { id: 'a2', datum: '2026-11-02', fnx: '1235', inv: 'INV-202610-0090', kund: 'Exempelhuset AB', under: 'Premie', kol4: '2026-12-12 till 2027-06-11', tal: 6500, forfaller: '2026-12-02', tillstand: 'skickad', status: 'Skickad', sub: 'Obetald' },
  { id: 'a3', datum: '2026-10-20', fnx: '1230', inv: 'INV-202609-0270', kund: 'Brf Exempelgården', under: 'Tillägg per år', kol4: '2026-11-29 till 2027-11-28', tal: 4750, forfaller: '2026-11-19', tillstand: 'betald', status: 'Betald', sub: '2026-11-03' },
  { id: 'a4', datum: '2026-10-12', fnx: '-', inv: 'INV-202610-0010', kund: 'Exempel Lager AB', under: 'Premie', kol4: '2026-11-21 till 2027-02-20', tal: 7875, forfaller: '-', tillstand: 'makulerad', status: 'Makulerad', sub: 'Aldrig skickad' },
  { id: 'a5', datum: '2026-10-01', fnx: '1221', inv: 'INV-202609-0200', kund: 'Exempel Fastigheter AB', under: 'Premie', kol4: '2026-11-10 till 2027-02-09', tal: 15750, forfaller: '2026-10-31', tillstand: 'forfallen', status: 'Förfallen 5 dagar', sub: 'Obetald' },
  { id: 'a6', datum: '2026-09-15', fnx: '1188', inv: 'INV-202608-0150', kund: 'Exempel Norr AB', under: 'Premie', kol4: '2026-10-25 till 2027-10-24', tal: 12250, forfaller: '2026-10-15', tillstand: 'betald', status: 'Betald', sub: '2026-10-09' },
  { id: 'a7', datum: '2026-09-03', fnx: '1170', inv: 'INV-202608-0121', kund: 'Exempel AB', under: 'Premie', kol4: '2026-10-13 till 2027-04-12', tal: 8750, forfaller: '2026-10-03', tillstand: 'forfallen', status: 'Förfallen 33 dagar', sub: 'Obetald' },
]

const MERF: ArkRad[] = [
  { id: 'm1', datum: '2026-11-03', fnx: '1234', inv: 'INV-202610-0207', kund: 'Exempel Lager AB', under: 'BE-0003420', kol4: 'Lager 2', tal: 4375, forfaller: '2026-12-03', tillstand: 'skickad', status: 'Skickad', sub: 'Obetald' },
  { id: 'm2', datum: '2026-11-01', fnx: '1231', inv: 'INV-202610-0199', kund: 'Brf Exempelgården', under: 'BE-0003390', kol4: 'Styrelsen', tal: 1875, forfaller: '2026-12-01', tillstand: 'skickad', status: 'Skickad', sub: 'Obetald' },
  { id: 'm3', datum: '2026-10-14', fnx: '1225', inv: 'INV-202610-0120', kund: 'Exempel Bygg AB', under: 'BE-0003311', kol4: 'Anna Exempel', tal: 3125, forfaller: '2026-11-13', tillstand: 'betald', status: 'Betald', sub: '2026-11-02' },
]

const TON: Record<Tillstand, Tone> = { betald: 'green', skickad: 'blue', forfallen: 'red', makulerad: 'grey' }
const MANAD = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']
const PERIODER: [Period, string][] = [['month', 'Månad'], ['last30', 'Senaste 30 dagarna'], ['year', 'I år'], ['custom', 'Egen period']]
const FILTER: [Filter, string][] = [['alla', 'Alla'], ['obetalda', 'Obetalda'], ['forfallna', 'Förfallna'], ['betalda', 'Betalda']]
const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

interface Lage {
  flik: number
  arkiv: [boolean, boolean, boolean]
  period: Period
  periodMeny: boolean
  filter: Filter
  makulerade: boolean
}

const TOM: Lage = { flik: 0, arkiv: [false, false, false], period: 'last30', periodMeny: false, filter: 'alla', makulerade: false }

type Bas = { l: Lage; tryck: Tryck; markera?: string; nr: number }

function iPeriod(r: ArkRad, p: Period) {
  if (p === 'year') return true
  if (p === 'month') return r.datum >= '2026-11-01'
  return r.datum >= '2026-10-06'
}

function Arkiv({ l, tryck, markera, nr }: Bas) {
  const avtal = l.flik === 1
  const alla = (avtal ? AVTAL : MERF).filter(r => iPeriod(r, l.period))
  const giltiga = alla.filter(r => r.tillstand !== 'makulerad')
  const syns = alla.filter(r => {
    if (r.tillstand === 'makulerad' && !l.makulerade) return false
    if (l.filter === 'obetalda') return r.tillstand === 'skickad' || r.tillstand === 'forfallen'
    if (l.filter === 'forfallna') return r.tillstand === 'forfallen'
    if (l.filter === 'betalda') return r.tillstand === 'betald'
    return true
  })
  const summa = (t?: Tillstand) => giltiga.filter(r => !t || r.tillstand === t)
  const sum = (lista: ArkRad[]) => kr(lista.reduce((s, r) => s + r.tal, 0))
  const forfallna = summa('forfallen')
  const manader = [...new Set(syns.map(r => r.datum.slice(0, 7)))]
  const GRID = 'grid grid-cols-[66px_78px_minmax(110px,1.3fr)_minmax(90px,1fr)_56px_66px_92px] items-center gap-2'
  return (
    <div className="grid gap-2">
      <NyckeltalRad tal={[
        { rubrik: 'Fakturerat', ton: 'blue', antal: giltiga.length, summa: sum(giltiga), hint: 'Inkl. moms i perioden' },
        { rubrik: 'Betalt', ton: 'green', antal: summa('betald').length, summa: sum(summa('betald')), hint: 'Betalda enligt Fortnox' },
        { rubrik: 'Obetalt, ej förfallet', ton: 'grey', antal: summa('skickad').length, summa: sum(summa('skickad')), hint: 'Inom betalningsvillkoret' },
        { rubrik: 'Förfallet', ton: 'red', antal: forfallna.length, summa: sum(forfallna), hint: forfallna.length ? forfallna.map(r => r.kund).slice(0, 2).join(', ') : 'Inget förfallet' },
      ]} />
      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
        <span className="relative flex items-center gap-1 text-slate-400">
          Period
          <Markor markor={mk(markera, 'period', nr)}>
            <button type="button" onClick={() => tryck('period')} className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-white">
              {PERIODER.find(p => p[0] === l.period)?.[1]}<Icon name="allman.chevron" size={16} className="h-3 w-3 rotate-90 text-slate-500" />
            </button>
          </Markor>
          {l.periodMeny && (
            <span className="absolute left-10 top-6 z-10 grid w-40 overflow-hidden rounded-md border border-slate-600 bg-slate-800 shadow-xl">
              {PERIODER.map(([id, namn]) => (
                <Markor key={id} markor={mk(markera, `period-${id}`, nr)} block>
                  <button type="button" onClick={() => tryck(`period-${id}`)} className={`w-full px-2 py-1 text-left ${l.period === id ? 'bg-slate-700 text-white' : 'text-slate-300'}`}>{namn}</button>
                </Markor>
              ))}
            </span>
          )}
        </span>
        <span role="group" aria-label="Status" className="inline-flex overflow-hidden rounded-md border border-slate-700">
          {FILTER.map(([id, namn]) => (
            <Markor key={id} markor={mk(markera, `filter-${id}`, nr)}>
              <button type="button" aria-pressed={l.filter === id} onClick={() => tryck(`filter-${id}`)}
                className={`border-r border-slate-700 px-2 py-0.5 last:border-r-0 ${l.filter === id ? 'bg-slate-800 font-medium text-white' : 'text-slate-400'}`}>{namn}</button>
            </Markor>
          ))}
        </span>
        <span className="min-w-[90px] flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-500">{avtal ? 'Sök kund, fakturanummer eller Fortnox-nummer' : 'Sök kund, fakturanummer, Fortnox-nummer eller ärende'}</span>
        <Markor markor={mk(markera, 'makulerade', nr)}>
          <button type="button" role="checkbox" aria-checked={l.makulerade} onClick={() => tryck('makulerade')} className="flex items-center gap-1 text-slate-300">
            <span className={`flex h-3 w-3 items-center justify-center rounded border ${l.makulerade ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>{l.makulerade && <Icon name="allman.bock" size={16} className="h-2 w-2" />}</span>
            Visa makulerade ({alla.filter(r => r.tillstand === 'makulerad').length})
          </button>
        </Markor>
        <Markor markor={mk(markera, 'exportera', nr)}>
          <button type="button" onClick={() => tryck('exportera')} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-slate-300">
            <Icon name="allman.ladda-ner" size={16} className="h-3 w-3" />Exportera
          </button>
        </Markor>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="min-w-[560px]">
          <div className={`${GRID} border-b border-slate-800 px-2 py-1 text-[8.5px] font-semibold uppercase tracking-wider text-slate-500`}>
            <span>Fakturadatum</span><span>Fortnox / portal</span><span>Kund</span><span>{avtal ? 'Period' : 'Er referens'}</span><span className="text-right">Belopp inkl.</span><span>Förfaller</span><span>Status</span>
          </div>
          {syns.length === 0 && <p className="py-6 text-center text-[11px] text-slate-400">Inga fakturor i perioden</p>}
          {manader.map(m => {
            const lista = syns.filter(r => r.datum.startsWith(m))
            return (
              <div key={m}>
                <p className="flex justify-between bg-slate-800/40 px-2 py-1 text-[11px] font-semibold text-white">
                  {MANAD[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}
                  <span className="text-[9.5px] font-normal text-slate-400">{lista.length} {lista.length === 1 ? 'faktura' : 'fakturor'} · {sum(lista)}</span>
                </p>
                {lista.map(r => (
                  <button key={r.id} type="button" onClick={() => tryck(`rad-${r.id}`)}
                    className={`${GRID} w-full border-t border-slate-800/60 px-2 py-1 text-left ${r.tillstand === 'makulerad' ? 'opacity-60' : ''}`}>
                    <span className="font-mono text-[10px] text-white">{r.datum}</span>
                    <span className="grid font-mono text-[9.5px]"><span className="text-white">{r.fnx}</span><span className="text-slate-500">{r.inv}</span></span>
                    <span className="grid min-w-0"><span className="truncate text-[11px] text-white">{r.kund}</span><span className={`truncate text-[9px] text-slate-500 ${avtal ? '' : 'font-mono'}`}>{r.under}</span></span>
                    <span className="truncate font-mono text-[9.5px] text-slate-300">{r.kol4}</span>
                    <span className="text-right text-[11px] font-semibold text-white">{r.tal.toLocaleString('sv-SE')}</span>
                    <span className={`font-mono text-[9.5px] ${r.tillstand === 'forfallen' ? 'text-red-400' : 'text-slate-300'}`}>{r.forfaller}</span>
                    <span className="grid"><Punkt ton={TON[r.tillstand]}>{r.status}</Punkt>{r.sub && <span className="text-[9px] text-slate-500">{r.sub}</span>}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-[9.5px] text-slate-500">Arkivet visar fakturor som skickats till Fortnox, betalda och krediterade. Betalning och kreditering hämtas från Fortnox. Makulerade utkast som aldrig skickades är dolda tills du bockar i Visa makulerade.</p>
    </div>
  )
}

function Skarm({ l, tryck, markera, nr, notis }: Bas & { notis?: string }) {
  const iArkiv = l.flik > 0 && l.arkiv[l.flik]
  return (
    <FaktureringSida flik={l.flik} arkiv={iArkiv} tryck={tryck} markera={markera} nr={nr} notis={notis}>
      {l.flik === 0 ? <p className="py-6 text-center text-[11.5px] text-slate-400">Tryck på fliken Avtalskunder.</p>
        : iArkiv ? <Arkiv l={l} tryck={tryck} markera={markera} nr={nr} />
          : (
            <div className="grid gap-2 py-4 text-center">
              <p className="text-[11.5px] text-slate-300">{l.flik === 1 ? 'Faktureringsschemat med det som ska skickas.' : 'Arbetslistan med det som ska faktureras.'}</p>
              <p className="text-[10.5px] text-slate-500">Skickade fakturor ligger i Arkiv uppe till höger.</p>
            </div>
          )}
    </FaktureringSida>
  )
}

// ─── Visning ───

const AVTALSFLIK: Lage = { ...TOM, flik: 1 }
const ARKIV: Lage = { ...AVTALSFLIK, arkiv: [false, true, false] }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: TOM, markera: 'flik-avtal' },
  { lage: AVTALSFLIK, markera: 'arkiv' },
  { lage: { ...ARKIV, periodMeny: true }, markera: 'period-year' },
  { lage: { ...ARKIV, period: 'year' }, markera: 'filter-forfallna' },
  { lage: { ...ARKIV, period: 'year', filter: 'forfallna' }, markera: 'exportera' },
  { lage: { ...ARKIV, period: 'year', filter: 'forfallna' }, markera: 'flik-merforsaljning' },
  { lage: { ...ARKIV, flik: 2 }, markera: 'arkiv' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Ta fram alla förfallna avtalsfakturor från i år och exportera listan.' }

function Ovning() {
  const [l, setL] = useState<Lage>(TOM)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    if (id === 'flik-avtal') { setL({ ...l, flik: 1, periodMeny: false }); tips('Avtalskunder', l.arkiv[1] ? 'Arkivet står kvar.' : 'Du ser faktureringsschemat. Arkivet ligger i växeln uppe till höger.'); return }
    if (id === 'flik-merforsaljning') { miss('Uppdraget gäller avtalsfakturor. De ligger under Avtalskunder.'); return }
    if (id === 'flik-privat') { miss('Privat & Företag är engångsärenden. Avtalsfakturorna ligger under Avtalskunder.'); return }
    if (l.flik !== 1) { miss('Tryck på fliken Avtalskunder först.'); return }
    if (id === 'arkiv') { setL({ ...l, arkiv: [false, true, false] }); tips('Arkivet', 'Det visar senaste 30 dagarna. Uppdraget gäller hela året.'); return }
    if (id === 'hantera') { setL({ ...l, arkiv: [false, false, false] }); tips('Att hantera', 'Det här är det som inte är skickat. Tryck Arkiv.'); return }
    if (!l.arkiv[1]) { miss('Tryck Arkiv uppe till höger.'); return }

    if (id === 'period') setL({ ...l, periodMeny: !l.periodMeny })
    else if (id.startsWith('period-')) {
      const p = id.slice(7) as Period
      setL({ ...l, period: p, periodMeny: false })
      if (p === 'year') tips('Hela året', 'Nyckeltalen och listan gäller nu i år. Visa bara de förfallna.')
      else miss(p === 'month' ? 'Månad visar en månad i taget. Uppdraget gäller hela året: välj I år.' : p === 'custom' ? 'Egen period går också, men I år är snabbare.' : 'Senaste 30 dagarna är standard. Välj I år.')
    } else if (id.startsWith('filter-')) {
      const f = id.slice(7) as Filter
      setL({ ...l, filter: f, periodMeny: false })
      if (f === 'forfallna') tips('Bara förfallna', l.period === 'year' ? 'Exportera listan.' : 'Välj I år under Period också.')
      else if (f !== 'alla') miss(f === 'obetalda' ? 'Obetalda tar med fakturor som inte har förfallit än. Välj Förfallna.' : 'Betalda är redan betalda. Välj Förfallna.')
    } else if (id === 'makulerade') { setL({ ...l, makulerade: !l.makulerade }); miss('Makulerade fakturor skickades aldrig och kan inte vara förfallna. Ta bort bocken.') }
    else if (id === 'exportera') {
      if (l.period !== 'year' || l.filter !== 'forfallna') miss('Exportera tar det som syns i listan. Välj I år och Förfallna först.')
      else {
        setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Filen med Exempel Fastigheter AB och Exempel AB laddas ner och öppnas i Excel. Förfallet visar 24 500 kr.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else if (id.startsWith('rad-')) tips('Fakturan', 'Ett tryck på raden öppnar fakturan. Uppdraget är att exportera listan.')
    else miss('Välj I år under Period, tryck Förfallna och exportera.')
  }

  const framsteg = klar ? 4 : l.filter === 'forfallna' && l.period === 'year' ? 3 : l.period === 'year' ? 2 : l.arkiv[1] ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(TOM); setSvar(BORJA); setFel(0); setKlar(false) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
