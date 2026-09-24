// src/components/admin/procurement/workshop/QualityAnswers.tsx
// Anbudsverkstad e) Kvalitetssvar (planens avsnitt 5 Anbudsstöd och 5b).
// För varje krav av typen Kvalitet: AI-utkast ur BeGones eget material och
// anbudsbiblioteket, redigering, spara, spara i biblioteket och hämta ett
// tidigare svar ur biblioteket. Utkasten är aldrig färdig text; luckor står
// som [KOMPLETTERA: ...] och fylls i av en människa.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'
import Modal from '../../../ui/Modal'
import Select from '../../../ui/Select'
import Button from '../../../ui/Button'
import ConfirmModal from '../../../ui/ConfirmModal'
import type { NoticeWithRelations } from '../../../../services/procurementService'
import {
  CRITERION_TYPES,
  CRITERION_TYPE_LABEL,
  ProcurementAnswerService,
  isCriterionType,
  type CriterionType,
  type DraftSource,
  type RequirementWithDraft,
} from '../../../../services/procurementAnswerService'
import type { ProcurementRequirement } from '../../../../types/procurement'
import { EmptyState, LinkButton, StatusDot } from '../ui'
import { fmtDateTime, fmtNum } from '../uiFormat'
import { Label, SubHeading, inputCls, selectCls } from '../detail/fields'
import { errMsg } from '../detail/helpers'
import AnswerLibrary from './AnswerLibrary'

const GAP_RE = /\[KOMPLETTERA:\s*([^\]]*)\]/g
const TYPE_OPTIONS = CRITERION_TYPES.map((t) => ({ value: t, label: CRITERION_TYPE_LABEL[t] }))

function gapsOf(text: string): string[] {
  return [...text.matchAll(GAP_RE)].map((m) => m[1].trim()).filter(Boolean)
}

interface Props {
  notice: NoticeWithRelations
  requirements: ProcurementRequirement[]
  onChanged: () => void
}

export default function QualityAnswers({ notice, requirements, onChanged }: Props) {
  const quality = useMemo(() => (requirements as RequirementWithDraft[]).filter((r) => r.req_type === 'kvalitet'), [requirements])
  const [libraryFor, setLibraryFor] = useState<RequirementWithDraft | null>(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const withDraft = quality.filter((r) => (r.draft_answer ?? '').trim()).length

  return (
    <div>
      <SubHeading action={<LinkButton tone="muted" onClick={() => setBrowseOpen(true)}>Anbudsbibliotek</LinkButton>}>
        Kvalitetssvar, {withDraft} av {quality.length} med utkast
      </SubHeading>
      <p className="flex items-start gap-1.5 text-[11.5px] text-slate-500 mb-3">
        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-px text-amber-400/80" />
        Utkasten bygger bara på BeGones eget material och sparade svar i biblioteket. Luckor står som [KOMPLETTERA: ...] och fylls i av en människa innan svaret lämnas.
      </p>

      {quality.length === 0 ? (
        <EmptyState title="Inga kvalitetskriterier i kravlistan" hint="Sätt typen Kvalitet på ett krav i kravlistan så kan AI skriva ett utkast till svar." />
      ) : (
        <ul className="divide-y divide-slate-800 border-y border-slate-800 -mx-4">
          {quality.map((r) => (
            <QualityItem key={r.id} requirement={r} notice={notice} onChanged={onChanged} onOpenLibrary={() => setLibraryFor(r)} />
          ))}
        </ul>
      )}

      <Modal isOpen={!!libraryFor} onClose={() => setLibraryFor(null)} title="Hämta ur anbudsbiblioteket" subtitle={libraryFor ? libraryFor.text.slice(0, 120) : undefined} size="xl">
        <div className="p-4">
          {libraryFor && (
            <AnswerLibrary
              pickFor={{ requirementId: libraryFor.id, criterionType: libraryFor.criterion_type }}
              onUsed={() => {
                setLibraryFor(null)
                onChanged()
              }}
            />
          )}
        </div>
      </Modal>

      <Modal isOpen={browseOpen} onClose={() => setBrowseOpen(false)} title="Anbudsbibliotek" size="xl">
        <div className="p-4">{browseOpen && <AnswerLibrary showHeading={false} />}</div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------

function QualityItem({
  requirement: r,
  notice,
  onChanged,
  onOpenLibrary,
}: {
  requirement: RequirementWithDraft
  notice: NoticeWithRelations
  onChanged: () => void
  onOpenLibrary: () => void
}) {
  const [text, setText] = useState(r.draft_answer ?? '')
  const [busy, setBusy] = useState<'draft' | 'save' | 'library' | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  // Nytt utkast eller svar ur biblioteket ersätter texten i fältet
  useEffect(() => {
    setText(r.draft_answer ?? '')
  }, [r.draft_answer, r.draft_updated_at])

  const dirty = text !== (r.draft_answer ?? '')
  const gaps = gapsOf(text)
  const sources: DraftSource[] = Array.isArray(r.draft_sources) ? r.draft_sources : []
  const hasDraft = text.trim().length > 0

  const runDraft = async () => {
    setConfirmOpen(false)
    setBusy('draft')
    try {
      const res = await ProcurementAnswerService.draftAnswer(r.id)
      toast.success(res.gaps > 0 ? `Utkastet är klart, ${res.gaps} luckor att komplettera` : 'Utkastet är klart')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Utkastet kunde inte skapas'))
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    try {
      await ProcurementAnswerService.saveDraft(r.id, text)
      toast.success('Utkastet är sparat')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara utkastet'))
    } finally {
      setBusy(null)
    }
  }

  const setType = async (v: string) => {
    try {
      await ProcurementAnswerService.setCriterionType(r.id, isCriterionType(v) ? v : null)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara kriterietypen'))
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Texten är kopierad')
    } catch {
      toast.error('Kunde inte kopiera texten')
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-slate-200 whitespace-pre-wrap">{r.text}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {[r.weight != null ? `Vikt ${fmtNum(r.weight, 1)}` : null, r.page ? `Sida ${r.page}` : null].filter(Boolean).join(', ') || 'Vikt och sida saknas'}
          </p>
        </div>
        <select className={`${selectCls} sm:w-52 shrink-0`} value={r.criterion_type ?? ''} onChange={(e) => void setType(e.target.value)} aria-label="Kriterietyp">
          <option value="">Kriterietyp ej satt</option>
          {CRITERION_TYPES.map((t) => (
            <option key={t} value={t}>{CRITERION_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
        {!hasDraft ? (
          <StatusDot tone="muted">Inget utkast</StatusDot>
        ) : gaps.length > 0 ? (
          <StatusDot tone="warn">Utkast, {gaps.length} {gaps.length === 1 ? 'lucka' : 'luckor'} att komplettera</StatusDot>
        ) : (
          <StatusDot tone="good">Utkast utan markerade luckor</StatusDot>
        )}
        {dirty && <StatusDot tone="warn">Ändrat, inte sparat</StatusDot>}
        {r.answer_id && <StatusDot tone="info">Kopplat till biblioteket</StatusDot>}
        {r.draft_updated_at && <span className="text-[11px] text-slate-500 tabular-nums">Senast ändrat {fmtDateTime(r.draft_updated_at)}</span>}
      </div>

      <textarea
        className={`${inputCls} resize-y leading-relaxed mt-2 font-normal`}
        rows={hasDraft ? 10 : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Skriv svaret här, låt AI skriva ett utkast eller hämta ett tidigare svar ur biblioteket."
        aria-label="Kvalitetssvar"
        disabled={busy === 'draft'}
      />

      {gaps.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-1">Att komplettera</p>
          <ul className="space-y-0.5">
            {gaps.map((g, i) => (
              <li key={`${i}-${g}`} className="flex items-start gap-1.5 text-[12px] text-amber-400/90">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          <span className="text-slate-600">Bygger på: </span>
          {sources.map((s, i) => (
            <span key={s.id} title={s.source ?? undefined}>
              {i > 0 && ', '}
              {s.kind === 'svar' ? `tidigare svar "${s.title}"` : s.title}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2.5">
        <LinkButton onClick={() => (hasDraft ? setConfirmOpen(true) : void runDraft())} disabled={busy != null}>
          {busy === 'draft' ? 'Skriver utkast...' : hasDraft ? 'Skriv nytt utkast' : 'Skriv utkast'}
        </LinkButton>
        <LinkButton tone="muted" onClick={onOpenLibrary} disabled={busy != null}>
          Hämta ur biblioteket
        </LinkButton>
        <span className="flex-1" />
        {hasDraft && (
          <LinkButton tone="muted" onClick={() => void copy()} disabled={busy != null}>
            Kopiera
          </LinkButton>
        )}
        <LinkButton tone={dirty ? 'accent' : 'muted'} onClick={() => void save()} disabled={busy != null || !dirty}>
          {busy === 'save' ? 'Sparar...' : 'Spara'}
        </LinkButton>
        <LinkButton tone="muted" onClick={() => setSaveOpen(true)} disabled={busy != null || !hasDraft} title={gaps.length > 0 ? 'Svaret har luckor. Komplettera helst innan det sparas i biblioteket.' : undefined}>
          Spara i biblioteket
        </LinkButton>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void runDraft()}
        title="Skriv nytt utkast"
        message="Det nya utkastet ersätter texten i fältet, även ändringar som inte sparats. Spara den nuvarande texten i biblioteket först om den ska finnas kvar."
        variant="warning"
        confirmLabel="Skriv nytt utkast"
      />

      {saveOpen && (
        <SaveToLibraryModal
          requirement={r}
          notice={notice}
          text={text}
          dirty={dirty}
          gaps={gaps.length}
          onClose={() => setSaveOpen(false)}
          onSaved={() => {
            setSaveOpen(false)
            onChanged()
          }}
        />
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------

function SaveToLibraryModal({
  requirement: r,
  notice,
  text,
  dirty,
  gaps,
  onClose,
  onSaved,
}: {
  requirement: RequirementWithDraft
  notice: NoticeWithRelations
  text: string
  dirty: boolean
  gaps: number
  onClose: () => void
  onSaved: () => void
}) {
  const initialType: CriterionType = isCriterionType(r.criterion_type) ? r.criterion_type : 'annat'
  const [title, setTitle] = useState(`${CRITERION_TYPE_LABEL[initialType]}: ${notice.buyer_name ?? notice.title}`.slice(0, 120))
  const [type, setType] = useState<CriterionType>(initialType)
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      // Kravets utkast sparas först så att kravet och biblioteket har samma text
      if (dirty) await ProcurementAnswerService.saveDraft(r.id, text)
      await ProcurementAnswerService.saveAnswer({
        title,
        answer: text,
        criterion_type: type,
        criterion_text: r.text,
        tags: tags.split(','),
        source_notice_id: notice.id,
        source_requirement_id: r.id,
      })
      toast.success('Svaret är sparat i anbudsbiblioteket')
      onSaved()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara i biblioteket'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Spara i anbudsbiblioteket"
      size="md"
      preventClose={busy}
      footer={
        <div className="flex justify-end gap-2 px-4 py-2.5">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()} loading={busy} disabled={!title.trim() || !text.trim()}>
            Spara i biblioteket
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        {gaps > 0 && (
          <p className="text-[12px] text-amber-400">
            Svaret har {gaps} {gaps === 1 ? 'lucka' : 'luckor'} markerade [KOMPLETTERA: ...]. Biblioteket blir bättre om luckorna fylls i först.
          </p>
        )}
        <div>
          <Label>Rubrik</Label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Rubrik" />
        </div>
        <div>
          <Label>Kriterietyp</Label>
          <Select options={TYPE_OPTIONS} value={type} onChange={(v) => setType(isCriterionType(v) ? v : 'annat')} />
        </div>
        <div>
          <Label>Taggar, separerade med komma</Label>
          <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="T.ex. bostadsbolag, kommun" aria-label="Taggar" />
        </div>
        <p className="text-[11.5px] text-slate-500">Kriterietexten och upphandlingen sparas med svaret så att det går att se vad det skrevs för.</p>
      </div>
    </Modal>
  )
}
