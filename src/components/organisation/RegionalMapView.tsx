// Kartvy för regionalkunder — stationer med normala stationstyps-färger + transparenta regionpolygoner.

import React, { useState, useEffect, useCallback } from 'react'
import { MapPin, Filter, Layers } from 'lucide-react'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { EquipmentList } from '../shared/equipment/EquipmentList'
import { CustomerOutdoorStationDetailSheet } from '../customer/CustomerOutdoorStationDetailSheet'
import { EquipmentService } from '../../services/equipmentService'
import { supabase } from '../../lib/supabase'
import type { EquipmentPlacementWithRelations } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface RegionData {
  site: SiteOption
  color: string
  stations: EquipmentPlacementWithRelations[]
  polygon: Array<{ lat: number; lng: number }> | null
}

interface CustomerRegionRow {
  id: string
  customer_id: string
  geojson_polygon: any
  color: string
  opacity: number
}

interface RegionalMapViewProps {
  sites: SiteOption[]
  organizationName?: string
  highlightedStationId?: string | null
}

function geoJsonToLatLngs(geojson: any): Array<{ lat: number; lng: number }> | null {
  if (!geojson) return null
  const type = geojson.type
  const coords = geojson.coordinates
  if (!coords) return null
  // Polygon → first ring
  if (type === 'Polygon' && Array.isArray(coords[0])) {
    return coords[0].map(([lng, lat]: [number, number]) => ({ lat, lng }))
  }
  // MultiPolygon → first polygon, first ring
  if (type === 'MultiPolygon' && Array.isArray(coords[0]?.[0])) {
    return coords[0][0].map(([lng, lat]: [number, number]) => ({ lat, lng }))
  }
  return null
}

export default function RegionalMapView({
  sites,
  organizationName,
  highlightedStationId,
}: RegionalMapViewProps) {
  const [regionData, setRegionData] = useState<RegionData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set(sites.map(s => s.id)))
  const [selectedStation, setSelectedStation] = useState<EquipmentPlacementWithRelations | null>(null)

  const loadData = useCallback(async () => {
    if (sites.length === 0) { setLoading(false); return }
    setLoading(true)
    try {
      const siteIds = sites.map(s => s.id)

      // Hämta stationer och regionposter parallellt
      const [stationsResults, { data: regionRows }] = await Promise.all([
        Promise.all(sites.map(site =>
          EquipmentService.getEquipmentByCustomer(site.id)
            .then(stations => ({ siteId: site.id, stations }))
        )),
        supabase
          .from('customer_regions')
          .select('id, customer_id, geojson_polygon, color, opacity')
          .in('customer_id', siteIds)
      ])

      const regionMap = new Map<string, CustomerRegionRow>(
        (regionRows || []).map(r => [r.customer_id, r])
      )

      const results: RegionData[] = sites.map((site, index) => {
        const regionRow = regionMap.get(site.id)
        // Färg: från DB om polygon finns, annars fallback-palett
        const FALLBACK_COLORS = ['#20c58f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
        const color = regionRow?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]

        const stationsData = stationsResults.find(r => r.siteId === site.id)?.stations || []
        const stations = stationsData.filter(s => s.status === 'active' && s.latitude && s.longitude)

        const polygon = regionRow?.geojson_polygon
          ? geoJsonToLatLngs(regionRow.geojson_polygon)
          : null

        return { site, color, stations, polygon }
      })

      setRegionData(results)
    } catch (err) {
      console.error('RegionalMapView: fel vid laddning', err)
    } finally {
      setLoading(false)
    }
  }, [sites])

  useEffect(() => { loadData() }, [loadData])

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

  const visibleStations = regionData
    .filter(r => activeRegions.has(r.site.id))
    .flatMap(r => r.stations)

  const totalStations = regionData.reduce((sum, r) => sum + r.stations.length, 0)

  // Polygoner för aktiva regioner med definierade gränser
  const regionPolygons = regionData
    .filter(r => activeRegions.has(r.site.id) && r.polygon)
    .map(r => ({
      id: r.site.id,
      paths: r.polygon!,
      color: r.color,
      opacity: 0.2,
      label: r.site.site_name,
    }))

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
                  active ? 'border-transparent' : 'border-slate-700 text-slate-500'
                }`}
                style={active ? { backgroundColor: r.color + '30', borderColor: r.color + '60', color: r.color } : {}}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? r.color : '#475569' }}
                />
                {r.site.site_name}
                <span className="opacity-60">({r.stations.length})</span>
                {r.polygon && (
                  <span className="opacity-50 text-[10px]">▪</span>
                )}
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
          {visibleStations.length === 0 && regionPolygons.length === 0 ? (
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
              regionPolygons={regionPolygons}
              height="600px"
              showControls
              readOnly
              highlightedStationId={highlightedStationId}
              onEquipmentClick={setSelectedStation}
            />
          )}
        </div>

        {/* Legend */}
        {regionData.some(r => r.polygon) && (
          <div className="flex flex-wrap gap-4 px-1">
            {regionData.filter(r => r.polygon).map(r => (
              <div key={r.site.id} className="flex items-center gap-2 text-xs text-slate-400">
                <span
                  className="w-8 h-3 rounded border"
                  style={{ backgroundColor: r.color + '40', borderColor: r.color + '80' }}
                />
                <span>{r.site.site_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stationslista under kartan */}
        {visibleStations.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                Utplacerade stationer ({visibleStations.length})
              </h2>
            </div>
            <div className="p-4">
              <EquipmentList
                equipment={visibleStations}
                readOnly
                showFilters
              />
            </div>
          </div>
        )}
      </div>

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
