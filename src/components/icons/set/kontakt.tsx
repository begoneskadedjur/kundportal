// src/components/icons/set/kontakt.tsx
// Ritningar för kontaktvägar. Godkända i docs/leads/leads-plan.html (#ikoner).

import type { ReactNode } from 'react'

export const kontaktIcons = {
  // Telefonlur
  'kontakt.telefon': (
    <path d="M5.5 3.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3.5 5.5a2 2 0 0 1 2-2z" />
  ),
  // Kuvert med flik
  'kontakt.mejl': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.8 6.5 12 12.8l8.2-6.3" />
    </>
  ),
  // Möte: två personer vid ett bordsstreck
  'kontakt.mote': (
    <>
      <circle cx="8" cy="7.5" r="2.5" />
      <circle cx="16" cy="7.5" r="2.5" />
      <path d="M3.5 15a4.5 4.5 0 0 1 9 0M11.5 15a4.5 4.5 0 0 1 9 0" />
      <path d="M3 18.5h18" />
    </>
  ),
} satisfies Record<`kontakt.${string}`, ReactNode>
