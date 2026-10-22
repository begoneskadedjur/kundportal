// src/components/technician/ny/hjalp/HjalpText.tsx
// Rubrik med förklaringstext i nya arbetsvyn.
//
// Användning:
//   <HjalpText id="idag-nasta" rubrik="Nästa uppdrag">
//     Tryck på Navigera för vägbeskrivning. Ring ringer kontaktpersonen.
//   </HjalpText>
//
// Med "Visa hjälptexter" påslaget (Mitt konto, standard för alla) visas rubriken med
// texten under. Avslaget visas rubriken och en (i)-knapp på 44 px som fäller ut texten.
// Valet följer kontot (profiles.visa_hjalptexter), inte telefonen.
//
// Props:
//   id          unik nyckel, kopplar knappen till texten för skärmläsare
//   rubrik      rubriken som texten förklarar
//   niva        'h2' (standard) eller 'h3'
//   ikon        valfri ikon före rubriken (namn ur Icon.tsx)
//   utanRubrik  visar bara texten och knappen, rubriken används då bara i knappens etikett
//   hoger       valfritt innehåll till höger om rubriken, till exempel en länk
//   children    själva förklaringen, kort och i klartext

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { useHjalpInstallningar } from '../../../../hooks/useNyArbetsvy'

interface Props {
  id: string
  rubrik: string
  niva?: 'h2' | 'h3'
  ikon?: IconName
  utanRubrik?: boolean
  hoger?: ReactNode
  className?: string
  children: ReactNode
}

export function HjalpText({ id, rubrik, niva = 'h2', ikon, utanRubrik = false, hoger, className = '', children }: Props) {
  const { visaHjalptexter } = useHjalpInstallningar()
  const [oppen, setOppen] = useState(false)
  const textId = `hjalp-${id}`
  const rubrikId = `hjalp-${id}-rubrik`
  const visaText = visaHjalptexter || oppen
  const Rubrik = niva

  const knapp = !visaHjalptexter && (
    <button
      type="button"
      onClick={() => setOppen(v => !v)}
      aria-expanded={oppen}
      aria-controls={textId}
      aria-label={oppen ? `Dölj förklaringen till ${rubrik}` : `Visa förklaringen till ${rubrik}`}
      className={`w-11 h-11 -my-2 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
        oppen ? 'text-[#20c58f]' : 'text-slate-500 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon name="kund.info" size={20} />
    </button>
  )

  return (
    <div className={className}>
      {utanRubrik ? (
        knapp && <div className="flex justify-end">{knapp}</div>
      ) : (
        <div className="flex items-center justify-between gap-2 min-h-[28px]">
          <div className="flex items-center gap-1 min-w-0">
            <Rubrik id={rubrikId} className={`flex items-center gap-2 font-semibold text-white ${niva === 'h2' ? 'text-[15px]' : 'text-sm'}`}>
              {ikon && <Icon name={ikon} size={20} className="text-slate-400" />}
              {rubrik}
            </Rubrik>
            {knapp}
          </div>
          {hoger}
        </div>
      )}
      {visaText && (
        <p id={textId} className="mt-1 text-sm text-slate-400 leading-relaxed">{children}</p>
      )}
    </div>
  )
}

export default HjalpText
