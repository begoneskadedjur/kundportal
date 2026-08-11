// src/pages/shared/intranet/IntranetHandbok.tsx
// Handbok: guider med sök och kategorifilter

import { useEffect, useMemo, useState } from 'react'
import { Search, BookOpen, AlertCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRoleBasePath } from '../../../hooks/useRoleBasePath'
import { IntranetService } from '../../../services/intranetService'
import {
  INTRANET_CATEGORY_CONFIG,
  type IntranetCategory,
  type IntranetDocumentWithStatus,
} from '../../../types/intranet'
import { GuideDocCard } from './intranetShared'

export default function IntranetHandbok() {
  const { user } = useAuth()
  const basePath = useRoleBasePath()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guides, setGuides] = useState<IntranetDocumentWithStatus[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState<IntranetCategory | 'all'>('all')

  useEffect(() => {
    if (user?.id) fetchGuides(user.id)
  }, [user?.id])

  const fetchGuides = async (userId: string) => {
    try {
      setLoading(true)
      setError(null)
      const docs = await IntranetService.getDocumentsWithStatus(userId)
      setGuides(docs.filter(d => d.section === 'handbok'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda handboken')
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const present = new Set(guides.map(g => g.category))
    return [...present]
  }, [guides])

  const filtered = useMemo(() => {
    let result = guides
    if (category !== 'all') result = result.filter(g => g.category === category)
    const term = searchTerm.toLowerCase().trim()
    if (term) {
      result = result.filter(g =>
        g.title.toLowerCase().includes(term) ||
        (g.summary || '').toLowerCase().includes(term)
      )
    }
    return result
  }, [guides, category, searchTerm])

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-10 bg-slate-800/30 border border-slate-700 rounded-xl">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm text-slate-400 mb-3">{error}</p>
        <button
          onClick={() => user?.id && fetchGuides(user.id)}
          className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] text-[#fff] rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Försök igen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400 -mt-1">
        Steg-för-steg-guider för hur du arbetar i systemet. Fler guider läggs till löpande.
      </p>

      {/* Sök + kategorifilter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Sök bland guider..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === 'all' ? 'bg-[#20c58f] text-[#fff]' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            Alla
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === cat ? 'bg-[#20c58f] text-[#fff]' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {INTRANET_CATEGORY_CONFIG[cat].label}
            </button>
          ))}
        </div>
      </div>

      {(searchTerm || category !== 'all') && (
        <p className="text-sm text-slate-500">
          Visar {filtered.length} av {guides.length} guider
        </p>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((doc, i) => (
            <GuideDocCard key={doc.id} doc={doc} basePath={basePath} index={i} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center bg-slate-800/30 border border-slate-700 rounded-xl">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {guides.length === 0 ? 'Inga guider publicerade ännu.' : 'Inga guider matchar din sökning.'}
          </p>
          {(searchTerm || category !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setCategory('all') }}
              className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
            >
              Rensa filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
