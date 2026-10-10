// src/components/shared/search/SearchIcons.tsx
// Söklådans ikoner, en per träfftyp. Tunt alias mot ikonstandarden
// (src/components/icons): ritningarna ligger i registret som sok.* och
// renderas via <Icon>. Formen bär betydelsen, färgen kommer från familjen
// (SearchTone) och sätts av ikonplattan via currentColor.

import { Icon, type IconName } from '../../icons/Icon'

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

// Träfftyp till namn i ikonregistret. Arkiv delar ritning med allman.arkiv.
const NAMES: Record<SearchIconName, IconName> = {
  arende: 'sok.arende',
  'arende-avtal': 'sok.arende-avtal',
  'kund-privat': 'sok.kund-privat',
  'kund-foretag': 'sok.kund-foretag',
  stationer: 'sok.stationer',
  offert: 'sok.offert',
  avtal: 'sok.avtal',
  'lead-webb': 'sok.lead-webb',
  'lead-b2b': 'sok.lead-b2b',
  faktura: 'sok.faktura',
  tekniker: 'sok.tekniker',
  sida: 'sok.sida',
  atgard: 'sok.atgard',
  arkiv: 'allman.arkiv',
  senast: 'sok.senast',
}

export function SearchIcon({ name, className = 'w-[19px] h-[19px]' }: { name: SearchIconName; className?: string }) {
  return <Icon name={NAMES[name]} size={20} className={className} />
}

/** Ikonplattan: färgad ton bakom ikonen, ram för åtgärder. */
export function SearchIconTile({ name, tone }: { name: SearchIconName; tone: SearchTone }) {
  return (
    <span className={`w-[30px] h-[30px] rounded-lg grid place-items-center flex-none ${TONE_CLASSES[tone]}`}>
      <SearchIcon name={name} />
    </span>
  )
}

/** Förstoringsglaset i sökfältet (samma streck som skissen, 1,8). */
export function SearchGlass({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return <Icon name="sok.glas" size={20} strokeWidth={1.8} className={className} />
}
