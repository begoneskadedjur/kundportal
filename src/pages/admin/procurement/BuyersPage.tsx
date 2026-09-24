// src/pages/admin/procurement/BuyersPage.tsx
// Köpare (verktyg 2): register med sök, län, sektor, antal kända
// upphandlingar, senaste leverantör, nästa beräknade avtalsslut och
// kundkoppling. Klick öppnar köparprofilen.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Select from '../../../components/ui/Select'
import { ProcurementService, type AwardWithRelations } from '../../../services/procurementService'
import { formatOrgNumber, todaySwedish } from '../../../shared/procurementRules'
import type { ProcurementBuyer } from '../../../types/procurement'
import { EmptyState, Section, StatusDot } from '../../../components/admin/procurement/ui'
import { fmtDate, fmtNum, fmtRelativeDays, tableCls } from '../../../components/admin/procurement/uiFormat'
import { buildProcurements, matchesCounty, type CountyFilter } from '../../../components/admin/procurement/market/marketStats'
import { CountySelect, HistoryEmpty, SupplierName } from '../../../components/admin/procurement/market/shared'
import { countyLabel } from '../../../components/admin/procurement/market/format'
import { buyerSummaries } from '../../../components/admin/procurement/registry/registryStats'

type SortKey = 'count' | 'name' | 'end'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'count', label: 'Flest upphandlingar' },
  { value: 'end', label: 'Närmast avtalsslut' },
  { value: 'name', label: 'Namn' },
]

export default function BuyersPage() {
  const [loading, setLoading] = useState(true)
  const [buyers, setBuyers] = useState<ProcurementBuyer[]>([])
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [customers, setCustomers] = useState<Map<string, string>>(new Map())
  const [search, setSearch] = useState('')
  const [county, setCounty] = useState<CountyFilter>('begone')
  const [sector, setSector] = useState('all')
  const [sort, setSort] = useState<SortKey>('count')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, a] = await Promise.all([ProcurementService.listBuyers(), ProcurementService.listAwards()])
      setBuyers(b)
      setAwards(a)
      const linked = b.map((x) => x.customer_id).filter((x): x is string => !!x)
      if (linked.length > 0) {
        const cs = await ProcurementService.getCustomersByIds(linked).catch(() => [])
        setCustomers(new Map(cs.map((c) => [c.id, c.company_name])))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta köpare')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const summaries = useMemo(() => buyerSummaries(buildProcurements(awards), today), [awards, today])
  const sectors = useMemo(() => [...new Set(buyers.map((b) => b.sector).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'sv')), [buyers])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return buyers
      .filter((b) => matchesCounty(b.county_code, county))
      .filter((b) => sector === 'all' || b.sector === sector)
      .filter((b) => {
        if (!q) return true
        if (b.name.toLowerCase().includes(q) || b.aliases.some((a) => a.toLowerCase().includes(q))) return true
        return digits.length >= 4 && (b.org_number ?? '').includes(digits)
      })
      .map((b) => ({ b, s: summaries.get(b.id) ?? { count: 0, latest: null, nextEnd: null } }))
      .sort((x, y) => {
        if (sort === 'name') return x.b.name.localeCompare(y.b.name, 'sv')
        if (sort === 'end') return (x.s.nextEnd ?? '9999').localeCompare(y.s.nextEnd ?? '9999') || x.b.name.localeCompare(y.b.name, 'sv')
        return y.s.count - x.s.count || x.b.name.localeCompare(y.b.name, 'sv')
      })
  }, [buyers, county, sector, search, summaries, sort])

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
        <div className="w-44">
          <Select options={[{ value: 'all', label: 'Alla sektorer' }, ...sectors.map((s) => ({ value: s, label: s }))]} value={sector} onChange={setSector} />
        </div>
        <div className="w-48"><Select options={SORT_OPTIONS} value={sort} onChange={(v) => setSort(v as SortKey)} /></div>
        <span className="text-xs text-slate-500 tabular-nums">{fmtNum(rows.length)} köpare</span>
      </div>

      <Section title="Köpare" hint="Köpare matchas på organisationsnummer. Län kommer ur NUTS i TED och orgnr.">
        {buyers.length === 0 ? (
          <HistoryEmpty title="Inga köpare ännu" />
        ) : rows.length === 0 ? (
          <EmptyState title="Inga köpare matchar filtret" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Köpare</th>
                  <th className={tableCls.th}>Län</th>
                  <th className={tableCls.th}>Sektor</th>
                  <th className={tableCls.thRight}>Upphandlingar</th>
                  <th className={tableCls.th}>Senaste leverantör</th>
                  <th className={tableCls.th}>Nästa avtalsslut</th>
                  <th className={tableCls.th}>Kund</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ b, s }) => (
                  <tr key={b.id} className={tableCls.tr}>
                    <td className={tableCls.td}>
                      <div className="min-w-[180px]">
                        <Link to={`/admin/upphandlingar/kopare/${b.id}`} className="text-slate-100 hover:text-[#20c58f] hover:underline">
                          {b.name}
                        </Link>
                        {b.org_number && <div className="text-[11px] text-slate-500">{formatOrgNumber(b.org_number)}</div>}
                      </div>
                    </td>
                    <td className={tableCls.td}>{countyLabel(b.county_code)}</td>
                    <td className={tableCls.td}>{b.sector ?? '–'}</td>
                    <td className={tableCls.tdRight}>{s.count ? fmtNum(s.count) : '–'}</td>
                    <td className={tableCls.td}>
                      {s.latest && s.latest.winners.length > 0 ? (
                        <div className="space-y-0.5 min-w-[140px]">
                          {s.latest.winners.map((w) => <div key={`${w.supplierId}${w.org}${w.name}`}><SupplierName w={w} /></div>)}
                          {s.latest.year && <div className="text-[11px] text-slate-500">{s.latest.year}</div>}
                        </div>
                      ) : '–'}
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>
                      {fmtDate(s.nextEnd)}
                      {s.nextEnd && <div className="text-[11px] text-slate-500">{fmtRelativeDays(s.nextEnd)}</div>}
                    </td>
                    <td className={tableCls.td}>
                      {b.customer_id ? (
                        <Link to={`/admin/befintliga-kunder/${b.customer_id}`} className="hover:underline">
                          <StatusDot tone="good">{customers.get(b.customer_id) ?? 'Kopplad'}</StatusDot>
                        </Link>
                      ) : (
                        <span className="text-slate-600">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
