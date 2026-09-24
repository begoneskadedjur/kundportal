// src/components/admin/procurement/market/LessonsSection.tsx
// Lärdomar vunnet mot förlorat (planens verktyg 12). Våra avgjorda anbud med
// kriterietyp, antal anbud, vårt pris, vinnarens pris och prisavstånd när det
// är känt, och lärdomen från utfallsblocket. Enkla mönster: vinstfrekvens per
// kriterietyp och per antal anbud, medianavstånd till vinnaren.
// Planen kräver minst 10 till 15 egna utfall innan slutsatser dras; med färre
// visas mönstren som iakttagelser och underlaget märks som litet.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProcurementAnswerService, LESSONS_MIN_OUTCOMES, type LessonGroup, type LessonsData } from '../../../../services/procurementAnswerService'
import { CRITERIA_TYPE_LABEL } from '../../../../types/procurement'
import { procurementPath } from '../../../../lib/procurementPortal'
import { EmptyState, PulseRow, Section, StatusDot } from '../ui'
import { fmtDate, fmtKr, fmtNum, fmtPct, tableCls } from '../uiFormat'

/** Prisavstånd med tecken: +12 % betyder att vi låg 12 procent över vinnaren */
function fmtGap(g: number | null): string {
  if (g == null) return '–'
  const pct = fmtNum(Math.abs(g) * 100, 1)
  return g > 0 ? `+${pct} %` : g < 0 ? `-${pct} %` : '0 %'
}

function GroupTable({ title, groups }: { title: string; groups: LessonGroup[] }) {
  return (
    <div className="min-w-0">
      <h3 className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      <table className={tableCls.table}>
        <thead className={tableCls.thead}>
          <tr>
            <th className={tableCls.th}>Grupp</th>
            <th className={tableCls.thRight}>Vunna</th>
            <th className={tableCls.thRight}>Avgjorda</th>
            <th className={tableCls.thRight}>Vinstfrekvens</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className={tableCls.tr}>
              <td className={tableCls.td}>{g.label}</td>
              <td className={tableCls.tdRight}>{fmtNum(g.won)}</td>
              <td className={tableCls.tdRight}>{fmtNum(g.total)}</td>
              <td className={tableCls.tdRight}>{fmtPct(g.total > 0 ? g.won / g.total : null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LessonsSection() {
  const [data, setData] = useState<LessonsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ProcurementAnswerService.listLessons()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Kunde inte hämta lärdomarna')
      })
    return () => {
      alive = false
    }
  }, [])

  const hint = 'Våra avgjorda anbud. Utfall, lämnat pris och lärdom sätts i upphandlingens block Utfall och handlingar.'

  if (error) {
    return (
      <Section title="Lärdomar vunnet mot förlorat" hint={hint}>
        <EmptyState title="Kunde inte hämta lärdomarna" hint={error} />
      </Section>
    )
  }
  if (!data) {
    return (
      <Section title="Lärdomar vunnet mot förlorat" hint={hint}>
        <p className="py-6 text-center text-[12px] text-slate-500">Hämtar anbuden...</p>
      </Section>
    )
  }

  const { rows } = data
  if (rows.length === 0) {
    return (
      <Section title="Lärdomar vunnet mot förlorat" hint={hint}>
        <EmptyState
          title="Inga avgjorda anbud ännu"
          hint={`Sätt utfallet Vunnet eller Förlorat på våra anbud så växer underlaget här. Mönster blir meningsfulla först vid ${LESSONS_MIN_OUTCOMES} till 15 utfall.`}
        />
      </Section>
    )
  }

  const won = rows.filter((r) => r.outcome === 'won').length
  const small = rows.length < LESSONS_MIN_OUTCOMES

  return (
    <Section title="Lärdomar vunnet mot förlorat" hint={hint}>
      <div className="p-3 space-y-3">
        <PulseRow
          stats={[
            { label: 'Avgjorda anbud', value: fmtNum(rows.length), hint: `${won} vunna, ${rows.length - won} förlorade` },
            { label: 'Vinstfrekvens', value: fmtPct(won / rows.length), tone: small ? 'muted' : 'neutral', hint: small ? 'litet underlag' : null },
            {
              label: 'Median till vinnaren',
              value: fmtGap(data.medianGap),
              hint: data.gapCount > 0 ? `${data.gapCount} förlorade med känt vinnarpris` : 'inget vinnarpris känt',
            },
          ]}
        />
        {small && (
          <p className="flex items-start gap-1.5 text-[12px] text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
            Underlaget är litet: {rows.length} av minst {LESSONS_MIN_OUTCOMES} till 15 utfall. Mönstren nedan är iakttagelser, inte slutsatser.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-800 border-t border-slate-800">
        <GroupTable title="Per kriterietyp" groups={data.byCriteria} />
        <GroupTable title="Per antal anbud" groups={data.byBidCount} />
      </div>

      <div className="overflow-x-auto border-t border-slate-800">
        <table className={tableCls.table}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>Upphandling</th>
              <th className={tableCls.th}>Utfall</th>
              <th className={tableCls.th}>Kriterier</th>
              <th className={tableCls.thRight}>Anbud</th>
              <th className={tableCls.thRight}>Vårt pris</th>
              <th className={tableCls.th}>Vinnare</th>
              <th className={tableCls.thRight}>Vinnarens pris</th>
              <th className={tableCls.thRight}>Avstånd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bidId} className={tableCls.tr}>
                <td className={`${tableCls.td} min-w-[220px]`}>
                  <Link to={procurementPath('/' + r.noticeId)} className="text-slate-200 hover:text-[#20c58f] hover:underline">
                    {r.title}
                  </Link>
                  <div className="text-[11px] text-slate-500">
                    {[r.bguNumber != null ? `BGU-${r.bguNumber}` : null, r.buyerName, fmtDate(r.decidedAt)].filter(Boolean).join(', ')}
                  </div>
                  {r.lesson && <p className="text-[11.5px] text-slate-400 mt-1 whitespace-pre-wrap">Lärdom: {r.lesson}</p>}
                </td>
                <td className={tableCls.td}>
                  <StatusDot tone={r.outcome === 'won' ? 'good' : 'bad'}>{r.outcome === 'won' ? 'Vunnet' : 'Förlorat'}</StatusDot>
                </td>
                <td className={tableCls.td}>{r.criteriaType ? CRITERIA_TYPE_LABEL[r.criteriaType] : <span className="text-slate-500">Okänd</span>}</td>
                <td className={tableCls.tdRight}>{fmtNum(r.bidsReceived)}</td>
                <td className={tableCls.tdRight}>{fmtKr(r.ourPrice)}</td>
                <td className={tableCls.td}>{r.winnerName ?? <span className="text-slate-500">Okänd</span>}</td>
                <td className={tableCls.tdRight}>{fmtKr(r.winnerPrice)}</td>
                <td className={`${tableCls.tdRight} ${r.priceGap != null && r.priceGap > 0 ? 'text-amber-400' : ''}`}>{fmtGap(r.priceGap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 border-t border-slate-800 text-[11px] text-slate-500">
        Avstånd är vårt lämnade pris mot vinnarens, räknat på förlorade anbud där båda priserna är kända. Priserna jämförs som de står; kontrollera att de avser samma prisbas (per år eller totalt).
      </p>
    </Section>
  )
}
