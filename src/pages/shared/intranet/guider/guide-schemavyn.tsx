// src/pages/shared/intranet/guider/guide-schemavyn.tsx
// Guidemodul: Hitta och flytta besök i schemat (admin och koordinator, dator).
// Efterbildning av CoordinatorSchedule: ScheduleSearch (Sök ärende..., träff med status,
// skadedjur och adress, ett tryck öppnar ärendet), pilarna i ScheduleHeader och dagvyn i
// TimeGridRow där ett besök dras till en ny tid och en ny teknikers rad (handleCaseMoved).
// Släpp utanför arbetstid ger "<namn> arbetar inte <tid> den dagen". Påhittade kunder.

import { useState } from 'react'
import { Dator, Markor, Notis, OvningRam, Status, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { ArendeDator, SchemaHuvud, SchemaRutnat, gorMk, type ArendeData, type Besok, type Mk, type TeknikerRad, type Tryck } from './_arenden'

const RADER: TeknikerRad[] = [
  { id: 'anna', namn: 'Anna Exempel' },
  { id: 'erik', namn: 'Erik Exempel' },
  { id: 'sara', namn: 'Sara Exempel' },
]

/** Sara arbetar bara förmiddagar i övningen */
const SLUTAR: Record<string, number> = { anna: 17, erik: 17, sara: 12 }

const MANDAG: Besok[] = [
  { id: 'm1', kund: 'Exempel AB', fran: 8, till: 9.5, rad: 'anna' },
  { id: 'm2', kund: 'Brf Exempelgården', fran: 10, till: 12, rad: 'erik' },
]
const TISDAG: Besok[] = [
  { id: 'fam', kund: 'Familjen Exempel', fran: 9, till: 10, rad: 'anna' },
  { id: 't2', kund: 'Exempel AB', fran: 13, till: 14.5, rad: 'anna' },
  { id: 't3', kund: 'Brf Exempelgården', fran: 9, till: 11, rad: 'sara' },
]

const ARENDE: ArendeData = {
  nr: 'BE-0001234',
  status: 'Bokad',
  kund: 'Familjen Exempel · Exempelvägen 4, Södertälje',
  beskrivning: 'Råttor i källaren, spår vid tvättstugan.',
  tid: 'Tisdag 2026-10-20, 09:00 till 10:00',
}

interface Lage {
  vy: 'schema' | 'arende'
  dag: 0 | 1
  sok: boolean
  grepp: boolean
  /** Var besöket ligger efter flytten */
  flytt: { rad: string; fran: number } | null
  sett: boolean
}

function SokFalt({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  return (
    <div className="relative">
      <Markor markor={mk('sok')}>
        <button type="button" onClick={() => tryck('sok')}
          className={`flex w-36 items-center gap-1.5 rounded-lg border bg-slate-800/50 px-2 py-1 text-left text-[11px] ${l.sok ? 'border-[#20c58f] text-white' : 'border-slate-700/60 text-slate-500'}`}>
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" />{l.sok ? 'Familjen Exempel' : 'Sök ärende...'}
        </button>
      </Markor>
      {l.sok && l.vy === 'schema' && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-2xl">
          <Markor markor={mk('traff')} block>
            <button type="button" onClick={() => tryck('traff')} className="grid w-full gap-0.5 px-3 py-2 text-left hover:bg-slate-700/40">
              <span className="flex items-center gap-2 text-[12px] font-medium text-white">Familjen Exempel <span className="text-[10px] font-normal text-slate-500">BE-0001234</span></span>
              <span className="flex items-center gap-1.5"><Status text="Bokad" /><span className="text-[10px] text-slate-400">· Råttor</span></span>
              <span className="text-[10px] text-slate-500">Exempelvägen 4, Södertälje</span>
            </button>
          </Markor>
        </div>
      )}
    </div>
  )
}

function Skarm({ l, mk, tryck, linje }: { l: Lage; mk: Mk; tryck: Tryck; linje?: { rad: string; timme: number } }) {
  if (l.vy === 'arende') {
    return (
      <Dator adress="koordinator › schema">
        <ArendeDator a={ARENDE} mk={mk} tryck={tryck} />
      </Dator>
    )
  }
  const besok = l.dag === 0 ? MANDAG : TISDAG.map(b => {
    if (b.id !== 'fam') return b
    if (l.flytt) return { ...b, rad: l.flytt.rad, fran: l.flytt.fran, till: l.flytt.fran + 1, farg: 'border-[#20c58f] bg-[#20c58f]/20' }
    return { ...b, dimmad: l.grepp }
  })
  return (
    <Dator adress="koordinator › schema">
      <SchemaHuvud datum={l.dag === 0 ? 'måndag 19 oktober 2026' : 'tisdag 20 oktober 2026'} mk={mk} tryck={tryck}
        sok={<SokFalt l={l} mk={mk} tryck={tryck} />} />
      <SchemaRutnat rader={RADER} besok={besok} mk={mk} tryck={tryck} linje={linje} />
      <p className="px-3 py-2 text-[10.5px] text-slate-500">Dra ett besök med musen till en ny tid eller en annan teknikers rad.</p>
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'schema', dag: 0, sok: false, grepp: false, flytt: null, sett: false }

const VISNING: { lage: Lage; markera: string; linje?: { rad: string; timme: number } }[] = [
  { lage: BAS, markera: 'sok' },
  { lage: { ...BAS, sok: true }, markera: 'traff' },
  { lage: { ...BAS, sok: true, sett: true }, markera: 'dag-nasta' },
  { lage: { ...BAS, sok: true, sett: true, dag: 1 }, markera: 'besok:fam' },
  { lage: { ...BAS, sok: true, sett: true, dag: 1, grepp: true }, markera: 'slot:erik:13', linje: { rad: 'erik', timme: 13 } },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const mk = gorMk(v.markera, steg + 1)
  return <Skarm l={v.lage} mk={mk} linje={v.linje} tryck={id => {
    if (id === v.markera || (v.markera === 'besok:fam' && id === 'drag:fam')) onNasta()
  }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du vet inte vilken dag besöket ligger. Sök fram kunden först.' }

const TIPS: Record<string, string> = {
  nytt: 'Nytt ärende skapar ett nytt ärende. Besöket finns redan.',
  franvaro: 'Frånvaro är för lediga tekniker.',
  filter: 'Filtret väljer vilka tekniker och statusar som visas. Sök fram kunden i stället.',
  'vy-Vecka': 'I veckovyn går det att byta dag och tid, men inte tekniker. Stanna i Dag.',
  'vy-Månad': 'I månadsvyn byter du bara dag. Stanna i Dag.',
  'dag-forra': 'Besöket ligger framåt i tiden, inte bakåt.',
  idag: 'Idag tar dig till i dag. Besöket ligger på tisdag.',
  fotspar: 'Fotspåren bokar återbesök. Här ska du bara flytta besöket.',
  historik: 'Historiken visar gamla besök. Stäng ärendet med Avbryt.',
  komm: 'Här skriver du kommentarer. Stäng ärendet med Avbryt.',
  spara: 'Du har inte ändrat något. Stäng med Avbryt och flytta besöket i schemat.',
  radera: 'Radera tar bort ärendet. Det ska bara flyttas.',
  flik: 'Du har sett tiden: tisdag 09:00. Stäng med Avbryt.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)
  const [notis, setNotis] = useState<string | null>(null)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const slapp = (rad: string, timme: number) => {
    const namn = RADER.find(r => r.id === rad)?.namn ?? ''
    if (timme >= SLUTAR[rad]) {
      setNotis(`${namn} arbetar inte ${String(timme).padStart(2, '0')}:00 den dagen`)
      setL({ ...l, grepp: false })
      miss(`Det står ${namn} arbetar inte ${String(timme).padStart(2, '0')}:00 den dagen. Besöket flyttades inte. Dra det till Erik i stället.`)
      return
    }
    setNotis(null)
    setL({ ...l, grepp: false, flytt: { rad, fran: timme } })
    if (rad === 'erik' && timme === 13) {
      setKlar(true)
      setSvar({
        typ: 'ok',
        titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
        text: `Besöket ligger nu hos Erik tisdag 13:00 till 14:00. Längden följde med och flytten sparades direkt när du släppte.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
      })
    } else if (rad === 'erik') {
      miss(`Rätt tekniker, men besöket hamnade ${String(timme).padStart(2, '0')}:00. Dra det till 13:00 på Eriks rad.`)
    } else {
      miss(`Besöket flyttades till ${namn}. Uppdraget var Erik 13:00. Dra det dit.`)
    }
  }

  const tryck = (id: string) => {
    if (klar) return
    if (l.vy === 'arende') {
      if (id === 'avbryt-arende') { setL({ ...l, vy: 'schema', sett: true }); tips('Nu vet du dagen', 'Besöket ligger tisdag 2026-10-20. Gå dit i schemat.') }
      else miss(TIPS[id] ?? 'Stäng ärendet med Avbryt längst ner.')
      return
    }
    if (id === 'sok') { setL({ ...l, sok: true }); tips('Träffen visas', 'Tryck på träffen så öppnas ärendet och du ser tiden.'); return }
    if (id === 'traff') { setL({ ...l, vy: 'arende' }); tips('Ärendet är öppet', 'Tiden står under Schemaläggning: tisdag 09:00. Stäng ärendet.'); return }
    if (id === 'dag-nasta') {
      if (l.dag === 1) { miss('Du står redan på tisdag.'); return }
      setL({ ...l, dag: 1 }); tips('Tisdag', l.sett ? 'Där är besöket hos Anna 09:00. Dra det till Eriks rad 13:00.' : 'Där är besöket. Dra det till Eriks rad 13:00.'); return
    }
    if (id.startsWith('drag:')) {
      if (id === 'drag:fam') { setL({ ...l, grepp: true }); tips('Du har tagit tag', 'Släpp på Eriks rad vid 13:00.') }
      else miss('Fel besök. Familjen Exempel ligger hos Anna 09:00.')
      return
    }
    if (id.startsWith('besok:')) {
      if (id === 'besok:fam') miss('Ett tryck öppnar ärendet. Håll i stället nere musknappen på besöket och dra det.')
      else miss('Det är ett annat besök. Familjen Exempel ligger hos Anna 09:00 på tisdag.')
      return
    }
    if (id.startsWith('slot:')) {
      const [, rad, timme] = id.split(':')
      if (l.dag === 0) { miss('Besöket ligger inte på måndag. Gå till tisdag med pilen.'); return }
      if (!l.grepp) { miss('Dra besöket hit: håll nere musknappen på Familjen Exempel och släpp här.'); return }
      slapp(rad, Number(timme))
      return
    }
    miss(TIPS[id] ?? 'Sök fram kunden, se dagen, gå dit och dra besöket.')
  }

  const framsteg = klar ? 6 : l.vy === 'arende' ? 2 : l.grepp ? 5 : l.dag === 1 ? 4 : l.sett ? 3 : l.sok ? 1 : 0
  const borjaOm = () => { setL(BAS); setSvar(BORJA); setFel(0); setKlar(false); setNotis(null) }
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={borjaOm}>
      <div className="relative">
        <Skarm l={l} mk={() => undefined} tryck={tryck} />
        {notis && <Notis fel text={notis} />}
      </div>
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
