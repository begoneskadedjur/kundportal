// src/components/admin/settings/ArticlesSettings.tsx
// Huvudkomponent för hantering av artiklar i admin

import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowLeft,
  Loader2,
  Package,
  AlertTriangle,
  RefreshCw,
  Search
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ArticleService } from '../../../services/articleService'
import { ArticleGroupService } from '../../../services/articleGroupService'
import {
  ArticleWithGroup,
  ArticleGroup,
  ArticleCategory,
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_CONFIG
} from '../../../types/articles'
import { ArticlesTable } from './ArticlesTable'
import { ArticleGroupFilter } from './ArticleGroupFilter'
import { ArticleEditModal } from './ArticleEditModal'
import { ArticlePriceListNav } from './ArticlePriceListNav'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

type SortField = 'code' | 'name' | 'category' | 'group' | 'default_price' | 'unit' | 'is_active'

export function ArticlesSettings() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState<ArticleWithGroup[]>([])
  const [groups, setGroups] = useState<ArticleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editingArticle, setEditingArticle] = useState<ArticleWithGroup | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory | 'all'>('all')
  const [groupFilter, setGroupFilter] = useState<string | 'all'>('all')

  // Sortering
  const [sortField, setSortField] = useState<SortField | null>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Loading states för actions
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [articlesData, groupsData] = await Promise.all([
        ArticleService.getAllArticlesWithGroups(),
        ArticleGroupService.getActiveGroups()
      ])
      setArticles(articlesData)
      setGroups(groupsData)
    } catch (error) {
      console.error('Fel vid laddning av artiklar:', error)
      toast.error('Kunde inte ladda artiklar')
    } finally {
      setLoading(false)
    }
  }

  // Beräkna antal artiklar per grupp
  const articleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    articles.forEach(article => {
      if (article.group_id) {
        counts[article.group_id] = (counts[article.group_id] || 0) + 1
      }
    })
    return counts
  }, [articles])

  // Filtrera och sortera artiklar
  const filteredArticles = useMemo(() => {
    let result = articles.filter(article => {
      // Sökfilter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        if (
          !article.code.toLowerCase().includes(search) &&
          !article.name.toLowerCase().includes(search) &&
          !(article.description?.toLowerCase().includes(search))
        ) {
          return false
        }
      }

      // Kategorifilter
      if (categoryFilter !== 'all' && article.category !== categoryFilter) {
        return false
      }

      // Gruppfilter
      if (groupFilter !== 'all') {
        if (groupFilter === 'ungrouped') {
          if (article.group_id) return false
        } else {
          if (article.group_id !== groupFilter) return false
        }
      }

      return true
    })

    // Sortering
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: string | number | boolean
        let bVal: string | number | boolean

        switch (sortField) {
          case 'code':
            aVal = a.code
            bVal = b.code
            break
          case 'name':
            aVal = a.name.toLowerCase()
            bVal = b.name.toLowerCase()
            break
          case 'category':
            aVal = a.category
            bVal = b.category
            break
          case 'group':
            aVal = a.group?.name?.toLowerCase() || 'zzz'
            bVal = b.group?.name?.toLowerCase() || 'zzz'
            break
          case 'default_price':
            aVal = a.default_price
            bVal = b.default_price
            break
          case 'unit':
            aVal = a.unit
            bVal = b.unit
            break
          case 'is_active':
            aVal = a.is_active ? 1 : 0
            bVal = b.is_active ? 1 : 0
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [articles, searchTerm, categoryFilter, groupFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setTogglingId(id)
    try {
      await ArticleService.toggleArticleActive(id, isActive)
      toast.success(isActive ? 'Artikel aktiverad' : 'Artikel inaktiverad')
      loadData()
    } catch (error) {
      console.error('Fel vid toggle av status:', error)
      toast.error('Kunde inte ändra status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await ArticleService.deleteArticle(id)
      toast.success('Artikel borttagen')
      loadData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort artikeln')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSave = async () => {
    setEditingArticle(null)
    setIsCreateModalOpen(false)
    loadData()
  }

  // Beräkna statistik
  const stats = useMemo(() => {
    const total = articles.length
    const active = articles.filter(a => a.is_active).length
    const inactive = total - active
    const byCategory: Record<string, number> = {}

    ARTICLE_CATEGORIES.forEach(cat => {
      byCategory[cat] = articles.filter(a => a.category === cat).length
    })

    return { total, active, inactive, byCategory }
  }, [articles])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Bakgrund */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-cyan-500/5" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Artiklar</h1>
                <p className="text-slate-400 text-sm">
                  Hantera artiklar och tjänster som kan faktureras
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <ArticlePriceListNav />
        </div>

        {/* KPI-kort */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-slate-400">Totalt</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
            <p className="text-sm text-slate-400">Aktiva</p>
          </div>
          {ARTICLE_CATEGORIES.slice(0, 2).map(cat => (
            <div key={cat} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <p className="text-2xl font-bold text-white">{stats.byCategory[cat] || 0}</p>
              <p className="text-sm text-slate-400">{cat}</p>
            </div>
          ))}
        </div>

        {/* Gruppfilter */}
        <div className="mb-4">
          <ArticleGroupFilter
            groups={groups}
            selectedGroupId={groupFilter}
            articleCounts={articleCounts}
            totalCount={articles.length}
            onSelectGroup={setGroupFilter}
            onGroupsChanged={loadData}
          />
        </div>

        {/* Filter och åtgärder */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          {/* Sökfält */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sök artikel..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Kategorifilter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ArticleCategory | 'all')}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">Alla kategorier</option>
              {ARTICLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Ny artikel
            </Button>
          </div>
        </div>

        {/* Resultaträknare */}
        <div className="mb-4 text-sm text-slate-400">
          Visar {filteredArticles.length} av {articles.length} artiklar
        </div>

        {/* Tabell */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <ArticlesTable
            articles={filteredArticles}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={setEditingArticle}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            togglingId={togglingId}
            deletingId={deletingId}
          />
        )}

        {/* Info om inaktiva */}
        {stats.inactive > 0 && (
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">
                  {stats.inactive} {stats.inactive === 1 ? 'artikel är inaktiverad' : 'artiklar är inaktiverade'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Inaktiverade artiklar kan inte väljas vid fakturering.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        <AnimatePresence>
          {editingArticle && (
            <ArticleEditModal
              article={editingArticle}
              isOpen={true}
              onClose={() => setEditingArticle(null)}
              onSave={handleSave}
            />
          )}
        </AnimatePresence>

        {/* Create Modal */}
        <AnimatePresence>
          {isCreateModalOpen && (
            <ArticleEditModal
              article={null}
              isOpen={true}
              onClose={() => setIsCreateModalOpen(false)}
              onSave={handleSave}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
