// src/pages/technician/ny/NyMinKundresa.tsx
// Min kundresa i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
// Gamla sidan pages/technician/TechnicianCustomerJourney.tsx är orörd och gäller alla andra.
//
// Vad som händer med offerterna och avtalen teknikern skickar: Skickad, Signerad, Förföll,
// Raderades och Väntar på svar, räknat på teknikerns egna dokument via RPC:n min_kundresa
// (security definer, bara egna dokument, utan arkiverat). Öppnad och Tackade nej visas
// inte, efter signeringen mäts bara Bokad (booked_case_id). Se kundresa/kundresaData.ts.
//
// Perioderna är rullande 30, 90 eller 365 dagar i svensk tid och jämförs bara mot
// teknikerns egen föregående period, aldrig mot kollegor. Ligger perioden före helt före
// arkivgränsen 2026-05-01 visas ingen jämförelse.
//
// Ett ark med hårfina avdelare, inga KPI-kort: integritetsraden, växlarna, flödet med
// tabellvy, Vad siffrorna säger, Just nu i din resa och Tid i varje steg, Så räknas siffrorna.

import { useCallback, useMemo, useState } from 'react'
import { Icon } from '../../../components/icons/Icon'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { useArDator } from '../../../components/technician/ny/arenden/useArDator'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { Vaxel } from '../../../components/technician/ny/utrustning/Vaxel'
import { svTid } from '../../../components/technician/ny/dokument/dokumentData'
import { FlodeTabell, FlodeTeckenforklaring, KundresaFlode } from '../../../components/technician/ny/kundresa/KundresaFlode'
import { Insikter, Integritet, JustNu, PeriodVal, Rubrik, SaRaknas, TidISteg } from '../../../components/technician/ny/kundresa/KundresaDelar'
import {
  ARKIVGRANS, iPeriod, insikter as raknaInsikter, justNu, pct, perioder, raknaFlode, typOrd,
  useMinKundresa, utanJamforelse, type DokTyp, type PeriodDagar,
} from '../../../components/technician/ny/kundresa/kundresaData'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Offerter eller avtal', text: 'Välj vilka dokument du vill se och hur lång period. Perioden är rullande, till exempel de senaste 90 dagarna.', mal: 'kundresa-val' },
  { rubrik: 'Flödet', text: 'Bandet smalnar av i takt med att dokumenten går vidare. Grönt signerades, grått föll bort och streckat väntar fortfarande på svar. Peka eller tabba till en del för att se antal och andel.', mal: 'kundresa-flode' },
  { rubrik: 'Vad siffrorna säger', text: 'Några meningar om din period jämfört med din egen period före. Aldrig mot kollegor.', mal: 'kundresa-insikter' },
  { rubrik: 'Just nu', text: 'Det som väntar på svar, nyss förföll eller nyss signerades. Tryck på en rad för att öppna dokumentet i Dokumentsignering.', mal: 'kundresa-justnu' },
  { rubrik: 'Så räknas siffrorna', text: 'Här står varifrån siffrorna kommer och varför vissa steg inte syns än.', mal: 'kundresa-berakning' },
]

const ANDEL_MIN = 5

export default function NyMinKundresa() {
  const arDator = useArDator()
  const [typ, setTyp] = useState<DokTyp>('offer')
  const [dagar, setDagar] = useState<PeriodDagar>(90)
  const [visaMig, setVisaMig] = useState(false)
  const { dok, laddar, fel, ladda, hamtad } = useMinKundresa(typ)

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: 'Vad som händer med offerterna och avtalen du skickar', onVisaMig: oppnaVisaMig })

  const per = useMemo(() => perioder(dagar), [dagar])
  const nuDok = useMemo(() => dok.filter(d => iPeriod(d, per.nu)), [dok, per])
  const foreDok = useMemo(() => dok.filter(d => iPeriod(d, per.fore)), [dok, per])
  const nu = useMemo(() => raknaFlode(nuDok), [nuDok])
  const fore = useMemo(() => raknaFlode(foreDok), [foreDok])
  const harFore = per.jamforelse !== 'ingen'
  const meningar = useMemo(() => raknaInsikter(typ, nu, fore, per), [typ, nu, fore, per])
  const utan = useMemo(() => utanJamforelse(nu, fore, per), [nu, fore, per])
  const rader = useMemo(() => justNu(dok), [dok])

  const franNu = per.nuDelvis ? ARKIVGRANS : per.nu.fran
  const franFore = per.jamforelse === 'delvis' ? ARKIVGRANS : per.fore.fran
  const foreIntervall = `${franFore} till ${per.fore.till}`
  const periodText = `${franNu} till ${per.nu.till}`
  const ord = (n: number) => typOrd(typ, n)

  const sammanfattning = (() => {
    if (nu.skickade === 0) return null
    const delar: string[] = [`${nu.signerade} signerades`]
    if (nu.vantar > 0) delar.push(`${nu.vantar} väntar fortfarande på svar`)
    const bort = nu.forfoll + nu.raderades + nu.annat
    if (bort > 0) delar.push(`${bort} gick inte vidare`)
    const sista = delar.pop() as string
    return `Du skickade ${nu.skickade} ${ord(nu.skickade)}. ${delar.length ? `${delar.join(', ')} och ${sista}` : sista}.`
  })()

  const sektion = 'pt-6 lg:pt-7 border-t border-slate-700/60'

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        <article aria-label="Min kundresa" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 lg:p-7 space-y-6 lg:space-y-7">
          <Integritet />

          {/* Växlarna */}
          <div className={`${sektion} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`} data-genomgang="kundresa-val">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Vaxel<DokTyp>
                etikett="Dokumenttyp"
                valt={typ}
                onVal={setTyp}
                className="sm:w-[260px]"
                val={[
                  { varde: 'offer', text: 'Offerter', ikon: 'dok.offert' },
                  { varde: 'contract', text: 'Avtal', ikon: 'dok.avtal' },
                ]}
              />
              <div className="sm:w-[300px]"><PeriodVal valt={dagar} onVal={setDagar} /></div>
            </div>
            <div className="flex items-center gap-2 justify-between lg:justify-end">
              <p className="text-sm text-slate-400">
                <span className="font-mono">{periodText}</span>
                {harFore
                  ? <>, jämförs med <span className="font-mono">{foreIntervall}</span></>
                  : ', ingen jämförelse än'}
              </p>
              <span className="flex items-center gap-1 flex-shrink-0">
                {hamtad && <span className="hidden sm:inline text-sm text-slate-500">Uppdaterad {svTid(hamtad.toISOString())}</span>}
                <button
                  type="button"
                  onClick={() => void ladda()}
                  disabled={laddar}
                  aria-label="Uppdatera"
                  title="Uppdatera"
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                >
                  <Icon name="utrustning.uppdatera" size={20} className={laddar ? 'animate-spin' : ''} />
                </button>
              </span>
            </div>
          </div>

          {fel ? (
            <div className={sektion}>
              <p className="font-medium text-white">Siffrorna kunde inte hämtas</p>
              <p className="mt-1 text-sm text-slate-400">{fel}</p>
              <button type="button" onClick={() => void ladda()} className="mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
                Försök igen
              </button>
            </div>
          ) : laddar && dok.length === 0 ? (
            <div className={`${sektion} py-12 flex justify-center`}><LoadingSpinner text="Hämtar din kundresa..." /></div>
          ) : (
            <>
              {/* Flödet */}
              <section aria-labelledby="kr-flode" className={`${sektion} space-y-4`} data-genomgang="kundresa-flode">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-1">
                    <Rubrik id="kr-flode" ikon="lead.nasta-steg" farg="text-[#20c58f]" text={`Din kundresa, ${typ === 'offer' ? 'offerter' : 'avtal'}`} />
                    <p id="kr-flode-sammanfattning" className="text-[15px] leading-relaxed text-slate-300">
                      {sammanfattning ?? `Du har inte skickat några ${typ === 'offer' ? 'offerter' : 'avtal'} under perioden.`}
                    </p>
                  </div>
                  {nu.skickade > 0 && <FlodeTeckenforklaring bokade={nu.bokade > 0} />}
                </div>
                {nu.skickade > 0 ? (
                  <>
                    <div aria-describedby="kr-flode-sammanfattning" className="pt-2">
                      <KundresaFlode
                        flode={nu}
                        typ={typ}
                        lodratt={!arDator}
                        foreSkickade={harFore ? fore.skickade : null}
                        foreAndel={harFore && fore.skickade >= ANDEL_MIN ? pct(fore.signerade, fore.skickade) : null}
                      />
                    </div>
                    <FlodeTabell flode={nu} foreSkickade={harFore ? fore.skickade : null} />
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    Flödet visas när du har skickat {typ === 'offer' ? 'en offert' : 'ett avtal'} från portalen. Prova en längre period, eller byt till {typ === 'offer' ? 'Avtal' : 'Offerter'}.
                  </p>
                )}
              </section>

              {nu.skickade > 0 && (
                <div className={sektion}>
                  <Insikter
                    insikter={meningar}
                    utan={utan}
                    foreText={utan ? null : `Jämfört med din egen period ${foreIntervall}`}
                  />
                </div>
              )}

              <div className={`${sektion} grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start`}>
                <JustNu rader={rader} typ={typ} />
                <TidISteg nu={nu} fore={harFore ? fore : null} />
              </div>

              <div className={sektion}>
                <SaRaknas />
              </div>
            </>
          )}
        </article>
      </div>
      {!laddar && <Genomgang id="ny-min-kundresa" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />}
    </>
  )
}
