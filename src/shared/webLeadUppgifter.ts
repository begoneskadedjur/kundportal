// src/shared/webLeadUppgifter.ts
// Leads (Webb): adressen och personnummer eller org.nr för en webbförfrågan.
//
// Adressen: kunden skriver ofta hela adressen i gatufältet ("rankhusvägen 32, 196 31 kungsängen")
// och formuläret skickar dessutom postnumret och täckningsområdets namn ("Kungsängen och Bro").
// sattIhopAdress sätter ihop gata, postnummer och ort utan dubbletter, använder kundens egen ort
// före områdets namn och skriver postnumret som "196 31". Kundens originaldata ändras aldrig.
//
// Id-numret: ett fält som känner igen personnummer och org.nr och kontrollerar kontrollsiffran.

import { luhnValid } from './fortnoxCustomerNumbers'

export interface AdressDelar {
  gata: string
  postnummer: string
  ort: string
}

/** Fälten på förfrågan som adressen byggs av. Rättade fält går före kundens originalsvar. */
export interface AdressKalla {
  address: string | null
  postal_code: string | null
  city: string | null
  rattad_adress?: string | null
  rattad_postnummer?: string | null
  rattad_ort?: string | null
}

const SMA_ORD = new Set(['och', 'i', 'på', 'av', 'vid', 'under', 'över'])

function rensa(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

/** Texten är skriven med bara versaler ("KUNGSÄNGEN", "RANKHUSVÄGEN 32"). */
function baraVersaler(t: string): boolean {
  const bokstaver = t.replace(/[^\p{L}]/gu, '')
  return bokstaver.length > 1 && bokstaver === bokstaver.toLocaleUpperCase('sv-SE')
}

/** Stor bokstav först, resten orört. Text med bara versaler skrivs om med gemener först. */
export function versalForst(s: string): string {
  let t = rensa(s)
  if (baraVersaler(t)) t = t.toLocaleLowerCase('sv-SE')
  return t ? t.charAt(0).toLocaleUpperCase('sv-SE') + t.slice(1) : ''
}

/**
 * Ortnamn med stor bokstav i varje ord och efter bindestreck, utom småord som "och"
 * ("upplands väsby" blir "Upplands Väsby", "upplands-bro" blir "Upplands-Bro", "KUNGSÄNGEN" blir "Kungsängen").
 */
export function ortMedVersal(s: string): string {
  let t = rensa(s)
  if (baraVersaler(t)) t = t.toLocaleLowerCase('sv-SE')
  return t
    .split(' ')
    .filter(Boolean)
    .map((o, i) =>
      i > 0 && SMA_ORD.has(o.toLocaleLowerCase('sv-SE'))
        ? o.toLocaleLowerCase('sv-SE')
        : o.split('-').map(versalForst).join('-')
    )
    .join(' ')
}

/** Postnummer som "196 31". Annat än fem siffror lämnas som det står. */
export function formatPostnummer(s: string | null | undefined): string {
  const siffror = (s ?? '').replace(/\s/g, '')
  return /^\d{5}$/.test(siffror) ? `${siffror.slice(0, 3)} ${siffror.slice(3)}` : rensa(s)
}

function lika(a: string, b: string): boolean {
  return a.toLocaleLowerCase('sv-SE') === b.toLocaleLowerCase('sv-SE')
}

/** Orterna som ett täckningsområde består av: "Kungsängen och Bro" ger Kungsängen, Bro och hela namnet. */
function omradetsOrter(omrade: string): string[] {
  const t = rensa(omrade)
  if (!t) return []
  return [t, ...t.split(/\s+och\s+|\s*,\s*|\s*\/\s*/i).map(rensa).filter(Boolean)]
}

/**
 * Täckningsområdets namn om det är en ort. Sammansatta områden ("Kungsängen och Bro", "Sigtuna och
 * Märsta"), län och landskap ("Uppsala län", "Dalarna") är inga orter och ger tom ort.
 */
export function omradeSomOrt(omrade: string | null | undefined): string {
  const t = rensa(omrade)
  if (!t) return ''
  if (/\s+och\s+|,|\/|\s+län$/i.test(t) || /^(dalarna|gävleborg)$/i.test(t)) return ''
  return t
}

/**
 * Delar upp det kunden skrev i gatufältet. Ett postnummer (med eller utan mellanslag) och det som
 * står efter det plockas ut som postnummer och ort. Står orten (eller en ort i täckningsområdet)
 * sist efter ett kommatecken plockas den också ut.
 */
export function delaGatufalt(gatufalt: string | null | undefined, kandaOrter: string[] = []): AdressDelar {
  // Landet sist ("..., Sverige") hör inte till adressen
  let gata = rensa(gatufalt).replace(/,?\s*(sverige|sweden)\s*$/i, '')
  let postnummer = ''
  let ort = ''

  const pn = gata.match(/^(.*?)(?:,\s*|\s+)(?:SE-?)?(\d{3})\s?(\d{2})(?:\s+([^\d,][^,]*?))?\s*,?\s*$/i)
  if (pn && pn[1].trim()) {
    gata = rensa(pn[1]).replace(/,$/, '')
    postnummer = `${pn[2]}${pn[3]}`
    ort = rensa(pn[4])
  }

  if (!ort && gata.includes(',')) {
    const delar = gata.split(',')
    const sista = rensa(delar[delar.length - 1])
    if (sista && kandaOrter.some((k) => lika(k, sista))) {
      ort = sista
      gata = rensa(delar.slice(0, -1).join(','))
    }
  }

  // Känd ort sist utan kommatecken, efter husnumret: "rankhusvägen 32 kungsängen"
  if (!ort && !gata.includes(',')) {
    const lower = gata.toLocaleLowerCase('sv-SE')
    const traff = kandaOrter
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .find((k) => {
        if (!lower.endsWith(' ' + k.toLocaleLowerCase('sv-SE'))) return false
        return /\d\s*\p{L}?$/u.test(gata.slice(0, gata.length - k.length).trim())
      })
    if (traff) {
      ort = gata.slice(gata.length - traff.length)
      gata = rensa(gata.slice(0, gata.length - traff.length))
    }
  }

  return { gata, postnummer, ort }
}

/**
 * Gata, postnummer och ort för förfrågan. Rättade fält går först, sedan kundens egen ort ur
 * gatufältet och sist täckningsområdets namn, bara när området är en ort (inte "Kungsängen och Bro").
 */
export function adressDelar(k: AdressKalla): AdressDelar {
  const omrade = rensa(k.city)
  const orter = omradetsOrter(omrade)

  // Kundens svar: ort ur gatufältet före täckningsområdet, som bara används när det är en ort
  const d = delaGatufalt(k.address, orter)
  // Formulärets postnummer är kontrollerat och går före det som stod i gatufältet
  const delar: AdressDelar = {
    gata: d.gata,
    postnummer: rensa(k.postal_code) || d.postnummer,
    ort: d.ort || omradeSomOrt(omrade),
  }

  const rattadPostnummer = rensa(k.rattad_postnummer)
  const rattadOrt = rensa(k.rattad_ort)
  if (rensa(k.rattad_adress) || rattadPostnummer || rattadOrt) {
    // Rättade fält går före, det som inte rättats tas från kundens svar
    const r = delaGatufalt(k.rattad_adress, [...orter, rattadOrt, delar.ort].filter(Boolean))
    const postnummer = rattadPostnummer || r.postnummer || delar.postnummer
    const sammaPostnummer = postnummer.replace(/\s/g, '') === delar.postnummer.replace(/\s/g, '')
    delar.gata = r.gata || delar.gata
    delar.ort = rattadOrt || r.ort || (sammaPostnummer ? delar.ort : '')
    delar.postnummer = postnummer
  }

  return {
    gata: versalForst(delar.gata),
    postnummer: formatPostnummer(delar.postnummer),
    ort: ortMedVersal(delar.ort),
  }
}

/** Adressen på en rad: "Rankhusvägen 32, 196 31 Kungsängen". */
export function adressRad(delar: AdressDelar): string {
  const postort = [delar.postnummer, delar.ort].filter(Boolean).join(' ')
  return [delar.gata, postort].filter(Boolean).join(', ')
}

/** Förfrågans adress på en rad, rättad och utan dubbletter. */
export function sattIhopAdress(k: AdressKalla): string {
  return adressRad(adressDelar(k))
}

// ---------------------------------------------------------------------------
// Personnummer och org.nr

export type IdNummerTyp = 'personnummer' | 'orgnr'

export interface IdNummerTolkning {
  /** Sparas så här: personnummer ÅÅÅÅMMDD-XXXX, org.nr XXXXXX-XXXX. Tomt om formatet inte gick att tolka. */
  normaliserat: string
  typ: IdNummerTyp | null
  /** Formatet gick att tolka (10 eller 12 siffror). */
  tolkat: boolean
  /** Kontrollsiffran stämmer (Luhn). */
  kontrollsiffraOk: boolean
}

function giltigtDatum(ar: number, man: number, dag: number): boolean {
  // Samordningsnummer: dag + 60
  const d = dag > 60 ? dag - 60 : dag
  if (man < 1 || man > 12 || d < 1) return false
  const dagarIManad = new Date(Date.UTC(ar, man, 0)).getUTCDate()
  return d <= dagarIManad
}

/**
 * Tolkar personnummer eller org.nr. Ett org.nr har 20 eller mer i månadens position (tredje och
 * fjärde siffran), ett personnummer ett giltigt datum. Med tolv siffror och 16 först är det ett
 * org.nr. Ett personnummer med tio siffror får sekel så att personen är under 100 år, eller över
 * 100 med plustecken. Skiljetecknet styr inget annat.
 */
export function tolkaIdNummer(raw: string, idag: Date = new Date()): IdNummerTolkning {
  const text = rensa(raw)
  const siffror = text.replace(/\D/g, '')
  const tomt: IdNummerTolkning = { normaliserat: '', typ: null, tolkat: false, kontrollsiffraOk: false }
  if (!text || /[^\d\s\-+]/.test(text)) return tomt

  if (siffror.length === 12) {
    const tio = siffror.slice(2)
    if (siffror.startsWith('16')) {
      return { normaliserat: `${tio.slice(0, 6)}-${tio.slice(6)}`, typ: 'orgnr', tolkat: true, kontrollsiffraOk: luhnValid(tio) }
    }
    const ar = Number(siffror.slice(0, 4))
    const man = Number(siffror.slice(4, 6))
    const dag = Number(siffror.slice(6, 8))
    if (ar >= 1850 && giltigtDatum(ar, man, dag)) {
      return { normaliserat: `${siffror.slice(0, 8)}-${siffror.slice(8)}`, typ: 'personnummer', tolkat: true, kontrollsiffraOk: luhnValid(tio) }
    }
    return tomt
  }

  if (siffror.length === 10) {
    const man = Number(siffror.slice(2, 4))
    if (man >= 20) {
      return { normaliserat: `${siffror.slice(0, 6)}-${siffror.slice(6)}`, typ: 'orgnr', tolkat: true, kontrollsiffraOk: luhnValid(siffror) }
    }
    const aa = Number(siffror.slice(0, 2))
    const dag = Number(siffror.slice(4, 6))
    const iAr = idag.getFullYear()
    let sekel = Math.floor(iAr / 100) * 100
    if (sekel + aa > iAr) sekel -= 100
    if (text.includes('+')) sekel -= 100
    const ar = sekel + aa
    if (!giltigtDatum(ar, man, dag)) return tomt
    return {
      normaliserat: `${ar}${siffror.slice(2, 6)}-${siffror.slice(6)}`,
      typ: 'personnummer',
      tolkat: true,
      kontrollsiffraOk: luhnValid(siffror),
    }
  }

  return tomt
}

/** Personnumret maskerat som ÅÅMMDD-XXXX. Org.nr visas som det är. */
export function maskeraIdNummer(varde: string, typ: IdNummerTyp | null): string {
  if (typ !== 'personnummer') return varde
  const siffror = varde.replace(/\D/g, '')
  const datum = siffror.length === 12 ? siffror.slice(2, 8) : siffror.slice(0, 6)
  return datum.length === 6 ? `${datum}-XXXX` : 'XXXXXX-XXXX'
}

/** Personnummer eller org.nr som gäller för förfrågan: kompletteringen före formulärets org.nr. */
export function effektivtIdNummer(i: {
  id_nummer: string | null
  id_nummer_typ: IdNummerTyp | null
  organization_number: string | null
  kundgrupp: string
}): { varde: string; typ: IdNummerTyp } | null {
  if (i.id_nummer) return { varde: i.id_nummer, typ: i.id_nummer_typ ?? 'personnummer' }
  if (i.organization_number && i.kundgrupp !== 'privat') return { varde: i.organization_number, typ: 'orgnr' }
  return null
}
