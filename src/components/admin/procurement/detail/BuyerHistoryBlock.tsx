// src/components/admin/procurement/detail/BuyerHistoryBlock.tsx
// Block 7: köparens tidigare tilldelningar och övriga upphandlingar, plus en
// enkel slutsats om köparen brukar byta leverantör.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { AwardWithRelations, NoticeWithRelations } from '../../../../services/procurementService'
import { OUR_STATUS_DOT, OUR_STATUS_LABEL, type ProcurementNotice } from '../../../../types/procurement'
import { EmptyState, StatusDot } from '../ui'
import { fmtDate, fmtKrShort, tableCls } from '../uiFormat'
import { Block, SubHeading } from './fields'
import { VALUE_KIND_LABEL, winnerKey, winnerName } from './helpers'
import { procurementPath } from '../../../../lib/procurementPortal'

function switchConclusion(awards: AwardWithRelations[]): string {
  const seq = [...awards]
    .filter((a) => winnerKey(a) && a.award_date)
    .sort((a, b) => (a.award_date ?? '').localeCompare(b.award_date ?? ''))
  // Flera vinnare samma dag (delade kontrakt) räknas som en omgång
  const rounds: AwardWithRelations[][] = []
  for (const a of seq) {
    const last = rounds[rounds.length - 1]
    if (last && last[0].award_date === a.award_date) last.push(a)
    else rounds.push([a])
  }
  if (rounds.length < 2) return rounds.length === 1 ? 'Bara en känd tilldelning. För lite historik för att säga om köparen byter leverantör.' : 'Ingen känd historik.'
  let switches = 0
  let lastSwitch: { from: string; to: string; date: string | null } | null = null
  for (let i = 1; i < rounds.length; i++) {
    const prev = new Set(rounds[i - 1].map((a) => winnerKey(a)))
    const cur = rounds[i]
    if (!cur.some((a) => prev.has(winnerKey(a)))) {
      switches++
      lastSwitch = { from: winnerName(rounds[i - 1][0]), to: winnerName(cur[0]), date: cur[0].award_date }
    }
  }
  const n = rounds.length
  if (switches === 0) return `Har behållit ${winnerName(rounds[n - 1][0])} i alla ${n} kända omgångar. Trogen köpare; ett utmanaranbud behöver ett tydligt skäl.`
  return `Har bytt leverantör ${switches} av ${n - 1} gånger. Senast från ${lastSwitch?.from} till ${lastSwitch?.to} (${fmtDate(lastSwitch?.date ?? null)}).`
}

interface Props {
  notice: NoticeWithRelations
  awards: AwardWithRelations[]
  buyerNotices: ProcurementNotice[]
}

export default function BuyerHistoryBlock({ notice, awards, buyerNotices }: Props) {
  const conclusion = useMemo(() => switchConclusion(awards), [awards])
  const others = buyerNotices.filter((n) => n.id !== notice.id)

  if (!notice.buyer_id) {
    return (
      <Block id="koparhistorik" num="7" title="Köparhistorik">
        <EmptyState title="Köparen är inte kopplad till registret" hint="Historiken visas när köparen matchats på orgnr." />
      </Block>
    )
  }

  return (
    <Block id="koparhistorik" num="7" title="Köparhistorik">
      <div className="p-4 space-y-5">
        <p className="text-[12.5px] text-slate-300">{conclusion}</p>

        <div>
          <SubHeading>Tidigare tilldelningar ({awards.length})</SubHeading>
          {awards.length === 0 ? (
            <p className="text-[12px] text-slate-600">Inga kända tilldelningar hos köparen.</p>
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>År</th>
                    <th className={tableCls.th}>Vinnare</th>
                    <th className={tableCls.thRight}>Värde</th>
                    <th className={tableCls.thRight}>Anbud</th>
                    <th className={tableCls.th}>Beräknat slut</th>
                  </tr>
                </thead>
                <tbody>
                  {awards.map((a) => (
                    <tr key={a.id} className={tableCls.tr}>
                      <td className={`${tableCls.td} whitespace-nowrap`}>{a.award_date ? a.award_date.slice(0, 4) : '–'}</td>
                      <td className={`${tableCls.td} max-w-[260px]`}>
                        {a.supplier_id ? (
                          <Link to={procurementPath(`/konkurrenter/${a.supplier_id}`)} className={`hover:text-[#20c58f] ${a.supplier?.is_begone ? 'text-[#20c58f]' : 'text-slate-200'}`}>
                            {winnerName(a)}
                          </Link>
                        ) : (
                          <span className="text-slate-200">{winnerName(a)}</span>
                        )}
                        {a.title && <div className="text-[11px] text-slate-500 truncate">{a.title}</div>}
                      </td>
                      <td className={tableCls.tdRight}>
                        {fmtKrShort(a.value)}
                        {a.value != null && <div className="text-[10.5px] text-slate-500">{VALUE_KIND_LABEL[a.value_kind]}</div>}
                      </td>
                      <td className={tableCls.tdRight}>{a.bids_received ?? '–'}</td>
                      <td className={`${tableCls.td} whitespace-nowrap`}>
                        {fmtDate(a.corrected_end_date ?? a.calc_end_date)}
                        {a.corrected_end_date && <div className="text-[10.5px] text-slate-500">rättat</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-600 mt-1.5">Kontrakterat värde i öppna källor är oftast ramtak, inte vinnande pris.</p>
        </div>

        <div>
          <SubHeading>Köparens övriga upphandlingar ({others.length})</SubHeading>
          {others.length === 0 ? (
            <p className="text-[12px] text-slate-600">Inga andra upphandlingar från köparen i bevakningen.</p>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {others.slice(0, 20).map((n) => (
                <li key={n.id} className="py-1.5 flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                  <span className="text-[11px] text-slate-500 tabular-nums w-20 shrink-0">{fmtDate(n.published_at)}</span>
                  <Link to={procurementPath(`/${n.id}`)} className="text-slate-200 hover:text-[#20c58f] flex-1 min-w-0">
                    {n.title}
                  </Link>
                  <StatusDot dotClass={OUR_STATUS_DOT[n.our_status]}>{OUR_STATUS_LABEL[n.our_status]}</StatusDot>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Block>
  )
}
