// src/components/icons/set/station.tsx
// Ritningar för stationskontrollen (kontrollrundan, stationsmodalen, typbyte och flytt).
// Godkända i skissen "Stationskontroll före och efter" (ikonbladet, 2026-10-14).
// Bara path-fragment: streckbredd och svg-attribut sätts i Icon.tsx.

import type { ReactNode } from 'react'

export const stationIcons = {
  // Flytta: streckad gammal plats, båge med pil, ny kartnål
  'station.flytta': (
    <>
      <circle cx="5.5" cy="17.5" r="2" strokeDasharray="1.6 1.9" />
      <path d="M7.3 15.4C8.6 10.6 11.2 7.6 14.6 6.4" />
      <path d="M12.2 4.9l2.6 1.4-1.3 2.6" />
      <path d="M18 21s3.5-3.1 3.5-6.1a3.5 3.5 0 0 0-7 0C14.5 17.9 18 21 18 21z" />
      <circle cx="18" cy="14.9" r="1.1" />
    </>
  ),
  // Byt typ: två pilbågar runt en liten station
  'station.byttyp': (
    <>
      <path d="M4.5 10A8 8 0 0 1 18.4 6.2" />
      <path d="M15 6.6h3.8V2.8" />
      <path d="M19.5 14A8 8 0 0 1 5.6 17.8" />
      <path d="M9 17.4H5.2v3.8" />
      <rect x="9" y="9.5" width="6" height="5" rx="1" />
    </>
  ),
  // Historik: klocka med bakåtpil
  'station.historik': (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4v4h4" />
      <path d="M12 8v4.2l2.8 1.8" />
    </>
  ),
  // Hämta upp: station med pil uppåt
  'station.hamtaupp': (
    <>
      <rect x="3.5" y="13" width="17" height="7.5" rx="1.5" />
      <path d="M9.5 20.5v-1.8a2.5 2.5 0 0 1 5 0v1.8" />
      <path d="M12 10V2.8" />
      <path d="M8.6 6.2 12 2.8l3.4 3.4" />
    </>
  ),
  // OK: bock
  'station.ok': <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // Klarmarkera ärendet: bock i cirkel
  'station.klar': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.3l2.6 2.6 5-5.3" />
    </>
  ),
  // Starta runda: slingrande väg mellan två punkter
  'station.runda': (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
    </>
  ),
  // Sammanställning: fyra staplar
  'station.summa': <path d="M5 20V12M10 20V6M15 20v-9M20 20V4" />,
  // Utomhus: kartnål
  'station.ute': (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  // Inomhus: hus med dörr
  'station.inne': (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M5.5 20.5V9.5L12 4l6.5 5.5v11" />
      <path d="M10 20.5v-5h4v5" />
    </>
  ),
} satisfies Record<`station.${string}`, ReactNode>
