// src/pages/shared/intranet/guider/guide-stationer-sidan.tsx
// Guidemodul: Hitta en kunds stationer och kontroller (tekniker, nya arbetsvyn, telefon och dator).
// Etiketterna följer nyNavConfig (Stationer under Hos kunden), NyUtrustning (rubriken
// Stationer, Att göra, Kunder / Karta / Kontroller, Uppdatera, Placera station, Alla /
// Mina), KundLista (Sök kund, enhet, adress eller org.nr, sorteringarna A till Ö, Flest
// stationer, Avvikelser först, Senast kontrollerad, Saknar schema först, Schema,
// Schemalägg, Inget schema, Ingen kund matchar sökningen.), NyKundStationer (Ring, Mejla,
// Navigera, Stationskarta, PDF, Placera ny station, Karta / Lista / Planritning / Schema),
// StationArk (Flytta, Byt typ, Historik, Status, Placerad, Senaste kontroll, Stäng),
// RecurringScheduleManagement (Skapa kontrollschema) och KontrollerFlik (Försenade, Idag,
// Denna vecka, Saknar schema, Boka om). Kontrollerat 2026-10-24. Påhittade kunder.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { KundSida, Lager, NyKnapp, SEX, StationerSida, TypRutaLiten, mk, type Stn } from './_nyvy_stationer'

type Vy = 'start' | 'stationer' | 'kund' | 'ark' | 'schema' | 'kontroller'

interface Lage {
  vy: Vy
  mina: boolean
  sok: string
  ark?: number
  kund?: string
}

const KUND = 'Exempel AB'

function MerLista({ tryck, markera, nr }: { tryck: (id: string) => void; markera?: string; nr: number }) {
  const iBotten = new Set(['Idag', 'Karta', 'Mina ärenden'])
  return (
    <div className="grid gap-2">
      {NY_NAV_GRUPPER.map(g => {
        const lankar = g.lankar.filter(x => !iBotten.has(x.label))
        if (!lankar.length) return null
        return (
          <div key={g.label}>
            <p className="px-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900">
              {lankar.map(x => (
                <Markor key={x.label} markor={mk(markera, `nav:${x.label}`, nr)} block>
                  <button type="button" onClick={() => tryck(`nav:${x.label}`)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] text-slate-200">
                    <Icon name={x.ikon} size={16} className="text-slate-400" />{x.label}
                  </button>
                </Markor>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KundArk({ s, tryck }: { s: Stn; tryck: (id: string) => void }) {
  const rad = (dt: string, dd: string) => <div className="flex justify-between text-[10.5px]"><dt className="text-slate-500">{dt}</dt><dd className="text-slate-200">{dd}</dd></div>
  return (
    <Lager>
      <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-2">
        <TypRutaLiten typ={s.typ} storlek={30} />
        <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-white">Station {s.nr}</p><p className="text-[10.5px] text-slate-400">{s.typ.namn}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-1 border-b border-slate-800 px-2.5 py-1.5">
        {(['Flytta', 'Byt typ', 'Historik'] as const).map((t, i) => (
          <button key={t} type="button" onClick={() => tryck(`ark-${t}`)} className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#20c58f]/30 text-[9.5px] text-[#20c58f]">
            <Icon name={(['station.flytta', 'station.byttyp', 'station.historik'] as const)[i]} size={16} />{t}
          </button>
        ))}
      </div>
      <dl className="grid gap-1 px-2.5 py-2">
        {rad('Status', 'Aktiv')}
        {rad('Placerad', '2026-04-14, Anna Exempel')}
        {rad('Senaste kontroll', '2026-09-28, ingen aktivitet')}
      </dl>
      <div className="border-t border-slate-800 px-2.5 py-2"><NyKnapp block onClick={() => tryck('ark-stang')}>Stäng</NyKnapp></div>
    </Lager>
  )
}

function Schema() {
  return (
    <div className="grid justify-items-center gap-1.5 rounded-lg border border-slate-700 p-3 text-center">
      <p className="text-[11px] text-slate-400">Inget aterkommande kontrollschema</p>
      <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2 text-[10.5px] font-medium text-[#fff]"><Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Skapa kontrollschema</span>
    </div>
  )
}

function Kontroller({ tryck, markera, nr }: { tryck: (id: string) => void; markera?: string; nr: number }) {
  const grupp = (rubrik: string, antal: number, farg: string) => <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white">{rubrik}<span className={farg}>{antal}</span></p>
  return (
    <div className="grid gap-1.5">
      {grupp('Försenade', 1, 'text-orange-400')}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 p-1.5">
        <div className="min-w-0 flex-1"><p className="text-[11.5px] font-semibold text-white">Brf Exempelgården</p><p className="text-[10px] text-slate-400">3 dagar sedan, bokad 2026-10-23</p></div>
        <NyKnapp liten ikon="kund.schema" onClick={() => tryck('bokaom')} markor={mk(markera, 'bokaom', nr)}>Boka om</NyKnapp>
      </div>
      {grupp('Idag', 0, 'text-[#20c58f]')}
      <p className="text-[10px] text-slate-400">Inga kontroller bokade idag.</p>
      {grupp('Saknar schema', 1, 'text-amber-400')}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 p-1.5">
        <div className="min-w-0 flex-1"><p className="text-[11.5px] font-semibold text-white">{KUND}</p><p className="text-[10px] text-slate-400">Sandviken, 6 stationer</p></div>
        <NyKnapp liten ikon="arendelista.boka" onClick={() => tryck('schemalagg-k')}>Schemalägg</NyKnapp>
      </div>
    </div>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const enhet = useGuideEnhet()
  const ram: NyMarkor | undefined = markera?.startsWith('nav:') && (enhet === 'dator' || l.vy !== 'start') ? { pa: true, nr, mal: markera } : undefined
  if (l.vy === 'start') {
    return enhet === 'dator'
      ? <NySkarm sida="idag" titel="Idag" under="Måndag 26 oktober, 3 besök" onRam={tryck} markor={ram}><p className="text-[11px] text-slate-400">Dagens rutt</p></NySkarm>
      : <NySkarm sida="mer" titel="Mer" onRam={tryck}><MerLista tryck={tryck} markera={markera} nr={nr} /></NySkarm>
  }
  const iKund = l.vy === 'kund' || l.vy === 'ark' || l.vy === 'schema'
  const ark = l.vy === 'ark' ? SEX.find(s => s.nr === l.ark) : undefined
  return (
    <NySkarm sida="stationer" titel="Stationer" under="3 kunder, 26 stationer" onRam={tryck} markor={ram}
      over={ark ? <KundArk s={ark} tryck={tryck} /> : undefined}>
      {iKund
        ? <KundSida kund={l.kund ?? KUND} adress="Exempelgatan 12, Sandviken" stationer={SEX} flik={l.vy === 'schema' ? 'schema' : 'karta'} tryck={tryck} markera={markera} nr={nr} schema={<Schema />} />
        : <StationerSida flik={l.vy === 'kontroller' ? 'kontroller' : 'kunder'} mina={l.mina} sok={l.sok} tryck={tryck} markera={markera} nr={nr}
            kontroller={<Kontroller tryck={tryck} markera={markera} nr={nr} />} />}
    </NySkarm>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'stationer', mina: false, sok: '' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { ...BAS, vy: 'start' }, markera: 'nav:Stationer' },
  { lage: BAS, markera: 'mina' },
  { lage: { ...BAS, mina: true }, markera: 'sok' },
  { lage: { ...BAS, mina: true, sok: KUND }, markera: `kund:${KUND}` },
  { lage: { ...BAS, vy: 'kund' }, markera: 'stn:2' },
  { lage: { ...BAS, vy: 'kund' }, markera: 'flik:schema' },
  { lage: BAS, markera: 'flik:kontroller' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: hitta Brf Exempelgården och öppna schemat ───

const MAL = 'Brf Exempelgården'
const START: Lage = { vy: 'stationer', mina: true, sok: '' }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `Kollegan Anna Exempel satte ut stationerna hos ${MAL}. Hitta kunden och öppna kundens schema.` }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ok = (text: string) => { setKlar(true); setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `${text}${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` }) }

  const tryck = (id: string) => {
    if (klar) return
    if (l.vy === 'stationer') {
      if (id === 'alla') { setL({ ...l, mina: false }); tips('Alla', `Nu syns kunder där någon i teamet placerat stationer. ${MAL} finns överst.`) }
      else if (id === 'mina') tips('Mina', 'Mina är redan valt. Visar bara kunder där du själv placerat.')
      else if (id === 'sok') {
        setL({ ...l, sok: 'Exempelgården' })
        if (l.mina) miss('Sökningen hittar inget, för du står på Mina. Anna placerade stationerna. Tryck Alla.')
        else tips('Sökt', 'Tryck på kunden.')
      } else if (id === `kund:${MAL}`) { setL({ ...l, vy: 'kund', kund: MAL }); tips('Kundens sida', 'Öppna kundens schema.') }
      else if (id === `schema:${MAL}`) ok('Schema på raden öppnar kundens schema och kontroller direkt, utan att gå via kundens sida.')
      else if (id.startsWith('kund:') || id.startsWith('schema') ) miss(`Det är en annan kund. Du letar efter ${MAL}.`)
      else if (id.startsWith('flik:')) miss('Kunderna står under Kunder.')
      else miss('Leta i kundlistan. Står kunden inte där, titta på Alla och Mina.')
      return
    }
    if (l.vy === 'ark') {
      if (id === 'ark-stang') { setL({ ...l, vy: 'kund' }); tips('Arket stängt', 'Öppna nu kundens schema.') }
      else miss('Stäng arket först. Schemat ligger på kundens sida.')
      return
    }
    if (l.vy === 'kund') {
      if (id.startsWith('stn:')) { setL({ ...l, vy: 'ark', ark: Number(id.slice(4)) }); tips('Stationens ark', 'Här flyttar du, byter typ och ser historiken. Uppdraget var schemat, så tryck Stäng.') }
      else if (id === 'flik:schema') { setL({ ...l, vy: 'schema' }); ok('Kundens schema visar de återkommande kontrollerna. Alla eller Mina avgjorde om kunden syntes i listan.') }
      else if (id === 'tillbaka-stationer') { setL({ ...l, vy: 'stationer' }); tips('Tillbaka', 'Du är på Stationer igen.') }
      else miss('Schemat är den sista fliken under kunduppgifterna.')
    }
  }

  const framsteg = klar ? 3 : l.vy === 'kund' ? 2 : l.mina ? 0 : 1
  return (
    <OvningRam framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0); setKlar(false) }} bred={enhet === 'dator'}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
