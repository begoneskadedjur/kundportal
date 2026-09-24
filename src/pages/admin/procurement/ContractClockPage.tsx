// src/pages/admin/procurement/ContractClockPage.tsx
// Avtalsklocka (planens avsnitt 3 och verktyg 3): kända avtal med nuvarande
// leverantör, slutdatum med källa, bearbetningsfönster 18 till 12 månader före
// slut, förväntad annons per kvartal, status och ansvarig. En rad per
// upphandling: ramavtal med flera leverantörer grupperas på source_ref och
// samma upphandling i TED och UHM slås ihop. Ändringar skrivs till alla
// ingående tilldelningsrader.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Select from '../../../components/ui/Select'
import { ProcurementService, type AwardWithRelations, type ProcurementManagerProfile } from '../../../services/procurementService'
import { todaySwedish } from '../../../shared/procurementRules'
import type { ProcurementAwardStatus } from '../../../types/procurement'
import { Section } from '../../../components/admin/procurement/ui'
import { fmtKrShort, fmtNum } from '../../../components/admin/procurement/uiFormat'
import {
  AWARD_STATUS_LABEL,
  annualValueOfGroup,
  buildProcurements,
  expectedAnnouncementQuarter,
  matchesCounty,
  matchesHorizon,
  nextQuarters,
  type CountyFilter,
  type HorizonFilter,
  type ProcurementGroup,
} from '../../../components/admin/procurement/market/marketStats'
import { CountySelect, HistoryEmpty } from '../../../components/admin/procurement/market/shared'
import { ClockTable } from '../../../components/admin/procurement/clock/ClockTable'

const HORIZON_OPTIONS: Array<{ value: HorizonFilter; label: string }> = [
  { value: 'window', label: 'I fönstret nu' },
  { value: '12', label: 'Slut inom 12 månader' },
  { value: '18', label: 'Slut inom 18 månader' },
  { value: '24', label: 'Slut inom 24 månader' },
  { value: 'upcoming', label: 'Alla kommande' },
  { value: 'all', label: 'Alla, även utgångna' },
]

type StatusFilter = 'active' | 'all' | ProcurementAwardStatus

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Ej klara eller ignorerade' },
  { value: 'all', label: 'Alla statusar' },
  ...(Object.keys(AWARD_STATUS_LABEL) as ProcurementAwardStatus[]).map((s) => ({ value: s, label: AWARD_STATUS_LABEL[s] })),
]

export default function ContractClockPage() {
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [horizon, setHorizon] = useState<HorizonFilter>('18')
  const [county, setCounty] = useState<CountyFilter>('begone')
  const [status, setStatus] = useState<StatusFilter>('active')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, m] = await Promise.all([ProcurementService.listAwards(), ProcurementService.listManagers().catch(() => [])])
      setAwards(a)
      setManagers(m)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta avtalsklockan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const groups = useMemo(() => buildProcurements(awards), [awards])
  const rows = useMemo(
    () =>
      groups
        .filter((g) => matchesCounty(g.countyCode, county))
        .filter((g) => matchesHorizon(g, horizon, today))
        .filter((g) => (status === 'all' ? true : status === 'active' ? g.status !== 'done' && g.status !== 'ignored' : g.status === status))
        .sort((a, b) => (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999')),
    [groups, county, horizon, status, today]
  )

  const quarters = useMemo(() => {
    const qs = nextQuarters(today, 8)
    const map = new Map(qs.map((q) => [q, { quarter: q, count: 0, annual: 0 }]))
    let later = 0
    for (const g of rows) {
      const q = expectedAnnouncementQuarter(g, today)
      const cell = q ? map.get(q) : undefined
      if (cell) {
        cell.count += 1
        cell.annual += annualValueOfGroup(g) ?? 0
      } else if (q && q > qs[qs.length - 1]) later += 1
    }
    return { cells: qs.map((q) => map.get(q)!), later }
  }, [rows, today])

  const patchAwards = (ids: string[], patch: Partial<AwardWithRelations>) =>
    setAwards((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, ...patch } : a)))

  const onStatus = async (g: ProcurementGroup, next: ProcurementAwardStatus) => {
    try {
      await Promise.all(g.awardIds.map((id) => ProcurementService.updateAward(id, { status: next })))
      patchAwards(g.awardIds, { status: next })
      toast.success(`Status: ${AWARD_STATUS_LABEL[next]}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara statusen')
    }
  }

  const onOwner = async (g: ProcurementGroup, ownerId: string | null) => {
    try {
      await Promise.all(g.awardIds.map((id) => ProcurementService.updateAward(id, { owner_id: ownerId })))
      patchAwards(g.awardIds, { owner_id: ownerId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara ansvarig')
    }
  }

  const onCorrectEnd = async (g: ProcurementGroup, date: string | null) => {
    try {
      await Promise.all(g.awardIds.map((id) => ProcurementService.correctAwardEnd(id, date)))
      patchAwards(g.awardIds, { corrected_end_date: date })
      toast.success(date ? `Slutdatum rättat till ${date}` : 'Rättningen är borttagen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte rätta slutdatumet')
      throw e
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-52"><Select options={HORIZON_OPTIONS} value={horizon} onChange={(v) => setHorizon(v as HorizonFilter)} /></div>
        <CountySelect value={county} onChange={setCounty} />
        <div className="w-52"><Select options={STATUS_FILTER_OPTIONS} value={status} onChange={(v) => setStatus(v as StatusFilter)} /></div>
        <span className="text-xs text-slate-500 tabular-nums">{fmtNum(rows.length)} avtal</span>
      </div>

      <Section title="Förväntade annonser per kvartal" hint="Kvartalet då bearbetningsfönstret öppnar. Avtal som redan är i eller förbi fönstret räknas på innevarande kvartal.">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y lg:divide-y-0 divide-slate-800">
          {quarters.cells.map((c) => (
            <div key={c.quarter} className="px-3 py-3 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-1">{c.quarter.replace('-', ' ')}</div>
              <div className={`text-[17px] font-semibold tabular-nums leading-none ${c.count ? 'text-slate-100' : 'text-slate-600'}`}>{fmtNum(c.count)}</div>
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums truncate">{c.annual ? `${fmtKrShort(c.annual)}/år` : '–'}</div>
            </div>
          ))}
        </div>
        {quarters.later > 0 && <div className="px-3 py-2 border-t border-slate-800 text-[11px] text-slate-500">{fmtNum(quarters.later)} avtal väntas annonseras senare.</div>}
      </Section>

      <Section
        title="Kända avtal"
        hint="Slutdatum i ordningen TED plus förlängningar, Mercell, antagandet två plus två år. Rätta per rad när det verkliga datumet är känt."
      >
        {awards.length === 0 ? <HistoryEmpty title="Inga kända avtal ännu" /> : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Inga avtal matchar filtret.</div>
        ) : (
          <ClockTable rows={rows} today={today} managers={managers} onStatus={onStatus} onOwner={onOwner} onCorrectEnd={onCorrectEnd} />
        )}
      </Section>
    </div>
  )
}
