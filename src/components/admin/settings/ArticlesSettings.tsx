// src/components/admin/settings/ArticlesSettings.tsx
// Huvudkomponent för hantering av artiklar i admin

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
import {
  Article,
  ArticleCategory,
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_CONFIG
} from '../../../types/articles'
import { ArticleCard } from './ArticleCard'
import { ArticleEditModal } from './ArticleEditModal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

export function ArticlesSettings() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory | 'all'>('all')

  // Ladda artiklar vid mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await ArticleService.getAllArticles()
      setArticles(data)
    } catch (error) {
      console.error('Fel vid laddning av artiklar:', error)
      toast.error('Kunde inte ladda artiklar')
    } finally {
      setLoading(false)
    }
  }

  // Filtrera artiklar
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
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

      return true
    })
  }, [articles, searchTerm, categoryFilter])

  // Hantera toggle av aktiv-status
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await ArticleService.toggleArticleActive(id, isActive)
      toast.success(isActive ? 'Artikel aktiverad' : 'Artikel inaktiverad')
      loadData()
    } catch (error) {
      console.error('Fel vid toggle av status:', error)
      toast.error('Kunde inte ändra status')
    }
  }

  // Hantera borttagning
  const handleDelete = async (id: string) => {
    try {
      await ArticleService.deleteArticle(id)
      toast.success('Artikel borttagen')
      loadData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort artikeln')
    }
  }

  // Hantera sparande
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
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Artiklar</h1>
              <p className="text-slate-400 text-sm">
                Hantera artiklar och tjänster som kan faktureras
              </p>
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
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
      </div>

      {/* Filter och åtgärder */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Sökfält */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Sök artikel..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Kategorifilter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ArticleCategory | 'all')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">
            {searchTerm || categoryFilter !== 'all'
              ? 'Inga artiklar matchar din sökning'
              : 'Inga artiklar skapade'}
          </p>
          {!searchTerm && categoryFilter === 'all' && (
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Skapa första artikeln
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredArticles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ArticleCard
                  article={article}
                  onEdit={() => setEditingArticle(article)}
                  onToggleActive={(isActive) => handleToggleActive(article.id, isActive)}
                  onDelete={() => handleDelete(article.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
  )
}
