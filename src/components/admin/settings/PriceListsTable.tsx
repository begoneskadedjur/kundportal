// src/components/admin/settings/PriceListsTable.tsx
// Kompakt tabell för prislistehantering med expanderbara rader

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Star,
  Copy,
  Edit2,
  Trash2,
  Loader2,
  FileText,
  Calendar
} from 'lucide-react'
import { PriceList, Article } from '../../../types/articles'
import { PriceListItemsEditor } from './PriceListItemsEditor'

interface PriceListsTableProps {
  priceLists: PriceList[]
  itemCounts: Record<string, number>
  articles: Article[]
  expandedListId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (priceList: PriceList) => void
  onCopy: (priceList: PriceList) => void
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
  onUpdateItems: () => void
  settingDefaultId: string | null
  deletingId: string | null
}

export function PriceListsTable({
  priceLists,
  itemCounts,
  articles,
  expandedListId,
  onToggleExpand,
  onEdit,
  onCopy,
  onSetDefault,
  onDelete,
  onUpdateItems,
  settingDefaultId,
  deletingId
}: PriceListsTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDeleteClick = (id: string, isDefault: boolean) => {
    if (isDefault) return

    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('sv-SE')
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/70 border-b border-slate-700">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Namn
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                Beskrivning
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Artiklar
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                Giltighet
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Åtgärder
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {priceLists.map(priceList => {
              const isExpanded = expandedListId === priceList.id
              const isSettingDefault = settingDefaultId === priceList.id
              const isDeleting = deletingId === priceList.id
              const isConfirmingDelete = confirmDeleteId === priceList.id
              const count = itemCounts[priceList.id] || 0

              return (
                <>
                  <tr
                    key={priceList.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      !priceList.is_active ? 'opacity-50' : ''
                    } ${isExpanded ? 'bg-slate-800/20' : ''}`}
                  >
                    {/* Expand toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggleExpand(priceList.id)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Namn */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{priceList.name}</span>
                        {priceList.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                            <Star className="w-3 h-3" />
                            Standard
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Beskrivning */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-slate-400 truncate max-w-xs block">
                        {priceList.description || '-'}
                      </span>
                    </td>

                    {/* Artiklar */}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 rounded text-sm text-slate-300">
                        <FileText className="w-3 h-3" />
                        {count}
                      </span>
                    </td>

                    {/* Giltighet */}
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {priceList.valid_from || priceList.valid_to ? (
                        <div className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(priceList.valid_from)} - {formatDate(priceList.valid_to)}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Ingen begränsning</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        priceList.is_active
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {priceList.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>

                    {/* Åtgärder */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Sätt som standard */}
                        {!priceList.is_default && (
                          <button
                            onClick={() => onSetDefault(priceList.id)}
                            disabled={isSettingDefault}
                            className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Sätt som standard"
                          >
                            {isSettingDefault ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Star className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Kopiera */}
                        <button
                          onClick={() => onCopy(priceList)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Kopiera prislista"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Redigera */}
                        <button
                          onClick={() => onEdit(priceList)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Redigera"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Ta bort */}
                        <button
                          onClick={() => handleDeleteClick(priceList.id, priceList.is_default)}
                          disabled={isDeleting || priceList.is_default}
                          className={`p-1.5 rounded-lg transition-colors ${
                            priceList.is_default
                              ? 'text-slate-600 cursor-not-allowed'
                              : isConfirmingDelete
                                ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
                                : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                          }`}
                          title={priceList.is_default ? 'Kan inte ta bort standardprislista' : isConfirmingDelete ? 'Klicka igen för att bekräfta' : 'Ta bort'}
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

                  {/* Expanded row - artikelpriser */}
                  <AnimatePresence>
                    {isExpanded && (
                      <tr key={`${priceList.id}-expanded`}>
                        <td colSpan={7} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-slate-900/50 border-t border-slate-700/50">
                              <PriceListItemsEditor
                                priceListId={priceList.id}
                                articles={articles}
                                onUpdate={onUpdateItems}
                              />
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {priceLists.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga prislistor skapade</p>
        </div>
      )}
    </div>
  )
}
