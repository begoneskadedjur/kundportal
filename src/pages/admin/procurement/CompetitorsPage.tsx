// src/pages/admin/procurement/CompetitorsPage.tsx
// Konkurrenter (verktyg 4): register per leverantör med vinster, lämnade
// anbud, vinstfrekvens, avtalat tak och län. BeGone markeras. Leverantörer
// matchas på organisationsnummer.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Select from '../../../components/ui/Select'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier } from '../../../services/procurementService'
import { formatOrgNumber } from '../../../shared/procurementRules'
import type { ProcurementSupplier } from '../../../types/procurement'
import { EmptyState, Section } from '../../../components/admin/procurement/ui'
import { fmtKrShort, fmtNum, fmtPct, tableCls } from '../../../components/admin/procurement/uiFormat'
import { SUPPLIER_CLASS_COLOR, buildProcurements, classifyOrg, matchesCounty, type CountyFilter } from '../../../components/admin/procurement/market/marketStats'
import { CountySelect, HistoryEmpty } from '../../../components/admin/procurement/market/shared'
import { countyLabel } from '../../../components/admin/procurement/market/format'
import { supplierIdResolver, supplierStats } from '../../../components/admin/procurement/registry/registryStats'
import { procurementPath } from '../../../lib/procurementPortal'

type SortKey = 'contracted' | 'wins' | 'bids' | 'name'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'contracted', label: 'Störst avtalat tak' },
  { value: 'wins', label: 'Flest vinster' },
  { value: 'bids', label: 'Flest anbud' },
  { value: 'name', label: 'Namn' },
]

export default function CompetitorsPage() {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<ProcurementSupplier[]>([])
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [county, setCounty] = useState<CountyFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('contracted')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, a, b] = await Promise.all([ProcurementService.listSuppliers(), ProcurementService.listAwards(), ProcurementService.listBidders()])
      setSuppliers(s)
      setAwards(a)
      setBidders(b)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta konkurrenter')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = useMemo(() => supplierIdResolver(suppliers), [suppliers])
  const stats = useMemo(() => {
    const groups = buildProcurements(awards).filter((g) => matchesCounty(g.countyCode, county))
    const keys = new Set(groups.flatMap((g) => g.refs))
    const inCounty = county === 'all' ? bidders : bidders.filter((b) => keys.has(`${b.source}:${b.source_ref}`))
    return supplierStats(groups, inCounty, resolve)
  }, [awards, bidders, county, resolve])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return suppliers
      .map((s) => ({ s, st: stats.get(s.id) ?? null }))
      .filter(({ s, st }) => (county === 'all' ? true : !!st) || s.is_begone)
      .filter(({ s }) => {
        if (!q) return true
        if (s.name.toLowerCase().includes(q) || s.aliases.some((a) => a.toLowerCase().includes(q))) return true
        return digits.length >= 4 && (s.org_number ?? '').includes(digits)
      })
      .sort((x, y) => {
        if (x.s.is_begone !== y.s.is_begone) return x.s.is_begone ? -1 : 1
        if (sort === 'name') return x.s.name.localeCompare(y.s.name, 'sv')
        const a = x.st, b = y.st
        const v = (st: typeof a) => (sort === 'wins' ? st?.wins ?? 0 : sort === 'bids' ? st?.bids ?? 0 : st?.contracted ?? 0)
        return v(b) - v(a) || x.s.name.localeCompare(y.s.name, 'sv')
      })
  }, [suppliers, stats, search, sort, county])

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök namn eller orgnr"
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </div>
        <CountySelect value={county} onChange={setCounty} />
        <div className="w-48"><Select options={SORT_OPTIONS} value={sort} onChange={(v) => setSort(v as SortKey)} /></div>
        <span className="text-xs text-slate-500 tabular-nums">{fmtNum(rows.length)} leverantörer</span>
      </div>

      <Section
        title="Leverantörer"
        hint="Vinster ur tilldelningarna. Lämnade anbud och vinstfrekvens kräver kända anbudsgivare, främst UHM 2024 och TED. Avtalat tak är ramtak per vinnare."
      >
        {suppliers.length <= 1 && awards.length === 0 ? (
          <HistoryEmpty title="Inga leverantörer utöver BeGone ännu" />
        ) : rows.length === 0 ? (
          <EmptyState title="Inga leverantörer matchar filtret" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Leverantör</th>
                  <th className={tableCls.thRight}>Vinster</th>
                  <th className={tableCls.thRight}>Lämnade anbud</th>
                  <th className={tableCls.thRight}>Vinstfrekvens</th>
                  <th className={tableCls.thRight}>Avtalat tak</th>
                  <th className={tableCls.th}>Län</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, st }) => {
                  const cls = classifyOrg(s.org_number, s.is_begone)
                  return (
                    <tr key={s.id} className={`${tableCls.tr} ${s.is_begone ? 'bg-[#20c58f]/5' : ''}`}>
                      <td className={tableCls.td}>
                        <div className="min-w-[180px]">
                          <Link to={procurementPath(`/konkurrenter/${s.id}`)} className="inline-flex items-center gap-1.5 hover:underline">
                            {cls !== 'other' && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SUPPLIER_CLASS_COLOR[cls] }} />}
                            <span className={s.is_begone ? 'text-[#20c58f] font-medium' : 'text-slate-100'}>{s.name}</span>
                          </Link>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {s.org_number ? formatOrgNumber(s.org_number) : 'Orgnr saknas'}
                            {s.is_begone ? ' · vi' : ''}
                          </div>
                        </div>
                      </td>
                      <td className={tableCls.tdRight}>{st?.wins ? fmtNum(st.wins) : '–'}</td>
                      <td className={tableCls.tdRight}>{st?.bids ? fmtNum(st.bids) : '–'}</td>
                      <td className={tableCls.tdRight}>
                        {st?.winRate != null ? fmtPct(st.winRate) : '–'}
                        {st?.knownBids ? <div className="text-[10.5px] text-slate-500">{st.knownWins} av {st.knownBids}</div> : null}
                      </td>
                      <td className={tableCls.tdRight}>{st?.contracted ? fmtKrShort(st.contracted) : '–'}</td>
                      <td className={tableCls.td}>
                        <div className="max-w-[200px] text-[12px] text-slate-400">{st?.counties.length ? st.counties.map(countyLabel).join(', ') : '–'}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
