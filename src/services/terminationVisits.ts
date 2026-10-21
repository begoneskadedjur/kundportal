// src/services/terminationVisits.ts
// Besök efter ett uppsagt avtals sista giltiga dag. Uppsägningen avbokade
// tidigare bara kontrollsessionerna, och de kopplade ärendena låg kvar som
// Bokad i schemat. Nu tas båda bort (ärendet får status Borttaget, samma som
// Radera), och en ångrad uppsägning återställer båda.
//
// Delas av TerminateContractModal (alla kundens avtal) och
// ContractScopeService.terminateContract/reactivateContract (ett avtal).

import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'

type Filter = { contractId: string } | { customerIds: string[] }

/** Sista giltiga dagens slut i svensk tid. Besök PÅ sista dagen ska genomföras. */
function endOfDay(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  return toLocalISOStringWithOffset(new Date(y, m - 1, d, 23, 59, 59))
}

function sessionsQuery(filter: Filter, status: 'scheduled' | 'cancelled', afterDate: string) {
  const q = supabase
    .from('station_inspection_sessions')
    .select('id, case_id')
    .eq('status', status)
    .gt('scheduled_at', endOfDay(afterDate))
  return 'contractId' in filter ? q.eq('contract_id', filter.contractId) : q.in('customer_id', filter.customerIds)
}

/**
 * Avboka bokade kontroller efter sista giltiga dag och ta bort deras ärenden
 * ur schemat. Ärenden som redan är avslutade eller borttagna rörs inte.
 */
export async function cancelVisitsAfterEnd(
  filter: Filter,
  effectiveEndDate: string
): Promise<{ sessions: number; cases: number }> {
  const { data: sessions, error } = await sessionsQuery(filter, 'scheduled', effectiveEndDate)
  if (error) throw new Error(`Kunde inte hämta framtida kontroller: ${error.message}`)
  const sessionIds = (sessions ?? []).map(s => s.id as string)
  const caseIds = (sessions ?? []).map(s => s.case_id as string | null).filter((id): id is string => !!id)

  let cases = 0
  if (caseIds.length > 0) {
    const { data: removed, error: caseErr } = await supabase
      .from('cases')
      .update({ status: 'Borttaget' })
      .in('id', caseIds)
      .not('status', 'in', '("Avslutat","Borttaget")')
      .select('id')
    if (caseErr) throw new Error(`Kunde inte ta bort ärendena efter slutdatumet: ${caseErr.message}`)
    cases = removed?.length ?? 0
  }

  if (sessionIds.length > 0) {
    const { error: sessErr } = await supabase
      .from('station_inspection_sessions')
      .update({ status: 'cancelled' })
      .in('id', sessionIds)
    if (sessErr) throw new Error(`Kunde inte avboka kontrollerna: ${sessErr.message}`)
  }
  return { sessions: sessionIds.length, cases }
}

/**
 * Ångrad uppsägning: boka om kontrollerna som avbokades efter det gamla
 * slutdatumet och lägg tillbaka deras ärenden i schemat.
 */
export async function restoreVisitsAfterEnd(
  filter: Filter,
  previousEndDate: string
): Promise<{ sessions: number; cases: number }> {
  const { data: sessions, error } = await sessionsQuery(filter, 'cancelled', previousEndDate)
  if (error) throw new Error(`Kunde inte hämta avbokade kontroller: ${error.message}`)
  const sessionIds = (sessions ?? []).map(s => s.id as string)
  const caseIds = (sessions ?? []).map(s => s.case_id as string | null).filter((id): id is string => !!id)

  if (sessionIds.length > 0) {
    const { error: sessErr } = await supabase
      .from('station_inspection_sessions')
      .update({ status: 'scheduled' })
      .in('id', sessionIds)
    if (sessErr) throw new Error(`Kunde inte boka om kontrollerna: ${sessErr.message}`)
  }

  let cases = 0
  if (caseIds.length > 0) {
    const { data: restored, error: caseErr } = await supabase
      .from('cases')
      .update({ status: 'Bokad' })
      .in('id', caseIds)
      .eq('status', 'Borttaget')
      .select('id')
    if (caseErr) throw new Error(`Kunde inte återställa ärendena: ${caseErr.message}`)
    cases = restored?.length ?? 0
  }
  return { sessions: sessionIds.length, cases }
}
