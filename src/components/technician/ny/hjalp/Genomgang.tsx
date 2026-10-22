// src/components/technician/ny/hjalp/Genomgang.tsx
// Kort rundtur (coach) med numrerade steg i nya arbetsvyn.
//
// Användning:
//   const [visaMig, setVisaMig] = useState(false)
//   <Genomgang
//     id="idag"
//     steg={[
//       { rubrik: 'Så tar du dig till nästa kund', text: 'Tryck på Navigera ...', mal: 'idag-knappar' },
//       { rubrik: 'Att göra', text: 'Det som väntar på dig.', mal: 'idag-attgora' },
//     ]}
//     tvinga={visaMig}
//     onStang={() => setVisaMig(false)}
//   />
//   ...
//   <div data-genomgang="idag-knappar">...</div>
//
// Regler:
//  - Visas av sig själv en gång per id, om "Visa genomgångar" är påslaget på kontot
//    (profiles.visa_genomgangar). När den stängs (Hoppa över eller sista Klar) sparas
//    id:t i profiles.sedda_genomgangar via markeraGenomgangSedd.
//  - tvinga=true visar den oavsett inställning, till exempel från knappen Visa mig hur.
//  - mal pekar på ett element med data-genomgang="<mal>". Elementet scrollas fram och
//    ramas in. Saknas målet visas steget ändå, utan ram.
//  - guide: valfri länk längst ner, till exempel till guiden för sidan.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHjalpInstallningar } from '../../../../hooks/useNyArbetsvy'
import { Icon } from '../../../icons/Icon'

export interface GenomgangSteg {
  rubrik: string
  text: string
  /** Värdet i data-genomgang på elementet som steget pekar på */
  mal?: string
}

interface Props {
  id: string
  steg: GenomgangSteg[]
  tvinga?: boolean
  onStang?: () => void
  guide?: { text: string; to: string }
}

interface Ram { top: number; left: number; width: number; height: number }

/** Första synliga elementet med data-genomgang="<mal>" (samma mål kan finnas i telefon- och datorläget) */
function hittaMal(mal: string | undefined): Element | null {
  if (!mal) return null
  const alla = Array.from(document.querySelectorAll(`[data-genomgang="${mal}"]`))
  return alla.find(el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }) ?? null
}

export function Genomgang({ id, steg, tvinga = false, onStang, guide }: Props) {
  const { visaGenomgangar, harSettGenomgang, markeraGenomgangSedd } = useHjalpInstallningar()
  const [index, setIndex] = useState(0)
  const [stangdNu, setStangdNu] = useState(false)
  const [ram, setRam] = useState<Ram | null>(null)

  const automatisk = visaGenomgangar && !harSettGenomgang(id) && !stangdNu
  const synlig = steg.length > 0 && (tvinga || automatisk)
  const aktuellt = steg[Math.min(index, steg.length - 1)]

  // Börja om från steg 1 varje gång den öppnas
  useEffect(() => {
    if (synlig) setIndex(0)
  }, [synlig])

  const mat = useCallback(() => {
    const el = hittaMal(aktuellt?.mal)
    if (!el) { setRam(null); return }
    const r = el.getBoundingClientRect()
    setRam({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
  }, [aktuellt?.mal])

  useLayoutEffect(() => {
    if (!synlig) return
    const el = hittaMal(aktuellt?.mal)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = window.setTimeout(mat, 350)
    mat()
    window.addEventListener('resize', mat)
    window.addEventListener('scroll', mat, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', mat)
      window.removeEventListener('scroll', mat, true)
    }
  }, [synlig, aktuellt?.mal, mat])

  const stang = useCallback(() => {
    setStangdNu(true)
    onStang?.()
    markeraGenomgangSedd(id).catch(() => { /* toast visas av hooken */ })
  }, [id, markeraGenomgangSedd, onStang])

  useEffect(() => {
    if (!synlig) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') stang() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [synlig, stang])

  if (!synlig || !aktuellt) return null

  const sista = index >= steg.length - 1
  const nasta = steg[index + 1]

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Mörkt lager, med hål runt målet om det finns */}
      {ram ? (
        <div
          aria-hidden="true"
          className="fixed rounded-2xl ring-2 ring-[#20c58f] pointer-events-none transition-all duration-200"
          style={{ top: ram.top, left: ram.left, width: ram.width, height: ram.height, boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.6)' }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-slate-950/60" />
      )}

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`genomgang-${id}-rubrik`}
        className="fixed inset-x-3 bottom-3 lg:left-auto lg:right-6 lg:bottom-6 lg:w-[380px] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <p className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1.5 text-[#20c58f]">
            <Icon name="falt.visamig" size={16} />
            Visa mig hur
          </span>
          <span className="font-mono">{index + 1} av {steg.length}</span>
        </p>
        <h2 id={`genomgang-${id}-rubrik`} className="mt-2 text-lg font-semibold text-white">{aktuellt.rubrik}</h2>
        <p className="mt-1 text-[15px] text-slate-300 leading-relaxed">{aktuellt.text}</p>

        {steg.length > 1 && (
          <ol className="mt-3 space-y-1">
            {steg.map((s, i) => (
              <li key={i} className={`flex items-center gap-2 text-sm ${i === index ? 'text-white font-medium' : 'text-slate-500'}`}>
                <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                  i < index ? 'bg-[#20c58f] text-[#04281c]' : i === index ? 'border border-[#20c58f] text-[#20c58f]' : 'border border-slate-600 text-slate-500'
                }`}>
                  {i + 1}
                </span>
                {s.rubrik}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={stang}
            className="h-12 rounded-xl border border-slate-600 text-white font-medium hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            Hoppa över
          </button>
          <button
            type="button"
            onClick={() => (sista ? stang() : setIndex(i => i + 1))}
            className="h-12 rounded-xl bg-[#20c58f] text-[#04281c] font-semibold hover:bg-[#1bb07f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f] truncate px-2"
          >
            {sista ? 'Klar' : `Nästa: ${nasta?.rubrik ?? ''}`}
          </button>
        </div>

        {guide && (
          <Link
            to={guide.to}
            onClick={stang}
            className="mt-3 flex items-center justify-center min-h-[44px] text-sm font-medium text-[#20c58f] hover:underline"
          >
            {guide.text}
          </Link>
        )}
      </section>
    </div>
  )
}

export default Genomgang
