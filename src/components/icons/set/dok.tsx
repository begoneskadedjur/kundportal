// src/components/icons/set/dok.tsx
// Ritningar för dokument. Godkända i docs/leads/leads-plan.html (#ikoner).

import type { ReactNode } from 'react'

export const dokIcons = {
  // Offert: dokument med vikt hörn och kr
  'dok.offert': (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M9 12.5v5M9 15.3l2.3-2.8M10.1 14.1l1.5 3.4M13.5 14.3v3.2M13.5 15.5c.3-.8 1-1.2 1.8-1.1" />
    </>
  ),
  // Avtal: dokument med signaturslinga
  'dok.avtal': (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 11.5h5" />
      <path d="M8 16.5c.8-1.6 1.7-1.6 2.2-.2s1.4 1.4 2.2-.4 1.6-1 2.3.6" />
    </>
  ),
} satisfies Record<`dok.${string}`, ReactNode>
