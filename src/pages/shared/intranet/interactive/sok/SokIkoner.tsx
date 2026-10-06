// src/pages/shared/intranet/interactive/sok/SokIkoner.tsx
// Ikonförklaring för sökrutan. Ikonerna hämtas direkt från söklådan
// (SearchIcons.tsx) så att guiden alltid visar exakt samma bilder.
// variant: 'tekniker' (standard) eller 'kontor'.

import { Shapes } from 'lucide-react'
import {
  SearchIconTile,
  type SearchIconName,
  type SearchTone,
} from '../../../../../components/shared/search/SearchIcons'

interface IconRow {
  icon: SearchIconName
  tone: SearchTone
  label: string
  text: string
  /** Visas bara i kontorsvarianten */
  kontor?: boolean
  /** Visas bara i teknikervarianten */
  tekniker?: boolean
}

const ROWS: IconRow[] = [
  { icon: 'arende', tone: 'arende', label: 'Ärende', text: 'Ett privat- eller företagsärende. Visar nummer, status, datum och tekniker.' },
  { icon: 'arende-avtal', tone: 'arende', label: 'Avtalsärende', text: 'Ett besök hos en avtalskund, till exempel en kontroll av stationerna.' },
  {
    icon: 'kund-foretag', tone: 'kund', label: 'Kund, företag', tekniker: true,
    text: 'En kund med organisationsnummer. Till höger står Stationsvy. Enter öppnar den samlade stationsvyn med kundens alla stationer.',
  },
  {
    icon: 'kund-privat', tone: 'kund', label: 'Kund, privat', tekniker: true,
    text: 'En privatperson, känns igen på personnumret. Öppnas på samma sätt i stationsvyn.',
  },
  {
    icon: 'kund-foretag', tone: 'kund', label: 'Kund, företag', kontor: true,
    text: 'En kund med organisationsnummer. Enter öppnar kundkortet. Snabbvalet Stationer öppnar fliken Utrustning.',
  },
  {
    icon: 'kund-privat', tone: 'kund', label: 'Kund, privat', kontor: true,
    text: 'En privatperson, känns igen på personnumret.',
  },
  { icon: 'offert', tone: 'offert', label: 'Offert', text: 'En offert i Oneflow, med status och belopp.' },
  { icon: 'avtal', tone: 'avtal', label: 'Avtal', text: 'Ett avtal i Oneflow, med årsvärde och slutdatum.' },
  { icon: 'lead-webb', tone: 'lead', label: 'Lead, webb', kontor: true, text: 'En förfrågan som kommit in via formuläret på begone.se.' },
  {
    icon: 'tekniker', tone: 'tekniker', label: 'Tekniker', kontor: true,
    text: 'En kollega. Snabbvalen öppnar schemat eller bokningsassistenten. Admin får även Personalkort.',
  },
  {
    icon: 'faktura', tone: 'faktura', label: 'Faktura', kontor: true,
    text: 'En faktura med status och belopp. Sök på fakturanummer eller Fortnox-nummer.',
  },
  { icon: 'sida', tone: 'nav', label: 'Sida', text: 'En sida i menyn. Skriv till exempel schema eller tillbud.' },
  { icon: 'atgard', tone: 'atgard', label: 'Åtgärd', text: 'Något du kan göra direkt, till exempel skapa en offert. Har en grön ram i stället för fylld ruta.' },
  { icon: 'arkiv', tone: 'arkiv', label: 'Arkiv', text: 'Gamla ärenden från ClickUp. Visas bara när du skriver ordet arkiv.' },
  { icon: 'senast', tone: 'nav', label: 'Senast öppnade', text: 'Det du öppnat senast. Syns när sökrutan är tom.' },
]

export default function SokIkoner({ variant }: { variant?: string }) {
  const kontor = variant === 'kontor'
  const rows = ROWS.filter(r => (kontor ? !r.tekniker : !r.kontor))

  return (
    <div className="my-6 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-700 flex items-center gap-2">
        <Shapes className="w-4 h-4 text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Ikonerna i sökrutan</p>
      </div>
      <ul className="p-1.5 bg-slate-900/40">
        {rows.map(r => (
          <li
            key={`${r.icon}-${r.label}`}
            className="flex items-start gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <SearchIconTile name={r.icon} tone={r.tone} />
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-medium text-white">{r.label}</span>
              <span className="block text-xs leading-relaxed text-slate-400">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
