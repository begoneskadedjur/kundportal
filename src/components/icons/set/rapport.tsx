// src/components/icons/set/rapport.tsx
// Ritningar för specialrapporterna (lista, redigerare, karta, händelser och utskick).
// Tagna ur den godkända skissen (Specialrapporter, 2026-10-14).
// Bara path-fragment: streckbredd och svg-attribut sätts i Icon.tsx.

import type { ReactNode } from 'react'

export const rapportIcons = {
  // Rapport: dokument med hörnvik och två rader
  'rapport.rapport': (
    <>
      <path d="M6 3.5h8l4 4v13H6z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12h6M9 15.5h6" />
    </>
  ),
  // Ny tom rapport: dokument med plus
  'rapport.tom': (
    <>
      <path d="M6 3.5h8l4 4v13H6z" />
      <path d="M14 3.5v4h4" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
  // Kopia: två blad
  'rapport.kopia': (
    <>
      <rect x="8" y="8" width="12.5" height="12.5" rx="2" />
      <path d="M16 8V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8" />
    </>
  ),
  // Karta: vikt karta
  'rapport.karta': (
    <>
      <path d="M3.5 6.5l5-2.5 7 3 5-2.5v13l-5 2.5-7-3-5 2.5z" />
      <path d="M8.5 4v13M15.5 7v13" />
    </>
  ),
  // Område: polygon med hörnpunkter
  'rapport.omrade': (
    <>
      <path d="M5 8l6-4.5 8 4-2 10.5-10 1z" />
      <circle cx="5" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="7" cy="19" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  // Sektion: blad med rubrikband
  'rapport.sektion': (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17" />
      <path d="M7 13h7M7 16h4" />
    </>
  ),
  // Händelser: tidslinje med två punkter
  'rapport.handelser': (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M6 8v8M11 6h9M11 18h9" />
    </>
  ),
  // Text: tre rader
  'rapport.text': <path d="M5 6h14M5 11h14M5 16h9" />,
  // Bilder: ram med sol och berg
  'rapport.bilder': (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 16l-5-5L6 19" />
    </>
  ),
  // Dra: sex greppunkter
  'rapport.dra': (
    <>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Skicka: pappersflygplan
  'rapport.skicka': (
    <>
      <path d="M20.5 3.5 10 14" />
      <path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z" />
    </>
  ),
  // Ladda ned: pil ned mot ett streck
  'rapport.ladda': (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  // Förhandsgranska: öga
  'rapport.forhandsgranska': (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // Hämta från ärendet: pil ned i ett tråg
  'rapport.hamta': (
    <>
      <path d="M12 3.5v10" />
      <path d="M8 9.5l4 4 4-4" />
      <path d="M4 14v5.5h16V14" />
    </>
  ),
  // Koppling till ärendet: två länkar
  'rapport.lank': (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  // Kartlager: tre staplade lager
  'rapport.lager': (
    <>
      <path d="M12 3.5 21 8l-9 4.5L3 8z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16l9 4.5 9-4.5" />
    </>
  ),
  // Ångra: böjd pil bakåt
  'rapport.angra': (
    <>
      <path d="M9 14 4.5 9.5 9 5" />
      <path d="M4.5 9.5H15a5 5 0 0 1 0 10h-3" />
    </>
  ),
  // Tillbaka: pil åt vänster
  'rapport.tillbaka': <path d="M19 12H5M11 6l-6 6 6 6" />,
  // Position: navigeringspil
  'rapport.position': <path d="M20.5 3.5 3.5 10.8l7.2 2.5 2.5 7.2z" />,

  // Händelsetyper
  // Inspektion: lupp
  'rapport.inspektion': (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  // Besök: kalender med bock
  'rapport.besok': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M9 15l2 2 4-4" />
    </>
  ),
  // Betning: betesstation
  'rapport.betning': (
    <>
      <path d="M4.2 10 5.6 7h12.8l1.4 3" />
      <rect x="2" y="10" width="20" height="8" rx="1.5" />
      <path d="M3.8 18v-1.7a1.5 1.5 0 0 1 3 0V18" />
      <path d="M17.2 18v-1.7a1.5 1.5 0 0 1 3 0V18" />
    </>
  ),
  // Åtgärd: skiftnyckel
  'rapport.atgard': (
    <path d="M15 4.5a4.5 4.5 0 0 0-4.3 5.8L4.5 16.5a2.1 2.1 0 0 0 3 3l6.2-6.2A4.5 4.5 0 0 0 19.5 9l-2.7 2.7-2.8-.7-.7-2.8z" />
  ),
  // Underleverantör: två personer
  'rapport.underlev': (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M15.5 14.2a4.5 4.5 0 0 1 5 5.3" />
    </>
  ),
  // Notering: blad med rader
  'rapport.notering': (
    <>
      <path d="M5 3.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20z" />
      <path d="M15 3.5v4h4" />
      <path d="M8.5 12h7M8.5 15.5h5" />
    </>
  ),
} satisfies Record<`rapport.${string}`, ReactNode>
