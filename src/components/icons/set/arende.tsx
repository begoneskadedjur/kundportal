// src/components/icons/set/arende.tsx
// Ritningar för ärenden och fältarbete. Godkända i docs/leads/leads-plan.html (#ikoner).

import type { ReactNode } from 'react'

export const arendeIcons = {
  // Skrivplatta med klämma
  'arende.arende': (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4" />
    </>
  ),
  // Privatperson: villan
  'arende.privat': (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  // Rondering: cirkelpil runt en punkt
  'arende.rondering': (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v4h-4" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Ändra status: två motriktade bågpilar runt en punkt (statusknappen i
  // ärendemodalernas stepper, förslag A 2026-10-21)
  'arende.status': (
    <>
      <path d="M19.5 9.5A8 8 0 0 0 5.2 7.6" />
      <path d="M4.5 14.5a8 8 0 0 0 14.3 1.9" />
      <path d="M5 3.5v4.2h4.2" />
      <path d="M19 20.5v-4.2h-4.2" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  // Station: fällbox med ingångshål
  'arende.station': (
    <>
      <rect x="3.5" y="8" width="17" height="10" rx="2" />
      <path d="M7.5 18v2M16.5 18v2" />
      <path d="M3.5 13h3M17.5 13h3" />
      <circle cx="12" cy="13" r="2" />
    </>
  ),
  // Återbesök: två fotspår (ersätter lucide Footprints i ärendemodalerna)
  'arende.aterbesok': (
    <>
      <path d="M8 4.2c1.6 0 2.6 1.9 2.6 4.3 0 2.1-.9 3.6-2.5 3.6S5.5 10.6 5.5 8.5C5.5 6 6.4 4.2 8 4.2z" />
      <path d="M6.3 14.6c0 1.6.8 2.6 1.9 2.6s1.8-1 1.7-2.5" />
      <path d="M16 6.8c1.6 0 2.5 1.8 2.5 4.2 0 2.1-1 3.6-2.6 3.6s-2.5-1.5-2.5-3.6c0-2.4 1-4.2 2.6-4.2z" />
      <path d="M14.1 17.2c0 1.6.7 2.6 1.8 2.6s1.9-1 1.9-2.6" />
    </>
  ),
} satisfies Record<`arende.${string}`, ReactNode>
