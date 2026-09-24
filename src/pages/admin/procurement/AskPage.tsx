// src/pages/admin/procurement/AskPage.tsx
// Fråga datan (planens avsnitt 4 verktyg 14 och avsnitt 5): frågor i naturligt
// språk mot upphandlingar, tilldelningar och anbudsgivare. Servern bygger
// kontexten och AI:n svarar bara ur den, med hänvisningar som [U3] som här
// blir länkar till upphandlingen eller köparen.

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, MessageSquareText } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { EmptyState, LinkButton, Section, StatusDot } from '../../../components/admin/procurement/ui'
import { fmtDate } from '../../../components/admin/procurement/uiFormat'
import { procurementPath } from '../../../lib/procurementPortal'
import {
  ProcurementAskService,
  type ProcurementAskHistoryItem,
  type ProcurementAskSource,
} from '../../../services/procurementAskService'

const EXAMPLES = [
  'Vilka kommuner i Stockholms län har avtal som löper ut nästa år?',
  'Hur ofta har Anticimex och Nomor mötts sedan 2022?',
  'Vilka köpare utvärderar på kvalitet?',
  'Var har bara Anticimex och Nomor lämnat anbud senast?',
  'Hur stor andel av tilldelningarna i Uppsala län har Anticimex vunnit?',
]

const MAX_QUESTION_CHARS = 1000
const HISTORY_TURNS = 6

interface Turn {
  id: number
  question: string
  answer?: string
  sources?: ProcurementAskSource[]
  error?: string
}

const REF_GROUP_RE = /\[(U\d+(?:\s*,\s*U\d+)*)\]/g

/** Länk för en källa: upphandlingen om den finns, annars köparen */
function sourceHref(s: ProcurementAskSource): string | null {
  if (s.noticeId) return procurementPath('/' + s.noticeId)
  if (s.buyerId) return procurementPath('/kopare/' + s.buyerId)
  return null
}

/** Text med [U3] och [U3, U4] utbytta mot numrerade länkar */
function withRefs(text: string, sources: ProcurementAskSource[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(REF_GROUP_RE)) {
    const start = m.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    const refs = m[1].split(/\s*,\s*/)
    out.push(
      <sup key={`${keyPrefix}-${i++}`} className="text-[10px] ml-0.5 whitespace-nowrap">
        {refs.map((ref, j) => {
          const idx = sources.findIndex((s) => s.ref === ref)
          if (idx < 0) return null
          const href = sourceHref(sources[idx])
          const label = `${idx + 1}`
          return (
            <Fragment key={ref}>
              {j > 0 && <span className="text-slate-600">,</span>}
              {href ? (
                <Link to={href} title={sources[idx].title} className="text-[#20c58f] hover:underline tabular-nums">
                  {label}
                </Link>
              ) : (
                <span className="text-slate-400 tabular-nums">{label}</span>
              )}
            </Fragment>
          )
        })}
      </sup>
    )
    last = start + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Stycken och punktlistor ("- ") ur svarstexten */
function AnswerText({ text, sources }: { text: string; sources: ProcurementAskSource[] }) {
  const blocks: Array<{ type: 'p' | 'ul'; lines: string[] }> = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      blocks.push({ type: 'p', lines: [] })
      continue
    }
    const bullet = /^[-*•]\s+/.test(line)
    const type = bullet ? 'ul' : 'p'
    const cur = blocks[blocks.length - 1]
    const content = bullet ? line.replace(/^[-*•]\s+/, '') : line
    if (cur && cur.type === type && (type === 'ul' || cur.lines.length > 0)) cur.lines.push(content)
    else blocks.push({ type, lines: [content] })
  }
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-slate-300">
      {blocks
        .filter((b) => b.lines.length > 0)
        .map((b, bi) =>
          b.type === 'ul' ? (
            <ul key={bi} className="space-y-1 pl-4 list-disc marker:text-slate-600">
              {b.lines.map((l, li) => (
                <li key={li}>{withRefs(l, sources, `${bi}-${li}`)}</li>
              ))}
            </ul>
          ) : (
            <p key={bi}>{withRefs(b.lines.join(' '), sources, `${bi}`)}</p>
          )
        )}
    </div>
  )
}

function SourceList({ sources }: { sources: ProcurementAskSource[] }) {
  if (sources.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-slate-800">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Källor</div>
      <ol className="space-y-1">
        {sources.map((s, i) => {
          const href = s.noticeId ? procurementPath('/' + s.noticeId) : null
          return (
            <li key={s.ref} className="flex items-baseline gap-2 text-[12px] tabular-nums min-w-0">
              <span className="w-4 shrink-0 text-right text-slate-500">{i + 1}</span>
              <StatusDot tone={s.kind === 'notice' ? 'info' : 'neutral'} className="shrink-0 w-[84px]">
                {s.kind === 'notice' ? 'Upphandling' : 'Tilldelning'}
              </StatusDot>
              <span className="min-w-0 flex-1 truncate">
                {href ? (
                  <Link to={href} className="text-slate-200 hover:text-[#20c58f] hover:underline">{s.title}</Link>
                ) : (
                  <span className="text-slate-200">{s.title}</span>
                )}
                {s.buyerName && (
                  <>
                    <span className="text-slate-600"> · </span>
                    {s.buyerId ? (
                      <Link to={procurementPath('/kopare/' + s.buyerId)} className="text-slate-400 hover:text-[#20c58f] hover:underline">
                        {s.buyerName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">{s.buyerName}</span>
                    )}
                  </>
                )}
              </span>
              <span className="shrink-0 text-slate-500">{fmtDate(s.date)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function AskPage() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const nextId = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, pending])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || pending) return
    if (question.length > MAX_QUESTION_CHARS) return

    // Tidigare lyckade frågor och svar följer med så att följdfrågor fungerar
    const history: ProcurementAskHistoryItem[] = turns
      .filter((t) => t.answer)
      .slice(-HISTORY_TURNS / 2)
      .flatMap((t) => [
        { role: 'user' as const, text: t.question },
        { role: 'assistant' as const, text: t.answer ?? '' },
      ])

    const id = nextId.current++
    setTurns((prev) => [...prev, { id, question }])
    setInput('')
    setPending(true)
    try {
      const result = await ProcurementAskService.ask(question, history)
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, answer: result.answer, sources: result.sources } : t)))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Frågan kunde inte besvaras'
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, error: message } : t)))
    } finally {
      setPending(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send(input)
    }
  }

  const tooLong = input.length > MAX_QUESTION_CHARS

  return (
    <div className="space-y-6">
      <Section
        title="Fråga datan"
        hint="Ställ frågor i vanlig svenska om annonser, tilldelningar, anbudsgivare och avtal. Svaren bygger bara på portalens data och hänvisar till källorna."
        action={turns.length > 0 ? <LinkButton tone="muted" onClick={() => setTurns([])} disabled={pending}>Rensa samtalet</LinkButton> : undefined}
      >
        {turns.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState
              icon={<MessageSquareText className="w-5 h-5" />}
              title="Inga frågor ännu"
              hint="Börja med en egen fråga eller välj ett exempel nedan."
            />
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Exempel</div>
            <ul className="divide-y divide-slate-800 border-y border-slate-800">
              {EXAMPLES.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => void send(q)}
                    disabled={pending}
                    className="w-full text-left px-1 py-2 text-[13px] text-slate-300 hover:text-[#20c58f] disabled:opacity-50 transition-colors"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {turns.map((t) => (
              <article key={t.id} className="px-4 py-4">
                <div className="text-[13px] font-medium text-slate-100 whitespace-pre-line">{t.question}</div>
                <div className="mt-2">
                  {t.error ? (
                    <StatusDot tone="bad">{t.error}</StatusDot>
                  ) : t.answer != null ? (
                    <>
                      <AnswerText text={t.answer} sources={t.sources ?? []} />
                      <SourceList sources={t.sources ?? []} />
                    </>
                  ) : (
                    <div className="py-4 flex justify-center">
                      <LoadingSpinner text="Söker i upphandlingsdatan" />
                    </div>
                  )}
                </div>
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </Section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
      >
        <label htmlFor="procurement-ask-input" className="sr-only">Din fråga</label>
        <textarea
          id="procurement-ask-input"
          ref={inputRef}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Till exempel: vilka bostadsbolag i Uppsala län har avtal med Nomor?"
          className="w-full resize-y px-2.5 py-2 text-[13px] bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className={`text-[11px] tabular-nums ${tooLong ? 'text-red-400' : 'text-slate-600'}`}>
            {tooLong ? `Högst ${MAX_QUESTION_CHARS} tecken` : 'Enter skickar, Shift+Enter ger ny rad'}
          </span>
          <button
            type="submit"
            disabled={pending || !input.trim() || tooLong}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20c58f] text-[#fff] text-xs font-medium hover:bg-[#1bb07f] disabled:opacity-40 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            Fråga
          </button>
        </div>
      </form>
    </div>
  )
}
