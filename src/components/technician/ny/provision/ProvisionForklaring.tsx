// src/components/technician/ny/provision/ProvisionForklaring.tsx
// Hopfällbar förklaring på provisionssidan: hur provisionen räknas, när den
// betalas ut och vad statusarna betyder. Texterna följer koden:
//   - procent och lägsta belopp läses ur commission_settings (ProvisionService.getSettings)
//   - beräkningen i ProvisionService.calculateCommission / validatePostInput
//   - utbetalningsmånaden i DB-funktionen compute_payout_month, speglad av
//     computePreliminaryPayoutMonth i utils/provisionPayout

import { useState } from 'react'
import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import type { CommissionSettings } from '../../../../types/provision'
import { STATUS_FORKLARING, kr, procent, utbetalningsRegel } from './provisionData'

interface Props {
  settings: CommissionSettings | null
  cutoff: number
  nu: Date
  /** Öppen från början, till exempel i tomt läge */
  oppenFranBorjan?: boolean
}

export function ProvisionForklaring({ settings, cutoff, nu, oppenFranBorjan = false }: Props) {
  const [oppen, setOppen] = useState(oppenFranBorjan)
  const pct = settings ? procent(settings.engangsjobb_percentage) : null
  const min = settings ? kr(settings.min_commission_base) : null

  return (
    <section aria-label="Så fungerar provisionen" className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOppen(v => !v)}
        aria-expanded={oppen}
        aria-controls="provision-forklaring"
        className="w-full flex items-center gap-3 px-3 min-h-[56px] text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
      >
        <Icon name="provision.procent" size={20} className="text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-[15px] font-medium text-white">Så räknas och betalas provisionen</span>
        <Icon name="allman.chevron" size={16} className={`text-slate-500 transition-transform ${oppen ? 'rotate-90' : ''}`} />
      </button>

      {oppen && (
        <div id="provision-forklaring" className="px-4 pb-4 pt-1 space-y-5 text-sm text-slate-300 leading-relaxed">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Så räknas den</h3>
            <ul className="space-y-1.5 list-disc pl-5 marker:text-slate-600">
              <li>
                Provision registreras när ett ärende avslutas, om ärendet är markerat som provisionsgrundande och du har en andel i det.
              </li>
              <li>
                Du får {pct ?? 'den fastställda procentsatsen'} av ärendets pris exklusive moms.
                {pct && ' Procentsatsen sparas på varje post när den skapas, så en senare ändring påverkar inte poster du redan har.'}
              </li>
              <li>
                Ärendet måste vara värt minst {min ?? 'det lägsta beloppet'} exklusive moms, annars blir det ingen provision.
              </li>
              <li>Vid ROT eller RUT räknas provisionen på priset före avdraget.</li>
              <li>Kostnader för underentreprenörer dras av innan procenten räknas.</li>
              <li>Är ni flera på ärendet delas provisionen efter era andelar, till exempel hälften var.</li>
              <li>Har ärendet flera besök delas provisionen upp på besöken efter vad varje besök drog in.</li>
              <li>På avtalskunder räknas provisionen på det som faktureras utöver avtalet. Etableringar ger ingen provision.</li>
              <li>När kunden har betalat är posten låst och räknas inte om.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">När den betalas ut</h3>
            <p>{utbetalningsRegel(cutoff, nu)}</p>
            <p className="text-slate-400">
              Så länge kunden inte har betalat visas posten preliminärt på den lön den skulle komma med om kunden betalade idag.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Vad statusarna betyder</h3>
            <dl className="space-y-2.5">
              {STATUS_FORKLARING.map(s => (
                <div key={s.status}>
                  <dt><StatusPunkt ton={s.ton}>{s.rubrik}</StatusPunkt></dt>
                  <dd className="mt-0.5 pl-3.5 text-slate-400">{s.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  )
}

export default ProvisionForklaring
