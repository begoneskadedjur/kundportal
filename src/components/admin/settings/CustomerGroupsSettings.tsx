import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowLeft,
  Loader2,
  Users,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Hash,
  AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CustomerGroupService } from '../../../services/customerGroupService'
import { CustomerGroup } from '../../../types/customerGroups'
import { CustomerGroupEditModal } from './CustomerGroupEditModal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

export function CustomerGroupsSettings() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [customerCounts, setCustomerCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const allGroups = await CustomerGroupService.getAllGroups()
      setGroups(allGroups)

      // Hämta kundantal per grupp parallellt
      const counts: Record<string, number> = {}
      await Promise.all(
        allGroups.map(async (g) => {
          counts[g.id] = await CustomerGroupService.getCustomerCountByGroup(g.id)
        })
      )
      setCustomerCounts(counts)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda kundgrupper')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (group: CustomerGroup) => {
    try {
      await CustomerGroupService.updateGroup(group.id, { is_active: !group.is_active })
      toast.success(group.is_active ? 'Kundgrupp inaktiverad' : 'Kundgrupp aktiverad')
      loadData()
    } catch (error) {
      toast.error('Kunde inte ändra status')
    }
  }

  const handleDelete = async (group: CustomerGroup) => {
    const count = customerCounts[group.id] || 0
    if (count > 0) {
      toast.error(`Kan inte ta bort "${group.name}" — ${count} kunder tillhör gruppen`)
      return
    }
    if (!window.confirm(`Vill du ta bort kundgruppen "${group.name}"?`)) return

    try {
      await CustomerGroupService.deleteGroup(group.id)
      toast.success('Kundgrupp borttagen')
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort')
    }
  }

  const handleSave = () => {
    setEditingGroup(null)
    setIsCreateModalOpen(false)
    loadData()
  }

  const activeCount = groups.filter(g => g.is_active).length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Kundgrupper</h1>
            <p className="text-sm text-slate-400">
              Hantera kundgrupper och deras nummerserier. {activeCount} aktiva grupper.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Skapa kundgrupp
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#20c58f]" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga kundgrupper skapade ännu</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Kundgrupp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Serie</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Senaste</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Kunder</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Kapacitet</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {groups.map((group) => {
                  const capacity = group.series_end - group.series_start + 1
                  const used = Math.max(0, group.current_counter - group.series_start + 1)
                  const percent = capacity > 0 ? (used / capacity) * 100 : 0
                  const isNearFull = percent > 90

                  return (
                    <motion.tr
                      key={group.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors ${
                        !group.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Hash className="w-4 h-4 text-[#20c58f]" />
                          <span className="text-sm font-medium text-white">{group.name}</span>
                          {group.is_private_default && (
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/30"
                              title="Privatärenden tilldelas automatiskt nummer från denna grupp"
                            >
                              Privat standard
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-xs text-slate-500 mt-0.5 ml-6">{group.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300 font-mono">
                          {group.series_start}–{group.series_end}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono text-white">{group.current_counter}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-300">{customerCounts[group.id] || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isNearFull ? 'bg-amber-500' : 'bg-[#20c58f]'}`}
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8">{Math.round(percent)}%</span>
                          {isNearFull && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleActive(group)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title={group.is_active ? 'Inaktivera' : 'Aktivera'}
                          >
                            {group.is_active ? <ToggleRight className="w-4 h-4 text-[#20c58f]" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingGroup(group)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Redigera"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(group)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                            title="Ta bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      <CustomerGroupEditModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        onSave={handleSave}
        group={editingGroup}
        existingGroups={groups}
      />

      {/* Create modal */}
      <CustomerGroupEditModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleSave}
        group={null}
        existingGroups={groups}
      />
    </div>
  )
}
