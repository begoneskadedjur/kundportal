// src/pages/shared/intranet/guider/registry.ts
// Guidemodulerna: en fil per guide, <slug>.tsx, med visningens skärm och övningen.
// Filerna hittas automatiskt, så en ny guide behöver inte registreras någonstans.
//
// En modul exporterar som default ett GuideModul-objekt:
//   Visning({ steg, onNasta }) ritar skärmen för steg nummer `steg` (0 = första)
//     med markor={{ pa: true, nr: steg + 1 }} på det man ska trycka på.
//     onNasta anropas när man trycker på det markerade, så visningen går vidare.
//   Ovning() är övningen: samma skärmar utan markörer, i skärmkitets OvningRam.

import type { ComponentType } from 'react'

export interface GuideModul {
  Visning?: ComponentType<{ steg: number; onNasta: () => void }>
  Ovning?: ComponentType
  /**
   * Enheter guiden ritar. ['mobil', 'dator'] = läsaren väljer (EnhetValjare), och
   * skärmarna läser useGuideEnhet(). Utelämnad: guidens intro.enhet gäller.
   */
  enheter?: ('mobil' | 'dator')[]
}

// Filer som börjar med _ är delade hjälpdelar för flera guider, inga moduler
const filer = import.meta.glob<{ default: GuideModul }>(['./*.tsx', '!./_*.tsx'], { eager: true })

export const GUIDE_MODULER: Record<string, GuideModul> = Object.fromEntries(
  Object.entries(filer).map(([sokvag, modul]) => [sokvag.replace(/^\.\//, '').replace(/\.tsx$/, ''), modul.default])
)
