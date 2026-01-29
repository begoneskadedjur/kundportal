// src/components/admin/settings/ArticlesTable.tsx
// Kompakt tabell för artikelhantering

import { useState } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Package,
  Target,
  Bug,
  Zap,
  Bird
} from 'lucide-react'
import {
  ArticleWithGroup,
  ARTICLE_CATEGORY_CONFIG,
  ARTICLE_UNIT_CONFIG,
  formatArticlePrice
} from '../../../types/articles'

// Mapping av ikonnamn till komponenter
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Target,
  Bug,
  Zap,
  Bird,
  Package
}

type SortField = 'code' | 'name' | 'category' | 'group' | 'default_price' | 'unit' | 'is_active'

interface ArticlesTableProps {
  articles: ArticleWithGroup[]
  sortField: SortField | null
  sortDirection: 'asc' | 'desc'
  onSort: (field: SortField) => void
  onEdit: (article: ArticleWithGroup) => void
  onToggleActive: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
  togglingId: string | null
  deletingId: string | null
}

export function ArticlesTable({
  articles,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onToggleActive,
  onDelete,
  togglingId,
  deletingId
}: ArticlesTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
  }

  const getIconComponent = (iconName: string) => {
    return ICON_MAP[iconName] || Package
  }

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      // Auto-reset efter 3 sekunder
      setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/70 border-b border-slate-700">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('code')}
              >
                <div className="flex items-center gap-1.5">
                  Kod
                  {getSortIcon('code')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center gap-1.5">
                  Namn
                  {getSortIcon('name')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('group')}
              >
                <div className="flex items-center gap-1.5">
                  Grupp
                  {getSortIcon('group')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('category')}
              >
                <div className="flex items-center gap-1.5">
                  Kategori
                  {getSortIcon('category')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('default_price')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Pris
                  {getSortIcon('default_price')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('unit')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Enhet
                  {getSortIcon('unit')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('is_active')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Status
                  {getSortIcon('is_active')}
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Åtgärder
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {articles.map(article => {
              const categoryConfig = ARTICLE_CATEGORY_CONFIG[article.category]
              const unitConfig = ARTICLE_UNIT_CONFIG[article.unit]
              const isToggling = togglingId === article.id
              const isDeleting = deletingId === article.id
              const isConfirmingDelete = confirmDeleteId === article.id

              return (
                <tr
                  key={article.id}
                  className={`hover:bg-slate-800/30 transition-colors ${
                    !article.is_active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Kod */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <code className="text-sm font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                      {article.code}
                    </code>
                  </td>

                  {/* Namn */}
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-white">{article.name}</span>
                      {article.description && (
                        <p className="text-xs text-slate-500 truncate max-w-xs">{article.description}</p>
                      )}
                    </div>
                  </td>

                  {/* Grupp */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {article.group ? (
                      <div
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${article.group.color}20`,
                          color: article.group.color
                        }}
                      >
                        {(() => {
                          const IconComp = getIconComponent(article.group.icon)
                          return <IconComp className="w-3 h-3" />
                        })()}
                        {article.group.name}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>

                  {/* Kategori */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryConfig.bgColor} ${categoryConfig.color}`}>
                      {categoryConfig.label}
                    </span>
                  </td>

                  {/* Pris */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-white">
                      {formatArticlePrice(article.default_price)}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">
                      +{article.vat_rate}%
                    </span>
                  </td>

                  {/* Enhet */}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="text-sm text-slate-400">
                      {unitConfig.shortLabel}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={() => onToggleActive(article.id, !article.is_active)}
                      disabled={isToggling}
                      className={`p-1 rounded transition-colors ${
                        article.is_active
                          ? 'text-emerald-400 hover:bg-emerald-500/20'
                          : 'text-slate-500 hover:bg-slate-700'
                      }`}
                      title={article.is_active ? 'Aktiv - klicka för att inaktivera' : 'Inaktiv - klicka för att aktivera'}
                    >
                      {isToggling ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : article.is_active ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </td>

                  {/* Åtgärder */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(article)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Redigera"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(article.id)}
                        disabled={isDeleting}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isConfirmingDelete
                            ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
                            : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                        }`}
                        title={isConfirmingDelete ? 'Klicka igen för att bekräfta' : 'Ta bort'}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {articles.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga artiklar matchar filtret</p>
        </div>
      )}
    </div>
  )
}
