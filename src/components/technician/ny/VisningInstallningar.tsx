// src/components/technician/ny/VisningInstallningar.tsx
// Sektionen Visning överst på Mitt konto. Visas BARA i nya arbetsvyn
// (useNyArbetsvy().aktiv), annars renderas ingenting och sidan är som förut.
//
// Ny arbetsvy-växeln visas bara om administratören gett teknikern rätt att byta
// (profiles.tekniker_far_byta). Stängs den av gäller gamla vyn direkt.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNyArbetsvy, useHjalpInstallningar } from '../../../hooks/useNyArbetsvy'
import { Icon } from '../../icons/Icon'

function Vaxel({ id, rubrik, text, pa, onChange, upptagen }: {
  id: string
  rubrik: string
  text: string
  pa: boolean
  onChange: (v: boolean) => void
  upptagen?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span id={`${id}-rubrik`} className="block text-[15px] font-medium text-white">{rubrik}</span>
        <span id={`${id}-text`} className="block text-sm text-slate-400 mt-0.5">{text}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={pa}
        aria-labelledby={`${id}-rubrik`}
        aria-describedby={`${id}-text`}
        disabled={upptagen}
        onClick={() => onChange(!pa)}
        className={`relative flex-shrink-0 w-12 h-7 mt-0.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f] disabled:opacity-60 ${pa ? 'bg-[#20c58f]' : 'bg-slate-600'}`}
      >
        <span aria-hidden="true" className={`absolute top-0.5 w-6 h-6 rounded-full bg-[#fff] shadow transition-all ${pa ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

export default function VisningInstallningar() {
  const { aktiv, farByta } = useNyArbetsvy()
  const {
    visaHjalptexter, visaGenomgangar, setVisaHjalptexter, setVisaGenomgangar, aterstallGenomgangar, setNyArbetsvy,
  } = useHjalpInstallningar()
  const [upptagen, setUpptagen] = useState(false)

  if (!aktiv) return null

  const kor = async (fn: () => Promise<void>, klart?: string) => {
    setUpptagen(true)
    try {
      await fn()
      if (klart) toast.success(klart)
    } catch {
      /* hooken visar felet */
    } finally {
      setUpptagen(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 lg:pt-6">
      <section id="visning" aria-labelledby="visning-rubrik" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4">
        <h2 id="visning-rubrik" className="text-lg font-semibold text-white">Visning</h2>

        {farByta && (
          <div className="border-b border-slate-700/60">
            <Vaxel
              id="vx-arbetsvy"
              rubrik="Ny arbetsvy"
              text="Den nya startsidan, kartan och ärendelistan. Samma uppgifter sparas som förut, bara visat på ett nytt sätt. Stänger du av kommer du tillbaka till den gamla vyn direkt."
              pa={aktiv}
              upptagen={upptagen}
              onChange={v => kor(() => setNyArbetsvy(v))}
            />
          </div>
        )}

        <div className="divide-y divide-slate-700/60">
          <Vaxel
            id="vx-hjalp"
            rubrik="Visa hjälptexter"
            text="Förklaringen under rubrikerna. Avstängt ser du rubriken och en (i)-knapp som visar texten."
            pa={visaHjalptexter}
            upptagen={upptagen}
            onChange={v => kor(() => setVisaHjalptexter(v))}
          />
          <Vaxel
            id="vx-genomgang"
            rubrik="Visa genomgång första gången jag öppnar en ny sida"
            text="En kort rundtur som pekar ut det viktigaste. Den visas en gång per sida."
            pa={visaGenomgangar}
            upptagen={upptagen}
            onChange={v => kor(() => setVisaGenomgangar(v))}
          />
          <div className="pt-3">
            <button
              type="button"
              disabled={upptagen}
              onClick={() => kor(aterstallGenomgangar, 'Genomgångarna visas igen')}
              className="h-11 px-4 inline-flex items-center gap-2 rounded-xl border border-slate-600 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <Icon name="allman.aterstall" size={20} />
              Visa genomgångarna igen
            </button>
            <p className="mt-1.5 text-sm text-slate-400">Alla genomgångar visas på nytt nästa gång du öppnar sidorna.</p>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm text-slate-400">
          <Icon name="kund.info" size={16} className="mt-0.5 flex-shrink-0" />
          Valen sparas på ditt konto, inte bara i telefonen.
        </p>
      </section>
    </div>
  )
}
