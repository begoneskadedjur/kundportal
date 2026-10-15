// src/components/admin/procurement/watch/sortNotice.ts
// Ta upp eller Avstå en ny annons, samma beteende på Idag och Annonser:
// Ta upp sätter Bedöms (analyzing) och gör den som tar upp till ansvarig om
// ingen är satt, Avstå sätter Avstår. Annonsen markeras som läst och
// händelsen loggas via updateNotice.

import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import { refreshProcurementBadge } from '../../../../hooks/useProcurementBadge'
import type { ProcurementNotice } from '../../../../types/procurement'

export type SortPatch = Partial<Pick<ProcurementNotice, 'our_status' | 'owner_id'>>

export async function takeOrDecline(n: Pick<NoticeWithRelations, 'id' | 'owner_id'>, take: boolean, userId: string | null | undefined): Promise<SortPatch> {
  const patch: SortPatch = take ? { our_status: 'analyzing', ...(n.owner_id || !userId ? {} : { owner_id: userId }) } : { our_status: 'declined' }
  await ProcurementService.updateNotice(n.id, patch, take ? 'Upptagen: Bedöms' : 'Avstår')
  void ProcurementService.markSeen(n.id)
    .then(() => refreshProcurementBadge())
    .catch(() => undefined)
  return patch
}

export const TAKE_TOAST = 'Upptagen. Den ligger nu under Anbud som Bedöms.'
export const DECLINE_TOAST = 'Avstår. Annonsen är flyttad ur listan.'
