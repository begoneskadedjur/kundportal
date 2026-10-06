// src/pages/shared/intranet/interactive/sok/SokOvning.tsx
// Övningssökruta för guiden om sökrutan. Samma tolkning och samma
// radbygge som den riktiga söklådan (searchModel.ts), men träffarna kommer
// från påhittad exempeldata och ingenting öppnas eller sparas.
// variant: 'tekniker' (standard) eller 'kontor'.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CheckCircle2, MousePointerClick } from 'lucide-react'
import { SearchGlass, SearchIconTile } from '../../../../../components/shared/search/SearchIcons'
import {
  GROUP_LABELS,
  KIND_LABELS,
  buildGroups,
  commonActions,
  parseQuery,
  type SearchGroup,
  type SearchItem,
  type SearchPortal,
} from '../../../../../components/shared/search/searchModel'
import { EXAMPLE_QUERIES, exampleSearch } from './sokExempel'

const DOT_CLASSES = {
  ok: 'bg-emerald-500',
  info: 'bg-sky-400',
  warn: 'bg-amber-400',
  bad: 'bg-red-400',
  faint: 'bg-slate-500',
} as const

const LOOKUP_KINDS = new Set(['orgnr', 'phone', 'email', 'postal'])

export default function SokOvning({ variant }: { variant?: string }) {
  const kontor = variant === 'kontor'
  const [kontorRole, setKontorRole] = useState<'koordinator' | 'admin'>('koordinator')
  const portal: SearchPortal = kontor ? kontorRole : 'technician'

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [choice, setChoice] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [didCase, setDidCase] = useState(false)
  const [didLookup, setDidLookup] = useState(false)
  const [didArrows, setDidArrows] = useState(false)
  const [didTab, setDidTab] = useState(false)
  const [didArchive, setDidArchive] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseQuery(query), [query])
  const searchable = parsed.term.trim().length >= 2

  const groups: SearchGroup[] = useMemo(() => {
    if (!query.trim()) {
      return [{ key: 'actions', label: GROUP_LABELS.actions, items: commonActions(portal) }]
    }
    return buildGroups(portal, parsed, searchable ? exampleSearch(portal, parsed) : null)
  }, [query, parsed, searchable, portal])

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])

  useEffect(() => {
    setActive(0)
    setChoice(0)
  }, [flat])

  // Uppdragen bockas av när de faktiskt gett träffar
  useEffect(() => {
    const hasHits = groups.some(g => g.key !== 'actions' && g.key !== 'pages')
    if (!hasHits) return
    if (parsed.kind === 'case' || parsed.kind === 'number') {
      if (groups.some(g => g.key === 'exact' && g.items.some(i => i.key.startsWith('case:')))) setDidCase(true)
    }
    if (parsed.kind && LOOKUP_KINDS.has(parsed.kind)) setDidLookup(true)
    if (parsed.includeArchived && groups.some(g => g.key === 'archive')) setDidArchive(true)
  }, [groups, parsed])

  const run = (item: SearchItem, index: number) => {
    const c = item.choices[index] ?? item.choices[0]
    if (!c) return
    setFeedback(`I riktiga sökrutan väljer du nu ${c.label} på ${item.number ? `${item.number} ` : ''}${item.title}.`)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = flat.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (n) { setActive(a => (a + 1) % n); setChoice(0); setDidArrows(true) }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (n) { setActive(a => (a - 1 + n) % n); setChoice(0); setDidArrows(true) }
        break
      case 'Tab': {
        const len = flat[active]?.choices.length ?? 0
        if (len > 1) {
          e.preventDefault()
          setChoice(c => (c + (e.shiftKey ? -1 : 1) + len) % len)
          setDidTab(true)
        }
        break
      }
      case 'Enter':
        e.preventDefault()
        if (flat[active]) run(flat[active], choice)
        break
      case 'Escape':
        e.preventDefault()
        setQuery('')
        setFeedback('Esc stänger den riktiga sökrutan. Här tömmer den bara rutan.')
        break
    }
  }

  const tryQuery = (q: string) => {
    setQuery(q)
    setFeedback(null)
    inputRef.current?.focus()
  }

  const hint = parsed.kind
    ? `tolkas som ${KIND_LABELS[parsed.kind]}${parsed.includeArchived ? ', med arkiv' : ''}`
    : parsed.verb
      ? 'åtgärd'
      : ''

  const noHits = searchable && !groups.some(g => g.key !== 'actions' && g.key !== 'pages')

  const tasks = [
    { label: 'Skriv ett ärendenummer, till exempel 9011', done: didCase },
    { label: 'Sök på org.nr, telefon, e-post eller postnummer', done: didLookup },
    { label: 'Bläddra mellan träffarna med ↑ och ↓', done: didArrows },
    { label: 'Byt snabbval på en rad med Tab', done: didTab },
    { label: 'Ta fram arkivet genom att skriva ordet arkiv', done: didArchive },
  ]
  const allDone = tasks.every(t => t.done)

  let rowIndex = -1

  return (
    <div className="my-6 rounded-xl border border-[#20c58f]/30 overflow-hidden">
      <div className="px-4 py-3 bg-[#20c58f]/10 border-b border-[#20c58f]/20 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-[#20c58f]" />
          <span className="text-sm font-semibold text-white">Prova själv</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <i className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
          Övning, exempeldata. Inget öppnas och inget sparas.
        </span>
      </div>

      <div className="p-4 space-y-4 bg-slate-900/40">
        {/* Uppdrag */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-1.5">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {task.done ? (
                <CheckCircle2 className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0" />
              )}
              <span className={`text-sm ${task.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                {i + 1}. {task.label}
              </span>
            </div>
          ))}
          {allDone && <p className="text-sm text-[#20c58f] pt-1">Klart. Nu kan du sökrutan.</p>}
        </div>

        {/* Roll och förslag */}
        <div className="flex flex-wrap items-center gap-2">
          {kontor && (
            <div className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700 rounded-lg" role="group" aria-label="Visa som">
              {(['koordinator', 'admin'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setKontorRole(r)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    kontorRole === r ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'admin' ? 'Admin' : 'Koordinator'}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-slate-500">Prova:</span>
          {EXAMPLE_QUERIES[kontor ? 'kontor' : 'tekniker'].map(ex => (
            <button
              key={ex.query}
              type="button"
              onClick={() => tryQuery(ex.query)}
              title={ex.note}
              className="text-xs px-2 py-[3px] rounded-md border border-slate-700 text-slate-300 bg-slate-900 hover:border-[#20c58f]/60 hover:text-white transition-colors font-mono"
            >
              {ex.query}
            </button>
          ))}
        </div>

        {/* Övningslådan */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/70">
            <SearchGlass className="w-[18px] h-[18px] text-slate-500 flex-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setFeedback(null) }}
              onKeyDown={onKeyDown}
              placeholder="Sök ärende, kund, org.nr, telefon eller sida"
              className="flex-1 min-w-0 bg-transparent text-base text-white placeholder-slate-500 outline-none"
              aria-label="Övningssökruta"
              autoComplete="off"
              spellCheck={false}
            />
            {hint && <span className="hidden sm:inline font-mono text-[11px] text-[#20c58f] whitespace-nowrap">{hint}</span>}
          </div>
          {hint && <div className="sm:hidden px-4 pt-2 font-mono text-[11px] text-[#20c58f]">{hint}</div>}

          <div className="max-h-[420px] overflow-y-auto px-1.5 pt-1.5 pb-2" role="listbox" aria-label="Övningsträffar">
            {!query.trim() && (
              <p className="px-2.5 pt-2 text-xs text-slate-500">
                Tom ruta: här visas det du öppnat senast och dina vanligaste åtgärder.
              </p>
            )}
            {groups.map(group => (
              <div key={group.key} role="group" aria-label={group.label}>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2.5 pt-2.5 pb-1">
                  {group.label}
                </div>
                {group.items.map(item => {
                  rowIndex++
                  const index = rowIndex
                  const selected = index === active
                  return (
                    <div key={`${group.key}:${item.key}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => { if (active !== index) { setActive(index); setChoice(0) } }}
                        onClick={() => run(item, 0)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          selected ? 'bg-[#20c58f]/10' : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <SearchIconTile name={item.icon} tone={item.tone} />
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className={`text-sm truncate ${item.archived ? 'text-slate-400' : 'text-white'}`}>
                            {item.number && (
                              <span className="font-mono text-[12.5px] text-slate-400 mr-1.5">{item.number}</span>
                            )}
                            {item.title}
                          </span>
                          {(item.status || item.meta) && (
                            <span className="text-xs text-slate-400 truncate">
                              {item.status && (
                                <>
                                  <i className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-[1px] ${DOT_CLASSES[item.status.tone]}`} />
                                  {item.status.text}
                                  {item.meta ? ' · ' : ''}
                                </>
                              )}
                              {item.meta}
                            </span>
                          )}
                        </span>
                        <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">{item.typeLabel}</span>
                      </button>
                      {selected && item.choices.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pl-[52px] pr-2.5 pt-0.5 pb-2">
                          {item.choices.map((c, ci) => (
                            <button
                              key={c.label}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => run(item, ci)}
                              className={`text-xs px-2 py-[3px] rounded-md border transition-colors ${
                                ci === choice
                                  ? 'border-[#20c58f]/70 text-white bg-[#20c58f]/10'
                                  : 'border-slate-700 text-slate-300 bg-slate-900 hover:border-slate-600'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            {noHits && (
              <div className="px-3 py-6 text-sm text-slate-500">
                <p>Inga träffar för "{parsed.term}" i exempeldatan.</p>
                {!parsed.includeArchived && <p className="mt-1 text-xs">Skriv ordet arkiv för att även söka i ClickUp-arkivet.</p>}
              </div>
            )}
            {!searchable && query.trim() && !parsed.verb && (
              <p className="px-3 py-6 text-sm text-slate-500">Skriv minst två tecken.</p>
            )}
          </div>

          <div className="hidden sm:flex flex-wrap gap-4 justify-between px-4 py-2.5 border-t border-slate-700/70 text-xs text-slate-500">
            <span>
              <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-0.5 text-slate-400">↑</kbd>
              <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-1 text-slate-400">↓</kbd>
              välj · <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-1 text-slate-400">Enter</kbd>
              öppna · <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-1 text-slate-400">Tab</kbd>
              fler val
            </span>
            <span>{portal === 'technician' ? 'Dina ärenden och ärenden du delar' : portal === 'admin' ? 'Allt' : 'Alla ärenden'}</span>
          </div>
        </div>

        {feedback && <p className="text-xs text-[#20c58f]">{feedback}</p>}
      </div>
    </div>
  )
}
