// src/pages/shared/intranet/guider/guide-stationskontroll.tsx
// Guidemodul: Gör en stationskontroll (tekniker, nya arbetsvyn, telefon och dator).
// Etiketterna följer EditContractCaseModal i stegflödet (stegen Framme, Arbetet,
// Rapport, Utöver avtalet, Klart för service_type inspection; den gröna knappen
// Jag är framme; HjalpText Kontrollera stationerna) och StationInspectionPanel
// inbäddad med hideHeader (KlarmarkeraKnapp: X av Y kontrollerade, N kvar, Klarmarkera
// kontrollen, Kontrollera alla stationer för att klarmarkera.; Ute/Inne, Starta
// runda, Station N av M, Avsluta kontrollrunda, Station N OK, Markera Station N
// som OK?, stationsarket med Flytta, Byt typ, Historik, Förbrukning (g), Minska/Öka
// med 5, Varning: 10, Kritisk: 25, Preparat (valfritt), Foto, Anteckning, Spara,
// Klarmarkera ärende?, Du har inte inspekterat alla stationer ännu., Ja, klarmarkera)
// och KlartSteg (Ärendet är avslutat). Vidare till rapport är vit medan kontrollen
// pågår (nastaSekundar). Kontrollerat 2026-10-28. Påhittad kund.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { NyArende, NyGrupp, NyRad, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import type { GuideModul } from './registry'
import {
  FrammeSteg, Hjalp, KlartAvslutat, Klarmarkera, KontrollRunda, SEX, SnabbOk, StationsArk, TYPER, Toast,
  matningFor, type Stn,
} from './_nyvy_stationer'

interface Lage {
  steg: StegId
  stationer: Stn[]
  kontrollerade: Set<number>
  varden: Record<number, number>
  runda: boolean
  puls: number | null
  ark: number | null
  varde: number | null
  fraga: { typ: 'ok'; stn: number } | { typ: 'klar' } | null
  toast: string | null
  /** Raden under klarmarkeringsknappen: vad som är kvar */
  visaKvar?: boolean
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const enhet = useGuideEnhet()
  const avslutat = l.steg === 'klart' && l.kontrollerade.size === l.stationer.length
  const ark = l.ark ? l.stationer.find(s => s.nr === l.ark) : undefined
  const klara = l.stationer.filter(s => l.kontrollerade.has(s.nr)).length
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under="4 att ta hand om nu" onRam={tryck}
      over={<>
        <NyArende typ="inspection" aktivt={l.steg} nr="BE-0004620" status={avslutat ? 'Avslutat' : 'Bokad'} statusFarg={avslutat ? 'bg-[#20c58f]' : 'bg-amber-400'}
          kund="Exempel AB, Exempelgatan 12, Gävle" nastaText={l.steg === 'framme' ? 'Jag är framme' : undefined} nastaSekundar={l.steg === 'arbete'}
          onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')} onSteg={id => tryck(`steg:${id}`)} onIkon={tryck}
          markor={markera === 'nasta' ? { pa: true, nr, mal: 'nasta' } : undefined}>
          {l.steg === 'framme' && <FrammeSteg kontakt="Anna Exempel" />}
          {l.steg === 'arbete' && (
            <div className="h-full overflow-hidden">
              <Hjalp rubrik="Kontrollera stationerna">{enhet === 'dator' ? 'Tryck på en station på kartan eller i listan, eller starta en runda så tar appen dem i nummerordning.' : undefined}</Hjalp>
              <KontrollRunda r={l} tryck={tryck} markera={markera} nr={nr} />
            </div>
          )}
          {l.steg === 'klart' && <KlartAvslutat />}
        </NyArende>
        {ark && <StationsArk s={ark} varde={l.varde} tryck={tryck} markera={markera} nr={nr} />}
        {l.fraga?.typ === 'ok' && <SnabbOk stn={l.fraga.stn} tryck={tryck} markera={markera} nr={nr} />}
        {l.fraga?.typ === 'klar' && <Klarmarkera klara={klara} totalt={l.stationer.length} tryck={tryck} markera={markera} nr={nr} />}
        {l.toast && <Toast text={l.toast} />}
      </>}>
      <NyGrupp titel="Den här veckan" antal={3}>
        <NyRad titel="Exempel AB" tid="Idag 08:00" under="Kontrollbesök" status="Bokad" />
        <NyRad titel="Brf Exempelgården" tid="Idag 10:30" under="Etablering" status="Bokad" />
        <NyRad titel="Familjen Exempel" tid="Imorgon 09:00" under="Privat, sanering råtta" status="Bokad" />
      </NyGrupp>
    </NySkarm>
  )
}

// ─── Visning ───

const ALLA = new Set(SEX.map(s => s.nr))
const BAS: Lage = { steg: 'framme', stationer: SEX, kontrollerade: new Set(), varden: {}, runda: false, puls: null, ark: null, varde: null, fraga: null, toast: null }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'nasta' },
  { lage: { ...BAS, steg: 'arbete' }, markera: 'starta' },
  { lage: { ...BAS, steg: 'arbete', runda: true, puls: 1 }, markera: 'stn:1' },
  { lage: { ...BAS, steg: 'arbete', runda: true, puls: 1, ark: 1 }, markera: 'plus' },
  { lage: { ...BAS, steg: 'arbete', runda: true, puls: 1, ark: 1, varde: 15 }, markera: 'spara' },
  { lage: { ...BAS, steg: 'arbete', runda: true, kontrollerade: ALLA, varden: { 1: 15, 2: 0, 4: 0, 6: 5 } }, markera: 'klar' },
  { lage: { ...BAS, steg: 'arbete', runda: true, kontrollerade: ALLA, varden: { 1: 15, 2: 0, 4: 0, 6: 5 }, fraga: { typ: 'klar' } }, markera: 'klar-ja' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: tre stationer, station 2 har 15 gram ───

const TRE: Stn[] = [
  { nr: 1, typ: TYPER.betong, x: 22, y: 30 },
  { nr: 2, typ: TYPER.betong, x: 55, y: 75 },
  { nr: 3, typ: TYPER.mekanisk, x: 80, y: 28 },
]
const OVNING_START: Lage = { ...BAS, stationer: TRE }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står utanför Exempel AB. Tala om för portalen att du är framme.' }

const VERKTYG_TIPS: Record<string, string> = {
  flytta: 'Flytta behövs bara när stationen står på fel plats. Fyll i kontrollen i stället.',
  byttyp: 'Byt typ behövs bara när stationen är av fel sort. Fyll i kontrollen i stället.',
  historik: 'Historiken visar de senaste kontrollerna. Bra att veta, men nu ska du fylla i kontrollen.',
  preparat: 'Preparat är valfritt. Uppdraget gäller förbrukningen.',
  foto: 'Foto är valfritt. Uppdraget gäller förbrukningen.',
  anteckning: 'Anteckning är valfri. Uppdraget gäller förbrukningen.',
}

function nastaOkontrollerad(stationer: Stn[], klara: Set<number>): number | null {
  return stationer.find(s => !klara.has(s.nr))?.nr ?? null
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(OVNING_START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte riktigt', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const kontrollera = (stn: number, varde: number | null, toast: string) => {
    const klara = new Set(l.kontrollerade).add(stn)
    const varden = varde === null ? l.varden : { ...l.varden, [stn]: varde }
    setL({ ...l, kontrollerade: klara, varden, ark: null, varde: null, fraga: null, visaKvar: false, puls: l.runda ? nastaOkontrollerad(l.stationer, klara) : null, toast })
    const kvar = l.stationer.length - klara.size
    tips('Sparad', kvar > 0 ? `${kvar} ${kvar === 1 ? 'station' : 'stationer'} kvar.` : 'Alla tre är kontrollerade. Knappen överst har blivit grön. Tryck på Klarmarkera kontrollen.')
  }

  const tryck = (id: string) => {
    if (l.steg === 'klart') return
    if (l.steg === 'framme') {
      if (id === 'nasta') { setL({ ...l, steg: 'arbete', toast: null }); tips('Du är framme', 'Steget Arbetet visar kundens stationer. Kontrollera alla tre, i vilken ordning du vill eller med Starta runda.') }
      else miss('Tryck på den gröna knappen Jag är framme längst ner. Då vet portalen att du är på plats.')
      return
    }
    // Bekräftelserna
    if (l.fraga?.typ === 'ok') {
      if (id === 'ok-ja') kontrollera(l.fraga.stn, null, 'Station markerad som OK')
      else if (id === 'ok-avbryt') { setL({ ...l, fraga: null }); tips('Avbrutet', 'Stationen är inte sparad än.') }
      return
    }
    if (l.fraga?.typ === 'klar') {
      if (id === 'klar-ja') {
        if (l.kontrollerade.size < l.stationer.length) { miss('Ja, klarmarkera går inte att trycka på förrän alla stationer är kontrollerade. Tryck Avbryt och kontrollera resten.'); return }
        setL({ ...l, steg: 'klart', fraga: null, toast: 'Inspektion avslutad!' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Besöket är klarmarkerat och har status Avslutat. Station 2 sparades med 15 gram, de andra som OK. Kontrollrapporten finns nu i steget Rapport.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
      } else if (id === 'klar-avbryt') setL({ ...l, fraga: null })
      return
    }
    // Stationsarket
    if (l.ark) {
      const s = l.stationer.find(x => x.nr === l.ark)!
      const steg = matningFor(s.typ)?.steg ?? 1
      if (id === 'plus') setL({ ...l, varde: (l.varde ?? 0) + steg, toast: null })
      else if (id === 'minus') setL({ ...l, varde: Math.max(0, (l.varde ?? 0) - steg), toast: null })
      else if (id === 'stang') setL({ ...l, ark: null, varde: null })
      else if (id === 'spara') {
        const v = l.varde ?? 0
        if (s.nr === 2 && v !== 15) miss(`Station 2 hade 15 gram. Rutan visar ${v}. Tryck + eller −, varje tryck är 5 gram.`)
        else if (s.nr !== 2 && v > 0) miss(`Station ${s.nr} var i ordning. Tryck − tills rutan visar 0, eller stäng arket och använd bocken på raden.`)
        else kontrollera(s.nr, v, 'Inspektion sparad!')
      } else miss(VERKTYG_TIPS[id] ?? 'Fyll i förbrukningen och tryck Spara.')
      return
    }
    // Steget Arbetet
    if (id === 'starta') {
      const forsta = nastaOkontrollerad(l.stationer, l.kontrollerade)
      setL({ ...l, runda: true, puls: forsta, toast: null })
      tips('Rundan är startad', `Station ${forsta} pulserar. Tryck på den på kartan eller i listan.`)
    } else if (id.startsWith('stn:') || id.startsWith('rad:')) {
      const n = Number(id.slice(4))
      if (l.kontrollerade.has(n)) { tips('Redan kontrollerad', `Station ${n} är sparad. Du kan öppna den igen för att ändra, men uppdraget är klart för den.`); return }
      setL({ ...l, ark: n, varde: null, toast: null })
      tips(`Station ${n}`, n === 2 ? 'Station 2 hade 15 gram. Fyll i förbrukningen och spara.' : `Station ${n} är i ordning. Spara utan förbrukning, eller stäng och använd bocken på raden.`)
    } else if (id.startsWith('ok:')) {
      const n = Number(id.slice(3))
      if (n === 2) miss('Station 2 hade 15 gram förbrukning. Bocken sparar utan förbrukning. Tryck på raden för att öppna stationen i stället.')
      else setL({ ...l, fraga: { typ: 'ok', stn: n }, toast: null })
    } else if (id === 'klar') {
      const kvar = l.stationer.length - l.kontrollerade.size
      if (kvar > 0) {
        setL({ ...l, visaKvar: true, toast: null })
        miss(`Knappen visar hur långt du har kommit och går att trycka på först när alla stationer är kontrollerade. ${kvar} ${kvar === 1 ? 'station' : 'stationer'} kvar.`)
      } else setL({ ...l, fraga: { typ: 'klar' }, toast: null })
    } else if (id === 'avsluta-runda') {
      setL({ ...l, runda: false, puls: null })
      tips('Rundan avslutad', 'Det du sparat finns kvar. Tryck Starta runda igen eller tryck direkt på en station.')
    } else if (id === 'hoppa') {
      tips('Hoppa över', 'Stationen läggs sist i kön. Den måste ändå kontrolleras innan besöket kan klarmarkeras.')
    } else if (id === 'inne') {
      miss('Exempel AB har inga stationer inne. Alla tre står ute.')
    } else if (id === 'nasta' || id === 'steg:rapport' || id === 'steg:klart' || id === 'steg:pris') {
      miss('Kontrollrapporten och Klart kommer efter klarmarkeringen. Kontrollera stationerna här i Arbetet först.')
    } else {
      miss('Kontrollera stationerna i steget Arbetet: tryck på en station eller på Starta runda.')
    }
  }

  const framsteg = l.steg === 'framme' ? 0 : l.steg === 'klart' ? 5 : 1 + l.kontrollerade.size
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(OVNING_START); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
