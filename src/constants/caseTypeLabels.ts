// src/constants/caseTypeLabels.ts
// Central etikettkarta för ärendetyper i INTERNA vyer (koordinator/admin/tekniker).
//
// VIKTIGT: databasens identifierare (cases.service_type-värden, case_type
// private/business samt tabellnamn) får ALDRIG ändras - de refereras i
// fakturering, drag & drop-routing och statistik. Detta är enbart
// visningsnamn. Kundportalen har egna kundvänliga texter och rörs inte.
//
// Nycklar: service_type-värden ur databasen plus de adapterade
// case_type-namn som schemat använder (contract/rondering/egenkontroll).

export interface CaseKindLabel {
  /** Fullt namn - används i väljare och rubriker */
  label: string
  /** Kort namn - används i trånga ytor som schemakort */
  short: string
  /** Beskrivande undertext i ärendetypväljaren */
  subtitle: string
}

const LABELS: Record<string, CaseKindLabel> = {
  // Engångsärenden (kunder utan avtal)
  private: {
    label: 'Engångsjobb Privatperson',
    short: 'Privatperson',
    subtitle: 'Faktureras separat - ROT/RUT',
  },
  business: {
    label: 'Engångsjobb Företag',
    short: 'Företag',
    subtitle: 'Faktureras separat',
  },
  // Avtalskundernas ärenden (cases-tabellen, service_type)
  routine: {
    label: 'Extrabesök Avtalskund',
    short: 'Extrabesök',
    subtitle: 'Enstaka tjänst utöver avtalet - merförsäljning',
  },
  inspection: {
    label: 'Stationskontroll Avtalskund',
    short: 'Stationskontroll',
    subtitle: 'Enstaka kontroll - återkommande läggs i Rondering & Schema',
  },
  establishment: {
    label: 'Etablering Avtalskund',
    short: 'Etablering',
    subtitle: 'Utplacering av stationer vid avtalsstart',
  },
  rondering_trafikkontoret: {
    label: 'Rondering Trafikkontoret',
    short: 'Rondering TK',
    subtitle: 'Egenkontrollprogram TK',
  },
  egenkontroll_trafikkontoret: {
    label: 'Egenkontroll',
    short: 'Egenkontroll',
    subtitle: 'Stationsgranskning TK',
  },
}

// Adapterade case_type-namn i schemat pekar på samma etiketter
const ALIASES: Record<string, string> = {
  contract: 'routine',
  rondering: 'rondering_trafikkontoret',
  egenkontroll: 'egenkontroll_trafikkontoret',
}

/** Hämta etiketter för en ärendetyp (service_type eller adapterad case_type) */
export function getCaseKindLabel(key: string | null | undefined): CaseKindLabel | null {
  if (!key) return null
  return LABELS[key] || LABELS[ALIASES[key]] || null
}
