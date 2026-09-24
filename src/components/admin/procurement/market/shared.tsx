// src/components/admin/procurement/market/shared.tsx
// Små delade delar för Marknad, Avtalsklocka, Köpare, Konkurrenter och
// Inställningar: länväljare, diagramtooltip, källhälsotabell, tomtillstånd
// för historiken och leverantörsnamn med BeGone-markering.

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Select from '../../../ui/Select'
import { COUNTY_OPTIONS } from './format'
import type { ProcurementSourceHealth } from '../../../../types/procurement'
import { EmptyState, StatusDot } from '../ui'
import { fmtDateTime, fmtNum, tableCls } from '../uiFormat'
import { SOURCE_LABEL, SUPPLIER_CLASS_COLOR, sourceHealthState, type CountyFilter, type GroupWinner } from './marketStats'

// ---------------------------------------------------------------------------
// Länväljare: BeGones län först

export function CountySelect({ value, onChange, className = 'w-48' }: { value: CountyFilter; onChange: (v: CountyFilter) => void; className?: string }) {
  return (
    <div className={className}>
      <Select options={COUNTY_OPTIONS} value={value} onChange={onChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tomt tillstånd när historiken inte är importerad

export function HistoryEmpty({ title = 'Ingen historik ännu' }: { title?: string }) {
  return (
    <EmptyState
      title={title}
      hint={
        <>
          Historiken fylls av importskripten <code className="text-slate-500">scripts/import-uhm-procurements.mjs</code> och{' '}
          <code className="text-slate-500">scripts/import-ted-history.mjs</code>, därefter löpande av TED-synken.
        </>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Diagramtooltip

export interface TooltipRow {
  label: string
  value: string
  color?: string
}

export function ChartTooltipBox({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[12px] shadow-xl">
      <div className="text-slate-200 font-medium mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            {r.color && <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: r.color }} />}
            {r.label}
          </span>
          <span className="text-slate-100">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leverantörer

/** Leverantörsnamn med länk till konkurrentprofilen och färgmarkering för de stora */
export function SupplierName({ w, link = true }: { w: Pick<GroupWinner, 'supplierId' | 'name' | 'cls'>; link?: boolean }) {
  const color = w.cls === 'other' ? undefined : SUPPLIER_CLASS_COLOR[w.cls]
  const inner = (
    <span className="inline-flex items-center gap-1.5">
      {color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className={w.cls === 'begone' ? 'text-[#20c58f] font-medium' : ''}>{w.name}</span>
    </span>
  )
  if (!link || !w.supplierId) return inner
  return (
    <Link to={`/admin/upphandlingar/konkurrenter/${w.supplierId}`} className="hover:underline">
      {inner}
    </Link>
  )
}

export function BuyerLink({ id, name }: { id: string | null; name: string | null }) {
  if (!id) return <span>{name ?? 'Okänd köpare'}</span>
  return (
    <Link to={`/admin/upphandlingar/kopare/${id}`} className="text-slate-200 hover:text-[#20c58f] hover:underline">
      {name ?? 'Okänd köpare'}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Källhälsa

export function SourceHealthWarning({ health }: { health: ProcurementSourceHealth[] }) {
  const now = Date.now()
  const silent = health.filter((h) => ['mercell', 'ted', 'kommers'].includes(h.source)).filter((h) => {
    const s = sourceHealthState(h, now)
    return s.tone === 'warn' || s.tone === 'bad'
  })
  if (silent.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12.5px] text-amber-300">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        {silent.map((h) => SOURCE_LABEL[h.source] ?? h.source).join(', ')} har varit tyst i över 24 timmar eller fått fel i rad. Kontrollera källhälsan nedan.
      </span>
    </div>
  )
}

export function SourceHealthTable({ health }: { health: ProcurementSourceHealth[] }) {
  if (health.length === 0) return <EmptyState title="Ingen källa har körts ännu" hint="Raderna skapas av migrationen och uppdateras av synkjobben i api/cron." />
  const now = Date.now()
  return (
    <div className="overflow-x-auto">
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>Källa</th>
            <th className={tableCls.th}>Status</th>
            <th className={tableCls.th}>Senast lyckad</th>
            <th className={tableCls.th}>Senaste körning</th>
            <th className={tableCls.thRight}>Poster</th>
            <th className={tableCls.thRight}>Fel i rad</th>
          </tr>
        </thead>
        <tbody>
          {health.map((h) => {
            const s = sourceHealthState(h, now)
            return (
              <tr key={h.source} className={tableCls.tr}>
                <td className={tableCls.td}>
                  <div className="text-slate-200">{SOURCE_LABEL[h.source] ?? h.source}</div>
                  {h.last_error && <div className="text-[11px] text-red-400/80 max-w-xs truncate" title={h.last_error}>{h.last_error}</div>}
                </td>
                <td className={tableCls.td}><StatusDot tone={s.tone}>{s.label}</StatusDot></td>
                <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDateTime(h.last_success_at)}</td>
                <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDateTime(h.last_run_at)}</td>
                <td className={tableCls.tdRight}>{fmtNum(h.last_count)}</td>
                <td className={`${tableCls.tdRight} ${h.consecutive_failures > 0 ? 'text-amber-400' : ''}`}>{fmtNum(h.consecutive_failures)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
