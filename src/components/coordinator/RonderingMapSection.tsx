// src/components/coordinator/RonderingMapSection.tsx
// Avvikelsekarta för rondering — visa stationer, klicka för att lägga till avvikelser

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useGoogleMaps } from '../../hooks/useGoogleMaps'
import Select from '../ui/Select'
import { supabase } from '../../lib/supabase'
import { Camera, Trash2, MapPin, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  RonderingAnnotation,
  RonderingAnnotationCategory,
  RonderingStationLog,
  RonderingStationStatus,
  ANNOTATION_CATEGORIES,
  RonderingService,
} from '../../services/ronderingService'
import { CaseImageService, CaseImageWithUrl } from '../../services/caseImageService'
import ImageLightbox from '../shared/ImageLightbox'

interface Station {
  id: string
  serial_number: string | null
  comment: string | null
  latitude: number
  longitude: number
  status: string
}

interface RonderingMapSectionProps {
  stations: Station[]
  stationLogs: RonderingStationLog[]
  annotations: RonderingAnnotation[]
  caseId: string
  customerId: string
  technicianName: string | null
  onAnnotationAdded: (annotation: RonderingAnnotation) => void
  onAnnotationDeleted: (id: string) => void
  onStationClick: (stationId: string) => void
}

const STATUS_COLOR: Record<RonderingStationStatus | 'none', string> = {
  ok:              '#20c58f',
  action_required: '#f59e0b',
  missing:         '#ef4444',
  none:            '#6b7280',
}

function geoJsonToLatLngs(geojson: any): Array<{ lat: number; lng: number }> | null {
  if (!geojson) return null
  const coords = geojson.coordinates
  if (!coords) return null
  if (geojson.type === 'Polygon') return coords[0].map(([lng, lat]: number[]) => ({ lat, lng }))
  if (geojson.type === 'MultiPolygon') return coords[0][0].map(([lng, lat]: number[]) => ({ lat, lng }))
  return null
}

export default function RonderingMapSection({
  stations,
  stationLogs,
  annotations,
  caseId,
  customerId,
  technicianName,
  onAnnotationAdded,
  onAnnotationDeleted,
  onStationClick,
}: RonderingMapSectionProps) {
  const { isLoaded } = useGoogleMaps({ libraries: ['marker', 'places', 'geometry'] })
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const annotationMarkersRef = useRef<google.maps.Marker[]>([])
  const polygonRef = useRef<google.maps.Polygon | null>(null)

  // Klick-dialog state
  const [pendingClick, setPendingClick] = useState<{ lat: number; lng: number } | null>(null)
  const [newCategory, setNewCategory] = useState<RonderingAnnotationCategory>('rats')
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Bilder per annotation: annotationId → lista med bilder
  const [annotationImages, setAnnotationImages] = useState<Record<string, CaseImageWithUrl[]>>({})
  const [lightbox, setLightbox] = useState<{ images: { url: string; alt: string }[]; index: number } | null>(null)

  // Fil-input refs per annotation (för bilduppladdning)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Initiera kartan
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return

    const bounds = new google.maps.LatLngBounds()
    stations.forEach(s => bounds.extend({ lat: s.latitude, lng: s.longitude }))

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      zoom: 13,
      center: stations.length > 0
        ? { lat: stations[0].latitude, lng: stations[0].longitude }
        : { lat: 59.3293, lng: 18.0686 },
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
    })

    if (stations.length > 1) {
      mapRef.current.fitBounds(bounds, 40)
    }

    // Klick på kartan → öppna dialog
    mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      setPendingClick({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      setNewNote('')
      setNewCategory('rats')
    })

    // Hämta regionpolygon
    supabase
      .from('customer_regions')
      .select('geojson_polygon, color')
      .eq('customer_id', customerId)
      .single()
      .then(({ data }) => {
        if (!data?.geojson_polygon || !mapRef.current) return
        const paths = geoJsonToLatLngs(data.geojson_polygon)
        if (!paths) return
        polygonRef.current = new google.maps.Polygon({
          paths,
          fillColor: data.color || '#3b82f6',
          fillOpacity: 0.1,
          strokeColor: data.color || '#3b82f6',
          strokeOpacity: 0.6,
          strokeWeight: 2,
          map: mapRef.current,
          clickable: false,
        })
      })
  }, [isLoaded, customerId])

  // Uppdatera stations-markörer när logs ändras
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    // Rensa gamla markörer
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    stations.forEach(station => {
      const log = stationLogs.find(l => l.station_id === station.id)
      const st = (log?.status ?? 'none') as RonderingStationStatus | 'none'
      const color = STATUS_COLOR[st]

      const marker = new google.maps.Marker({
        position: { lat: station.latitude, lng: station.longitude },
        map: mapRef.current!,
        title: station.serial_number ?? '',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
        },
      })

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-size:12px;font-weight:600;color:#1e293b">${station.serial_number || '?'}</div><div style="font-size:11px;color:#64748b">${station.comment || ''}</div>`,
      })

      marker.addListener('click', () => {
        infoWindow.open(mapRef.current!, marker)
        onStationClick(station.id)
        setPendingClick(null) // stäng klick-dialog om öppen
      })

      markersRef.current.push(marker)
    })
  }, [isLoaded, stations, stationLogs])

  // Uppdatera avvikelse-markörer
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    annotationMarkersRef.current.forEach(m => m.setMap(null))
    annotationMarkersRef.current = []

    annotations.forEach(ann => {
      const cat = ANNOTATION_CATEGORIES[ann.category]
      const marker = new google.maps.Marker({
        position: { lat: ann.latitude, lng: ann.longitude },
        map: mapRef.current!,
        title: cat.label,
        icon: {
          path: 'M 0,-12 L 10,8 L -10,8 Z', // triangel
          fillColor: cat.color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
          scale: 1.2,
        },
        zIndex: 10,
      })

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-size:12px;font-weight:600;color:#1e293b">${cat.emoji} ${cat.label}</div>${ann.note ? `<div style="font-size:11px;color:#64748b;max-width:180px">${ann.note}</div>` : ''}`,
      })
      marker.addListener('click', () => infoWindow.open(mapRef.current!, marker))

      annotationMarkersRef.current.push(marker)
    })
  }, [isLoaded, annotations])

  const saveAnnotation = useCallback(async () => {
    if (!pendingClick) return
    setSaving(true)
    try {
      const ann = await RonderingService.addAnnotation(
        caseId,
        pendingClick.lat,
        pendingClick.lng,
        newCategory,
        newNote.trim() || null,
        technicianName
      )
      onAnnotationAdded(ann)
      setPendingClick(null)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte spara avvikelse')
    } finally {
      setSaving(false)
    }
  }, [pendingClick, caseId, newCategory, newNote, technicianName, onAnnotationAdded])

  const deleteAnnotation = useCallback(async (id: string) => {
    try {
      await RonderingService.deleteAnnotation(id)
      onAnnotationDeleted(id)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte radera avvikelse')
    }
  }, [onAnnotationDeleted])

  const fetchAnnotationImages = useCallback(async (annotationId: string) => {
    try {
      const all = await CaseImageService.getCaseImages(caseId, 'contract')
      const filtered = all.filter(img => img.description === `annotation:${annotationId}`)
      setAnnotationImages(prev => ({ ...prev, [annotationId]: filtered }))
    } catch { /* tyst fel */ }
  }, [caseId])

  // Ladda bilder för alla annotationer när de ändras
  useEffect(() => {
    annotations.forEach(ann => {
      if (!annotationImages[ann.id]) {
        fetchAnnotationImages(ann.id)
      }
    })
  }, [annotations])

  const uploadImage = useCallback(async (annotationId: string, file: File) => {
    try {
      await CaseImageService.uploadCaseImage(
        caseId,
        'contract',
        file,
        ['general'],
        `annotation:${annotationId}`
      )
      toast.success('Bild uppladdad')
      // Uppdatera bildlistan för denna annotation
      fetchAnnotationImages(annotationId)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte ladda upp bild')
    }
  }, [caseId])

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-sky-400" />
        Avvikelsekarta
        <span className="text-xs font-normal text-slate-500 ml-1">Klicka på kartan för att markera ett fel</span>
      </h3>

      {/* Karta */}
      <div className="relative rounded-xl overflow-hidden" style={{ height: 320 }}>
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-sm">
            Laddar karta...
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Klick-dialog overlay */}
        {pendingClick && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-72 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-3 z-20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">Ny avvikelse</span>
              <button onClick={() => setPendingClick(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Kategori-väljare */}
            <div className="mb-2">
              <Select
                value={newCategory}
                onChange={val => setNewCategory(val as RonderingAnnotationCategory)}
                options={[
                  { value: 'rats',       label: 'Råttaktivitet' },
                  { value: 'birds',      label: 'Fågelspillning' },
                  { value: 'insects',    label: 'Insektsangrepp' },
                  { value: 'sanitation', label: 'Sanitärt problem' },
                  { value: 'other',      label: 'Övrigt' },
                ]}
              />
            </div>

            {/* Anteckning */}
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Beskriv felet (valfritt)..."
              rows={2}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f] mb-2"
            />

            <button
              type="button"
              onClick={saveAnnotation}
              disabled={saving}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1aad7d] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Sparar...' : 'Lägg till avvikelse'}
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: STATUS_COLOR.ok }} />Inspekterad OK</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: STATUS_COLOR.action_required }} />Åtgärd krävs</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: STATUS_COLOR.missing }} />Saknas</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: STATUS_COLOR.none }} />Ej inspekterad</span>
        <span className="flex items-center gap-1"><span className="inline-block text-red-400">▲</span>Avvikelse</span>
      </div>

      {/* Avvikelse-lista */}
      {annotations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">{annotations.length} avvikelse{annotations.length !== 1 ? 'r' : ''}</p>
          {annotations.map(ann => {
            const cat = ANNOTATION_CATEGORIES[ann.category]
            const imgs = annotationImages[ann.id] || []
            return (
              <div key={ann.id} className="flex flex-col gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                {/* Huvud-rad */}
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: cat.color }}>{cat.label}</p>
                    {ann.note && <p className="text-xs text-slate-400 mt-0.5">{ann.note}</p>}
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {ann.technician_name} · {new Date(ann.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Bilduppladdning */}
                    <button
                      type="button"
                      title="Lägg till bild"
                      onClick={() => fileInputRefs.current[ann.id]?.click()}
                      className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={el => { fileInputRefs.current[ann.id] = el }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(ann.id, file)
                        e.target.value = ''
                      }}
                    />
                    {/* Radera */}
                    <button
                      type="button"
                      title="Radera avvikelse"
                      onClick={() => deleteAnnotation(ann.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Thumbnails */}
                {imgs.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap ml-4">
                    {imgs.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setLightbox({
                          images: imgs.map(i => ({ url: i.url, alt: i.file_name || '' })),
                          index: idx,
                        })}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-slate-600 hover:border-slate-400 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                      >
                        <img
                          src={img.url}
                          alt={img.file_name || ''}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {annotations.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-1">Inga avvikelser markerade</p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          isOpen={true}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
