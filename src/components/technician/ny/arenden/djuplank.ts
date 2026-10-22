// src/components/technician/ny/arenden/djuplank.ts
// Djuplänkar till Mina ärenden, samma format som gamla TechnicianCases:
//   /technician/cases?openCase=<id>&caseType=private|business|contract
// Global sök (searchModel.caseHref) och uppföljningslistan länkar så. comm=1 öppnar
// kommunikationen direkt (comm saknas eller comm=0 öppnar bara ärendet).
//
// Ärenden som inte finns i listan (till exempel arkiverade) letas upp på id och
// öppnas bara om teknikern är tilldelad, som i gamla vyn.

import { supabase } from '../../../../lib/supabase'
import type { ArendeKalla } from '../../../../services/teknikerDagService'

export function kallaForCaseType(ct: string | null): ArendeKalla | null {
  if (ct === 'private' || ct === 'business') return ct
  if (ct === 'contract' || ct === 'cases') return 'cases'
  return null
}

/** Letar upp källan för ett ärende utanför listan. Null om det saknas eller inte är teknikerns. */
export async function hittaKalla(id: string, technicianId: string, kalla: ArendeKalla | null): Promise<ArendeKalla | null> {
  const ordning: ArendeKalla[] = kalla ? [kalla] : ['private', 'business', 'cases']
  for (const k of ordning) {
    if (k === 'cases') {
      const { data } = await supabase.from('cases')
        .select('primary_technician_id, secondary_technician_id, tertiary_technician_id')
        .eq('id', id).maybeSingle()
      if (!data) continue
      return [data.primary_technician_id, data.secondary_technician_id, data.tertiary_technician_id].includes(technicianId) ? k : null
    }
    const { data } = await supabase.from(k === 'private' ? 'private_cases' : 'business_cases')
      .select('primary_assignee_id, secondary_assignee_id, tertiary_assignee_id')
      .eq('id', id).maybeSingle()
    if (!data) continue
    return [data.primary_assignee_id, data.secondary_assignee_id, data.tertiary_assignee_id].includes(technicianId) ? k : null
  }
  return null
}
