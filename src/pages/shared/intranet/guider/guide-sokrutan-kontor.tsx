// src/pages/shared/intranet/guider/guide-sokrutan-kontor.tsx
// Guidemodul: Hitta med sökrutan (admin och koordinator, dator).
// Knappen Sök i systemet... med Ctrl+K i CoordinatorTopHeader/AdminTopHeader öppnar GlobalSearch.
// Ett telefonnummer tolkas som telefonnummer (classifyQuery). Ärenden utan tid får snabbvalen
// Öppna och Boka in, bokade ärenden Öppna och Flytta (caseItem). Kunden får Kundkort, Stationer,
// Ny offert och Nytt avtal, och åtgärderna Ny offert till … och Nytt avtal för … (actionItems).
// Boka in öppnar schemat med ?scheduleCase=, där bokningen "Boka in: <titel>" kommer upp
// (CoordinatorSchedule + CreateCaseModal). Påhittade kunder, ingenting söks på riktigt.

import { useState } from 'react'
import { Ark, Dator, DatorSida, Markor, OvningRam, Rad, type MarkorProps, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { SCOPE_TEXT, SokLada, type SokGrupp } from './_sok'

const TELEFON = '08-123 456 78'
const MENY = ['Översikt', 'Skapa Avtal & Offerter', 'Ärenden', 'Schema & Planering', 'Befintliga kunder', 'Leads (B2B)', 'Fakturering']

/** Tom söklåda: Senast öppnade och kontorets fasta åtgärder (baseActions) */
const TOM: SokGrupp[] = [
  { key: 'recent', rader: [
    { id: 'senast', ikon: 'kund-foretag', ton: 'kund', titel: 'Brf Exempelgården', meta: '769600-1234 · kundnr 1077', typ: 'Kund', val: ['Öppna'] },
  ] },
  { key: 'actions', rader: [
    { id: 'a-nytt', ikon: 'atgard', ton: 'atgard', titel: 'Nytt ärende', meta: 'Privat, företag eller avtal', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-ledig', ikon: 'atgard', ton: 'atgard', titel: 'Hitta ledig tid', meta: 'Öppnar bokningsassistenten', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-tillbud', ikon: 'atgard', ton: 'atgard', titel: 'Rapportera tillbud', meta: 'Tillbud, avvikelse eller olycka', typ: 'Åtgärd', val: ['Öppna'] },
  ] },
]

/** Träffar på telefonnumret: det bokade ärendet först, sedan det utan tid, kunden och åtgärderna */
const TRAFFAR: SokGrupp[] = [
  { key: 'cases', rader: [
    { id: 'bokat', ikon: 'arende', ton: 'arende', titel: 'Exempel AB', nr: 'BE-0001301', status: { text: 'Bokad', ton: 'info' }, meta: '2026-10-21 09:00 · Anna Exempel', typ: 'Ärende', val: ['Öppna', 'Flytta'] },
    { id: 'otid', ikon: 'arende', ton: 'arende', titel: 'Exempel AB', nr: 'BE-0001322', status: { text: 'Öppen', ton: 'warn' }, meta: '2026-10-14', typ: 'Ärende', val: ['Öppna', 'Boka in'] },
  ] },
  { key: 'customers', rader: [
    { id: 'kund', ikon: 'kund-foretag', ton: 'kund', titel: 'Exempel AB', meta: '556677-8899 · kundnr 1042', typ: 'Kund', val: ['Kundkort', 'Stationer', 'Ny offert', 'Nytt avtal'] },
  ] },
  { key: 'actions', rader: [
    { id: 'a-offert', ikon: 'atgard', ton: 'atgard', titel: 'Ny offert till Exempel AB', meta: 'Öppnar offertguiden med kunden ifylld', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-avtal', ikon: 'atgard', ton: 'atgard', titel: 'Nytt avtal för Exempel AB', meta: 'Öppnar avtalsguiden med kunden ifylld', typ: 'Åtgärd', val: ['Öppna'] },
  ] },
]
const ORDNING = TRAFFAR.flatMap(g => g.rader.map(r => r.id))

type Vy = 'sida' | 'tom' | 'traff' | 'klart'

const mk = (markera: string | undefined, nr: number) => (id: string): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Skarm({ vy, aktiv, tryck, onHover, markera, nr }: {
  vy: Vy; aktiv?: string; tryck: (id: string) => void; onHover?: (id: string) => void; markera?: string; nr: number
}) {
  const m = mk(markera, nr)
  const klar = vy === 'klart'
  return (
    <Dator adress={klar ? 'koordinator › schema' : 'koordinator › översikt'}>
      <div className="flex items-center justify-center border-b border-slate-700/40 px-3 py-1.5">
        <Markor markor={m('sok')}>
          <button type="button" onClick={() => tryck('sok')}
            className="flex w-64 max-w-full items-center gap-2 rounded-full bg-slate-800/60 px-3 py-1.5 text-slate-400 ring-1 ring-slate-700/50">
            <Icon name="allman.sok" size={16} />
            <span className="text-[12px]">Sök i systemet...</span>
            <kbd className="ml-auto rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl+K</kbd>
          </button>
        </Markor>
      </div>
      <DatorSida meny={MENY} aktiv={klar ? 'Schema & Planering' : 'Översikt'} titel={klar ? 'Schema & Planering' : 'Översikt'}>
        {klar ? (
          <div className="grid h-56 grid-cols-5 gap-1 text-[10px] text-slate-500">
            {['Mån', 'Tis', 'Ons', 'Tor', 'Fre'].map(d => <div key={d} className="rounded border border-slate-700/60 p-1">{d}</div>)}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {['Dagens besök', 'Ärenden utan tid', 'Nya leads'].map(t => (
              <button key={t} type="button" onClick={() => tryck('kort')} className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 text-left text-[12px] text-slate-300">{t}</button>
            ))}
          </div>
        )}
      </DatorSida>
      {(vy === 'tom' || vy === 'traff') && (
        <SokLada mobil={false} fraga={vy === 'traff' ? TELEFON : ''} tolkas={vy === 'traff' ? 'phone' : undefined}
          grupper={vy === 'traff' ? TRAFFAR : TOM} aktiv={vy === 'traff' ? aktiv : undefined}
          tryck={tryck} onHover={onHover} mk={m} scope={SCOPE_TEXT.koordinator} />
      )}
      {klar && (
        <Ark titel="Boka in: Exempel AB" under="BE-0001322">
          <Rad v="Välj tekniker och tid som vanligt." />
        </Ark>
      )}
    </Dator>
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; aktiv?: string; markera: string }[] = [
  { vy: 'sida', markera: 'sok' },
  { vy: 'tom', markera: 'falt' },
  { vy: 'traff', aktiv: 'bokat', markera: 'pil-ner' },
  { vy: 'traff', aktiv: 'otid', markera: 'val:otid:Boka in' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} aktiv={v.aktiv} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Exempel AB ringer från 08-123 456 78. Öppna sökrutan.' }

const TIPS: Record<string, string> = {
  kort: 'Översikten visar dagens läge. Det går snabbare med sökrutan högst upp, eller Ctrl+K.',
  'rad:senast': 'Det är Brf Exempelgården som du öppnade senast. Skriv telefonnumret i fältet.',
  'rad:a-nytt': 'Nytt ärende skapar ett ärende till. Exempel AB har redan ett ärende som väntar på tid.',
  'rad:a-ledig': 'Bokningsassistenten letar tider, men vet inte vilket ärende det gäller. Sök på numret först.',
  'rad:a-tillbud': 'Det är för tillbud och olyckor. Skriv telefonnumret i fältet.',
  guide: 'Den länken leder hit, till guiden. Skriv telefonnumret i fältet.',
  'rad:bokat': 'Ett tryck på raden öppnar ärendet. BE-0001301 är redan bokat 2026-10-21. Markera raden under med ↓ eller musen.',
  'rad:otid': 'Ett tryck på raden öppnar ärendet. Uppdraget var att boka in. Markera raden med ↓ eller musen, så kommer snabbvalen.',
  'val:bokat:Öppna': 'Det ärendet är redan bokat 2026-10-21. Leta efter ärendet som saknar tid.',
  'val:bokat:Flytta': 'Flytta är för ett ärende som redan har tid. Leta efter ärendet som saknar tid.',
  'val:otid:Öppna': 'Öppna visar ärendet. Uppdraget var att boka in det, välj snabbvalet bredvid.',
  'rad:kund': 'Det är kunden. Uppdraget gäller ärendet som saknar tid, högre upp.',
  'val:kund:Kundkort': 'Kundkortet visar kunden. Uppdraget gäller ärendet som saknar tid.',
  'val:kund:Stationer': 'Stationerna hör till kunden. Uppdraget gäller ärendet som saknar tid.',
  'val:kund:Ny offert': 'Ingen offert behövs. Ärendet ska få en tid.',
  'val:kund:Nytt avtal': 'Inget avtal behövs. Ärendet ska få en tid.',
  'rad:a-offert': 'Ingen offert behövs. Ärendet BE-0001322 ska få en tid.',
  'rad:a-avtal': 'Inget avtal behövs. Ärendet BE-0001322 ska få en tid.',
}

function Ovning() {
  const [vy, setVy] = useState<Vy>('sida')
  const [aktiv, setAktiv] = useState('bokat')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const flytta = (steg: number) => {
    const i = Math.max(0, Math.min(ORDNING.length - 1, ORDNING.indexOf(aktiv) + steg))
    setAktiv(ORDNING[i])
    if (ORDNING[i] === 'otid') tips('Rätt rad', 'BE-0001322 saknar tid. Snabbvalen Öppna och Boka in syns under raden.')
  }

  const tryck = (id: string) => {
    if (vy === 'klart') return
    if (id === 'stang') { setVy('sida'); setAktiv('bokat'); miss('Esc stänger sökrutan och det du skrev försvinner. Öppna den igen.'); return }
    if (vy === 'sida') {
      if (id === 'sok') { setVy('tom'); tips('Sökrutan är öppen', 'Ctrl+K öppnar den också. Tryck i fältet och skriv numret.') }
      else miss(TIPS[id] ?? 'Sökrutan finns högst upp på sidan.')
    } else if (vy === 'tom') {
      if (id === 'falt') { setVy('traff'); setAktiv('bokat'); tips(`Du skrev ${TELEFON}`, 'Till höger står tolkas som telefonnummer. Två ärenden har numret. Vilket saknar tid?') }
      else miss(TIPS[id] ?? 'Tryck i fältet och skriv telefonnumret.')
    } else if (id === 'pil-ner') flytta(1)
    else if (id === 'pil-upp') flytta(-1)
    else if (id === 'falt') tips('Numret står redan där', 'Titta på träffarna och markera ärendet som saknar tid.')
    else if (id === 'val:otid:Boka in') {
      setVy('klart')
      setSvar({
        typ: 'ok',
        titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
        text: `Schemat öppnades med Boka in: Exempel AB för BE-0001322. Nu väljer du tekniker och tid som vanligt.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
      })
    } else miss(TIPS[id] ?? 'Markera ärendet som saknar tid och välj Boka in.')
  }

  const onHover = (id: string) => {
    if (vy !== 'traff' || id === aktiv) return
    setAktiv(id)
    if (id === 'otid') tips('Rätt rad', 'BE-0001322 saknar tid. Snabbvalen Öppna och Boka in syns under raden.')
  }

  const framsteg = vy === 'sida' ? 0 : vy === 'tom' ? 1 : vy === 'klart' ? 4 : aktiv === 'otid' ? 3 : 2
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setVy('sida'); setAktiv('bokat'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} aktiv={aktiv} tryck={tryck} onHover={onHover} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
