// src/components/admin/settings/ArticleGroupManager.tsx
// Modal för att hantera artikelgrupper

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Package,
  AlertTriangle,
  Check
} from 'lucide-react'
import { ArticleGroupService } from '../../../services/articleGroupService'
import { ArticleGroup, CreateArticleGroupInput } from '../../../types/articles'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

// Tillgängliga färger
const AVAILABLE_COLORS = [
  { value: '#b45309', label: 'Brun' },
  { value: '#991b1b', label: 'Röd' },
  { value: '#7c3aed', label: 'Lila' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#059669', label: 'Grön' },
  { value: '#2563eb', label: 'Blå' },
  { value: '#6b7280', label: 'Grå' }
]

interface ArticleGroupManagerProps {
  isOpen: boolean
  onClose: () => void
  onGroupsChanged: () => void
}

export function ArticleGroupManager({ isOpen, onClose, onGroupsChanged }: ArticleGroupManagerProps) {
  const [groups, setGroups] = useState<ArticleGroup[]>([])
  const [articleCounts, setArticleCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<ArticleGroup | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Formulärdata
  const [formData, setFormData] = useState<CreateArticleGroupInput>({
    name: '',
    description: '',
    color: '#6b7280'
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setLoading(true)
    try {
      const [groupsData, counts] = await Promise.all([
        ArticleGroupService.getAllGroups(),
        ArticleGroupService.getArticleCountsByGroup()
      ])
      setGroups(groupsData)
      setArticleCounts(counts)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda artikelgrupper')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#6b7280'
    })
    setEditingGroup(null)
    setIsCreating(false)
  }

  const handleStartCreate = () => {
    resetForm()
    setIsCreating(true)
  }

  const handleStartEdit = (group: ArticleGroup) => {
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color
    })
    setEditingGroup(group)
    setIsCreating(false)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Namn är obligatoriskt')
      return
    }

    setSaving(true)
    try {
      if (editingGroup) {
        await ArticleGroupService.updateGroup(editingGroup.id, {
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          color: formData.color
        })
        toast.success('Grupp uppdaterad')
      } else {
        await ArticleGroupService.createGroup({
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          color: formData.color
        })
        toast.success('Grupp skapad')
      }
      resetForm()
      loadData()
      onGroupsChanged()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: ArticleGroup) => {
    const count = articleCounts[group.id] || 0
    if (count > 0) {
      toast.error(`Kan inte ta bort "${group.name}". ${count} artikel${count === 1 ? '' : 'er'} är kopplade.`)
      return
    }

    setDeletingId(group.id)
    try {
      await ArticleGroupService.deleteGroup(group.id)
      toast.success('Grupp borttagen')
      loadData()
      onGroupsChanged()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Hantera artikelgrupper</h2>
                <p className="text-sm text-slate-400">Lägg till, redigera eller ta bort grupper</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Formulär för ny/redigera */}
                {(isCreating || editingGroup) && (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 space-y-4">
                    <h3 className="font-medium text-white">
                      {editingGroup ? 'Redigera grupp' : 'Ny grupp'}
                    </h3>

                    {/* Namn */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Namn *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="T.ex. Råttor, Krypande insekter..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    {/* Beskrivning */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Beskrivning
                      </label>
                      <input
                        type="text"
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Valfri beskrivning..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    {/* Färg */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Färg
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_COLORS.map(color => (
                          <button
                            key={color.value}
                            onClick={() => setFormData({ ...formData, color: color.value })}
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                              formData.color === color.value
                                ? 'border-white scale-110'
                                : 'border-transparent hover:border-slate-500'
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Förhandsgranskning */}
                    <div className="pt-2 border-t border-slate-700">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Förhandsgranskning
                      </label>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
                        style={{ backgroundColor: `${formData.color}20`, color: formData.color }}>
                        {formData.name || 'Gruppnamn'}
                      </div>
                    </div>

                    {/* Knappar */}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={resetForm}
                      >
                        Avbryt
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || !formData.name.trim()}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {editingGroup ? 'Spara ändringar' : 'Skapa grupp'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lista över grupper */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">Befintliga grupper ({groups.length})</h3>
                    {!isCreating && !editingGroup && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStartCreate}
                      >
                        <Plus className="w-4 h-4" />
                        Ny grupp
                      </Button>
                    )}
                  </div>

                  {groups.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Inga artikelgrupper skapade</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groups.map(group => {
                        const count = articleCounts[group.id] || 0

                        return (
                          <div
                            key={group.id}
                            className={`flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border transition-colors ${
                              editingGroup?.id === group.id
                                ? 'border-cyan-500'
                                : 'border-slate-700/50 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-8 rounded-full"
                                style={{ backgroundColor: group.color }}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">{group.name}</span>
                                  <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                                    {count} artikel{count === 1 ? '' : 'er'}
                                  </span>
                                </div>
                                {group.description && (
                                  <p className="text-sm text-slate-400">{group.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(group)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                title="Redigera"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(group)}
                                disabled={deletingId === group.id || count > 0}
                                className={`p-2 rounded-lg transition-colors ${
                                  count > 0
                                    ? 'text-slate-600 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                                }`}
                                title={count > 0 ? `Kan inte ta bort - ${count} artiklar kopplade` : 'Ta bort'}
                              >
                                {deletingId === group.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-400">
                      Grupper med kopplade artiklar kan inte tas bort.
                      Flytta artiklarna till en annan grupp först.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
