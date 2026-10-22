// src/components/icons/set/utrustning.tsx
// Ritningar för Utrustning i nya arbetsvyn (kundlistan, kundens stationer,
// planritningar och etableringen). Stationstypernas egna symboler ritas inte
// här: de kommer ur src/shared/stationMarkers.ts via StationTypeTile.
// Bara path-fragment: streckbredd och svg-attribut sätts i Icon.tsx.

import type { ReactNode } from 'react'

export const utrustningIcons = {
  // Planritning: ritningsblad med rumsväggar och dörröppning
  'utrustning.planritning': (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M3.5 11h6.5v9" />
      <path d="M14 4v4.5M14 12v3.5h6.5" />
    </>
  ),
  // Enheter: huvudkontor med två mindre byggnader (multisite)
  'utrustning.enheter': (
    <>
      <path d="M9 20.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v15.5" />
      <path d="M3.5 20.5v-8A1.5 1.5 0 0 1 5 11h4M15 11h4a1.5 1.5 0 0 1 1.5 1.5v8" />
      <path d="M2.5 20.5h19" />
      <path d="M11.5 7.5h1M11.5 11h1M11.5 14.5h1" />
    </>
  ),
  // Uppdatera: cirkelpil
  'utrustning.uppdatera': (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4v4h-4" />
    </>
  ),
  // Stationskarta: dokument med kartnål
  'utrustning.stationskarta': (
    <>
      <path d="M6 2.8h8L19 7.8v12.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1z" />
      <path d="M14 2.8v4a1 1 0 0 0 1 1h4" />
      <path d="M12 18.5s3-2.6 3-5a3 3 0 0 0-6 0c0 2.4 3 5 3 5z" />
      <circle cx="12" cy="13.5" r=".9" />
    </>
  ),
  // Byt bild: bildram med cirkelpil i hörnet
  'utrustning.bytbild': (
    <>
      <path d="M13 19.5H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5h14A1.5 1.5 0 0 1 20.5 6v6" />
      <path d="m3.5 15.5 4.5-4.5 4 4" />
      <circle cx="15.5" cy="9" r="1.5" />
      <path d="M21 17.5a3 3 0 1 1-1-2.2" />
      <path d="M20.6 13.6v1.9h-1.9" />
    </>
  ),
  // Sortera: två pilar upp och ned
  'utrustning.sortera': (
    <>
      <path d="M8 4v16M4.5 7.5 8 4l3.5 3.5" />
      <path d="M16 20V4M12.5 16.5 16 20l3.5-3.5" />
    </>
  ),
  // Kontroller: skrivplatta med bock
  'utrustning.kontroller': (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
      <path d="M9 4.5V3.5h6v1" />
      <path d="m8.8 13 2.2 2.2 4.3-4.6" />
    </>
  ),
  // Placera: kartnål med plus
  'utrustning.placera': (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <path d="M12 7.2v5.6M9.2 10h5.6" />
    </>
  ),
} satisfies Record<`utrustning.${string}`, ReactNode>
