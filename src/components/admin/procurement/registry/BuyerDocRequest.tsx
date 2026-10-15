// src/components/admin/procurement/registry/BuyerDocRequest.tsx
// Begär ut handlingar per tidigare avtal i köparprofilen (beslut 5,
// 2026-10-15): samma utskick som i steget Utfall (api/procurement/request-documents),
// med upphandlingens BGU-tagg så att svaret matchas automatiskt. Kräver att
// avtalet har en annons i bevakningen; UHM-poster utan annons kan inte begäras härifrån.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { ProcurementService } from '../../../../services/procurementService'
import { DOCUMENT_REQUEST_TYPES, REQUEST_STATUS_LABEL, type ProcurementDocumentRequest } from '../../../../types/procurement'
import { PrimaryButton, SecondaryButton, StatusDot } from '../ui'
import { fmtDate } from '../uiFormat'

const inputCls =
  'w-full h-10 px-3 text-[13px] bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50'

/** Senaste begäran för avtalet som punkt plus text, mottagen visas med datum */
export function RequestStatus({ requests }: { requests: ProcurementDocumentRequest[] }) {
  const r = [...requests].sort((a, b) => String(b.sent_at ?? b.created_at).localeCompare(String(a.sent_at ?? a.created_at)))[0]
  if (!r) return null
  const tone = r.status === 'received' ? 'good' : r.status === 'rejected' ? 'bad' : r.status === 'escalated' || r.status === 'reminded' ? 'warn' : 'info'
  return (
    <div>
      <StatusDot tone={tone}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}{r.received_at ? ` ${fmtDate(r.received_at)}` : ''}</StatusDot>
      <div className="text-[10.5px] text-slate-500">begärd {fmtDate(r.sent_at ?? r.created_at)}</div>
    </div>
  )
}

interface Props {
  noticeId: string
  awardId: string | null
  title: string | null
  registrarEmail: string | null
  onSent: () => void
  onClose: () => void
}

export default function BuyerDocRequest({ noticeId, awardId, title, registrarEmail, onSent, onClose }: Props) {
  const [types, setTypes] = useState<Set<string>>(new Set(DOCUMENT_REQUEST_TYPES.map((t) => t.key)))
  const [recipient, setRecipient] = useState(registrarEmail ?? '')
  const [preview, setPreview] = useState<{ subject?: string; body?: string } | null>(null)
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null)
  const valid = types.size > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient.trim())

  const run = async (isPreview: boolean) => {
    if (!valid) {
      toast.error('Välj minst en handling och ange registratorns e-post')
      return
    }
    setBusy(isPreview ? 'preview' : 'send')
    try {
      const res = await ProcurementService.requestDocuments({ noticeId, awardId, docTypes: [...types], recipientEmail: recipient.trim(), preview: isPreview })
      if (isPreview) setPreview({ subject: res.subject, body: res.body })
      else {
        toast.success('Begäran skickad. Svaret kopplas till upphandlingen automatiskt.')
        onSent()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Begäran misslyckades')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-4 space-y-3 bg-slate-900/60">
      <div className="text-[12.5px] text-slate-300">Begär ut handlingar för {title ?? 'avtalet'}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {DOCUMENT_REQUEST_TYPES.map((t) => (
          <label key={t.key} className="inline-flex items-center gap-1.5 min-h-[32px] text-[12.5px] text-slate-300">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#20c58f]"
              checked={types.has(t.key)}
              onChange={(e) => {
                const n = new Set(types)
                if (e.target.checked) n.add(t.key)
                else n.delete(t.key)
                setTypes(n)
                setPreview(null)
              }}
            />
            {t.label}
          </label>
        ))}
      </div>
      <label className="block max-w-md">
        <span className="block text-[11px] text-slate-500 mb-1">Mottagare (köparens registrator)</span>
        <input className={inputCls} type="email" value={recipient} onChange={(e) => { setRecipient(e.target.value); setPreview(null) }} placeholder="registrator@kommun.se" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={() => void run(true)} disabled={!valid || busy != null}>Förhandsgranska</SecondaryButton>
        <PrimaryButton onClick={() => void run(false)} disabled={!valid || busy != null || !preview}>
          <Icon name="kontakt.mejl" size={20} />
          Skicka begäran
        </PrimaryButton>
        <button type="button" onClick={onClose} className="min-h-[44px] px-2 text-[13px] text-slate-400 hover:text-slate-200">Avbryt</button>
        {!preview && <span className="text-[11px] text-slate-500">Förhandsgranska innan du skickar.</span>}
      </div>
      {preview && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-[11px] text-slate-500">Ämne</div>
          <div className="text-[12.5px] text-slate-200 mb-2">{preview.subject ?? '–'}</div>
          <pre className="text-[12px] text-slate-300 whitespace-pre-wrap font-sans">{preview.body ?? '–'}</pre>
        </div>
      )}
    </div>
  )
}
