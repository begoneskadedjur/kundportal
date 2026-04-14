// src/components/shared/ServiceArticleSelector.tsx
// Tvånivå-väljare för Tjänsteutbud: Grupp → Tjänst

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ServiceGroupService, ServiceCatalogService } from '../../services/servicesCatalogService'
import type { Service, ServiceGroup } from '../../types/services'

interface ServiceArticleSelectorProps {
  groupId: string | null
  serviceId: string | null
  onGroupChange: (groupId: string | null) => void
  onServiceChange: (serviceId: string | null, service: Service | null) => void
  disabled?: boolean
}

export default function ServiceArticleSelector({
  groupId,
  serviceId,
  onGroupChange,
  onServiceChange,
  disabled = false,
}: ServiceArticleSelectorProps) {
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingServices, setLoadingServices] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hämta grupper vid mount
  useEffect(() => {
    ServiceGroupService.getActiveGroups()
      .then(setGroups)
      .catch(() => setError('Kunde inte hämta tjänstegrupper'))
      .finally(() => setLoadingGroups(false))
  }, [])

  // Om serviceId är satt men groupId saknas, härledd gruppen
  useEffect(() => {
    if (serviceId && !groupId) {
      ServiceCatalogService.getServiceById(serviceId).then((svc) => {
        if (svc?.group_id) onGroupChange(svc.group_id)
      })
    }
  }, [serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hämta tjänster när grupp väljs
  useEffect(() => {
    if (!groupId) { setServices([]); return }
    setLoadingServices(true)
    ServiceCatalogService.getActiveServicesByGroup(groupId)
      .then(setServices)
      .catch(() => setError('Kunde inte hämta tjänster'))
      .finally(() => setLoadingServices(false))
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
          onServiceChange(null, null)
        }}
        disabled={disabled}
        className={selectClass}
      >
        <option value="">Välj tjänstegrupp</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>

      {/* Tjänst-väljare */}
      <div className="relative">
        <select
          value={serviceId ?? ''}
          onChange={(e) => {
            const val = e.target.value || null
            const found = services.find((s) => s.id === val) ?? null
            onServiceChange(val, found)
          }}
          disabled={disabled || !groupId || loadingServices}
          className={selectClass}
        >
          <option value="">
            {!groupId ? 'Välj grupp först' : loadingServices ? 'Laddar...' : 'Välj tjänst'}
          </option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {loadingServices && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400 pointer-events-none" />
        )}
      </div>
    </div>
  )
}
