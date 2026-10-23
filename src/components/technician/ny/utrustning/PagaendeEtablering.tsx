// src/components/technician/ny/utrustning/PagaendeEtablering.tsx
// Rutan Pågående etablering överst på Utrustning: teknikerns öppna
// etableringsärenden som har startat (bokade idag eller tidigare, eller där
// arbetet är påbörjat). Visar avtalets antal mot placerade avtalsstationer
// ("18 av 24 stationer placerade", avtaletsStationer.ts) och, när avtalets
// antal saknas, antal placerade sedan ärendet öppnades (samma räkning som
// avslutsspärren). Knapparna Placera station och Avsluta etablering.
//
// Avsluta etablering frågar först (AvslutaEtablering.tsx) och går sedan samma
// väg som gamla sidans knapp (useEtableringsflode.finishEstablishment).
// Rutan stänger aldrig något själv. När alla stationer är ute är Avsluta
// etablering primär och Placera station sekundär.

import { Link } from 'react-router-dom'
import { Icon } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import { avslutsLage, useAvslutaEtablering } from './AvslutaEtablering'
import type { PagaendeEtableringRad } from './usePagaendeEtableringar'
import { KNAPP_PRIMAR, KNAPP_SEKUNDAR, KORT, IKONKNAPP, datum } from './utrustningUi'

interface Props {
  rader: PagaendeEtableringRad[]
  onPlacera: (customerId: string) => void
  onFardig: (customerId: string, kund: string) => void | Promise<void>
  /** Kund vars avslut pågår, knappen visar att den arbetar */
  avslutar?: string | null
}

function placeradeText(r: PagaendeEtableringRad): string {
  const lage = avslutsLage(r)
  if (lage.avtalat !== null && lage.placerade !== null) return `${lage.placerade} av ${lage.avtalat} stationer placerade`
  if (r.placerade === null) return 'Antalet kunde inte hämtas'
  if (r.placerade === 0) return 'Inga stationer placerade än'
  return `${r.placerade} ${r.placerade === 1 ? 'station' : 'stationer'} placerade sedan start`
}

function punktFarg(r: PagaendeEtableringRad): string {
  const lage = avslutsLage(r)
  if (lage.avtalat !== null && lage.placerade !== null) {
    if (lage.klar) return 'bg-[#20c58f]'
    return lage.placerade === 0 ? 'bg-amber-500' : 'bg-slate-500'
  }
  return r.placerade ? 'bg-[#20c58f]' : 'bg-amber-500'
}

/** "Betongstation 12 av 16, Mekanisk fälla 6 av 8", tilläggen, eller att antalet saknas */
function underrad(r: PagaendeEtableringRad): string | null {
  const a = r.avtal
  if (!a) return null
  if (a.avtalat === null) return 'Avtalets antal saknas'
  const delar = a.perTyp.length > 1 ? a.perTyp.map(t => `${t.namn} ${t.placerade ?? 0} av ${t.avtalat}`) : []
  if (a.tillagg > 0) delar.push(`${a.tillagg} ${a.tillagg === 1 ? 'tilläggsstation' : 'tilläggsstationer'} utöver avtalet`)
  return delar.length > 0 ? delar.join(', ') : null
}

export function PagaendeEtablering({ rader, onPlacera, onFardig, avslutar }: Props) {
  const avsluta = useAvslutaEtablering(onFardig)
  if (rader.length === 0) return null
  return (
    <section aria-labelledby="hjalp-utr-etablering-rubrik" data-genomgang="utr-etablering" className="space-y-2">
      {avsluta.dialog}
      <HjalpText id="utr-etablering" rubrik={rader.length === 1 ? 'Pågående etablering' : `Pågående etableringar, ${rader.length}`} ikon="bokning.etablering">
        Placera stationerna och tryck Avsluta etablering när du är klar. Då stängs ärendet och tilläggsstationer faktureras.
      </HjalpText>
      <div className="space-y-3">
        {rader.map(r => {
          const klar = avslutsLage(r).klar
          const under = underrad(r)
          return (
          <article key={r.caseId} className={`${KORT} p-4 space-y-3 border-[#20c58f]/40`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-white leading-snug">{r.kund}</h3>
                {r.adress && <p className="text-[15px] text-slate-400 truncate">{r.adress}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <span aria-hidden="true" className={`w-2 h-2 rounded-full ${punktFarg(r)}`} />
                    {placeradeText(r)}
                  </span>
                  {r.bokad && <span>Bokad {datum(r.bokad)}</span>}
                </p>
                {under && <p className={`mt-0.5 text-[13px] ${r.avtal?.avtalat === null ? 'text-slate-500' : 'text-slate-400'}`}>{under}</p>}
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
              <button type="button" onClick={() => onPlacera(r.customerId)} className={klar ? KNAPP_SEKUNDAR : KNAPP_PRIMAR}>
                <Icon name="utrustning.placera" size={20} />
                Placera station
              </button>
              <button
                type="button"
                onClick={() => avsluta.fraga(r)}
                disabled={avslutar === r.customerId}
                className={`${klar ? KNAPP_PRIMAR : KNAPP_SEKUNDAR} disabled:opacity-60`}
                aria-label={`Avsluta etableringen hos ${r.kund}`}
              >
                <Icon name={avslutar === r.customerId ? 'allman.laddar' : 'station.klar'} size={20} className={avslutar === r.customerId ? 'animate-spin' : ''} />
                Avsluta etablering
              </button>
            </div>
          </article>
          )
        })}
      </div>
    </section>
  )
}

export default PagaendeEtablering
