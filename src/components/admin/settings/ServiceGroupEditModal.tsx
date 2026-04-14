// src/components/admin/settings/ServiceGroupEditModal.tsx

import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { ServiceGroupService } from '../../../services/servicesCatalogService'
import type { ServiceGroup, CreateServiceGroupInput, UpdateServiceGroupInput } from '../../../types/services'

const COLORS = [
  '#60a5fa', '#f97316', '#a78bfa', '#facc15',
  '#34d399', '#94a3b8', '#f472b6', '#fb923c',
]

interface ServiceGroupEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  group: ServiceGroup | null   // null = skapa ny
}

export default function ServiceGroupEditModal({ isOpen, onClose, onSaved, group }: ServiceGroupEditModalProps) {
  const isCreating = group === null
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (group) {
      setName(group.name)
      setDescription(group.description || '')
      setColor(group.color)
      setSortOrder(group.sort_order)
      setIsActive(group.is_active)
    } else {
      setName(''); setDescription(''); setColor(COLORS[0]); setSortOrder(0); setIsActive(true)
    }
  }, [isOpen, group])

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Namn är obligatoriskt'); return }
    setSaving(true)
    try {
      if (isCreating) {
        const input: CreateServiceGroupInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          sort_order: sortOrder,
        }
        await ServiceGroupService.createGroup(input)
        toast.success('Grupp skapad')
      } else {
        const input: UpdateServiceGroupInput = {
          name: name.trim(),
          description: description.trim() || null,
          color,
          sort_order: sortOrder,
          is_active: isActive,
        }
        await ServiceGroupService.updateGroup(group!.id, input)
        toast.success('Grupp uppdaterad')
      }
      onSaved(); onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!group) return
    setDeleting(true)
    try {
      await ServiceGroupService.deleteGroup(group.id)
      toast.success('Grupp borttagen')
      onSaved(); onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const inputClass = 'w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="text-base font-semibold text-white">
                {isCreating ? 'Ny tjänstegrupp' : 'Redigera grupp'}
              </h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Namn *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Fågel" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Färg</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Sorteringsordning</label>
                  <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className={inputClass} />
                </div>
                {!isCreating && (
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">Aktiv</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/50">
              {!isCreating ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ta bort grupp
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
                <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isCreating ? 'Skapa' : 'Spara'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
