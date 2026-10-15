// src/pages/admin/procurement/ForecastPage.tsx
// Framförhållning > Prognos (/prognos): förväntat täckningsbidrag per kvartal
// för sista anbudsdag och avtalsklockans avtal per kvartal för förväntad
// annons med årsvärde. Flyttad från Marknad i 3.63.0 utan att räknereglerna
// ändrats (pipelineByQuarter i market/marketStats.ts). Sammanslagningen med
// avtalsklockans kvartalsprognos är planens etapp 6.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { ProcurementService, type AwardWithRelations, type NoticeWithRelations } from '../../../services/procurementService'
import { NOTIFY_SCORE, todaySwedish } from '../../../shared/procurementRules'
import { Section } from '../../../components/admin/procurement/ui'
import { buildProcurements, matchesCounty, pipelineByQuarter, type CountyFilter } from '../../../components/admin/procurement/market/marketStats'
import { CountySelect } from '../../../components/admin/procurement/market/shared'
import { areaLabel } from '../../../components/admin/procurement/market/format'
import { PipelineTable } from '../../../components/admin/procurement/market/MarketTables'

export default function ForecastPage() {
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [notices, setNotices] = useState<NoticeWithRelations[]>([])
  const [county, setCounty] = useState<CountyFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [d, n] = await Promise.allSettled([
      ProcurementService.listMarketDataset(),
      ProcurementService.listNotices({ minScore: NOTIFY_SCORE, openOnly: true, limit: 1000 }),
    ])
    if (d.status === 'fulfilled') setAwards(d.value.awards)
    if (n.status === 'fulfilled') setNotices(n.value)
    if (d.status === 'rejected' || n.status === 'rejected') toast.error('Delar av prognosen kunde inte hämtas')
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const groups = useMemo(() => buildProcurements(awards).filter((g) => matchesCounty(g.countyCode, county)), [awards, county])
  const noticesInArea = useMemo(
    () => notices.filter((n) => county === 'all' || (n.county_codes ?? []).some((c) => matchesCounty(c, county))),
    [notices, county]
  )
  const pipeline = useMemo(() => pipelineByQuarter(noticesInArea, groups, today, 8), [noticesInArea, groups, today])

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Kommande åtta kvartal i {areaLabel(county)}.</p>
        <CountySelect value={county} onChange={setCounty} />
      </div>
      <Section
        title="Pipeline per kvartal"
        hint="Förväntat täckningsbidrag för annonser vi bevakar, per kvartal för sista anbudsdag, och avtalsklockans avtal per kvartal för förväntad annons med årsvärde."
      >
        <PipelineTable rows={pipeline} />
      </Section>
    </div>
  )
}
