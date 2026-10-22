// src/pages/technician/ny/NyIdag.tsx
// Startsidan Idag i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
//
// Visar nästa uppdrag, det som väntar på teknikern, dagens rutt i tidsordning och
// morgondagen. Läser alla tre källor (cases, private_cases, business_cases) via
// teknikerDagService och räknar datum i svensk tid. Inga KPI-kort och ingen provision.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { BesokKnappar, StatusPunkt } from '../../../components/technician/ny/besokUi'
import { TYP_IKON } from '../../../components/technician/ny/besokTyp'
import { useAllaArenden } from '../../../hooks/useTeknikerBesok'
import { useNyArbetsvy, useHjalpInstallningar } from '../../../hooks/useNyArbetsvy'
import { useAuth } from '../../../contexts/AuthContext'
import {
  svenskDag, laggTillDagar, langtDatum, klockslag, tidTill, nastaBesok, besokBeskrivning,
  vantarPaDig, hamtaOffertLage, hamtaStationsantal, arAvtalsbesok,
  type DagBesok, type OffertLage,
} from '../../../services/teknikerDagService'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Navigera, Ring och Öppna', text: 'Tryck på Navigera så öppnas vägbeskrivningen i telefonens karta. Ring ringer kontaktpersonen och Öppna visar allt om ärendet.', mal: 'idag-nasta' },
  { rubrik: 'Att göra', text: 'Här står det som väntar på dig: offerter att följa upp, ärenden som ska bokas och besök som inte är avslutade.', mal: 'idag-attgora' },
  { rubrik: 'Skapa', text: 'Med plusknappen skapar du avtal, rapporter, tips om nya kunder och meddelanden till kontoret.', mal: 'skapa' },
  { rubrik: 'Frågetecknet finns på varje sida', text: 'Tryck på frågetecknet uppe till höger när du vill se den här genomgången igen.', mal: 'visamig' },
]

const DOLD_RAD_NYCKEL = 'begone_ny_arbetsvy_rad_dold'

function lasDold(): boolean {
  try { return sessionStorage.getItem(DOLD_RAD_NYCKEL) === '1' } catch { return false }
}
function sparaDold() {
  try { sessionStorage.setItem(DOLD_RAD_NYCKEL, '1') } catch { /* privat läge */ }
}

function TestarRad() {
  const { farByta } = useNyArbetsvy()
  const { setNyArbetsvy } = useHjalpInstallningar()
  const [dold, setDold] = useState(lasDold)
  const [byter, setByter] = useState(false)
  if (!farByta || dold) return null
  return (
    <div role="status" className="flex items-center gap-2 pl-4 min-h-[44px] bg-sky-500/10 border-b border-sky-500/30 text-[13px] text-sky-300">
      <span className="flex-1 min-w-0 truncate">Du testar nya arbetsvyn.</span>
      <button
        type="button"
        disabled={byter}
        onClick={async () => {
          setByter(true)
          try { await setNyArbetsvy(false) } catch { setByter(false) }
        }}
        className="min-h-[44px] px-1 font-semibold underline underline-offset-2 text-sky-400 hover:text-sky-300 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
      >
        Byt tillbaka
      </button>
      <button
        type="button"
        aria-label="Stäng raden om nya arbetsvyn"
        onClick={() => { sparaDold(); setDold(true) }}
        className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-sky-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
      >
        <Icon name="allman.stang" size={20} />
      </button>
    </div>
  )
}

function NastaKort({ besok, stationer, onOppna }: { besok: DagBesok; stationer?: number; onOppna: () => void }) {
  const omTid = tidTill(besok.start)
  return (
    <article data-genomgang="idag-nasta" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[26px] font-bold text-white">{klockslag(besok.start) || '--:--'}</span>
          {omTid && <span className="text-sm text-slate-400">{omTid}</span>}
        </p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-300 text-right">
          <Icon name={TYP_IKON[besok.typ]} size={20} className="text-slate-400 flex-shrink-0" />
          {besokBeskrivning(besok)}
        </p>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{besok.kund}</h3>
        <p className="text-[15px] text-slate-400">{besok.adress || 'Adress saknas i ärendet'}</p>
      </div>
      {(stationer !== undefined && stationer > 0) || besok.kontaktperson ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-400">
          {stationer !== undefined && stationer > 0 && (
            <span className="flex items-center gap-1.5">
              <Icon name="arende.station" size={16} />
              {stationer} stationer
            </span>
          )}
          {besok.kontaktperson && (
            <span className="flex items-center gap-1.5">
              <Icon name="rapport.person" size={16} />
              {besok.kontaktperson}
            </span>
          )}
        </p>
      ) : null}
      <BesokKnappar besok={besok} onOppna={onOppna} />
    </article>
  )
}

function AttGoraRad({ to, antal, rubrik, detalj, varna = false }: { to: string; antal: number; rubrik: string; detalj?: string; varna?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 min-h-[56px] hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
    >
      <span className="w-8 text-center font-mono text-lg font-bold text-white">{antal}</span>
      <span className="flex-1 min-w-0 text-[15px] text-white">{rubrik}</span>
      {detalj && <StatusPunkt ton={varna ? 'rod' : 'gra'}>{detalj}</StatusPunkt>}
      <Icon name="allman.chevron" size={16} className="text-slate-500 flex-shrink-0" />
    </Link>
  )
}

export default function NyIdag() {
  const { profile } = useAuth()
  const { besok: alla, laddar, fel, ladda } = useAllaArenden()
  const [oppet, setOppet] = useState<ArendeRef | null>(null)
  const [visaMig, setVisaMig] = useState(false)
  const [offerter, setOfferter] = useState<OffertLage | null>(null)
  const [stationer, setStationer] = useState<Map<string, number>>(new Map())
  const [nu, setNu] = useState(() => new Date())

  // Uppdatera "om 25 min" och nästa uppdrag varje minut
  useEffect(() => {
    const t = window.setInterval(() => setNu(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const idag = svenskDag(nu)
  const imorgon = laggTillDagar(idag, 1)

  const dagens = useMemo(() => alla.filter(b => b.dag === idag), [alla, idag])
  const morgondagens = useMemo(() => alla.filter(b => b.dag === imorgon), [alla, imorgon])
  const nasta = useMemo(() => nastaBesok(dagens, nu), [dagens, nu])
  const vantar = useMemo(() => vantarPaDig(alla, idag), [alla, idag])
  const attBoka = vantar.filter(v => v.orsak === 'boka').length
  const attAvsluta = vantar.filter(v => v.orsak === 'avsluta').length

  useEffect(() => {
    const tek = profile?.technician_id
    if (!tek) return
    hamtaOffertLage(tek).then(setOfferter).catch(() => setOfferter(null))
  }, [profile?.technician_id])

  const kundIds = useMemo(() => dagens.filter(arAvtalsbesok).map(b => b.customerId).filter((x): x is string => !!x).sort().join(','), [dagens])
  useEffect(() => {
    if (!kundIds) return
    hamtaStationsantal(kundIds.split(',')).then(setStationer)
  }, [kundIds])

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  const underrubrik = laddar ? langtDatum(idag) : `${langtDatum(idag)}, ${dagens.length} besök`
  useNySidhuvud({ underrubrik, onVisaMig: oppnaVisaMig })

  const oppna = (b: DagBesok) => setOppet({ kalla: b.kalla, id: b.id })
  const offertAntal = (offerter?.forfallna ?? 0) + (offerter?.attFolja ?? 0)
  const nagotAttGora = offertAntal > 0 || attBoka > 0 || attAvsluta > 0

  return (
    <>
      <TestarRad />
      {laddar && alla.length === 0 ? (
        <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar din dag..." /></div>
      ) : fel ? (
        <div className="max-w-xl mx-auto p-4">
          <div className="rounded-2xl bg-slate-900 border border-red-500/40 p-4">
            <p className="text-white font-medium">{fel}</p>
            <button type="button" onClick={ladda} className="mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800">Försök igen</button>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 lg:p-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          {/* Vänster: nästa uppdrag och dagens rutt */}
          <div className="space-y-5 min-w-0">
            <section aria-labelledby="hjalp-idag-nasta-rubrik" className="space-y-2">
              <HjalpText id="idag-nasta" rubrik="Nästa uppdrag" ikon="falt.framme">
                Navigera öppnar vägbeskrivningen, Ring ringer kontaktpersonen och Öppna visar hela ärendet.
              </HjalpText>
              {nasta ? (
                <NastaKort besok={nasta} stationer={nasta.customerId ? stationer.get(nasta.customerId) : undefined} onOppna={() => oppna(nasta)} />
              ) : (
                <div data-genomgang="idag-nasta" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-5 flex items-center gap-3">
                  <Icon name="station.klar" size={32} className="text-[#20c58f]" />
                  <p className="text-[15px] text-slate-300">
                    {dagens.length === 0 ? 'Inga besök inbokade idag.' : 'Alla dagens besök är klara.'}
                  </p>
                </div>
              )}
            </section>

            <section aria-labelledby="hjalp-idag-rutt-rubrik" className="space-y-2">
              <HjalpText
                id="idag-rutt"
                rubrik="Dagens rutt"
                ikon="falt.rutt"
                hoger={dagens.length > 0 && (
                  <Link to="/technician/karta" className="min-h-[44px] flex items-center gap-1.5 text-sm font-medium text-[#20c58f] hover:underline">
                    <Icon name="falt.karta" size={16} />
                    Visa på karta
                  </Link>
                )}
              >
                Besöken i den ordning de är bokade. Tryck på ett besök för att öppna ärendet.
              </HjalpText>
              {dagens.length === 0 ? (
                <p className="text-sm text-slate-500">Inget inbokat idag.</p>
              ) : (
                <ol className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                  {dagens.map((b, i) => {
                    const arNasta = nasta?.nyckel === b.nyckel
                    return (
                      <li key={b.nyckel}>
                        <button
                          type="button"
                          onClick={() => oppna(b)}
                          className="w-full flex items-center gap-3 px-3 py-3 min-h-[64px] text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
                        >
                          <span
                            aria-hidden="true"
                            className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                              b.avslutad ? 'bg-[#20c58f]/15 text-[#20c58f]'
                                : arNasta ? 'bg-[#20c58f] text-[#04281c]'
                                : 'border border-slate-600 text-slate-300'
                            }`}
                          >
                            {b.avslutad ? <Icon name="allman.bock" size={16} /> : i + 1}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="text-[15px] font-medium text-white truncate">{b.kund}</span>
                              <span className="font-mono text-sm text-slate-300 flex-shrink-0">{klockslag(b.start)}</span>
                            </span>
                            <span className="block text-[13px] text-slate-400 truncate">
                              {b.avslutad ? 'Klart' : arNasta ? `Nästa, ${besokBeskrivning(b).toLowerCase()}` : besokBeskrivning(b)}
                              {b.adress ? `, ${b.adress}` : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>

          {/* Höger: att göra och imorgon */}
          <div className="space-y-5 min-w-0">
            <section aria-labelledby="hjalp-idag-attgora-rubrik" className="space-y-2">
              <HjalpText id="idag-attgora" rubrik="Att göra" ikon="falt.attgora">
                Det som väntar på dig och som inte hör till dagens besök.
              </HjalpText>
              <div data-genomgang="idag-attgora" className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                {offertAntal > 0 && (
                  <AttGoraRad
                    to="/technician/dokumentsignering"
                    antal={offertAntal}
                    rubrik={offertAntal === 1 ? 'Offert att följa upp' : 'Offerter att följa upp'}
                    detalj={offerter && offerter.forfallna > 0 ? `${offerter.forfallna} ${offerter.forfallna === 1 ? 'förfallen' : 'förfallna'}` : undefined}
                    varna={!!offerter && offerter.forfallna > 0}
                  />
                )}
                {attBoka > 0 && (
                  <AttGoraRad to="/technician/cases" antal={attBoka} rubrik={attBoka === 1 ? 'Ärende att boka' : 'Ärenden att boka'} detalj="Tid saknas" />
                )}
                {attAvsluta > 0 && (
                  <AttGoraRad to="/technician/cases" antal={attAvsluta} rubrik="Besök att avsluta" detalj="Datumet har passerat" varna />
                )}
                {!nagotAttGora && (
                  <p className="px-3 py-4 text-sm text-slate-400">Inget väntar på dig just nu.</p>
                )}
              </div>
            </section>

            <section aria-label="Imorgon">
              <Link
                to="/technician/karta?dag=imorgon"
                className="flex items-center gap-3 px-3 min-h-[64px] rounded-2xl bg-slate-900 border border-slate-700/60 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                <Icon name="falt.imorgon" size={24} className="text-slate-400 flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-white">
                    Imorgon, {morgondagens.length} besök
                  </span>
                  {morgondagens[0] && (
                    <span className="block text-[13px] text-slate-400 truncate">
                      Första {klockslag(morgondagens[0].start)}, {morgondagens[0].kund}
                    </span>
                  )}
                </span>
                <Icon name="allman.chevron" size={16} className="text-slate-500" />
              </Link>
            </section>
          </div>
        </div>
      )}

      <OppnaArende arende={oppet} onClose={() => setOppet(null)} onSaved={ladda} />
      {!laddar && <Genomgang id="ny-idag" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />}
    </>
  )
}
