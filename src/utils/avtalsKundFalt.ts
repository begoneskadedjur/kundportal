// src/utils/avtalsKundFalt.ts
// Kundkopplingen i Skapa avtal eller offert (3.100.0): vilken kundrad avtalet
// läggs på, vilka uppgifter som fylls i från kundkortet, vad som ärvs från
// huvudkontoret och vad som skiljer sig. Ändringar i guiden gäller bara
// avtalet (Oneflow och contracts-raden), kundkortet ändras aldrig.

import { inheritOrgNr, resolveSiteContact, type SiteContactFields } from './multisiteHelpers'
import { isPrivateIdNumber } from './oneflowPrefill'
import { enheterText, kundensIdNummer } from '../shared/avtalsKundKoppling'
import {
  formatAdress, formatEpost, formatForetagsnamn, formatIdNummer, formatPersonnamn, formatTelefon,
} from '../shared/kontaktFormat'
import type { AvtalsKund, AvtalsKundOrganisation } from '../services/avtalsKundService'

/** Motpartens fält i guiden som fylls i från kundkortet. */
export type MotpartsFalt =
  | 'foretag' | 'org-nr' | 'Kontaktperson' | 'e-post-kontaktperson'
  | 'telefonnummer-kontaktperson' | 'e-post-faktura' | 'utforande-adress'

export const MOTPARTS_FALT: MotpartsFalt[] = [
  'foretag', 'org-nr', 'Kontaktperson', 'e-post-kontaktperson',
  'telefonnummer-kontaktperson', 'e-post-faktura', 'utforande-adress',
]

/** Samma tillsnyggning som guiden gör när fälten lämnas: jämförelsen ska inte slå på formatskillnader. */
const FORMAT: Record<MotpartsFalt, (s: string) => string> = {
  foretag: formatForetagsnamn,
  'org-nr': formatIdNummer,
  Kontaktperson: formatPersonnamn,
  'e-post-kontaktperson': formatEpost,
  'telefonnummer-kontaktperson': formatTelefon,
  'e-post-faktura': formatEpost,
  'utforande-adress': formatAdress,
}

export interface KundKoppling {
  org: AvtalsKundOrganisation
  /** Kundraden avtalet läggs på: huvudkontoret, en enhet eller den fristående kunden */
  partId: string
  /** Enhetsvalet när avtalet läggs på ett huvudkontor med enheter (bara avtal). null = inte valt än */
  omfattning: 'alla' | 'valda' | null
  /** Kundrader i urvalet: huvudkontoret och/eller enheter */
  valdaEnheter: string[]
  /** Levande avtal per kundrad, när antalet är hämtat */
  levandeAvtal: Record<string, number>
  /** Kundkortets värden för avtalsparten (med arv), som de fylldes i */
  kundkort: Record<MotpartsFalt, string>
  /** Fälten som ärvts från huvudkontoret */
  arvda: MotpartsFalt[]
  /** Kunden är en privatperson (personnummer) */
  privat: boolean
}

/** Kundraden avtalet läggs på. */
export function avtalspartRad(k: Pick<KundKoppling, 'org' | 'partId'>): AvtalsKund {
  const { kund, huvudkontor, enheter } = k.org
  if (k.partId === kund.id) return kund
  if (huvudkontor && k.partId === huvudkontor.id) return huvudkontor
  return enheter.find((e) => e.id === k.partId) ?? kund
}

/** Huvudkontoret som avtalsparten ärver från, när parten är en enhet. */
export function foralderFor(k: Pick<KundKoppling, 'org' | 'partId'>): AvtalsKund | null {
  const rad = avtalspartRad(k)
  return rad.parent_customer_id && k.org.huvudkontor && k.org.huvudkontor.id !== rad.id ? k.org.huvudkontor : null
}

/** Avtalet läggs på ett huvudkontor med enheter: enhetsvalet gäller. */
export function harEnhetsval(k: KundKoppling | null, isContract: boolean): boolean {
  if (!k || !isContract) return false
  const hk = k.org.huvudkontor
  return !!hk && k.partId === hk.id && k.org.enheter.length > 0
}

/** Kundens identitetsnummer att jämföra avtalets org.nr med (enhet utan eget: huvudkontorets). */
export function kopplingensIdNummer(k: KundKoppling): string | null {
  return kundensIdNummer(avtalspartRad(k), foralderFor(k))
}

export function kundgruppFranKort(k: KundKoppling | null): string | null {
  if (!k) return null
  return avtalspartRad(k).customer_group_id ?? foralderFor(k)?.customer_group_id ?? null
}

const kontaktFalt = (r: AvtalsKund): SiteContactFields => ({
  contact_person: r.contact_person,
  contact_phone: r.contact_phone,
  contact_email: r.contact_email,
  contact_address: r.contact_address,
  billing_email: r.billing_email,
})

/** Bygger kopplingen för en kundrad i organisationen, med kundkortets värden. */
export function byggKoppling(
  org: AvtalsKundOrganisation,
  partId: string,
  tidigare?: Pick<KundKoppling, 'omfattning' | 'valdaEnheter' | 'levandeAvtal'> | null
): KundKoppling {
  const bas = { org, partId }
  const rad = avtalspartRad(bas)
  const foralder = foralderFor(bas)
  const kontakt = resolveSiteContact(kontaktFalt(rad), foralder ? kontaktFalt(foralder) : null)
  const orgNr = inheritOrgNr(rad, foralder) ?? ''
  const privat = isPrivateIdNumber(orgNr)
  const kundkort: Record<MotpartsFalt, string> = {
    foretag: privat ? '' : rad.company_name ?? '',
    'org-nr': orgNr,
    Kontaktperson: kontakt.contact_person || (privat ? rad.company_name ?? '' : ''),
    'e-post-kontaktperson': kontakt.contact_email ?? '',
    'telefonnummer-kontaktperson': kontakt.contact_phone ?? '',
    'e-post-faktura': kontakt.billing_email ?? '',
    'utforande-adress': kontakt.contact_address ?? '',
  }
  const arvda: MotpartsFalt[] = []
  const arvMap: Partial<Record<keyof SiteContactFields, MotpartsFalt>> = {
    contact_person: 'Kontaktperson',
    contact_email: 'e-post-kontaktperson',
    contact_phone: 'telefonnummer-kontaktperson',
    billing_email: 'e-post-faktura',
    contact_address: 'utforande-adress',
  }
  for (const f of kontakt.inheritedFields) {
    const falt = arvMap[f]
    if (falt) arvda.push(falt)
  }
  if (foralder && !rad.organization_number && orgNr) arvda.push('org-nr')

  const enhetsval = !!org.huvudkontor && partId === org.huvudkontor.id && org.enheter.length > 0
  return {
    org,
    partId,
    omfattning: enhetsval ? tidigare?.omfattning ?? null : null,
    valdaEnheter: enhetsval ? tidigare?.valdaEnheter ?? [] : [],
    levandeAvtal: tidigare?.levandeAvtal ?? {},
    kundkort,
    arvda,
    privat,
  }
}

/** Fältet i guiden skiljer sig från kundkortet (formatskillnader räknas inte). */
export function skiljerSig(k: KundKoppling, falt: MotpartsFalt, varde: string): boolean {
  if (falt === 'foretag' && k.privat) return false
  return FORMAT[falt](varde ?? '') !== FORMAT[falt](k.kundkort[falt] ?? '')
}

/** Namn på en kundrad i listor: enheter med sitt enhetsnamn. */
export function radNamn(r: AvtalsKund): string {
  return (r.parent_customer_id && r.site_name) || r.company_name || 'Namnlös kund'
}

/** Texten efter "Kopplad till": namn, kundnummer och omfattning. */
export function kopplingsText(k: KundKoppling, isContract: boolean): string {
  const rad = avtalspartRad(k)
  const foralder = foralderFor(k)
  const delar: string[] = [rad.company_name || radNamn(rad)]
  const nr = rad.customer_number ?? foralder?.customer_number ?? null
  if (nr != null) delar.push(`kundnr ${nr}`)
  const n = k.org.enheter.length
  if (foralder) {
    delar.push(`enhet under ${foralder.company_name ?? 'huvudkontoret'}`)
  } else if (harEnhetsval(k, isContract)) {
    const hkId = k.org.huvudkontor!.id
    if (k.omfattning === 'alla') delar.push(`hela verksamheten, ${enheterText(n)}`)
    else if (k.omfattning === 'valda') {
      const medHk = k.valdaEnheter.includes(hkId)
      const u = k.valdaEnheter.filter((id) => id !== hkId).length
      if (u === 0 && medHk) delar.push('bara huvudkontoret')
      else delar.push(`${medHk ? 'huvudkontoret och ' : ''}${u} av ${enheterText(n)}`)
    } else delar.push(`${enheterText(n)}, välj omfattning`)
  } else if (n > 0) {
    delar.push(enheterText(n))
  }
  return delar.join(', ')
}

/** Det som skickas till create-contract. Urvalet bara för avtal på huvudkontor med enheter. */
export function kopplingForApi(k: KundKoppling | null, isContract: boolean): {
  customerId: string | null
  siteIds: string[] | null
  coversAllSites: boolean
} {
  if (!k) return { customerId: null, siteIds: null, coversAllSites: false }
  const customerId = avtalspartRad(k).id
  if (!harEnhetsval(k, isContract)) return { customerId, siteIds: null, coversAllSites: false }
  if (k.omfattning === 'alla') return { customerId, siteIds: null, coversAllSites: true }
  return { customerId, siteIds: k.valdaEnheter.length > 0 ? [...k.valdaEnheter] : null, coversAllSites: false }
}
