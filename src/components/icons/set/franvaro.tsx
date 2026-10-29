// src/components/icons/set/franvaro.tsx
// Frånvarotyperna i schemat (3.108.0). Godkända i skissen "Frånvaro i schemat"
// 2026-10-29. Möte använder kontakt.mote, grupper bokning.team.

import type { ReactNode } from 'react'

export const franvaroIcons = {
  // Admin: bärbar dator med textrader
  'franvaro.admin': (
    <>
      <rect x="5" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 18.5h18M8.5 8.5h7M8.5 11.5h4" />
    </>
  ),
  // Utbildning: studentmössa
  'franvaro.utbildning': (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.6V16c1.5 1.4 3.5 2.1 5.5 2.1s4-.7 5.5-2.1v-4.4M21.5 9.5v5" />
    </>
  ),
  // Kundbesök: hus med dörr
  'franvaro.kundbesok': (
    <>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  // Bilservice: skiftnyckel
  'franvaro.bilservice': (
    <path d="M15 3.5a4.5 4.5 0 0 0-4.3 5.9L4.2 15.9a2 2 0 0 0 2.9 2.9l6.5-6.5A4.5 4.5 0 0 0 20 8l-2.6 2.6-2.8-.6-.6-2.8L16.6 4A4.5 4.5 0 0 0 15 3.5z" />
  ),
  // Semester: parasoll
  'franvaro.semester': (
    <>
      <path d="M3.5 11.5a8.5 8.5 0 0 1 17 0z" />
      <path d="M12 3v.5M12 11.5V18a2 2 0 0 1-4 0" />
    </>
  ),
  // Sjukdom: termometer
  'franvaro.sjukdom': (
    <>
      <path d="M10 14.3V5a2 2 0 0 1 4 0v9.3a3.6 3.6 0 1 1-4 0z" />
      <path d="M12 9v6.8" />
    </>
  ),
  // VAB: vuxen och barn
  'franvaro.vab': (
    <>
      <circle cx="8.5" cy="6.5" r="2.5" />
      <path d="M4 20v-4a4.5 4.5 0 0 1 9 0v4" />
      <circle cx="17" cy="11.5" r="2" />
      <path d="M14 20v-2a3 3 0 0 1 6 0v2" />
    </>
  ),
  // Föräldraledighet: barnvagn
  'franvaro.foraldraledig': (
    <>
      <path d="M3 5.5h2.5L7 13h12a7 7 0 0 0-7-7v7" />
      <circle cx="9" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  // Tjänstledighet: resväska
  'franvaro.tjanstledig': (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5v-2A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17" />
    </>
  ),
  // Kompledigt: timglas
  'franvaro.komp': (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5" />
    </>
  ),
  // Läkarbesök: vårdkors
  'franvaro.lakare': <path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z" />,
  // Övrigt: ruta med tre punkter
  'franvaro.ovrigt': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <circle cx="7.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // Flytta: fyra pilar
  'franvaro.flytta': (
    <path d="M12 3.5v17M3.5 12h17M9.5 6L12 3.5 14.5 6M9.5 18l2.5 2.5 2.5-2.5M6 9.5L3.5 12 6 14.5M18 9.5l2.5 2.5-2.5 2.5" />
  ),
} satisfies Record<`franvaro.${string}`, ReactNode>
