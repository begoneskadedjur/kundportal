// src/components/icons/set/tillbud.tsx
// Ritningar för Tillbud och avvikelser (2026-10-24): de tre typerna, registret,
// utredningen, berörda och anmälan till myndighet.
// Följer Icon.tsx: 24x24, streck 1,6 sätts av komponenten, rundade ändar.

import type { ReactNode } from 'react'

export const tillbudIcons = {
  // Oj! Tillbud: ett öga, nära ögat
  'tillbud.tillbud': (
    <>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 2.5v1.2M5.2 4.6l.8.9M18.8 4.6l-.8.9" />
    </>
  ),
  // Aj! Olycka: plåster på snedden
  'tillbud.olycka': (
    <>
      <rect x="2.6" y="8.2" width="18.8" height="7.6" rx="3.8" transform="rotate(-45 12 12)" />
      <path d="M12.2 8l3.8 3.8M8 12.2l3.8 3.8" />
      <circle cx="11" cy="12" r=".5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r=".5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r=".5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r=".5" fill="currentColor" stroke="none" />
    </>
  ),
  // Hmm Avvikelse: vägen viker av från den streckade rutinen
  'tillbud.avvikelse': (
    <>
      <path d="M3.5 17.5h6.5" />
      <path d="M13 17.5h1.5M17.5 17.5h3" />
      <path d="M10 17.5c3.5 0 5-2.5 6.5-6.5l1.5-4" />
      <path d="M15 7.5l3-1.5 1.5 3" />
    </>
  ),
  // Registret: pärm med flikar
  'tillbud.register': (
    <>
      <rect x="4.5" y="3" width="13" height="18" rx="1.8" />
      <path d="M8 3v18" />
      <path d="M17.5 6.5h2v3h-2M17.5 11.5h2v3h-2" />
      <path d="M11 8h3.5M11 11.5h3.5" />
    </>
  ),
  // Utredning: förstoringsglas över ett blad
  'tillbud.utredning': (
    <>
      <path d="M13 20.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5h8l4 4V10" />
      <path d="M14 3.5v4h4" />
      <path d="M8 9h3M8 12.5h2.5" />
      <circle cx="16" cy="15.5" r="3" />
      <path d="M18.2 17.7l2.3 2.3" />
    </>
  ),
  // Berörda: två personer
  'tillbud.berorda': (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5a6 6 0 0 1 12 0" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.3a6 6 0 0 1 3.5 5.2" />
    </>
  ),
  // Anmälan till myndighet: byggnad med pelare
  'tillbud.myndighet': (
    <>
      <path d="M3.5 9 12 4l8.5 5z" />
      <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8" />
      <path d="M3.5 20.5h17M4.5 17.5h15" />
    </>
  ),
} satisfies Record<`tillbud.${string}`, ReactNode>
