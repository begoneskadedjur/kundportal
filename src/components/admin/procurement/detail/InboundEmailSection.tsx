// src/components/admin/procurement/detail/InboundEmailSection.tsx
// Inkommen e-post på upphandlingen (del av block 9). Visar mejl som matchats
// hit, deras bilagor med länk till Dokument-blocket och AI:ns sammanfattning
// per bilaga. Ett felmatchat mejl kan flyttas till en annan upphandling eller
// tillbaka till Osorterat; bilagor och utlästa anbudsgivare följer med.
// Inkommande text visas bara som data.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ProcurementService } from '../../../../services/procurementService'
import { DOC_TYPE_LABEL, type ProcurementDocType, type ProcurementDocument, type ProcurementInboundEmail } from '../../../../types/procurement'
import { LinkButton, StatusDot } from '../ui'
import { fmtDateTime, type Tone } from '../uiFormat'
import { SubHeading, inputCls } from './fields'
import { errMsg, useConfirm } from './helpers'

const MATCH_LABEL: Record<NonNullable<ProcurementInboundEmail['match_method']>, { label: string; tone: Tone }> = {
  reply_to: { label: 'Svarsadress', tone: 'good' },
  subject_tag: { label: 'Ämnestagg', tone: 'good' },
  sender_domain: { label: 'Avsändarens domän', tone: 'warn' },
  manual: { label: 'Kopplad manuellt', tone: 'info' },
}

interface ClassifiedDoc {
  id: string
  fileName: string | null
  docType: string | null
  summary: string | null
  bidders: number | null
}

/** ai_classification är jsonb från webhooken; läs defensivt */
function parseClassification(raw: ProcurementInboundEmail['ai_classification']): { docs: ClassifiedDoc[]; errors: string[] } {
  const docs: ClassifiedDoc[] = []
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { docs, errors }
  const list = (raw as { documents?: unknown }).documents
  if (Array.isArray(list)) {
    for (const d of list) {
      if (!d || typeof d !== 'object') continue
      const o = d as Record<string, unknown>
      if (typeof o.id !== 'string') continue
      docs.push({
        id: o.id,
        fileName: typeof o.fileName === 'string' ? o.fileName : null,
        docType: typeof o.docType === 'string' ? o.docType : null,
        summary: typeof o.summary === 'string' ? o.summary : null,
        bidders: typeof o.bidders === 'number' ? o.bidders : null,
      })
    }
  }
  const errs = (raw as { errors?: unknown }).errors
  if (Array.isArray(errs)) for (const e of errs) if (typeof e === 'string') errors.push(e)
  return { docs, errors }
}

/** Scrollar till dokumentraden i block 2 och markerar den kort */
function scrollToDocument(docId: string) {
  const el = document.getElementById(`dok-${docId}`)
  if (!el) {
    toast.error('Dokumentet finns inte längre i listan')
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('bg-[#20c58f]/10')
  window.setTimeout(() => el.classList.remove('bg-[#20c58f]/10'), 1800)
}

interface Props {
  noticeId: string
  documents: ProcurementDocument[]
  /** Anropas efter flytt: dokument, händelser och anbudsgivare ska hämtas om */
  onMoved: () => void
}

export default function InboundEmailSection({ noticeId, documents, onMoved }: Props) {
  const [emails, setEmails] = useState<ProcurementInboundEmail[]>([])
  const [loaded, setLoaded] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()

  const load = useCallback(async () => {
    try {
      setEmails(await ProcurementService.listInboundEmailsForNotice(noticeId))
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte hämta inkommen e-post'))
    } finally {
      setLoaded(true)
    }
  }, [noticeId])

  useEffect(() => {
    void load()
  }, [load])

  const move = async (email: ProcurementInboundEmail, target: { id: string; label: string } | null) => {
    try {
      const res = await ProcurementService.assignInboundEmail(email.id, target?.id ?? null)
      const parts = [`${res.documents} bilag${res.documents === 1 ? 'a' : 'or'}`]
      if (res.bidders_moved) parts.push(`${res.bidders_moved} anbudsgivare flyttade`)
      if (res.bidders_removed) parts.push(`${res.bidders_removed} anbudsgivare borttagna`)
      toast.success(`${target ? `Flyttad till ${target.label}` : 'Flyttad till Osorterat'}: ${parts.join(', ')}`)
      await load()
      onMoved()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte flytta e-posten'))
      throw e
    }
  }

  const toUnsorted = (email: ProcurementInboundEmail) =>
    confirm(
      'Flytta till Osorterat',
      `"${email.subject || '(inget ämne)'}" läggs i Osorterad e-post under Bevakning. Bilagorna följer med och anbudsgivare som lästs ut ur mejlet tas bort från den här upphandlingen.`,
      () => move(email, null),
      { confirmLabel: 'Flytta', variant: 'warning' }
    )

  return (
    <div>
      <SubHeading>Inkommen e-post ({emails.length})</SubHeading>
      {!loaded ? null : emails.length === 0 ? (
        <p className="text-[12px] text-slate-600">Ingen e-post kopplad. Svar på begäran om handlingar hamnar här automatiskt.</p>
      ) : (
        <ul className="divide-y divide-slate-800 border-y border-slate-800 -mx-4">
          {emails.map((m) => (
            <EmailRow
              key={m.id}
              email={m}
              noticeId={noticeId}
              documents={documents.filter((d) => d.inbound_email_id === m.id)}
              onMove={(target) => move(m, target)}
              onUnsorted={() => toUnsorted(m)}
            />
          ))}
        </ul>
      )}
      {confirmNode}
    </div>
  )
}

// ---------------------------------------------------------------------------

function EmailRow({
  email,
  noticeId,
  documents,
  onMove,
  onUnsorted,
}: {
  email: ProcurementInboundEmail
  noticeId: string
  documents: ProcurementDocument[]
  onMove: (target: { id: string; label: string }) => Promise<void>
  onUnsorted: () => void
}) {
  const [showText, setShowText] = useState(false)
  const [moving, setMoving] = useState(false)
  const { docs: classified, errors } = parseClassification(email.ai_classification)
  const match = email.match_method ? MATCH_LABEL[email.match_method] : null

  // Bilagor: dokumenten som finns kvar, i den ordning webhooken sparade dem
  const order = new Map(classified.map((c, i) => [c.id, i]))
  const attachments = [...documents].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
  const missing = classified.filter((c) => !documents.some((d) => d.id === c.id))

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[12px] text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(email.received_at)}</span>
        <span className="text-[13px] text-slate-200 min-w-0 break-words">{email.subject || '(inget ämne)'}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500">
        <span className="break-all">Från {email.from_email ?? 'okänd avsändare'}</span>
        {match && <StatusDot tone={match.tone}>{match.label}</StatusDot>}
        <span>
          {attachments.length === 0 ? 'Inga bilagor' : `${attachments.length} bilag${attachments.length === 1 ? 'a' : 'or'}`}
        </span>
      </div>

      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {attachments.map((d) => {
            const c = classified.find((x) => x.id === d.id)
            const summary = c?.summary ?? d.ai_summary
            const type = DOC_TYPE_LABEL[d.doc_type as ProcurementDocType] ?? d.doc_type
            return (
              <li key={d.id} className="text-[12px] pl-3 border-l border-slate-800">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <button type="button" onClick={() => scrollToDocument(d.id)} className="text-left text-[#20c58f] hover:underline break-words">
                    {d.file_name}
                  </button>
                  <span className="text-[11px] text-slate-500">{type}</span>
                  {c?.bidders ? <span className="text-[11px] text-slate-500">{c.bidders} anbudsgivare utlästa</span> : null}
                </div>
                {summary && <p className="text-[11.5px] text-slate-400 mt-0.5 line-clamp-3">{summary}</p>}
              </li>
            )
          })}
        </ul>
      )}
      {missing.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-600">
          Borttagna bilagor: {missing.map((c) => c.fileName ?? 'okänd fil').join(', ')}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="mt-1.5 text-[11px] text-amber-400/90 space-y-0.5">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <LinkButton tone="muted" onClick={() => setShowText((o) => !o)}>{showText ? 'Dölj brödtext' : 'Visa brödtext'}</LinkButton>
        <LinkButton onClick={() => setMoving((o) => !o)}>{moving ? 'Avbryt flytt' : 'Flytta till annan upphandling'}</LinkButton>
        <LinkButton tone="muted" onClick={onUnsorted}>Till Osorterat</LinkButton>
      </div>

      {showText && (
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-sans text-[11.5px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg p-2">
          {email.text_body?.trim() ? email.text_body.trim().slice(0, 8000) : 'Mejlet saknar brödtext.'}
        </pre>
      )}

      {moving && (
        <MovePicker
          noticeId={noticeId}
          onPick={async (target) => {
            await onMove(target)
            setMoving(false)
          }}
        />
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------

function MovePicker({ noticeId, onPick }: { noticeId: string; onPick: (target: { id: string; label: string }) => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; bgu_number: number; title: string; buyer_name: string | null }>>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setResults([])
      return
    }
    let alive = true
    setSearching(true)
    const t = window.setTimeout(() => {
      ProcurementService.searchNoticesForMove(q, noticeId)
        .then((r) => {
          if (alive) setResults(r)
        })
        .catch((e) => toast.error(errMsg(e, 'Kunde inte söka')))
        .finally(() => {
          if (alive) setSearching(false)
        })
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [query, noticeId])

  const pick = async (n: { id: string; bgu_number: number; title: string }) => {
    setBusyId(n.id)
    try {
      await onPick({ id: n.id, label: `BGU-${n.bgu_number}` })
    } catch {
      // Felet visas redan som toast
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <input
        className={inputCls}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök på titel, köpare eller BGU-nummer"
        aria-label="Sök upphandling att flytta till"
        autoFocus
      />
      <div className="mt-2">
        {searching ? (
          <p className="text-[11.5px] text-slate-500">Söker</p>
        ) : query.trim() && results.length === 0 ? (
          <p className="text-[11.5px] text-slate-600">Inga träffar.</p>
        ) : (
          <ul className="space-y-1">
            {results.map((n) => (
              <li key={n.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0">
                  <span className="text-slate-500 tabular-nums mr-2">BGU-{n.bgu_number}</span>
                  <span className="text-slate-200">{n.title.slice(0, 90)}</span>
                  <span className="text-slate-500"> ({n.buyer_name ?? 'okänd köpare'})</span>
                </span>
                <LinkButton onClick={() => void pick(n)} disabled={busyId != null}>
                  {busyId === n.id ? 'Flyttar' : 'Flytta hit'}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-600">Bilagorna och anbudsgivare som lästs ut ur mejlet följer med.</p>
    </div>
  )
}
