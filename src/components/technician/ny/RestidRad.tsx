// src/components/technician/ny/RestidRad.tsx
// Restid till ett stopp med källrad: "Ca 12 min med bil härifrån" och "Från bilen, position 10:41".
// Visar ingenting när restiden inte gick att räkna, så att det aldrig står en falsk siffra.

import { Icon } from '../../icons/Icon'
import { klockslag } from '../../../services/teknikerDagService'
import { restidText, type MinPosition, type Restid } from '../../../services/restidService'

function kallText(p: MinPosition): string {
  if (p.kalla === 'telefon') return 'Från telefonen'
  const tid = p.tidpunkt.getTime() > 0 ? klockslag(p.tidpunkt) : ''
  return tid ? `Från bilen, position ${tid}` : 'Från bilen'
}

export function RestidRad({ restid, position }: { restid: Restid | null; position: MinPosition | null }) {
  if (!restid || !position) return null
  return (
    <div className="flex items-start gap-2">
      <Icon name="falt.bil" size={20} className="text-[#20c58f] flex-shrink-0 mt-px" />
      <p className="min-w-0">
        <span className="block text-[15px] font-medium text-white">{restidText(restid)}</span>
        <span className="block text-[13px] text-slate-400">{kallText(position)}</span>
      </p>
    </div>
  )
}
