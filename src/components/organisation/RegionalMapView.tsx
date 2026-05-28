// Kartvy för regionalkunder — visar alla regioners stationer färgkodade på en gemensam karta.
// Ersätter tabb-navigationen i organisation-portalen för kunder med is_regional=true.

import React, { useState, useEffect, useCallback } from 'react'
import { MapPin, Filter, Layers } from 'lucide-react'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { CustomerOutdoorStationDetailSheet } from '../customer/CustomerOutdoorStationDetailSheet'
import { EquipmentService } from '../../services/equipmentService'
import type { EquipmentPlacementWithRelations } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'

// Färger matchar de som används i ConvertToRegionalCustomerModal
const REGION_COLORS = [
  '#20c58f', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface RegionStations {
  site: SiteOption
  color: string
  stations: EquipmentPlacementWithRelations[]
}

interface RegionalMapViewProps {
  sites: SiteOption[]
  organizationName?: string
  highlightedStationId?: string | null
}

export default function RegionalMapView({
  sites,
  organizationName,
  highlightedStationId,
}: RegionalMapViewProps) {
  const [regionData, setRegionData] = useState<RegionStations[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set(sites.map(s => s.id)))
  const [selectedStation, setSelectedStation] = useState<EquipmentPlacementWithRelations | null>(null)

  const loadStations = useCallback(async () => {
    if (sites.length === 0) { setLoading(false); return }
    setLoading(true)
    try {
      const results = await Promise.all(
        sites.map(async (site, index) => {
          const color = REGION_COLORS[index % REGION_COLORS.length]
          const stations = await EquipmentService.getEquipmentByCustomer(site.id)
          // Overrida markörfärg med regionfärg
          const coloredStations = stations
            .filter(s => s.status === 'active' && s.latitude && s.longitude)
            .map(s => ({
              ...s,
              station_type_data: s.station_type_data
                ? { ...s.station_type_data, color }
                : { id: '', code: '', name: site.site_name, color, icon: null, prefix: null,
                    measurement_unit: null, measurement_label: null,
                    threshold_warning: null, threshold_critical: null,
                    threshold_direction: null, threshold_source: null },
            }))
          return { site, color, stations: coloredStations }
        })
      )
      setRegionData(results)
    } catch (err) {
      console.error('RegionalMapView: fel vid laddning av stationer', err)
    } finally {
      setLoading(false)
    }
  }, [sites])

  useEffect(() => { loadStations() }, [loadStations])

  // Synkronisera activeRegions när sites ändras
  useEffect(() => {
    setActiveRegions(new Set(sites.map(s => s.id)))
  }, [sites])

  const toggleRegion = (siteId: string) => {
    setActiveRegions(prev => {
      const next = new Set(prev)
      if (next.has(siteId)) { next.delete(siteId) } else { next.add(siteId) }
      return next
    })
  }

  // Flat lista med stationer för aktiva regioner
  const visibleStations = regionData
    .filter(r => activeRegions.has(r.site.id))
    .flatMap(r => r.stations)

  const totalStations = regionData.reduce((sum, r) => sum + r.stations.length, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar regionskarta...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{organizationName || 'Organisation'}</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {sites.length} regioner · {totalStations} aktiva stationer
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Layers className="w-4 h-4" />
              Regionkarta
            </div>
          </div>
        </div>

        {/* Region-filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            Visa:
          </span>
          {regionData.map(r => {
            const active = activeRegions.has(r.site.id)
            return (
              <button
                key={r.site.id}
                onClick={() => toggleRegion(r.site.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-slate-700 text-slate-500 bg-transparent'
                }`}
                style={active ? { backgroundColor: r.color + '30', borderColor: r.color + '60', color: r.color } : {}}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? r.color : '#475569' }}
                />
                {r.site.site_name}
                <span className={`${active ? 'opacity-70' : 'opacity-40'}`}>
                  ({r.stations.length})
                </span>
              </button>
            )
          })}
          {activeRegions.size < sites.length && (
            <button
              onClick={() => setActiveRegions(new Set(sites.map(s => s.id)))}
              className="text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
            >
              Visa alla
            </button>
          )}
        </div>

        {/* Karta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {visibleStations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MapPin className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-slate-400 text-sm">
                {totalStations === 0
                  ? 'Inga stationer utplacerade ännu'
                  : 'Inga stationer i valda regioner'}
              </p>
              <p className="text-slate-600 text-xs mt-1">
                Stationer placeras ut av teknikern vid servicebesök
              </p>
            </div>
          ) : (
            <EquipmentMap
              equipment={visibleStations}
              height="600px"
              showControls
              readOnly
              highlightedStationId={highlightedStationId}
              onEquipmentClick={setSelectedStation}
            />
          )}
        </div>

        {/* Legend */}
        {regionData.length > 0 && totalStations > 0 && (
          <div className="flex flex-wrap gap-4 px-1">
            {regionData.map(r => (
              <div key={r.site.id} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                <span>{r.site.site_name}</span>
                {r.site.region && r.site.region !== r.site.site_name && (
                  <span className="text-slate-600">({r.site.region})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stationsdetaljer */}
      {selectedStation && (
        <CustomerOutdoorStationDetailSheet
          station={selectedStation}
          isOpen={!!selectedStation}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  )
}
