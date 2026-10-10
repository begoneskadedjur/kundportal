// src/components/icons/set/tjanst.tsx
// Ritningar per tjänst (skadedjur). Flyttade från WebLeadIcons.tsx utan ändring.

import type { ReactNode } from 'react'

export const tjanstIcons = {
  // Råtta i profil med lång svans
  'tjanst.rattor': (
    <>
      <path d="M6 17.3c-.4-3.6 2.4-6.8 6.3-6.8 2.7 0 4.6 1.3 5.6 3.1l2.6 1.3-2.4 1c-1 1.3-2.8 2.1-5.6 2.1H6z" />
      <circle cx="14.6" cy="11.4" r="1.4" />
      <circle fill="currentColor" stroke="none" cx="17.2" cy="14" r=".6" />
      <path d="M6 17.6c-2 .3-3.6-.7-3.4-2.5.2-1.4 1.6-1.7 2.3-.7" />
      <path d="M9.2 18v1.6M14 18v1.6" />
    </>
  ),
  // Mus: mindre och rundare, stort öra
  'tjanst.moss': (
    <>
      <path d="M7 17.5c0-3.2 2.4-5.6 5.6-5.6 2.4 0 4 1.2 4.8 2.8l2.1 1.2-2.1.9c-.8 1.1-2.3 1.7-4.6 1.7z" />
      <circle cx="13.4" cy="10.4" r="2.3" />
      <circle fill="currentColor" stroke="none" cx="16.6" cy="14.4" r=".55" />
      <path d="M7 17.5c-1.6.6-3.3 0-3.8-1.4" />
    </>
  ),
  // Fågel (duva) i profil
  'tjanst.faglar': (
    <>
      <circle cx="16" cy="8" r="2.2" />
      <path d="M18.1 7.5l2 .6-2 .6" />
      <circle fill="currentColor" stroke="none" cx="16.5" cy="7.7" r=".5" />
      <path d="M14.2 9.6c-2 2.6-6 3.4-10.2 3.2 1.4 3.6 4.6 5.7 8.4 5.5 3.6-.2 6-2.8 5.8-6.3-.1-1-.4-1.9-.9-2.6" />
      <path d="M8 13.6c2.2.4 4.6-.2 6-1.8" />
      <path d="M10.5 18.3l-.6 2.2M13 18.1l.4 2.4" />
    </>
  ),
  // Geting ovanifrån: randig bakkropp och vingar
  'tjanst.getingar': (
    <>
      <circle cx="12" cy="4.8" r="1.5" />
      <ellipse cx="12" cy="8.6" rx="1.9" ry="2.1" />
      <path d="M12 10.8c2.4 0 3.4 2.6 3.2 5.2-.2 2.5-1.6 4.6-3.2 5.5-1.6-.9-3-3-3.2-5.5-.2-2.6.8-5.2 3.2-5.2z" />
      <path d="M9 14h6M9.2 16.9h5.6" />
      <path d="M10.3 8C7.9 5.4 4.5 5.3 3.9 6.8c-.6 1.6 2.4 3.4 6.2 2.6M13.7 8c2.4-2.6 5.8-2.7 6.4-1.2.6 1.6-2.4 3.4-6.2 2.6" />
      <path d="M11.3 3.5L10 2M12.7 3.5L14 2" />
    </>
  ),
  // Vägglus: platt oval kropp med segment
  'tjanst.vaggloss': (
    <>
      <ellipse cx="12" cy="5.6" rx="1.7" ry="1.2" />
      <ellipse cx="12" cy="13.5" rx="5.2" ry="6.3" />
      <path d="M7.4 11.4h9.2M7 14.2h10M7.8 17h8.4" />
      <path d="M7 10L4.6 8.6M6.8 13.5H4.2M7.4 17l-2.2 1.6M17 10l2.4-1.4M17.2 13.5h2.6M16.6 17l2.2 1.6" />
      <path d="M11 4.6L9.4 2.6M13 4.6l1.6-2" />
    </>
  ),
  // Silverfisk: avsmalnande kropp, långa antenner och tre spröt
  'tjanst.silverfisk': (
    <>
      <path d="M12 3.5c1.8 0 2.8 1.6 2.8 3.6 0 4-1.2 8-2.8 11.4-1.6-3.4-2.8-7.4-2.8-11.4 0-2 1-3.6 2.8-3.6z" />
      <path d="M9.6 8h4.8M9.9 11h4.2M10.5 14h3" />
      <path d="M11 3.8C9.8 2.8 8.4 2.5 7 2.7M13 3.8c1.2-1 2.6-1.3 4-1.1" />
      <path d="M12 18.5v3M11.5 18.3l-2.3 2.6M12.5 18.3l2.3 2.6" />
    </>
  ),
  // Myra: huvud, mellankropp och bakkropp
  'tjanst.myror': (
    <>
      <circle cx="12" cy="5" r="1.6" />
      <ellipse cx="12" cy="9.4" rx="1.2" ry="1.8" />
      <ellipse cx="12" cy="16" rx="2.6" ry="3.6" />
      <path d="M11 9L7.4 6.8M11 9.6l-4 .6M11.2 10.4l-3.4 2.8M13 9l3.6-2.2M13 9.6l4 .6M12.8 10.4l3.4 2.8" />
      <path d="M11.2 3.7L9.4 2.2M12.8 3.7l1.8-1.5" />
    </>
  ),
  // Kackerlacka: avlång med halssköld och långa antenner
  'tjanst.kackerlackor': (
    <>
      <path d="M12 6.5c2.8 0 4.4 3 4.4 7 0 4.2-1.8 7-4.4 7s-4.4-2.8-4.4-7c0-4 1.6-7 4.4-7z" />
      <path d="M8.3 10c1.2-.9 2.4-1.3 3.7-1.3s2.5.4 3.7 1.3" />
      <path d="M12 9v11.2" />
      <path d="M11 6.7C9 4.5 6.5 3 4 2.7M13 6.7c2-2.2 4.5-3.7 7-4" />
      <path d="M7.8 12.5l-3-1M7.8 15l-3 .8M8.6 18l-2.4 2M16.2 12.5l3-1M16.2 15l3 .8M15.4 18l2.4 2" />
    </>
  ),
  // Pälsänger: liten rund skalbagge med tvärband
  'tjanst.palsanger': (
    <>
      <ellipse cx="12" cy="13.5" rx="5" ry="6" />
      <path d="M9.8 7.8c.4-1.4 1.2-2.1 2.2-2.1s1.8.7 2.2 2.1" />
      <path d="M12 7.6v11.9" />
      <path d="M7.4 12.6c1.4.8 3 .8 4.6-.2 1.6 1 3.2 1 4.6.2" />
      <path d="M7.2 11L4.8 9.8M7 14.5H4.6M7.6 17.8l-2 1.6M16.8 11l2.4-1.2M17 14.5h2.4M16.4 17.8l2 1.6" />
      <path d="M11.2 5.9l-1-1.6M12.8 5.9l1-1.6" />
    </>
  ),
  // Mjölbagge: smal avlång skalbagge
  'tjanst.mjolbaggar': (
    <>
      <rect x="10.6" y="4.4" width="2.8" height="2.2" rx=".8" />
      <rect x="9.6" y="7" width="4.8" height="3.4" rx="1.2" />
      <path d="M9.4 11h5.2v7c0 1.7-1.2 2.8-2.6 2.8s-2.6-1.1-2.6-2.8z" />
      <path d="M12 11v9.6" />
      <path d="M9.6 8.6L7.2 7.4M9.4 12.6l-2.6.2M9.4 16.4L7 17.8M14.4 8.6l2.4-1.2M14.6 12.6l2.6.2M14.6 16.4l2.4 1.4" />
      <path d="M11.2 4.5L10 2.7M12.8 4.5L14 2.7" />
    </>
  ),
  // Mal: nattfjäril ovanifrån
  'tjanst.mal': (
    <>
      <ellipse cx="12" cy="12.5" rx="1" ry="5.5" />
      <path d="M11 8.5C8 6 4.5 6 3.5 7.5c-.8 1.4 1 4.6 7.5 6M13 8.5c3-2.5 6.5-2.5 7.5-1 .8 1.4-1 4.6-7.5 6" />
      <path d="M11 13.5c-3 .5-5.5 2.4-5 4 .5 1.4 3.2 1 5.2-1.6M13 13.5c3 .5 5.5 2.4 5 4-.5 1.4-3.2 1-5.2-1.6" />
      <path d="M11.5 7.2C10.8 5.4 9.6 4 8 3.4M12.5 7.2c.7-1.8 1.9-3.2 3.5-3.8" />
    </>
  ),
  // Fluga ovanifrån: stora ögon och bakåtsvepta vingar
  'tjanst.flugor': (
    <>
      <ellipse cx="12" cy="6" rx="2.4" ry="1.6" />
      <circle fill="currentColor" stroke="none" cx="10.7" cy="5.8" r=".9" />
      <circle fill="currentColor" stroke="none" cx="13.3" cy="5.8" r=".9" />
      <ellipse cx="12" cy="9.6" rx="2.2" ry="2" />
      <ellipse cx="12" cy="15" rx="2.6" ry="3.6" />
      <path d="M10.2 10.4C6.6 11 4 13.4 4.4 15.6c.4 1.8 3.4 1.2 6-2.4M13.8 10.4c3.6.6 6.2 3 5.8 5.2-.4 1.8-3.4 1.2-6-2.4" />
      <path d="M10 8.8L7.6 7.2M14 8.8l2.4-1.6" />
    </>
  ),
  // Mögel: sporer i klungor
  'tjanst.mogel': (
    <>
      <circle cx="8" cy="9" r="2.6" />
      <circle cx="15.5" cy="8" r="3" />
      <circle cx="13" cy="15.5" r="3.4" />
      <circle cx="6.6" cy="16.2" r="1.6" />
      <circle fill="currentColor" stroke="none" cx="8" cy="9" r=".6" />
      <circle fill="currentColor" stroke="none" cx="15.5" cy="8" r=".7" />
      <circle fill="currentColor" stroke="none" cx="13" cy="15.5" r=".8" />
    </>
  ),
  // Annat eller vet inte: frågetecken
  'tjanst.annat': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3 1-1.3 2v.6" />
      <circle fill="currentColor" stroke="none" cx="12" cy="16.8" r=".8" />
    </>
  ),
} satisfies Record<`tjanst.${string}`, ReactNode>
