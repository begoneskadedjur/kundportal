// src/components/technician/ny/steg/stegKonfig.ts
// Stegen i ärendet för nya arbetsvyn (Plan.dc.html avsnitt 2, matrisen).
//
// Sju steg finns: framme, arbete, bedomning, foton, rapport, pris, klart.
// Varje ärendetyp visar en delmängd. Steg som inte gäller typen tas bort och
// numreringen räknas om (Steg 2 av 5 osv.).
//
// Stegens id är samma som AvslutsHinder.steg i arendeAvslutService.ts, så att
// ett hinder från kontrolleraAvslut pekar direkt på ett steg.
//
// Användning:
//   const steg = useStegForArende('extra', { utanPris: isCustomerView })
//   <StegRad steg={steg} aktivt={aktivt} onValj={setAktivt} />

import { useMemo } from 'react'
import type { IconName } from '../../../icons/Icon'

export type StegId = 'framme' | 'arbete' | 'bedomning' | 'foton' | 'rapport' | 'pris' | 'klart'

export interface StegDef {
  id: StegId
  /** Stegets namn, skrivs ut för det aktiva steget */
  namn: string
  ikon: IconName
  /** Valfritt steg (Bedömning). Märks Valfritt och går att hoppa över. */
  valfritt?: boolean
}

/**
 * Ärendetyperna i matrisen.
 * - inspection     stationskontroll (cases, service_type inspection)
 * - establishment  etablering (cases, service_type establishment)
 * - extra          extrabesök (cases, routine/contract_extra och övriga avtalsärenden)
 * - rondering      rondering (RonderingCaseModal)
 * - egenkontroll   egenkontroll (EgenkontrollCaseModal)
 * - privat         privat- och företagsärenden (EditCaseModal)
 */
export type ArendeStegTyp = 'inspection' | 'establishment' | 'extra' | 'rondering' | 'egenkontroll' | 'privat'

export const ALLA_STEG: Record<StegId, StegDef> = {
  framme: { id: 'framme', namn: 'Framme', ikon: 'falt.framme' },
  arbete: { id: 'arbete', namn: 'Arbetet', ikon: 'falt.arbete' },
  bedomning: { id: 'bedomning', namn: 'Bedömning', ikon: 'falt.bedomning', valfritt: true },
  foton: { id: 'foton', namn: 'Foton och preparat', ikon: 'allman.foto' },
  rapport: { id: 'rapport', namn: 'Rapport', ikon: 'falt.rapport' },
  pris: { id: 'pris', namn: 'Pris och fakturering', ikon: 'falt.pris' },
  klart: { id: 'klart', namn: 'Klart', ikon: 'falt.klart' },
}

/**
 * Stegen per typ. Avvikelse mot matrisen: stationskontrollen har inget eget
 * steg Foton och preparat, eftersom bilderna och preparaten registreras per
 * station i kontrollrundan (steg Arbetet) och inte visas i ärendemodalen i dag.
 */
export const STEG_PER_TYP: Record<ArendeStegTyp, StegId[]> = {
  inspection: ['framme', 'arbete', 'rapport', 'pris', 'klart'],
  establishment: ['framme', 'arbete', 'foton', 'rapport', 'pris', 'klart'],
  extra: ['framme', 'arbete', 'bedomning', 'foton', 'rapport', 'pris', 'klart'],
  rondering: ['framme', 'arbete', 'foton', 'rapport', 'pris', 'klart'],
  egenkontroll: ['framme', 'arbete', 'rapport', 'klart'],
  privat: ['framme', 'arbete', 'foton', 'rapport', 'pris', 'klart'],
}

export interface StegVal {
  /** Dölj Pris och fakturering (till exempel kundvyn, där Ekonomi döljs i dag) */
  utanPris?: boolean
  /** Dölj Bedömning (till exempel när modalen inte visar bedömningen för ärendet) */
  utanBedomning?: boolean
  /** Dölj Foton och preparat */
  utanFoton?: boolean
  /** Byt namn på ett steg för typen, till exempel { arbete: 'Saneringen' } */
  namn?: Partial<Record<StegId, string>>
}

export function stegForArende(typ: ArendeStegTyp, val: StegVal = {}): StegDef[] {
  return STEG_PER_TYP[typ]
    .filter(id => !(val.utanPris && id === 'pris'))
    .filter(id => !(val.utanBedomning && id === 'bedomning'))
    .filter(id => !(val.utanFoton && id === 'foton'))
    .map(id => (val.namn?.[id] ? { ...ALLA_STEG[id], namn: val.namn[id]! } : ALLA_STEG[id]))
}

export function useStegForArende(typ: ArendeStegTyp, val: StegVal = {}): StegDef[] {
  const { utanPris, utanBedomning, utanFoton, namn } = val
  const namnNyckel = namn ? JSON.stringify(namn) : ''
  return useMemo(
    () => stegForArende(typ, { utanPris, utanBedomning, utanFoton, namn }),
    // namn jämförs som text så att ett inline-objekt inte räknar om listan varje rendering
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typ, utanPris, utanBedomning, utanFoton, namnNyckel]
  )
}

/** Avtalsärendets typ (cases.service_type) till stegtyp i EditContractCaseModal */
export function stegTypForAvtalsarende(serviceType: string | null | undefined): ArendeStegTyp {
  if (serviceType === 'inspection') return 'inspection'
  if (serviceType === 'establishment') return 'establishment'
  return 'extra'
}

/** Nästa och föregående steg i listan, null vid ändarna */
export function grannSteg(steg: StegDef[], aktivt: StegId): { foregaende: StegDef | null; nasta: StegDef | null } {
  const i = steg.findIndex(s => s.id === aktivt)
  return {
    foregaende: i > 0 ? steg[i - 1] : null,
    nasta: i >= 0 && i < steg.length - 1 ? steg[i + 1] : null,
  }
}

/** Klassen som visar eller döljer ett stegs innehåll. Steget hålls monterat (aldrig villkorad rendering). */
export function stegKlass(steg: StegId | StegId[], aktivt: StegId, synligKlass = ''): string {
  const lista = Array.isArray(steg) ? steg : [steg]
  return lista.includes(aktivt) ? synligKlass : 'hidden'
}
