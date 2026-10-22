// src/components/icons/set/provision.tsx
// Ritningar för teknikerns provisionssida i nya arbetsvyn (NyProvision).
// Följer ikonstandarden i Icon.tsx: 24 x 24, streck 1,6 sätts av Icon, en färg.

import type { ReactNode } from 'react'

export const provisionIcons = {
  // Intjänat: två mynt i stapel med ett mynt framför
  'provision.intjanat': (
    <>
      <ellipse cx="9" cy="6.5" rx="5.5" ry="2.5" />
      <path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5 M14.5 6.5v2.2 M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5" />
      <circle cx="16" cy="15.5" r="4.5" />
      <path d="M16 13.6v3.8 M14.6 15.5h2.8" />
    </>
  ),
  // Lönen: lönebesked med kronrad
  'provision.lon': (
    <>
      <path d="M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M8 7.5h8 M8 10.5h5 M8 16.5h3.5 M14 15h2 M14 18h2 M14 15v3" />
    </>
  ),
  // Utbetald: mynt med bock
  'provision.utbetald': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 5-5.3" />
    </>
  ),
  // Procentsats
  'provision.procent': (
    <>
      <path d="M18 6 6 18" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),
  // Uppdatera: två pilar i cirkel
  'provision.uppdatera': (
    <path d="M19.5 11A7.5 7.5 0 0 0 6 7.2 M4.5 13A7.5 7.5 0 0 0 18 16.8 M5.6 3.8v3.7h3.7 M18.4 20.2v-3.7h-3.7" />
  ),
  // Tomt läge: tom plånbok med streckat mynt på väg in
  'provision.tom': (
    <>
      <path d="M3.5 9.5h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M16 15h1.5" />
      <circle cx="12" cy="5" r="2.6" strokeDasharray="2 2" />
    </>
  ),
} satisfies Record<`provision.${string}`, ReactNode>
