// src/components/shared/search/SearchIcons.tsx
// Söklådans egna ikoner, en per träfftyp. Ritade i den godkända skissen
// (soklada-ikoner.html) och överförda rakt som React-komponenter.
// Formen bär betydelsen, färgen kommer från familjen (SearchTone) och sätts
// av ikonplattan via currentColor.

import type { ReactNode } from 'react'

export type SearchIconName =
  | 'arende'
  | 'arende-avtal'
  | 'kund-privat'
  | 'kund-foretag'
  | 'stationer'
  | 'offert'
  | 'avtal'
  | 'lead-webb'
  | 'lead-b2b'
  | 'faktura'
  | 'tekniker'
  | 'sida'
  | 'atgard'
  | 'arkiv'
  | 'senast'

/** Färgfamilj per träfftyp. Åtgärd har ram i stället för fylld platta. */
export type SearchTone =
  | 'arende'
  | 'kund'
  | 'stn'
  | 'offert'
  | 'avtal'
  | 'lead'
  | 'faktura'
  | 'tekniker'
  | 'nav'
  | 'arkiv'
  | 'atgard'

// Tailwind-färgerna remappas i ljust tema (globals.css), så samma klass
// fungerar i båda temana. Plattan är familjens ton med låg opacitet.
const TONE_CLASSES: Record<SearchTone, string> = {
  arende: 'text-emerald-400 bg-emerald-400/15',
  kund: 'text-sky-400 bg-sky-400/15',
  stn: 'text-cyan-400 bg-cyan-400/15',
  offert: 'text-amber-400 bg-amber-400/15',
  avtal: 'text-violet-400 bg-violet-400/15',
  lead: 'text-pink-400 bg-pink-400/15',
  faktura: 'text-slate-400 bg-slate-400/15',
  tekniker: 'text-orange-400 bg-orange-400/15',
  nav: 'text-slate-400 bg-slate-400/10',
  arkiv: 'text-slate-500 bg-slate-500/15',
  atgard: 'text-[#20c58f] bg-transparent ring-[1.5px] ring-inset ring-[#20c58f]/55',
}

const PATHS: Record<SearchIconName, ReactNode> = {
  // Ärende: protokollet med skadedjuret på
  arende: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <ellipse cx="12" cy="14.6" rx="2.2" ry="3" />
      <circle cx="12" cy="10.4" r="1" />
      <path d="M9.8 13l-1.6-.9M9.8 14.8H8M9.9 16.6l-1.6.9M14.2 13l1.6-.9M14.2 14.8H16M14.1 16.6l1.6.9" />
    </>
  ),
  // Avtalsärende: protokollet med återkommande pil
  'arende-avtal': (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M15.2 13.8a3.2 3.2 0 1 1-1.1-2.6" />
      <path d="M14.6 9.3v2.2h2.2" />
    </>
  ),
  // Kund, privat: villan
  'kund-privat': (
    <>
      <path d="M3.5 11.2L12 4.3l8.5 6.9" />
      <path d="M6 9.6v10.4h12V9.6" />
      <path d="M10.4 20v-5h3.2v5" />
    </>
  ),
  // Kund, företag: huset med annex
  'kund-foretag': (
    <>
      <rect x="4.5" y="3.5" width="10" height="17" rx="1" />
      <path d="M14.5 9h4a1 1 0 0 1 1 1v10.5h-5" />
      <path d="M7.5 7h1M10.5 7h1M7.5 10.5h1M10.5 10.5h1M7.5 14h1M10.5 14h1M16.8 12.5h.4M16.8 15.5h.4" />
      <path d="M8.5 20.5v-3h2v3" />
    </>
  ),
  // Stationsvy: vikt karta med stationerna utplacerade
  stationer: (
    <>
      <path d="M3 6.6l5.6-2.1 6.8 2.1L21 4.5v13l-5.6 2.1-6.8-2.1L3 19.6z" />
      <path d="M8.6 4.5v13M15.4 6.6v13" opacity=".5" />
      <rect fill="currentColor" stroke="none" x="4.6" y="9.2" width="2.6" height="2.2" rx=".5" />
      <rect fill="currentColor" stroke="none" x="10.7" y="12.6" width="2.6" height="2.2" rx=".5" />
      <rect fill="currentColor" stroke="none" x="16.8" y="8.2" width="2.6" height="2.2" rx=".5" />
    </>
  ),
  // Offert: dokumentet med prislapp
  offert: (
    <>
      <path d="M13.5 21H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7l4 4v4" />
      <path d="M14 3v4h4" />
      <path d="M9 9.5h4.5M9 12.5h3" />
      <path d="M14.2 17.6l3.4-3.4h3.4v3.4l-3.4 3.4z" />
      <circle fill="currentColor" stroke="none" cx="19.2" cy="16" r=".75" />
    </>
  ),
  // Avtal: dokumentet med signatur
  avtal: (
    <>
      <path d="M18 9.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7l4 4" />
      <path d="M14 3v4h4" />
      <path d="M9 9.5h5" />
      <path d="M8.6 16.4c.9-1.6 1.7-1.7 2.1-.2.3 1.2.9 1.4 1.8.1.7-1 1.3-1.1 1.7 0 .3.7.8.8 1.5.3" />
      <path d="M8.6 18.8h6.8" opacity=".5" />
    </>
  ),
  // Lead webb: formuläret på begone.se
  'lead-webb': (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 8.3h18" />
      <circle fill="currentColor" stroke="none" cx="5.6" cy="6.4" r=".7" />
      <circle fill="currentColor" stroke="none" cx="7.8" cy="6.4" r=".7" />
      <path d="M6.3 11.8h7M6.3 14.8h4.5" />
      <path d="M14.8 12.6l4.6 1.8-2 .8-.8 2z" />
    </>
  ),
  // Lead B2B: målet med pil
  'lead-b2b': (
    <>
      <circle cx="11" cy="13" r="7.5" />
      <circle cx="11" cy="13" r="4" />
      <circle fill="currentColor" stroke="none" cx="11" cy="13" r="1.2" />
      <path d="M11 13l8-8M16.5 4.5H19.5V7.5" />
    </>
  ),
  // Faktura: kvittot med tandad kant
  faktura: (
    <>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8h6M9 11h6M9 14h3.5" />
    </>
  ),
  // Tekniker: person med keps
  tekniker: (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path fill="currentColor" stroke="none" d="M8.7 8.1a3.4 3.4 0 0 1 6.6 0z" />
      <path d="M8 8.1h9" />
      <path d="M5.5 20.5c.8-3.7 3.4-5.6 6.5-5.6s5.7 1.9 6.5 5.6" />
    </>
  ),
  // Sida: gå till
  sida: (
    <>
      <path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" />
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
    </>
  ),
  // Åtgärd: skapa
  atgard: <path d="M12 6.5v11M6.5 12h11" />,
  // Arkiv
  arkiv: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 12.8h4" />
    </>
  ),
  // Senast öppnade: klockan
  senast: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
}

export function SearchIcon({ name, className = 'w-[19px] h-[19px]' }: { name: SearchIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/** Ikonplattan: färgad ton bakom ikonen, ram för åtgärder. */
export function SearchIconTile({ name, tone }: { name: SearchIconName; tone: SearchTone }) {
  return (
    <span className={`w-[30px] h-[30px] rounded-lg grid place-items-center flex-none ${TONE_CLASSES[tone]}`}>
      <SearchIcon name={name} />
    </span>
  )
}

/** Förstoringsglaset i sökfältet (samma streck som skissen). */
export function SearchGlass({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}
