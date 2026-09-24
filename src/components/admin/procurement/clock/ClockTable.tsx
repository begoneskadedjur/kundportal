// src/components/admin/procurement/clock/ClockTable.tsx
// Avtalsklockans tabell: en rad per upphandling (alla ramavtalsleverantörer
// på samma rad), slutdatum med källa och inline-rättning, bearbetningsfönster,
// förväntad annons, status och ansvarig.

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import Select from '../../../ui/Select'
import { END_SOURCE_LABEL, type ProcurementAwardStatus } from '../../../../types/procurement'
import type { ProcurementManagerProfile } from '../../../../services/procurementService'
import { LinkButton, StatusDot } from '../ui'
import { fmtDate, fmtKrShort, fmtRelativeDays, tableCls } from '../uiFormat'
import { BuyerLink, SupplierName } from '../market/shared'
import { countyLabel } from '../market/format'
import {
  AWARD_STATUS_DOT,
  AWARD_STATUS_LABEL,
  VALUE_KIND_LABEL,
  annualValueOfGroup,
  expectedAnnouncementQuarter,
  isInWindow,
  type ProcurementGroup,
} from '../market/marketStats'

const AWARD_STATUS_OPTIONS = (Object.keys(AWARD_STATUS_LABEL) as ProcurementAwardStatus[]).map((s) => ({ value: s, label: AWARD_STATUS_LABEL[s] }))

interface Props {
  rows: ProcurementGroup[]
  today: string
  managers: ProcurementManagerProfile[]
  onStatus: (g: ProcurementGroup, status: ProcurementAwardStatus) => Promise<void>
  onOwner: (g: ProcurementGroup, ownerId: string | null) => Promise<void>
  onCorrectEnd: (g: ProcurementGroup, date: string | null) => Promise<void>
}

function EndDateCell({ g, onCorrectEnd }: { g: ProcurementGroup; onCorrectEnd: Props['onCorrectEnd'] }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(g.endDate ?? '')
  const [saving, setSaving] = useState(false)

  const save = async (date: string | null) => {
    setSaving(true)
    try {
      await onCorrectEnd(g, date)
      setEditing(false)
    } catch {
      // Felet visas som toast av sidan; fältet står kvar öppet
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-1 min-w-[150px]">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-2 py-1 text-[12.5px] bg-slate-900/60 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
        />
        <div className="flex gap-3">
          <LinkButton onClick={() => void save(value || null)} disabled={saving || !/^\d{4}-\d{2}-\d{2}$/.test(value)}>Spara</LinkButton>
          <LinkButton tone="muted" onClick={() => { setEditing(false); setValue(g.endDate ?? '') }} disabled={saving}>Avbryt</LinkButton>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-[140px]">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-100">{fmtDate(g.endDate)}</span>
        <button
          type="button"
          onClick={() => { setValue(g.endDate ?? ''); setEditing(true) }}
          className="text-slate-500 hover:text-[#20c58f] transition-colors"
          title="Rätta slutdatum"
          aria-label="Rätta slutdatum"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      <div className="text-[11px] text-slate-500">{g.endDate ? fmtRelativeDays(g.endDate) : ''}</div>
      <div className={`text-[11px] ${g.correctedEndDate ? 'text-[#20c58f]' : g.endSource === 'assumption_2_2' ? 'text-amber-400/80' : 'text-slate-500'}`}>
        {g.endSource ? END_SOURCE_LABEL[g.endSource] : 'Källa saknas'}
      </div>
      {g.correctedEndDate && (
        <div className="text-[11px] text-slate-500">
          Beräknat {fmtDate(g.calcEndDate)}{' '}
          <LinkButton tone="muted" onClick={() => void save(null)} disabled={saving}>Rensa rättningen</LinkButton>
        </div>
      )}
    </div>
  )
}

export function ClockTable({ rows, today, managers, onStatus, onOwner, onCorrectEnd }: Props) {
  const ownerOptions = [{ value: '', label: 'Ingen' }, ...managers.map((m) => ({ value: m.user_id, label: m.display_name || m.email }))]
  return (
    <div className="overflow-x-auto">
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>Köpare</th>
            <th className={tableCls.th}>Nuvarande leverantör</th>
            <th className={tableCls.th}>Slutdatum</th>
            <th className={tableCls.th}>Bearbetningsfönster</th>
            <th className={tableCls.th}>Förväntad annons</th>
            <th className={tableCls.thRight}>Årsvärde</th>
            <th className={tableCls.th}>Status</th>
            <th className={tableCls.th}>Ansvarig</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const inWindow = isInWindow(g, today)
            const late = !!g.windowEnd && g.windowEnd < today && !!g.endDate && g.endDate >= today
            const annual = annualValueOfGroup(g)
            return (
              <tr key={g.key} className={tableCls.tr}>
                <td className={tableCls.td}>
                  <div className="min-w-[180px]">
                    <BuyerLink id={g.buyerId} name={g.buyerName} />
                    <div className="text-[11px] text-slate-500">{countyLabel(g.countyCode)}{g.year ? ` · ${g.year}` : ''}{g.isFramework ? ' · ramavtal' : ''}</div>
                    {g.title && <div className="text-[11px] text-slate-500 truncate max-w-[240px]" title={g.title}>{g.title}</div>}
                  </div>
                </td>
                <td className={tableCls.td}>
                  <div className="space-y-0.5 min-w-[140px]">
                    {g.winners.length === 0 ? '–' : g.winners.map((w) => <div key={`${w.supplierId}${w.org}${w.name}`}><SupplierName w={w} /></div>)}
                  </div>
                </td>
                <td className={tableCls.td}><EndDateCell key={`${g.key}:${g.endDate}`} g={g} onCorrectEnd={onCorrectEnd} /></td>
                <td className={`${tableCls.td} whitespace-nowrap`}>
                  {g.windowStart ? (
                    <>
                      <div>{fmtDate(g.windowStart)} till {fmtDate(g.windowEnd)}</div>
                      {inWindow && <StatusDot tone="warn">I fönstret nu</StatusDot>}
                      {late && <StatusDot tone="bad">Fönstret har passerat</StatusDot>}
                    </>
                  ) : '–'}
                </td>
                <td className={tableCls.td}>{expectedAnnouncementQuarter(g, today)?.replace('-', ' ') ?? '–'}</td>
                <td className={tableCls.tdRight}>
                  {fmtKrShort(annual)}
                  {annual != null && <div className="text-[10.5px] text-slate-500">{VALUE_KIND_LABEL[g.valueKind]}</div>}
                </td>
                <td className={tableCls.td}>
                  <div className="w-36">
                    <Select options={AWARD_STATUS_OPTIONS} value={g.status} onChange={(v) => void onStatus(g, v as ProcurementAwardStatus)} />
                  </div>
                  <div className="mt-1"><StatusDot dotClass={AWARD_STATUS_DOT[g.status]}>{AWARD_STATUS_LABEL[g.status]}</StatusDot></div>
                </td>
                <td className={tableCls.td}>
                  <div className="w-40">
                    <Select options={ownerOptions} value={g.ownerId ?? ''} onChange={(v) => void onOwner(g, v || null)} placeholder="Ingen" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
