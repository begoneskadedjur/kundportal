// Svenska format och periodlogik för sidan Marknad.
// Tusental med mellanslag, komma som decimal, "kr" efter beloppet, datum ÅÅÅÅ-MM-DD i lokal tid.

// sv-SE ger hårt mellanslag (U+00A0) eller smalt hårt mellanslag (U+202F) som tusentalsavgränsare
// beroende på webbläsare. Allt blir ett vanligt hårt mellanslag så att belopp inte bryts över rader.
const HARD = '\u00a0'
const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, HARD)

export function tal(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return nbsp(n.toLocaleString('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }))
}

export function kr(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return `${tal(n, dec)}${HARD}kr`
}

export function procent(n: number | null | undefined, dec = 1): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return `${tal(n * 100, dec)}${HARD}%`
}

/** a / b, eller null när b är 0. */
export const kvot = (a: number, b: number): number | null => (b ? a / b : null)

/** Date till ÅÅÅÅ-MM-DD i lokal tid (aldrig toISOString). */
export function datumNyckel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDatum(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function plusDagar(s: string, dagar: number): string {
  const d = parseDatum(s)
  d.setDate(d.getDate() + dagar)
  return datumNyckel(d)
}

export function dagarMellan(fran: string, till: string): number {
  return Math.round((parseDatum(till).getTime() - parseDatum(fran).getTime()) / 86400000) + 1
}

/** Föregående period med samma längd, som slutar dagen före fran. */
export function foregaende(fran: string, till: string): { fran: string; till: string } {
  const n = dagarMellan(fran, till)
  const nyTill = plusDagar(fran, -1)
  return { fran: plusDagar(nyTill, -(n - 1)), till: nyTill }
}

/** Kort datum för axlar: 7 okt */
export function kortDatum(s: string): string {
  return nbsp(parseDatum(s).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })).replace('.', '')
}

/** Tid i svensk tid: 2026-10-07 10:15 */
export function datumTid(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${datumNyckel(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export type PeriodVal = '7' | '30' | '90' | 'manad' | 'egen'

/** Perioden för ett snabbval. Slutar i går för 7/30/90 (i dag är ofullständig i Ads). */
export function periodFor(val: Exclude<PeriodVal, 'egen'>, idag = new Date()): { fran: string; till: string } {
  const igar = plusDagar(datumNyckel(idag), -1)
  if (val === 'manad') {
    const forsta = new Date(idag.getFullYear(), idag.getMonth(), 1)
    return { fran: datumNyckel(forsta), till: datumNyckel(idag) }
  }
  const n = Number(val)
  return { fran: plusDagar(igar, -(n - 1)), till: igar }
}

/** Förändring i procent mot föregående period, eller null om underlaget saknas. */
export function forandring(nu: number, fore: number): number | null {
  if (!fore) return null
  return (nu - fore) / fore
}

export const TJANST_NAMN: Record<string, string> = {
  rattor: 'Råttor',
  moss: 'Möss',
  myror: 'Myror',
  getingar: 'Getingar',
  faglar: 'Fåglar',
  'pälsänger': 'Pälsänger',
  palsanger: 'Pälsänger',
  silverfisk: 'Silverfisk',
  mjolbaggar: 'Mjölbaggar',
  vagglos: 'Vägglöss',
  kackerlackor: 'Kackerlackor',
  mal: 'Mal',
  vetinte: 'Vet inte',
  'okänd': 'Okänd',
}

export const tjanstNamn = (t: string) => TJANST_NAMN[t] ?? t.charAt(0).toUpperCase() + t.slice(1)

export const KALLA_NAMN: Record<string, string> = {
  google_ads: 'Google Ads',
  organiskt: 'Organisk sökning',
  direkt: 'Direkt',
  ovrigt: 'Övriga hänvisningar',
}

export const KAMPANJSTATUS: Record<string, { text: string; farg: string }> = {
  ENABLED: { text: 'Aktiv', farg: 'bg-[#20c58f]' },
  PAUSED: { text: 'Pausad', farg: 'bg-amber-400' },
  REMOVED: { text: 'Borttagen', farg: 'bg-slate-500' },
}

export const KANALTYP: Record<string, string> = {
  SEARCH: 'Sök',
  PERFORMANCE_MAX: 'Performance Max',
  DISPLAY: 'Display',
  VIDEO: 'Video',
  DEMAND_GEN: 'Demand Gen',
}
