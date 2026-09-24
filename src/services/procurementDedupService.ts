// src/services/procurementDedupService.ts
// Dedup av upphandlingar mellan källor, i planens ordning (avsnitt 7):
//   1. källa + käll-id (Mercells TED-poster bär TED-numret, normaliseras)
//   2. köparens orgnr (eller normaliserat namn) + normaliserad titel + sista anbudsdag
//   3. reserv: trigramlikhet på titel över 0,6 med samma köpare och sista dag
//      inom en dag, via RPC procurement_find_similar_notice
// Steg 1 och 2 är rena funktioner här och i src/shared/procurementRules.ts.
// Själva sammanslagningen sker på servern (ingestNotice i api/_lib/procurement.ts)
// eftersom RPC:n och källtabellerna bara skrivs av service role.

import {
  buildDedupKey,
  normalizeName,
  normalizeOrgNumber,
  normalizeTedNumber,
  normalizeTitle,
  type DedupInput,
} from '../shared/procurementRules'

export type { DedupInput }

/** Trigramtröskeln för reserven */
export const TRIGRAM_THRESHOLD = 0.6

export class ProcurementDedupService {
  static key(input: DedupInput): string {
    return buildDedupKey(input)
  }

  static sameNotice(a: DedupInput, b: DedupInput): boolean {
    return buildDedupKey(a) === buildDedupKey(b)
  }

  /** Nyckel för källpost: TED-nummer normaliseras så att Mercell och TED möts */
  static sourceKey(source: string, sourceId: string): string {
    const ted = normalizeTedNumber(sourceId)
    return ted ? `ted:${ted}` : `${source}:${sourceId}`
  }

  static normalizeTitle = normalizeTitle
  static normalizeName = normalizeName
  static normalizeOrgNumber = normalizeOrgNumber
  static normalizeTedNumber = normalizeTedNumber
}
