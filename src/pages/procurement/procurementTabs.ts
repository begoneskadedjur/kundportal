// src/pages/procurement/procurementTabs.ts
// Upphandlingsportalens flikar (planens avsnitt 9 plus Fråga, etapp 3).
// Samma lista i adminportalens ProcurementLayout och i det fristående skalet.
// Sökvägarna är relativa portalens bas och byggs med procurementPath().

export interface ProcurementTab {
  /** Relativ sökväg, '' = startsidan (Marknad) */
  sub: string
  label: string
  end?: boolean
}

export const PROCUREMENT_TABS: ProcurementTab[] = [
  { sub: '', label: 'Marknad', end: true },
  { sub: '/bevakning', label: 'Bevakning' },
  { sub: '/avtalsklocka', label: 'Avtalsklocka' },
  { sub: '/signaler', label: 'Signaler' },
  { sub: '/kopare', label: 'Köpare' },
  { sub: '/konkurrenter', label: 'Konkurrenter' },
  { sub: '/installningar', label: 'Inställningar' },
]
