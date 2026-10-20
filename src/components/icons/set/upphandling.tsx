// src/components/icons/set/upphandling.tsx
// Upphandlingsportalens ikoner (docs/upphandlingsportal-ux-plan.md avsnitt 6).
// Ritningarna kommer från skissen upphandling-skiss.html (version 3, godkänd
// 2026-10-15). Streckbredden sätts i Icon.tsx, aldrig här.

import type { ReactNode } from 'react'

export const upphandlingIcons = {
  // Sol som går upp över horisonten: Idag
  'upphandling.idag': (
    <>
      <path d="M3 17.5h18" />
      <path d="M7 17.5a5 5 0 0 1 10 0" />
      <path d="M12 6v2.5M5.6 9.6l1.7 1.7M18.4 9.6l-1.7 1.7M8 21h8" />
    </>
  ),
  // Kikare: Framförhållning
  'upphandling.framforhallning': (
    <>
      <circle cx="6.8" cy="16" r="3.6" />
      <circle cx="17.2" cy="16" r="3.6" />
      <path d="M3.4 15 5.6 6.4A1.6 1.6 0 0 1 7.2 5.2h.6A1.6 1.6 0 0 1 9.4 6.8V14" />
      <path d="M20.6 15 18.4 6.4a1.6 1.6 0 0 0-1.6-1.2h-.6a1.6 1.6 0 0 0-1.6 1.6V14" />
      <path d="M9.4 10h5.2" />
    </>
  ),
  // Timglas: Avtalsklocka
  'upphandling.avtalsklocka': (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3v2.6a4.5 4.5 0 0 0 2 3.7L12 11l2.5-1.7a4.5 4.5 0 0 0 2-3.7V3" />
      <path d="M7.5 21v-2.6a4.5 4.5 0 0 1 2-3.7L12 13l2.5 1.7a4.5 4.5 0 0 1 2 3.7V21" />
      <path d="M10 19h4" />
    </>
  ),
  // Punkt med vågor åt båda håll: Signaler
  'upphandling.signal': (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  // Staplar, den sista streckad: Prognos per kvartal
  'upphandling.prognos': (
    <>
      <path d="M3.5 20h17" />
      <path d="M6.5 16.5v-4M10.5 16.5V9M14.5 16.5v-6" />
      <path d="M18.5 16.5V5.5" strokeDasharray="1.6 2.6" />
    </>
  ),
  // Megafon: Annonser
  'upphandling.annons': (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2.5L15 19.5v-15L7.5 9H5a1 1 0 0 0-1 1z" />
      <path d="M7.5 15l1.3 4.5h2.4L10.3 16.3" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  // Kuvert med ett blad som sticker upp: Anbud
  'upphandling.anbud': (
    <>
      <path d="M6.5 12.5V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v8" />
      <path d="M9.5 7h5M9.5 10h5" />
      <path d="M3 11.5V19a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 19v-7.5" />
      <path d="M3 11.5l9 5.5 9-5.5" />
    </>
  ),
  // Tre kolumner med kort: Anbudstavlan
  'upphandling.tavla': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
      <path d="M5 7.5h2M11 7.5h2M11 10.5h2M17 7.5h2" />
    </>
  ),
  // Pil in i en kolumn: Ta upp en annons
  'upphandling.ta-upp': (
    <>
      <rect x="13.5" y="3.5" width="7" height="17" rx="1.5" />
      <path d="M3.5 12h7" />
      <path d="M8 9l3 3-3 3" />
    </>
  ),
  // Mapp med blad: Underlag
  'upphandling.underlag': (
    <>
      <path d="M6.5 8V3.5h11V9" />
      <path d="M3 9.5A1.5 1.5 0 0 1 4.5 8H9l1.8 2h8.7A1.5 1.5 0 0 1 21 11.5v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
    </>
  ),
  // Lista med bockrutor: Kravlista
  'upphandling.krav': (
    <>
      <rect x="3.5" y="3.5" width="4.5" height="4.5" rx="1" />
      <rect x="3.5" y="9.75" width="4.5" height="4.5" rx="1" />
      <rect x="3.5" y="16" width="4.5" height="4.5" rx="1" />
      <path d="M4.7 5.8l1 1 1.3-1.8M4.7 12l1 1 1.3-1.8" />
      <path d="M11 5.75h9.5M11 12h9.5M11 18.25h6" />
    </>
  ),
  // Tabell med summarad: Prisbilaga
  'upphandling.prisbilaga': (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 8.5h17M3.5 12.5h17M12.5 3.5v13M3.5 16.5h17" />
      <path d="M15 18.6h3" />
    </>
  ),
  // Rosett med band: Kvalitetssvar, anbudsbibliotek
  'upphandling.kvalitet': (
    <>
      <circle cx="12" cy="9.5" r="5.5" />
      <circle cx="12" cy="9.5" r="2" />
      <path d="M9 14.2 7.5 21l4.5-2.2 4.5 2.2-1.5-6.8" />
    </>
  ),
  // Pil ned i ett tråg: Inlämningskontroll, Markera som lämnat
  'upphandling.inlamning': (
    <>
      <path d="M12 3v9" />
      <path d="M8.5 8.5 12 12l3.5-3.5" />
      <path d="M4 14v5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-5" />
      <path d="M4 14h4l1.5 2h5l1.5-2h4" />
    </>
  ),
  // Pokal: Utfall, vunnen
  'upphandling.utfall': (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.5a3 3 0 0 0 3 4M16 6h2.5a3 3 0 0 1-3 4" />
      <path d="M12 13v3.5" />
      <path d="M9.5 16.5h5l.8 4h-6.6z" />
    </>
  ),
  // Rådhus med fronton och pelare: Köpare
  'upphandling.kopare': (
    <>
      <path d="M3.5 9 12 4l8.5 5z" />
      <path d="M5.5 11.5v6M10 11.5v6M14 11.5v6M18.5 11.5v6" />
      <path d="M4 20.5h16M4.5 17.5h15" />
    </>
  ),
  // Schackbonde: Konkurrenter
  'upphandling.konkurrent': (
    <>
      <circle cx="12" cy="6.5" r="2.7" />
      <path d="M9.5 10h5" />
      <path d="M10.4 10 9 16.5h6L13.6 10" />
      <path d="M7.5 16.5h9l.8 4H6.7z" />
    </>
  ),
  // Cirkeldiagram med utbruten bit: Marknad
  'upphandling.marknadsandel': (
    <>
      <path d="M11 4.5a8 8 0 1 0 8.5 8.5H11z" />
      <path d="M14 3v7h7a7 7 0 0 0-7-7z" />
    </>
  ),
  // Pratbubbla med frågetecken: Fråga datan, frågor till köparen
  'upphandling.fraga': (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16h-.5A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M10 8.3a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.4" />
      <path d="M12 13.6v.1" />
    </>
  ),
  // Kalender med markerat intervall: Bearbetningsfönster
  'upphandling.fonster': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M7 15h10M7 13.5v3M17 13.5v3" />
    </>
  ),
  // Kalender med pil åt höger: Förlängningsoption
  'upphandling.forlangning': (
    <>
      <rect x="3" y="5" width="12" height="14" rx="2" />
      <path d="M3 9.5h12M7 3v4M11 3v4" />
      <path d="M17 14h4M19 11.5l2 2.5-2 2.5" />
    </>
  ),
  // Person med namnbricka: Kontaktperson hos köparen
  'upphandling.kontaktperson': (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20.5a7 7 0 0 1 14 0" />
      <path d="M10 16.5h4" />
    </>
  ),
  // Blad med blixt: Direktupphandling
  'upphandling.direkt': (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5v4h4" />
      <path d="M12.5 10.5 10 14.5h3.5L11 18.5" />
    </>
  ),
  // Ram med pil ut: Avrop från ramavtal
  'upphandling.avrop': (
    <>
      <path d="M16.5 13.5v5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h5" />
      <path d="M10.5 13.5 20.5 3.5" />
      <path d="M14.5 3.5h6v6" />
    </>
  ),
  // Blad med pratbubbla: Offertförfrågan
  'upphandling.offert': (
    <>
      <path d="M10 20.5H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h7l4 4v3" />
      <path d="M12 3.5v4h4" />
      <path d="M13 13.5h7a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-2.5L15 21v-2h-2a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1z" />
    </>
  ),
  // Tabell med pil ned: Exportera till Excel
  'upphandling.excel': (
    <>
      <rect x="3.5" y="3.5" width="12" height="12" rx="1.5" />
      <path d="M3.5 7.5h12M3.5 11.5h12M8 3.5v12" />
      <path d="M19 11v9.5M16.5 18l2.5 2.5 2.5-2.5" />
    </>
  ),
  // Ringklocka: Notiser
  'upphandling.notis': (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
      <path d="M12 3v2" />
    </>
  ),
  // Blad med frågetecken: RFI, frågeformulär (sedan 3.71.0)
  'upphandling.rfi': (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14.5 3.5V8H19" />
      <path d="M10.2 11.2a2.3 2.3 0 1 1 3.3 2.1c-.8.4-1 .9-1 1.7" />
      <path d="M12.5 18v.01" />
    </>
  ),
  // Blad med penna: Svar
  'upphandling.svar': (
    <>
      <path d="M13 20.5H5.5V3.5h9L18.5 7.5V10" />
      <path d="M9 8.5h5M9 12h4" />
      <path d="M19.5 12.5l2 2-6 6H13.5v-2z" />
    </>
  ),
  // Blad med bock: Markera som besvarad
  'upphandling.besvarad': (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14.5 3.5V8H19" />
      <path d="M9 14l2.3 2.3L16 11.5" />
    </>
  ),
  // Två pilar i en ring: Uppföljning
  'upphandling.uppfoljning': (
    <>
      <path d="M19.5 9.5A8 8 0 0 0 5 7.5" />
      <path d="M4.5 4v4h4" />
      <path d="M4.5 14.5A8 8 0 0 0 19 16.5" />
      <path d="M19.5 20v-4h-4" />
    </>
  ),
} satisfies Record<`upphandling.${string}`, ReactNode>
