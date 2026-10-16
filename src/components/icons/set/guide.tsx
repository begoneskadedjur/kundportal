// src/components/icons/set/guide.tsx
// Ritningar för handbokens guider (guidemallen, godkänd 2026-10-16) och rollerna.
// En ikon per del i mallen, så att läsaren känner igen delen i varje guide.

import type { ReactNode } from 'react'

export const guideIcons = {
  // Kort svar: blixten
  'guide.kort-svar': <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3z" />,
  // Gör så här: numrerade rader
  'guide.steg': (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M11 6h9.5M11 12h9.5M11 18h6" />
    </>
  ),
  // Visning: telefon med uppspelning
  'guide.visning': (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
      <path d="M10 9.5l2.5 1.6L10 12.7z" />
    </>
  ),
  // Blev det inte som du tänkt: förstoringsglas med utropstecken
  'guide.felsok': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3l5.2 5.2" />
      <path d="M10.5 7.5v3.6M10.5 13.6v.01" />
    </>
  ),
  // Bra att veta: glödlampan
  'guide.bra-att-veta': (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.7 10.7c.8.7 1.2 1.4 1.2 2.3h5c0-.9.4-1.6 1.2-2.3A6 6 0 0 0 12 3z" />
    </>
  ),
  // Prova själv: finger som trycker
  'guide.prova': (
    <>
      <path d="M10.5 21v-8.5a1.5 1.5 0 0 1 3 0v3.6l3.4.8a2 2 0 0 1 1.5 2.3L18 21" />
      <path d="M8 9.5a4 4 0 0 1 8 0" />
      <path d="M5.2 8a7 7 0 0 1 13.6 0" />
    </>
  ),
  // Kolla att du kan: avbockad lista
  'guide.kolla': (
    <>
      <rect x="3.5" y="4" width="5.5" height="5.5" rx="1.2" />
      <path d="M4.9 6.9l1.1 1.1 1.8-2.1" />
      <rect x="3.5" y="14.5" width="5.5" height="5.5" rx="1.2" />
      <path d="M12 6.8h8.5M12 17.2h8.5" />
    </>
  ),
  // Läs också: uppslagen bok
  'guide.las-ocksa': (
    <>
      <path d="M3.5 5.5c3-1 5.8-.6 8.5 1.2v13c-2.7-1.8-5.5-2.2-8.5-1.2z" />
      <path d="M20.5 5.5c-3-1-5.8-.6-8.5 1.2v13c2.7-1.8 5.5-2.2 8.5-1.2z" />
    </>
  ),
  // Vem frågar jag: pratbubbla med frågetecken
  'guide.fraga': (
    <>
      <path d="M4 5h16v10.5H10L6 19v-3.5H4z" />
      <path d="M10.2 8.4a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.3M12 13.4v.01" />
    </>
  ),
  // Var i portalen: kartnål
  'guide.var': (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  // Du behöver: checklista på skrivplatta
  'guide.du-behover': (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M8.5 11l1.6 1.6 3-3.2M8.5 16.5h7" />
    </>
  ),
  // Görs i telefonen
  'guide.mobil': (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
    </>
  ),
  // Görs på datorn
  'guide.dator': (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  ),
  // Tekniker: hjälm
  'roll.tekniker': (
    <>
      <path d="M8.3 10a3.7 3.7 0 0 1 7.4 0" />
      <path d="M7 10h10" />
      <path d="M9 10.3a3 3 0 0 0 6 0" />
      <path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  // Koordinator: headset
  'roll.koordinator': (
    <>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M7.6 9.5a4.4 4.4 0 0 1 8.8 0" />
      <path d="M16.4 10v1.2a2 2 0 0 1-2 2h-1.2" />
      <path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  // Admin: sköld med bock
  'roll.admin': (
    <>
      <path d="M12 3l7 2.8v5.4c0 4.4-3 7.9-7 9.3-4-1.4-7-4.9-7-9.3V5.8z" />
      <path d="M9 12l2.1 2.1L15.3 9.8" />
    </>
  ),
  // Säljare: person med plus, en ny kund
  'roll.saljare': (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 4.5h4M18.5 2.5v4" />
    </>
  ),
} satisfies Record<`guide.${string}` | `roll.${string}`, ReactNode>
