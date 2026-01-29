// src/components/admin/settings/ArticleCard.tsx
// Kortkomponent för enskild artikel

import { useState } from 'react'
import {
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle
} from 'lucide-react'
import {
  Article,
  ARTICLE_CATEGORY_CONFIG,
  ARTICLE_UNIT_CONFIG,
  formatArticlePrice
} from '../../../types/articles'

interface ArticleCardProps {
  article: Article
  onEdit: () => void
  onToggleActive: (isActive: boolean) => void
  onDelete: () => void
}

export function ArticleCard({
  article,
  onEdit,
  onToggleActive,
  onDelete
}: ArticleCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const categoryConfig = ARTICLE_CATEGORY_CONFIG[article.category]
  const unitConfig = ARTICLE_UNIT_CONFIG[article.unit]

  return (
    <div
      className={`bg-slate-800/50 rounded-xl border p-4 transition-all ${
        article.is_active
          ? 'border-slate-700/50 hover:border-slate-600'
          : 'border-slate-700/30 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Vänster: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {/* Artikelkod */}
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-mono text-slate-300">
              {article.code}
            </span>

            {/* Kategori-badge */}
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${categoryConfig.bgColor} ${categoryConfig.color}`}
            >
              {categoryConfig.label}
            </span>

            {/* Inaktiv-badge */}
            {!article.is_active && (
              <span className="px-2 py-0.5 bg-slate-600 rounded text-xs text-slate-400">
                Inaktiv
              </span>
            )}
          </div>

          {/* Namn */}
          <h3 className="text-white font-medium text-lg mb-1">{article.name}</h3>

          {/* Beskrivning */}
          {article.description && (
            <p className="text-slate-400 text-sm mb-2 line-clamp-2">
              {article.description}
            </p>
          )}

          {/* Pris och enhet */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white font-semibold">
              {formatArticlePrice(article.default_price)}
            </span>
            <span className="text-slate-500">
              per {unitConfig.label.toLowerCase()}
            </span>
            <span className="text-slate-500">
              ({article.vat_rate}% moms)
            </span>
          </div>
        </div>

        {/* Höger: Åtgärder */}
        <div className="flex items-center gap-2">
          {/* Toggle aktiv */}
          <button
            onClick={() => onToggleActive(!article.is_active)}
            className={`p-2 rounded-lg transition-colors ${
              article.is_active
                ? 'text-emerald-400 hover:bg-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-700'
            }`}
            title={article.is_active ? 'Inaktivera' : 'Aktivera'}
          >
            {article.is_active ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>

          {/* Redigera */}
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Redigera"
          >
            <Edit2 className="w-5 h-5" />
          </button>

          {/* Ta bort */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1 bg-red-500/20 rounded-lg p-1">
              <button
                onClick={() => {
                  onDelete()
                  setShowDeleteConfirm(false)
                }}
                className="px-2 py-1 text-red-400 hover:text-white hover:bg-red-500 rounded text-xs font-medium transition-colors"
              >
                Bekräfta
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded text-xs transition-colors"
              >
                Avbryt
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Ta bort"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
