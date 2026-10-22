// src/components/technician/ny/utrustning/PagaendeEtablering.tsx
// Rutan Pågående etablering överst på Utrustning: teknikerns öppna
// etableringsärenden som har startat (bokade idag eller tidigare, eller där
// arbetet är påbörjat). Visar antal stationer placerade sedan ärendet öppnades
// (samma räkning som avslutsspärren, AddonStationBillingService.countStationsPlacedSince)
// och knapparna Placera station och Färdig med etablering.
//
// Färdig med etablering går samma väg som gamla sidans knapp
// (useEtableringsflode.finishEstablishment). Rutan stänger aldrig något själv.

import { Link } from 'react-router-dom'
import { Icon } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import type { PagaendeEtableringRad } from './usePagaendeEtableringar'
import { KNAPP_PRIMAR, KNAPP_SEKUNDAR, KORT, IKONKNAPP, datum } from './utrustningUi'

interface Props {
  rader: PagaendeEtableringRad[]
  onPlacera: (customerId: string) => void
  onFardig: (customerId: string, kund: string) => void
  /** Kund vars avslut pågår, knappen visar att den arbetar */
  avslutar?: string | null
}

export function PagaendeEtablering({ rader, onPlacera, onFardig, avslutar }: Props) {
  if (rader.length === 0) return null
  return (
    <section aria-labelledby="hjalp-utr-etablering-rubrik" data-genomgang="utr-etablering" className="space-y-2">
      <HjalpText id="utr-etablering" rubrik={rader.length === 1 ? 'Pågående etablering' : `Pågående etableringar, ${rader.length}`} ikon="bokning.etablering">
        Placera stationerna och tryck Färdig med etablering när du är klar. Då stängs ärendet och tillägg skickas till fakturering.
      </HjalpText>
      <div className="space-y-3">
        {rader.map(r => (
          <article key={r.caseId} className={`${KORT} p-4 space-y-3 border-[#20c58f]/40`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-white leading-snug">{r.kund}</h3>
                {r.adress && <p className="text-[15px] text-slate-400 truncate">{r.adress}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <span aria-hidden="true" className={`w-2 h-2 rounded-full ${r.placerade ? 'bg-[#20c58f]' : 'bg-amber-500'}`} />
                    {r.placerade === null
                      ? 'Antalet kunde inte hämtas'
                      : r.placerade === 0
                        ? 'Inga stationer placerade än'
                        : `${r.placerade} ${r.placerade === 1 ? 'station' : 'stationer'} placerade sedan start`}
                  </span>
                  {r.bokad && <span>Bokad {datum(r.bokad)}</span>}
                </p>
              </div>
              <Link
                to={`/technician/equipment/customer/${r.customerId}`}
                className={IKONKNAPP}
                aria-label={`Visa stationerna hos ${r.kund}`}
                title="Kundens stationer"
              >
                <Icon name="allman.chevron" size={20} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button type="button" onClick={() => onPlacera(r.customerId)} className={KNAPP_PRIMAR}>
                <Icon name="utrustning.placera" size={20} />
                Placera station
              </button>
              <button
                type="button"
                onClick={() => onFardig(r.customerId, r.kund)}
                disabled={avslutar === r.customerId}
                className={`${KNAPP_SEKUNDAR} disabled:opacity-60`}
              >
                <Icon name={avslutar === r.customerId ? 'allman.laddar' : 'station.klar'} size={20} className={avslutar === r.customerId ? 'animate-spin' : ''} />
                Färdig med etablering
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default PagaendeEtablering
