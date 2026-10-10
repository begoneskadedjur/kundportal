// src/components/icons/set/kalla.tsx
// Ritningar per källa (kanal) för webbförfrågningar. Flyttade från WebLeadIcons.tsx utan ändring.

import type { ReactNode } from 'react'

export const kallaIcons = {
  // Google Ads: megafonen
  'kalla.google-ads': (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M18.8 6.8a7 7 0 0 1 0 10.4" />
      <path d="M8 15l1 4.5h2l-.7-3.2" />
    </>
  ),
  // Annan betald annons: prislappen
  'kalla.betald': (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  // Organisk sökning: förstoringsglas med grodd
  'kalla.organiskt': (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
      <path d="M10.5 13.4v-3.2" />
      <path d="M10.5 10.6c0-1.6 1.1-2.6 2.6-2.6 0 1.6-1.1 2.6-2.6 2.6zM10.5 11.4c0-1.3-.9-2.1-2.1-2.1 0 1.3.9 2.1 2.1 2.1z" />
    </>
  ),
  // AI-assistent: pratbubbla med textrader och en gnista i hörnet (inget varumärke)
  'kalla.ai': (
    <>
      <path d="M12.5 7H6a2.5 2.5 0 0 0-2.5 2.5v5A2.5 2.5 0 0 0 6 17h1v3.2l3.6-3.2H14a2.5 2.5 0 0 0 2.5-2.5v-2.2" />
      <path d="M7 10.6h4.5M7 13.6h6" />
      <path d="M18 2.8l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
    </>
  ),
  // Sociala medier: delningsnoder
  'kalla.social': (
    <>
      <circle cx="6" cy="12" r="2.3" />
      <circle cx="17.5" cy="6" r="2.3" />
      <circle cx="17.5" cy="18" r="2.3" />
      <path d="M8.1 10.9l7.3-3.8M8.1 13.1l7.3 3.8" />
    </>
  ),
  // E-post: kuvertet
  'kalla.epost': (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  // Hänvisning från annan webbplats: länken
  'kalla.hanvisning': (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </>
  ),
  // Direkt: jordglob (adressen skrevs in eller bokmärke)
  'kalla.direkt': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z" />
    </>
  ),
  // Artanalys (bildanalys): kameran
  'kalla.artanalys': (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2L9.2 5h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="12.8" r="3.3" />
    </>
  ),
} satisfies Record<`kalla.${string}`, ReactNode>
