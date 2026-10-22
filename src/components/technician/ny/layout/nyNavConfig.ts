// src/components/technician/ny/layout/nyNavConfig.ts
// Menyer för nya arbetsvyn (bara profiles.ny_arbetsvy). Gamla vyn använder
// technicianNavConfig.ts och påverkas inte.

import type { IconName } from '../../../icons/Icon'

export interface NyNavLank {
  label: string
  path: string
  ikon: IconName
  /** Räknare som visas till höger */
  badge?: 'tickets'
  /** Underlänkar visas indragna under rubriken */
  under?: NyNavLank[]
}

export interface NyNavGrupp {
  label: string
  lankar: NyNavLank[]
}

export const NY_NAV_GRUPPER: NyNavGrupp[] = [
  {
    label: 'Min dag',
    lankar: [
      { label: 'Idag', path: '/technician/dashboard', ikon: 'falt.idag' },
      { label: 'Karta', path: '/technician/karta', ikon: 'falt.karta' },
      { label: 'Schema', path: '/technician/schedule', ikon: 'allman.kalender' },
      { label: 'Mina ärenden', path: '/technician/cases', ikon: 'arende.arende' },
    ],
  },
  {
    label: 'Hos kunden',
    lankar: [
      { label: 'Utrustning', path: '/technician/equipment', ikon: 'arende.station' },
      { label: 'Specialrapporter', path: '/technician/specialrapporter', ikon: 'falt.specialrapport' },
    ],
  },
  {
    label: 'Sälja',
    lankar: [
      {
        label: 'Avtal och offerter',
        path: '/technician/oneflow',
        ikon: 'dok.avtal',
        under: [
          { label: 'Skapa avtal eller offert', path: '/technician/oneflow', ikon: 'dok.offert' },
          { label: 'Dokumentsignering', path: '/technician/dokumentsignering', ikon: 'falt.signera' },
          { label: 'Min kundresa', path: '/technician/min-kundresa', ikon: 'lead.nasta-steg' },
        ],
      },
      { label: 'Leads och tips', path: '/technician/leads', ikon: 'lead.lead' },
      { label: 'Provision', path: '/technician/commissions', ikon: 'falt.provision' },
    ],
  },
  {
    label: 'Hjälp',
    lankar: [
      { label: 'Intranät och guider', path: '/technician/intranat', ikon: 'guide.las-ocksa' },
      { label: 'Meddelande till kontoret', path: '/technician/tickets', ikon: 'guide.fraga', badge: 'tickets' },
      { label: 'AI-assistent', path: '/technician/team-chat', ikon: 'kalla.ai' },
    ],
  },
]

/** Rubrik i sidhuvudet per sökväg. Undersidor ärver förälderns rubrik. */
export const NY_RUBRIKER: Record<string, string> = {
  '/technician/dashboard': 'Idag',
  '/technician/karta': 'Karta',
  '/technician/cases': 'Mina ärenden',
  '/technician/schedule': 'Schema',
  '/technician/equipment': 'Utrustning',
  '/technician/specialrapporter': 'Specialrapporter',
  '/technician/oneflow': 'Avtal och offerter',
  '/technician/oneflow-contract-creator': 'Avtal och offerter',
  '/technician/dokumentsignering': 'Dokumentsignering',
  '/technician/min-kundresa': 'Min kundresa',
  '/technician/leads': 'Leads och tips',
  '/technician/commissions': 'Provision',
  '/technician/intranat': 'Intranät och guider',
  '/technician/tickets': 'Meddelande till kontoret',
  '/technician/team-chat': 'AI-assistent',
  '/technician/tillbud-avvikelser': 'Tillbud och avvikelser',
  '/technician/mitt-konto': 'Mitt konto',
  '/technician/mer': 'Mer',
  '/technician/inspection': 'Stationskontroll',
}

export function rubrikFor(path: string): string {
  if (NY_RUBRIKER[path]) return NY_RUBRIKER[path]
  const delar = path.split('/')
  while (delar.length > 2) {
    delar.pop()
    const p = delar.join('/')
    if (NY_RUBRIKER[p]) return NY_RUBRIKER[p]
  }
  return 'BeGone'
}

/** Är länken aktiv för nuvarande sökväg (exakt eller undersida) */
export function arAktiv(lankPath: string, current: string): boolean {
  return current === lankPath || current.startsWith(`${lankPath}/`)
}
