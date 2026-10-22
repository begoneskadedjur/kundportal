// src/components/icons/set/allman.tsx
// Allmänna ikoner. De första ritningarna är godkända i docs/leads/leads-plan.html
// (#ikoner); las, marknad, arkiv, aterstall och meny kommer från WebLeadIcons.

import type { ReactNode } from 'react'

export const allmanIcons = {
  // Företag: kontorshus med fönster
  'allman.foretag': (
    <>
      <rect x="4.5" y="3" width="10" height="18" rx="1.5" />
      <path d="M14.5 9h3.5a1.5 1.5 0 0 1 1.5 1.5V21M3 21h18" />
      <path d="M8 7h3M8 11h3M8 15h3" />
    </>
  ),
  // Kalenderblad med markerat datum
  'allman.kalender': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <rect x="13.5" y="13.5" width="3" height="3" rx=".6" />
    </>
  ),
  // Klocka (försenat)
  'allman.klocka': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // Historik: klocka med bakåtpil
  'allman.historik': (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  // Anteckning: penna
  'allman.anteckning': (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14 8l3 3" />
    </>
  ),
  // Foto: kamera med lins
  'allman.foto': (
    <>
      <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  // Statistik: staplar
  'allman.statistik': (
    <>
      <path d="M4 20h16" />
      <path d="M7 16.5v-4M12 16.5V7M17 16.5v-7" />
    </>
  ),
  // Ladda ner (export): pil ned i ett tråg
  'allman.ladda-ner': (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  // Filter: tre streck som blir kortare
  'allman.filter': <path d="M4 7h16M7 12h10M10 17h4" />,
  // Sök: lupp
  'allman.sok': (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  // Lista
  'allman.lista': (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="5" cy="6.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.5" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  'allman.plus': <path d="M12 5v14M5 12h14" />,
  'allman.bock': <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'allman.stang': <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  'allman.chevron': <path d="M9.5 6l6 6-6 6" />,
  // Föregående: chevron åt vänster (schemat i nya arbetsvyn)
  'allman.chevron-vanster': <path d="M14.5 6l-6 6 6 6" />,
  // Automatiskt: blixt
  'allman.blixt': <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3z" />,
  // För hand
  'allman.hand': (
    <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6M14 10.5V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3.6 16a1.5 1.5 0 0 1 2.3-2L8 16" />
  ),
  // Radera: papperskorg
  'allman.radera': (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  // Lås (från WebLeadIcons)
  'allman.las': (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5V17" />
    </>
  ),
  // Marknad: staplar med trendpil (från WebLeadIcons)
  'allman.marknad': (
    <>
      <path d="M4 20h16" />
      <path d="M7 17v-4M11.5 17v-6.5M16 17v-5" />
      <path d="M5 9.5l4.2-3.6 3 2.1L18 3.5" />
      <path d="M15 3.5h3v3" />
    </>
  ),
  // Arkiv: låda (WebLeadIcons och SearchIcons hade samma ritning)
  'allman.arkiv': (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 12.8h4" />
    </>
  ),
  // Återställ (från WebLeadIcons)
  'allman.aterstall': (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  // Meny: tre punkter (från WebLeadIcons)
  'allman.meny': (
    <>
      <circle fill="currentColor" stroke="none" cx="6" cy="12" r="1.4" />
      <circle fill="currentColor" stroke="none" cx="12" cy="12" r="1.4" />
      <circle fill="currentColor" stroke="none" cx="18" cy="12" r="1.4" />
    </>
  ),
  // Stjärna: kundens Account Manager
  'allman.stjarna': <path d="M12 3.8 14.23 9.23 20.08 9.67 15.61 13.47 17 19.18 12 16.1 7 19.18 8.39 13.47 3.92 9.67 9.77 9.23z" />,
  'allman.minus': <path d="M5 12h14" />,
  // Kalkyl: miniräknare
  'allman.kalkyl': (
    <>
      <rect x="5.5" y="3" width="13" height="18" rx="2" />
      <rect x="8" y="5.5" width="8" height="3.5" rx=".6" />
      <path d="M15 14.5v4" />
      <g fill="currentColor" stroke="none">
        <circle cx="9" cy="12.5" r=".95" />
        <circle cx="12" cy="12.5" r=".95" />
        <circle cx="15" cy="12.5" r=".95" />
        <circle cx="9" cy="15.5" r=".95" />
        <circle cx="12" cy="15.5" r=".95" />
        <circle cx="9" cy="18.5" r=".95" />
        <circle cx="12" cy="18.5" r=".95" />
      </g>
    </>
  ),
  // Laddar: tre fjärdedels cirkel, snurras med animate-spin
  'allman.laddar': <path d="M20.5 12A8.5 8.5 0 1 1 12 3.5" />,
  // Tema: halvmåne (ljust och mörkt läge), från upphandlingsskissen 2026-10-15
  'allman.tema': <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A6.5 6.5 0 0 1 12 3.5z" />,
  // Logga ut: dörrkarm med pil ut
  'allman.logga-ut': (
    <>
      <path d="M13.5 4.5h-7A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h7" />
      <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
} satisfies Record<`allman.${string}`, ReactNode>
