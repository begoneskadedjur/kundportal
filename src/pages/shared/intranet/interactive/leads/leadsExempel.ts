// src/pages/shared/intranet/interactive/leads/leadsExempel.ts
// Påhittade leads för övningarna i leadsguiderna. Inga riktiga kunder eller kollegor.
// Datum räknas från i dag så att grupperna i Att göra alltid stämmer.

import type { IconName } from '../../../../../components/icons/Icon'
import type { LeadStage } from '../../../../../types/leads'

export interface ExempelHandelse {
  ikon: IconName
  /** Människans aktiviteter visas med typ först och grön ikon */
  manuell?: string
  text: string
  nar: string
  vem: string
}

export interface ExempelLead {
  id: string
  foretag: string
  under: string
  stage: LeadStage
  nasta: string | null
  /** Dagar från i dag till nästa steg, negativt = försenat */
  nastaDagar: number | null
  nastaTid?: string
  parkeradTill?: number
  premie: number | null
  agare: string | null
  tipsare: string | null
  historik: ExempelHandelse[]
}

export const EXEMPEL_LEADS: ExempelLead[] = [
  {
    id: 'solglantan',
    foretag: 'Solgläntans Bageri AB',
    under: 'Tips från Tove · företagsärende',
    stage: 'offert_skickad',
    nasta: 'Ring om offerten',
    nastaDagar: -2,
    nastaTid: '10:00',
    premie: 36000,
    agare: 'Oskar Exempelsson',
    tipsare: 'Tove',
    historik: [
      { ikon: 'dok.offert', text: 'Offert skickad', nar: '-6', vem: 'Systemet' },
      { ikon: 'kontakt.mote', manuell: 'Möte', text: 'Gick igenom bageriet och lagret. Vill ha stationer i båda.', nar: '-8', vem: 'Oskar Exempelsson' },
      { ikon: 'kontakt.telefon', manuell: 'Samtal', text: 'Pratade med ägaren, intresserad av löpande kontroll.', nar: '-11', vem: 'Oskar Exempelsson' },
      { ikon: 'lead.agare', text: 'Ägare: ingen → Oskar Exempelsson', nar: '-12', vem: 'Malin' },
      { ikon: 'lead.lead', text: 'Lead skapad, källa teknikertips', nar: '-12', vem: 'Tove' },
    ],
  },
  {
    id: 'lonnkronan',
    foretag: 'Brf Lönnkronan',
    under: 'Tips från Tove · privat engångsärende',
    stage: 'kontaktad',
    nasta: 'Boka besök med styrelsen',
    nastaDagar: 0,
    nastaTid: '13:00',
    premie: 18000,
    agare: 'Oskar Exempelsson',
    tipsare: 'Tove',
    historik: [
      { ikon: 'kontakt.mejl', manuell: 'Mejl', text: 'Skickade information till ordföranden.', nar: '-3', vem: 'Oskar Exempelsson' },
      { ikon: 'allman.historik', text: 'Ny → Kontaktad', nar: '-3', vem: 'Oskar Exempelsson' },
      { ikon: 'lead.lead', text: 'Lead skapad, källa teknikertips', nar: '-5', vem: 'Tove' },
    ],
  },
  {
    id: 'hamnkrog',
    foretag: 'Norrviks Hamnkrog AB',
    under: 'Webbförfrågan',
    stage: 'ny',
    nasta: null,
    nastaDagar: null,
    premie: null,
    agare: 'Oskar Exempelsson',
    tipsare: null,
    historik: [{ ikon: 'lead.lead', text: 'Lead skapad, källa webbförfrågan', nar: '-1', vem: 'Malin' }],
  },
  {
    id: 'lagerhuset',
    foretag: 'Exempelbolaget Lager AB',
    under: 'Telefon',
    stage: 'parkerad',
    nasta: 'Hör av oss när avtalet med nuvarande leverantör går ut',
    nastaDagar: null,
    parkeradTill: 0,
    premie: 60000,
    agare: 'Oskar Exempelsson',
    tipsare: null,
    historik: [
      { ikon: 'lead.parkerad', text: 'Parkerad till {park}', nar: '-90', vem: 'Oskar Exempelsson' },
      { ikon: 'kontakt.telefon', manuell: 'Samtal', text: 'Bundna till nuvarande leverantör i tre månader till.', nar: '-90', vem: 'Oskar Exempelsson' },
      { ikon: 'lead.lead', text: 'Lead skapad, källa telefon', nar: '-95', vem: 'Oskar Exempelsson' },
    ],
  },
  {
    id: 'lillaexempel',
    foretag: 'Kaféet Lilla Exempel',
    under: 'Rekommendation',
    stage: 'kontaktad',
    nasta: 'Skicka prisförslag',
    nastaDagar: 3,
    nastaTid: '09:00',
    premie: 12000,
    agare: 'Oskar Exempelsson',
    tipsare: null,
    historik: [
      { ikon: 'kontakt.telefon', manuell: 'Samtal', text: 'Vill ha förslag på löpande avtal för köket.', nar: '-1', vem: 'Oskar Exempelsson' },
      { ikon: 'lead.lead', text: 'Lead skapad, källa rekommendation', nar: '-2', vem: 'Oskar Exempelsson' },
    ],
  },
  {
    id: 'tallasen',
    foretag: 'Tallåsens Förskola AB',
    under: 'Tips från Tove · företagsärende',
    stage: 'ny',
    nasta: 'Kontakta kunden om tipset',
    nastaDagar: 2,
    nastaTid: '09:00',
    premie: null,
    agare: null,
    tipsare: 'Tove',
    historik: [
      { ikon: 'lead.lead', text: 'Lead skapad, källa teknikertips', nar: '0', vem: 'Tove' },
    ],
  },
  {
    id: 'bryggeriet',
    foretag: 'Bryggeriet Exempel AB',
    under: 'Tips från Tove · företagsärende',
    stage: 'vunnen',
    nasta: null,
    nastaDagar: null,
    premie: 48000,
    agare: 'Oskar Exempelsson',
    tipsare: 'Tove',
    historik: [
      { ikon: 'dok.avtal', text: 'Avtalet signerat', nar: '-4', vem: 'Systemet' },
      { ikon: 'dok.offert', text: 'Offert skickad', nar: '-10', vem: 'Systemet' },
      { ikon: 'lead.lead', text: 'Lead skapad, källa teknikertips', nar: '-30', vem: 'Tove' },
    ],
  },
]

/** ÅÅÅÅ-MM-DD för i dag plus dagar, i lokal tid. */
export function datumOm(dagar: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dagar)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Samma format som Leads-sidan: "I dag 13:00", "ÅÅÅÅ-MM-DD · 2 dagar sen", "I morgon 09:00". */
export function nastaText(dagar: number, tid?: string): { text: string; sen: boolean } {
  const t = tid ? ` ${tid}` : ''
  if (dagar === 0) return { text: `I dag${t}`, sen: false }
  if (dagar < 0) return { text: `${datumOm(dagar)} · ${dagar === -1 ? '1 dag sen' : `${-dagar} dagar sen`}`, sen: true }
  if (dagar === 1) return { text: `I morgon${t}`, sen: false }
  return { text: `${datumOm(dagar)}${t}`, sen: false }
}
