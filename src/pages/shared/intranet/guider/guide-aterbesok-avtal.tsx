// src/pages/shared/intranet/guider/guide-aterbesok-avtal.tsx
// Guidemodul: Boka ett återbesök i ett avtalsärende (tekniker, nya arbetsvyn, telefon och dator).
// Vägen i nya vyn: EditContractCaseModal i stegflödet › steget Klart (KlartSteg: Kontrollera
// innan du stänger, Inget saknas enligt det som är sparat., Vad är klart?, Hela ärendet,
// Bara besöket, Det här händer när du bokar återbesöket, Boka återbesök, Spara utan att
// stänga) › RevisitContractModal (Boka återbesök, Schemalägg uppföljning för detta ärende,
// Ärendeöversikt, Nuvarande datum:, Boka nytt besöksdatum, Start *, Välj ny tid, Slut
// (valfritt), Välj sluttid, Tomt: samma längd som nuvarande besök, annars 1 timme.,
// Anteckning för återbesöket (valfritt), Samma tid som nuvarande besök. Välj en ny tid.,
// Avbryt, Boka återbesök, toasten Återbesök bokat.). Samma ruta finns i Ärendets verktyg,
// Boka återbesök. Extrabesöket har stegen Framme, Arbetet, Bedömning, Foton och preparat,
// Rapport, Pris och fakturering, Klart. Kontrollerat 2026-10-24. Påhittad kund.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NyArende, NyGrupp, NyRad, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import type { GuideModul } from './registry'
import { Hjalp, Lager, NyKnapp, Toast, mk } from './_nyvy_stationer'

const NU = '26 okt. 2026 08:00'
const NY = '9 nov. 2026 08:00'

interface Lage {
  steg: StegId
  val: 'hela' | 'besok'
  ruta: boolean
  start: string | null
  valjTid: boolean
  anteckning: boolean
  toast: string | null
}

const BESOK = [
  'Du väljer ny tid i återbesöksdialogen. Ärendet får status Återbesök och stängs inte.',
  'Besöket sparas i besökshistoriken, och rapport, tid, material och bedömning töms inför nästa besök.',
]

function Klart({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const kort = (id: 'hela' | 'besok', rubrik: string, text: string) => (
    <Markor markor={mk(markera, `val-${id}`, nr)} block>
      <button type="button" role="radio" aria-checked={l.val === id} onClick={() => tryck(`val-${id}`)}
        className={`w-full rounded-xl p-2 text-left ${l.val === id ? 'border-2 border-[#20c58f] bg-[#20c58f]/10' : 'border border-slate-600 bg-slate-800/40'}`}>
        <span className="block text-[12px] font-semibold text-white">{rubrik}</span>
        <span className="block text-[10px] text-slate-400">{text}</span>
      </button>
    </Markor>
  )
  return (
    <div className="grid gap-1.5">
      <Hjalp rubrik="Kontrollera innan du stänger" />
      <p className="flex items-center gap-1.5 text-[10.5px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Inget saknas enligt det som är sparat.</p>
      <Hjalp rubrik="Vad är klart?" />
      <div className="grid grid-cols-2 gap-1.5">
        {kort('hela', 'Hela ärendet', 'Ärendet avslutas, får avslutsdatum och stängs för fakturering.')}
        {kort('besok', 'Bara besöket', 'Ärendet fortsätter med ett återbesök. Det stängs inte.')}
      </div>
      {l.val === 'besok' ? (
        <>
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-1.5">
            <p className="text-[10.5px] font-semibold text-white">Det här händer när du bokar återbesöket</p>
            <ul className="list-disc pl-4 text-[9.5px] leading-snug text-slate-300">{BESOK.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
          <NyKnapp block prim ikon="arende.aterbesok" onClick={() => tryck('boka-klart')} markor={mk(markera, 'boka-klart', nr)}>Boka återbesök</NyKnapp>
        </>
      ) : (
        <NyKnapp block prim onClick={() => tryck('stang-hela')} markor={mk(markera, 'stang-hela', nr)}>Stäng hela ärendet</NyKnapp>
      )}
    </div>
  )
}

function Ruta({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const samma = l.start === NU
  return (
    <Lager>
      <div className="border-b border-slate-700 px-3 py-2">
        <p className="text-[14px] font-bold text-white">Boka återbesök</p>
        <p className="text-[10.5px] text-slate-400">Schemalägg uppföljning för detta ärende</p>
      </div>
      <div className="grid gap-1.5 overflow-hidden px-3 py-2">
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-1.5 text-[10px]">
          <p className="flex justify-between"><span className="text-slate-400">Ärende:</span><span className="text-white">#BE-0004733 - Extrabesök råttor</span></p>
          <p className="flex justify-between"><span className="text-slate-400">Nuvarande datum:</span><span className="text-white">{NU}</span></p>
        </div>
        <div className="grid gap-1 rounded-lg border border-teal-500/30 bg-teal-500/10 p-1.5">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300"><Icon name="allman.kalender" size={16} className="h-3.5 w-3.5" />Boka nytt besöksdatum</p>
          <p className="text-[10.5px] font-medium text-slate-300">Start *</p>
          <Markor markor={mk(markera, 'start', nr)} block>
            <button type="button" onClick={() => tryck('start')} className={`h-7 w-full rounded-lg border bg-slate-800 px-2 text-left text-[11px] ${samma ? 'border-red-500' : 'border-slate-600'} ${l.start ? 'text-white' : 'text-slate-500'}`}>{l.start ?? 'Välj ny tid'}</button>
          </Markor>
          {l.valjTid && (
            <div className="grid gap-1 rounded-lg border border-slate-600 bg-slate-900 p-1">
              {[NU, NY].map(t => <button key={t} type="button" onClick={() => tryck(`tid:${t}`)} className="rounded px-1.5 py-1 text-left text-[10.5px] text-slate-200 hover:bg-slate-800">{t}</button>)}
            </div>
          )}
          {samma && <p className="text-[10px] text-red-400">Samma tid som nuvarande besök. Välj en ny tid.</p>}
          <p className="text-[10.5px] font-medium text-slate-300">Slut (valfritt)</p>
          <span className="h-7 rounded-lg border border-slate-600 bg-slate-800 px-2 text-[11px] leading-7 text-slate-500">Välj sluttid</span>
          <p className="text-[9.5px] text-slate-500">Tomt: samma längd som nuvarande besök, annars 1 timme.</p>
          <p className="text-[10.5px] font-medium text-slate-300">Anteckning för återbesöket (valfritt)</p>
          <Markor markor={mk(markera, 'anteckning', nr)} block>
            <button type="button" onClick={() => tryck('anteckning')} className={`h-8 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 text-left text-[10.5px] ${l.anteckning ? 'text-white' : 'text-slate-500'}`}>
              {l.anteckning ? 'Kontrollera betesintag vid lastkajen' : 'T.ex. uppföljning för att kontrollera betesintag'}
            </button>
          </Markor>
        </div>
      </div>
      <div className="flex justify-end gap-1.5 border-t border-slate-700 px-3 py-2">
        <NyKnapp liten onClick={() => tryck('avbryt')}>Avbryt</NyKnapp>
        <Markor markor={mk(markera, 'boka', nr)}>
          <button type="button" onClick={() => tryck('boka')} aria-disabled={!l.start || samma}
            className={`inline-flex h-8 items-center gap-1 rounded-lg bg-teal-600 px-2.5 text-[11.5px] font-semibold text-[#fff] ${!l.start || samma ? 'opacity-50' : ''}`}>
            <Icon name="allman.kalender" size={16} />Boka återbesök
          </button>
        </Markor>
      </div>
    </Lager>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const ramMal = markera && (markera.startsWith('steg:') || markera === 'nasta') ? { pa: true, nr, mal: markera } : undefined
  const status = l.toast ? 'Återbesök' : 'Bokad'
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under="4 att ta hand om nu" onRam={tryck}
      over={<>
        <NyArende typ="extra" aktivt={l.steg} nr="BE-0004733" status={status} statusFarg={l.toast ? 'bg-blue-400' : 'bg-amber-400'}
          kund="Exempel AB, Exempelgatan 12, Gävle" onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')}
          onSteg={id => tryck(`steg:${id}`)} onIkon={tryck} markor={ramMal}>
          {l.steg === 'klart'
            ? <Klart l={l} tryck={tryck} markera={markera} nr={nr} />
            : (
              <div className="grid gap-1.5">
                <Hjalp rubrik="Pris och fakturering">Lägg in tjänster och artiklar som gick åt. Raderna faktureras när ärendet stängs.</Hjalp>
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2 text-[10.5px] text-slate-300">
                  <p className="font-semibold text-white">Tjänster och artiklar</p>
                  <p className="flex justify-between"><span>Extrabesök, 1 st</span><span>enligt prislistan</span></p>
                </div>
              </div>
            )}
        </NyArende>
        {l.ruta && <Ruta l={l} tryck={tryck} markera={markera} nr={nr} />}
        {l.toast && <Toast text={l.toast} />}
      </>}>
      <NyGrupp titel="Den här veckan" antal={2}>
        <NyRad titel="Exempel AB" tid="Idag 08:00" under="Extrabesök" status="Bokad" statusFarg="bg-amber-400" />
        <NyRad titel="Brf Exempelgården" tid="Idag 10:30" under="Kontrollbesök" status="Bokad" />
      </NyGrupp>
    </NySkarm>
  )
}

// ─── Visning ───

const BAS: Lage = { steg: 'pris', val: 'hela', ruta: false, start: null, valjTid: false, anteckning: false, toast: null }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'steg:klart' },
  { lage: { ...BAS, steg: 'klart' }, markera: 'val-besok' },
  { lage: { ...BAS, steg: 'klart', val: 'besok' }, markera: 'boka-klart' },
  { lage: { ...BAS, steg: 'klart', val: 'besok', ruta: true }, markera: 'start' },
  { lage: { ...BAS, steg: 'klart', val: 'besok', ruta: true, start: NY }, markera: 'anteckning' },
  { lage: { ...BAS, steg: 'klart', val: 'besok', ruta: true, start: NY, anteckning: true }, markera: 'boka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `Extrabesöket hos Exempel AB är gjort, men du ska tillbaka ${NY} och se om råttorna ätit av betet. Ärendet ska inte stängas.` }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte riktigt', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.toast) return
    if (l.ruta) {
      if (id === 'start') setL({ ...l, valjTid: !l.valjTid })
      else if (id.startsWith('tid:')) {
        const t = id.slice(4)
        setL({ ...l, start: t, valjTid: false })
        if (t === NU) miss('Det är samma tid som nuvarande besök. Portalen visar felet i rött och Boka återbesök går inte att trycka på. Välj den nya tiden.')
        else tips('Ny tid vald', 'Slut kan vara tomt. Skriv gärna vad som ska göras och tryck Boka återbesök.')
      } else if (id === 'anteckning') { setL({ ...l, anteckning: true }); tips('Anteckningen är ifylld', 'Tryck Boka återbesök längst ner.') }
      else if (id === 'boka') {
        if (!l.start) miss('Välj en tid i Start * först. Utan den går Boka återbesök inte att trycka på.')
        else if (l.start === NU) miss('Start är samma tid som nuvarande besök. Välj den nya tiden.')
        else {
          setL({ ...l, ruta: false, toast: 'Återbesök bokat.' })
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Återbesöket är bokat ${NY}. Ärendet har status Återbesök och står kvar öppet. Besöket ligger i besökshistoriken.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` })
        }
      } else if (id === 'avbryt') { setL({ ...l, ruta: false }); tips('Avbrutet', 'Inget är bokat. Tryck Boka återbesök igen.') }
      return
    }
    if (l.steg !== 'klart') {
      if (id === 'steg:klart' || id === 'nasta') { setL({ ...l, steg: 'klart' }); tips('Steget Klart', 'Här väljer du om hela ärendet eller bara besöket är klart.') }
      else miss('Återbesöket bokar du i steget Klart, sista ikonen i stegraden. Du kan också trycka Vidare till klart.')
      return
    }
    if (id === 'val-besok') { setL({ ...l, val: 'besok' }); tips('Bara besöket', 'Ärendet fortsätter. Tryck Boka återbesök.') }
    else if (id === 'val-hela') setL({ ...l, val: 'hela' })
    else if (id === 'stang-hela') miss('Stäng hela ärendet avslutar ärendet. Du ska tillbaka, så välj Bara besöket.')
    else if (id === 'boka-klart') { setL({ ...l, ruta: true }); tips('Boka återbesök', 'Välj tiden i Start *.') }
    else miss('Välj Bara besöket under Vad är klart?')
  }

  const framsteg = l.toast ? 5 : l.ruta ? (l.start === NY ? 4 : 3) : l.steg === 'klart' ? (l.val === 'besok' ? 2 : 1) : 0
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
