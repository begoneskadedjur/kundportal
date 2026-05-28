// Modal för att konvertera en vanlig kund till "regionalkund" —
// samma tekniska struktur som multisite men med gemensam inloggning
// och karta med färgkodade regioner i portalen.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  MapPin, Check, ChevronRight, Plus, Trash2,
  Building2, ArrowLeft, ArrowRight, AlertCircle, CheckCircle,
  Pencil, X, Search
} from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { useGoogleMaps } from '../../../hooks/useGoogleMaps'
import toast from 'react-hot-toast'

// Fördefinierade färger för regionfärger på kartan
const REGION_COLORS = [
  '#20c58f', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

interface Customer {
  id: string
  name: string
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contract_type?: string | null
}

interface PendingRegion {
  tempId: string
  site_name: string
  region: string
  color: string
  polygon?: Array<{ lat: number; lng: number }> | null
}

interface ConvertToRegionalCustomerModalProps {
  customer: Customer
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'regions' | 'boundaries' | 'confirm'

// Rita-steg: lokal kommunsökning + manuell polygon-ritning (ingen DrawingManager/Places API)
function BoundariesMapPanel({
  regions,
  onPolygonSaved,
}: {
  regions: PendingRegion[]
  onPolygonSaved: (tempId: string, path: Array<{ lat: number; lng: number }> | null) => void
}) {
  const { isLoaded, error } = useGoogleMaps({ libraries: ['marker'] })
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const drawnPolygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map())
  // Manuell ritning
  const drawingPointsRef = useRef<google.maps.Marker[]>([])
  const drawingListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const previewPolylineRef = useRef<google.maps.Polyline | null>(null)
  // Stale-closure-säker ref
  const activeRegionIdRef = useRef<string | null>(null)
  // Kommundata-cache
  const kommunFeaturesRef = useRef<any[] | null>(null)

  const [activeRegionId, setActiveRegionId] = useState<string | null>(null)
  const [drawingActive, setDrawingActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [kommunLoading, setKommunLoading] = useState(false)

  const activeRegion = regions.find(r => r.tempId === activeRegionId) || null

  useEffect(() => { activeRegionIdRef.current = activeRegionId }, [activeRegionId])

  // Ladda kommundata eager när kartan är redo
  useEffect(() => {
    if (!isLoaded || kommunFeaturesRef.current) return
    setKommunLoading(true)
    fetch('https://raw.githubusercontent.com/okfse/sweden-geojson/master/swedish_municipalities.geojson')
      .then(r => r.json())
      .then(d => { kommunFeaturesRef.current = d.features || [] })
      .catch(() => { kommunFeaturesRef.current = [] })
      .finally(() => setKommunLoading(false))
  }, [isLoaded])

  // Sökresultat — filtrerar lokalt i minnet, inga API-anrop
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !kommunFeaturesRef.current) return []
    const q = searchQuery.toLowerCase()
    return kommunFeaturesRef.current
      .filter((f: any) => f.properties?.kom_namn?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, kommunLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialisera karta
  useEffect(() => {
    if (!isLoaded || !mapDivRef.current || mapRef.current) return
    mapRef.current = new google.maps.Map(mapDivRef.current, {
      center: { lat: 59.33, lng: 18.07 },
      zoom: 5,
      mapTypeId: 'roadmap',
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
  }, [isLoaded])

  // Uppdatera polygon-färger när aktiv region ändras
  useEffect(() => {
    if (!mapRef.current) return
    regions.forEach(r => {
      const poly = drawnPolygonsRef.current.get(r.tempId)
      if (poly) {
        poly.setOptions({
          strokeColor: r.color,
          fillColor: r.color,
          strokeOpacity: activeRegionId === r.tempId ? 1 : 0.5,
          fillOpacity: activeRegionId === r.tempId ? 0.35 : 0.15,
        })
      }
    })
  }, [activeRegionId, regions])

  // Spara en färdig polygon på kartan och i state
  const commitPolygon = useCallback((path: Array<{ lat: number; lng: number }>, regionId: string, color: string) => {
    if (!mapRef.current || path.length < 3) return
    const old = drawnPolygonsRef.current.get(regionId)
    if (old) old.setMap(null)

    const polygon = new google.maps.Polygon({
      paths: path,
      strokeColor: color,
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillColor: color,
      fillOpacity: 0.3,
      editable: true,
      zIndex: 2,
      map: mapRef.current,
    })
    drawnPolygonsRef.current.set(regionId, polygon)
    onPolygonSaved(regionId, path)

    const updatePath = () => {
      const newPath = polygon.getPath().getArray().map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }))
      onPolygonSaved(regionId, newPath)
    }
    google.maps.event.addListener(polygon.getPath(), 'set_at', updatePath)
    google.maps.event.addListener(polygon.getPath(), 'insert_at', updatePath)
  }, [onPolygonSaved])

  // Applicera kommunpolygon från GeoJSON
  const applyKommunPolygon = useCallback((geometry: any, regionId: string, color: string) => {
    if (!mapRef.current) return
    const toLatLngs = (ring: number[][]) => ring.map(([lng, lat]) => ({ lat, lng }))
    let paths: Array<{ lat: number; lng: number }>[]
    if (geometry.type === 'Polygon') {
      paths = geometry.coordinates.map(toLatLngs)
    } else if (geometry.type === 'MultiPolygon') {
      paths = geometry.coordinates.flatMap((poly: number[][][]) => poly.map(toLatLngs))
    } else {
      return
    }
    const firstRing = paths[0]
    commitPolygon(firstRing, regionId, color)

    const bounds = new google.maps.LatLngBounds()
    firstRing.forEach(p => bounds.extend(p))
    mapRef.current.fitBounds(bounds)
  }, [commitPolygon])

  // Välj kommun från dropdown
  const selectKommun = useCallback((feature: any) => {
    const currentId = activeRegionIdRef.current
    const region = regions.find(r => r.tempId === currentId)
    if (region && currentId) {
      applyKommunPolygon(feature.geometry, currentId, region.color)
      setSearchQuery(feature.properties.kom_namn)
    }
    setShowDropdown(false)
  }, [regions, applyKommunPolygon])

  // Cleanup-hjälp för manuell ritning
  const cleanupTempDrawing = useCallback(() => {
    drawingPointsRef.current.forEach(m => m.setMap(null))
    drawingPointsRef.current = []
    previewPolylineRef.current?.setMap(null)
    previewPolylineRef.current = null
    drawingListenersRef.current.forEach(l => google.maps.event.removeListener(l))
    drawingListenersRef.current = []
  }, [])

  const updatePreviewPolyline = useCallback((color: string) => {
    const path = drawingPointsRef.current.map(m => m.getPosition()!)
    if (previewPolylineRef.current) {
      previewPolylineRef.current.setPath(path)
    } else {
      previewPolylineRef.current = new google.maps.Polyline({
        path,
        map: mapRef.current!,
        strokeColor: color,
        strokeWeight: 2,
        strokeOpacity: 0.7,
        strokeDasharray: '4 4',
      } as any)
    }
  }, [])

  const startDrawing = useCallback(() => {
    if (!mapRef.current || !activeRegionId) return
    const region = regions.find(r => r.tempId === activeRegionId)
    const color = region?.color || '#3b82f6'

    // Ta bort gammal polygon
    const old = drawnPolygonsRef.current.get(activeRegionId)
    if (old) {
      old.setMap(null)
      drawnPolygonsRef.current.delete(activeRegionId)
      onPolygonSaved(activeRegionId, null)
    }
    cleanupTempDrawing()
    setDrawingActive(true)
    mapRef.current.setOptions({ draggableCursor: 'crosshair' })

    const clickListener = mapRef.current.addListener('click', (e: any) => {
      if (!e.latLng) return
      const marker = new google.maps.Marker({
        position: e.latLng,
        map: mapRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 1.5,
          strokeColor: '#fff',
        },
        zIndex: 10,
      })
      drawingPointsRef.current.push(marker)
      updatePreviewPolyline(color)
    })

    const dblClickListener = mapRef.current.addListener('dblclick', (e: any) => {
      // Förhindra zoom vid dubbelklick
      if (e.stop) e.stop()
      const path = drawingPointsRef.current.map(m => ({
        lat: m.getPosition()!.lat(),
        lng: m.getPosition()!.lng(),
      }))
      cleanupTempDrawing()
      setDrawingActive(false)
      mapRef.current?.setOptions({ draggableCursor: '' })
      const id = activeRegionIdRef.current
      if (id && path.length >= 3) {
        const col = regions.find(r => r.tempId === id)?.color || '#3b82f6'
        commitPolygon(path, id, col)
      }
    })

    drawingListenersRef.current = [clickListener, dblClickListener]
  }, [activeRegionId, regions, onPolygonSaved, cleanupTempDrawing, updatePreviewPolyline, commitPolygon])

  const cancelDrawing = useCallback(() => {
    cleanupTempDrawing()
    setDrawingActive(false)
    mapRef.current?.setOptions({ draggableCursor: '' })
  }, [cleanupTempDrawing])

  const clearPolygon = useCallback((tempId: string) => {
    const old = drawnPolygonsRef.current.get(tempId)
    if (old) {
      old.setMap(null)
      drawnPolygonsRef.current.delete(tempId)
    }
    onPolygonSaved(tempId, null)
  }, [onPolygonSaved])

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Kommunsökning — lokal filtrering, inga API-anrop */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={kommunLoading ? 'Laddar kommuner...' : 'Sök kommunnamn (t.ex. Huddinge)...'}
          disabled={kommunLoading}
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] disabled:opacity-50"
        />
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {searchResults.map((f: any) => (
              <button
                key={f.properties.kom_namn}
                onMouseDown={() => selectKommun(f)}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
              >
                {f.properties.kom_namn}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {/* Regionlista */}
        <div className="w-44 flex-shrink-0 space-y-1.5">
          <p className="text-xs font-medium text-slate-400 mb-2">Välj region att rita:</p>
          {regions.map(r => {
            const hasPolygon = !!r.polygon && r.polygon.length > 0
            const isActive = activeRegionId === r.tempId
            return (
              <button
                key={r.tempId}
                onClick={() => setActiveRegionId(isActive ? null : r.tempId)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all ${
                  isActive ? 'border' : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:border-slate-600'
                }`}
                style={isActive ? { backgroundColor: r.color + '20', borderColor: r.color + '60', color: r.color } : {}}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 truncate">{r.site_name}</span>
                {hasPolygon && <Check className="w-3 h-3 flex-shrink-0 opacity-80" />}
              </button>
            )
          })}
        </div>

        {/* Karta */}
        <div className="flex-1 flex flex-col gap-2">
          <div ref={mapDivRef} style={{ width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden' }} />

          {activeRegionId ? (
            <div className="flex items-center gap-2 flex-wrap">
              {!drawingActive ? (
                <>
                  <button
                    onClick={startDrawing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white border border-slate-600 hover:border-[#20c58f] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rita manuellt
                  </button>
                  {activeRegion?.polygon && activeRegion.polygon.length > 0 && (
                    <button
                      onClick={() => clearPolygon(activeRegionId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-red-400 border border-slate-600 hover:border-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Ta bort polygon
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="text-xs text-[#20c58f]">Klicka för att lägga till punkter — dubbelklicka för att avsluta</span>
                  <button
                    onClick={cancelDrawing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/60 text-red-200 border border-red-600 hover:bg-red-900 transition-colors ml-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    Avbryt
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Sök en kommun ovan eller välj en region i listan och rita manuellt
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Sök ett kommunnamn för att hämta gränsen automatiskt. Eller rita manuellt — klicka punkter, dubbelklicka för att avsluta. Dra i punkterna för att justera.
      </p>
    </div>
  )
}

export default function ConvertToRegionalCustomerModal({
  customer,
  isOpen,
  onClose,
  onSuccess,
}: ConvertToRegionalCustomerModalProps) {
  const [step, setStep] = useState<Step>('regions')
  const [loading, setLoading] = useState(false)
  const [regions, setRegions] = useState<PendingRegion[]>([])

  // Formulärstate för ny region
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newColorIndex, setNewColorIndex] = useState(0)
  const [formError, setFormError] = useState('')

  const reset = () => {
    setStep('regions')
    setRegions([])
    setNewName('')
    setNewCode('')
    setNewColorIndex(0)
    setFormError('')
  }

  const handleClose = () => {
    if (loading) return
    reset()
    onClose()
  }

  const nextColorIndex = (current: number) =>
    (current + 1) % REGION_COLORS.length

  const addRegion = () => {
    if (!newName.trim()) { setFormError('Regionnamn krävs'); return }
    if (!newCode.trim()) { setFormError('Regionkod krävs'); return }
    setFormError('')
    const color = REGION_COLORS[newColorIndex % REGION_COLORS.length]
    setRegions(prev => [...prev, {
      tempId: crypto.randomUUID(),
      site_name: newName.trim(),
      region: newCode.trim(),
      color,
      polygon: null,
    }])
    setNewName('')
    setNewCode('')
    setNewColorIndex(prev => nextColorIndex(prev))
  }

  const removeRegion = (tempId: string) =>
    setRegions(prev => prev.filter(r => r.tempId !== tempId))

  const handlePolygonSaved = useCallback((tempId: string, path: Array<{ lat: number; lng: number }> | null) => {
    setRegions(prev => prev.map(r => r.tempId === tempId ? { ...r, polygon: path } : r))
  }, [])

  const handleConvert = async () => {
    setLoading(true)
    try {
      const organizationId = crypto.randomUUID()

      // 1. Uppdatera huvudkunden
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          is_multisite: true,
          site_type: 'huvudkontor',
          organization_id: organizationId,
          is_regional: true,
        })
        .eq('id', customer.id)
      if (updateError) throw updateError

      // 2. Skapa en sub-kund per region
      const sitesToInsert = regions.map(r => ({
        company_name: `${customer.name} — ${r.site_name}`,
        site_name: r.site_name,
        region: r.region,
        contact_person: customer.contact_person || null,
        contact_email: customer.contact_email || null,
        contact_phone: customer.contact_phone || null,
        organization_id: organizationId,
        parent_customer_id: customer.id,
        is_multisite: true,
        is_regional: true,
        site_type: 'enhet' as const,
        contract_type: customer.contract_type || null,
        contract_status: 'active' as const,
        is_active: true,
        source_type: 'manual' as const,
      }))

      const { data: insertedSites, error: sitesError } = await supabase
        .from('customers')
        .insert(sitesToInsert)
        .select('id, site_name, region')

      if (sitesError) {
        // Rollback
        await supabase
          .from('customers')
          .update({ is_multisite: false, site_type: null, organization_id: null, is_regional: false })
          .eq('id', customer.id)
        throw sitesError
      }

      // 3. Spara polygoner i customer_regions för regioner som har ritade gränser
      const regionsWithPolygons = regions.filter(r => r.polygon && r.polygon.length >= 3)
      if (regionsWithPolygons.length > 0 && insertedSites) {
        const regionInserts = regionsWithPolygons.flatMap(r => {
          // Matcha mot infogad sub-kund via region-kod eller site_name
          const site = insertedSites.find(s => s.region === r.region || s.site_name === r.site_name)
          if (!site) return []
          const coords = r.polygon!.map(p => [p.lng, p.lat])
          if (coords.length > 0) coords.push(coords[0])
          const geojson_polygon = { type: 'Polygon', coordinates: [coords] }
          return [{
            customer_id: site.id,
            geojson_polygon,
            color: r.color,
            opacity: 0.2,
          }]
        })

        if (regionInserts.length > 0) {
          const { error: polyError } = await supabase
            .from('customer_regions')
            .insert(regionInserts)
          if (polyError) {
            console.error('Kunde inte spara polygoner:', polyError)
            // Inte kritiskt — polygoner kan läggas till senare
            toast('Regiongränser kunde inte sparas, men konverteringen lyckades.', { icon: '⚠️' })
          }
        }
      }

      toast.success(`${customer.name} konverterad till regionalkund med ${regions.length} regioner!`)
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('Regional conversion error:', err)
      toast.error(err.message || 'Konvertering misslyckades')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { key: 'regions' as Step, label: '1. Regioner' },
    { key: 'boundaries' as Step, label: '2. Gränser' },
    { key: 'confirm' as Step, label: '3. Bekräfta' },
  ]
  const stepIndex = steps.findIndex(s => s.key === step)

  const footer = (
    <div className="flex items-center justify-between px-4 py-2.5">
      <Button
        variant="ghost"
        onClick={() => {
          if (step === 'regions') handleClose()
          else if (step === 'boundaries') setStep('regions')
          else setStep('boundaries')
        }}
        disabled={loading}
        className="flex items-center gap-1.5"
      >
        <ArrowLeft className="w-4 h-4" />
        {step === 'regions' ? 'Avbryt' : 'Tillbaka'}
      </Button>
      <div className="flex items-center gap-2">
        {step === 'regions' && (
          <Button
            variant="primary"
            onClick={() => {
              if (regions.length < 2) {
                toast.error('Lägg till minst 2 regioner')
                return
              }
              setStep('boundaries')
            }}
            className="flex items-center gap-1.5"
          >
            Nästa
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
        {step === 'boundaries' && (
          <>
            <Button
              variant="ghost"
              onClick={() => setStep('confirm')}
              className="text-slate-400 hover:text-white"
            >
              Hoppa över
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep('confirm')}
              className="flex items-center gap-1.5"
            >
              Nästa
              <ArrowRight className="w-4 h-4" />
            </Button>
          </>
        )}
        {step === 'confirm' && (
          <Button
            variant="primary"
            onClick={handleConvert}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <LoadingSpinner /> : <CheckCircle className="w-4 h-4" />}
            Konvertera
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Konvertera till regionalkund"
      size="xl"
      preventClose={loading}
      footer={footer}
    >
      {/* Step indicator */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  step === s.key
                    ? 'bg-[#20c58f] text-white'
                    : stepIndex > i
                    ? 'bg-[#20c58f]/20 text-[#20c58f]'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {stepIndex > i ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-xs ${step === s.key ? 'text-white font-medium' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 mx-2" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── STEG 1: REGIONER ── */}
        {step === 'regions' && (
          <>
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Kontaktpersoner ärvs från <span className="text-white font-medium">{customer.name}</span> och delas av alla regioner.</p>
                  {customer.contact_email && (
                    <p className="text-slate-500">{customer.contact_person} · {customer.contact_email}</p>
                  )}
                  <p className="mt-1">Stationer placeras sedan ut per region av teknikern.</p>
                </div>
              </div>
            </div>

            {regions.length > 0 && (
              <div className="space-y-2">
                {regions.map((r) => (
                  <div key={r.tempId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{r.site_name}</p>
                      <p className="text-xs text-slate-400">Kod: {r.region}</p>
                    </div>
                    <button
                      onClick={() => removeRegion(r.tempId)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-slate-400" />
                Lägg till region
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Regionnamn"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="T.ex. Region Nord"
                  onKeyDown={e => e.key === 'Enter' && addRegion()}
                />
                <Input
                  label="Regionkod"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  placeholder="T.ex. Nord"
                  onKeyDown={e => e.key === 'Enter' && addRegion()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Regionfärg på karta</label>
                <div className="flex items-center gap-2">
                  {REGION_COLORS.map((color, i) => (
                    <button
                      key={color}
                      onClick={() => setNewColorIndex(i)}
                      className={`w-6 h-6 rounded-full transition-transform ${newColorIndex === i ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {formError && (
                <p className="text-xs text-red-400">{formError}</p>
              )}
              <Button variant="secondary" size="sm" onClick={addRegion} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Lägg till
              </Button>
            </div>

            {regions.length < 2 && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Minst 2 regioner krävs för att konvertera
              </p>
            )}
          </>
        )}

        {/* ── STEG 2: GRÄNSER ── */}
        {step === 'boundaries' && (
          <BoundariesMapPanel
            regions={regions}
            onPolygonSaved={handlePolygonSaved}
          />
        )}

        {/* ── STEG 3: BEKRÄFTA ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#20c58f]" />
                <span className="text-sm font-semibold text-white">{customer.name}</span>
                <span className="text-xs text-slate-400">→ Regionalkund</span>
              </div>
              <div className="space-y-2">
                {regions.map(r => (
                  <div key={r.tempId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-lg">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <div className="flex-1">
                      <span className="text-sm text-white">{r.site_name}</span>
                      <span className="text-xs text-slate-500 ml-2">({r.region})</span>
                    </div>
                    {r.polygon && r.polygon.length >= 3 ? (
                      <span className="text-xs text-[#20c58f] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Gräns ritad
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Ingen gräns</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
              <div className="flex items-start gap-2 text-xs text-slate-300">
                <MapPin className="w-4 h-4 text-[#20c58f] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white mb-1">Vad händer?</p>
                  <ul className="space-y-1 text-slate-400">
                    <li>• Kunden konverteras till regionalkund med {regions.length} regioner</li>
                    <li>• Befintlig inloggning fungerar som vanligt — portalen visar karta med alla regioner</li>
                    <li>• Teknikern kan placera ut stationer per region</li>
                    <li>• Kontaktuppgifter delas av alla regioner</li>
                    {regions.some(r => r.polygon && r.polygon.length >= 3) && (
                      <li>• {regions.filter(r => r.polygon && r.polygon.length >= 3).length} regiongränser sparas på kartan</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
