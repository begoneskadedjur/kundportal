// src/pages/shared/intranet/guider/guide-sokrutan-saljare.tsx
// Guidemodul: Hitta en kund och skapa en offert med sökrutan (säljare, dator).
// Knappen Sök i systemet... med Ctrl+K i SäljareTopHeader öppnar GlobalSearch med portal säljare.
// RPC:n global_search ger säljaren kunder, offerter och avtal och webbleads, inga ärenden,
// tekniker eller fakturor. Den tomma lådan har åtgärderna Ny lead, Ny offert, Nytt avtal och
// Rapportera tillbud (baseActions). Kunden får Kundkort, Stationer, Ny offert och Nytt avtal
// (customerItem), och Ny offert öppnar offertguiden med kunden ifylld (openOneflowCreator).
// Påhittade kunder, ingenting söks på riktigt.

import { useState } from 'react'
import { Ark, Dator, DatorSida, Markor, OvningRam, Rad, type MarkorProps, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { SCOPE_TEXT, SokLada, type SokGrupp } from './_sok'

const TELEFON = '08-123 456 78'
const MENY = ['Översikt', 'Skapa Avtal & Offerter', 'Dokumentsignering', 'Befintliga kunder', 'Leads (B2B)', 'Leads (Webb)']

/** Tom söklåda: Senast öppnade och säljarens fasta åtgärder (baseActions) */
const TOM: SokGrupp[] = [
  { key: 'recent', rader: [
    { id: 'senast', ikon: 'kund-foretag', ton: 'kund', titel: 'Brf Exempelgården', meta: '769600-1234 · kundnr 1077', typ: 'Kund', val: ['Öppna'] },
  ] },
  { key: 'actions', rader: [
    { id: 'a-lead', ikon: 'atgard', ton: 'atgard', titel: 'Ny lead', meta: 'Lägger upp en ny B2B-lead', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-offert-tom', ikon: 'atgard', ton: 'atgard', titel: 'Ny offert', meta: 'Öppnar offertguiden', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-avtal-tom', ikon: 'atgard', ton: 'atgard', titel: 'Nytt avtal', meta: 'Öppnar avtalsguiden', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-tillbud', ikon: 'atgard', ton: 'atgard', titel: 'Rapportera tillbud', meta: 'Tillbud, avvikelse eller olycka', typ: 'Åtgärd', val: ['Öppna'] },
  ] },
]

/** Träffar på telefonnumret: kunden, den gamla offerten och åtgärderna */
const TRAFFAR: SokGrupp[] = [
  { key: 'customers', rader: [
    { id: 'kund', ikon: 'kund-foretag', ton: 'kund', titel: 'Exempel AB', meta: '556677-8899 · kundnr 1042', typ: 'Kund', val: ['Kundkort', 'Stationer', 'Ny offert', 'Nytt avtal'] },
  ] },
  { key: 'documents', rader: [
    { id: 'dok', ikon: 'offert', ton: 'offert', titel: 'Exempel AB', status: { text: 'Avböjd', ton: 'faint' }, meta: '12 500 kr · 2026-09-02', typ: 'Offert', val: ['Öppna'] },
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
    <Dator adress={klar ? 'saljare › oneflow-contract-creator' : 'saljare › översikt'}>
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
      <DatorSida meny={MENY} aktiv={klar ? 'Skapa Avtal & Offerter' : 'Översikt'} titel={klar ? 'Skapa Avtal & Offerter' : 'Översikt'}>
        {klar ? (
          <div className="h-40" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {['Mina leads', 'Offerter att följa upp', 'Nya webbleads'].map(t => (
              <button key={t} type="button" onClick={() => tryck('kort')} className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 text-left text-[12px] text-slate-300">{t}</button>
            ))}
          </div>
        )}
      </DatorSida>
      {(vy === 'tom' || vy === 'traff') && (
        <SokLada mobil={false} fraga={vy === 'traff' ? TELEFON : ''} tolkas={vy === 'traff' ? 'phone' : undefined}
          grupper={vy === 'traff' ? TRAFFAR : TOM} aktiv={vy === 'traff' ? aktiv : undefined}
          tryck={tryck} onHover={onHover} mk={m} scope={SCOPE_TEXT.säljare} />
      )}
      {klar && (
        <Ark titel="Ny offert" under="Exempel AB · 556677-8899">
          <Rad v="Företag" h="Exempel AB" />
          <Rad v="Org.nr" h="556677-8899" />
          <Rad v="Fortsätt i offertguiden som vanligt." />
        </Ark>
      )}
    </Dator>
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; aktiv?: string; markera: string }[] = [
  { vy: 'sida', markera: 'sok' },
  { vy: 'tom', markera: 'falt' },
  { vy: 'traff', aktiv: 'kund', markera: 'val:kund:Ny offert' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} aktiv={v.aktiv} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Exempel AB ringer från 08-123 456 78 och vill ha en ny offert. Öppna sökrutan.' }

const TIPS: Record<string, string> = {
  kort: 'Översikten visar ditt läge. Det går snabbare med sökrutan högst upp, eller Ctrl+K.',
  'rad:senast': 'Det är Brf Exempelgården som du öppnade senast. Skriv telefonnumret i fältet.',
  'rad:a-lead': 'Ny lead lägger upp en ny lead. Exempel AB är redan kund. Skriv telefonnumret i fältet.',
  'rad:a-offert-tom': 'Det fungerar, men då är offerten tom. Sök på numret först, så kommer kunden med.',
  'rad:a-avtal-tom': 'Kunden vill ha en offert, inget avtal. Sök på numret först.',
  'rad:a-tillbud': 'Det är för tillbud och olyckor. Skriv telefonnumret i fältet.',
  guide: 'Den länken leder hit, till guiden. Skriv telefonnumret i fältet.',
  'rad:kund': 'Ett tryck på raden öppnar kundkortet. Välj snabbvalet Ny offert under raden i stället.',
  'val:kund:Kundkort': 'Kundkortet visar kunden. Uppdraget var en ny offert.',
  'val:kund:Stationer': 'Stationerna hör till kunden. Uppdraget var en ny offert.',
  'val:kund:Nytt avtal': 'Kunden vill ha en offert, inget avtal.',
  'rad:dok': 'Det är den gamla offerten från 2026-09-02, som kunden avböjde. Uppdraget var en ny offert.',
  'rad:a-avtal': 'Kunden vill ha en offert, inget avtal.',
}

function Ovning() {
  const [vy, setVy] = useState<Vy>('sida')
  const [aktiv, setAktiv] = useState('kund')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const klart = () => {
    setVy('klart')
    setSvar({
      typ: 'ok',
      titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
      text: `Offertguiden öppnades med Exempel AB och org.nr ifyllda. Nu fortsätter du som vanligt.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
    })
  }
  const flytta = (steg: number) => {
    const i = Math.max(0, Math.min(ORDNING.length - 1, ORDNING.indexOf(aktiv) + steg))
    setAktiv(ORDNING[i])
  }

  const tryck = (id: string) => {
    if (vy === 'klart') return
    if (id === 'stang') { setVy('sida'); setAktiv('kund'); miss('Esc stänger sökrutan och det du skrev försvinner. Öppna den igen.'); return }
    if (vy === 'sida') {
      if (id === 'sok') { setVy('tom'); tips('Sökrutan är öppen', 'Ctrl+K öppnar den också. Tryck i fältet och skriv numret.') }
      else miss(TIPS[id] ?? 'Sökrutan finns högst upp på sidan.')
    } else if (vy === 'tom') {
      if (id === 'falt') { setVy('traff'); setAktiv('kund'); tips(`Du skrev ${TELEFON}`, 'Till höger står tolkas som telefonnummer. Kunden Exempel AB är markerad och snabbvalen syns under raden.') }
      else miss(TIPS[id] ?? 'Tryck i fältet och skriv telefonnumret.')
    } else if (id === 'pil-ner') flytta(1)
    else if (id === 'pil-upp') flytta(-1)
    else if (id === 'falt') tips('Numret står redan där', 'Titta på träffarna. Kunden Exempel AB har snabbvalet Ny offert.')
    else if (id === 'val:kund:Ny offert' || id === 'rad:a-offert') klart()
    else miss(TIPS[id] ?? 'Markera kunden och välj Ny offert.')
  }

  const onHover = (id: string) => {
    if (vy !== 'traff' || id === aktiv) return
    setAktiv(id)
  }

  const framsteg = vy === 'sida' ? 0 : vy === 'tom' ? 1 : vy === 'klart' ? 3 : 2
  return (
    <OvningRam bred framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={() => { setVy('sida'); setAktiv('kund'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} aktiv={aktiv} tryck={tryck} onHover={onHover} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
