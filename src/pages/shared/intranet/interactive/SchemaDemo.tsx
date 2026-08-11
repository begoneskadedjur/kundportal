// src/pages/shared/intranet/interactive/SchemaDemo.tsx
// Interaktiv miniversion av koordinatorschemat: växla vy, filtrera
// på tekniker, sök fram ett ärende och flytta ett ärende till ny
// tid/tekniker (klickbaserad simulering av drag & drop).

import { useMemo, useState } from 'react'
import {
  MousePointerClick,
  CheckCircle2,
  Sparkles,
  Search,
  Move,
} from 'lucide-react'

const TECHNICIANS = ['Kim', 'Benny', 'Hans']
const SLOTS = ['Förmiddag', 'Eftermiddag']

interface DemoCase {
  id: string
  title: string
  tech: string
  slot: string
  color: string
}

const START_CASES: DemoCase[] = [
  { id: 'c1', title: 'Getingbo - Villa Ekbacken', tech: 'Kim', slot: 'Förmiddag', color: 'bg-blue-500/20 border-blue-500/40 text-blue-300' },
  { id: 'c2', title: 'Extrabesök - Restaurang Prima', tech: 'Benny', slot: 'Förmiddag', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { id: 'c3', title: 'Etablering - Coop Lagret', tech: 'Hans', slot: 'Eftermiddag', color: 'bg-lime-500/20 border-lime-500/40 text-lime-300' },
  { id: 'c4', title: 'Råttor - BRF Utsikten', tech: 'Kim', slot: 'Eftermiddag', color: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
]

type ViewMode = 'Dag' | 'Vecka' | 'Månad'

export default function SchemaDemo() {
  const [view, setView] = useState<ViewMode>('Dag')
  const [viewedViews, setViewedViews] = useState<Set<ViewMode>>(new Set(['Dag']))
  const [techFilter, setTechFilter] = useState<string | null>(null)
  const [hasFiltered, setHasFiltered] = useState(false)
  const [search, setSearch] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [cases, setCases] = useState<DemoCase[]>(START_CASES)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [hasMoved, setHasMoved] = useState(false)
  const [moveMessage, setMoveMessage] = useState<string | null>(null)

  const changeView = (mode: ViewMode) => {
    setView(mode)
    setViewedViews(prev => new Set(prev).add(mode))
  }

  const applyFilter = (tech: string | null) => {
    setTechFilter(tech)
    if (tech) setHasFiltered(true)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    if (value.trim().length >= 2 && cases.some(c => c.title.toLowerCase().includes(value.toLowerCase()))) {
      setHasSearched(true)
    }
  }

  const matchesSearch = (c: DemoCase) =>
    search.trim().length >= 2 && c.title.toLowerCase().includes(search.toLowerCase())

  const moveTo = (tech: string, slot: string) => {
    if (!movingId) return
    const moving = cases.find(c => c.id === movingId)
    if (!moving) return
    setCases(prev => prev.map(c => (c.id === movingId ? { ...c, tech, slot } : c)))
    setMovingId(null)
    setHasMoved(true)
    setMoveMessage(`${moving.title.split(' - ')[0]} flyttat till ${tech}, ${slot.toLowerCase()} - tid och tekniker sparas direkt.`)
  }

  const visibleTechs = techFilter ? [techFilter] : TECHNICIANS

  const tasks = [
    { label: `Växla mellan vyerna Dag, Vecka och Månad (${viewedViews.size}/3)`, done: viewedViews.size === 3 },
    { label: 'Filtrera schemat på en tekniker', done: hasFiltered },
    { label: 'Sök fram ett ärende (skriv t.ex. råttor)', done: hasSearched },
    { label: 'Flytta ett ärende till ny tid eller tekniker', done: hasMoved },
  ]
  const allDone = tasks.every(t => t.done)

  const casesFor = (tech: string, slot: string) => cases.filter(c => c.tech === tech && c.slot === slot)

  const monthSummary = useMemo(() => {
    const byTech = TECHNICIANS.map(t => ({ tech: t, count: cases.filter(c => c.tech === t).length }))
    return byTech
  }, [cases])

  return (
    <div className="my-6 rounded-xl border border-[#20c58f]/30 overflow-hidden">
      <div className="px-4 py-3 bg-[#20c58f]/10 border-b border-[#20c58f]/20 flex items-center gap-2">
        <MousePointerClick className="w-4 h-4 text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova själv - minischemat</p>
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
        </div>

        {/* Verktygsrad: vy, filter, sök */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700 rounded-lg">
            {(['Dag', 'Vecka', 'Månad'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => changeView(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === mode ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => applyFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                !techFilter ? 'bg-[#20c58f] border-[#20c58f] text-[#fff]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              Alla
            </button>
            {TECHNICIANS.map(tech => (
              <button
                key={tech}
                onClick={() => applyFilter(tech)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  techFilter === tech ? 'bg-[#20c58f] border-[#20c58f] text-[#fff]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {tech}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Sök ärende..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
            />
          </div>
        </div>

        {/* Flyttläge-info */}
        {movingId && (
          <p className="text-xs text-cyan-400 flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5" />
            Flyttläge: klicka på en ledig ruta för att släppa ärendet där. (I riktiga schemat drar du bara kortet dit du vill.)
          </p>
        )}
        {moveMessage && !movingId && (
          <p className="text-xs text-[#20c58f]">{moveMessage}</p>
        )}

        {/* Schemat */}
        {view === 'Månad' ? (
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-xs text-slate-400 mb-2">
              Månadsvyn ger överblicken: hur fullbokad varje tekniker är och var det finns luckor.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {monthSummary.filter(m => !techFilter || m.tech === techFilter).map(m => (
                <div key={m.tech} className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg text-center">
                  <p className="text-sm font-semibold text-white">{m.tech}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.count} ärenden</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: '4px' }}>
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
                    {view === 'Dag' ? 'Idag' : 'Måndag'}
                  </th>
                  {visibleTechs.map(tech => (
                    <th key={tech} className="text-center text-xs font-semibold text-white px-2 pb-1">{tech}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(slot => (
                  <tr key={slot}>
                    <td className="text-[11px] text-slate-500 px-2 whitespace-nowrap align-top pt-2">{slot}</td>
                    {visibleTechs.map(tech => {
                      const slotCases = casesFor(tech, slot)
                      return (
                        <td
                          key={tech}
                          onClick={() => movingId && moveTo(tech, slot)}
                          className={`align-top p-1.5 rounded-lg border min-w-[130px] transition-colors ${
                            movingId
                              ? 'border-[#20c58f]/50 bg-[#20c58f]/5 cursor-pointer hover:bg-[#20c58f]/15'
                              : 'border-slate-700/50 bg-slate-800/20'
                          }`}
                        >
                          <div className="space-y-1 min-h-[40px]">
                            {slotCases.map(c => (
                              <button
                                key={c.id}
                                onClick={e => {
                                  e.stopPropagation()
                                  setMovingId(prev => (prev === c.id ? null : c.id))
                                  setMoveMessage(null)
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] leading-snug transition-all ${c.color} ${
                                  movingId === c.id ? 'ring-2 ring-[#20c58f] opacity-70' : ''
                                } ${matchesSearch(c) ? 'ring-2 ring-amber-400' : ''}`}
                              >
                                {c.title}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 px-1 mt-1">
              {view === 'Dag'
                ? 'Dagvyn: teknikerna som kolumner med sina bokningar - klicka på ett ärende och sedan på en ruta för att flytta det.'
                : 'Veckovyn: samma sak men över hela veckan - perfekt för att jämna ut belastningen mellan dagar.'}
            </p>
          </div>
        )}

        {allDone && (
          <div className="flex items-start gap-3 p-4 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#20c58f] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Snyggt - du behärskar schemat!</p>
              <p className="text-xs text-slate-300 mt-1">
                I riktiga schemat är flytten äkta drag & drop: ta tag i kortet och släpp det på ny tid
                eller tekniker - ändringen sparas direkt, i alla vyer och för alla ärendetyper.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
