// src/components/shared/search/GlobalSearch.tsx
// Global söklåda (Ctrl+K / Cmd+K) för admin, koordinator och tekniker.
// Monteras en gång per portallayout. Sökningen går via RPC:n
// public.global_search, som själv avgör vad rollen får se.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { SearchGlass, SearchIconTile } from './SearchIcons'
import { OPEN_GLOBAL_SEARCH_EVENT } from './globalSearchEvents'
import {
  GROUP_LABELS,
  KIND_LABELS,
  PORTAL_PREFIX,
  buildGroups,
  commonActions,
  parseQuery,
  pushRecent,
  readRecent,
  recentToItem,
  type DotTone,
  type GlobalSearchResponse,
  type SearchGroup,
  type SearchItem,
  type SearchPortal,
} from './searchModel'

const DEBOUNCE_MS = 200

const DOT_CLASSES: Record<DotTone, string> = {
  ok: 'bg-emerald-500',
  info: 'bg-sky-400',
  warn: 'bg-amber-400',
  bad: 'bg-red-400',
  faint: 'bg-slate-500',
}

const SCOPE_TEXT: Record<SearchPortal, string> = {
  technician: 'Dina ärenden och ärenden du delar',
  koordinator: 'Alla ärenden',
  admin: 'Allt',
}

/** Intranätguiden om sökrutan för portalen */
function guideHref(portal: SearchPortal): string {
  const slug = portal === 'technician' ? 'guide-sokrutan-tekniker' : 'guide-sokrutan-kontor'
  return `${PORTAL_PREFIX[portal]}/intranat/dokument/${slug}`
}

interface GlobalSearchProps {
  portal: SearchPortal
}

export function GlobalSearch({ portal: requestedPortal }: GlobalSearchProps) {
  const { profile, isAdmin, availableViews } = useAuth()
  const navigate = useNavigate()

  // Adminlayouten släpper även in koordinatorer; de söker med koordinatorns omfång
  const canAdmin = isAdmin || availableViews.includes('admin')
  const portal: SearchPortal = requestedPortal === 'admin' && !canAdmin ? 'koordinator' : requestedPortal
  const userId = profile?.user_id || profile?.id

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [data, setData] = useState<GlobalSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)
  const [choice, setChoice] = useState(0)
  const [recent, setRecent] = useState<SearchItem[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const requestSeq = useRef(0)

  const parsed = useMemo(() => parseQuery(query), [query])
  const searchable = parsed.term.trim().length >= 2

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setData(null)
    setFailed(false)
    setLoading(false)
    requestSeq.current++
  }, [])

  // Ctrl+K / Cmd+K och sökknapparna
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(prev => {
          if (prev) {
            requestSeq.current++
            setQuery('')
            setData(null)
          }
          return !prev
        })
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen)
    }
  }, [])

  // Fokus i sökfältet och färsk lista över senast öppnade när lådan öppnas
  useEffect(() => {
    if (!open) return
    setRecent(readRecent(portal, userId).map(recentToItem))
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open, portal, userId])

  // Sökning med debounce; inaktuella svar avbryts och ignoreras
  useEffect(() => {
    if (!open) return
    if (!searchable) {
      requestSeq.current++
      setData(null)
      setLoading(false)
      setFailed(false)
      return
    }
    const seq = ++requestSeq.current
    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const { data: result, error } = await supabase
          .rpc('global_search', {
            p_query: parsed.term,
            p_portal: portal,
            p_include_archived: parsed.includeArchived,
            p_limit: 5,
          })
          .abortSignal(controller.signal)
        if (seq !== requestSeq.current) return
        if (error) throw error
        setData((result as GlobalSearchResponse | null) ?? null)
        setFailed(false)
      } catch (err) {
        if (seq !== requestSeq.current || controller.signal.aborted) return
        console.error('[GlobalSearch] Sökningen misslyckades:', err)
        setFailed(true)
        setData(null)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, searchable, parsed.term, parsed.includeArchived, portal])

  const groups: SearchGroup[] = useMemo(() => {
    if (!query.trim()) {
      const out: SearchGroup[] = []
      if (recent.length) out.push({ key: 'recent', label: GROUP_LABELS.recent, items: recent })
      out.push({ key: 'actions', label: GROUP_LABELS.actions, items: commonActions(portal) })
      return out
    }
    return buildGroups(portal, parsed, searchable ? data : null)
  }, [query, parsed, data, searchable, portal, recent])

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])

  // Ny lista: markera första raden
  useEffect(() => {
    setActive(0)
    setChoice(0)
  }, [flat])

  // Håll markerad rad synlig
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, choice])

  const runChoice = useCallback(
    (item: SearchItem, index: number) => {
      const c = item.choices[index] ?? item.choices[0]
      if (!c) return
      const primaryHref = item.choices[0]?.href
      if (primaryHref) {
        pushRecent(portal, userId, item, primaryHref)
      }
      close()
      if (c.href) navigate(c.href)
      else c.run?.(navigate)
    },
    [portal, userId, close, navigate],
  )

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = flat.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (n) { setActive(a => (a + 1) % n); setChoice(0) }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (n) { setActive(a => (a - 1 + n) % n); setChoice(0) }
        break
      case 'Tab': {
        e.preventDefault()
        const len = flat[active]?.choices.length ?? 0
        if (len > 1) setChoice(c => (c + (e.shiftKey ? -1 : 1) + len) % len)
        break
      }
      case 'Enter':
        e.preventDefault()
        if (flat[active]) runChoice(flat[active], choice)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  const hint = parsed.kind
    ? `tolkas som ${KIND_LABELS[parsed.kind]}${parsed.includeArchived ? ', med arkiv' : ''}`
    : parsed.verb
      ? 'åtgärd'
      : ''

  const noHits = searchable && !loading && !failed && data !== null && !groups.some(g => g.key !== 'actions' && g.key !== 'pages')

  let rowIndex = -1

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="global-search"
          className="fixed inset-0 z-[100] flex items-start justify-center sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={close} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sök i systemet"
            className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[min(680px,80vh)] sm:max-w-2xl sm:mt-[10vh] flex flex-col bg-slate-900 sm:border border-slate-700 sm:rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {/* Sökfältet */}
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-700/70">
              <SearchGlass className="w-[18px] h-[18px] text-slate-500 flex-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Sök ärende, kund, org.nr, telefon eller sida"
                className="flex-1 min-w-0 bg-transparent text-base text-white placeholder-slate-500 outline-none"
                role="combobox"
                aria-expanded="true"
                aria-controls="global-search-list"
                aria-activedescendant={flat[active] ? `gs-row-${active}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              {hint && <span className="hidden sm:inline font-mono text-[11px] text-slate-500 whitespace-nowrap">{hint}</span>}
              <button
                type="button"
                onClick={close}
                className="sm:hidden text-sm text-slate-400 hover:text-white px-2 py-1"
              >
                Stäng
              </button>
              <kbd className="hidden sm:inline font-mono text-[11px] text-slate-500 border border-slate-700 rounded px-1">Esc</kbd>
            </div>
            {hint && <div className="sm:hidden px-4 pt-2 font-mono text-[11px] text-slate-500">{hint}</div>}

            {/* Träffar */}
            <div
              ref={listRef}
              id="global-search-list"
              role="listbox"
              aria-label="Sökträffar"
              className="flex-1 sm:flex-none sm:max-h-[60vh] overflow-y-auto px-1.5 pt-1.5 pb-2"
            >
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
                      <div key={`${group.key}:${item.key}`} data-row-index={index}>
                        <button
                          type="button"
                          id={`gs-row-${index}`}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => { if (active !== index) { setActive(index); setChoice(0) } }}
                          onClick={() => runChoice(item, 0)}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                            selected ? 'bg-[#20c58f]/10' : 'hover:bg-slate-800/60'
                          } ${item.archived ? 'opacity-85' : ''}`}
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
                                onClick={() => runChoice(item, ci)}
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

              {!query.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate(guideHref(portal))
                  }}
                  className="w-full text-left px-2.5 pt-3 pb-1 text-xs text-slate-500 hover:text-[#20c58f] transition-colors"
                >
                  Ny här? Så fungerar sökningen
                </button>
              )}

              {searchable && loading && !data && (
                <p className="px-3 py-6 text-sm text-slate-500">Söker …</p>
              )}
              {failed && (
                <p className="px-3 py-6 text-sm text-red-400">Sökningen misslyckades. Försök igen om en stund.</p>
              )}
              {noHits && (
                <div className="px-3 py-6 text-sm text-slate-500">
                  <p>Inga träffar för "{parsed.term}".</p>
                  {!parsed.includeArchived && portal !== 'technician' && (
                    <p className="mt-1 text-xs">Skriv ordet arkiv för att även söka i ClickUp-arkivet.</p>
                  )}
                </div>
              )}
              {!searchable && query.trim() && !parsed.verb && (
                <p className="px-3 py-6 text-sm text-slate-500">Skriv minst två tecken.</p>
              )}
            </div>

            {/* Fot */}
            <div className="hidden sm:flex flex-wrap gap-4 justify-between px-4 py-2.5 border-t border-slate-700/70 text-xs text-slate-500">
              <span>
                <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-0.5 text-slate-400">↑</kbd>
                <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-1 text-slate-400">↓</kbd>
                välj · <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-1 text-slate-400">Enter</kbd>
                öppna · <kbd className="font-mono text-[11px] border border-slate-700 rounded px-1 mr-1 text-slate-400">Tab</kbd>
                fler val
              </span>
              <span>{SCOPE_TEXT[portal]}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default GlobalSearch
