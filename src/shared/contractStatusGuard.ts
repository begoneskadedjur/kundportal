// src/shared/contractStatusGuard.ts
// Vem får ändra ett avtals status? Oneflow används bara fram till signering.
// Efter signering styr portalen: bara Säga upp (terminated_at), expire-contracts
// efter sista giltiga dag och "ersatt av nytt avtal" i avtalskartan avslutar ett
// avtal. Nattsynken och webhooken rör aldrig statusen på ett signerat avtal,
// oavsett om dokumentet saknas, raderas, avböjs eller avslutas i Oneflow.
// Beslut Christian 2026-11-03.
//
// Samma regler i databasen: triggern contracts_status_guard
// (migration 20261103_avtalsstatus_vakt.sql) stoppar en övergång från
// signed/active till ended/trashed/declined utan terminated_at eller godkänd källa.
// Inga DB-anrop: körs både i webben, i cron-jobbet och i webhooken.

/** Statusar efter signering: avtalet lever och styrs av portalen */
export const POST_SIGNING_STATUSES = ['signed', 'active'] as const
/** Statusar före signering: Oneflow styr (skickat, påminnelse, utgånget) */
export const PRE_SIGNING_STATUSES = ['draft', 'pending', 'overdue'] as const
/** Avslutande statusar */
export const TERMINAL_STATUSES = ['ended', 'trashed', 'declined'] as const

/** Oneflows state mappat till portalens status (samma tabell som förut i sync-oneflow) */
export const ONEFLOW_STATE_TO_STATUS: Record<string, string> = {
  pending: 'pending',
  signed: 'signed',
  declined: 'declined',
  overdue: 'overdue',
  canceled: 'declined',
  cancelled: 'declined',
  published: 'pending',
  completed: 'signed',
  expired: 'overdue',
}

// Status-prioritet före signering: aldrig nedgradera (overdue → pending sker
// bara via webhookens signing_period_revive, inte via nattsynken)
const PRE_SIGNING_PRIORITY: Record<string, number> = {
  draft: 0,
  pending: 1,
  overdue: 2,
  signed: 3,
  declined: 3,
}

export interface StatusRow {
  type?: string | null
  status?: string | null
  terminated_at?: string | null
}

/**
 * Ett signerat avtal (inte offert) med status signed eller active. Sådana rader
 * får aldrig ändra status från Oneflow. Offerter följer Oneflow som förut.
 */
export function isSignedContractRow(row: StatusRow | null | undefined): boolean {
  if (!row) return false
  if (row.type === 'offer') return false
  return (POST_SIGNING_STATUSES as readonly string[]).includes(row.status ?? '')
}

/** Raden är före signering (draft, pending eller overdue) */
export function isPreSigningRow(row: StatusRow | null | undefined): boolean {
  return !!row && (PRE_SIGNING_STATUSES as readonly string[]).includes(row.status ?? '')
}

export type SyncStatusDecision =
  | { change: true; to: string }
  | { change: false; reason: 'samma' | 'uppsagt' | 'signerat' | 'avslutat' | 'nedgradering' | 'okand_status' }

/**
 * Får nattsynken ändra raden till Oneflows status? Bara rader före signering
 * (draft, pending, overdue) och bara uppåt (pending → overdue/signed/declined).
 * Signerade, aktiva, avslutade och uppsagda rader rörs aldrig.
 */
export function syncStatusDecision(row: StatusRow, oneflowState: string): SyncStatusDecision {
  const to = ONEFLOW_STATE_TO_STATUS[oneflowState] ?? 'pending'
  const from = row.status ?? ''
  if (row.terminated_at) return { change: false, reason: 'uppsagt' }
  if ((TERMINAL_STATUSES as readonly string[]).includes(from)) return { change: false, reason: 'avslutat' }
  if ((POST_SIGNING_STATUSES as readonly string[]).includes(from)) return { change: false, reason: 'signerat' }
  if (!isPreSigningRow(row)) return { change: false, reason: 'okand_status' }
  if (from === to) return { change: false, reason: 'samma' }
  if ((PRE_SIGNING_PRIORITY[to] ?? 1) < (PRE_SIGNING_PRIORITY[from] ?? 1)) {
    return { change: false, reason: 'nedgradering' }
  }
  return { change: true, to }
}

/**
 * Avvikelse att logga: signerat avtal i portalen som Oneflow visar som något
 * annat än signerat (avböjt, makulerat, utgånget). Statusen ändras inte.
 */
export function signedContractDeviation(row: StatusRow, oneflowState: string): string | null {
  if (!isSignedContractRow(row)) return null
  const mapped = ONEFLOW_STATE_TO_STATUS[oneflowState] ?? oneflowState
  if (mapped === 'signed') return null
  return oneflowState
}

/**
 * Får en Oneflow-händelse (webhook) sätta ny status på raden? Inte på signerade
 * avtal; där loggas händelsen och portalen behåller statusen. Saknas raden
 * (null) gör uppdateringen ingenting och får köra som förut.
 */
export function webhookMayChangeStatus(row: StatusRow | null | undefined): boolean {
  return !isSignedContractRow(row)
}

/**
 * Nästa sida i Oneflows lista. `_links.next` är alltid ett objekt; slutet
 * markeras med `href: null`. Bara https://api.oneflow.com godtas, så att
 * API-nyckeln aldrig skickas någon annanstans.
 */
export function oneflowNextPageUrl(data: unknown): string | null {
  const href = (data as { _links?: { next?: { href?: unknown } | null } } | null)?._links?.next?.href
  if (typeof href !== 'string' || href.trim() === '') return null
  try {
    const url = new URL(href, 'https://api.oneflow.com')
    if (url.protocol !== 'https:' || url.hostname !== 'api.oneflow.com') return null
    return url.toString()
  } catch {
    return null
  }
}
