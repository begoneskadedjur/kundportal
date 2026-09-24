// src/components/admin/procurement/workshop/SubmissionCheck.tsx
// Anbudsverkstad d) Inlämningskontroll före sista anbudsdag: skallkrav,
// bevis med bilaga, dokument på plats, pris över golvet, frågor senast,
// sista anbudsdag och signering. Signeringen bockas av manuellt och sparas
// som händelse. Anbudet lämnas alltid på köparens plattform.

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink } from 'lucide-react'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import {
  DOC_TYPE_LABEL,
  type ProcurementBid,
  type ProcurementDocType,
  type ProcurementDocument,
  type ProcurementEvent,
  type ProcurementPriceLine,
  type ProcurementRequirement,
} from '../../../../types/procurement'
import { StatusDot } from '../ui'
import { daysUntil, fmtDateTime, fmtKr, fmtRelativeDays, type Tone } from '../uiFormat'
import { SubHeading, checkboxCls } from '../detail/fields'
import { errMsg } from '../detail/helpers'

/** Dokument som ska finnas på upphandlingen innan anbudet lämnas */
const REQUIRED_DOCS: ProcurementDocType[] = ['tender_documents', 'bid']

interface Props {
  notice: NoticeWithRelations
  requirements: ProcurementRequirement[]
  documents: ProcurementDocument[]
  priceLines: ProcurementPriceLine[]
  currentBid: ProcurementBid | null
  events: ProcurementEvent[]
  onEventsChanged: () => void
}

interface Check {
  key: string
  label: string
  tone: Tone
  detail: string
}

export default function SubmissionCheck({ notice, requirements, documents, priceLines, currentBid, events, onEventsChanged }: Props) {
  const [saving, setSaving] = useState(false)

  const signEvent = events.find((e) => e.event_type === 'signing_done' || e.event_type === 'signing_undone') ?? null
  const signed = signEvent?.event_type === 'signing_done'

  const checks = useMemo<Check[]>(() => {
    const out: Check[] = []

    const skall = requirements.filter((r) => r.req_type === 'skall')
    const skallDone = skall.filter((r) => r.done).length
    out.push({
      key: 'skall',
      label: 'Alla skallkrav klara',
      tone: skall.length === 0 ? 'warn' : skallDone === skall.length ? 'good' : 'bad',
      detail: skall.length === 0 ? 'Kravlistan har inga skallkrav. Stämmer det mot underlaget?' : `${skallDone} av ${skall.length} klara`,
    })

    const proof = requirements.filter((r) => r.req_type === 'bevis')
    const proofOk = proof.filter((r) => r.attachment_document_id || (r.attachment_note && r.attachment_note.trim())).length
    out.push({
      key: 'bevis',
      label: 'Alla bevis har bilaga',
      tone: proof.length === 0 ? 'muted' : proofOk === proof.length ? 'good' : 'bad',
      detail: proof.length === 0 ? 'Inga bevis i kravlistan' : `${proofOk} av ${proof.length} har bilaga eller anteckning`,
    })

    const present = new Set(documents.map((d) => d.doc_type))
    const missing = REQUIRED_DOCS.filter((t) => !present.has(t))
    out.push({
      key: 'docs',
      label: 'Dokument på plats',
      tone: missing.length === 0 ? 'good' : 'warn',
      detail: missing.length === 0 ? `${REQUIRED_DOCS.map((t) => DOC_TYPE_LABEL[t]).join(' och ')} finns` : `Saknas: ${missing.map((t) => DOC_TYPE_LABEL[t]).join(', ')}`,
    })

    const total = priceLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
    const floor = currentBid?.floor_price != null ? Number(currentBid.floor_price) : null
    out.push({
      key: 'floor',
      label: 'Pris över golvet',
      tone: priceLines.length === 0 || floor == null ? 'warn' : total >= floor ? 'good' : 'bad',
      detail:
        priceLines.length === 0
          ? 'Prisbilagan är tom'
          : floor == null
            ? `Prisbilagan ${fmtKr(total)} per år, ingen sparad kalkyl att jämföra med`
            : `Prisbilagan ${fmtKr(total)} mot golvet ${fmtKr(floor)} per år`,
    })

    const qd = daysUntil(notice.questions_deadline)
    out.push({
      key: 'questions',
      label: 'Frågor senast',
      tone: qd == null ? 'muted' : qd < 0 ? 'muted' : qd <= 3 ? 'warn' : 'good',
      detail: notice.questions_deadline
        ? `${fmtDateTime(notice.questions_deadline)}, ${qd != null && qd < 0 ? 'passerat' : fmtRelativeDays(notice.questions_deadline)}`
        : 'Inte satt',
    })

    const td = daysUntil(notice.tender_deadline)
    out.push({
      key: 'deadline',
      label: 'Sista anbudsdag',
      tone: td == null ? 'warn' : td < 0 ? 'bad' : td <= 3 ? 'bad' : td <= 7 ? 'warn' : 'good',
      detail: notice.tender_deadline ? `${fmtDateTime(notice.tender_deadline)}, ${td != null && td < 0 ? 'passerad' : fmtRelativeDays(notice.tender_deadline)}` : 'Okänd',
    })
    return out
  }, [requirements, documents, priceLines, currentBid, notice.questions_deadline, notice.tender_deadline])

  const toggleSigned = async (value: boolean) => {
    setSaving(true)
    try {
      await ProcurementService.addEvent(notice.id, value ? 'signing_done' : 'signing_undone', value ? 'Anbudet signerat' : 'Signering ångrad')
      onEventsChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara signeringen'))
    } finally {
      setSaving(false)
    }
  }

  const ready = checks.every((c) => c.tone === 'good' || c.tone === 'muted') && signed

  return (
    <div>
      <SubHeading>Inlämningskontroll</SubHeading>
      <ul className="space-y-1.5">
        {checks.map((c) => (
          <li key={c.key} className="flex flex-wrap items-baseline gap-x-3">
            <span className="w-44 shrink-0">
              <StatusDot tone={c.tone}>{c.label}</StatusDot>
            </span>
            <span className="text-[12px] text-slate-500 tabular-nums">{c.detail}</span>
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-x-3">
          <span className="w-44 shrink-0">
            <StatusDot tone={signed ? 'good' : 'warn'}>Signering klar</StatusDot>
          </span>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
            <input type="checkbox" className={checkboxCls} checked={signed} disabled={saving} onChange={(e) => void toggleSigned(e.target.checked)} />
            {signEvent ? `${signed ? 'Signerat' : 'Ångrat'} ${fmtDateTime(signEvent.created_at)}${signEvent.actor_name ? ` av ${signEvent.actor_name}` : ''}` : 'Bocka av när behörig firmatecknare signerat'}
          </label>
        </li>
      </ul>

      <div className={`mt-3 text-[12.5px] ${ready ? 'text-[#20c58f]' : 'text-slate-400'}`}>
        {ready ? 'Allt bockat. Anbudet kan lämnas.' : 'Anbudet är inte klart att lämnas.'}
      </div>
      <p className="mt-1 text-[12px] text-slate-500">
        Anbudet lämnas alltid på köparens plattform, aldrig från portalen.{' '}
        {notice.platform_url ? (
          <a href={notice.platform_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#20c58f] hover:underline">
            Öppna köparens plattform <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-slate-600">Länk till plattformen saknas; se källposterna.</span>
        )}
      </p>
    </div>
  )
}
