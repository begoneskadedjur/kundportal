// ScheduleSearch.tsx — Sökfält för ärenden i schemat
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, User, Building, FileCheck } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface SearchResult {
  id: string
  case_number: string | null
  status: string
  kontaktperson: string | null
  company_name?: string | null
  bestallare?: string | null
  skadedjur: string | null
  adress: any
  personnummer?: string | null
  org_nr?: string | null
  case_type: 'private' | 'business'
}

interface ScheduleSearchProps {
  onSelectCase: (caseId: string, caseType: 'private' | 'business') => void
}

const STATUS_DOT: Record<string, string> = {
  'Öppen': 'bg-sky-500',
  'Bokad': 'bg-amber-500',
  'Offert skickad': 'bg-orange-500',
  'Offert signerad - boka in': 'bg-[#20c58f]',
  'Återbesök 1': 'bg-blue-500',
  'Återbesök 2': 'bg-blue-500',
  'Återbesök 3': 'bg-blue-500',
  'Återbesök 4': 'bg-blue-500',
  'Återbesök 5': 'bg-blue-500',
  'Privatperson - review': 'bg-violet-500',
  'Stängt - slasklogg': 'bg-red-500',
  'Avslutat': 'bg-emerald-600',
}

function formatAddress(adress: any): string {
  if (!adress) return ''
  if (typeof adress === 'string') {
    try { adress = JSON.parse(adress) } catch { return adress }
  }
  if (typeof adress === 'object') {
    const parts = [adress.street, adress.city, adress.zip].filter(Boolean)
    return parts.join(', ')
  }
  return String(adress)
}

export function ScheduleSearch({ onSelectCase }: ScheduleSearchProps) {
  const [query, setQuery] = useState('')
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Stäng vid klick utanför
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const performSearch = useCallback(async (term: string, inclCompleted: boolean) => {
    if (term.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsSearching(true)
    try {
      const pattern = `%${term}%`

      const privateFilter = `kontaktperson.ilike.${pattern},personnummer.ilike.${pattern},telefon_kontaktperson.ilike.${pattern},e_post_kontaktperson.ilike.${pattern},case_number.ilike.${pattern}`
      const businessFilter = `company_name.ilike.${pattern},kontaktperson.ilike.${pattern},bestallare.ilike.${pattern},org_nr.ilike.${pattern},telefon_kontaktperson.ilike.${pattern},e_post_kontaktperson.ilike.${pattern},case_number.ilike.${pattern}`

      let privateQuery = supabase
        .from('private_cases')
        .select('id, case_number, status, kontaktperson, skadedjur, adress, personnummer')
        .or(privateFilter)
        .order('created_at', { ascending: false })
        .limit(10)

      let businessQuery = supabase
        .from('business_cases')
        .select('id, case_number, status, kontaktperson, company_name, bestallare, skadedjur, adress, org_nr')
        .or(businessFilter)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!inclCompleted) {
        privateQuery = privateQuery.not('status', 'in', '("Avslutat","Stängt - slasklogg")')
        businessQuery = businessQuery.not('status', 'in', '("Avslutat","Stängt - slasklogg")')
      }

      const [privateRes, businessRes] = await Promise.all([privateQuery, businessQuery])

      const combined: SearchResult[] = [
        ...(privateRes.data || []).map(r => ({ ...r, case_type: 'private' as const })),
        ...(businessRes.data || []).map(r => ({ ...r, case_type: 'business' as const })),
      ]

      // Sortera: exakt match först, sedan senaste
      combined.sort((a, b) => {
        const aExact = (a.case_number || '').toLowerCase() === term.toLowerCase()
        const bExact = (b.case_number || '').toLowerCase() === term.toLowerCase()
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        return 0
      })

      setResults(combined.slice(0, 10))
      setSelectedIndex(-1)
      setIsOpen(true)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => performSearch(value, includeCompleted), 300)
  }

  const handleToggleCompleted = () => {
    const next = !includeCompleted
    setIncludeCompleted(next)
    if (query.length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      performSearch(query, next)
    }
  }

  const handleSelect = (result: SearchResult) => {
    onSelectCase(result.id, result.case_type)
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const getDisplayName = (r: SearchResult) => {
    if (r.case_type === 'business') return r.company_name || r.bestallare || r.kontaktperson || '—'
    return r.kontaktperson || '—'
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        {/* Sökfält */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setIsOpen(true) }}
            placeholder="Sök ärende..."
            className="w-48 pl-8 pr-7 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f] transition-colors"
          />
          {query && (
            <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Inkl. avslutade */}
        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer whitespace-nowrap select-none">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={handleToggleCompleted}
            className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0 cursor-pointer"
          />
          Inkl. avslutade
        </label>
      </div>

      {/* Dropdown med resultat */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-80 max-h-96 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
          {isSearching ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">Söker...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">Inga ärenden hittades</div>
          ) : (
            <div className="py-1">
              {results.map((r, i) => (
                <button
                  key={`${r.case_type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === selectedIndex ? 'bg-slate-700/60' : 'hover:bg-slate-700/40'
                  }`}
                >
                  {/* Ärendetyp-ikon */}
                  <div className="mt-0.5 shrink-0">
                    {r.case_type === 'business' ? (
                      <Building className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{getDisplayName(r)}</span>
                      {r.case_number && (
                        <span className="text-[10px] text-slate-500 shrink-0">{r.case_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[r.status] || 'bg-slate-500'}`} />
                      <span className="text-[10px] text-slate-400 truncate">{r.status}</span>
                      {r.skadedjur && (
                        <>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className="text-[10px] text-slate-400 truncate">{r.skadedjur}</span>
                        </>
                      )}
                    </div>
                    {formatAddress(r.adress) && (
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{formatAddress(r.adress)}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
