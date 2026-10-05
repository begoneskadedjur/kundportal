// src/components/admin/webLeads/format.ts
// Datum och tid i Leads (Webb): ÅÅÅÅ-MM-DD HH:mm i svensk tid.

const TID = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const DATUM = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatSvTid(iso: string | null | undefined): string {
  if (!iso) return ''
  return TID.format(new Date(iso))
}

/** ÅÅÅÅ-MM-DD för tidpunkten, räknat i svensk tid. */
export function svDatum(iso: string | Date): string {
  return DATUM.format(typeof iso === 'string' ? new Date(iso) : iso)
}

/** ISO-vecka (måndag först) för ett svenskt datum ÅÅÅÅ-MM-DD, som "2026-v41". */
export function isoVecka(datum: string): string {
  const [y, m, d] = datum.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const dag = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dag)
  const ar = t.getUTCFullYear()
  const vecka = Math.ceil(((t.getTime() - Date.UTC(ar, 0, 1)) / 86400000 + 1) / 7)
  return `${ar}-v${String(vecka).padStart(2, '0')}`
}
