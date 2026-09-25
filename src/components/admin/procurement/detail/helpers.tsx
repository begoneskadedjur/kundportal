// src/components/admin/procurement/detail/helpers.tsx
// Rena hjälpfunktioner och en bekräftelsehook för detaljsidan och verkstaden.
// Ligger utanför fields.tsx så att komponentfilerna bara exporterar komponenter.

import type { AwardWithRelations } from '../../../../services/procurementService'
import type { ProcurementValueKind } from '../../../../types/procurement'
import { normalizeName } from '../../../../shared/procurementRules'
import { useState } from 'react'
import ConfirmModal from '../../../ui/ConfirmModal'

export const VALUE_KIND_LABEL: Record<ProcurementValueKind, string> = {
  ceiling: 'ramtak',
  actual: 'verkligt pris',
  estimated: 'uppskattat',
  unknown: 'okänd art',
}

/** Leverantörsnyckel: registrets id, annars orgnr, annars normaliserat namn */
export function supplierKey(x: { supplier_id?: string | null; org_number?: string | null; name?: string | null }): string | null {
  return x.supplier_id ?? x.org_number ?? (x.name ? normalizeName(x.name) : null)
}

export function winnerKey(a: Pick<AwardWithRelations, 'supplier_id' | 'winner_org_number' | 'winner_name'>): string | null {
  return supplierKey({ supplier_id: a.supplier_id, org_number: a.winner_org_number, name: a.winner_name })
}

export function winnerName(a: AwardWithRelations): string {
  return a.supplier?.name ?? a.winner_name ?? 'Okänd vinnare'
}

/** "1 234,5" eller "1234.5" till tal. Tomt blir null. */
export function parseNum(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).replace(/\s/g, '').replace(',', '.')
  if (s === '' || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Tal till redigerbar text med komma som decimal, utan tusentalsavgränsare */
export function numToInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return ''
  return String(Math.round(Number(n) * 1000) / 1000).replace('.', ',')
}

/** Tidszonsoffset för Europe/Stockholm ett visst datum, t.ex. "+02:00" */
function stockholmOffset(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const probe = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', timeZoneName: 'longOffset' }).formatToParts(probe)
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    const off = tz.replace('GMT', '')
    return /^[+-]\d{2}:\d{2}$/.test(off) ? off : '+01:00'
  } catch {
    return '+01:00'
  }
}

/** ÅÅÅÅ-MM-DD plus klockslag i svensk tid som ISO med explicit offset */
export function stockholmIso(date: string, time = '12:00'): string {
  return `${date}T${time}:00${stockholmOffset(date)}`
}

/** Ladda ner en blob som fil */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Felmeddelande ur ett okänt fel */
export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

/** Personnamn ur ansvarig-listan */
export function personName(managers: Array<{ user_id: string; display_name: string | null; email: string }>, id: string | null | undefined): string {
  if (!id) return '–'
  const m = managers.find((x) => x.user_id === id)
  return m ? m.display_name || m.email : 'Okänd'
}

/**
 * Bekräftelse före borttagning. Returnerar en funktion som öppnar dialogen
 * och noden som ska renderas en gång i komponenten.
 */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: string; run: () => Promise<void>; confirmLabel?: string; variant?: 'danger' | 'warning' } | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = (title: string, message: string, run: () => Promise<void>, opts: { confirmLabel?: string; variant?: 'danger' | 'warning' } = {}) =>
    setState({ title, message, run, ...opts })
  const node = (
    <ConfirmModal
      isOpen={!!state}
      onClose={() => {
        if (!busy) setState(null)
      }}
      onConfirm={() => {
        if (!state) return
        setBusy(true)
        state
          .run()
          .catch(() => undefined)
          .finally(() => {
            setBusy(false)
            setState(null)
          })
      }}
      title={state?.title ?? ''}
      message={state?.message ?? ''}
      variant={state?.variant ?? 'danger'}
      confirmLabel={state?.confirmLabel ?? 'Ta bort'}
      loading={busy}
    />
  )
  return { confirm, node }
}
