// src/components/admin/procurement/workshop/AnswerLibrary.tsx
// Anbudsbiblioteket (planens avsnitt 5b): sparade kvalitetssvar per
// kriterietyp, sökbara på fritext och typ. Används både fristående och i
// anbudsverkstaden, där "Använd igen" kopierar ett svar till valt krav.
// Svaren är utgångspunkter; de anpassas alltid till varje upphandling.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChevronDown, Search } from 'lucide-react'
import Select from '../../../ui/Select'
import Button from '../../../ui/Button'
import {
  CRITERION_TYPES,
  CRITERION_TYPE_LABEL,
  ProcurementAnswerService,
  criterionLabel,
  isCriterionType,
  type AnswerWithNotice,
  type CriterionType,
} from '../../../../services/procurementAnswerService'
import { procurementPath } from '../../../../lib/procurementPortal'
import { EmptyState, LinkButton } from '../ui'
import { fmtDate, fmtNum } from '../uiFormat'
import { Label, inputCls } from '../detail/fields'
import { errMsg, useConfirm } from '../detail/helpers'

const TYPE_OPTIONS = CRITERION_TYPES.map((t) => ({ value: t, label: CRITERION_TYPE_LABEL[t] }))
const FILTER_OPTIONS = [{ value: 'all', label: 'Alla kriterietyper' }, ...TYPE_OPTIONS]

interface Props {
  /** Verkstadsläge: kravet som "Använd igen" kopierar till */
  pickFor?: { requirementId: string; criterionType: string | null }
  /** Anropas när ett svar kopierats till kravet */
  onUsed?: () => void
  /** Rubriken ovanför listan visas bara fristående */
  showHeading?: boolean
}

interface Draft {
  id: string | null
  title: string
  criterion_type: CriterionType
  criterion_text: string
  tags: string
  answer: string
}

const emptyDraft = (type: CriterionType = 'annat'): Draft => ({ id: null, title: '', criterion_type: type, criterion_text: '', tags: '', answer: '' })

export default function AnswerLibrary({ pickFor, onUsed, showHeading = !pickFor }: Props) {
  const [answers, setAnswers] = useState<AnswerWithNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<CriterionType | 'all'>(pickFor && isCriterionType(pickFor.criterionType) ? pickFor.criterionType : 'all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const { confirm, node: confirmNode } = useConfirm()

  // Sökningen går mot databasen en kort stund efter sista tangenttrycket
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAnswers(await ProcurementAnswerService.listAnswers(query, type))
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte hämta anbudsbiblioteket'))
    } finally {
      setLoading(false)
    }
  }, [query, type])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of answers) m.set(a.criterion_type, (m.get(a.criterion_type) ?? 0) + 1)
    return m
  }, [answers])

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const reuse = async (a: AnswerWithNotice) => {
    if (!pickFor) return
    setBusy(a.id)
    try {
      await ProcurementAnswerService.reuseAnswer(a.id, pickFor.requirementId)
      toast.success('Svaret är kopierat till kravet. Anpassa det till upphandlingen.')
      onUsed?.()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte använda svaret'))
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!edit) return
    setBusy('edit')
    try {
      await ProcurementAnswerService.saveAnswer({
        id: edit.id ?? undefined,
        title: edit.title,
        answer: edit.answer,
        criterion_type: edit.criterion_type,
        criterion_text: edit.criterion_text,
        tags: edit.tags.split(','),
      })
      toast.success(edit.id ? 'Svaret är uppdaterat' : 'Svaret är sparat i biblioteket')
      setEdit(null)
      await load()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara svaret'))
    } finally {
      setBusy(null)
    }
  }

  const remove = (a: AnswerWithNotice) =>
    confirm('Ta bort svar', `Ta bort "${a.title.slice(0, 80)}" ur anbudsbiblioteket? Krav som använt svaret behåller sin text.`, async () => {
      try {
        await ProcurementAnswerService.deleteAnswer(a.id)
        await load()
      } catch (e) {
        toast.error(errMsg(e, 'Kunde inte ta bort svaret'))
      }
    })

  const editor = edit && (
    <div className="p-3 border border-slate-800 rounded-xl bg-slate-900/60 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
        <div>
          <Label>Rubrik</Label>
          <input className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="T.ex. Rapportering efter kontrollbesök" aria-label="Rubrik" />
        </div>
        <div>
          <Label>Kriterietyp</Label>
          <Select options={TYPE_OPTIONS} value={edit.criterion_type} onChange={(v) => setEdit({ ...edit, criterion_type: isCriterionType(v) ? v : 'annat' })} />
        </div>
      </div>
      <div>
        <Label>Kriteriet svaret skrevs för (valfritt)</Label>
        <textarea className={`${inputCls} resize-y`} rows={2} value={edit.criterion_text} onChange={(e) => setEdit({ ...edit, criterion_text: e.target.value })} aria-label="Kriterietext" />
      </div>
      <div>
        <Label>Svar</Label>
        <textarea className={`${inputCls} resize-y leading-relaxed`} rows={8} value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} aria-label="Svar" />
      </div>
      <div>
        <Label>Taggar, separerade med komma</Label>
        <input className={inputCls} value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="T.ex. bostadsbolag, kundportal" aria-label="Taggar" />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <Button variant="secondary" size="sm" onClick={() => setEdit(null)} disabled={busy === 'edit'}>
          Avbryt
        </Button>
        <Button variant="primary" size="sm" onClick={() => void save()} loading={busy === 'edit'} disabled={!edit.title.trim() || !edit.answer.trim()}>
          Spara
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      {showHeading && (
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <h2 className="text-xs uppercase tracking-wide text-slate-500">Anbudsbibliotek</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">Sparade kvalitetssvar per kriterietyp. Anpassa alltid svaret till upphandlingen.</p>
          </div>
          {!edit && (
            <LinkButton onClick={() => setEdit(emptyDraft(type === 'all' ? 'annat' : type))}>Nytt svar</LinkButton>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input className={`${inputCls} pl-8`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök i rubrik, kriterium och svar" aria-label="Sök i biblioteket" />
        </div>
        <div className="sm:w-56">
          <Select options={FILTER_OPTIONS} value={type} onChange={(v) => setType(isCriterionType(v) ? v : 'all')} />
        </div>
      </div>

      {editor && !edit?.id && <div className="mb-3">{editor}</div>}

      {loading && answers.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-slate-500">Hämtar biblioteket...</p>
      ) : answers.length === 0 ? (
        <EmptyState
          title={query || type !== 'all' ? 'Inga svar matchar' : 'Biblioteket är tomt'}
          hint={
            query || type !== 'all'
              ? 'Prova en annan sökning eller alla kriterietyper.'
              : 'Svar hamnar här när du väljer Spara i biblioteket på ett kvalitetskrav i anbudsverkstaden.'
          }
        />
      ) : (
        <>
          {type === 'all' && !query && (
            <p className="text-[11px] text-slate-500 mb-2 tabular-nums">
              {fmtNum(answers.length)} svar:{' '}
              {CRITERION_TYPES.filter((t) => counts.get(t))
                .map((t) => `${CRITERION_TYPE_LABEL[t]} ${counts.get(t)}`)
                .join(', ')}
            </p>
          )}
          <ul className="divide-y divide-slate-800 border-y border-slate-800">
            {answers.map((a) => {
              const isOpen = open.has(a.id)
              if (edit?.id === a.id) return <li key={a.id} className="py-3">{editor}</li>
              return (
                <li key={a.id} className="py-2.5">
                  <div className="flex items-start gap-2">
                    <button type="button" onClick={() => toggle(a.id)} className="mt-0.5 p-0.5 text-slate-600 hover:text-slate-300" aria-label={isOpen ? 'Fäll ihop' : 'Visa svaret'} aria-expanded={isOpen}>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button type="button" onClick={() => toggle(a.id)} className="text-left text-[12.5px] text-slate-100 hover:text-white">
                        {a.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />
                          {criterionLabel(a.criterion_type)}
                        </span>
                        <span>Använt {fmtNum(a.use_count)} gånger{a.last_used_at ? `, senast ${fmtDate(a.last_used_at)}` : ''}</span>
                        {a.source_notice && (
                          <Link to={procurementPath('/' + a.source_notice.id)} className="hover:text-slate-300 hover:underline truncate max-w-[280px]">
                            BGU-{a.source_notice.bgu_number} {a.source_notice.title}
                          </Link>
                        )}
                        {a.tags.length > 0 && <span className="text-slate-600">{a.tags.join(', ')}</span>}
                      </div>
                      {!isOpen && <p className="text-[12px] text-slate-400 mt-1 line-clamp-2">{a.answer}</p>}
                      {isOpen && (
                        <div className="mt-2 space-y-2">
                          {a.criterion_text && (
                            <p className="text-[11.5px] text-slate-500">
                              <span className="text-slate-600">Kriterium: </span>
                              {a.criterion_text}
                            </p>
                          )}
                          <p className="text-[12.5px] text-slate-300 whitespace-pre-wrap leading-relaxed">{a.answer}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {pickFor && (
                        <LinkButton onClick={() => void reuse(a)} disabled={busy != null}>
                          {busy === a.id ? 'Kopierar...' : 'Använd igen'}
                        </LinkButton>
                      )}
                      <LinkButton
                        tone="muted"
                        disabled={busy != null}
                        onClick={() =>
                          setEdit({
                            id: a.id,
                            title: a.title,
                            criterion_type: isCriterionType(a.criterion_type) ? a.criterion_type : 'annat',
                            criterion_text: a.criterion_text ?? '',
                            tags: a.tags.join(', '),
                            answer: a.answer,
                          })
                        }
                      >
                        Redigera
                      </LinkButton>
                      <LinkButton tone="danger" disabled={busy != null} onClick={() => remove(a)}>
                        Ta bort
                      </LinkButton>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {confirmNode}
    </div>
  )
}
