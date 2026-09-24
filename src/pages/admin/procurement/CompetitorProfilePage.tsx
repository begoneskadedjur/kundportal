// src/pages/admin/procurement/CompetitorProfilePage.tsx
// Konkurrentprofil (verktyg 4): alias, vinster per år, lämnade anbud,
// köpare, län, möten mot andra leverantörer och utfall, kända prisnivåer och
// anteckningar. Lämnade anbud och möten kräver kända anbudsgivare (UHM 2024
// och TED).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier } from '../../../services/procurementService'
import { formatOrgNumber, todaySwedish } from '../../../shared/procurementRules'
import type { ProcurementSupplier } from '../../../types/procurement'
import { EmptyState, PulseRow, Section, StatusDot } from '../../../components/admin/procurement/ui'
import { fmtDate, fmtKrShort, fmtNum, fmtPct, tableCls } from '../../../components/admin/procurement/uiFormat'
import { VALUE_KIND_LABEL, buildProcurements, isContractedKind, type ProcurementGroup } from '../../../components/admin/procurement/market/marketStats'
import { BuyerLink, HistoryEmpty, SupplierName } from '../../../components/admin/procurement/market/shared'
import { countyLabel } from '../../../components/admin/procurement/market/format'
import { headToHead, sortKey, supplierIdResolver, supplierStats } from '../../../components/admin/procurement/registry/registryStats'
import { procurementPath } from '../../../lib/procurementPortal'

export default function CompetitorProfilePage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<ProcurementSupplier | null>(null)
  const [suppliers, setSuppliers] = useState<ProcurementSupplier[]>([])
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const load = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    try {
      const [s, all, a, b] = await Promise.all([
        ProcurementService.getSupplier(supplierId),
        ProcurementService.listSuppliers(),
        ProcurementService.listAwards(),
        ProcurementService.listBidders(),
      ])
      setSupplier(s)
      setNotes(s?.notes ?? '')
      setSuppliers(all)
      setAwards(a)
      setBidders(b)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta leverantören')
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const resolve = useMemo(() => supplierIdResolver(suppliers), [suppliers])
  const groups = useMemo(() => buildProcurements(awards), [awards])
  const groupByRef = useMemo(() => {
    const m = new Map<string, ProcurementGroup>()
    for (const g of groups) for (const r of g.refs) m.set(r, g)
    return m
  }, [groups])
  const id = supplierId ?? ''
  const stats = useMemo(() => supplierStats(groups, bidders, resolve).get(id) ?? null, [groups, bidders, resolve, id])
  const wonGroups = useMemo(
    () => groups.filter((g) => g.winners.some((w) => resolve(w.supplierId, w.org) === id)).sort((a, b) => sortKey(b).localeCompare(sortKey(a))),
    [groups, resolve, id]
  )
  const myBids = useMemo(
    () =>
      bidders
        .filter((b) => resolve(b.supplier_id ?? b.supplier?.id, b.org_number ?? b.supplier?.org_number) === id)
        .map((b) => ({ b, g: b.source_ref ? groupByRef.get(`${b.source}:${b.source_ref}`) ?? null : null }))
        .sort((x, y) => (y.g ? sortKey(y.g) : '').localeCompare(x.g ? sortKey(x.g) : '')),
    [bidders, resolve, id, groupByRef]
  )
  const meetings = useMemo(() => headToHead(id, bidders, resolve), [id, bidders, resolve])

  const perYear = useMemo(() => {
    const m = new Map<number, { year: number; wins: number; value: number; bids: number }>()
    const get = (y: number) => m.get(y) ?? { year: y, wins: 0, value: 0, bids: 0 }
    for (const g of wonGroups) {
      if (g.year == null) continue
      const r = get(g.year)
      r.wins += 1
      for (const w of g.winners) if (resolve(w.supplierId, w.org) === id && w.value != null && isContractedKind(w.valueKind)) r.value += w.value
      m.set(g.year, r)
    }
    const seen = new Set<string>()
    for (const { g } of myBids) {
      if (!g || g.year == null || seen.has(g.key)) continue
      seen.add(g.key)
      const r = get(g.year)
      r.bids += 1
      m.set(g.year, r)
    }
    return [...m.values()].sort((a, b) => b.year - a.year)
  }, [wonGroups, myBids, resolve, id])

  const buyers = useMemo(() => {
    const m = new Map<string, { id: string | null; name: string; wins: number; bids: number; last: number | null }>()
    const touch = (g: ProcurementGroup, won: boolean) => {
      const k = g.buyerId ?? g.buyerName ?? g.key
      const r = m.get(k) ?? { id: g.buyerId, name: g.buyerName ?? 'Okänd köpare', wins: 0, bids: 0, last: null }
      if (won) r.wins += 1
      else r.bids += 1
      if (g.year != null && (r.last == null || g.year > r.last)) r.last = g.year
      m.set(k, r)
    }
    const wonKeys = new Set(wonGroups.map((g) => g.key))
    for (const g of wonGroups) touch(g, true)
    const seen = new Set<string>()
    for (const { g } of myBids) if (g && !wonKeys.has(g.key) && !seen.has(g.key)) { seen.add(g.key); touch(g, false) }
    return [...m.values()].sort((a, b) => (b.last ?? 0) - (a.last ?? 0) || a.name.localeCompare(b.name, 'sv'))
  }, [wonGroups, myBids])

  const prices = useMemo(() => {
    const own = myBids.filter(({ b }) => b.price != null).map(({ b, g }) => ({ key: b.id, year: g?.year ?? null, buyer: g?.buyerName ?? null, buyerId: g?.buyerId ?? null, kind: 'Eget anbud', price: b.price!, won: b.is_winner }))
    const actual = wonGroups
      .flatMap((g) => g.winners.filter((w) => resolve(w.supplierId, w.org) === id && w.valueKind === 'actual' && w.value != null).map((w) => ({ key: `${g.key}:a`, year: g.year, buyer: g.buyerName, buyerId: g.buyerId, kind: 'Tilldelat verkligt pris', price: w.value!, won: true })))
    const range = wonGroups
      .filter((g) => g.lowestBid != null || g.highestBid != null)
      .map((g) => ({ key: `${g.key}:r`, year: g.year, buyer: g.buyerName, buyerId: g.buyerId, kind: `Anbudsspann ${fmtKrShort(g.lowestBid)} till ${fmtKrShort(g.highestBid)}`, price: g.lowestBid ?? g.highestBid!, won: true }))
    return [...own, ...actual, ...range].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  }, [myBids, wonGroups, resolve, id])

  const saveNotes = async () => {
    if (!supplier) return
    setSavingNotes(true)
    try {
      await ProcurementService.updateSupplierNotes(supplier.id, notes.trim() || null)
      setSupplier({ ...supplier, notes: notes.trim() || null })
      toast.success('Anteckningen är sparad')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara anteckningen')
    } finally {
      setSavingNotes(false)
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="space-y-4">
        <Link to={procurementPath('/konkurrenter')} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-3.5 h-3.5" /> Konkurrenter
        </Link>
        <EmptyState title="Leverantören finns inte" />
      </div>
    )
  }

  const running = wonGroups.filter((g) => g.endDate && g.endDate >= today).length

  return (
    <div className="space-y-8">
      <div>
        <Link to={procurementPath('/konkurrenter')} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Konkurrenter
        </Link>
        <h2 className={`text-lg font-semibold ${supplier.is_begone ? 'text-[#20c58f]' : 'text-slate-100'}`}>{supplier.name}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500 mt-0.5 tabular-nums">
          <span>{supplier.org_number ? formatOrgNumber(supplier.org_number) : 'Orgnr saknas'}</span>
          {supplier.is_begone && <span className="text-[#20c58f]">Det här är vi</span>}
        </div>
        {supplier.aliases.length > 0 && <div className="text-[11px] text-slate-600 mt-1">Alias: {supplier.aliases.join(', ')}</div>}
      </div>

      <PulseRow
        stats={[
          { label: 'Vinster', value: fmtNum(stats?.wins ?? 0), hint: stats?.lastWinYear ? `senast ${stats.lastWinYear}` : null },
          { label: 'Lämnade anbud', value: fmtNum(stats?.bids ?? 0), hint: 'kända anbud plus vinster' },
          { label: 'Vinstfrekvens', value: stats?.winRate != null ? fmtPct(stats.winRate) : '–', hint: stats?.knownBids ? `${stats.knownWins} av ${stats.knownBids} med kända anbudsgivare` : 'kräver kända anbudsgivare' },
          { label: 'Avtalat tak', value: fmtKrShort(stats?.contracted ?? 0), hint: 'ramtak per vinnare' },
          { label: 'Löpande avtal', value: fmtNum(running), hint: stats?.counties.length ? stats.counties.map(countyLabel).join(', ') : null },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Per år">
          {perYear.length === 0 ? (
            <HistoryEmpty title="Inga vinster eller anbud kända" />
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>År</th>
                    <th className={tableCls.thRight}>Vinster</th>
                    <th className={tableCls.thRight}>Kända anbud</th>
                    <th className={tableCls.thRight}>Avtalat tak</th>
                  </tr>
                </thead>
                <tbody>
                  {perYear.map((r) => (
                    <tr key={r.year} className={tableCls.tr}>
                      <td className={tableCls.td}>{r.year}</td>
                      <td className={tableCls.tdRight}>{fmtNum(r.wins)}</td>
                      <td className={tableCls.tdRight}>{r.bids ? fmtNum(r.bids) : '–'}</td>
                      <td className={tableCls.tdRight}>{r.value ? fmtKrShort(r.value) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Anteckningar">
          <div className="p-4 space-y-3">
            <Input as="textarea" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Styrkor, prisnivå, kontaktpersoner, erfarenheter från möten" />
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => void saveNotes()} disabled={(notes.trim() || null) === (supplier.notes ?? null)} loading={savingNotes}>
                Spara anteckning
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Möten mot andra leverantörer" hint="Upphandlingar där båda lämnade anbud och vem som vann. Kräver kända anbudsgivare.">
        {meetings.length === 0 ? (
          <EmptyState title="Inga kända möten" hint="Anbudsgivare inklusive förlorare finns i UHM 2024 och TED, och från inhämtade anbudsöppningsprotokoll." />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Mot</th>
                  <th className={tableCls.thRight}>Möten</th>
                  <th className={tableCls.thRight}>{supplier.is_begone ? 'Vi vann' : 'Vann'}</th>
                  <th className={tableCls.thRight}>Motparten vann</th>
                  <th className={tableCls.thRight}>Båda (ramavtal)</th>
                  <th className={tableCls.thRight}>Ingen av dem</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.otherKey} className={tableCls.tr}>
                    <td className={tableCls.td}><SupplierName w={{ supplierId: m.otherId, name: m.otherName, cls: m.otherClass }} /></td>
                    <td className={tableCls.tdRight}>{fmtNum(m.meetings)}</td>
                    <td className={`${tableCls.tdRight} ${m.weWon > m.theyWon ? 'text-[#20c58f]' : ''}`}>{fmtNum(m.weWon)}</td>
                    <td className={`${tableCls.tdRight} ${m.theyWon > m.weWon ? 'text-amber-400' : ''}`}>{fmtNum(m.theyWon)}</td>
                    <td className={tableCls.tdRight}>{fmtNum(m.bothWon)}</td>
                    <td className={tableCls.tdRight}>{fmtNum(m.neither)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Vunna upphandlingar" hint="Värdet är ramtak om inget annat anges.">
        {wonGroups.length === 0 ? (
          <EmptyState title="Inga kända vinster" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>År</th>
                  <th className={tableCls.th}>Köpare</th>
                  <th className={tableCls.th}>Län</th>
                  <th className={tableCls.thRight}>Värde</th>
                  <th className={tableCls.thRight}>Anbud</th>
                  <th className={tableCls.th}>Avtalsslut</th>
                </tr>
              </thead>
              <tbody>
                {wonGroups.map((g) => {
                  const w = g.winners.find((x) => resolve(x.supplierId, x.org) === id)
                  return (
                    <tr key={g.key} className={tableCls.tr}>
                      <td className={tableCls.td}>{g.year ?? '–'}</td>
                      <td className={tableCls.td}>
                        <div className="min-w-[180px]">
                          <BuyerLink id={g.buyerId} name={g.buyerName} />
                          {g.title && <div className="text-[11px] text-slate-500 truncate max-w-[260px]" title={g.title}>{g.title}</div>}
                          {g.winners.length > 1 && <div className="text-[11px] text-slate-500">Ramavtal med {g.winners.length - 1} till</div>}
                        </div>
                      </td>
                      <td className={tableCls.td}>{countyLabel(g.countyCode)}</td>
                      <td className={tableCls.tdRight}>
                        {fmtKrShort(w?.value ?? g.value)}
                        {(w?.value ?? g.value) != null && <div className="text-[10.5px] text-slate-500">{VALUE_KIND_LABEL[w?.valueKind ?? g.valueKind]}</div>}
                      </td>
                      <td className={tableCls.tdRight}>{fmtNum(g.bidsReceived)}</td>
                      <td className={`${tableCls.td} whitespace-nowrap`}>
                        {fmtDate(g.endDate)}
                        {g.endDate && g.endDate >= today && <div><StatusDot tone="good">Löper</StatusDot></div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Köpare">
          {buyers.length === 0 ? (
            <EmptyState title="Inga kända köpare" />
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>Köpare</th>
                    <th className={tableCls.thRight}>Vinster</th>
                    <th className={tableCls.thRight}>Förlorade</th>
                    <th className={tableCls.thRight}>Senast</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b) => (
                    <tr key={`${b.id}${b.name}`} className={tableCls.tr}>
                      <td className={tableCls.td}><BuyerLink id={b.id} name={b.name} /></td>
                      <td className={tableCls.tdRight}>{b.wins ? fmtNum(b.wins) : '–'}</td>
                      <td className={tableCls.tdRight}>{b.bids ? fmtNum(b.bids) : '–'}</td>
                      <td className={tableCls.tdRight}>{b.last ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Kända prisnivåer" hint="Egna anbudspriser, verkliga tilldelade priser och anbudsspann ur TED. Ramtak räknas inte som pris.">
          {prices.length === 0 ? (
            <EmptyState title="Inga kända priser" hint="Verkliga priser finns i cirka 18 procent av TED-tilldelningarna och i inhämtade prisbilagor." />
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>År</th>
                    <th className={tableCls.th}>Köpare</th>
                    <th className={tableCls.th}>Typ</th>
                    <th className={tableCls.thRight}>Pris</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => (
                    <tr key={p.key} className={tableCls.tr}>
                      <td className={tableCls.td}>{p.year ?? '–'}</td>
                      <td className={tableCls.td}><BuyerLink id={p.buyerId} name={p.buyer} /></td>
                      <td className={tableCls.td}>
                        {p.kind}
                        {p.kind === 'Eget anbud' && <div className="text-[11px] text-slate-500">{p.won ? 'vann' : 'förlorade'}</div>}
                      </td>
                      <td className={tableCls.tdRight}>{fmtKrShort(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {myBids.length > 0 && (
        <Section title="Lämnade anbud" hint="Kända anbud inklusive förlorade, ur UHM 2024, TED och inhämtade handlingar.">
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>År</th>
                  <th className={tableCls.th}>Köpare</th>
                  <th className={tableCls.th}>Utfall</th>
                  <th className={tableCls.thRight}>Placering</th>
                  <th className={tableCls.thRight}>Pris</th>
                  <th className={tableCls.th}>Källa</th>
                </tr>
              </thead>
              <tbody>
                {myBids.map(({ b, g }) => (
                  <tr key={b.id} className={tableCls.tr}>
                    <td className={tableCls.td}>{g?.year ?? '–'}</td>
                    <td className={tableCls.td}><BuyerLink id={g?.buyerId ?? null} name={g?.buyerName ?? null} /></td>
                    <td className={tableCls.td}><StatusDot tone={b.is_winner ? 'good' : 'muted'}>{b.is_winner ? 'Vann' : 'Förlorade'}</StatusDot></td>
                    <td className={tableCls.tdRight}>{fmtNum(b.rank)}</td>
                    <td className={tableCls.tdRight}>{fmtKrShort(b.price)}</td>
                    <td className={tableCls.td}>{b.source.toUpperCase().replace('_XML', ' äldre')}{b.verified ? ' · verifierad' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
