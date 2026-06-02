// Kartvy för regionalkunder — stationer med normala stationstyps-färger + transparenta regionpolygoner.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MapPin, Layers, Search, Camera, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { useMultisite } from '../../contexts/MultisiteContext'
import { CustomerOutdoorStationDetailSheet } from '../customer/CustomerOutdoorStationDetailSheet'
import { EquipmentService } from '../../services/equipmentService'
import { supabase } from '../../lib/supabase'
import {
  type EquipmentPlacementWithRelations,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentStatusLabel
} from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'

const SECTION_PAGE_SIZE = 10

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
  if (type === 'Polygon' && Array.isArray(coords[0])) {
    return coords[0].map(([lng, lat]: [number, number]) => ({ lat, lng }))
  }
  if (type === 'MultiPolygon' && Array.isArray(coords[0]?.[0])) {
    return coords[0][0].map(([lng, lat]: [number, number]) => ({ lat, lng }))
  }
  return null
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'd MMM yyyy', { locale: sv })
  } catch {
    return dateStr
  }
}

export default function RegionalMapView({
  sites,
  organizationName,
  highlightedStationId,
}: RegionalMapViewProps) {
  const { organization } = useMultisite()
  const isRegional = organization?.is_regional ?? false
  const [regionData, setRegionData] = useState<RegionData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set(sites.map(s => s.id)))
  const [selectedStation, setSelectedStation] = useState<EquipmentPlacementWithRelations | null>(null)

  // Tabell-state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  const loadData = useCallback(async () => {
    if (sites.length === 0) { setLoading(false); return }
    setLoading(true)
    try {
      const siteIds = sites.map(s => s.id)

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
        const FALLBACK_COLORS = ['#20c58f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
        const color = regionRow?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
        const stationsData = stationsResults.find(r => r.siteId === site.id)?.stations || []
        const stations = stationsData.filter(s => s.status === 'active' && s.latitude && s.longitude)
        const polygon = regionRow?.geojson_polygon ? geoJsonToLatLngs(regionRow.geojson_polygon) : null
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

  const regionPolygons = regionData
    .filter(r => activeRegions.has(r.site.id) && r.polygon)
    .map(r => ({
      id: r.site.id,
      paths: r.polygon!,
      color: r.color,
      opacity: 0.2,
      label: r.site.site_name,
      stationCount: r.stations.length,
    }))

  // Unika typer för typfiltret
  const availableTypes = useMemo(() => {
    const types = new Set<string>()
    visibleStations.forEach(s => {
      const name = s.station_type_data?.name || s.equipment_type
      if (name) types.add(name)
    })
    return Array.from(types).sort()
  }, [visibleStations])

  // Filtrerade stationer för tabellen
  const filteredStations = useMemo(() => {
    return visibleStations.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      const typeName = s.station_type_data?.name || s.equipment_type || ''
      if (typeFilter !== 'all' && typeName !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const name = typeName.toLowerCase()
        const comment = (s.comment || '').toLowerCase()
        if (!name.includes(q) && !comment.includes(q)) return false
      }
      return true
    })
  }, [visibleStations, statusFilter, typeFilter, search])

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

        {/* Region-filter */}
        <div className="flex flex-wrap items-center gap-2">
          {regionData.map(r => {
            const active = activeRegions.has(r.site.id)
            return (
              <button
                key={r.site.id}
                onClick={() => toggleRegion(r.site.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  active
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-800/30 border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity" style={{ backgroundColor: r.color, opacity: active ? 1 : 0.4 }} />
                {r.site.site_name}
                <span className={`text-[11px] font-mono ${active ? 'text-slate-400' : 'text-slate-600'}`}>{r.stations.length}</span>
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
                {totalStations === 0 ? 'Inga stationer utplacerade ännu' : 'Inga stationer i valda regioner'}
              </p>
              <p className="text-slate-600 text-xs mt-1">Stationer placeras ut av teknikern vid servicebesök</p>
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
              onRegionClick={(siteId) => toggleRegion(siteId)}
              enableClustering={isRegional}
              defaultMapType={isRegional ? 'roadmap' : 'satellite'}
            />
          )}
        </div>

        {/* Legend */}
        {regionData.some(r => r.polygon) && (
          <div className="flex flex-wrap gap-4 px-1">
            {regionData.filter(r => r.polygon).map(r => (
              <div key={r.site.id} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-8 h-3 rounded border" style={{ backgroundColor: r.color + '40', borderColor: r.color + '80' }} />
                <span>{r.site.site_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stationstabell */}
        {visibleStations.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                Utomhus
                <span className="text-sm font-normal text-slate-400">({visibleStations.length} stationer)</span>
              </h2>
            </div>

            {/* Sökning + filter */}
            <div className="flex flex-wrap gap-2 mb-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Sök station..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Alla statusar</option>
                <option value="active">Aktiv</option>
                <option value="ok">OK</option>
                <option value="warning">Varning</option>
                <option value="critical">Kritisk</option>
              </select>
              {availableTypes.length > 1 && (
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Alla typer</option>
                  {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              {filteredStations.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  Inga stationer matchar sökningen
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/30 border-b border-slate-700">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Nr</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Typ</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Placerad</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Kommentar</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Foto</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {(showAll ? filteredStations : filteredStations.slice(0, SECTION_PAGE_SIZE)).map((item, index) => {
                        const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status] || { bgColor: 'bg-slate-500/20', color: 'slate-400' }
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                            onClick={() => setSelectedStation(item)}
                          >
                            <td className="px-4 py-2 text-white font-medium text-sm">{index + 1}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.station_type_data?.color || '#6b7280' }} />
                                <span className="text-slate-300 text-sm">{item.station_type_data?.name || item.equipment_type || 'Okänd'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor}`} style={{ color: statusConfig.color }}>
                                {getEquipmentStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-400 text-sm">{formatDate(item.placed_at)}</td>
                            <td className="px-4 py-2 text-slate-400 text-sm max-w-[200px] truncate">{item.comment || '—'}</td>
                            <td className="px-4 py-2 text-center">
                              {item.photo_path ? <Camera className="w-3.5 h-3.5 text-blue-400 mx-auto" /> : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-400" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!showAll && filteredStations.length > SECTION_PAGE_SIZE && (
                <div className="px-4 py-2.5 border-t border-slate-700 text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Visa alla {filteredStations.length} stationer
                  </button>
                </div>
              )}
              {showAll && filteredStations.length > SECTION_PAGE_SIZE && (
                <div className="px-4 py-2.5 border-t border-slate-700 text-center">
                  <button
                    onClick={() => setShowAll(false)}
                    className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                    Visa färre
                  </button>
                </div>
              )}
            </div>
          </section>
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
