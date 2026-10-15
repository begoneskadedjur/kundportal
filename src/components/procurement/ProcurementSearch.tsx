// src/components/procurement/ProcurementSearch.tsx
// Söklådan i upphandlingsportalens topprad (docs/upphandlingsportal-ux-plan.md
// avsnitt 2): en sökning över upphandlingar (titel, köpare eller BGU-nummer),
// köpare och konkurrenter. Öppnas med ikonknappen eller Ctrl+K.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../icons/Icon'
import { ProcurementService } from '../../services/procurementService'
import { noticePath, procurementPath } from '../../lib/procurementPortal'

interface Hit {
  key: string
  icon: IconName
  title: string
  meta: string
  to: string
}

interface Groups {
  notices: Hit[]
  buyers: Hit[]
  suppliers: Hit[]
}

const EMPTY: Groups = { notices: [], buyers: [], suppliers: [] }

export function ProcurementSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<Groups>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setGroups(EMPTY)
    setActive(0)
  }, [])

  // Ctrl+K (Cmd+K) öppnar, Escape stänger
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setGroups(EMPTY)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      const [n, b, s] = await Promise.allSettled([
        ProcurementService.searchNoticesForMove(q),
        ProcurementService.listBuyers(q),
        ProcurementService.searchSuppliers(q, 6),
      ])
      if (cancelled) return
      setGroups({
        notices: (n.status === 'fulfilled' ? n.value : []).slice(0, 8).map((x) => ({
          key: `n:${x.id}`,
          icon: 'upphandling.anbud',
          title: x.title,
          meta: [`BGU-${x.bgu_number}`, x.buyer_name].filter(Boolean).join(' · '),
          to: noticePath(x.id),
        })),
        buyers: (b.status === 'fulfilled' ? b.value : []).slice(0, 6).map((x) => ({
          key: `b:${x.id}`,
          icon: 'upphandling.kopare',
          title: x.name,
          meta: [x.county_name, x.org_number].filter(Boolean).join(' · '),
          to: procurementPath(`/kopare/${x.id}`),
        })),
        suppliers: (s.status === 'fulfilled' ? s.value : []).map((x) => ({
          key: `s:${x.id}`,
          icon: 'upphandling.konkurrent',
          title: x.name,
          meta: x.org_number ?? '',
          to: procurementPath(`/konkurrenter/${x.id}`),
        })),
      })
      setActive(0)
      setLoading(false)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const flat = [...groups.notices, ...groups.buyers, ...groups.suppliers]

  const go = (hit: Hit | undefined) => {
    if (!hit) return
    close()
    navigate(hit.to)
  }

  const sections: Array<{ title: string; hits: Hit[] }> = [
    { title: 'Upphandlingar', hits: groups.notices },
    { title: 'Köpare', hits: groups.buyers },
    { title: 'Konkurrenter', hits: groups.suppliers },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        aria-label="Sök upphandlingar, köpare och konkurrenter"
        title="Sök (Ctrl+K)"
      >
        <Icon name="allman.sok" size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Sök">
          <div className="absolute inset-0 bg-slate-950/70" onClick={close} />
          <div className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 border-b border-slate-800">
              <Icon name="allman.sok" size={20} className="text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActive((a) => Math.min(flat.length - 1, a + 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((a) => Math.max(0, a - 1))
                  } else if (e.key === 'Enter') go(flat[active])
                }}
                placeholder="Sök upphandling, BGU-nummer, köpare eller konkurrent"
                aria-label="Sök"
                className="flex-1 h-14 bg-transparent text-[14px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button type="button" onClick={close} className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-slate-500 hover:text-slate-200" aria-label="Stäng sökningen" title="Stäng">
                <Icon name="allman.stang" size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {query.trim().length < 2 ? (
                <p className="px-4 py-4 text-[13px] text-slate-500">Skriv minst två tecken.</p>
              ) : loading && flat.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-slate-500">Söker ...</p>
              ) : flat.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-slate-500">Inga träffar på "{query.trim()}".</p>
              ) : (
                sections
                  .filter((s) => s.hits.length > 0)
                  .map((s) => (
                    <div key={s.title} className="py-1">
                      <div className="px-4 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">{s.title}</div>
                      <ul>
                        {s.hits.map((h) => {
                          const idx = flat.indexOf(h)
                          return (
                            <li key={h.key}>
                              <button
                                type="button"
                                onMouseEnter={() => setActive(idx)}
                                onClick={() => go(h)}
                                className={`w-full min-h-[44px] flex items-center gap-3 px-4 py-2 text-left transition-colors ${idx === active ? 'bg-slate-800/70' : ''}`}
                              >
                                <Icon name={h.icon} size={16} className="text-slate-500 shrink-0" />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] text-slate-100 truncate">{h.title}</span>
                                  {h.meta && <span className="block text-[12px] text-slate-500 truncate tabular-nums">{h.meta}</span>}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ProcurementSearch
