// src/pages/admin/procurement/ForecastPage.tsx
// Framförhållning > Prognos (/prognos), sedan 3.65.0 en enda prognos: väntade
// annonser per kvartal i årsvärde, där avtalsklockans avtal räknas på
// kvartalet för förväntad annons och öppna anbud i bevakningen på kvartalet
// för sista anbudsdag (forecastByQuarter i market/marketStats.ts, samma urval
// som den tidigare pipelinen). Fönstret räknas mot basavtalets slut (sedan
// 3.66.0). Ljusare del av stapeln är avtal med osäkert slutdatum (antagandet
// två plus två år eller fritext) eller med förlängningsoptioner, där annonsen
// kan komma senare om köparen förlänger. Tabellen under visar samma tal.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { ProcurementService, type AwardWithRelations, type NoticeWithRelations } from '../../../services/procurementService'
import { NOTIFY_SCORE, todaySwedish } from '../../../shared/procurementRules'
import { Section } from '../../../components/admin/procurement/ui'
import { fmtKr, fmtKrShort, fmtNum, tableCls } from '../../../components/admin/procurement/uiFormat'
import { buildProcurements, forecastByQuarter, matchesCounty, type CountyFilter, type QuarterForecast } from '../../../components/admin/procurement/market/marketStats'
import { CountySelect } from '../../../components/admin/procurement/market/shared'
import { areaLabel } from '../../../components/admin/procurement/market/format'
import { procurementPath } from '../../../lib/procurementPortal'

function quarterLabel(q: string): string {
  const [y, k] = q.split('-Q')
  return `K${k} ${y}`
}

function barTitle(r: QuarterForecast): string {
  const parts = [`${quarterLabel(r.quarter)}: ${fmtKr(r.total)} per år`]
  parts.push(`${r.clock} väntade annonser ur avtalsklockan, ${fmtKr(r.clockAnnual)}${r.clockUncertain ? `, varav ${r.clockUncertain} osäkra (slutdatum eller optioner)` : ''}`)
  parts.push(`${r.notices} öppna anbud, ${fmtKr(r.noticeAnnual)}`)
  return parts.join('\n')
}

function ForecastBars({ rows }: { rows: QuarterForecast[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1)
  const H = 160
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="grid grid-cols-8 gap-2 sm:gap-3 items-end" style={{ height: H + 22 }}>
        {rows.map((r) => {
          const certain = r.total - r.clockUncertainAnnual
          const hCertain = Math.round((certain / max) * H)
          const hUncertain = Math.round((r.clockUncertainAnnual / max) * H)
          return (
            <div key={r.quarter} className="flex flex-col items-center justify-end h-full gap-1" title={barTitle(r)} aria-label={barTitle(r)} role="img">
              <span className="text-[11px] sm:text-[12px] tabular-nums text-slate-200 whitespace-nowrap">{r.total ? fmtKrShort(r.total) : '–'}</span>
              <div className="w-full max-w-[56px] flex flex-col gap-[2px]">
                {hUncertain > 0 && <span className="block w-full rounded-t-[4px] bg-[#20c58f]/40" style={{ height: hUncertain }} />}
                {hCertain > 0 && <span className={`block w-full bg-[#20c58f] ${hUncertain > 0 ? '' : 'rounded-t-[4px]'}`} style={{ height: hCertain }} />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-8 gap-2 sm:gap-3 border-t border-slate-800 pt-1.5 text-center text-[11px] text-slate-400 tabular-nums">
        {rows.map((r) => (
          <div key={r.quarter}>
            {quarterLabel(r.quarter)}
            <span className="block text-slate-500">{fmtNum(r.clock + r.notices)} st</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-[#20c58f]" />Känt slutdatum och öppna anbud</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-[#20c58f]/40" />Osäkert slutdatum (antagande eller fritext)</span>
      </div>
    </div>
  )
}

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
  const rows = useMemo(() => forecastByQuarter(noticesInArea, groups, today, 8), [noticesInArea, groups, today])

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const sum = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Kommande åtta kvartal i {areaLabel(county)}, {fmtKrShort(sum)} per år totalt.</p>
        <CountySelect value={county} onChange={setCounty} />
      </div>

      <Section
        title="Väntade annonser per kvartal, årsvärde"
        hint="En prognos i stället för två: avtalsklockans väntade annonser (kvartalet då bearbetningsfönstret öppnar) plus öppna anbud efter sista anbudsdag. Fönstret räknas mot basavtalets slut. Ljusare stapel betyder osäkert slutdatum eller förlängningsoptioner som kan skjuta annonsen."
      >
        <ForecastBars rows={rows} />
      </Section>

      <Section title="Samma tal som tabell">
        <div className="overflow-x-auto">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Kvartal</th>
                <th className={tableCls.thRight}>Väntade annonser</th>
                <th className={tableCls.thRight}>Årsvärde</th>
                <th className={tableCls.thRight}>Varav osäkert</th>
                <th className={tableCls.thRight}>Öppna anbud</th>
                <th className={tableCls.thRight}>Årsvärde</th>
                <th className={tableCls.thRight}>Förväntat TB</th>
                <th className={tableCls.thRight}>Summa årsvärde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.quarter} className={tableCls.tr}>
                  <td className={tableCls.td}>{quarterLabel(r.quarter)}</td>
                  <td className={tableCls.tdRight}>{fmtNum(r.clock)}</td>
                  <td className={tableCls.tdRight}>{fmtKrShort(r.clockAnnual)}</td>
                  <td className={tableCls.tdRight}>{r.clockUncertain ? `${fmtNum(r.clockUncertain)} st, ${fmtKrShort(r.clockUncertainAnnual)}` : '–'}</td>
                  <td className={tableCls.tdRight}>{fmtNum(r.notices)}</td>
                  <td className={tableCls.tdRight}>{fmtKrShort(r.noticeAnnual)}</td>
                  <td className={tableCls.tdRight}>{r.contribution ? fmtKrShort(r.contribution) : '–'}</td>
                  <td className={`${tableCls.tdRight} text-slate-100`}>{fmtKrShort(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 border-t border-slate-800 text-[11.5px] text-slate-500">
          Avtalen och deras slutdatum finns i <Link to={procurementPath('/avtalsklocka')} className="text-[#20c58f] hover:underline">avtalsklockan</Link>, de öppna anbuden på{' '}
          <Link to={procurementPath('/anbud')} className="text-[#20c58f] hover:underline">anbudstavlan</Link>.
        </p>
      </Section>
    </div>
  )
}
