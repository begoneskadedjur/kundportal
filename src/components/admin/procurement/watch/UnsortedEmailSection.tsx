// src/components/admin/procurement/watch/UnsortedEmailSection.tsx
// Osorterad inkommande e-post överst i Bevakning: mejl som inte kunde matchas
// på svarsadress, ämnestagg eller avsändardomän. Personal kopplar dem till en
// upphandling (bilagorna följer med) eller ignorerar dem. Inkommande text
// visas bara som data.

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import type { ProcurementInboundEmail } from '../../../../types/procurement'
import { Section, LinkButton } from '../ui'
import { fmtDateTime } from '../uiFormat'
import { inputCls, selectCls } from '../detail/fields'
import { errMsg } from '../detail/helpers'

interface Props {
  emails: ProcurementInboundEmail[]
  notices: NoticeWithRelations[]
  onChanged: () => void
}

export default function UnsortedEmailSection({ emails, notices, onChanged }: Props) {
  if (emails.length === 0) return null
  return (
    <Section title={`Osorterad e-post (${emails.length})`} hint="Svar som inte kunde kopplas automatiskt. Koppla till rätt upphandling så följer bilagorna med.">
      <ul className="divide-y divide-slate-800">
        {emails.map((m) => (
          <EmailRow key={m.id} email={m} notices={notices} onChanged={onChanged} />
        ))}
      </ul>
    </Section>
  )
}

function EmailRow({ email, notices, onChanged }: { email: ProcurementInboundEmail; notices: NoticeWithRelations[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [noticeId, setNoticeId] = useState('')
  const [busy, setBusy] = useState(false)

  const options = useMemo(() => {
    const s = search.trim().toLowerCase()
    const list = s
      ? notices.filter((n) => `${n.title} ${n.buyer_name ?? ''} ${n.buyer?.name ?? ''} bgu-${n.bgu_number}`.toLowerCase().includes(s))
      : notices
    return list.slice(0, 50)
  }, [notices, search])

  const assign = async (ignore: boolean) => {
    setBusy(true)
    try {
      await ProcurementService.assignInboundEmail(email.id, ignore ? null : noticeId, ignore)
      toast.success(ignore ? 'E-posten ignoreras' : 'E-posten kopplad')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Mail className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-[13px] text-slate-200 truncate">{email.subject || '(inget ämne)'}</span>
            <span className="text-[11px] text-slate-500 tabular-nums">{fmtDateTime(email.received_at)}</span>
          </div>
          <div className="text-[11px] text-slate-500 truncate">Från {email.from_email ?? 'okänd avsändare'}</div>
          {open && email.text_body && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11.5px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg p-2">
              {email.text_body.slice(0, 4000)}
            </pre>
          )}
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
            <input className={inputCls} placeholder="Sök upphandling" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Sök upphandling" />
            <select className={selectCls} value={noticeId} onChange={(e) => setNoticeId(e.target.value)} aria-label="Välj upphandling">
              <option value="">Välj upphandling ({options.length})</option>
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  BGU-{n.bgu_number} {n.title.slice(0, 70)} ({n.buyer?.name ?? n.buyer_name ?? 'okänd köpare'})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3 justify-end">
              <LinkButton onClick={() => void assign(false)} disabled={busy || !noticeId}>Koppla</LinkButton>
              <LinkButton tone="muted" onClick={() => void assign(true)} disabled={busy}>Ignorera</LinkButton>
              <LinkButton tone="muted" onClick={() => setOpen((o) => !o)}>{open ? 'Dölj text' : 'Visa text'}</LinkButton>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
