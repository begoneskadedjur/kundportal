// src/components/admin/procurement/rfi/RfiFollowUp.tsx
// Steget Uppföljning i RFI-läget (3.71.0). Efter "Markera som besvarad":
//   - signalen "Upphandling väntas" i Framförhållning, kopplad till köparen
//     och RFI:n (Mercell-synkens signal återanvänds, annars skapas en),
//   - "Spara svaren i anbudsbiblioteket" för godkända fritextsvar,
//   - den riktiga annonsen när den dyker upp: senare annonser hos samma
//     köpare med liknande titel (src/shared/procurementRfi.ts matchFollowUps).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import type { NoticeWithRelations } from '../../../../services/procurementService'
import { ProcurementRfiService } from '../../../../services/procurementRfiService'
import { SIGNAL_STATUS_DOT, SIGNAL_STATUS_LABEL, type ProcurementRfiQuestion, type ProcurementSignal } from '../../../../types/procurement'
import { RFI_ANSWERED_STATUSES, type FollowUpCandidate } from '../../../../shared/procurementRfi'
import { PrimaryButton, SecondaryButton, StatusDot } from '../ui'
import { fmtDate } from '../uiFormat'
import { Block } from '../detail/fields'
import { errMsg } from '../detail/helpers'
import { noticePath, procurementPath } from '../../../../lib/procurementPortal'

interface Props {
  notice: NoticeWithRelations
  questions: ProcurementRfiQuestion[]
  signal: ProcurementSignal | null
  onMarkAnswered: () => void
  onChanged: () => void
}

export default function RfiFollowUp({ notice, questions, signal, onMarkAnswered, onChanged }: Props) {
  const [matches, setMatches] = useState<Array<FollowUpCandidate & { score: number }> | null>(null)
  const [saving, setSaving] = useState(false)
  const answered = RFI_ANSWERED_STATUSES.includes(notice.our_status)

  useEffect(() => {
    let alive = true
    ProcurementRfiService.listFollowUps(notice)
      .then((m) => alive && setMatches(m))
      .catch(() => alive && setMatches([]))
    return () => {
      alive = false
    }
  }, [notice])

  const savable = questions.filter((q) => q.answer_status === 'godkand' && !q.library_answer_id && (q.answer_type === 'fritext' || q.answer_type === 'ja_nej'))
  const saved = questions.filter((q) => q.library_answer_id).length

  const saveLibrary = async () => {
    setSaving(true)
    try {
      const n = await ProcurementRfiService.saveToLibrary(notice, questions)
      toast.success(n === 1 ? '1 svar sparat i anbudsbiblioteket' : `${n} svar sparade i anbudsbiblioteket`)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara i anbudsbiblioteket'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {!answered && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[10px] border border-slate-800 bg-slate-900/40 p-4">
          <p className="flex-1 text-[13px] text-slate-300">
            När svaren är inskickade till köparen: markera RFI:n som besvarad. Då följs köparen i Framförhållning tills upphandlingen annonseras.
          </p>
          <PrimaryButton onClick={onMarkAnswered}>
            <Icon name="upphandling.besvarad" size={20} />
            Markera som besvarad
          </PrimaryButton>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Block icon="upphandling.signal" title="Upphandling väntas" framed={false}>
          {signal ? (
            <div className="space-y-1.5">
              <p className="text-[13px] text-slate-200">{signal.text}</p>
              <div className="flex flex-wrap items-center gap-x-4 text-[12px] text-slate-500">
                <StatusDot dotClass={SIGNAL_STATUS_DOT[signal.status]}>{SIGNAL_STATUS_LABEL[signal.status]}</StatusDot>
                {signal.expected_quarter && <span className="tabular-nums">Väntas {signal.expected_quarter.replace('-Q', ' kvartal ')}</span>}
                <span>{signal.buyer_name ?? notice.buyer_name}</span>
              </div>
              <Link to={procurementPath('/signaler')} className="inline-flex items-center min-h-[44px] text-[13px] text-[#20c58f] hover:underline">
                Öppna Signaler i Framförhållning
              </Link>
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">Ingen signal ännu. Den skapas när RFI:n markeras som besvarad.</p>
          )}
        </Block>

        <Block icon="upphandling.anbud" title="Anbudsbiblioteket" framed={false}>
          <p className="text-[13px] text-slate-400">
            Godkända svar kan sparas som poster i anbudsbiblioteket med taggarna rfi, köparen och avsnittet, så att de återanvänds i kommande anbud och RFI:er.
            {saved > 0 ? ` ${saved} svar är redan sparade.` : ''}
          </p>
          <div className="mt-3">
            <SecondaryButton onClick={() => void saveLibrary()} disabled={saving || savable.length === 0}>
              <Icon name="allman.plus" size={20} />
              {saving ? 'Sparar ...' : `Spara svaren i anbudsbiblioteket${savable.length ? ` (${savable.length})` : ''}`}
            </SecondaryButton>
            {savable.length === 0 && saved === 0 && <p className="mt-1.5 text-[12px] text-slate-500">Godkänn svaren i steget Svar först.</p>}
          </div>
        </Block>
      </div>

      <Block icon="upphandling.annons" title="Den riktiga annonsen" framed={false}>
        {matches == null ? (
          <p className="text-[13px] text-slate-500">Letar ...</p>
        ) : matches.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            Ingen annons ännu. Portalen letar efter senare annonser hos {notice.buyer?.name ?? notice.buyer_name ?? 'köparen'} med liknande titel.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 border-y border-slate-800">
            {matches.map((m) => (
              <li key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 text-[13px]">
                <Link to={noticePath(m.id)} className="flex-1 min-w-0 text-slate-200 hover:text-[#20c58f] break-words">
                  {m.title}
                </Link>
                <span className="text-[12px] text-slate-500 tabular-nums">
                  BGU-{m.bgu_number}, publicerad {fmtDate(m.published_at)}
                  {m.tender_deadline ? `, sista anbudsdag ${fmtDate(m.tender_deadline)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  )
}
