// src/components/icons/set/konto.tsx
// Ikoner för Mitt konto (UserProfile): visa lösenord, tema, appen på hemskärmen
// och stegen för iPhone och Android. Ritade efter ikonstandarden i Icon.tsx.

import type { ReactNode } from 'react'

export const kontoIcons = {
  // Visa lösenordet: öppet öga (motsatsen är dok.dolj)
  'konto.oga': (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // Ljust tema: sol med strålar
  'konto.sol': (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  // Följer systemet: skärm med en halv sol och en halv måne
  'konto.system': (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" />
      <path d="M9 20.5h6M12 16.5v4" />
      <path d="M12 7.5a3 3 0 0 0 0 6z" />
      <path d="M12 7.5a3 3 0 0 1 0 6" />
    </>
  ),
  // Appen på hemskärmen: telefon med appikoner i rutnät
  'konto.app': (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
      <rect x="9" y="6" width="2.5" height="2.5" rx=".6" />
      <rect x="12.5" y="6" width="2.5" height="2.5" rx=".6" />
      <rect x="9" y="10" width="2.5" height="2.5" rx=".6" />
      <path d="M11 18.5h2" />
    </>
  ),
  // Dela-knappen i Safari: ruta med pil uppåt
  'konto.dela': (
    <>
      <path d="M8.5 9.5H7a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17 9.5h-1.5" />
      <path d="M12 14V3.5M8.5 7 12 3.5 15.5 7" />
    </>
  ),
  // Lägg till på hemskärmen: rundad ruta med plus
  'konto.hemskarm': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  // Webbläsarens meny i Android: tre punkter på rad uppifrån och ner
  'konto.webbmeny': (
    <>
      <circle cx="12" cy="5.5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="18.5" r="1.2" />
    </>
  ),
  // Hjälptexter: textrader med en liten (i)
  'konto.hjalptext': (
    <>
      <path d="M4 6.5h10M4 11h7M4 15.5h6" />
      <circle cx="17" cy="15" r="4" />
      <path d="M17 14.2v2.6M17 12.6v.01" />
    </>
  ),
  // Konto: id-kort med person
  'konto.kort': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16a3 3 0 0 1 6 0M14 10h4M14 13.5h3" />
    </>
  ),
} satisfies Record<`konto.${string}`, ReactNode>
