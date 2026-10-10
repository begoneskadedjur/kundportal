// src/components/icons/set/lead.tsx
// Ritningar för leads (B2B). Godkända i docs/leads/leads-plan.html (#ikoner).
// Bara path-fragment: streckbredd och svg-attribut sätts i Icon.tsx.

import type { ReactNode } from 'react'

export const leadIcons = {
  // Måltavla: två ringar och en punkt i mitten
  'lead.lead': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  // Glödlampa
  'lead.tips': (
    <>
      <path d="M9.5 17.5h5M10.5 20.5h3" />
      <path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.6v.5h5v-.5c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5z" />
      <path d="M12 7.5a1.5 1.5 0 0 0-1.5 1.5" />
    </>
  ),
  // Person med pratbubbla
  'lead.tipsare': (
    <>
      <circle cx="9" cy="9.5" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15 3.5h5a1 1 0 0 1 1 1V8a1 1 0 0 1-1 1h-2.3L15.5 11V9H15a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
    </>
  ),
  // Ansvarig ägare: person med bock
  'lead.agare': (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 10.6-5" />
      <path d="M15.5 18l2 2 3.5-3.8" />
    </>
  ),
  // Källa: tratt
  'lead.kalla': <path d="M4 4.5h16l-6.2 7.6V18L10.2 20v-7.9L4 4.5z" />,
  // Årspremie: myntstapel
  'lead.varde': (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </>
  ),
  // Nästa steg: pil in i en öppen ruta
  'lead.nasta-steg': (
    <>
      <path d="M13.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4.5" />
      <path d="M3.5 12H14" />
      <path d="M10.5 8.5 14 12l-3.5 3.5" />
    </>
  ),
  // Att göra-kön: inkorgsbricka med bock
  'lead.att-gora': (
    <>
      <path d="M3.5 13.5 6 6a2 2 0 0 1 1.9-1.5h8.2A2 2 0 0 1 18 6l2.5 7.5V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4.5z" />
      <path d="M3.5 13.5h4.3l1.4 2.3h5.6l1.4-2.3h4.3" />
      <path d="M9.5 9.3l1.7 1.7 3.3-3.3" />
    </>
  ),
  // Vunnen: pokal
  'lead.vunnen': (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 5.5H5.5v1a3 3 0 0 0 2.6 3M16 5.5h2.5v1a3 3 0 0 1-2.6 3" />
      <path d="M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5z" />
    </>
  ),
  // Förlorad: bruten länk
  'lead.forlorad': (
    <>
      <path d="M9.5 14.5 7.2 16.8a3 3 0 0 1-4.2-4.2L5.3 10.3" />
      <path d="M14.5 9.5l2.3-2.3a3 3 0 0 1 4.2 4.2l-2.3 2.3" />
      <path d="M8.5 3.5l.8 2.3M3.5 8.5l2.3.8M15.5 20.5l-.8-2.3M20.5 15.5l-2.3-.8" />
    </>
  ),
  // Parkerad: paus
  'lead.parkerad': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  // Merförsäljning: staplade lådor med uppåtpil
  'lead.merforsaljning': (
    <>
      <rect x="3.5" y="13" width="9" height="7.5" rx="1.5" />
      <rect x="5" y="6.5" width="6" height="6.5" rx="1.5" />
      <path d="M17.5 20.5v-12M14.5 11.5l3-3 3 3" />
    </>
  ),
} satisfies Record<`lead.${string}`, ReactNode>
