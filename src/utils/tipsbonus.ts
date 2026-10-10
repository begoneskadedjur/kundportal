// src/utils/tipsbonus.ts
// Tipsbonusens beloppsregel, samma som databasfunktionen tipsbonus_skapa (leads etapp 7):
// procent av första årets premie, höjt till lägsta belopp och sänkt till taket (0 = inget tak).
// Används av TipsbonusPanel på /admin/provisioner och av räknaren i handbokens leadsguider.

import type { TipsbonusSettings } from '../types/provision'

export function beraknaTipsbonus(
  premie: number,
  s: Pick<TipsbonusSettings, 'procent' | 'minBelopp' | 'maxBelopp' | 'minPremie'>,
): number {
  if (premie <= 0 || premie < s.minPremie) return 0
  let b = Math.round(premie * s.procent) / 100
  if (s.minBelopp > 0 && b < s.minBelopp) b = s.minBelopp
  if (s.maxBelopp > 0 && b > s.maxBelopp) b = s.maxBelopp
  return b
}
