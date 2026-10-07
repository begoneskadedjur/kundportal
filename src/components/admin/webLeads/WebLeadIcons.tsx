// src/components/admin/webLeads/WebLeadIcons.tsx
// Ikonset för Leads (Webb): en ikon per tjänst (skadedjur) och en per källa (kanal), plus lås och
// marknad. Samma linjestil som söklådans ikoner (SearchIcons.tsx): 24x24, streck 1,6, currentColor,
// rundade ändar. Formen bär betydelsen, färgen sätts av omgivningen.

import type { ReactNode } from 'react'

export type TjanstIkon =
  | 'rattor'
  | 'moss'
  | 'faglar'
  | 'getingar'
  | 'vaggloss'
  | 'silverfisk'
  | 'myror'
  | 'kackerlackor'
  | 'palsanger'
  | 'mjolbaggar'
  | 'mal'
  | 'flugor'
  | 'mogel'
  | 'annat'

export type KallaIkon =
  | 'google_ads'
  | 'betald'
  | 'organiskt'
  | 'ai'
  | 'social'
  | 'epost'
  | 'hanvisning'
  | 'direkt'
  | 'artanalys'

export type OvrigIkon = 'las' | 'marknad' | 'arkiv' | 'aterstall' | 'meny'

const TJANST: Record<TjanstIkon, ReactNode> = {
  // Råtta i profil med lång svans
  rattor: (
    <>
      <path d="M6 17.3c-.4-3.6 2.4-6.8 6.3-6.8 2.7 0 4.6 1.3 5.6 3.1l2.6 1.3-2.4 1c-1 1.3-2.8 2.1-5.6 2.1H6z" />
      <circle cx="14.6" cy="11.4" r="1.4" />
      <circle fill="currentColor" stroke="none" cx="17.2" cy="14" r=".6" />
      <path d="M6 17.6c-2 .3-3.6-.7-3.4-2.5.2-1.4 1.6-1.7 2.3-.7" />
      <path d="M9.2 18v1.6M14 18v1.6" />
    </>
  ),
  // Mus: mindre och rundare, stort öra
  moss: (
    <>
      <path d="M7 17.5c0-3.2 2.4-5.6 5.6-5.6 2.4 0 4 1.2 4.8 2.8l2.1 1.2-2.1.9c-.8 1.1-2.3 1.7-4.6 1.7z" />
      <circle cx="13.4" cy="10.4" r="2.3" />
      <circle fill="currentColor" stroke="none" cx="16.6" cy="14.4" r=".55" />
      <path d="M7 17.5c-1.6.6-3.3 0-3.8-1.4" />
    </>
  ),
  // Fågel (duva) i profil
  faglar: (
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
  getingar: (
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
  vaggloss: (
    <>
      <ellipse cx="12" cy="5.6" rx="1.7" ry="1.2" />
      <ellipse cx="12" cy="13.5" rx="5.2" ry="6.3" />
      <path d="M7.4 11.4h9.2M7 14.2h10M7.8 17h8.4" />
      <path d="M7 10L4.6 8.6M6.8 13.5H4.2M7.4 17l-2.2 1.6M17 10l2.4-1.4M17.2 13.5h2.6M16.6 17l2.2 1.6" />
      <path d="M11 4.6L9.4 2.6M13 4.6l1.6-2" />
    </>
  ),
  // Silverfisk: avsmalnande kropp, långa antenner och tre spröt
  silverfisk: (
    <>
      <path d="M12 3.5c1.8 0 2.8 1.6 2.8 3.6 0 4-1.2 8-2.8 11.4-1.6-3.4-2.8-7.4-2.8-11.4 0-2 1-3.6 2.8-3.6z" />
      <path d="M9.6 8h4.8M9.9 11h4.2M10.5 14h3" />
      <path d="M11 3.8C9.8 2.8 8.4 2.5 7 2.7M13 3.8c1.2-1 2.6-1.3 4-1.1" />
      <path d="M12 18.5v3M11.5 18.3l-2.3 2.6M12.5 18.3l2.3 2.6" />
    </>
  ),
  // Myra: huvud, mellankropp och bakkropp
  myror: (
    <>
      <circle cx="12" cy="5" r="1.6" />
      <ellipse cx="12" cy="9.4" rx="1.2" ry="1.8" />
      <ellipse cx="12" cy="16" rx="2.6" ry="3.6" />
      <path d="M11 9L7.4 6.8M11 9.6l-4 .6M11.2 10.4l-3.4 2.8M13 9l3.6-2.2M13 9.6l4 .6M12.8 10.4l3.4 2.8" />
      <path d="M11.2 3.7L9.4 2.2M12.8 3.7l1.8-1.5" />
    </>
  ),
  // Kackerlacka: avlång med halssköld och långa antenner
  kackerlackor: (
    <>
      <path d="M12 6.5c2.8 0 4.4 3 4.4 7 0 4.2-1.8 7-4.4 7s-4.4-2.8-4.4-7c0-4 1.6-7 4.4-7z" />
      <path d="M8.3 10c1.2-.9 2.4-1.3 3.7-1.3s2.5.4 3.7 1.3" />
      <path d="M12 9v11.2" />
      <path d="M11 6.7C9 4.5 6.5 3 4 2.7M13 6.7c2-2.2 4.5-3.7 7-4" />
      <path d="M7.8 12.5l-3-1M7.8 15l-3 .8M8.6 18l-2.4 2M16.2 12.5l3-1M16.2 15l3 .8M15.4 18l2.4 2" />
    </>
  ),
  // Pälsänger: liten rund skalbagge med tvärband
  palsanger: (
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
  mjolbaggar: (
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
  mal: (
    <>
      <ellipse cx="12" cy="12.5" rx="1" ry="5.5" />
      <path d="M11 8.5C8 6 4.5 6 3.5 7.5c-.8 1.4 1 4.6 7.5 6M13 8.5c3-2.5 6.5-2.5 7.5-1 .8 1.4-1 4.6-7.5 6" />
      <path d="M11 13.5c-3 .5-5.5 2.4-5 4 .5 1.4 3.2 1 5.2-1.6M13 13.5c3 .5 5.5 2.4 5 4-.5 1.4-3.2 1-5.2-1.6" />
      <path d="M11.5 7.2C10.8 5.4 9.6 4 8 3.4M12.5 7.2c.7-1.8 1.9-3.2 3.5-3.8" />
    </>
  ),
  // Fluga ovanifrån: stora ögon och bakåtsvepta vingar
  flugor: (
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
  mogel: (
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
  annat: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3 1-1.3 2v.6" />
      <circle fill="currentColor" stroke="none" cx="12" cy="16.8" r=".8" />
    </>
  ),
}

const KALLA: Record<KallaIkon, ReactNode> = {
  // Google Ads: megafonen
  google_ads: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M18.8 6.8a7 7 0 0 1 0 10.4" />
      <path d="M8 15l1 4.5h2l-.7-3.2" />
    </>
  ),
  // Annan betald annons: prislappen
  betald: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  // Organisk sökning: förstoringsglas med grodd
  organiskt: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
      <path d="M10.5 13.4v-3.2" />
      <path d="M10.5 10.6c0-1.6 1.1-2.6 2.6-2.6 0 1.6-1.1 2.6-2.6 2.6zM10.5 11.4c0-1.3-.9-2.1-2.1-2.1 0 1.3.9 2.1 2.1 2.1z" />
    </>
  ),
  // AI-assistent: gnistor
  ai: (
    <>
      <path d="M11 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  // Sociala medier: delningsnoder
  social: (
    <>
      <circle cx="6" cy="12" r="2.3" />
      <circle cx="17.5" cy="6" r="2.3" />
      <circle cx="17.5" cy="18" r="2.3" />
      <path d="M8.1 10.9l7.3-3.8M8.1 13.1l7.3 3.8" />
    </>
  ),
  // E-post: kuvertet
  epost: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  // Hänvisning från annan webbplats: länken
  hanvisning: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </>
  ),
  // Direkt: jordglob (adressen skrevs in eller bokmärke)
  direkt: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z" />
    </>
  ),
  // Artanalys (bildanalys): kameran
  artanalys: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2L9.2 5h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="12.8" r="3.3" />
    </>
  ),
}

const OVRIG: Record<OvrigIkon, ReactNode> = {
  las: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5V17" />
    </>
  ),
  marknad: (
    <>
      <path d="M4 20h16" />
      <path d="M7 17v-4M11.5 17v-6.5M16 17v-5" />
      <path d="M5 9.5l4.2-3.6 3 2.1L18 3.5" />
      <path d="M15 3.5h3v3" />
    </>
  ),
  arkiv: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 12.8h4" />
    </>
  ),
  aterstall: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  meny: (
    <>
      <circle fill="currentColor" stroke="none" cx="6" cy="12" r="1.4" />
      <circle fill="currentColor" stroke="none" cx="12" cy="12" r="1.4" />
      <circle fill="currentColor" stroke="none" cx="18" cy="12" r="1.4" />
    </>
  ),
}

function Svg({ children, className }: { children: ReactNode; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function TjanstIcon({ name, className = 'w-5 h-5' }: { name: TjanstIkon; className?: string }) {
  return <Svg className={className}>{TJANST[name]}</Svg>
}

export function KallaIcon({ name, className = 'w-4 h-4' }: { name: KallaIkon; className?: string }) {
  return <Svg className={className}>{KALLA[name]}</Svg>
}

export function LeadIcon({ name, className = 'w-4 h-4' }: { name: OvrigIkon; className?: string }) {
  return <Svg className={className}>{OVRIG[name]}</Svg>
}
