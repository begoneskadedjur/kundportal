// src/utils/contractLifecycle.ts
//
// EN definition av vad ett avtals livscykel betyder. Delas av läsvägar
// (resolver, prislistor, fakturering, schemaläggning) och av vyerna, så att
// samma avtal aldrig kan räknas som aktivt på ett ställe och avslutat på ett
// annat.
//
// Bakgrunden: filtret fanns i tre inkompatibla varianter — status-listan
// (missade uppsagda), status + billing_active (stängde av uppsagda avtal
// direkt i stället för vid slutdatumet) och en visningshjälpare i
// useCustomerRecord som ingen funktionell väg anropade.
//
// TRE tillstånd, inte två:
//   'active'             — löper normalt
//   'terminated-running' — uppsagt, men slutdatumet har inte passerat. Avtalet
//                          FUNGERAR fortfarande: det faktureras och schemaläggs
//                          fram till sista giltiga dagen.
//   'ended'              — avslutat. Ligger kvar för spårbarhet men får inte
//                          plockas upp av någon funktionell väg.
//
// Rullande avtalsmodell: ett passerat contract_end_date UTAN uppsägning betyder
// INTE att avtalet är slut — det förlängs automatiskt vid periodskifte. Bara
// terminated_at eller status 'ended' avslutar ett avtal.

/** Minsta form en avtalsrad behöver ha för att bedömas. */
export interface ContractLifecycleFields {
  status?: string | null
  terminated_at?: string | null
  effective_end_date?: string | null
  contract_end_date?: string | null
  billing_active?: boolean | null
}

export type ContractState = 'active' | 'terminated-running' | 'ended'

/** Dagens datum som ÅÅÅÅ-MM-DD i lokal svensk tid (aldrig UTC). */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Sista dag avtalet gäller, eller null när det löper tills vidare.
 * effective_end_date (satt vid uppsägning) vinner över contract_end_date.
 */
export function contractLastValidDay(c: ContractLifecycleFields): string | null {
  return c.effective_end_date ?? c.contract_end_date ?? null
}

/**
 * Avtalet är avslutat.
 *
 * Jämförelsen sker på datumSTRÄNG, inte Date-objekt: ett avtal vars sista
 * giltiga dag är idag ska räknas som aktivt HELA dagen. Tidigare jämfördes
 * mot new Date() inklusive klockslag, vilket gjorde att avtalet dog 00:01
 * på sin sista dag — en dag före cron-jobbet, så vy och backend gick isär.
 */
export function isEndedContract(c: ContractLifecycleFields, today: string = todayKey()): boolean {
  if ((c.status ?? '') === 'ended') return true
  if (!c.terminated_at) return false
  const end = contractLastValidDay(c)
  if (!end) return true // uppsagt utan slutdatum = avslutat omedelbart
  return end < today
}

/** Uppsagt men löper fortfarande — fungerar fullt ut till slutdatumet. */
export function isTerminatedButRunning(
  c: ContractLifecycleFields,
  today: string = todayKey()
): boolean {
  return !!c.terminated_at && !isEndedContract(c, today)
}

/** Vilket av de tre tillstånden avtalet befinner sig i. */
export function contractState(
  c: ContractLifecycleFields,
  today: string = todayKey()
): ContractState {
  if (isEndedContract(c, today)) return 'ended'
  if (isTerminatedButRunning(c, today)) return 'terminated-running'
  return 'active'
}

/**
 * Avtalet är funktionellt levande: får faktureras, schemaläggas och kopplas
 * till nya ärenden. Uppsagt-men-löpande ingår — det är hela poängen med
 * uppsägningstid.
 *
 * OBS: billing_active läses medvetet INTE här. Flaggan är överlastad (den
 * betyder både "pausad fakturering" och "uppsagd" beroende på vem som skrev
 * den) och att läsa den som livscykelsignal är just det som gjorde att
 * uppsagda avtal slutade fungera direkt i stället för vid slutdatumet.
 * Använd isBillingPaused() när det är fakturering du faktiskt frågar om.
 */
export function isLiveContract(c: ContractLifecycleFields, today: string = todayKey()): boolean {
  return !isEndedContract(c, today)
}

/**
 * Faktureringen är pausad — separat från livscykeln. Ett levande avtal kan
 * ha pausad fakturering (kreditstopp, tvist) utan att vara uppsagt.
 */
export function isBillingPaused(c: ContractLifecycleFields): boolean {
  return c.billing_active === false
}

/** Antal dagar kvar till sista giltiga dagen; null när avtalet löper tills vidare. */
export function daysUntilEnd(
  c: ContractLifecycleFields,
  today: string = todayKey()
): number | null {
  const end = contractLastValidDay(c)
  if (!end) return null
  const diff = Date.parse(`${end}T12:00:00`) - Date.parse(`${today}T12:00:00`)
  return Math.max(0, Math.round(diff / 86_400_000))
}

/**
 * Statusvärden som kan bära ett levande avtal. Används som DB-förfilter —
 * det är ett grovfilter, inte ett svar: raderna måste ändå köras genom
 * isLiveContract() eftersom ett uppsagt avtal ligger kvar på 'signed' fram
 * till slutdatumet.
 */
export const LIVE_CONTRACT_STATUSES = ['signed', 'active'] as const

/**
 * Statusar att hämta när avtal ska VISAS. 'ended' måste med — uppsagda avtal
 * ska ligga kvar i vyn för spårbarhet.
 */
export const VISIBLE_CONTRACT_STATUSES = ['signed', 'active', 'trashed', 'ended'] as const

/** Filtrerar bort avslutade avtal ur en lista. */
export function onlyLiveContracts<T extends ContractLifecycleFields>(
  rows: T[],
  today: string = todayKey()
): T[] {
  return rows.filter((r) => isLiveContract(r, today))
}

/**
 * Avtalet kommer från Oneflow (till skillnad från importerat eller
 * portalskapat). source_type duger INTE för detta — den är 'manual' även för
 * Oneflow-avtal. Ursprunget syns bara på id-prefixet och template_id.
 */
export function isOneflowContract(c: {
  oneflow_contract_id?: string | null
  template_id?: string | null
}): boolean {
  const oid = c.oneflow_contract_id ?? ''
  if (oid.startsWith('local-') || oid.startsWith('imported-') || oid.startsWith('pdf-import')) {
    return false
  }
  const tid = c.template_id ?? ''
  if (tid === 'local' || tid === 'imported') return false
  return /^\d+$/.test(oid)
}

/** Importrest — en rad som bär historik men inte är ett riktigt avtal. */
export function isImportedContractRow(c: {
  oneflow_contract_id?: string | null
  template_id?: string | null
}): boolean {
  return c.template_id === 'imported' || (c.oneflow_contract_id ?? '').startsWith('imported-')
}
