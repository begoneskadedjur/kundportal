// src/components/icons/set/sok.tsx
// Söklådans träfftyper. Flyttade från SearchIcons.tsx utan ändring (arkiv ligger
// som allman.arkiv eftersom ritningen var densamma i WebLeadIcons).

import type { ReactNode } from 'react'

export const sokIcons = {
  // Ärende: protokollet med skadedjuret på
  'sok.arende': (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <ellipse cx="12" cy="14.6" rx="2.2" ry="3" />
      <circle cx="12" cy="10.4" r="1" />
      <path d="M9.8 13l-1.6-.9M9.8 14.8H8M9.9 16.6l-1.6.9M14.2 13l1.6-.9M14.2 14.8H16M14.1 16.6l1.6.9" />
    </>
  ),
  // Avtalsärende: protokollet med återkommande pil
  'sok.arende-avtal': (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M15.2 13.8a3.2 3.2 0 1 1-1.1-2.6" />
      <path d="M14.6 9.3v2.2h2.2" />
    </>
  ),
  // Kund, privat: villan
  'sok.kund-privat': (
    <>
      <path d="M3.5 11.2L12 4.3l8.5 6.9" />
      <path d="M6 9.6v10.4h12V9.6" />
      <path d="M10.4 20v-5h3.2v5" />
    </>
  ),
  // Kund, företag: huset med annex
  'sok.kund-foretag': (
    <>
      <rect x="4.5" y="3.5" width="10" height="17" rx="1" />
      <path d="M14.5 9h4a1 1 0 0 1 1 1v10.5h-5" />
      <path d="M7.5 7h1M10.5 7h1M7.5 10.5h1M10.5 10.5h1M7.5 14h1M10.5 14h1M16.8 12.5h.4M16.8 15.5h.4" />
      <path d="M8.5 20.5v-3h2v3" />
    </>
  ),
  // Stationsvy: vikt karta med stationerna utplacerade
  'sok.stationer': (
    <>
      <path d="M3 6.6l5.6-2.1 6.8 2.1L21 4.5v13l-5.6 2.1-6.8-2.1L3 19.6z" />
      <path d="M8.6 4.5v13M15.4 6.6v13" opacity=".5" />
      <rect fill="currentColor" stroke="none" x="4.6" y="9.2" width="2.6" height="2.2" rx=".5" />
      <rect fill="currentColor" stroke="none" x="10.7" y="12.6" width="2.6" height="2.2" rx=".5" />
      <rect fill="currentColor" stroke="none" x="16.8" y="8.2" width="2.6" height="2.2" rx=".5" />
    </>
  ),
  // Offert: dokumentet med prislapp
  'sok.offert': (
    <>
      <path d="M13.5 21H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7l4 4v4" />
      <path d="M14 3v4h4" />
      <path d="M9 9.5h4.5M9 12.5h3" />
      <path d="M14.2 17.6l3.4-3.4h3.4v3.4l-3.4 3.4z" />
      <circle fill="currentColor" stroke="none" cx="19.2" cy="16" r=".75" />
    </>
  ),
  // Avtal: dokumentet med signatur
  'sok.avtal': (
    <>
      <path d="M18 9.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7l4 4" />
      <path d="M14 3v4h4" />
      <path d="M9 9.5h5" />
      <path d="M8.6 16.4c.9-1.6 1.7-1.7 2.1-.2.3 1.2.9 1.4 1.8.1.7-1 1.3-1.1 1.7 0 .3.7.8.8 1.5.3" />
      <path d="M8.6 18.8h6.8" opacity=".5" />
    </>
  ),
  // Lead webb: formuläret på begone.se
  'sok.lead-webb': (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 8.3h18" />
      <circle fill="currentColor" stroke="none" cx="5.6" cy="6.4" r=".7" />
      <circle fill="currentColor" stroke="none" cx="7.8" cy="6.4" r=".7" />
      <path d="M6.3 11.8h7M6.3 14.8h4.5" />
      <path d="M14.8 12.6l4.6 1.8-2 .8-.8 2z" />
    </>
  ),
  // Lead B2B: målet med pil
  'sok.lead-b2b': (
    <>
      <circle cx="11" cy="13" r="7.5" />
      <circle cx="11" cy="13" r="4" />
      <circle fill="currentColor" stroke="none" cx="11" cy="13" r="1.2" />
      <path d="M11 13l8-8M16.5 4.5H19.5V7.5" />
    </>
  ),
  // Faktura: kvittot med tandad kant
  'sok.faktura': (
    <>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8h6M9 11h6M9 14h3.5" />
    </>
  ),
  // Tekniker: person med keps
  'sok.tekniker': (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path fill="currentColor" stroke="none" d="M8.7 8.1a3.4 3.4 0 0 1 6.6 0z" />
      <path d="M8 8.1h9" />
      <path d="M5.5 20.5c.8-3.7 3.4-5.6 6.5-5.6s5.7 1.9 6.5 5.6" />
    </>
  ),
  // Sida: gå till
  'sok.sida': (
    <>
      <path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" />
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
    </>
  ),
  // Åtgärd: skapa
  'sok.atgard': <path d="M12 6.5v11M6.5 12h11" />,
  // Senast öppnade: klockan
  'sok.senast': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // Förstoringsglaset i sökfältet. Ritat för streck 1,8: SearchGlass skickar
  // strokeWidth={1.8} för att behålla utseendet.
  'sok.glas': (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
} satisfies Record<`sok.${string}`, ReactNode>
