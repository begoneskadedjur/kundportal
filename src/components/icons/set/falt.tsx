// src/components/icons/set/falt.tsx
// Ritningar för teknikerns vardag i fält (nya arbetsvyn 2026-10, skissen Ikoner.dc.html).
// Befintliga ritningar återanvänds under sina namn: kontakt.telefon (Ring), station.runda,
// arende.station, allman.foto, allman.anteckning, dok.avtal, dok.offert, rapport.avvikelse
// (Tillbud), station.klar, kalla.ai, allman.plus (Skapa) och allman.meny (Mer).

import type { ReactNode } from 'react'

export const faltIcons = {
  // Navigera: pilen som pekar framåt
  'falt.navigera': <path d="M4 11.5 20 4l-7.5 16-2.1-6.4z" />,
  // Framme: kartnål med bock
  'falt.framme': (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <path d="m9.3 10 1.9 1.9 3.6-3.7" />
    </>
  ),
  // Karta: vikt karta
  'falt.karta': (
    <>
      <path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  // Dagens rutt: tre stopp i följd
  'falt.rutt': (
    <>
      <circle cx="6" cy="5.5" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="6" cy="18.5" r="2" />
      <path d="M8 6.5l8 4.5M16 13l-8 4.5" />
    </>
  ),
  // Min position: sikte med fylld mittpunkt
  'falt.position': (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  // Restid: bilen framifrån
  'falt.bil': (
    <>
      <path d="M4.5 17v-4.5l2-5h11l2 5V17z" />
      <path d="M4.5 12.5h15M6.5 17v2M17.5 17v2" />
      <circle cx="8" cy="14.8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14.8" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  // Idag: kalenderblad med markerad dag
  'falt.idag': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15.2" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  // Vecka: kalenderblad med en veckorad markerad (schemat)
  'falt.vecka': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <rect x="6.5" y="13" width="11" height="3" rx=".6" />
    </>
  ),
  // Månad: kalenderblad med dagarna som punkter (schemat)
  'falt.manad': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="8" cy="13.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  // Imorgon: kalenderblad med pil framåt
  'falt.imorgon': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8.5 15.2h6.5M12.8 13l2.2 2.2-2.2 2.2" />
    </>
  ),
  // Fälla: slagfälla med bygel
  'falt.falla': (
    <>
      <rect x="3.5" y="13" width="17" height="6" rx="1.5" />
      <path d="M6.5 13c0-4 2.5-7 5.5-7s5.5 3 5.5 7" />
      <circle cx="12" cy="16" r="1" />
    </>
  ),
  // Ny station: betesstation med plustecken
  'falt.nystation': (
    <>
      <rect x="3.5" y="10" width="13" height="9" rx="2" />
      <path d="M7 19v1.5M13 19v1.5" />
      <circle cx="10" cy="14.5" r="1.8" />
      <path d="M19 3.5v6M16 6.5h6" />
    </>
  ),
  // Portkod, nyckel
  'falt.portkod': (
    <>
      <circle cx="8" cy="15.5" r="3.5" />
      <path d="M10.5 13 19 4.5M16 7.5l2 2M13.8 9.7l1.6 1.6" />
    </>
  ),
  // Rapport att skicka: dokument med bock
  'falt.rapport': (
    <>
      <path d="M6 3.5h8l4 4v13H6z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 13.5l2 2 4-4" />
    </>
  ),
  // Specialrapport: dokument med förstoringsglas
  'falt.specialrapport': (
    <>
      <path d="M6 3.5h8l4 4v13H6z" />
      <path d="M14 3.5v4h4" />
      <circle cx="11.5" cy="13.5" r="2.6" />
      <path d="M13.4 15.4 15.5 17.5" />
    </>
  ),
  // Signera: penna över linje
  'falt.signera': (
    <>
      <path d="M3.5 20.5h8" />
      <path d="M14.5 5.5l4 4L9 19H5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </>
  ),
  // Provision: plånbok
  'falt.provision': (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2" />
      <path d="M3.5 10.5h17" />
      <path d="M15.5 15h2" />
      <path d="M6.5 7l8.5-3 1 3" />
    </>
  ),
  // Att göra: bockad lista
  'falt.attgora': (
    <>
      <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5 5.5 14 8 11.5M4 18.5 5.5 20 8 17.5" />
      <path d="M11 7h9M11 13h9M11 19h6" />
    </>
  ),
  // Väntar på kund: timglas
  'falt.vantar': (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5c0 4 8 5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5-8 8.5s8 4.5 8 8.5" />
    </>
  ),
  // Visa mig hur: frågetecken i ring
  'falt.visamig': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.8-1.1 1.5v.3" />
      <circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  // Stegraden i ärendet (skissen PaPlats.dc.html). Framme = falt.framme,
  // Foton och preparat = allman.foto, Rapport = falt.rapport.
  // Arbetet: skiftnyckel
  'falt.arbete': <path d="M14.5 4.5a4.5 4.5 0 0 0-5.3 5.8L4 15.5a2.1 2.1 0 0 0 3 3l5.2-5.2a4.5 4.5 0 0 0 5.8-5.3l-2.6 2.6-2.6-.6-.6-2.6z" />,
  // Bedömning: trafikljus
  'falt.bedomning': (
    <>
      <rect x="8" y="2.5" width="8" height="19" rx="3" />
      <circle cx="12" cy="7" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="17" r="1.6" />
    </>
  ),
  // Pris och fakturering: kvitto
  'falt.pris': (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </>
  ),
  // Klart: bock i ring
  'falt.klart': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.3l2.6 2.6 5-5.3" />
    </>
  ),
  // Ärendets verktyg: verktygslåda
  'falt.verktyg': (
    <>
      <rect x="3.5" y="8" width="17" height="11.5" rx="2" />
      <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3.5 13h17" />
      <path d="M11 13v2h2v-2" />
    </>
  ),
  // Alla uppgifter i ärendet (flikvyn): punktlista
  'falt.uppgifter': (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="5" cy="6.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.5" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  // Rapportera bugg: skalbagge (sidomenyn i nya arbetsvyn, ingen ritning i skissen)
  'falt.bugg': (
    <>
      <path d="M9 7.5a3 3 0 0 1 6 0" />
      <rect x="7" y="7.5" width="10" height="11.5" rx="5" />
      <path d="M12 11v8M3.5 13.5H7M17 13.5h3.5M5 9l2.2 1.4M19 9l-2.2 1.4M5 18.5l2.2-1.4M19 18.5l-2.2-1.4" />
    </>
  ),
  // Preparat: laboratorieflaska med vätska (fakturamodalens Utfört arbete, 2026-10)
  'falt.preparat': (
    <>
      <path d="M9.5 3.5h5M10.5 3.5v5.2L5.8 17.3A2.2 2.2 0 0 0 7.7 20.5h8.6a2.2 2.2 0 0 0 1.9-3.2L13.5 8.7V3.5" />
      <path d="M7.6 14h8.8" />
      <circle cx="11" cy="17" r=".7" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="16.2" r=".5" fill="currentColor" stroke="none" />
    </>
  ),
} satisfies Record<`falt.${string}`, ReactNode>
