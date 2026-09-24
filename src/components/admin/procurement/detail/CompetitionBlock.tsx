// src/components/admin/procurement/detail/CompetitionBlock.tsx
// Block 8: konkurrens. Förväntade konkurrenter ur köparens tilldelningar och
// kända anbudsgivare (inklusive förlorare), vinstfrekvens hos köparen och
// kända prisnivåer. Leverantörer matchas på registrets id eller orgnr.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier, type NoticeWithRelations } from '../../../../services/procurementService'
import { ProcurementCalcService } from '../../../../services/procurementCalcService'
import { EmptyState } from '../ui'
import { fmtKr, fmtKrShort, fmtPct, tableCls } from '../uiFormat'
import { Block, SubHeading } from './fields'
import { supplierKey, winnerKey, winnerName } from './helpers'

interface Row {
  key: string
  supplierId: string | null
  name: string
  isBegone: boolean
  rounds: Set<string>
  wins: number
  prices: number[]
  lastYear: string | null
}

export default function CompetitionBlock({ notice, awards }: { notice: NoticeWithRelations; awards: AwardWithRelations[] }) {
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [loading, setLoading] = useState(false)

  const refs = useMemo(() => [...new Set(awards.map((a) => a.source_ref).filter((r): r is string => !!r))], [awards])

  useEffect(() => {
    if (refs.length === 0) {
      setBidders([])
      return
    }
    let alive = true
    setLoading(true)
    ProcurementService.listBidders({ sourceRefs: refs.slice(0, 200) })
      .then((b) => alive && setBidders(b))
      .catch(() => alive && setBidders([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [refs])

  const rows = useMemo(() => {
    const map = new Map<string, Row>()
    const get = (key: string, init: Omit<Row, 'rounds' | 'wins' | 'prices' | 'lastYear'>) => {
      let r = map.get(key)
      if (!r) {
        r = { ...init, rounds: new Set(), wins: 0, prices: [], lastYear: null }
        map.set(key, r)
      }
      return r
    }
    const yearOfRef = new Map<string, string>()
    for (const a of awards) if (a.source_ref && a.award_date) yearOfRef.set(a.source_ref, a.award_date.slice(0, 4))

    for (const a of awards) {
      const k = winnerKey(a)
      if (!k) continue
      const r = get(k, { key: k, supplierId: a.supplier_id, name: winnerName(a), isBegone: !!a.supplier?.is_begone })
      r.rounds.add(a.source_ref ?? a.id)
      r.wins++
      const y = a.award_date?.slice(0, 4) ?? null
      if (y && (!r.lastYear || y > r.lastYear)) r.lastYear = y
    }
    for (const b of bidders) {
      const k = supplierKey({ supplier_id: b.supplier_id, org_number: b.org_number, name: b.name })
      if (!k) continue
      const r = get(k, { key: k, supplierId: b.supplier_id, name: b.supplier?.name ?? b.name, isBegone: b.is_begone || !!b.supplier?.is_begone })
      r.rounds.add(b.source_ref ?? b.id)
      if (b.price != null && Number(b.price) > 0) r.prices.push(Number(b.price))
      const y = b.source_ref ? yearOfRef.get(b.source_ref) ?? null : null
      if (y && (!r.lastYear || y > r.lastYear)) r.lastYear = y
    }
    return [...map.values()].sort((a, b) => b.rounds.size - a.rounds.size || b.wins - a.wins)
  }, [awards, bidders])

  const band = useMemo(() => ProcurementCalcService.bandFromAwards(awards), [awards])
  const bidCounts = awards.map((a) => Number(a.bids_received)).filter((n) => n > 0)
  const avgBids = bidCounts.length > 0 ? bidCounts.reduce((s, n) => s + n, 0) / bidCounts.length : null

  if (!notice.buyer_id) {
    return (
      <Block id="konkurrens" num="8" title="Konkurrens">
        <EmptyState title="Ingen köparhistorik att räkna på" />
      </Block>
    )
  }

  return (
    <Block id="konkurrens" num="8" title="Konkurrens">
      <div className="p-4 space-y-5">
        <p className="text-[12.5px] text-slate-300">
          {rows.length === 0
            ? 'Inga kända konkurrenter hos köparen. Marknaden i stort är ett duopol med två anbud per upphandling; räkna med Anticimex och Nomor.'
            : `Köparen har i snitt fått ${avgBids != null ? avgBids.toFixed(1).replace('.', ',') : 'okänt antal'} anbud. Förväntade konkurrenter nedan, sorterade på hur ofta de deltagit.`}
        </p>

        {rows.length > 0 && (
          <div>
            <SubHeading>Leverantörer hos köparen</SubHeading>
            <div className="overflow-x-auto -mx-4">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>Leverantör</th>
                    <th className={tableCls.thRight}>Deltagit</th>
                    <th className={tableCls.thRight}>Vunnit</th>
                    <th className={tableCls.thRight}>Vinstfrekvens</th>
                    <th className={tableCls.thRight}>Kända priser</th>
                    <th className={tableCls.thRight}>Senast</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={tableCls.tr}>
                      <td className={tableCls.td}>
                        {r.supplierId ? (
                          <Link to={`/admin/upphandlingar/konkurrenter/${r.supplierId}`} className={`hover:text-[#20c58f] ${r.isBegone ? 'text-[#20c58f]' : 'text-slate-200'}`}>
                            {r.name}
                          </Link>
                        ) : (
                          <span className={r.isBegone ? 'text-[#20c58f]' : 'text-slate-200'}>{r.name}</span>
                        )}
                        {r.isBegone && <span className="ml-1.5 text-[10.5px] text-slate-500">vi</span>}
                      </td>
                      <td className={tableCls.tdRight}>{r.rounds.size}</td>
                      <td className={tableCls.tdRight}>{r.wins}</td>
                      <td className={tableCls.tdRight}>{fmtPct(r.rounds.size > 0 ? r.wins / r.rounds.size : null)}</td>
                      <td className={tableCls.tdRight}>
                        {r.prices.length === 0
                          ? '–'
                          : r.prices.length === 1
                            ? fmtKrShort(r.prices[0])
                            : `${fmtKrShort(Math.min(...r.prices))} till ${fmtKrShort(Math.max(...r.prices))}`}
                      </td>
                      <td className={tableCls.tdRight}>{r.lastYear ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loading && <p className="text-[11px] text-slate-600 mt-1">Hämtar anbudsgivare ...</p>}
            <p className="text-[11px] text-slate-600 mt-1.5">
              Deltagit räknar kända omgångar där leverantören vann eller lämnade anbud. Förlorande anbud finns bara i vissa källor (UHM 2024, TED och insamlade handlingar).
            </p>
          </div>
        )}

        <div>
          <SubHeading>Kända prisnivåer</SubHeading>
          {band.samples === 0 ? (
            <p className="text-[12px] text-slate-600">Inga verkliga anbudspriser kända hos köparen. Begär ut prisbilagor efter tilldelning för att bygga historik.</p>
          ) : (
            <p className="text-[12.5px] text-slate-300 tabular-nums">
              {fmtKr(band.low)} till {fmtKr(band.high)} per år, ur {band.samples} kända anbudspriser.
            </p>
          )}
        </div>
      </div>
    </Block>
  )
}
