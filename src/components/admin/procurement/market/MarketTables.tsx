// src/components/admin/procurement/market/MarketTables.tsx
// Tabellerna på Marknad: antal anbud per år, pipeline per kvartal,
// utmanarläge (verktyg 8) och kvalitetsviktade köpare (verktyg 9).
// Tabellerna scrollar horisontellt inom sin ram på smala skärmar.

import { EmptyState, StatusDot } from '../ui'
import { fmtDate, fmtKrShort, fmtNum, fmtRelativeDays, tableCls } from '../uiFormat'
import { BuyerLink, SupplierName } from './shared'
import { countyLabel, criteriaLabel } from './format'
import {
  SUPPLIER_CLASS_LABEL,
  VALUE_KIND_LABEL,
  type ChallengerRow,
  type QualityBuyerRow,
  type QuarterPipeline,
  type YearBids,
} from './marketStats'

// ---------------------------------------------------------------------------

export function BidsTable({ rows, overall }: { rows: YearBids[]; overall: number | null }) {
  if (rows.length === 0) return <EmptyState title="Antal anbud saknas" hint="Antalet anbud kommer från UHM (2021 till 2024) och TED." />
  return (
    <div className="overflow-x-auto">
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>År</th>
            <th className={tableCls.thRight}>Med känt antal</th>
            <th className={tableCls.thRight}>Median</th>
            <th className={tableCls.thRight}>1 anbud</th>
            <th className={tableCls.thRight}>2 anbud</th>
            <th className={tableCls.thRight}>3 anbud</th>
            <th className={tableCls.thRight}>4 eller fler</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.year} className={tableCls.tr}>
              <td className={tableCls.td}>{r.year}</td>
              <td className={tableCls.tdRight}>{fmtNum(r.known)}</td>
              <td className={`${tableCls.tdRight} text-slate-100`}>{fmtNum(r.median, 1)}</td>
              <td className={tableCls.tdRight}>{fmtNum(r.b1)}</td>
              <td className={tableCls.tdRight}>{fmtNum(r.b2)}</td>
              <td className={tableCls.tdRight}>{fmtNum(r.b3)}</td>
              <td className={tableCls.tdRight}>{fmtNum(r.b4plus)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-700">
            <td className={`${tableCls.td} text-slate-200 font-medium`}>Alla år</td>
            <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtNum(rows.reduce((s, r) => s + r.known, 0))}</td>
            <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtNum(overall, 1)}</td>
            <td className={tableCls.tdRight}>{fmtNum(rows.reduce((s, r) => s + r.b1, 0))}</td>
            <td className={tableCls.tdRight}>{fmtNum(rows.reduce((s, r) => s + r.b2, 0))}</td>
            <td className={tableCls.tdRight}>{fmtNum(rows.reduce((s, r) => s + r.b3, 0))}</td>
            <td className={tableCls.tdRight}>{fmtNum(rows.reduce((s, r) => s + r.b4plus, 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function PipelineTable({ rows }: { rows: QuarterPipeline[] }) {
  const empty = rows.every((r) => r.notices === 0 && r.clock === 0)
  if (empty)
    return (
      <EmptyState
        title="Inget i pipelinen de kommande kvartalen"
        hint="Förväntat täckningsbidrag sätts när kalkylen sparas i Bevakning; avtalsklockan fylls av importen."
      />
    )
  const sum = rows.reduce(
    (a, r) => ({ notices: a.notices + r.notices, contribution: a.contribution + r.contribution, clock: a.clock + r.clock, clockAnnualValue: a.clockAnnualValue + r.clockAnnualValue }),
    { notices: 0, contribution: 0, clock: 0, clockAnnualValue: 0 }
  )
  return (
    <div className="overflow-x-auto">
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>Kvartal</th>
            <th className={tableCls.thRight}>I bevakningen</th>
            <th className={tableCls.thRight}>Förväntat TB</th>
            <th className={tableCls.thRight}>Avtal väntas annonseras</th>
            <th className={tableCls.thRight}>Årsvärde</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.quarter} className={tableCls.tr}>
              <td className={tableCls.td}>{r.quarter.replace('-', ' ')}</td>
              <td className={tableCls.tdRight}>{r.notices ? fmtNum(r.notices) : '–'}</td>
              <td className={`${tableCls.tdRight} ${r.contribution > 0 ? 'text-[#20c58f]' : ''}`}>{r.contribution ? fmtKrShort(r.contribution) : '–'}</td>
              <td className={tableCls.tdRight}>{r.clock ? fmtNum(r.clock) : '–'}</td>
              <td className={tableCls.tdRight}>{r.clockAnnualValue ? fmtKrShort(r.clockAnnualValue) : '–'}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-700">
            <td className={`${tableCls.td} text-slate-200 font-medium`}>Summa</td>
            <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtNum(sum.notices)}</td>
            <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtKrShort(sum.contribution)}</td>
            <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtNum(sum.clock)}</td>
            <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtKrShort(sum.clockAnnualValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function ChallengerTable({ rows }: { rows: ChallengerRow[] }) {
  if (rows.length === 0)
    return (
      <EmptyState
        title="Inga köpare i utmanarläge just nu"
        hint="Kräver kända anbudsgivare (UHM 2024, TED) eller ett antal anbud som bara täcks av Anticimex och Nomor/Rentokil, och avtalsslut inom 18 månader."
      />
    )
  return (
    <div className="overflow-x-auto">
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>Köpare</th>
            <th className={tableCls.th}>Län</th>
            <th className={tableCls.th}>Anbud senast</th>
            <th className={tableCls.th}>Nuvarande leverantör</th>
            <th className={tableCls.thRight}>Värde</th>
            <th className={tableCls.th}>Avtalsslut</th>
            <th className={tableCls.th}>Underlag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.buyerKey} className={tableCls.tr}>
              <td className={tableCls.td}>
                <BuyerLink id={r.buyerId} name={r.buyerName} />
                {r.group.title && <div className="text-[11px] text-slate-500 truncate max-w-[260px]" title={r.group.title}>{r.group.title}</div>}
              </td>
              <td className={tableCls.td}>{countyLabel(r.countyCode)}</td>
              <td className={tableCls.td}>{r.bidderClasses.map((c) => SUPPLIER_CLASS_LABEL[c]).join(' och ')}</td>
              <td className={tableCls.td}>
                <div className="space-y-0.5">
                  {r.group.winners.map((w) => (
                    <div key={`${w.supplierId}${w.org}${w.name}`}><SupplierName w={w} /></div>
                  ))}
                </div>
              </td>
              <td className={tableCls.tdRight}>
                {fmtKrShort(r.group.value)}
                {r.group.value != null && <div className="text-[10.5px] text-slate-500">{VALUE_KIND_LABEL[r.group.valueKind]}</div>}
              </td>
              <td className={`${tableCls.td} whitespace-nowrap`}>
                {fmtDate(r.endDate)}
                <div className="text-[11px] text-slate-500">{fmtRelativeDays(r.endDate)}</div>
              </td>
              <td className={tableCls.td}>
                <StatusDot tone={r.basis === 'bidders' ? 'good' : 'warn'}>{r.basis === 'bidders' ? 'Anbudsgivare' : 'Antal anbud'}</StatusDot>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function QualityBuyersTable({ rows }: { rows: QualityBuyerRow[] }) {
  if (rows.length === 0)
    return <EmptyState title="Inga köpare med kvalitetsviktning ännu" hint="Kriterietypen kommer från TED (eForms sedan 2023) och manuellt ifyllda tilldelningar." />
  return (
    <div className="overflow-x-auto">
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>Köpare</th>
            <th className={tableCls.th}>Län</th>
            <th className={tableCls.thRight}>Med kvalitet</th>
            <th className={tableCls.th}>Senaste kriterier</th>
            <th className={tableCls.th}>Senaste leverantör</th>
            <th className={tableCls.th}>Nästa avtalsslut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.buyerKey} className={tableCls.tr}>
              <td className={tableCls.td}><BuyerLink id={r.buyerId} name={r.buyerName} /></td>
              <td className={tableCls.td}>{countyLabel(r.countyCode)}</td>
              <td className={tableCls.tdRight}>{r.qualityCount} av {r.total}</td>
              <td className={tableCls.td}>{criteriaLabel(r.latestCriteria)}</td>
              <td className={tableCls.td}>{r.latestWinners.join(', ') || '–'}</td>
              <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDate(r.nextEnd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
