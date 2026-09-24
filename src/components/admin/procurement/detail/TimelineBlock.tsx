// src/components/admin/procurement/detail/TimelineBlock.tsx
// Block 3: tidslinjen från publicering till avtalsslut plus händelseloggen.
// Frågor senast är redigerbart (sparas i svensk tid med explicit offset).
// Avtalsspärr och överprövningsfönster räknas enligt LOU och ska verifieras.

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { AwardWithRelations, NoticeWithRelations } from '../../../../services/procurementService'
import type { ProcurementEvent } from '../../../../types/procurement'
import { addDaysIso, addMonthsIso, swedishDate } from '../../../../shared/procurementRules'
import { EmptyState, LinkButton } from '../ui'
import { daysUntil, fmtDate, fmtDateTime, fmtRelativeDays } from '../uiFormat'
import { Block, SubHeading, inputCls, type SaveNotice } from './fields'
import { errMsg, stockholmIso } from './helpers'

interface Props {
  notice: NoticeWithRelations
  noticeAwards: AwardWithRelations[]
  events: ProcurementEvent[]
  onSave: SaveNotice
}

interface Row {
  key: string
  label: string
  date: string | null
  withTime?: boolean
  note?: string
  editable?: boolean
}

function dayOf(v: string | null | undefined): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : swedishDate(v)
}

export default function TimelineBlock({ notice, noticeAwards, events, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [qDate, setQDate] = useState(dayOf(notice.questions_deadline) ?? '')
  const [showAll, setShowAll] = useState(false)

  const awardDecision = dayOf(notice.award_decision_at) ?? dayOf(noticeAwards.find((a) => a.award_date)?.award_date ?? null)

  const rows = useMemo<Row[]>(() => {
    const standstillEnd = awardDecision ? addDaysIso(awardDecision, 10) : null
    const invalidityEnd = notice.contract_start ? addMonthsIso(notice.contract_start, 6) : null
    return [
      { key: 'published', label: 'Publicerad', date: notice.published_at },
      { key: 'questions', label: 'Frågor senast', date: notice.questions_deadline, withTime: true, editable: true },
      { key: 'deadline', label: 'Sista anbudsdag', date: notice.tender_deadline, withTime: true },
      { key: 'opening', label: 'Anbudsöppning', date: notice.opening_at, withTime: true },
      { key: 'award', label: 'Tilldelningsbeslut', date: awardDecision },
      {
        key: 'standstill',
        label: 'Avtalsspärr slutar',
        date: standstillEnd,
        note: 'Tio dagar efter tilldelningsbeslutet vid elektroniskt utskick enligt LOU. Verifiera mot beslutet.',
      },
      {
        key: 'review',
        label: 'Överprövningsfönster',
        date: standstillEnd,
        note: standstillEnd
          ? `Ansökan om överprövning av upphandlingen under avtalsspärren, till ${standstillEnd}.${invalidityEnd ? ` Talan om avtalets ogiltighet senast cirka ${invalidityEnd}.` : ''} Verifiera mot LOU.`
          : 'Räknas från tilldelningsbeslutet. Verifiera mot LOU.',
      },
      { key: 'start', label: 'Avtalsstart', date: notice.contract_start },
      { key: 'end', label: 'Avtalsslut', date: notice.contract_end },
    ]
  }, [notice, awardDecision])

  const saveQuestions = async () => {
    try {
      const iso = qDate ? stockholmIso(qDate, '23:59') : null
      await onSave({ questions_deadline: iso }, qDate ? `Frågor senast satt till ${qDate}` : 'Frågor senast borttaget')
      setEditing(false)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara datumet'))
    }
  }

  const visibleEvents = showAll ? events : events.slice(0, 8)

  return (
    <Block id="tidslinje" num="3" title="Tidslinje">
      <div className="p-4 space-y-5">
        <ol className="relative border-l border-slate-800 ml-1.5 space-y-3">
          {rows.map((r) => {
            const d = daysUntil(r.date)
            const past = d != null && d < 0
            const soon = d != null && d >= 0 && d <= 7
            const dot = r.date == null ? 'bg-slate-700' : past ? 'bg-slate-600' : soon ? 'bg-amber-400' : 'bg-[#20c58f]'
            return (
              <li key={r.key} className="pl-4 relative">
                <span className={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full ${dot}`} />
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-[12px] text-slate-400 w-40 shrink-0">{r.label}</span>
                  {r.editable && editing ? (
                    <span className="flex items-center gap-2">
                      <input type="date" className={`${inputCls} w-40`} value={qDate} onChange={(e) => setQDate(e.target.value)} aria-label="Frågor senast" />
                      <LinkButton onClick={() => void saveQuestions()}>Spara</LinkButton>
                      <LinkButton tone="muted" onClick={() => setEditing(false)}>Avbryt</LinkButton>
                    </span>
                  ) : (
                    <>
                      <span className={`text-[12.5px] tabular-nums ${r.date ? (past ? 'text-slate-500' : 'text-slate-100') : 'text-slate-600'}`}>
                        {r.withTime ? fmtDateTime(r.date) : fmtDate(r.date)}
                      </span>
                      {r.date && <span className={`text-[11px] ${soon ? 'text-amber-400' : 'text-slate-500'}`}>{fmtRelativeDays(r.date)}</span>}
                      {r.editable && (
                        <LinkButton
                          tone="muted"
                          onClick={() => {
                            setQDate(dayOf(notice.questions_deadline) ?? '')
                            setEditing(true)
                          }}
                        >
                          Ändra
                        </LinkButton>
                      )}
                    </>
                  )}
                </div>
                {r.note && <p className="text-[11px] text-slate-600 mt-0.5 max-w-xl">{r.note}</p>}
              </li>
            )
          })}
        </ol>

        <div>
          <SubHeading
            action={events.length > 8 ? <LinkButton tone="muted" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Visa färre' : `Visa alla ${events.length}`}</LinkButton> : undefined}
          >
            Händelser
          </SubHeading>
          {events.length === 0 ? (
            <EmptyState title="Inga händelser ännu" />
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {visibleEvents.map((e) => (
                <li key={e.id} className="py-1.5 flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                  <span className="text-[11px] text-slate-500 tabular-nums w-32 shrink-0">{fmtDateTime(e.created_at)}</span>
                  <span className="text-slate-200">{e.title}</span>
                  {e.detail && <span className="text-slate-500">{e.detail}</span>}
                  {e.actor_name && <span className="text-[11px] text-slate-600 ml-auto">{e.actor_name}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Block>
  )
}
