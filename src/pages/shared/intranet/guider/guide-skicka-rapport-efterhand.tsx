// src/pages/shared/intranet/guider/guide-skicka-rapport-efterhand.tsx
// Guidemodul: Skicka en rapport i efterhand (tekniker, nya arbetsvyn, telefon och dator).
// Sidan Mina rapporter (NyRapporter.tsx, 3.132.0 och 3.132.1): Rapporter under Min dag i
// sidomenyn (nyNavConfig), i telefonen under Mer. Avslutade ärenden där du är tekniker 1, 2
// eller 3, sök, period 30 dagar / 90 dagar / 12 månader, typ, grupperat per månad. Raden har
// Ladda ned och Skicka. Skicka öppnar arket Skicka rapporten (Till kunden, Till mig), Till
// kunden frågar Skicka till kund? (SkickaTillKundArk) innan något skickas. Toasten för en
// saneringsrapport är "Rapport skickad till <kontaktperson>!" och "Rapport nedladdad!"
// (useWorkReportGeneration). Datorn har dessutom panelen för den valda raden.
// Skärmdelarna ligger i _rapporter.tsx. Påhittade kunder och adresser, fredag 2026-11-13.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { NyGrupp, NyRad, NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { MerSida, Rulla } from './_nyvy_min_dag'
import { Toast } from './_nyvy_stationer'
import { mkFor, ingenMk, type Mk, type Tryck } from './_nyvy_salja'
import { RapporterInnehall, SkickaKundArk, SkickaValArk, type Period, type RapportRadEx } from './_rapporter'

const MIN_EPOST = 'tekniker@exempel.se'

const FAM: RapportRadEx = { id: 'fam', nr: 'BE-0001240', datum: '10 nov', kund: 'Familjen Exempel', tjanst: 'Privat, råttor', rapport: 'Saneringsrapport', epost: 'familjen@exempel.se' }
const BRF: RapportRadEx = { id: 'brf', nr: 'BE-0004620', datum: '3 nov', kund: 'Brf Exempelgården', tjanst: 'Stationskontroll', rapport: 'Kontrollrapport', epost: 'info@exempelgarden.se' }
const EXAB: RapportRadEx = { id: 'exab', nr: 'BE-0001198', datum: '15 sep', kund: 'Exempel AB', tjanst: 'Företag, kackerlackor', rapport: 'Saneringsrapport', epost: 'kontakt@example.com' }
const ALLA = [FAM, BRF, EXAB]

type Vy = 'idag' | 'mer' | 'rapporter'

interface Lage {
  vy: Vy
  period: Period
  sok: string
  /** Vald rad på datorn */
  vald?: string
  /** Arket Skicka rapporten för raden */
  val?: string
  /** Frågan Skicka till kund? för raden */
  ark?: string
  toast?: string
}

function manader(l: Lage) {
  const q = l.sok.trim().toLowerCase()
  const syns = (r: RapportRadEx) => !q || [r.kund, r.nr, r.epost].some(v => v.toLowerCase().includes(q))
  const nov = { titel: 'November 2026', rader: [FAM, BRF].filter(syns) }
  const sep = { titel: 'September 2026', rader: [EXAB].filter(syns) }
  return l.period === '30' ? [nov] : [nov, sep]
}

function Skarm({ l, markera, nr, tryck }: { l: Lage; markera?: string; nr: number; tryck: Tryck }) {
  const mk: Mk = markera ? mkFor(markera, nr) : ingenMk
  const ramMarkor = markera?.startsWith('nav:') && l.vy !== 'mer' ? { pa: true, nr, mal: markera } : undefined
  const rad = (id?: string) => ALLA.find(r => r.id === id)

  if (l.vy === 'idag') {
    return (
      <NySkarm sida="idag" titel="Idag" under="Fredag 13 november, 2 besök" onRam={tryck} markor={ramMarkor}>
        <NyGrupp titel="Dagens rutt" antal={2}>
          <NyRad titel="Exempel AB" tid="08:00" under="Kontrollbesök" status="Bokad" onClick={() => tryck('idag-rad')} />
          <NyRad titel="Familjen Exempel" tid="10:30" under="Privat, återbesök" status="Bokad" onClick={() => tryck('idag-rad')} />
        </NyGrupp>
      </NySkarm>
    )
  }
  if (l.vy === 'mer') {
    return (
      <NySkarm sida="mer" titel="Mer" onRam={tryck}>
        <MerSida mk={mk} tryck={tryck} />
      </NySkarm>
    )
  }
  const valRad = rad(l.val)
  const arkRad = rad(l.ark)
  return (
    <NySkarm sida="rapporter" titel="Mina rapporter" under="Avslutade ärenden där du är tekniker 1, 2 eller 3" onRam={tryck} markor={ramMarkor}
      over={<>
        {valRad && <SkickaValArk rad={valRad} minEpost={MIN_EPOST} mk={mk} tryck={tryck} />}
        {arkRad && <SkickaKundArk rapportNamn={arkRad.rapport} arendeNr={arkRad.nr} epost={arkRad.epost} mk={mk} tryck={tryck} />}
        {l.toast && <Toast text={l.toast} />}
      </>}>
      <Rulla>
        <RapporterInnehall manader={manader(l)} period={l.period} sok={l.sok} vald={l.vald} minEpost={MIN_EPOST} mk={mk} tryck={tryck} />
      </Rulla>
    </NySkarm>
  )
}

// ─── Visning ───

const RAPPORTER: Lage = { vy: 'rapporter', period: '30', sok: '' }
const MED_90: Lage = { ...RAPPORTER, period: '90' }
const SOKT: Lage = { ...MED_90, sok: 'Exempel AB', vald: 'exab' }

function visningSteg(enhet: GuideEnhet): { lage: Lage; markera: string }[] {
  return [
    { lage: { ...RAPPORTER, vy: enhet === 'mobil' ? 'mer' : 'idag' }, markera: 'nav:Rapporter' },
    { lage: RAPPORTER, markera: 'period:90' },
    { lage: MED_90, markera: 'sok' },
    { lage: SOKT, markera: 'skicka:exab' },
    { lage: { ...SOKT, val: 'exab' }, markera: 'val-kund' },
    { lage: { ...SOKT, ark: 'exab' }, markera: 'ark-skicka' },
    { lage: { ...SOKT, toast: 'Rapport skickad till Anna Exempel!' }, markera: 'ladda:exab' },
  ]
}

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const lista = visningSteg(enhet)
  const v = lista[Math.min(steg, lista.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'idag', period: '30', sok: '' }
const BORJA: OvningSvar = {
  typ: 'tips',
  titel: 'Börja här',
  text: 'Exempel AB har bett om saneringsrapporten från besöket i september. Du stängde ärendet och valde Skicka inte nu. Hitta rapporten och skicka den till kunden.',
}

function ovningTryck(l: Lage, id: string, enhet: GuideEnhet): { lage?: Lage; svar: OvningSvar } | null {
  const fel = (text: string) => ({ svar: { typ: 'fel' as const, titel: 'Inte där', text } })
  const tips = (lage: Lage, titel: string, text: string) => ({ lage, svar: { typ: 'tips' as const, titel, text } })
  const tillRapporter = tips({ ...l, vy: 'rapporter' }, 'Mina rapporter', 'Listan visar dina avslutade ärenden de senaste 30 dagarna. Besöket var i september.')

  if (l.vy === 'idag') {
    if (enhet === 'mobil' && id === 'nav:Mer') return tips({ ...l, vy: 'mer' }, 'Mer', 'Här ligger resten av menyn. Rapporter står under Min dag.')
    if (enhet === 'dator' && id === 'nav:Rapporter') return tillRapporter
    if (id === 'nav:Ärenden' || id === 'nav:Mina ärenden') return fel('Mina ärenden visar dina ärenden, men rapporterna skickar du från Rapporter. ' + (enhet === 'mobil' ? 'Tryck Mer.' : 'Tryck Rapporter i sidomenyn.'))
    return fel(enhet === 'mobil' ? 'Rapporter ligger under Mer, längst ner till höger.' : 'Rapporter står i sidomenyn under Min dag, efter Mina ärenden.')
  }
  if (l.vy === 'mer') {
    if (id === 'nav:Rapporter') return tillRapporter
    if (id === 'nav:Specialrapporter') return fel('Specialrapporter är fria rapporter med delar och bilder. Saneringsrapporten finns under Rapporter, under Min dag.')
    return fel('Tryck Rapporter under Min dag.')
  }

  // Mina rapporter
  if (l.ark) {
    if (id === 'ark-skicka') return { lage: { ...l, ark: undefined, toast: 'Rapport skickad till Anna Exempel!' }, svar: { typ: 'ok', titel: 'Klart', text: 'Saneringsrapporten är skickad till kontakt@example.com. Inget skickades förrän du tryckte Skicka.' } }
    if (id === 'ark-avbryt') return tips({ ...l, ark: undefined }, 'Avbrutet', 'Inget skickades. Tryck Skicka på raden igen.')
    return null
  }
  if (l.val) {
    if (id === 'val-kund') return tips({ ...l, val: undefined, ark: l.val }, 'Skicka till kund?', 'Kontrollera adressen. Stämmer den: tryck Skicka.')
    if (id === 'val-mig') return fel('Till mig går till din egen e-post. Kunden ska ha rapporten, tryck Till kunden.')
    if (id === 'val-stang') return tips({ ...l, val: undefined }, 'Stängt', 'Inget skickades.')
    return null
  }
  if (id === 'period:90' || id === 'period:365') return tips({ ...l, period: id === 'period:90' ? '90' : '365' }, 'Längre period', 'Nu syns september också. Leta upp Exempel AB.')
  if (id === 'period:30') return tips({ ...l, period: '30' }, '30 dagar', 'Besöket i september är äldre än 30 dagar. Välj 90 dagar.')
  if (id === 'sok') return tips({ ...l, sok: 'Exempel AB', vald: 'exab' }, 'Sökt', l.period === '30' ? 'Inga träffar. Besöket var i september, äldre än 30 dagar. Välj 90 dagar.' : 'Bara Exempel AB syns. Tryck Skicka på raden.')
  if (id === 'typ') return fel('Alla typer räcker här. Det som döljer ärendet är perioden.')
  if (id.startsWith('rad:')) return tips({ ...l, vald: id.slice(4) }, 'Vald', 'Panelen till höger visar rapporten för raden.')
  if (id === 'skicka:exab') return tips({ ...l, val: 'exab' }, 'Skicka rapporten', 'Välj vem som ska få rapporten.')
  if (id.startsWith('skicka:') || id.startsWith('ladda:')) {
    if (id === 'ladda:exab') return fel('Ladda ned ger dig PDF:en, men kunden får inget. Tryck Skicka på raden.')
    return fel('Det är fel ärende. Uppdraget gäller Exempel AB i september.')
  }
  // Panelen visar den valda raden, annars den första som syns (som i portalen)
  const synliga = manader(l).flatMap(m => m.rader)
  const valt = (synliga.find(r => r.id === l.vald) ?? synliga[0])?.id
  if (id === 'panel-skicka') {
    if (valt !== 'exab') return fel('Panelen visar ett annat ärende. Tryck på raden för Exempel AB först.')
    return tips({ ...l, ark: 'exab' }, 'Skicka till kund?', 'Kontrollera adressen. Stämmer den: tryck Skicka.')
  }
  if (id === 'panel-mig') return fel('Skicka till mig går till din egen e-post. Kunden ska ha rapporten.')
  if (id === 'panel-pdf') return fel('Ladda ned PDF ger dig filen, men kunden får inget.')
  if (id === 'panel-adress') return fel('Adressen stämmer redan. Du behöver bara ändra den om rapporten ska till någon annan.')
  if (id === 'panel-oppna') return fel('Du behöver inte öppna ärendet. Rapporten skickar du härifrån.')
  return fel(l.period === '30' ? 'Besöket var i september. Välj 90 dagar överst.' : 'Tryck Skicka på raden för Exempel AB.')
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)

  const tryck = (id: string) => {
    if (klar) return
    const r = ovningTryck(l, id, enhet)
    if (!r) return
    if (r.lage) setL(r.lage)
    if (r.svar.typ === 'fel') setFel(f => f + 1)
    if (r.svar.typ === 'ok') {
      setKlar(true)
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `${r.svar.text}${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` })
      return
    }
    setSvar(r.svar)
  }

  const framsteg = klar ? 5 : l.ark ? 4 : l.val ? 3 : l.vy === 'rapporter' ? (l.period === '30' ? 1 : 2) : l.vy === 'mer' ? 1 : 0
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} bred={enhet === 'dator'}
      onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0); setKlar(false) }}>
      <Skarm l={l} nr={0} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
