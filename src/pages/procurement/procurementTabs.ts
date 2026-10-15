// src/pages/procurement/procurementTabs.ts
// Upphandlingsportalens navigering i två nivåer (docs/upphandlingsportal-ux-plan.md
// avsnitt 2): fem huvudposter i jobbets ordning plus kontomenyns sidor, och
// undertabbar per post. Samma lista i det fristående skalet (ProcurementShell)
// och i adminportalens reserv (ProcurementLayout). Sökvägarna är relativa
// portalens bas och byggs med procurementPath().

import { useLocation } from 'react-router-dom'
import type { IconName } from '../../components/icons/Icon'
import { procurementBase } from '../../lib/procurementPortal'

export interface ProcurementTab {
  /** Relativ sökväg, '' = startsidan (Idag) */
  sub: string
  label: string
  /** Aktiv bara på exakt den här vägen */
  end?: boolean
}

export interface ProcurementSection {
  key: 'idag' | 'framforhallning' | 'annonser' | 'anbud' | 'marknad' | 'installningar' | 'konto'
  label: string
  /** Kort etikett i mobilens bottenrad */
  short: string
  icon: IconName
  /** Dit huvudposten leder */
  sub: string
  /** Vägar som hör till posten (prefix). Startsidan matchar bara exakt. */
  prefixes: string[]
  /** Sidrubrikens förklaring på en rad */
  lead: string
  tabs?: ProcurementTab[]
  /** Visas i huvudraden och bottenraden (annars bara i kontomenyn) */
  inNav: boolean
}

export const PROCUREMENT_SECTIONS: ProcurementSection[] = [
  {
    key: 'idag',
    label: 'Idag',
    short: 'Idag',
    icon: 'upphandling.idag',
    sub: '',
    prefixes: [],
    lead: 'Det här kräver handling, i ordning efter hur bråttom det är.',
    inNav: true,
  },
  {
    key: 'framforhallning',
    label: 'Framförhållning',
    short: 'Framåt',
    icon: 'upphandling.framforhallning',
    sub: '/avtalsklocka',
    prefixes: ['/avtalsklocka', '/signaler', '/prognos'],
    lead: 'Upptäck upphandlingar 12 till 18 månader innan de annonseras.',
    tabs: [
      { sub: '/avtalsklocka', label: 'Avtalsklocka' },
      { sub: '/signaler', label: 'Signaler' },
      { sub: '/prognos', label: 'Prognos' },
    ],
    inNav: true,
  },
  {
    key: 'annonser',
    label: 'Annonser',
    short: 'Annonser',
    icon: 'upphandling.annons',
    sub: '/annonser',
    prefixes: ['/annonser', '/bevakning'],
    lead: 'Nya upphandlingar som matchar bevakningen. Ta upp de som är värda att räkna på, avstå resten.',
    inNav: true,
  },
  {
    key: 'anbud',
    label: 'Anbud',
    short: 'Anbud',
    icon: 'upphandling.anbud',
    sub: '/anbud',
    prefixes: ['/anbud', '/upphandling'],
    lead: 'Allt vi räknar på eller har lämnat, från beslut till utfall.',
    tabs: [
      { sub: '/anbud', label: 'Tavla', end: true },
      { sub: '/anbud/lista', label: 'Lista' },
      { sub: '/anbud/bibliotek', label: 'Anbudsbibliotek' },
    ],
    inNav: true,
  },
  {
    key: 'marknad',
    label: 'Marknad',
    short: 'Marknad',
    icon: 'upphandling.marknadsandel',
    sub: '/marknad',
    prefixes: ['/marknad', '/kopare', '/konkurrenter', '/fraga'],
    lead: 'Marknadens storlek, köpare, konkurrenter och våra lärdomar.',
    tabs: [
      { sub: '/marknad', label: 'Översikt', end: true },
      { sub: '/kopare', label: 'Köpare' },
      { sub: '/konkurrenter', label: 'Konkurrenter' },
      { sub: '/marknad/lardomar', label: 'Lärdomar' },
      { sub: '/fraga', label: 'Fråga datan' },
    ],
    inNav: true,
  },
  {
    key: 'installningar',
    label: 'Inställningar',
    short: 'Inställningar',
    icon: 'allman.filter',
    sub: '/installningar',
    prefixes: ['/installningar'],
    lead: 'Bevakningsregler, signalkällor, källhälsa, sammandrag och ansvariga.',
    inNav: false,
  },
  {
    key: 'konto',
    label: 'Mitt konto',
    short: 'Konto',
    icon: 'rapport.person',
    sub: '/mitt-konto',
    prefixes: ['/mitt-konto'],
    lead: 'Ditt konto i upphandlingsportalen.',
    inNav: false,
  },
]

export const PROCUREMENT_NAV = PROCUREMENT_SECTIONS.filter((s) => s.inNav)

/**
 * Posten som hör till en väg relativ portalens bas ('/', '/kopare/123' ...).
 * Detaljsidan för en upphandling hör till Anbud.
 */
export function sectionForPath(rel: string): ProcurementSection {
  const path = rel.replace(/\/+$/, '') || '/'
  if (path === '/') return PROCUREMENT_SECTIONS[0]
  for (const s of PROCUREMENT_SECTIONS) {
    if (s.prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return s
  }
  // Gamla vägen /:id till en upphandling
  return PROCUREMENT_SECTIONS.find((s) => s.key === 'anbud')!
}

/** Visa sidrubrik och undertabbar bara på listvyerna, inte på detaljsidor */
export function isSectionLanding(section: ProcurementSection, rel: string): boolean {
  const path = rel.replace(/\/+$/, '') || '/'
  if (section.key === 'idag') return false // Idag har en egen rubrik med dagens datum
  if (section.tabs) return section.tabs.some((t) => t.sub === path)
  return path === section.sub || (section.key === 'annonser' && path === '/bevakning')
}

/** Undertabbens aktiva läge: exakt för end, annars prefix */
export function isTabActive(tab: ProcurementTab, rel: string): boolean {
  const path = rel.replace(/\/+$/, '') || '/'
  if (tab.end) return path === tab.sub
  return path === tab.sub || path.startsWith(`${tab.sub}/`)
}


/** Vägen relativt portalens bas: /admin/upphandlingar/kopare blir /kopare */
export function useRelativePath(): string {
  const { pathname } = useLocation()
  const base = procurementBase()
  const rel = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname
  return rel || '/'
}
