// src/components/admin/settings/ServiceCatalogSettings.tsx
// Admin-sida för att hantera Tjänsteutbud (services + service_groups)

import { useState, useEffect, useMemo } from 'react'
import { Package, Plus, Pencil, Trash2, Search, RefreshCw, ChevronDown, ChevronRight, Eye, EyeOff, Settings, CalendarCheck, CalendarOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { ServiceCatalogService, ServiceGroupService } from '../../../services/servicesCatalogService'
import type { ServiceWithGroup, ServiceGroup } from '../../../types/services'
import ServiceCatalogEditModal from './ServiceCatalogEditModal'
import ServiceGroupEditModal from './ServiceGroupEditModal'
import PricingSettingsModal from './PricingSettingsModal'

export default function ServiceCatalogSettings() {
  const [services, setServices] = useState<ServiceWithGroup[]>([])
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Modaler
  const [editingService, setEditingService] = useState<ServiceWithGroup | null | undefined>(undefined)
  const [editingGroup, setEditingGroup] = useState<ServiceGroup | null | undefined>(undefined)
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null)
  const [pricingSettingsOpen, setPricingSettingsOpen] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [svcData, grpData, grpCounts] = await Promise.all([
        ServiceCatalogService.getAllServices(),
        ServiceGroupService.getAllGroups(),
        ServiceGroupService.getServiceCountsByGroup(),
      ])
      setServices(svcData)
      setGroups(grpData)
      setGroupCounts(grpCounts)
      // Expandera alla grupper som standard
      setExpandedGroups(new Set(grpData.map((g) => g.id)))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (!showInactive && !s.is_active) return false
      if (selectedGroupId !== 'all' && s.group_id !== selectedGroupId) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.group?.name.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [services, showInactive, selectedGroupId, searchQuery])

  // Gruppera filtrerade tjänster per grupp för visning
  const servicesByGroup = useMemo(() => {
    const map = new Map<string, { group: ServiceGroup | null; items: ServiceWithGroup[] }>()
    // Ungrouped
    map.set('__none__', { group: null, items: [] })
    groups.forEach((g) => map.set(g.id, { group: g, items: [] }))
    filteredServices.forEach((s) => {
      const key = s.group_id || '__none__'
      if (!map.has(key)) map.set(key, { group: s.group || null, items: [] })
      map.get(key)!.items.push(s)
    })
    // Sortera: grupper med sort_order, sedan ungrouped sist
    return [...map.entries()]
      .filter(([, v]) => v.items.length > 0)
      .sort(([aKey, aVal], [bKey, bVal]) => {
        if (aKey === '__none__') return 1
        if (bKey === '__none__') return -1
        return (aVal.group?.sort_order ?? 99) - (bVal.group?.sort_order ?? 99)
      })
  }, [filteredServices, groups])

  const handleToggleActive = async (s: ServiceWithGroup) => {
    try {
      await ServiceCatalogService.toggleServiceActive(s.id, !s.is_active)
      setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleToggleShowInBooking = async (s: ServiceWithGroup) => {
    try {
      await ServiceCatalogService.updateService(s.id, { show_in_booking: !s.show_in_booking })
      setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, show_in_booking: !x.show_in_booking } : x))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingServiceId(id)
    try {
      await ServiceCatalogService.deleteService(id)
      setServices((prev) => prev.filter((x) => x.id !== id))
      toast.success('Tjänst borttagen')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeletingServiceId(null)
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const totalActive = services.filter((s) => s.is_active).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-[#20c58f]" />
            Tjänsteutbud
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            BeGones tjänster mot kund – används i ärendemodaler och som faktureringspost
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPricingSettingsOpen(true)}>
            <Settings className="w-4 h-4 mr-1" />
            Inställningar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditingGroup(null)}>
            <Plus className="w-4 h-4 mr-1" />
            Ny grupp
          </Button>
          <Button variant="primary" size="sm" onClick={() => setEditingService(null)}>
            <Plus className="w-4 h-4 mr-1" />
            Ny tjänst
          </Button>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totalt', value: services.length, color: 'text-slate-300' },
          { label: 'Aktiva', value: totalActive, color: 'text-[#20c58f]' },
          { label: 'Grupper', value: groups.length, color: 'text-blue-400' },
        ].map((stat) => (
          <div key={stat.label} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Sök & Filter */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök tjänst..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          />
        </div>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        >
          <option value="all">Alla grupper</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name} ({groupCounts[g.id] || 0})</option>
          ))}
        </select>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            showInactive
              ? 'bg-slate-700 border-slate-600 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Inaktiva
        </button>
        <button
          onClick={loadData}
          className="p-1.5 text-slate-400 hover:text-white transition-colors"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grupper med tjänster */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Laddar...
        </div>
      ) : servicesByGroup.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Package className="w-8 h-8 mb-2 mx-auto opacity-50" />
          <p className="text-sm">Inga tjänster hittades</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servicesByGroup.map(([groupKey, { group, items }]) => (
            <div key={groupKey} className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
              {/* Grupprubrik */}
              <div
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => toggleGroup(groupKey)}
              >
                <div className="flex items-center gap-2">
                  {expandedGroups.has(groupKey) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  {group ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
                      <span className="font-semibold text-white text-sm">{group.name}</span>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-400 text-sm">Utan grupp</span>
                  )}
                  <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                {group && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingGroup(group) }}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                    title="Redigera grupp"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tjänster i grupp */}
              <AnimatePresence>
                {expandedGroups.has(groupKey) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-slate-700/50">
                      {items.map((svc) => (
                        <div
                          key={svc.id}
                          className={`flex items-center gap-3 px-4 py-2 hover:bg-slate-700/20 transition-colors ${!svc.is_active ? 'opacity-50' : ''}`}
                        >
                          <span className="text-xs font-mono text-slate-500 w-8 shrink-0">{svc.code}</span>
                          <span className="flex-1 text-sm text-white">{svc.name}</span>
                          <span className="text-xs text-slate-500">{svc.unit}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggleShowInBooking(svc)}
                              className={`p-1 rounded transition-colors ${
                                svc.show_in_booking
                                  ? 'text-blue-400 hover:text-slate-400'
                                  : 'text-slate-600 hover:text-blue-400'
                              }`}
                              title={svc.show_in_booking ? 'Dölj vid bokning' : 'Visa vid bokning'}
                            >
                              {svc.show_in_booking ? <CalendarCheck className="w-3.5 h-3.5" /> : <CalendarOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleToggleActive(svc)}
                              className={`p-1 rounded transition-colors ${
                                svc.is_active
                                  ? 'text-[#20c58f] hover:text-slate-400'
                                  : 'text-slate-600 hover:text-[#20c58f]'
                              }`}
                              title={svc.is_active ? 'Inaktivera' : 'Aktivera'}
                            >
                              {svc.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditingService(svc)}
                              className="p-1 text-slate-400 hover:text-white transition-colors rounded"
                              title="Redigera"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(svc.id)}
                              disabled={deletingServiceId === svc.id}
                              className="p-1 text-slate-400 hover:text-red-400 transition-colors rounded disabled:opacity-50"
                              title="Ta bort"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Edit service modal */}
      <ServiceCatalogEditModal
        isOpen={editingService !== undefined}
        onClose={() => setEditingService(undefined)}
        onSaved={loadData}
        service={editingService ?? null}
        groups={groups}
      />

      {/* Edit group modal */}
      <ServiceGroupEditModal
        isOpen={editingGroup !== undefined}
        onClose={() => setEditingGroup(undefined)}
        onSaved={loadData}
        group={editingGroup ?? null}
      />

      {/* Kalkylatorinställningar */}
      <PricingSettingsModal
        isOpen={pricingSettingsOpen}
        onClose={() => setPricingSettingsOpen(false)}
      />
    </div>
  )
}
