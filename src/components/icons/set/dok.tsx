// src/components/icons/set/dok.tsx
// Ritningar för dokument. Godkända i docs/leads/leads-plan.html (#ikoner),
// konversation och dolj i planen för teknikerns Dokumentsignering (2026-10-23).

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
  // Konversation: pratbubbla med två rader (fliken Konversation, Svara kunden)
  'dok.konversation': (
    <>
      <path d="M4 5h16v10.5H10L6 19v-3.5H4z" />
      <path d="M8 8.8h8M8 12h5" />
    </>
  ),
  // Dölj: öga med snedstreck (Dölj i min lista, Visa dolda)
  'dok.dolj': (
    <>
      <path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .4 4.2 1.1M21.5 12s-3.5 6.5-9.5 6.5c-1.6 0-3-.4-4.2-1.1" />
      <path d="M9.9 14.1a3 3 0 0 1 4.2-4.2" />
      <path d="M4 20 20 4" />
    </>
  ),
  // Ny kund: person med plus (Kunden lades inte upp automatiskt, kontorets Dokumentsignering)
  'dok.ny-kund': (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 10.6-5" />
      <path d="M18 13.5v6M15 16.5h6" />
    </>
  ),
  // Omnämnd: snabel-a (Frågor och uppdrag, gruppen Omnämnd för kännedom och Nämn en kollega)
  'dok.omnamnd': (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M15.6 8.4v4.8a2.4 2.4 0 0 0 4.8 0V12a8.4 8.4 0 1 0-3.3 6.7" />
    </>
  ),
} satisfies Record<`dok.${string}`, ReactNode>
