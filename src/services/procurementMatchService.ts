// src/services/procurementMatchService.ts
// Matchning av upphandlingar mot bevakningsreglerna. Själva poängregeln är en
// ren funktion i src/shared/procurementRules.ts (scoreNotice, testad i
// procurementRules.test.ts) som synk-cronen också använder, så att en
// förhandsvisning i Inställningar ger exakt samma poäng som synken.

import { ProcurementService } from './procurementService'
import {
  DEFAULT_WATCH_RULES,
  DIRECT_NOTIFY_SCORE,
  NOTIFY_SCORE,
  scoreNotice,
  type MatchInput,
  type MatchResult,
} from '../shared/procurementRules'
import type { ProcurementWatchRule } from '../types/procurement'

export type { MatchInput, MatchResult }

export class ProcurementMatchService {
  static readonly NOTIFY_SCORE = NOTIFY_SCORE
  static readonly DIRECT_NOTIFY_SCORE = DIRECT_NOTIFY_SCORE

  /** Ren funktion: poäng och förklaring för en upphandling mot givna regler */
  static score(input: MatchInput, rules: Array<Pick<ProcurementWatchRule, 'name' | 'rule_type' | 'cpv_prefixes' | 'keywords' | 'county_codes' | 'points' | 'active'>> = DEFAULT_WATCH_RULES): MatchResult {
    return scoreNotice(input, rules)
  }

  /** Poäng mot reglerna i databasen (för förhandsvisning i Inställningar) */
  static async scoreWithSavedRules(input: MatchInput): Promise<MatchResult> {
    const rules = await ProcurementService.listWatchRules()
    return scoreNotice(input, rules.length > 0 ? rules : DEFAULT_WATCH_RULES)
  }

  /** Nivå för visning: direktträff, träff eller under tröskeln */
  static level(score: number): 'direct' | 'match' | 'below' {
    if (score >= DIRECT_NOTIFY_SCORE) return 'direct'
    if (score >= NOTIFY_SCORE) return 'match'
    return 'below'
  }
}
