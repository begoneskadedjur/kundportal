// src/components/icons/set/arendelista.tsx
// Ritningar för Mina ärenden i nya arbetsvyn (lägen, sortering, ålder och tomma lägen).
// Följer Icon.tsx: 24x24, streck 1,6 sätts av komponenten, rundade ändar.

import type { ReactNode } from 'react'

export const arendelistaIcons = {
  // Att göra: lista med bock på första raden
  'arendelista.att-gora': (
    <>
      <path d="m4 6.5 1.6 1.6 3-3.1" />
      <path d="M11.5 7h8.5M11.5 12.5h8.5M11.5 18h8.5" />
      <circle cx="6" cy="12.5" r="1.4" />
      <circle cx="6" cy="18" r="1.4" />
    </>
  ),
  // Kommande: kalender med pil framåt
  'arendelista.kommande': (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M9 14.5h6M13 12.5l2 2-2 2" />
    </>
  ),
  // Avslutade: arkivlåda med bock
  'arendelista.avslutade': (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" />
      <path d="M5 9v8.5A2 2 0 0 0 7 19.5h10a2 2 0 0 0 2-2V9" />
      <path d="m9.5 13.8 1.8 1.8 3.4-3.5" />
    </>
  ),
  // Behöver en tid: kalender med plus
  'arendelista.boka': (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M12 12.5v5M9.5 15h5" />
    </>
  ),
  // Passerat besök att avsluta: kalender med klocka
  'arendelista.passerad': (
    <>
      <path d="M11 20H6a2.5 2.5 0 0 1-2.5-2.5v-10A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5V11" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="17" cy="17" r="4" />
      <path d="M17 15.2V17l1.2 1" />
    </>
  ),
  // Sortera: två pilar upp och ner
  'arendelista.sortera': (
    <>
      <path d="M8 19V5M4.5 8.5 8 5l3.5 3.5" />
      <path d="M16 5v14M12.5 15.5 16 19l3.5-3.5" />
    </>
  ),
  // Ålder: timglas
  'arendelista.alder': (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M7.5 3.5v2.2a4.5 4.5 0 0 0 2 3.7L12 11l2.5-1.6a4.5 4.5 0 0 0 2-3.7V3.5" />
      <path d="M7.5 20.5v-2.2a4.5 4.5 0 0 1 2-3.7L12 13l2.5 1.6a4.5 4.5 0 0 1 2 3.7v2.2" />
    </>
  ),
  // Tomt läge: tom korg med bock ovanför
  'arendelista.tomt': (
    <>
      <path d="M3.5 13.5 6 6.5h12l2.5 7v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 13.5h5l1 2h5l1-2h5" />
      <path d="m9.5 10 1.7 1.7L14.5 8.4" />
    </>
  ),
} satisfies Record<`arendelista.${string}`, ReactNode>
