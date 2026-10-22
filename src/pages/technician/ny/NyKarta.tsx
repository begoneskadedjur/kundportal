// src/pages/technician/ny/NyKarta.tsx
// Kartan i nya arbetsvyn: dagens eller morgondagens stopp i tidsordning, numrerade.
//
// Koordinater: ärenden och kunder har inga sparade koordinater (address-fälten är bara
// text), så adresserna geokodas i webbläsaren med Google Geocoder och sparas i minnet
// under sessionen. Går en adress inte att hitta visas stoppet i listan utan markör.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { BesokKnappar } from '../../../components/technician/ny/besokUi'
import { TYP_IKON } from '../../../components/technician/ny/besokTyp'
import { useBesok } from '../../../hooks/useTeknikerBesok'
import { useGoogleMaps } from '../../../hooks/useGoogleMaps'
import {
  svenskDag, laggTillDagar, klockslag, besokBeskrivning, nastaBesok, tidTill, type DagBesok,
} from '../../../services/teknikerDagService'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Idag eller imorgon', text: 'Välj dag här. Kartan visar besöken den dagen.', mal: 'karta-dag' },
  { rubrik: 'Siffrorna är ordningen', text: 'Varje besök har en siffra på kartan och i listan. Ett är dagens första besök.', mal: 'karta-lista' },
  { rubrik: 'Navigera, Ring och Öppna', text: 'Knapparna gäller stoppet som är valt. Tryck på ett annat stopp i listan för att byta.', mal: 'karta-knappar' },
  { rubrik: 'Min position', text: 'Visar var du är just nu. Telefonen frågar om lov första gången.', mal: 'karta-position' },
]

type LatLng = { lat: number; lng: number }

// Geokodade adresser under sessionen. null = går inte att hitta, försök inte igen.
const geoCache = new Map<string, LatLng | null>()

function geokoda(geocoder: google.maps.Geocoder, adress: string): Promise<LatLng | null> {
  if (geoCache.has(adress)) return Promise.resolve(geoCache.get(adress) ?? null)
  return new Promise(resolve => {
    geocoder.geocode({ address: adress, region: 'se' }, (res, status) => {
      if (status === 'OK' && res && res[0]) {
        const l = res[0].geometry.location
        const p = { lat: l.lat(), lng: l.lng() }
        geoCache.set(adress, p)
        resolve(p)
      } else {
        // OVER_QUERY_LIMIT sparas inte, så det går att försöka igen senare
        if (status !== 'OVER_QUERY_LIMIT') geoCache.set(adress, null)
        resolve(null)
      }
    })
  })
}

/** useGoogleMaps rapporterar inte laddat om en annan instans lade till skriptet, därför pollar vi också */
function useMapsKlar(): { klar: boolean; fel: string | null } {
  const { isLoaded, error } = useGoogleMaps({ libraries: ['geometry'] })
  const [klar, setKlar] = useState(() => typeof window !== 'undefined' && !!window.google?.maps)
  useEffect(() => {
    if (isLoaded) { setKlar(true); return }
    if (klar) return
    const t = window.setInterval(() => {
      if (window.google?.maps) { setKlar(true); window.clearInterval(t) }
    }, 300)
    return () => window.clearInterval(t)
  }, [isLoaded, klar])
  return { klar: klar || isLoaded, fel: error }
}

function markorIkon(vald: boolean, klar: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: vald ? 17 : 14,
    fillColor: klar ? '#64748b' : vald ? '#20c58f' : '#0f172a',
    fillOpacity: 1,
    strokeColor: vald ? '#04281c' : '#ffffff',
    strokeWeight: 2,
    labelOrigin: new google.maps.Point(0, 0),
  } as google.maps.Symbol & { labelOrigin: google.maps.Point }
}

export default function NyKarta() {
  const [params, setParams] = useSearchParams()
  const vald = params.get('dag') === 'imorgon' ? 'imorgon' : 'idag'
  const idag = svenskDag()
  const imorgon = laggTillDagar(idag, 1)
  const { besok, laddar, fel, ladda } = useBesok(idag, imorgon)
  const [oppet, setOppet] = useState<ArendeRef | null>(null)
  const [visaMig, setVisaMig] = useState(false)
  const [valdNyckel, setValdNyckel] = useState<string | null>(null)
  const [koordinater, setKoordinater] = useState<Map<string, LatLng | null>>(new Map())
  const [position, setPosition] = useState<LatLng | null>(null)

  const { klar: mapsKlar, fel: mapsFel } = useMapsKlar()
  const kartRef = useRef<HTMLDivElement>(null)
  const kartaRef = useRef<google.maps.Map | null>(null)
  const markorerRef = useRef<google.maps.Marker[]>([])
  const posMarkorRef = useRef<google.maps.Marker | null>(null)

  const dagIdag = useMemo(() => besok.filter(b => b.dag === idag), [besok, idag])
  const dagImorgon = useMemo(() => besok.filter(b => b.dag === imorgon), [besok, imorgon])
  const stopp = vald === 'idag' ? dagIdag : dagImorgon

  // Standardval: nästa besök idag, första besöket imorgon
  const standard = useMemo(() => (vald === 'idag' ? nastaBesok(stopp) : stopp[0] ?? null), [vald, stopp])
  const valt = stopp.find(b => b.nyckel === valdNyckel) ?? standard
  useEffect(() => { setValdNyckel(null) }, [vald])

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: vald === 'idag' ? `Idag, ${dagIdag.length} stopp` : `Imorgon, ${dagImorgon.length} stopp`, onVisaMig: oppnaVisaMig })

  // Skapa kartan
  useEffect(() => {
    if (!mapsKlar || !kartRef.current || kartaRef.current) return
    kartaRef.current = new google.maps.Map(kartRef.current, {
      center: { lat: 59.33, lng: 18.06 },
      zoom: 10,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
    })
  }, [mapsKlar, laddar])

  // Geokoda dagens adresser, en i taget
  useEffect(() => {
    if (!mapsKlar) return
    let avbruten = false
    const geocoder = new google.maps.Geocoder()
    ;(async () => {
      for (const b of stopp) {
        if (avbruten) return
        if (!b.adress) continue
        if (geoCache.has(b.adress)) continue
        await geokoda(geocoder, b.adress)
        if (avbruten) return
        setKoordinater(new Map(geoCache))
        await new Promise(r => setTimeout(r, 120))
      }
      if (!avbruten) setKoordinater(new Map(geoCache))
    })()
    return () => { avbruten = true }
  }, [mapsKlar, stopp])

  // Rita markörer
  useEffect(() => {
    const karta = kartaRef.current
    if (!karta || !mapsKlar) return
    markorerRef.current.forEach(m => m.setMap(null))
    markorerRef.current = []
    const granser = new google.maps.LatLngBounds()
    let antal = 0
    stopp.forEach((b, i) => {
      const p = b.adress ? koordinater.get(b.adress) : null
      if (!p) return
      const arVald = valt?.nyckel === b.nyckel
      const m = new google.maps.Marker({
        map: karta,
        position: p,
        icon: markorIkon(arVald, b.avslutad),
        label: { text: String(i + 1), color: arVald ? '#04281c' : '#ffffff', fontSize: '13px', fontWeight: '700' },
        title: `${i + 1}. ${b.kund}`,
        zIndex: arVald ? 100 : 10,
      })
      m.addListener('click', () => setValdNyckel(b.nyckel))
      markorerRef.current.push(m)
      granser.extend(p)
      antal++
    })
    if (antal === 1) {
      karta.setCenter(granser.getCenter())
      karta.setZoom(13)
    } else if (antal > 1) {
      karta.fitBounds(granser, { top: 40, right: 40, bottom: 260, left: 40 })
    }
    // valt räknas inte med här, så att kartan inte zoomar om vid varje val
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopp, koordinater, mapsKlar])

  // Uppdatera bara markörernas utseende när valet ändras
  useEffect(() => {
    if (!mapsKlar) return
    markorerRef.current.forEach((m, idx) => {
      const titel = m.getTitle() || ''
      const nr = Number(titel.split('.')[0]) || idx + 1
      const b = stopp[nr - 1]
      if (!b) return
      const arVald = valt?.nyckel === b.nyckel
      m.setIcon(markorIkon(arVald, b.avslutad))
      m.setLabel({ text: String(nr), color: arVald ? '#04281c' : '#ffffff', fontSize: '13px', fontWeight: '700' })
      m.setZIndex(arVald ? 100 : 10)
    })
    const p = valt?.adress ? koordinater.get(valt.adress) : null
    if (p && valdNyckel) kartaRef.current?.panTo(p)
  }, [valt?.nyckel, valt?.adress, valdNyckel, stopp, koordinater, mapsKlar])

  const visaPosition = () => {
    if (!navigator.geolocation) {
      toast.error('Telefonen kan inte visa din position')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition(p)
        const karta = kartaRef.current
        if (!karta) return
        if (!posMarkorRef.current) {
          posMarkorRef.current = new google.maps.Marker({
            map: karta,
            position: p,
            title: 'Du är här',
            zIndex: 200,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#0ea5e9', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 },
          })
        } else {
          posMarkorRef.current.setPosition(p)
        }
        karta.panTo(p)
        karta.setZoom(Math.max(karta.getZoom() ?? 12, 13))
      },
      () => toast.error('Kunde inte hämta din position. Kontrollera att platstjänster är på.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const bytDag = (d: 'idag' | 'imorgon') => {
    setParams(p => { if (d === 'imorgon') p.set('dag', 'imorgon'); else p.delete('dag'); return p }, { replace: true })
  }

  const utanMarkor = stopp.filter(b => b.adress ? koordinater.get(b.adress) === null : true)
  const valtIndex = valt ? stopp.findIndex(b => b.nyckel === valt.nyckel) : -1

  return (
    <div className="relative h-[calc(100dvh-9rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-3.5rem)] flex flex-col lg:flex-row">
      {/* Karta */}
      <div className="relative flex-1 min-h-[220px] bg-slate-800">
        <div ref={kartRef} className="absolute inset-0" aria-label="Karta över dagens besök" role="region" />
        {!mapsKlar && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 p-4 text-center">
            {mapsFel ? 'Kartan kunde inte laddas. Listan nedan fungerar ändå.' : <LoadingSpinner text="Laddar kartan..." />}
          </div>
        )}

        {/* Dagväljare och min position */}
        <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-2 pointer-events-none">
          <div data-genomgang="karta-dag" role="tablist" aria-label="Välj dag" className="pointer-events-auto flex rounded-xl bg-slate-900 border border-slate-700 p-1 shadow-lg">
            {(['idag', 'imorgon'] as const).map(d => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={vald === d}
                onClick={() => bytDag(d)}
                className={`h-10 px-3 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${vald === d ? 'bg-[#20c58f] text-[#04281c]' : 'text-slate-300 hover:text-white'}`}
              >
                {d === 'idag' ? `Idag, ${dagIdag.length} stopp` : `Imorgon, ${dagImorgon.length} stopp`}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-genomgang="karta-position"
            onClick={visaPosition}
            disabled={!mapsKlar}
            aria-label="Visa min position"
            className={`pointer-events-auto w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 shadow-lg flex items-center justify-center disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${position ? 'text-sky-400' : 'text-white'}`}
          >
            <Icon name="falt.position" size={24} />
          </button>
        </div>
      </div>

      {/* Bottenark (telefon) och sidopanel (dator) */}
      <section
        aria-label="Stopp"
        className="relative z-10 -mt-4 lg:mt-0 max-h-[55%] lg:max-h-none lg:w-[400px] overflow-y-auto bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700/60 rounded-t-3xl lg:rounded-none shadow-2xl lg:shadow-none"
      >
        <span aria-hidden="true" className="lg:hidden block mx-auto mt-2 w-10 h-1 rounded-full bg-slate-600" />
        <div className="p-4 space-y-3">
          {laddar ? (
            <div className="py-6 flex justify-center"><LoadingSpinner text="Hämtar stoppen..." /></div>
          ) : fel ? (
            <p className="text-sm text-red-400">{fel}</p>
          ) : stopp.length === 0 ? (
            <p className="text-[15px] text-slate-400">{vald === 'idag' ? 'Inga besök inbokade idag.' : 'Inga besök inbokade imorgon.'}</p>
          ) : (
            <>
              <HjalpText id="karta-ordning" rubrik="Siffrorna visar ordningen du kör i" niva="h3">
                Stoppen är numrerade i den ordning de är bokade. Tryck på ett stopp för att välja det.
              </HjalpText>

              {valt && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold ${valt.avslutad ? 'bg-slate-600 text-[#fff]' : 'bg-[#20c58f] text-[#04281c]'}`}>
                      {valtIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-400">
                        Stopp {valtIndex + 1} av {stopp.length}
                        {valt.avslutad ? ', klart' : vald === 'idag' && valt.nyckel === standard?.nyckel ? ', nästa' : ''}
                        {vald === 'idag' && !valt.avslutad && tidTill(valt.start) ? `, ${tidTill(valt.start)}` : ''}
                      </p>
                      <h2 className="text-lg font-semibold text-white">{valt.kund}</h2>
                      <p className="text-[15px] text-slate-400">{valt.adress || 'Adress saknas i ärendet'}</p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                        <span className="font-mono font-semibold">{klockslag(valt.start)}</span>
                        <Icon name={TYP_IKON[valt.typ]} size={16} className="text-slate-400" />
                        {besokBeskrivning(valt)}
                      </p>
                      {valt.adress && koordinater.get(valt.adress) === null && (
                        <p className="mt-1 text-[13px] text-amber-500">Adressen hittades inte på kartan.</p>
                      )}
                    </div>
                  </div>
                  <div data-genomgang="karta-knappar">
                    <BesokKnappar besok={valt} onOppna={() => setOppet({ kalla: valt.kalla, id: valt.id })} />
                  </div>
                </div>
              )}

              <ol data-genomgang="karta-lista" className="divide-y divide-slate-700/60 border-t border-slate-700/60">
                {stopp.map((b: DagBesok, i) => {
                  const arVald = valt?.nyckel === b.nyckel
                  return (
                    <li key={b.nyckel}>
                      <button
                        type="button"
                        onClick={() => setValdNyckel(b.nyckel)}
                        aria-current={arVald ? 'true' : undefined}
                        className={`w-full flex items-center gap-3 py-2.5 min-h-[52px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] rounded-lg ${arVald ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                      >
                        <span aria-hidden="true" className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                          b.avslutad ? 'bg-slate-700 text-slate-300' : arVald ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600'
                        }`}>
                          {b.avslutad ? <Icon name="allman.bock" size={16} /> : i + 1}
                        </span>
                        <span className="font-mono text-sm w-12 flex-shrink-0">{klockslag(b.start)}</span>
                        <span className="flex-1 min-w-0 truncate text-[15px]">{b.kund}</span>
                        <span className="text-[13px] text-slate-400 truncate max-w-[35%]">{besokBeskrivning(b)}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              {mapsKlar && utanMarkor.length > 0 && (
                <p className="text-[13px] text-slate-500">
                  {utanMarkor.length === 1 ? 'Ett stopp' : `${utanMarkor.length} stopp`} saknar plats på kartan eftersom adressen inte gick att hitta.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <OppnaArende arende={oppet} onClose={() => setOppet(null)} onSaved={ladda} />
      {!laddar && <Genomgang id="ny-karta" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />}
    </div>
  )
}
