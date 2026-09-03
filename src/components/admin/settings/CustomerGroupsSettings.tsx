import { useState, useEffect, useCallback } from 'react'
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
  RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CustomerGroupService } from '../../../services/customerGroupService'
import { CustomerGroup } from '../../../types/customerGroups'
import {
  FortnoxMirrorService,
  type CustomerGroupFortnoxStats,
  type FortnoxMirrorState,
} from '../../../services/fortnoxMirrorService'
import { formatSwedishDateTime } from '../../../types/database'
import { CustomerGroupEditModal } from './CustomerGroupEditModal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

// Kundgruppssidan speglar Fortnox (docs/kundnummer-fortnox-plan.md, fas 1):
// "Senaste" = högsta använda kundnummer i Fortnox inom gruppens intervall,
// hämtat ur spegeln fortnox_customer_numbers. Spegeln hålls färsk av
// Fortnox-webhooken, en inkrementell synk när sidan öppnas med gammal
// vattenstämpel, och en nattlig full synk. Portalens egen räknare
// (current_counter) används bara av Oneflow-avtalskunder och visas nedtonad.
export function CustomerGroupsSettings() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [customerCounts, setCustomerCounts] = useState<Record<string, number>>({})
  const [fortnoxStats, setFortnoxStats] = useState<Record<string, CustomerGroupFortnoxStats>>({})
  const [mirrorState, setMirrorState] = useState<FortnoxMirrorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const loadFortnox = useCallback(async () => {
    try {
      const [stats, state] = await Promise.all([
        FortnoxMirrorService.getGroupStats(),
        FortnoxMirrorService.getState(),
      ])
      setFortnoxStats(stats)
      setMirrorState(state)
      return state
    } catch (error) {
      console.error('Fel vid läsning av Fortnox-spegeln:', error)
      return null
    }
  }, [])

  const runSync = useCallback(async (mode: 'incremental' | 'full', silent: boolean) => {
    setSyncing(true)
    try {
      const result = await FortnoxMirrorService.sync(mode)
      await loadFortnox()
      if (!silent) {
        toast.success(
          mode === 'full'
            ? `Fortnox-spegeln uppdaterad: ${result.active} aktiva, ${result.inactive} inaktiva, ${result.missing} raderade`
            : `Fortnox-spegeln uppdaterad (${result.upserted} ändrade kunder)`
        )
      }
    } catch (error) {
      console.error('Fortnox-synk misslyckades:', error)
      if (!silent) toast.error(error instanceof Error ? error.message : 'Kunde inte synka mot Fortnox')
    } finally {
      setSyncing(false)
    }
  }, [loadFortnox])

  const loadData = useCallback(async () => {
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

      // Fortnox-spegeln: synka tyst om vattenstämpeln är äldre än 10 min
      const state = await loadFortnox()
      if (FortnoxMirrorService.isStale(state)) {
        void runSync(state?.watermark ? 'incremental' : 'full', true)
      }
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda kundgrupper')
    } finally {
      setLoading(false)
    }
  }, [loadFortnox, runSync])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleActive = async (group: CustomerGroup) => {
    try {
      await CustomerGroupService.updateGroup(group.id, { is_active: !group.is_active })
      toast.success(group.is_active ? 'Kundgrupp inaktiverad' : 'Kundgrupp aktiverad')
      loadData()
    } catch {
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
  const synced = mirrorState?.watermark ? formatSwedishDateTime(mirrorState.watermark) : null
  const fortnoxTotal = (mirrorState?.total_active ?? 0) + (mirrorState?.total_inactive ?? 0)

  return (
    <div className="max-w-5xl mx-auto">
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
              Nummerserier speglade från Fortnox. {activeCount} aktiva grupper.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {syncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#20c58f]" />
                <span>Synkar mot Fortnox...</span>
              </>
            ) : synced ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />
                <span>
                  Fortnox synkad {synced}
                  {fortnoxTotal > 0 && (
                    <span className="text-slate-500"> · {mirrorState?.total_active ?? 0} aktiva, {mirrorState?.total_inactive ?? 0} inaktiva kunder</span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Fortnox-spegeln är inte synkad ännu</span>
              </>
            )}
            {mirrorState?.last_error && !syncing && (
              <span className="text-amber-400" title={mirrorState.last_error}>· senaste synk misslyckades</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => runSync('incremental', false)} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              Uppdatera nu
            </Button>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Skapa kundgrupp
            </Button>
          </div>
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
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider" title="Högsta använda kundnummer i Fortnox inom serien">Senaste i Fortnox</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider" title="Kunder i Fortnox inom serien / kunder i portalen med gruppen">Kunder</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Kapacitet</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {groups.map((group) => {
                  const stats = fortnoxStats[group.id]
                  const fortnoxMax = stats?.fortnox_max ?? null
                  // Kapaciteten räknas på det högsta kända numret: Fortnox först,
                  // portalens räknare som reserv tills spegeln är synkad
                  const highest = Math.max(fortnoxMax ?? group.series_start - 1, group.current_counter)
                  const capacity = group.series_end - group.series_start + 1
                  const used = Math.max(0, highest - group.series_start + 1)
                  const percent = capacity > 0 ? (used / capacity) * 100 : 0
                  const isNearFull = percent > 90
                  const counterAhead = fortnoxMax != null && group.current_counter > fortnoxMax

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
                              className="text-[10px] font-semibold uppercase tracking-wider text-[#20c58f]"
                              title="Privatärenden hamnar automatiskt i denna grupp"
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
                        {fortnoxMax != null ? (
                          <span className="text-sm font-mono text-white">{fortnoxMax}</span>
                        ) : (
                          <span className="text-sm font-mono text-slate-500" title="Inga Fortnox-kunder i serien ännu">–</span>
                        )}
                        <div
                          className={`text-[11px] font-mono ${counterAhead ? 'text-amber-400' : 'text-slate-500'}`}
                          title={counterAhead
                            ? 'Portalens Oneflow-räknare ligger före Fortnox. Nästa avtalskund får räknarens nummer + 1.'
                            : 'Portalens Oneflow-räknare (används bara av avtalskunder)'}
                        >
                          räknare {group.current_counter}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-300">{stats?.fortnox_count ?? 0}</span>
                        <span className="text-xs text-slate-500"> / {customerCounts[group.id] || 0}</span>
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
