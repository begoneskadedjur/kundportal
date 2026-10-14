// src/components/shared/specialReports/AreaMapEditor.tsx
// Översiktskartan i specialrapporten: Google Maps satellit med alla sektioners
// områden som polygoner med nummer. "Rita område" klickar ut hörn (markörer +
// linje), ångra punkt, avsluta med "Skapa sektion" eller klick på första hörnet.
// Vald sektions område kan redigeras direkt (dra i hörnen). Utan sparat utsnitt
// centreras kartan på ärendets adress (geokodning) eller på Sverige, och
// utsnittet sparas när användaren panorerar eller zoomar.
// Överläggen ligger i en isolate-behållare (känd iPhone-bugg med staplingen).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import type { LatLng, SpecialReportMapView } from '../../../types/specialReport'
import { mittpunkt } from './specialReportUtils'
import { useMapsReady } from './useMapsReady'

export interface AreaSection {
  id: string
  nr: number
  title: string
  area: LatLng[] | null
}

interface AreaMapEditorProps {
  sections: AreaSection[]
  selectedId: string | null
  mapView: SpecialReportMapView | null
  address: string | null
  onSelect: (sectionId: string) => void
  /** Nytt område utan målsektion: föräldern skapar en sektion */
  onCreateArea: (area: LatLng[]) => void | Promise<void>
  /** Ändrat eller omritat område för en befintlig sektion */
  onUpdateArea: (sectionId: string, area: LatLng[]) => void
  onMapViewChange: (view: SpecialReportMapView) => void
  /** Spara utsnittet när kartan flyttas */
  saveView: boolean
  /** Starta ritning. sectionId null = ny sektion, annars rita om den sektionens område */
  drawRequest?: { sectionId: string | null; token: number } | null
  /** Zooma till en sektions område */
  focusRequest?: { sectionId: string; token: number } | null
  /** Fylls med en funktion som ger kartans aktuella utsnitt */
  currentViewRef?: { current: (() => SpecialReportMapView | null) | null }
  className?: string
}

const SVERIGE = { lat: 62.0, lng: 15.0, zoom: 5 }
const BRAND = '#20c58f'

type Etikett = google.maps.OverlayView & {
  setVald: (v: boolean) => void
  setRitlage: (v: boolean) => void
  setText: (nr: number, namn: string) => void
  setPos: (p: LatLng) => void
}

/** HTML-etikett på kartan (nummer + namn), skapas när google finns */
function skapaEtikett(map: google.maps.Map, pos: LatLng, nr: number, namn: string, onClick: () => void): Etikett {
  class Lapp extends google.maps.OverlayView {
    div: HTMLButtonElement
    pos: google.maps.LatLng
    constructor() {
      super()
      this.pos = new google.maps.LatLng(pos.lat, pos.lng)
      this.div = document.createElement('button')
      this.div.type = 'button'
      this.div.style.position = 'absolute'
      this.div.style.transform = 'translate(-50%, -50%)'
      this.div.style.whiteSpace = 'nowrap'
      this.div.className = 'flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border-2 border-white text-xs font-semibold shadow-lg'
      this.div.addEventListener('click', e => { e.stopPropagation(); onClick() })
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.div)
      this.setText(nr, namn)
      this.setVald(false)
    }
    setText(n: number, t: string) {
      this.div.innerHTML = ''
      const nrSpan = document.createElement('span')
      nrSpan.className = 'etikett-nr w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-extrabold'
      nrSpan.textContent = String(n)
      const namnSpan = document.createElement('span')
      namnSpan.textContent = t
      this.div.append(nrSpan, namnSpan)
      this.div.setAttribute('aria-label', `Sektion ${n}, ${t}`)
    }
    setVald(v: boolean) {
      this.div.style.background = v ? BRAND : 'rgba(15,23,42,0.9)'
      this.div.style.color = v ? '#04140d' : '#fff'
      const nrSpan = this.div.querySelector<HTMLSpanElement>('.etikett-nr')
      if (nrSpan) {
        nrSpan.style.background = v ? '#04140d' : BRAND
        nrSpan.style.color = v ? BRAND : '#04140d'
      }
    }
    setPos(p: LatLng) {
      this.pos = new google.maps.LatLng(p.lat, p.lng)
      this.draw()
    }
    setRitlage(v: boolean) {
      this.div.style.pointerEvents = v ? 'none' : 'auto'
      this.div.style.opacity = v ? '0.6' : '1'
    }
    onAdd() { this.getPanes()?.overlayMouseTarget.appendChild(this.div) }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos)
      if (p) { this.div.style.left = `${p.x}px`; this.div.style.top = `${p.y}px` }
    }
    onRemove() { this.div.remove() }
  }
  const lapp = new Lapp()
  lapp.setMap(map)
  return lapp
}

function vagTillLista(path: google.maps.MVCArray<google.maps.LatLng>): LatLng[] {
  return path.getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
}

export default function AreaMapEditor({
  sections,
  selectedId,
  mapView,
  address,
  onSelect,
  onCreateArea,
  onUpdateArea,
  onMapViewChange,
  saveView,
  drawRequest,
  focusRequest,
  currentViewRef,
  className = 'h-[500px]',
}: AreaMapEditorProps) {
  const { ready, error } = useMapsReady()
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polygonerRef = useRef(new Map<string, { poly: google.maps.Polygon; kand: string; lyssnare: google.maps.MapsEventListener[] }>())
  const etiketterRef = useRef(new Map<string, Etikett>())
  const positioneradRef = useRef(false)
  // Satt efter en programmatisk flytt (fitBounds) så att nästa idle inte sparas.
  // Nollställs av en timer om inget idle kommer (kartan stod redan där), annars
  // skulle användarens nästa egna flytt inte sparas
  const ignoreraNastaRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vyVantarRef = useRef<(() => void) | null>(null)
  // Väntande områdessparningar, med sparfunktionen så de kan köras vid avmontering
  const omradeTimerRef = useRef(new Map<string, { t: ReturnType<typeof setTimeout>; kor: () => void }>())

  // Senaste callbacks och värden i refs så kartlyssnarna aldrig blir inaktuella
  const cb = useRef({ onSelect, onCreateArea, onUpdateArea, onMapViewChange, saveView })
  useEffect(() => { cb.current = { onSelect, onCreateArea, onUpdateArea, onMapViewChange, saveView } })

  // Ritläge
  const [ritar, setRitar] = useState(false)
  const [ritMal, setRitMal] = useState<string | null>(null)
  const [antalHorn, setAntalHorn] = useState(0)
  const [skapar, setSkapar] = useState(false)
  const [kartlager, setKartlager] = useState<'satellite' | 'hybrid'>('satellite')
  const hornRef = useRef<google.maps.Marker[]>([])
  const linjeRef = useRef<google.maps.Polyline | null>(null)
  const ritLyssnareRef = useRef<google.maps.MapsEventListener[]>([])
  const ritMalRef = useRef<string | null>(null)
  useEffect(() => { ritMalRef.current = ritMal }, [ritMal])
  // Första hörnets klicklyssnare skapas innan avslutaRitning finns, därför via ref
  const avslutaRitningRef = useRef<() => Promise<void>>(async () => {})

  // Initiera kartan
  useEffect(() => {
    if (!ready || !divRef.current || mapRef.current) return
    const start = mapView ?? SVERIGE
    const map = new google.maps.Map(divRef.current, {
      center: { lat: start.lat, lng: start.lng },
      zoom: start.zoom,
      mapTypeId: 'satellite',
      tilt: 0,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      rotateControl: false,
      clickableIcons: false,
      disableDoubleClickZoom: true,
      gestureHandling: 'greedy',
    })
    mapRef.current = map
    if (currentViewRef) {
      currentViewRef.current = () => {
        const c = map.getCenter()
        const z = map.getZoom()
        if (!c || z == null) return null
        return { lat: Math.round(c.lat() * 1e6) / 1e6, lng: Math.round(c.lng() * 1e6) / 1e6, zoom: z }
      }
    }

    // Spara utsnittet när kartan står still efter en flytt (bara efter första placeringen)
    map.addListener('idle', () => {
      // Programmatiska flyttar (zooma till ett område) sparas inte som utsnitt
      if (ignoreraNastaRef.current) {
        clearTimeout(ignoreraNastaRef.current)
        ignoreraNastaRef.current = null
        return
      }
      if (!positioneradRef.current || !cb.current.saveView) return
      if (vyTimerRef.current) clearTimeout(vyTimerRef.current)
      const kor = () => {
        vyTimerRef.current = null
        vyVantarRef.current = null
        // Kartan kan ha tagits bort ur rapporten medan timern väntade
        if (!cb.current.saveView) return
        const c = map.getCenter()
        const z = map.getZoom()
        if (!c || z == null) return
        cb.current.onMapViewChange({
          lat: Math.round(c.lat() * 1e6) / 1e6,
          lng: Math.round(c.lng() * 1e6) / 1e6,
          zoom: z,
        })
      }
      vyVantarRef.current = kor
      vyTimerRef.current = setTimeout(kor, 800)
    })

    const blirKlar = () => {
      google.maps.event.addListenerOnce(map, 'idle', () => { positioneradRef.current = true })
    }

    if (mapView) {
      blirKlar()
      return
    }
    // Inget sparat utsnitt: rama in områdena, annars geokoda adressen, annars Sverige
    const allaHorn = sections.flatMap(s => s.area ?? [])
    if (allaHorn.length >= 3) {
      const b = new google.maps.LatLngBounds()
      allaHorn.forEach(p => b.extend(p))
      map.fitBounds(b, 40)
      blirKlar()
    } else if (address && address.trim()) {
      new google.maps.Geocoder().geocode({ address: address, region: 'se' }, (res, status) => {
        if (status === 'OK' && res && res[0]) {
          map.setCenter(res[0].geometry.location)
          map.setZoom(18)
        }
        blirKlar()
      })
    } else {
      blirKlar()
    }
    // Kartan skapas en gång; senare ändringar av mapView följer användarens egna flyttar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    mapRef.current?.setMapTypeId(kartlager)
  }, [kartlager])

  // Rita polygoner och etiketter, håll dem i synk med sektionerna
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const polygoner = polygonerRef.current
    const etiketter = etiketterRef.current
    const finns = new Set<string>()

    sections.forEach(s => {
      if (!s.area || s.area.length < 3) return
      finns.add(s.id)
      const vald = s.id === selectedId
      const kand = JSON.stringify(s.area)
      let post = polygoner.get(s.id)

      const bind = (poly: google.maps.Polygon) => {
        const path = poly.getPath()
        const andrad = () => {
          const lista = vagTillLista(path)
          const p = polygoner.get(s.id)
          if (p) p.kand = JSON.stringify(lista)
          const timers = omradeTimerRef.current
          const gammal = timers.get(s.id)
          if (gammal) clearTimeout(gammal.t)
          const kor = () => {
            timers.delete(s.id)
            cb.current.onUpdateArea(s.id, lista)
          }
          timers.set(s.id, { t: setTimeout(kor, 400), kor })
        }
        return [
          google.maps.event.addListener(path, 'set_at', andrad),
          google.maps.event.addListener(path, 'insert_at', andrad),
          google.maps.event.addListener(path, 'remove_at', andrad),
        ]
      }

      if (!post) {
        const poly = new google.maps.Polygon({ paths: s.area, map, zIndex: 2 })
        poly.addListener('click', () => cb.current.onSelect(s.id))
        post = { poly, kand, lyssnare: bind(poly) }
        polygoner.set(s.id, post)
      } else if (post.kand !== kand) {
        post.lyssnare.forEach(l => google.maps.event.removeListener(l))
        post.poly.setPath(s.area)
        post.kand = kand
        post.lyssnare = bind(post.poly)
      }
      post.poly.setOptions({
        strokeColor: vald ? BRAND : '#e2e8f0',
        strokeOpacity: vald ? 1 : 0.85,
        strokeWeight: vald ? 2.5 : 1.5,
        fillColor: vald ? BRAND : '#ffffff',
        fillOpacity: vald ? 0.25 : 0.12,
        editable: vald && !ritar,
        clickable: !ritar,
        zIndex: vald ? 3 : 2,
      })

      const mitt = mittpunkt(s.area)
      let lapp = etiketter.get(s.id)
      if (!lapp) {
        lapp = skapaEtikett(map, mitt, s.nr, s.title || 'Utan rubrik', () => cb.current.onSelect(s.id))
        etiketter.set(s.id, lapp)
      } else {
        lapp.setText(s.nr, s.title || 'Utan rubrik')
        lapp.setPos(mitt)
      }
      lapp.setVald(vald)
      lapp.setRitlage(ritar)
    })

    // Ta bort det som inte längre finns
    polygoner.forEach((p, id) => {
      if (finns.has(id)) return
      p.lyssnare.forEach(l => google.maps.event.removeListener(l))
      p.poly.setMap(null)
      polygoner.delete(id)
    })
    etiketter.forEach((l, id) => {
      if (finns.has(id)) return
      l.setMap(null)
      etiketter.delete(id)
    })
  }, [ready, sections, selectedId, ritar])

  // Städa bort allt vid avmontering
  useEffect(() => {
    const polygoner = polygonerRef.current
    const etiketter = etiketterRef.current
    const omradeTimers = omradeTimerRef.current
    return () => {
      polygoner.forEach(p => { p.lyssnare.forEach(l => google.maps.event.removeListener(l)); p.poly.setMap(null) })
      etiketter.forEach(l => l.setMap(null))
      // Kör väntande sparningar i stället för att tappa dem (t.ex. byte av vy direkt efter ett drag)
      ;[...omradeTimers.values()].forEach(v => { clearTimeout(v.t); v.kor() })
      omradeTimers.clear()
      if (vyTimerRef.current) clearTimeout(vyTimerRef.current)
      vyVantarRef.current?.()
      if (ignoreraNastaRef.current) clearTimeout(ignoreraNastaRef.current)
    }
  }, [])

  // ── Ritning ──
  const rensaRitning = useCallback(() => {
    hornRef.current.forEach(m => m.setMap(null))
    hornRef.current = []
    linjeRef.current?.setMap(null)
    linjeRef.current = null
    ritLyssnareRef.current.forEach(l => google.maps.event.removeListener(l))
    ritLyssnareRef.current = []
    setAntalHorn(0)
    mapRef.current?.setOptions({ draggableCursor: '' })
  }, [])

  const uppdateraLinje = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const punkter = hornRef.current.map(m => m.getPosition()!)
    const vag = punkter.length > 2 ? [...punkter, punkter[0]] : punkter
    if (!linjeRef.current) {
      linjeRef.current = new google.maps.Polyline({ map, path: vag, strokeColor: BRAND, strokeWeight: 2.5, clickable: false, zIndex: 10 })
    } else {
      linjeRef.current.setPath(vag)
    }
    setAntalHorn(punkter.length)
    // Första hörnet blir större och klickbart när området kan stängas
    const forsta = hornRef.current[0]
    if (forsta) {
      const kanStanga = punkter.length >= 3
      forsta.setIcon({ path: google.maps.SymbolPath.CIRCLE, scale: kanStanga ? 9 : 6, fillColor: BRAND, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 })
      forsta.setClickable(kanStanga)
    }
  }, [])

  const avslutaRitning = useCallback(async () => {
    const punkter = hornRef.current.map(m => ({ lat: m.getPosition()!.lat(), lng: m.getPosition()!.lng() }))
    if (punkter.length < 3) return
    const mal = ritMalRef.current
    rensaRitning()
    setRitar(false)
    setRitMal(null)
    if (mal) {
      cb.current.onUpdateArea(mal, punkter)
    } else {
      setSkapar(true)
      try { await cb.current.onCreateArea(punkter) } finally { setSkapar(false) }
    }
  }, [rensaRitning])

  useEffect(() => { avslutaRitningRef.current = avslutaRitning }, [avslutaRitning])

  const startaRitning = useCallback((malSektion: string | null) => {
    const map = mapRef.current
    if (!map) return
    rensaRitning()
    setRitMal(malSektion)
    ritMalRef.current = malSektion
    setRitar(true)
    map.setOptions({ draggableCursor: 'crosshair' })
    const klick = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const marker = new google.maps.Marker({
        position: e.latLng,
        map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: BRAND, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        zIndex: 20,
        clickable: false,
      })
      if (hornRef.current.length === 0) {
        marker.addListener('click', () => {
          if (hornRef.current.length >= 3) void avslutaRitningRef.current()
        })
      }
      hornRef.current.push(marker)
      uppdateraLinje()
    })
    ritLyssnareRef.current = [klick]
  }, [rensaRitning, uppdateraLinje])

  const avbrytRitning = useCallback(() => {
    rensaRitning()
    setRitar(false)
    setRitMal(null)
  }, [rensaRitning])

  const angraPunkt = () => {
    const sista = hornRef.current.pop()
    sista?.setMap(null)
    uppdateraLinje()
  }

  // Ritbegäran utifrån (t.ex. "Rita nytt område" i sektionsvyn)
  useEffect(() => {
    if (!drawRequest || !ready || !mapRef.current) return
    startaRitning(drawRequest.sectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawRequest?.token, ready])

  // Zooma till en sektions område
  useEffect(() => {
    if (!focusRequest || !ready || !mapRef.current) return
    const s = sections.find(x => x.id === focusRequest.sectionId)
    if (!s?.area || s.area.length < 3) return
    const b = new google.maps.LatLngBounds()
    s.area.forEach(p => b.extend(p))
    // Hoppa över idle från den här flytten. Blir det ingen flytt (samma utsnitt)
    // kommer varken bounds_changed eller idle, så flaggan släpps efter en stund.
    // Flyttar kartan väntar flaggan in sitt idle hur lång tid det än tar
    const map = mapRef.current
    if (ignoreraNastaRef.current) clearTimeout(ignoreraNastaRef.current)
    const slapp = setTimeout(() => {
      if (ignoreraNastaRef.current === slapp) ignoreraNastaRef.current = null
      google.maps.event.removeListener(flyttas)
    }, 500)
    ignoreraNastaRef.current = slapp
    const flyttas = google.maps.event.addListenerOnce(map, 'bounds_changed', () => clearTimeout(slapp))
    map.fitBounds(b, 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.token, ready])

  // Rensa ritningen om komponenten avmonteras mitt i
  useEffect(() => () => {
    hornRef.current.forEach(m => m.setMap(null))
    linjeRef.current?.setMap(null)
    ritLyssnareRef.current.forEach(l => google.maps.event.removeListener(l))
  }, [])

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 ${className}`}>
        <Icon name="rapport.karta" size={32} className="text-slate-500 mb-2" />
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    )
  }

  const klar = antalHorn >= 3
  const ritHjalp = antalHorn === 0
    ? 'Tryck ut hörnen på området'
    : klar
      ? `${antalHorn} hörn. Tryck på första hörnet eller ${ritMal ? 'Spara området' : 'Skapa sektion'}`
      : 'Minst tre hörn'

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 ${className}`}>
      <div ref={divRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {ready && (
        <div className="absolute left-3 top-3 z-10 flex gap-1.5 rounded-2xl border border-slate-700 bg-slate-900/90 p-1.5">
          <button
            type="button"
            aria-pressed={ritar}
            onClick={() => (ritar ? avbrytRitning() : startaRitning(null))}
            className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm transition-colors ${
              ritar ? 'bg-[#20c58f] text-[#04140d] font-semibold' : 'text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Icon name="rapport.omrade" size={20} />
            {ritar ? 'Avbryt ritning' : 'Rita område'}
          </button>
          <button
            type="button"
            aria-label={kartlager === 'satellite' ? 'Visa gatunamn' : 'Dölj gatunamn'}
            title={kartlager === 'satellite' ? 'Visa gatunamn' : 'Dölj gatunamn'}
            onClick={() => setKartlager(k => (k === 'satellite' ? 'hybrid' : 'satellite'))}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-200 hover:bg-slate-800"
          >
            <Icon name="rapport.lager" size={20} />
          </button>
        </div>
      )}

      {ritar && (
        <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#20c58f] bg-slate-900/95 py-1.5 pl-4 pr-1.5 text-sm text-slate-200">
          <span className="truncate">{ritHjalp}</span>
          <button
            type="button"
            onClick={angraPunkt}
            disabled={antalHorn === 0}
            aria-label="Ångra senaste punkten"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-700 text-slate-200 disabled:opacity-40"
          >
            <Icon name="rapport.angra" size={16} />
          </button>
          <button
            type="button"
            onClick={() => void avslutaRitning()}
            disabled={!klar}
            className={`h-11 flex-shrink-0 rounded-xl px-3.5 text-sm font-semibold ${
              klar ? 'bg-[#20c58f] text-[#04140d]' : 'bg-slate-800 text-slate-500'
            }`}
          >
            {ritMal ? 'Spara området' : 'Skapa sektion'}
          </button>
        </div>
      )}

      {skapar && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40">
          <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
        </div>
      )}
    </div>
  )
}
