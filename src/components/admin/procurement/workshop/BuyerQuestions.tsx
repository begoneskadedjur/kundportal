// src/components/admin/procurement/workshop/BuyerQuestions.tsx
// Anbudsverkstad c) Frågor till köparen. AI föreslår frågor ur oklarheter i
// underlaget; egna frågor läggs till här. Frågorna ställs på köparens
// plattform före frågor senast; här följs status och svar.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import type { ProcurementQuestion } from '../../../../types/procurement'
import { EmptyState, LinkButton } from '../ui'
import { daysUntil, fmtDateTime, fmtRelativeDays } from '../uiFormat'
import { BlurText, SubHeading, inputCls, selectCls } from '../detail/fields'
import { errMsg, useConfirm } from '../detail/helpers'

const STATUS_LABEL: Record<ProcurementQuestion['status'], string> = {
  draft: 'Utkast',
  sent: 'Skickad',
  answered: 'Besvarad',
  dropped: 'Struken',
}

const STATUS_DOT: Record<ProcurementQuestion['status'], string> = {
  draft: 'bg-amber-400',
  sent: 'bg-sky-400',
  answered: 'bg-[#20c58f]',
  dropped: 'bg-slate-600',
}

interface Props {
  notice: NoticeWithRelations
  questions: ProcurementQuestion[]
  onChanged: () => void
}

export default function BuyerQuestions({ notice, questions, onChanged }: Props) {
  const [text, setText] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()

  const d = daysUntil(notice.questions_deadline)
  const drafts = questions.filter((q) => q.status === 'draft').length

  const patch = async (q: ProcurementQuestion, p: Partial<ProcurementQuestion>) => {
    try {
      await ProcurementService.saveQuestion({ id: q.id, notice_id: notice.id, created_by: q.created_by, ...p })
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara frågan'))
    }
  }

  const add = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await ProcurementService.saveQuestion({ notice_id: notice.id, question: text.trim(), reason: reason.trim() || null, source: 'manual', status: 'draft' })
      setText('')
      setReason('')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte lägga till frågan'))
    } finally {
      setBusy(false)
    }
  }

  const remove = (q: ProcurementQuestion) =>
    confirm('Ta bort fråga', 'Ta bort frågan? Stryk den i stället om den ska finnas kvar som historik.', async () => {
      try {
        await ProcurementService.deleteQuestion(q.id)
        onChanged()
      } catch (e) {
        toast.error(errMsg(e, 'Kunde inte ta bort frågan'))
      }
    })

  return (
    <div>
      <SubHeading>Frågor till köparen ({questions.length})</SubHeading>
      <p className="text-[12.5px] mb-3 tabular-nums">
        {notice.questions_deadline ? (
          <>
            <span className="text-slate-400">Frågor senast </span>
            <span className="text-slate-100">{fmtDateTime(notice.questions_deadline)}</span>{' '}
            <span className={d != null && d < 0 ? 'text-slate-500' : d != null && d <= 3 ? 'text-red-400' : d != null && d <= 7 ? 'text-amber-400' : 'text-slate-500'}>
              {fmtRelativeDays(notice.questions_deadline)}
            </span>
            {drafts > 0 && d != null && d >= 0 && <span className="text-amber-400">, {drafts} utkast inte skickade</span>}
          </>
        ) : (
          <span className="text-slate-500">Frågor senast är inte satt. Sätt datumet i tidslinjen.</span>
        )}
      </p>

      {questions.length === 0 ? (
        <EmptyState title="Inga frågor ännu" hint="AI föreslår frågor när underlaget läses. Egna frågor läggs till nedan." />
      ) : (
        <ul className="divide-y divide-slate-800 border-y border-slate-800 -mx-4">
          {questions.map((q) => (
            <li key={q.id} className={`px-4 py-2.5 ${q.status === 'dropped' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-3 w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[q.status]}`} />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <BlurText value={q.question} multiline rows={2} onCommit={(v) => v && void patch(q, { question: v })} ariaLabel="Fråga" />
                  <BlurText value={q.reason} onCommit={(v) => void patch(q, { reason: v })} placeholder="Motivering: vad i underlaget är oklart" ariaLabel="Motivering" />
                  {(q.status === 'answered' || q.status === 'sent' || q.answer) && (
                    <BlurText value={q.answer} multiline rows={2} onCommit={(v) => void patch(q, { answer: v, ...(v && q.status !== 'answered' ? { status: 'answered' as const } : {}) })} placeholder="Köparens svar" ariaLabel="Svar" />
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <select className={`${selectCls} w-auto py-1`} value={q.status} onChange={(e) => void patch(q, { status: e.target.value as ProcurementQuestion['status'] })} aria-label="Status">
                    {(Object.keys(STATUS_LABEL) as Array<ProcurementQuestion['status']>).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <span className={`text-[10.5px] ${q.source === 'ai' ? 'text-amber-400/80' : 'text-slate-500'}`}>{q.source === 'ai' ? 'AI-förslag' : 'Egen'}</span>
                  <button type="button" onClick={() => remove(q)} className="p-1 text-slate-600 hover:text-red-400" aria-label="Ta bort fråga">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_auto] gap-2 items-center">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ny fråga" aria-label="Ny fråga" />
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivering (valfritt)" aria-label="Motivering" />
        <LinkButton onClick={() => void add()} disabled={busy || !text.trim()}>
          Lägg till
        </LinkButton>
      </div>
      {confirmNode}
    </div>
  )
}
