// src/components/shared/ServiceArticleSelector.tsx
// Tvånivå-väljare för Tjänsteutbud: Grupp → Artikel

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ArticleGroupService } from '../../services/articleGroupService'
import { ArticleService } from '../../services/articleService'
import type { Article, ArticleGroup } from '../../types/articles'

interface ServiceArticleSelectorProps {
  groupId: string | null
  articleId: string | null
  onGroupChange: (groupId: string | null) => void
  onArticleChange: (articleId: string | null, article: Article | null) => void
  disabled?: boolean
}

export default function ServiceArticleSelector({
  groupId,
  articleId,
  onGroupChange,
  onArticleChange,
  disabled = false,
}: ServiceArticleSelectorProps) {
  const [groups, setGroups] = useState<ArticleGroup[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hämta grupper vid mount
  useEffect(() => {
    ArticleGroupService.getActiveGroups()
      .then(setGroups)
      .catch(() => setError('Kunde inte hämta tjänstegrupper'))
      .finally(() => setLoadingGroups(false))
  }, [])

  // Om articleId är satt men groupId saknas, försök härleda gruppen
  useEffect(() => {
    if (articleId && !groupId) {
      ArticleGroupService.getArticleGroupIds(articleId).then((ids) => {
        if (ids.length > 0) onGroupChange(ids[0])
      })
    }
  }, [articleId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hämta artiklar när grupp väljs
  useEffect(() => {
    if (!groupId) {
      setArticles([])
      return
    }
    setLoadingArticles(true)
    ArticleService.getActiveArticlesByGroup(groupId)
      .then(setArticles)
      .catch(() => setError('Kunde inte hämta tjänster'))
      .finally(() => setLoadingArticles(false))
  }, [groupId])

  const selectClass =
    'w-full px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

  if (loadingGroups) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-1.5">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Laddar tjänster...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Grupp-väljare */}
      <select
        value={groupId ?? ''}
        onChange={(e) => {
          const val = e.target.value || null
          onGroupChange(val)
          onArticleChange(null, null)
        }}
        disabled={disabled}
        className={selectClass}
      >
        <option value="">Välj tjänstegrupp</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {/* Artikel-väljare */}
      <div className="relative">
        <select
          value={articleId ?? ''}
          onChange={(e) => {
            const val = e.target.value || null
            const found = articles.find((a) => a.id === val) ?? null
            onArticleChange(val, found)
          }}
          disabled={disabled || !groupId || loadingArticles}
          className={selectClass}
        >
          <option value="">
            {!groupId
              ? 'Välj grupp först'
              : loadingArticles
              ? 'Laddar...'
              : 'Välj tjänst'}
          </option>
          {articles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {loadingArticles && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400 pointer-events-none" />
        )}
      </div>
    </div>
  )
}
