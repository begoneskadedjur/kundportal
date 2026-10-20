// src/components/admin/procurement/rfi/RfiAnswers.tsx
// Steget Svar i RFI-läget (3.71.0). En rad per fråga ur köparens formulär,
// grupperad per avsnitt: frågan ordagrant, sammanhanget hopfällt och ett
// svarsfält efter typ (fritext, ja eller nej, procent per år,
// företagsuppgifter). Företagsuppgifter förifylls ur sparade uppgifter,
// BeGones fasta uppgifter och ansvarig för upphandlingen; det man fyller i
// sparas som företagsuppgift till nästa gång. AI skriver utkast till fritext
// och ja/nej-frågor ur BeGones eget material, anbudsbiblioteket och RFI:ns
// bakgrund. Varje svar är Utkast eller Godkänt. Export skriver svaren i en
// kopia av köparens Word-formulär.

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import type { NoticeWithRelations, ProcurementManagerProfile } from '../../../../services/procurementService'
import { ProcurementRfiService } from '../../../../services/procurementRfiService'
import type { ProcurementCompanyFact, ProcurementDocument, ProcurementRfiQuestion } from '../../../../types/procurement'
import {
  RFI_ANSWER_TYPE_LABEL,
  SUGGESTED_FACTS,
  exportIssues,
  gapsIn,
  isAnswered,
  isContactKey,
  prefillValues,
  rfiProgress,
  type ContactPerson,
} from '../../../../shared/procurementRfi'
import { EmptyState, LinkButton, PrimaryButton, SecondaryButton, StatusDot } from '../ui'
import { fmtDateTime } from '../uiFormat'
import { inputCls } from '../detail/fields'
import { errMsg, useConfirm } from '../detail/helpers'
import { exportRfiAnswers } from './rfiExport'

const SOURCE_LABEL: Record<string, string> = {
  ai: 'AI-utkast',
  manuell: 'Skrivet för hand',
  foretagsuppgift: 'Ur företagsuppgifterna',
  bibliotek: 'Ur anbudsbiblioteket',
}

interface Props {
  notice: NoticeWithRelations
  questions: ProcurementRfiQuestion[]
  documents: ProcurementDocument[]
  managers: ProcurementManagerProfile[]
  onChanged: () => void
}

export default function RfiAnswers({ notice, questions, documents, managers, onChanged }: Props) {
  const [facts, setFacts] = useState<ProcurementCompanyFact[]>([])
  const [contact, setContact] = useState<ContactPerson | null>(null)
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const stopRef = useRef(false)
  const { confirm, node: confirmNode } = useConfirm()

  const loadFacts = () =>
    ProcurementRfiService.listFacts()
      .then(setFacts)
      .catch((e) => toast.error(errMsg(e, 'Kunde inte hämta företagsuppgifterna')))

  useEffect(() => {
    void loadFacts()
  }, [])

  useEffect(() => {
    let alive = true
    const fallback = managers.find((m) => m.user_id === notice.owner_id)
    ProcurementRfiService.getContact(notice.owner_id)
      .then((c) => {
        if (alive) setContact(c ?? (fallback ? { name: fallback.display_name, email: fallback.email, phone: null } : null))
      })
      .catch(() => {
        if (alive) setContact(fallback ? { name: fallback.display_name, email: fallback.email, phone: null } : null)
      })
    return () => {
      alive = false
    }
  }, [notice.owner_id, managers])

  const factMap = useMemo(() => Object.fromEntries(facts.filter((f) => f.value.trim()).map((f) => [f.key, f.value])), [facts])
  const progress = rfiProgress(questions)
  const groups = useMemo(() => {
    const out: Array<{ section: string; items: ProcurementRfiQuestion[] }> = []
    for (const q of questions) {
      const s = q.section ?? 'Frågor'
      const last = out[out.length - 1]
      if (last && last.section === s) last.items.push(q)
      else out.push({ section: s, items: [q] })
    }
    return out
  }, [questions])

  const draftable = questions.filter((q) => (q.answer_type === 'fritext' || q.answer_type === 'ja_nej') && q.answer_status !== 'godkand')
  const emptyDraftable = draftable.filter((q) => !isAnswered(q) && !(q.answer ?? '').trim())

  const draftAll = async () => {
    const list = emptyDraftable
    if (list.length === 0) {
      toast('Alla fritextfrågor har redan ett svar. Skriv om ett svar med Skriv utkast på frågan.')
      return
    }
    stopRef.current = false
    setBulk({ done: 0, total: list.length })
    let ok = 0
    let gaps = 0
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break
      try {
        const r = await ProcurementRfiService.draft(list[i].id)
        ok++
        gaps += r.gaps
      } catch (e) {
        toast.error(errMsg(e, 'Ett utkast kunde inte skapas'))
      }
      setBulk({ done: i + 1, total: list.length })
      onChanged()
    }
    setBulk(null)
    toast.success(`${ok} utkast klara${gaps ? `, ${gaps} luckor att fylla i` : ''}`)
  }

  const runExport = async () => {
    setExporting(true)
    try {
      const r = await exportRfiAnswers(notice, questions, documents)
      if (r.format === 'docx') {
        toast.success(r.skipped > 0 ? `Formuläret är exporterat. ${r.written} svar inskrivna, ${r.skipped} frågor utan svar eller plats i dokumentet.` : `Formuläret är exporterat med ${r.written} svar`)
      } else {
        toast.success('Originalet är inte ett Word-formulär. Svaren är exporterade till Excel.')
      }
    } catch (e) {
      toast.error(errMsg(e, 'Exporten misslyckades'))
    } finally {
      setExporting(false)
    }
  }

  const startExport = () => {
    const issues = exportIssues(questions)
    const lines = [
      issues.unanswered ? `${issues.unanswered} frågor saknar svar.` : null,
      issues.notApproved ? `${issues.notApproved} svar är inte godkända.` : null,
      issues.withGaps ? `${issues.withGaps} svar har luckor markerade med [FYLL I: ...].` : null,
      issues.unanchored ? `${issues.unanchored} frågor saknar plats i dokumentet och måste skrivas in för hand.` : null,
    ].filter(Boolean)
    if (lines.length === 0) {
      void runExport()
      return
    }
    confirm('Exportera ändå?', `${lines.join(' ')} Exportera formuläret ändå?`, runExport, { confirmLabel: 'Exportera', variant: 'warning' })
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-[10px] border border-slate-800">
        <EmptyState
          icon={<Icon name="upphandling.rfi" size={32} />}
          title="Inga frågor inlästa ännu"
          hint="Ladda upp köparens frågeformulär i steget Underlag, eller tryck Läs in frågorna på ett dokument som redan finns där."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-6">
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] text-slate-200 tabular-nums">
            {progress.approved} av {progress.total} godkända
            <span className="text-slate-500">, {progress.answered} besvarade</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-[#20c58f] transition-all" style={{ width: `${progress.total ? (progress.approved / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="flex items-start gap-1.5 mt-2 text-[11.5px] text-slate-500">
            <Icon name="kalla.ai" className="w-3.5 h-3.5 shrink-0 mt-px text-amber-400/80" />
            AI-utkasten bygger bara på BeGones eget material, anbudsbiblioteket, sparade företagsuppgifter och köparens bakgrund. Luckor står som [FYLL I: ...]. Inga priser, inga garantier.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {bulk ? (
            <SecondaryButton onClick={() => (stopRef.current = true)}>
              <Icon name="allman.stang" size={20} />
              Stoppa ({bulk.done} av {bulk.total})
            </SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => void draftAll()} disabled={emptyDraftable.length === 0}>
              <Icon name="kalla.ai" size={20} />
              Skriv utkast till alla{emptyDraftable.length ? ` (${emptyDraftable.length})` : ''}
            </SecondaryButton>
          )}
          <PrimaryButton onClick={startExport} disabled={exporting || !!bulk}>
            <Icon name="allman.ladda-ner" size={20} />
            {exporting ? 'Exporterar ...' : 'Exportera ifyllt formulär'}
          </PrimaryButton>
        </div>
      </div>

      <CompanyFacts facts={facts} onSaved={() => void loadFacts()} />

      {groups.map((g, gi) => (
        <section key={`${g.section}-${gi}`} className="min-w-0">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-2">{g.section}</h2>
          <ul className="divide-y divide-slate-800 border-y border-slate-800">
            {g.items.map((q) => (
              <QuestionItem key={q.id} q={q} facts={factMap} contact={contact} onChanged={onChanged} onFactsSaved={() => void loadFacts()} />
            ))}
          </ul>
        </section>
      ))}
      {confirmNode}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Företagsuppgifter som återanvänds

function CompanyFacts({ facts, onSaved }: { facts: ProcurementCompanyFact[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => {
    const byKey = new Map(facts.map((f) => [f.key, f]))
    const list = [...facts.filter((f) => !isContactKey(f.key)).map((f) => ({ key: f.key, label: f.label, value: f.value }))]
    for (const s of SUGGESTED_FACTS) if (!byKey.has(s.key)) list.push({ key: s.key, label: s.label, value: '' })
    return list
  }, [facts])
  const filled = facts.filter((f) => f.value.trim()).length

  const save = async (key: string, label: string, value: string) => {
    try {
      await ProcurementRfiService.saveFacts([{ key, label, value }])
      onSaved()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara uppgiften'))
    }
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 min-h-[44px] text-[11px] uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300"
      >
        <Icon name="allman.chevron" size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Företagsuppgifter till nästa gång, {filled} sparade
      </button>
      {open && (
        <div className="rounded-[10px] border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-[12px] text-slate-500 mb-3">
            Uppgifter som bara BeGone har, t.ex. omsättning, moderbolag, certifieringar, ledningssystem och fordon. De fylls i automatiskt i nästa RFI och AI:n får använda dem i utkasten. Företagsnamn och organisationsnummer fylls alltid i.
          </p>
          <dl className="space-y-2">
            {rows.map((r) => (
              <FactRow key={r.key} label={r.label} value={r.value} onCommit={(v) => void save(r.key, r.label, v)} />
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}

function FactRow({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-3 items-start">
      <dt className="text-[12.5px] text-slate-400 sm:pt-1.5">{label}</dt>
      <dd>
        <textarea
          className={`${inputCls} resize-y`}
          rows={v.length > 80 ? 3 : 1}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            if (v.trim() !== value.trim()) onCommit(v)
          }}
          aria-label={label}
          placeholder="Ej ifyllt"
        />
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// En fråga

function QuestionItem({
  q,
  facts,
  contact,
  onChanged,
  onFactsSaved,
}: {
  q: ProcurementRfiQuestion
  facts: Record<string, string>
  contact: ContactPerson | null
  onChanged: () => void
  onFactsSaved: () => void
}) {
  const [text, setText] = useState(q.answer ?? '')
  const [values, setValues] = useState<Record<string, string>>(q.answer_values ?? {})
  const [showContext, setShowContext] = useState(false)
  const [busy, setBusy] = useState<'draft' | 'save' | null>(null)

  useEffect(() => {
    setText(q.answer ?? '')
    setValues(q.answer_values ?? {})
  }, [q.answer, q.answer_values, q.updated_at])

  const approved = q.answer_status === 'godkand'
  const gaps = gapsIn(text)
  const answered = isAnswered({ ...q, answer: text, answer_values: values })
  const anchored = !!q.anchor && (q.anchor.p != null || Object.keys(q.anchor.cells ?? {}).length > 0)

  const persist = async (patch: { answer?: string | null; answer_values?: Record<string, string>; answer_status?: 'utkast' | 'godkand'; answer_source?: ProcurementRfiQuestion['answer_source'] }) => {
    setBusy('save')
    try {
      await ProcurementRfiService.saveAnswer(q.id, patch)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara svaret'))
    } finally {
      setBusy(null)
    }
  }

  /** Ändrat svar sparas och blir utkast igen om det var godkänt */
  const commitText = () => {
    if (text === (q.answer ?? '')) return
    void persist({ answer: text.trim() ? text : null, answer_source: q.answer_source === 'ai' ? 'ai' : 'manuell', answer_status: 'utkast' })
  }

  const commitValues = (next: Record<string, string>) => {
    const changed = JSON.stringify(next) !== JSON.stringify(q.answer_values ?? {})
    if (!changed) return
    void persist({ answer_values: next, answer_source: q.answer_source ?? 'manuell', answer_status: 'utkast' })
    // Företagsuppgifter sparas till nästa gång (inte kontaktpersonen, som följer ansvarig)
    if (q.answer_type === 'foretagsuppgift') {
      const toSave = (q.answer_meta.fields ?? [])
        .filter((f) => !isContactKey(f.key) && (next[f.key] ?? '').trim() && (next[f.key] ?? '').trim() !== (facts[f.key] ?? '').trim())
        .filter((f) => f.key !== 'foretagsnamn' && f.key !== 'organisationsnummer')
        .map((f) => ({ key: f.key, label: f.label, value: next[f.key] }))
      if (toSave.length) {
        ProcurementRfiService.saveFacts(toSave)
          .then(onFactsSaved)
          .catch((e) => toast.error(errMsg(e, 'Kunde inte spara företagsuppgiften')))
      }
    }
  }

  const runDraft = async () => {
    setBusy('draft')
    try {
      const r = await ProcurementRfiService.draft(q.id)
      toast.success(r.gaps > 0 ? `Utkastet är klart, ${r.gaps} luckor att fylla i` : 'Utkastet är klart')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Utkastet kunde inte skapas'))
    } finally {
      setBusy(null)
    }
  }

  const prefill = () => {
    const next = prefillValues(q.answer_meta.fields ?? [], values, facts, contact)
    setValues(next)
    commitValues(next)
  }

  const toggleApproved = () => {
    if (approved) void persist({ answer_status: 'utkast' })
    else {
      if (!answered) {
        toast.error('Fyll i svaret innan det godkänns')
        return
      }
      if (gaps.length > 0) {
        toast.error('Fyll i luckorna [FYLL I: ...] innan svaret godkänns')
        return
      }
      void persist({ answer: q.answer_type === 'fritext' || q.answer_type === 'ja_nej' ? text : q.answer, answer_values: values, answer_status: 'godkand' })
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-200 whitespace-pre-wrap">{q.question}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
            <span>{RFI_ANSWER_TYPE_LABEL[q.answer_type]}</span>
            {!anchored && <span className="text-amber-400/90">Ingen plats i dokumentet, skrivs in för hand</span>}
            {q.context && (
              <button type="button" onClick={() => setShowContext((s) => !s)} aria-expanded={showContext} className="min-h-[32px] hover:text-slate-300">
                {showContext ? 'Dölj sammanhang' : 'Visa sammanhang'}
              </button>
            )}
          </div>
          {showContext && q.context && <p className="mt-1 pl-3 border-l border-slate-700 text-[12px] text-slate-400 whitespace-pre-wrap">{q.context}</p>}
        </div>
      </div>

      <div className="mt-2">
        {q.answer_type === 'fritext' && (
          <textarea
            className={`${inputCls} resize-y leading-relaxed`}
            rows={text ? Math.min(14, Math.max(4, Math.ceil(text.length / 90))) : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            placeholder="Skriv svaret här eller låt AI skriva ett utkast."
            aria-label={`Svar: ${q.question.slice(0, 80)}`}
          />
        )}

        {q.answer_type === 'ja_nej' && (
          <div className="space-y-2">
            <div className="flex items-center gap-5" role="radiogroup" aria-label="Ja eller nej">
              {(['ja', 'nej'] as const).map((c) => (
                <label key={c} className="inline-flex items-center gap-2 min-h-[44px] text-[13px] text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name={`jn-${q.id}`}
                    checked={values.choice === c}
                    onChange={() => {
                      const next = { ...values, choice: c }
                      setValues(next)
                      commitValues(next)
                    }}
                    className="w-4 h-4 accent-[#20c58f]"
                  />
                  {c === 'ja' ? 'Ja' : 'Nej'}
                </label>
              ))}
            </div>
            <textarea
              className={`${inputCls} resize-y leading-relaxed`}
              rows={text ? Math.min(10, Math.max(3, Math.ceil(text.length / 90))) : 2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commitText}
              placeholder="Kommentar, t.ex. vilka certifieringar"
              aria-label="Kommentar till svaret"
            />
          </div>
        )}

        {q.answer_type === 'procent_per_ar' && (
          <div className="flex flex-wrap gap-4">
            {(q.answer_meta.years ?? []).map((y) => (
              <label key={y} className="flex items-center gap-2 text-[12.5px] text-slate-400">
                År {y}
                <span className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`${inputCls} w-24 pr-7 text-right`}
                    value={values[String(y)] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [String(y)]: e.target.value.replace(/[^0-9,.\s]/g, '') }))}
                    onBlur={() => commitValues(values)}
                    aria-label={`Procent år ${y}`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {q.answer_type === 'foretagsuppgift' && (
          <div>
            <dl className="space-y-1.5">
              {(q.answer_meta.fields ?? []).map((f) => (
                <div key={f.key} className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-3 items-center">
                  <dt className="text-[12.5px] text-slate-400">{f.label}</dt>
                  <dd>
                    <input
                      type="text"
                      className={inputCls}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      onBlur={() => commitValues(values)}
                      aria-label={f.label}
                      placeholder={isContactKey(f.key) ? 'Ansvarig för upphandlingen' : 'Ej ifyllt'}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
        {approved ? <StatusDot tone="good">Godkänt</StatusDot> : answered ? <StatusDot tone="warn">Utkast</StatusDot> : <StatusDot tone="muted">Ej besvarad</StatusDot>}
        {gaps.length > 0 && <StatusDot tone="warn">{gaps.length === 1 ? '1 lucka att fylla i' : `${gaps.length} luckor att fylla i`}</StatusDot>}
        {q.answer_source && <span className="text-[11px] text-slate-500">{SOURCE_LABEL[q.answer_source] ?? q.answer_source}</span>}
        {q.answer_source === 'ai' && q.draft_sources.length > 0 && (
          <span className="text-[11px] text-slate-500" title={q.draft_sources.map((s) => s.title).join(', ')}>
            {q.draft_sources.length} källor
          </span>
        )}
        <span className="text-[11px] text-slate-500 tabular-nums">Ändrat {fmtDateTime(q.updated_at)}</span>
        <span className="flex-1" />
        {(q.answer_type === 'fritext' || q.answer_type === 'ja_nej') && !approved && (
          <LinkButton onClick={() => void runDraft()} disabled={!!busy}>
            {busy === 'draft' ? 'Skriver ...' : text.trim() ? 'Skriv nytt utkast' : 'Skriv utkast'}
          </LinkButton>
        )}
        {q.answer_type === 'foretagsuppgift' && !approved && (
          <LinkButton tone="muted" onClick={prefill} disabled={!!busy}>
            Hämta företagsuppgifter
          </LinkButton>
        )}
        <button
          type="button"
          onClick={toggleApproved}
          disabled={!!busy}
          className={`inline-flex items-center gap-1.5 min-h-[44px] px-2 text-[12.5px] font-medium disabled:opacity-40 ${approved ? 'text-slate-400 hover:text-slate-200' : 'text-[#20c58f] hover:text-[#3ddba5]'}`}
        >
          <Icon name={approved ? 'allman.aterstall' : 'allman.bock'} size={16} />
          {approved ? 'Ändra till utkast' : 'Godkänn'}
        </button>
      </div>
    </li>
  )
}
