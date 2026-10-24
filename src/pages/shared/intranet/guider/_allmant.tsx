// src/pages/shared/intranet/guider/_allmant.tsx
// Delade hjälpdelar för de allmänna guiderna (roller och vyer, tillbud, menyerna i Tickets).
// Efterbildningar av portalens menyer och sidor. Etiketterna är exakt samma ord som i:
//   TechnicianMobileNav, technicianNavConfig, coordinatorNavConfig, CoordinatorSidebar,
//   CoordinatorTopHeader, ViewSwitcher, ReportIncidentButton, IntranetLink, ChangelogLink,
//   ProfileLink och IncidentsPage. Skärmarna för Tickets ligger i _fragor.tsx.
//
// Lokala ikoner (pratbubbla, klocka, meny med streck, hus, svarspil, hemskärm, mynt)
// finns inte i ikonbiblioteket ännu. De ritas här enligt ikonstandarden:
// 24 x 24, streck 1,6, currentColor, rundade ändar.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { Markor, Status, type MarkorProps } from '../skarmkit'

// ─── Markör ────────────────────────────────────────

/** Markör bara på det element som är steg nr i visningen */
export const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

/** Gemensamma props för skärmar som ritar markörer och tar emot tryck */
export interface SkarmProps {
  tryck: (id: string) => void
  markera?: string
  nr: number
}

// ─── Lokala ikoner ─────────────────────────────────

export type LokalIkonNamn = 'prat' | 'notis' | 'streckmeny' | 'hem' | 'svara' | 'hemskarm' | 'mynt'

const LOKALA: Record<LokalIkonNamn, ReactNode> = {
  // Pratbubbla (portalens Öppna kommunikation)
  prat: <path d="M20.5 15a2 2 0 0 1-2 2H8.5l-5 3.8V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />,
  // Klocka med kläpp (Notifieringar)
  notis: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  // Tre streck (Meny)
  streckmeny: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  // Hus (Hem)
  hem: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>,
  // Svarspil (Svara, Svarar)
  svara: <><path d="M5 4.5v6a4 4 0 0 0 4 4h10.5" /><path d="m15.5 10.5 4 4-4 4" /></>,
  // Ruta med plus (Lägg till på hemskärmen)
  hemskarm: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  // Mynt (Provision)
  mynt: <><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.3c-.5-.8-1.5-1.3-2.6-1.3-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2.1-.5-2.6-1.3M12 6.5v11" /></>,
}

export function LokalIkon({ namn, size = 20, className }: { namn: LokalIkonNamn; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {LOKALA[namn]}
    </svg>
  )
}

/** En ikon ur biblioteket eller en lokal ikon */
export type NagonIkon = { bib: IconName } | { lokal: LokalIkonNamn }

export function NIkon({ ikon, size = 20, className }: { ikon: NagonIkon; size?: 16 | 20 | 24; className?: string }) {
  return 'bib' in ikon
    ? <Icon name={ikon.bib} size={size} className={className} />
    : <LokalIkon namn={ikon.lokal} size={size} className={className} />
}

/** Ikonknapp med lokal ikon, samma utseende som skärmkitets IkonKnapp. siffra = röd räknare. */
export function LokalIkonKnapp({ ikon, etikett, onClick, markor, siffra }: {
  ikon: LokalIkonNamn; etikett: string; onClick?: () => void; markor?: MarkorProps; siffra?: number
}) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} aria-label={etikett} title={etikett}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <LokalIkon namn={ikon} size={20} />
        {!!siffra && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-[#fff]">{siffra}</span>
        )}
      </button>
    </Markor>
  )
}

// ─── Gemensamma delar ──────────────────────────────

/** Den gula knappen i menyerna (ReportIncidentButton) */
export function GulKnapp({ onClick, markor }: { onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-[12px] font-medium leading-snug text-amber-400 hover:bg-amber-500/20">
        <Icon name="rapport.avvikelse" size={16} className="flex-none" />
        Rapportera tillbud, avvikelse eller olycka
      </button>
    </Markor>
  )
}

/** Vyväxlaren (ViewSwitcher): segment där den aktiva vyn är grön */
export function VyVaxlare({ vyer, aktiv, tryck, markera, nr, stor }: SkarmProps & { vyer: string[]; aktiv: string; stor?: boolean }) {
  return (
    <div role="tablist" aria-label="Byt vy" className={`flex rounded-lg border border-slate-700/60 bg-slate-800/80 p-0.5 ${stor ? 'w-full' : ''}`}>
      {vyer.map(v => (
        <Markor key={v} markor={mk(markera, `vy-${v}`, nr)} block={stor}>
          <button type="button" role="tab" aria-selected={v === aktiv} onClick={() => tryck(`vy-${v}`)}
            className={`w-full whitespace-nowrap rounded-md px-2.5 font-medium ${stor ? 'py-1.5 text-[12.5px]' : 'py-1 text-[11px]'} ${v === aktiv ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'}`}>
            {v}
          </button>
        </Markor>
      ))}
    </div>
  )
}

/** Rad i en meny: ikon och text */
function MenyRad({ ikon, text, onClick, markor, aktiv, liten }: {
  ikon?: NagonIkon; text: string; onClick: () => void; markor?: MarkorProps; aktiv?: boolean; liten?: boolean
}) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left ${liten ? 'py-1 text-[11.5px]' : 'py-1.5 text-[12.5px]'} ${aktiv ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}>
        {ikon && <NIkon ikon={ikon} size={16} className="flex-none" />}
        <span className="min-w-0 truncate">{text}</span>
      </button>
    </Markor>
  )
}

/** Grupp i menyn som fälls ut när man trycker på den (SidebarNavGroup, MobileNavGroup) */
function MenyGrupp({ grupp, oppen, aktivPost, tryck, markera, nr, liten }: SkarmProps & {
  grupp: MenyGruppData; oppen: boolean; aktivPost?: string; liten?: boolean
}) {
  return (
    <div>
      <Markor markor={mk(markera, `grupp-${grupp.label}`, nr)} block>
        <button type="button" onClick={() => tryck(`grupp-${grupp.label}`)}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider ${oppen ? 'text-teal-400/80' : 'text-slate-500 hover:text-slate-300'}`}>
          {grupp.label}
          <Icon name="allman.chevron" size={16} className={`h-3 w-3 transition-transform ${oppen ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </Markor>
      {oppen && (
        <div className="grid gap-0.5 pl-1">
          {grupp.items.map(p => (
            <MenyRad key={p} text={p} liten={liten} aktiv={p === aktivPost} onClick={() => tryck(`post-${p}`)} markor={mk(markera, `post-${p}`, nr)} />
          ))}
        </div>
      )}
    </div>
  )
}

export interface MenyGruppData { label: string; items: string[] }

// ─── Teknikern i telefonen ─────────────────────────

/** Grupperna i teknikerns meny (technicianNavConfig) */
export const TEKNIKER_GRUPPER: MenyGruppData[] = [
  { label: 'Ärenden & Fält', items: ['Mina ärenden', 'Schema', 'Specialrapporter', 'Utrustning', 'Tickets'] },
  { label: 'Försäljning', items: ['Mina leads och tips', 'Skapa Avtal & Offerter', 'Dokumentsignering', 'Min Kundresa'] },
  { label: 'Verktyg', items: ['AI Assistent', 'Provisioner', 'Tillbud och avvikelser'] },
]

/** Teknikerns sidhuvud i telefonen: BeGone, Sök, Notifieringar och Meny */
export function TeknikerHuvud({ tryck, markera, nr, siffra }: SkarmProps & { siffra?: number }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-slate-700/50 bg-slate-900/95 px-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-[10px] font-bold text-[#fff]">BG</span>
        <span className="text-[13px] font-semibold text-white">BeGone</span>
      </div>
      <div className="flex items-center">
        <button type="button" onClick={() => tryck('sok')} aria-label="Sök" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400">
          <Icon name="allman.sok" size={20} />
        </button>
        <LokalIkonKnapp ikon="notis" etikett="Notifieringar" siffra={siffra} onClick={() => tryck('notis')} markor={mk(markera, 'notis', nr)} />
        <LokalIkonKnapp ikon="streckmeny" etikett="Meny" onClick={() => tryck('meny')} markor={mk(markera, 'meny', nr)} />
      </div>
    </div>
  )
}

/** Teknikerns bottenrad: Hem, Ärenden, Schema, Provision och Mer */
export function TeknikerBotten({ tryck, markera, nr, aktiv }: SkarmProps & { aktiv?: string }) {
  const poster: { id: string; text: string; ikon: NagonIkon }[] = [
    { id: 'hem', text: 'Hem', ikon: { lokal: 'hem' } },
    { id: 'arenden', text: 'Ärenden', ikon: { bib: 'arende.arende' } },
    { id: 'schema', text: 'Schema', ikon: { bib: 'allman.kalender' } },
    { id: 'provision', text: 'Provision', ikon: { lokal: 'mynt' } },
    { id: 'mer', text: 'Mer', ikon: { lokal: 'streckmeny' } },
  ]
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex h-12 items-center justify-around border-t border-slate-700/50 bg-slate-900/95">
      {poster.map(p => (
        <Markor key={p.id} markor={mk(markera, p.id, nr)}>
          <button type="button" onClick={() => tryck(p.id)}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-1 ${aktiv === p.id ? 'text-[#20c58f]' : 'text-slate-500'}`}>
            <NIkon ikon={p.ikon} size={20} />
            <span className="text-[10px] font-medium">{p.text}</span>
          </button>
        </Markor>
      ))}
    </div>
  )
}

/**
 * Teknikerns utfällda meny (TechnicianMobileNav): växlaren överst om man har
 * flera roller, Översikt, grupperna, den gula knappen och länkarna längst ner.
 * kortaBotten = visa bara nedre delen, som när man har bläddrat ner.
 */
export function TeknikerMeny({ tryck, markera, nr, oppen, vyer, aktivVy = 'Tekniker', nedre }: SkarmProps & {
  oppen?: string; vyer?: string[]; aktivVy?: string; nedre?: boolean
}) {
  return (
    <div className="absolute bottom-12 right-0 top-11 z-20 flex w-full">
      <div className="flex-1 bg-black/60" aria-hidden onClick={() => tryck('utanfor')} />
      <nav className="grid w-[230px] flex-none content-start gap-1 overflow-hidden border-l border-slate-700/50 bg-slate-900 p-2.5">
        {!nedre && <>
          {vyer && vyer.length > 1 && <>
            <VyVaxlare vyer={vyer} aktiv={aktivVy} tryck={tryck} markera={markera} nr={nr} stor />
            <div className="my-1 h-px bg-slate-700/50" />
          </>}
          <MenyRad ikon={{ lokal: 'hem' }} text="Översikt" onClick={() => tryck('post-Översikt')} markor={mk(markera, 'post-Översikt', nr)} />
          <div className="my-1 h-px bg-slate-700/50" />
          {TEKNIKER_GRUPPER.map(g => (
            <MenyGrupp key={g.label} grupp={g} oppen={oppen === g.label} tryck={tryck} markera={markera} nr={nr} liten />
          ))}
          <div className="my-1 h-px bg-slate-700/50" />
        </>}
        {nedre && <p className="px-1 pb-1 text-[10.5px] text-slate-500">Längst ner i menyn</p>}
        <GulKnapp onClick={() => tryck('gul')} markor={mk(markera, 'gul', nr)} />
        <MenyRad ikon={{ bib: 'guide.las-ocksa' }} text="Intranät & Hjälpcenter" onClick={() => tryck('intranat')} markor={mk(markera, 'intranat', nr)} />
        <MenyRad ikon={{ bib: 'allman.historik' }} text="Uppdateringar" onClick={() => tryck('uppdateringar')} markor={mk(markera, 'uppdateringar', nr)} />
        <MenyRad ikon={{ bib: 'rapport.person' }} text="Mitt konto" onClick={() => tryck('mitt-konto')} markor={mk(markera, 'mitt-konto', nr)} />
        {nedre && <>
          <MenyRad ikon={{ bib: 'rapport.avvikelse' }} text="Rapportera bugg" onClick={() => tryck('bugg')} />
          <MenyRad ikon={{ bib: 'allman.logga-ut' }} text="Logga ut" onClick={() => tryck('logga-ut')} />
        </>}
      </nav>
    </div>
  )
}

// ─── Kontoret på datorn ────────────────────────────

/** Grupperna i koordinatorns sidomeny (coordinatorNavConfig). Planering och Kunder & Avtal är öppna från början (pinned). */
export const KOORD_GRUPPER: MenyGruppData[] = [
  { label: 'Planering', items: ['Ärenden', 'Specialrapporter', 'Ordlistan', 'Rondering & Schema', 'Schemaoptimerare', 'Tickets', 'Tillbud och avvikelser'] },
  { label: 'Kunder & Avtal', items: ['Befintliga kunder', 'Trafikljusöversikt', 'Kundprognos', 'Användarkonton (Kund)'] },
  { label: 'Försäljning', items: ['Försäljningspipeline', 'Försäljningsmöjligheter', 'Leads (B2B)', 'Leads (Webb)', 'Dokumentsignering'] },
  { label: 'Fakturering', items: ['Fakturering'] },
]

/**
 * Koordinatorns sida på datorn: sidomeny till vänster och sidhuvud med Sök,
 * Notifieringar och vyväxlaren. Innehållet ritas till höger.
 */
export function KontorSida({ sida, tryck, markera, nr, oppna = [], aktivPost, vyer = ['Koordinator', 'Tekniker'], aktivVy = 'Koordinator', siffra, children }: SkarmProps & {
  sida: string; oppna?: string[]; aktivPost?: string; vyer?: string[]; aktivVy?: string; siffra?: number; children: ReactNode
}) {
  const oppnaGrupper = new Set(['Planering', 'Kunder & Avtal', ...oppna])
  return (
    <div className="flex min-h-[420px]">
      <nav className="grid w-[168px] flex-none content-start gap-1 border-r border-slate-700 bg-slate-950/40 p-2">
        <div className="flex items-center gap-2 px-1 pb-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-[11px] font-bold text-[#fff]">A</span>
          <span className="min-w-0">
            <span className="block truncate text-[11.5px] font-semibold text-white">Anna Exempel</span>
          </span>
        </div>
        <button type="button" onClick={() => tryck('cta')} className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-2 py-1.5 text-[11.5px] font-semibold text-[#fff]">
          <Icon name="allman.kalender" size={16} className="h-3.5 w-3.5" />
          Öppna schema
        </button>
        <GulKnapp onClick={() => tryck('gul')} markor={mk(markera, 'gul', nr)} />
        <MenyRad ikon={{ lokal: 'hem' }} liten text="Översikt" aktiv={aktivPost === 'Översikt'} onClick={() => tryck('post-Översikt')} />
        {KOORD_GRUPPER.map(g => (
          <MenyGrupp key={g.label} grupp={g} oppen={oppnaGrupper.has(g.label)} aktivPost={aktivPost} tryck={tryck} markera={markera} nr={nr} liten />
        ))}
        <div className="my-1 h-px bg-slate-700/50" />
        <MenyRad liten ikon={{ bib: 'guide.las-ocksa' }} text="Intranät & Hjälpcenter" onClick={() => tryck('intranat')} markor={mk(markera, 'intranat', nr)} />
        <MenyRad liten ikon={{ bib: 'allman.historik' }} text="Uppdateringar" onClick={() => tryck('uppdateringar')} markor={mk(markera, 'uppdateringar', nr)} />
        <MenyRad liten ikon={{ bib: 'rapport.person' }} text="Mitt konto" aktiv={aktivPost === 'Mitt konto'} onClick={() => tryck('mitt-konto')} markor={mk(markera, 'mitt-konto', nr)} />
        <MenyRad liten ikon={{ bib: 'allman.logga-ut' }} text="Logga ut" onClick={() => tryck('logga-ut')} />
      </nav>
      <div className="relative min-w-0 flex-1">
        <div className="flex h-10 items-center justify-between gap-2 border-b border-slate-700/40 px-3">
          <span className="flex min-w-0 items-center gap-1 text-[11.5px]">
            <span className="text-slate-400">BeGone</span>
            <Icon name="allman.chevron" size={16} className="h-3 w-3 text-slate-600" />
            <span className="truncate font-medium text-white">{sida}</span>
          </span>
          <span className="flex flex-none items-center gap-1">
            <button type="button" onClick={() => tryck('sok')} aria-label="Sök"
              className="hidden items-center gap-1.5 rounded-full bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-400 ring-1 ring-slate-700/50 md:flex">
              <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" />
              Sök i systemet...
            </button>
            <LokalIkonKnapp ikon="notis" etikett="Notifieringar" siffra={siffra} onClick={() => tryck('notis')} markor={mk(markera, 'notis', nr)} />
            {vyer.length > 1 && <VyVaxlare vyer={vyer} aktiv={aktivVy} tryck={tryck} markera={markera} nr={nr} />}
          </span>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  )
}

/** Rubrik på en sida i portalen, med underrubrik och knappar till höger */
export function SidRubrik({ titel, under, ikon, knappar }: { titel: string; under?: string; ikon?: NagonIkon; knappar?: ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {ikon && <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-800 text-[#20c58f]"><NIkon ikon={ikon} size={20} /></span>}
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white">{titel}</p>
          {under && <p className="text-[11px] text-slate-400">{under}</p>}
        </div>
      </div>
      {knappar && <div className="flex flex-wrap gap-1.5">{knappar}</div>}
    </div>
  )
}

// ─── Tillbud och avvikelser ──────────────────────────

/** Typerna i formuläret (INCIDENT_TYPE_CONFIG) */
export const TILLBUD_TYPER: { id: 'tillbud' | 'olycka' | 'avvikelse'; utrop: string; label: string; text: string; farg: string; ram: string }[] = [
  { id: 'tillbud', utrop: 'Oj!', label: 'Tillbud', text: 'Det kunde ha gått illa, men ingen skadades. Nära ögat-händelse.', farg: 'text-amber-400', ram: 'border-amber-500/30 bg-amber-500/10' },
  { id: 'olycka', utrop: 'Aj!', label: 'Olycka', text: 'Någon skadades, oavsett hur lindrigt. Även stänk, klämskador, bett.', farg: 'text-red-400', ram: 'border-red-500/30 bg-red-500/10' },
  { id: 'avvikelse', utrop: 'Hmm', label: 'Avvikelse', text: 'Något avvek från rutin, process eller kvalitetskrav.', farg: 'text-blue-400', ram: 'border-blue-500/30 bg-blue-500/10' },
]

export type TillbudTyp = (typeof TILLBUD_TYPER)[number]['id']

/** Sidhuvudet på Tillbud och avvikelser med Rapportera händelse */
export function TillbudRubrik({ tryck, markera, nr, mottagare }: SkarmProps & { mottagare?: boolean }) {
  return (
    <SidRubrik titel="Tillbud och avvikelser" under="Oj eller aj? Rapportera direkt - stort som smått" ikon={{ bib: 'rapport.avvikelse' }}
      knappar={<>
        <Markor markor={mk(markera, 'ny', nr)}>
          <button type="button" onClick={() => tryck('ny')} className="flex items-center gap-1.5 rounded-lg bg-[#20c58f] px-2.5 py-1.5 text-[11.5px] font-medium text-[#fff]">
            <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />
            Rapportera händelse
          </button>
        </Markor>
        {mottagare && <button type="button" onClick={() => tryck('exportera')} className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11.5px] text-white">Exportera</button>}
      </>}
    />
  )
}

/** Formuläret Rapportera händelse (IncidentsPage). dator = typerna på en rad. */
export function TillbudFormular({ typ, beskrivning, berorda, kontorVal, dator, tryck, markera, nr }: SkarmProps & {
  typ: TillbudTyp; beskrivning: string; berorda: string[]; kontorVal?: string; dator?: boolean
}) {
  const kanSkicka = !!beskrivning && berorda.length > 0
  const etikett = 'mb-0.5 block text-[10.5px] font-medium text-slate-400'
  const falt = 'block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1.5 text-left text-[11.5px]'
  return (
    <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
          <Icon name="rapport.avvikelse" size={16} className="h-3.5 w-3.5 text-amber-400" />
          Rapportera händelse
        </p>
        <button type="button" onClick={() => tryck('stang')} aria-label="Stäng" className="text-slate-400"><Icon name="allman.stang" size={16} /></button>
      </div>
      <div className={`grid gap-1.5 ${dator ? 'grid-cols-3' : ''}`}>
        {TILLBUD_TYPER.map(t => {
          const vald = t.id === typ
          return (
            <Markor key={t.id} markor={mk(markera, `typ-${t.id}`, nr)} block>
              <button type="button" onClick={() => tryck(`typ-${t.id}`)}
                className={`w-full rounded-xl border p-1.5 text-left ${vald ? t.ram : 'border-slate-700 bg-slate-800'} ${dator ? '' : 'flex items-baseline gap-2'}`}>
                <span className={`block text-[14px] font-extrabold leading-none ${vald ? t.farg : 'text-slate-300'} ${dator ? 'mb-0.5' : 'w-9 flex-none'}`}>{t.utrop}</span>
                <span className="min-w-0">
                  <span className={`block text-[11.5px] font-semibold ${vald ? t.farg : 'text-slate-300'}`}>{t.label}</span>
                  {dator && <span className="block text-[10px] leading-snug text-slate-500">{t.text}</span>}
                </span>
              </button>
            </Markor>
          )
        })}
      </div>
      {typ === 'olycka' && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-[10.5px] text-red-300">
          Vid allvarlig olycka eller allvarligt tillbud ska arbetsgivaren utan dröjsmål anmäla till Arbetsmiljöverket. anmalarbetsskada.se
        </p>
      )}
      <div>
        <span className={etikett}>Vad har hänt? <span className="text-red-400">*</span></span>
        <Markor markor={mk(markera, 'beskrivning', nr)} block>
          <button type="button" onClick={() => tryck('beskrivning')} className={`${falt} min-h-[40px] ${beskrivning ? 'text-white' : 'text-slate-500'}`}>
            {beskrivning || 'Beskriv händelsen: vad hände, var och hur?'}
          </button>
        </Markor>
      </div>
      <div className={`grid gap-2 ${dator ? 'grid-cols-2' : ''}`}>
        <div>
          <span className={etikett}>När inträffade händelsen?</span>
          <button type="button" onClick={() => tryck('nar')} className={`${falt} text-white`}>2026-10-16 09:45</button>
        </div>
        <div>
          <span className={etikett}>Berörda anställda <span className="text-red-400">*</span></span>
          {berorda.length > 0 && <p className="mb-1 text-[11.5px] text-white">{berorda.join(', ')}</p>}
          {kontorVal !== undefined && (
            <div className="flex gap-1.5">
              <Markor markor={mk(markera, 'valj-anstalld', nr)} block>
                <button type="button" onClick={() => tryck('valj-anstalld')} className={`${falt} ${kontorVal ? 'text-white' : 'text-slate-500'}`}>
                  {kontorVal || 'Lägg till anställd...'}
                </button>
              </Markor>
              <Markor markor={mk(markera, 'lagg-till', nr)}>
                <button type="button" onClick={() => tryck('lagg-till')} aria-label="Lägg till" aria-disabled={!kontorVal}
                  className={`flex h-full items-center rounded-lg border border-slate-600 bg-slate-700 px-2 text-white ${kontorVal ? '' : 'opacity-30'}`}>
                  <Icon name="allman.plus" size={16} />
                </button>
              </Markor>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-700/50 pt-2">
        <button type="button" onClick={() => tryck('avbryt')} className="px-2 py-1 text-[11.5px] text-slate-400">Avbryt</button>
        <Markor markor={mk(markera, 'skicka', nr)}>
          <button type="button" onClick={() => tryck('skicka')} aria-disabled={!kanSkicka}
            className={`rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11.5px] font-medium text-[#fff] ${kanSkicka ? '' : 'opacity-50'}`}>
            Skicka rapport
          </button>
        </Markor>
      </div>
    </div>
  )
}

/** En rad i listan över rapporter. Typ och status som punkt och text, aldrig piller. */
export function TillbudRad({ typ, status, text, datum, onClick, markor }: {
  typ: TillbudTyp; status: string; text: string; datum: string; onClick?: () => void; markor?: MarkorProps
}) {
  const t = TILLBUD_TYPER.find(x => x.id === typ)!
  const statusFarg = status === 'Ny' ? 'bg-amber-400' : status === 'Under utredning' ? 'bg-blue-400' : status === 'Åtgärdad' ? 'bg-[#20c58f]' : 'bg-slate-500'
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick} className="grid w-full gap-0.5 border-b border-slate-700/50 px-2.5 py-1.5 text-left hover:bg-slate-700/30">
        <span className="flex items-center gap-3">
          <span className={`text-[11px] font-semibold ${t.farg}`}>{t.label}</span>
          <Status text={status} farg={statusFarg} />
          <span className="ml-auto text-[10.5px] text-slate-500">{datum}</span>
        </span>
        <span className="truncate text-[11.5px] text-white">{text}</span>
      </button>
    </Markor>
  )
}
