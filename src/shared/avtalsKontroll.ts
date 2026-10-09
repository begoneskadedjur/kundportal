// src/shared/avtalsKontroll.ts
// Kontrollistan i avtalswizardens granskningssteg ("Kontroll före utskick").
//
// Ren funktion utan React och Supabase, så att den kan testas och återanvändas.
// Tre nivåer:
//   rod  = stoppar. Avtalet/offerten kan inte skapas förrän punkten är rättad.
//   gul  = varnar. Går att skapa, men något kunden märker saknas eller ser fel ut.
//   gron = ok. Visas så att man ser vad som faktiskt är kontrollerat.
//
// Varje punkt bär vilket avsnitt den hör till, så att wizarden kan länka
// "Fyll i under Motpart" till rätt steg.

import { tolkaIdNummer } from './webLeadUppgifter'

export type KontrollNiva = 'rod' | 'gul' | 'gron'

/** Avsnittet i wizarden som punkten rättas i. */
export type KontrollAvsnitt = 'motpart' | 'avtalstid' | 'avtalsobjekt' | 'tjanster'

export interface KontrollPunkt {
  niva: KontrollNiva
  text: string
  avsnitt: KontrollAvsnitt
}

export interface AvtalsKontrollIndata {
  dokumentTyp: 'contract' | 'offer'
  partTyp: 'company' | 'individual'
  foretag: string
  orgNr: string
  kontaktperson: string
  epost: string
  telefon: string
  epostFaktura: string
  /** Avtalslängden som den står i avtalet, t.ex. "2 år". Tom = saknas. */
  avtalslangd: string
  /** ÅÅÅÅ-MM-DD */
  startdatum: string
  avtalsobjekt: string
  antalTjanster: number
}

/** Oneflows två stycken om 1 024 tecken var. Längre text kapas. */
export const AVTALSOBJEKT_MAX_TECKEN = 2048

export function arGiltigEpost(epost: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost.trim())
}

export function kontrolleraAvtal(d: AvtalsKontrollIndata): KontrollPunkt[] {
  const punkter: KontrollPunkt[] = []
  const arAvtal = d.dokumentTyp === 'contract'
  const arForetag = d.partTyp === 'company'
  const objektNamn = arAvtal ? 'Avtalsobjektet' : 'Offertinnehållet'
  const add = (niva: KontrollNiva, avsnitt: KontrollAvsnitt, text: string) =>
    punkter.push({ niva, avsnitt, text })

  // --- Motpart -----------------------------------------------------------
  if (arForetag && !d.foretag.trim()) add('rod', 'motpart', 'Företagsnamn saknas')

  const kontakt = d.kontaktperson.trim()
  const epost = d.epost.trim()
  if (!kontakt) add('rod', 'motpart', arForetag ? 'Kontaktperson saknas' : 'Namn saknas')
  if (!epost) add('rod', 'motpart', 'E-post saknas')
  else if (!arGiltigEpost(epost)) add('rod', 'motpart', `E-postadressen ${epost} är ogiltig`)
  if (kontakt && epost && arGiltigEpost(epost)) {
    add('gron', 'motpart', `${arAvtal ? 'Avtalet' : 'Offerten'} skickas till ${epost}`)
  }

  if (!d.telefon.trim()) add('gul', 'motpart', 'Telefonnummer saknas')

  const idNamn = arForetag ? 'Org.nr' : 'Personnummer'
  const id = d.orgNr.trim()
  if (!id) {
    add('gul', 'motpart', `${idNamn} saknas`)
  } else {
    const tolkning = tolkaIdNummer(id)
    if (!tolkning.tolkat) add('gul', 'motpart', `${idNamn} ${id} går inte att tolka`)
    else if (!tolkning.kontrollsiffraOk) add('gul', 'motpart', `${idNamn} ${id}: kontrollsiffran stämmer inte`)
    else add('gron', 'motpart', `${idNamn} ${tolkning.normaliserat}`)
  }

  const fakturaEpost = d.epostFaktura.trim()
  if (!fakturaEpost) add('gul', 'motpart', 'E-post för faktura saknas, kunden fyller i vid signering')
  else if (!arGiltigEpost(fakturaEpost)) add('gul', 'motpart', `E-post för faktura (${fakturaEpost}) ser ogiltig ut`)
  else add('gron', 'motpart', `Faktura till ${fakturaEpost}`)

  // --- Avtalstid (bara avtal) ----------------------------------------------
  if (arAvtal) {
    const langd = d.avtalslangd.trim()
    const start = d.startdatum.trim()
    if (!langd) add('rod', 'avtalstid', 'Avtalslängd saknas')
    if (!start) add('rod', 'avtalstid', 'Startdatum saknas')
    if (langd && start) add('gron', 'avtalstid', `Avtalstid ${langd} från ${start}`)
  }

  // --- Tjänster ------------------------------------------------------------
  if (d.antalTjanster <= 0) add('rod', 'tjanster', 'Inga tjänster är valda')
  else add('gron', 'tjanster', d.antalTjanster === 1 ? '1 tjänst' : `${d.antalTjanster} tjänster`)

  // --- Avtalsobjekt ----------------------------------------------------------
  const objekt = d.avtalsobjekt.trim()
  if (!objekt) add('rod', 'avtalsobjekt', `${objektNamn} är tomt`)
  else if (d.avtalsobjekt.length > AVTALSOBJEKT_MAX_TECKEN) {
    add('rod', 'avtalsobjekt', `${objektNamn} är ${d.avtalsobjekt.length} tecken, max ${AVTALSOBJEKT_MAX_TECKEN.toLocaleString('sv-SE')}`)
  } else {
    add('gron', 'avtalsobjekt', `${objektNamn} ifyllt, ${d.avtalsobjekt.length} tecken`)
  }

  // Röda först, sedan gula, sedan gröna: det som stoppar står överst
  const ordning: Record<KontrollNiva, number> = { rod: 0, gul: 1, gron: 2 }
  return punkter.sort((a, b) => ordning[a.niva] - ordning[b.niva])
}

export function harStopp(punkter: KontrollPunkt[]): boolean {
  return punkter.some(p => p.niva === 'rod')
}
