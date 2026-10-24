// src/components/technician/ny/VisningInstallningar.tsx
// Teknikerns rader i gruppen Visning på Mitt konto (UserProfile). Raderna ritas inne i
// gruppens kort, under temavalet:
//  - Ny arbetsvy: bara om administratören gett teknikern rätt att byta
//    (profiles.tekniker_far_byta) och personen står i teknikervyn. Visas även när den
//    nya vyn är avstängd, så att teknikern själv kan slå på den igen.
//  - Visa hjälptexter, Visa genomgång och Visa genomgångarna igen: bara i nya arbetsvyn
//    (useNyArbetsvy().aktiv), eftersom de bara används där.
// Utan något av det renderas ingenting.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { useNyArbetsvy, useHjalpInstallningar } from '../../../hooks/useNyArbetsvy'
import { Icon, type IconName } from '../../icons/Icon'

export function Vaxel({ id, ikon, rubrik, text, pa, onChange, upptagen }: {
  id: string
  ikon?: IconName
  rubrik: string
  text: string
  pa: boolean
  onChange: (v: boolean) => void
  upptagen?: boolean
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-3">
      {ikon && <Icon name={ikon} size={24} className="text-slate-400 flex-shrink-0" />}
      <span className="min-w-0 flex-1">
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
        className="relative flex-shrink-0 -my-1.5 h-11 w-14 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] disabled:opacity-60"
      >
        <span aria-hidden="true" className={`relative block w-12 h-7 rounded-full transition-colors ${pa ? 'bg-[#20c58f]' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-[#fff] shadow transition-all ${pa ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>
    </div>
  )
}

export default function VisningInstallningar() {
  const { activeView } = useAuth()
  const { aktiv, farByta } = useNyArbetsvy()
  const {
    visaHjalptexter, visaGenomgangar, setVisaHjalptexter, setVisaGenomgangar, aterstallGenomgangar, setNyArbetsvy,
  } = useHjalpInstallningar()
  const [upptagen, setUpptagen] = useState(false)

  const visaVaxlare = farByta && activeView === 'technician'
  if (!aktiv && !visaVaxlare) return null

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
    <div className="divide-y divide-slate-700/60">
      {visaVaxlare && (
        <Vaxel
          id="vx-arbetsvy"
          ikon="falt.idag"
          rubrik="Ny arbetsvy"
          text={aktiv
            ? 'Den nya startsidan, kartan och ärendelistan. Samma uppgifter sparas som förut, bara visat på ett nytt sätt. Stänger du av kommer du tillbaka till den gamla vyn direkt.'
            : 'Slå på för den nya startsidan, kartan och ärendelistan. Samma uppgifter sparas som förut, bara visat på ett nytt sätt.'}
          pa={aktiv}
          upptagen={upptagen}
          onChange={v => kor(() => setNyArbetsvy(v))}
        />
      )}

      {aktiv && (
        <>
          <Vaxel
            id="vx-hjalp"
            ikon="konto.hjalptext"
            rubrik="Visa hjälptexter"
            text="Förklaringen under rubrikerna. Avstängt ser du rubriken och en (i)-knapp som visar texten."
            pa={visaHjalptexter}
            upptagen={upptagen}
            onChange={v => kor(() => setVisaHjalptexter(v))}
          />
          <Vaxel
            id="vx-genomgang"
            ikon="guide.visning"
            rubrik="Visa genomgång första gången jag öppnar en ny sida"
            text="En kort rundtur som pekar ut det viktigaste. Den visas en gång per sida."
            pa={visaGenomgangar}
            upptagen={upptagen}
            onChange={v => kor(() => setVisaGenomgangar(v))}
          />
          <div className="px-3 py-3">
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
        </>
      )}
    </div>
  )
}
