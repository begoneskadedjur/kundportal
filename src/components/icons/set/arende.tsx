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
  // Station: fällbox med ingångshål
  'arende.station': (
    <>
      <rect x="3.5" y="8" width="17" height="10" rx="2" />
      <path d="M7.5 18v2M16.5 18v2" />
      <path d="M3.5 13h3M17.5 13h3" />
      <circle cx="12" cy="13" r="2" />
    </>
  ),
} satisfies Record<`arende.${string}`, ReactNode>
