// src/components/technician/ny/utrustning/etableringInfo.ts
// Uträkningar för en pågående etablering på Stationer: ort, dagar sedan
// bokningen (svensk kalenderdag) och om den räknas som bortglömd.

import { ortUrAdress, svenskDag } from '../../../../services/teknikerDagService'
import type { PagaendeEtableringRad } from './usePagaendeEtableringar'
import { dagarMellan } from './utrustningUi'

/** Dagar efter bokningen utan placerade stationer innan etableringen räknas som bortglömd (beslut 2026-10-23) */
export const GLOMD_EFTER_DAGAR = 30

export interface EtableringInfo {
  rad: PagaendeEtableringRad
  ort: string
  /** Kalenderdagar sedan bokningen, null utan bokning */
  dagar: number | null
  glomd: boolean
}

export function etableringInfo(rad: PagaendeEtableringRad, idag: string = svenskDag()): EtableringInfo {
  const dagar = rad.bokad ? dagarMellan(svenskDag(new Date(rad.bokad)), idag) : null
  return {
    rad,
    ort: rad.adress ? ortUrAdress(rad.adress) : '',
    dagar,
    glomd: rad.placerade === 0 && dagar !== null && dagar > GLOMD_EFTER_DAGAR,
  }
}
