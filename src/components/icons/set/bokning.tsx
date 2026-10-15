// src/components/icons/set/bokning.tsx
// Ritningar för Nytt ärende och bokningsförslagen (3.57.0).

import type { ReactNode } from 'react'

export const bokningIcons = {
  // Extrabesök: skrivplatta med plusbricka
  'bokning.extrabesok': (
    <>
      <path d="M12.5 20.5H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5" />
      <rect x="7.5" y="3" width="5" height="3" rx="1" />
      <path d="M7.5 10.5h5M7.5 14h3" />
      <circle cx="17.5" cy="17.5" r="3.6" />
      <path d="M17.5 15.9v3.2M15.9 17.5h3.2" />
    </>
  ),
  // Etablering: fällbox med pil ned
  'bokning.etablering': (
    <>
      <path d="M12 2.8v6.4M9.2 6.6 12 9.4l2.8-2.8" />
      <rect x="4" y="12.5" width="16" height="7" rx="2" />
      <path d="M4 16h2.5M17.5 16H20" />
      <circle cx="12" cy="16" r="1.8" />
    </>
  ),
  // Bokningsförslag: kalenderblad med lupp
  'bokning.forslag': (
    <>
      <path d="M11 18H5.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <path d="M3.5 9.5h14M7.5 3v3.5M13.5 3v3.5" />
      <circle cx="16" cy="16" r="3.2" />
      <path d="M18.4 18.4 21 21" />
    </>
  ),
  // Team: två tekniker med keps
  'bokning.team': (
    <>
      <circle cx="9" cy="9" r="3" />
      <path fill="currentColor" stroke="none" d="M6.1 8.3a3 3 0 0 1 5.8 0z" />
      <path d="M6.1 8.3h7.4" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path fill="currentColor" stroke="none" d="M14.05 9a2.5 2.5 0 0 1 4.9 0z" />
      <path d="M14.05 9h6.2" />
      <path d="M15.5 14.2a4.5 4.5 0 0 1 5 5.3" />
    </>
  ),
  // Restid: servicebilen från sidan
  'bokning.restid': (
    <>
      <path d="M5 16.5H3.5V13l2.2-1 2-3.7a1.5 1.5 0 0 1 1.3-.8h6a1.5 1.5 0 0 1 1.2.6l2.8 3.9 1.5.5v4H19" />
      <path d="M9 16.5h6M5.7 12h13.8M12 7.5V12" />
      <circle cx="7" cy="16.5" r="2" />
      <circle cx="17" cy="16.5" r="2" />
    </>
  ),
  // Effektivitet: mätare med visare
  'bokning.effektivitet': (
    <>
      <path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" />
      <path d="M12 6.8v1.4M6.9 9l1 1" />
      <path d="M12 14.1l4.2-2.6" />
      <circle cx="12" cy="14.1" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Artikel: kartong med tejp
  'bokning.artikel': (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
      <path d="M8 5.3l8 4.5" />
    </>
  ),
  // Avtalstillägg: avtalet med plusbricka
  'bokning.avtalstillagg': (
    <>
      <path d="M12.5 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v3.5" />
      <path d="M14 3v5h5" />
      <path d="M8.5 11.5h4" />
      <path d="M8 16c.7-1.4 1.5-1.4 1.9-.2s1.1 1.1 1.7-.2" />
      <circle cx="17.5" cy="17.5" r="3.6" />
      <path d="M17.5 15.9v3.2M15.9 17.5h3.2" />
    </>
  ),
  // Bokningsbekräftelse: kuvert med bockbricka
  'bokning.bekraftelse': (
    <>
      <path d="M12.5 18.5H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5h14A1.5 1.5 0 0 1 20.5 7v4.5" />
      <path d="M3.8 6.5 12 12.5l8.2-6" />
      <circle cx="17.5" cy="17.5" r="3.6" />
      <path d="M15.9 17.6l1.1 1.1 2.1-2.3" />
    </>
  ),
} satisfies Record<`bokning.${string}`, ReactNode>
