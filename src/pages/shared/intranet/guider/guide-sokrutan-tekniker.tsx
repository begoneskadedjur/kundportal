// src/pages/shared/intranet/guider/guide-sokrutan-tekniker.tsx
// Guidemodul: Hitta ett ärende eller en kund med sökrutan (tekniker, telefon).
// Förstoringsglaset i TechnicianMobileNav (aria-label Sök) öppnar GlobalSearch i helskärm.
// Telefonnummer tolkas som telefonnummer (classifyQuery), tolkningen står under fältet i
// mobilen och ett tryck på raden kör huvudvalet Öppna. Teknikern ser bara sina egna ärenden
// (RPC global_search, omfånget technician). Påhittade kunder, ingenting söks på riktigt.

import { useState } from 'react'
import { ArendeHuvud, Flikar, IkonKnapp, Kort, Markor, OvningRam, Rad, Status, Telefon, type MarkorProps, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { SCOPE_TEXT, SokLada, type SokGrupp } from './_sok'

const TELEFON = '070-123 45 67'

/** Tom söklåda: Senast öppnade och teknikerns fasta åtgärder (baseActions, technician) */
const TOM: SokGrupp[] = [
  { key: 'recent', rader: [
    { id: 'senast', ikon: 'arende', ton: 'arende', titel: 'Exempel AB', nr: 'BE-0001190', meta: '2026-10-15 · Anna Exempel', typ: 'Ärende', val: ['Öppna'] },
  ] },
  { key: 'actions', rader: [
    { id: 'a-offert', ikon: 'atgard', ton: 'atgard', titel: 'Skapa offert', meta: 'Öppnar offertguiden', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-avtal', ikon: 'atgard', ton: 'atgard', titel: 'Skapa avtal', meta: 'Öppnar avtalsguiden', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-tillbud', ikon: 'atgard', ton: 'atgard', titel: 'Rapportera tillbud', meta: 'Tillbud, avvikelse eller olycka', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'a-schema', ikon: 'atgard', ton: 'atgard', titel: 'Mitt schema', meta: 'Dina bokade besök', typ: 'Åtgärd', val: ['Öppna'] },
  ] },
]

/** Träffar på telefonnumret: två ärenden hos samma kund, det bokade först */
const TRAFFAR: SokGrupp[] = [
  { key: 'cases', rader: [
    { id: 'bokat', ikon: 'arende', ton: 'arende', titel: 'Familjen Exempel', nr: 'BE-0001234', status: { text: 'Bokad', ton: 'info' }, meta: '2026-10-20 08:00 · Anna Exempel', typ: 'Ärende', val: ['Öppna'] },
    { id: 'gammalt', ikon: 'arende', ton: 'arende', titel: 'Familjen Exempel', nr: 'BE-0000987', status: { text: 'Avslutat', ton: 'ok' }, meta: '2026-06-15 · Anna Exempel', typ: 'Ärende', val: ['Öppna'] },
  ] },
]

type Vy = 'start' | 'tom' | 'traff' | 'klart'

const mk = (markera: string | undefined, nr: number) => (id: string): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

/** Notisklockan i telefonens överdel. Ritad här, ikonstandarden saknar en klocka (24, streck 1,6). */
function Klocka({ onClick, markor }: { onClick: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} aria-label="Notifieringar" title="Notifieringar"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6.5 1.8 6.5H4.2S6 14 6 9.5Z" />
          <path d="M10 19.5a2 2 0 0 0 4 0" />
        </svg>
      </button>
    </Markor>
  )
}

/** Mina ärenden i telefonen med portalens överdel: BG, förstoringsglaset, klockan och menyn */
function Start({ tryck, m }: { tryck: (id: string) => void; m: (id: string) => MarkorProps | undefined }) {
  return (
    <>
      <div className="flex h-12 items-center justify-between border-b border-slate-700/50 px-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-[10px] font-bold text-[#fff]">BG</span>
          <span className="text-sm font-semibold text-white">BeGone</span>
        </div>
        <div className="flex items-center">
          <IkonKnapp ikon="allman.sok" etikett="Sök" onClick={() => tryck('glas')} markor={m('glas')} />
          <Klocka onClick={() => tryck('klocka')} />
          <IkonKnapp ikon="allman.meny" etikett="Meny" onClick={() => tryck('meny')} />
        </div>
      </div>
      <p className="px-3.5 pt-3 text-base font-bold text-white">Mina ärenden</p>
      {['Exempel AB · Getingar', 'Brf Exempelgården · Möss', 'Exempel Bygg AB · Myror'].map((t, i) => (
        <button key={t} type="button" onClick={() => tryck('lista')} className="mx-2.5 mt-2 grid w-[calc(100%-20px)] gap-0.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5 text-left">
          <span className="font-mono text-[11px] text-slate-400">BE-000{1301 + i * 7}</span>
          <span className="text-[12.5px] text-white">{t}</span>
          <Status text={i === 0 ? 'Bokad' : 'Öppen'} farg={i === 0 ? 'bg-sky-400' : 'bg-amber-400'} />
        </button>
      ))}
      <div className="absolute inset-x-0 bottom-0 flex justify-around border-t border-slate-700/50 bg-slate-900 py-2 text-[10.5px] text-slate-400" aria-hidden>
        {['Hem', 'Ärenden', 'Schema', 'Provision'].map(t => <span key={t} className={t === 'Ärenden' ? 'text-[#20c58f]' : ''}>{t}</span>)}
      </div>
    </>
  )
}

/** Ärendet som öppnas när man trycker på träffen */
function Oppnat() {
  return (
    <>
      <ArendeHuvud nr="BE-0001234" status={<Status text="Bokad" farg="bg-sky-400" />} kund="Familjen Exempel · Exempelvägen 4, Södertälje" />
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} />
      <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Tisdag 2026-10-20, 08:00 till 09:00" /></Kort>
      <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Råttor i källaren, spår vid tvättstugan." /></Kort>
    </>
  )
}

function Skarm({ vy, tryck, markera, nr }: { vy: Vy; tryck: (id: string) => void; markera?: string; nr: number }) {
  const m = mk(markera, nr)
  return (
    <Telefon>
      {vy === 'klart' ? <Oppnat /> : <Start tryck={tryck} m={m} />}
      {(vy === 'tom' || vy === 'traff') && (
        <SokLada mobil fraga={vy === 'traff' ? TELEFON : ''} tolkas={vy === 'traff' ? 'phone' : undefined}
          grupper={vy === 'traff' ? TRAFFAR : TOM}
          tryck={tryck} mk={m} scope={SCOPE_TEXT.technician} />
      )}
    </Telefon>
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'start', markera: 'glas' },
  { vy: 'tom', markera: 'falt' },
  { vy: 'traff', markera: 'rad:bokat' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Kunden ringer och du har bara telefonnumret. Öppna sökrutan.' }

const TIPS: Record<string, string> = {
  klocka: 'Klockan är notiserna. Sökrutan öppnar du med förstoringsglaset.',
  meny: 'Menyn har sidorna i portalen. Det går snabbare med förstoringsglaset bredvid.',
  lista: 'Familjen Exempel syns inte i listan. Sök i stället, förstoringsglaset uppe till höger.',
  'rad:senast': 'Det är Exempel AB som du öppnade i går. Skriv telefonnumret i fältet i stället.',
  'rad:a-offert': 'Åtgärderna skapar något nytt. Du ska hitta ett ärende som redan finns. Skriv i fältet.',
  'rad:a-avtal': 'Åtgärderna skapar något nytt. Du ska hitta ett ärende som redan finns. Skriv i fältet.',
  'rad:a-tillbud': 'Det är för tillbud och olyckor. Skriv telefonnumret i fältet.',
  'rad:a-schema': 'Schemat visar alla dina besök. Snabbare: skriv telefonnumret i fältet.',
  guide: 'Den länken leder hit, till guiden. Skriv telefonnumret i fältet.',
  'rad:gammalt': 'Det är det gamla ärendet från juni, status Avslutat. Kunden ringer om besöket på tisdag.',
}

function Ovning() {
  const [vy, setVy] = useState<Vy>('start')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (vy === 'klart') return
    if (id === 'stang') { setVy('start'); miss('Stäng stänger sökrutan och det du skrev försvinner. Öppna den igen med förstoringsglaset.'); return }
    if (vy === 'start') {
      if (id === 'glas') { setVy('tom'); tips('Sökrutan är öppen', 'Du ser det du öppnade senast och några åtgärder. Tryck i fältet och skriv numret.') }
      else miss(TIPS[id] ?? 'Leta efter förstoringsglaset uppe till höger.')
    } else if (vy === 'tom') {
      if (id === 'falt') { setVy('traff'); tips(`Du skrev ${TELEFON}`, 'Under fältet står tolkas som telefonnummer. Två ärenden har samma nummer. Vilket ringer kunden om?') }
      else miss(TIPS[id] ?? 'Tryck i fältet och skriv telefonnumret.')
    } else if (id === 'rad:bokat') {
      setVy('klart')
      setSvar({
        typ: 'ok',
        titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
        text: `Ärendet BE-0001234 öppnades under Mina ärenden. Besöket är tisdag 2026-10-20 klockan 08:00. Nästa gång ligger ärendet överst under Senast öppnade.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
      })
    } else if (id === 'falt') tips('Numret står redan där', 'Titta på träffarna under Ärenden och välj rätt.')
    else miss(TIPS[id] ?? 'Välj ärendet som är bokat på tisdag.')
  }

  const framsteg = vy === 'start' ? 0 : vy === 'tom' ? 1 : vy === 'traff' ? 2 : 3
  return (
    <OvningRam framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={() => { setVy('start'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
