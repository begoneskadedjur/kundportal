// src/components/icons/set/kund.tsx
// Ritningar för kundlistan Befintliga kunder: statusikonerna i uppläggningens
// ordning (avtal, Fortnox, fakturaväg, schema, kundportal), händelserna och
// hjälpen. Godkända i skissen för vyn Befintliga kunder 2026-10-22.

import type { ReactNode } from 'react'

export const kundIcons = {
  // Avtalspapper med hundöra, rader och signaturkryss
  'kund.avtal': (
    <path d="M6 2.8h8L19 7.8v12.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1z M14 2.8v4a1 1 0 0 0 1 1h4 M8 10h5 M8 13h8 M11 18.5h5.5 M7.9 16.9l1.6 1.6 M9.5 16.9l-1.6 1.6" />
  ),
  // Kundkort med nummertecken och rader (Fortnox-kundnumret)
  'kund.fortnox': (
    <path d="M3.5 6h17A1.5 1.5 0 0 1 22 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 16.5v-9A1.5 1.5 0 0 1 3.5 6z M6.6 9.4l-.8 5.2 M8.9 9.4l-.8 5.2 M5.2 11.1h4.3 M4.9 13h4.3 M12.5 10h6 M12.5 12.5h4 M12.5 15h5" />
  ),
  // Faktura som skickas iväg (fakturavägen)
  'kund.fakturavag': (
    <path d="M13 3.5H5.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1H12 M13 3.5V7a1 1 0 0 0 1 1h3.5V11 M13 3.5L17.5 8 M7.5 11h5 M7.5 14h3 M14 17h7.5 M18.5 14l3 3-3 3" />
  ),
  // Kalender med återkommande pil (schemat)
  'kund.schema': (
    <path d="M5.5 5.5h13A1.5 1.5 0 0 1 20 7v11.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5z M8.5 3.5v4 M15.5 3.5v4 M4 10h16 M14.6 14.2a2.8 2.8 0 1 0-.5 2.8 M14.8 12.4v1.9h-1.9" />
  ),
  // Portalbåge med person (kundportalen)
  'kund.portal': (
    <path d="M6 21V10a6 6 0 0 1 12 0v11 M4 21h16 M12 11.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z M9.2 17.4c.4-1.9 1.5-2.9 2.8-2.9s2.4 1 2.8 2.9" />
  ),
  // Händelse: ny avtalsperiod (varvpil med etta)
  'kund.period': (
    <path d="M19.4 9.2A8 8 0 1 0 20 12 M20.2 4.6v4.8h-4.8 M10.4 9.6l1.8-1.3v7.4 M10.4 15.7h3.6" />
  ),
  // Händelse: uppsagt avtal (dörr med utpil)
  'kund.uppsagd': (
    <path d="M13 4H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1H13 M10 12h10.5 M17.2 8.6L20.6 12l-3.4 3.4 M8.6 11.2v1.6" />
  ),
  // Händelse: tilläggsstationer att besluta (station med plus)
  'kund.beslut': (
    <path d="M3.5 11.5h11a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1z M6.2 20v-2.6a1.8 1.8 0 0 1 3.6 0V20 M2.5 14.5h13 M19 3.5v6 M16 6.5h6" />
  ),
  // Hjälp: frågetecken i ring
  'kund.hjalp': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 3.6 M12 16.9v.2" />
    </>
  ),
  // Information: i i ring
  'kund.info': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5 M12 7.6v.2" />
    </>
  ),
  // Kontrollerat avtal: avtalsdokument med bock i ring (avtalet stämt mot
  // signerat avtal och Fortnox). Godkänd i skissen Kontrollerade avtalsfakturor 2026-10-28.
  'kund.avtal-kontrollerat': (
    <>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.5" />
      <path d="M13.5 3v5h5" />
      <path d="M18.5 8v4" />
      <path d="M8.5 11.5h5M8.5 15h3" />
      <circle cx="17" cy="17.5" r="4" />
      <path d="M15.2 17.6l1.3 1.3 2.4-2.6" />
    </>
  ),
  // Ändrat efter kontrollen: avtalsdokument med utropstecken i ring. Samma skiss.
  'kund.avtal-andrat': (
    <>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.5" />
      <path d="M13.5 3v5h5" />
      <path d="M18.5 8v4" />
      <path d="M8.5 11.5h5M8.5 15h3" />
      <circle cx="17" cy="17.5" r="4" />
      <path d="M17 15.6v2.2" />
      <circle cx="17" cy="19.6" r=".5" fill="currentColor" stroke="none" />
    </>
  ),
} satisfies Record<`kund.${string}`, ReactNode>
