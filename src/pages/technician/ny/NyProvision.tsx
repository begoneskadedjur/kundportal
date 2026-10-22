// src/pages/technician/ny/NyProvision.tsx
// Provision i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
// Gamla sidan pages/technician/TechnicianCommissions.tsx är orörd och gäller alla andra.
//
// Samma data och samma beräkningar som gamla sidan: ProvisionService.getPostsForTechnician
// och getSettings, egna poster filtreras på technician_id, utbetalningsmånaden kommer från
// utils/provisionPayout (groupPostsByPayoutMonth, getPostPayoutMonth, monthlyEarnedSeries).
// Beloppen är commission_amount per post, här summeras de bara.
//
// Inventering av gamla sidan, funktion -> plats i nya:
//   Behörighetskontroll (teknikervy + technician_id, annars /login) -> samma useEffect här
//   Laddning, felruta med Försök igen                               -> laddar/fel nedan
//   Uppdatera-knappen                                                -> ikonknappen bredvid månadsväljaren
//   12-månaderskurva (intjänat per skapandemånad)                    -> ProvisionDiagram, läget Intjänat
//   Intjänat i år, antal, snitt per ärende                           -> raden I år (höger kolumn)
//   Väntar på kundbetalning, antal, äldsta dagar med varning         -> raden Väntar på kunden
//   Klart för utbetalning och vilken lön                             -> sammanfattningen + Nästa utbetalning
//   Utbetalt i år, senaste utbetalning                               -> raden I år
//   Nästa utbetalning (godkänt / klart, väntar på godkännande)       -> Nästa utbetalning i sammanfattningen
//   Flödesband väntar/redo/klart                                     -> ersatt av statusförklaringen och beloppen i text
//   Månadsgrupper per utbetalningsmånad, preliminärt för obetalda    -> läget Lönen (månadsväljare per lönemånad)
//   Postrad: BE-nummer, titel, besök, underlag -> belopp, procent,
//     andel, ROT, status i klartext med åldersvarning               -> ProvisionLista
//   Antal utbetalningsmånader och poster i sidfoten                  -> antal poster i listrubriken
//   Så funkar flödet                                                 -> ProvisionForklaring (hopfällbar)
// Nytt: tryck på en post öppnar ärendet (OppnaArende), kundnamn på raden, läget Intjänat per
// månad, förklaring av hur provisionen räknas, tomt läge, genomgång.
// Export: gamla teknikersidan har ingen export, så ingen här heller.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { ProvisionDiagram, type DiagramPunkt } from '../../../components/technician/ny/provision/ProvisionDiagram'
import { ProvisionLista } from '../../../components/technician/ny/provision/ProvisionLista'
import { ProvisionForklaring } from '../../../components/technician/ny/provision/ProvisionForklaring'
import {
  dagFor, flyttaManad, kr, lonerText, manadNamn, manadNyckel, skapandeManad, summera,
  useMinProvision, utbetalningsRegel, versal,
} from '../../../components/technician/ny/provision/provisionData'
import { useAuth } from '../../../contexts/AuthContext'
import {
  UNPAID_AGE_WARNING_DAYS, daysSince, getPostPayoutMonth, groupPostsByPayoutMonth,
  monthlyEarnedSeries, payoutSalaryLabel,
} from '../../../utils/provisionPayout'

type Lage = 'intjanat' | 'lon'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Din provision i klartext', text: 'Överst står vad du har tjänat den valda månaden, hur mycket som är klart för utbetalning och med vilken lön det kommer.', mal: 'provision-oversikt' },
  { rubrik: 'Intjänat eller Lönen', text: 'Intjänat visar provisionen efter när du gjorde jobbet. Lönen visar den efter vilken lön den betalas ut med.', mal: 'provision-lage' },
  { rubrik: 'Byt månad', text: 'Bläddra med pilarna eller tryck på en stapel i diagrammet.', mal: 'provision-diagram' },
  { rubrik: 'Posterna', text: 'Varje rad är en provisionspost med belopp och status. Tryck på raden för att öppna ärendet.', mal: 'provision-lista' },
  { rubrik: 'Så räknas den', text: 'Här står hur provisionen räknas, när den betalas ut och vad statusarna betyder.', mal: 'provision-forklaring' },
]

function LageVal({ lage, onLage }: { lage: Lage; onLage: (l: Lage) => void }) {
  const val: Array<{ lage: Lage; text: string; ikon: 'provision.intjanat' | 'provision.lon' }> = [
    { lage: 'intjanat', text: 'Intjänat', ikon: 'provision.intjanat' },
    { lage: 'lon', text: 'Lönen', ikon: 'provision.lon' },
  ]
  return (
    <div role="group" aria-label="Visa provisionen per" data-genomgang="provision-lage" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-800">
      {val.map(v => (
        <button
          key={v.lage}
          type="button"
          aria-pressed={lage === v.lage}
          onClick={() => onLage(v.lage)}
          className={`h-11 lg:h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
            lage === v.lage ? 'bg-slate-900 border border-slate-600 text-white font-semibold' : 'border border-transparent text-slate-300 hover:text-white font-medium'
          }`}
        >
          <Icon name={v.ikon} size={20} />
          {v.text}
        </button>
      ))}
    </div>
  )
}

function ManadVal({ etikett, onSteg, forraAv, nastaAv }: { etikett: string; onSteg: (s: number) => void; forraAv: boolean; nastaAv: boolean }) {
  const knapp = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
  return (
    <span className="flex items-center gap-1">
      <button type="button" aria-label="Förra månaden" disabled={forraAv} onClick={() => onSteg(-1)} className={knapp}>
        <Icon name="allman.chevron-vanster" size={24} />
      </button>
      <span aria-live="polite" className="min-w-[10rem] text-center text-[15px] font-semibold text-white">{etikett}</span>
      <button type="button" aria-label="Nästa månad" disabled={nastaAv} onClick={() => onSteg(1)} className={knapp}>
        <Icon name="allman.chevron" size={24} />
      </button>
    </span>
  )
}

/** Rad i höger kolumn: rubrik och klartext, inga stora siffror i rutor */
function InfoRad({ rubrik, children }: { rubrik: string; children: ReactNode }) {
  return (
    <div className="px-3 py-3">
      <dt className="text-[13px] text-slate-400">{rubrik}</dt>
      <dd className="mt-0.5 text-[15px] text-white">{children}</dd>
    </div>
  )
}

export default function NyProvision() {
  const { profile, availableViews } = useAuth()
  const navigate = useNavigate()
  const hasTechnicianView = availableViews.includes('technician')
  const technicianId = profile?.technician_id

  // Samma behörighetskontroll som gamla sidan
  useEffect(() => {
    if (!hasTechnicianView || !technicianId) navigate('/login', { replace: true })
  }, [hasTechnicianView, technicianId, navigate])

  const [nu] = useState(() => new Date())
  const nuNyckel = manadNyckel(nu)
  const { poster, settings, cutoff, uppslag, laddar, fel, ladda } = useMinProvision(technicianId, nu)

  const [lage, setLage] = useState<Lage>('intjanat')
  const [vald, setVald] = useState(nuNyckel)
  const [oppet, setOppet] = useState<ArendeRef | null>(null)
  const [visaMig, setVisaMig] = useState(false)

  // ─── Utbetalningsmånader: samma gruppering som admin och gamla sidan ───
  const grupper = useMemo(() => groupPostsByPayoutMonth(poster, cutoff, nu), [poster, cutoff, nu])

  // Nästa utbetalning = tidigaste lönemånad med klara eller godkända poster (som gamla sidan)
  const nasta = useMemo(() => {
    const oppna = grupper
      .filter(g => g.statuses.ready > 0 || g.statuses.approved > 0)
      .sort((a, b) => a.month_key.localeCompare(b.month_key))
    return oppna[0] ?? null
  }, [grupper])

  // ─── Diagrammets 12 månader ───
  const intjanatManader = useMemo(() => Array.from({ length: 12 }, (_, i) => flyttaManad(nuNyckel, i - 11)), [nuNyckel])
  const lonManader = useMemo(() => {
    let slut = flyttaManad(nuNyckel, 1)
    for (const g of grupper) if (g.month_key > slut) slut = g.month_key
    return Array.from({ length: 12 }, (_, i) => flyttaManad(slut, i - 11))
  }, [grupper, nuNyckel])
  const manader = lage === 'intjanat' ? intjanatManader : lonManader

  const diagram: DiagramPunkt[] = useMemo(() => {
    if (lage === 'intjanat') {
      const serie = monthlyEarnedSeries(poster, 12, nu)
      return intjanatManader.map((m, i) => ({
        nyckel: m,
        etikett: manadNamn(m, nu, true).slice(0, 3),
        hel: `Intjänat ${manadNamn(m, nu, true)}`,
        varde: serie[i] ?? 0,
      }))
    }
    const perManad = new Map(grupper.map(g => [g.month_key, g.total_commission]))
    return lonManader.map(m => ({
      nyckel: m,
      etikett: manadNamn(m, nu, true).slice(0, 3),
      hel: `Med ${payoutSalaryLabel(m)} ${m.slice(0, 4)}`,
      varde: perManad.get(m) ?? 0,
    }))
  }, [lage, poster, nu, grupper, intjanatManader, lonManader])

  const bytLage = (l: Lage) => {
    if (l === lage) return
    setLage(l)
    if (l === 'lon') {
      const forsta = nasta?.month_key ?? flyttaManad(nuNyckel, 1)
      setVald(lonManader.includes(forsta) ? forsta : lonManader[lonManader.length - 1])
    } else {
      setVald(nuNyckel)
    }
  }
  const valdIndex = manader.indexOf(vald)
  const steg = (s: number) => {
    const ny = manader[valdIndex + s]
    if (ny) setVald(ny)
  }

  // ─── Vald månads poster ───
  const valdGrupp = lage === 'lon' ? grupper.find(g => g.month_key === vald) ?? null : null
  const valda = useMemo(
    () => (lage === 'intjanat' ? poster.filter(p => skapandeManad(p.created_at) === vald) : valdGrupp?.posts ?? []),
    [lage, poster, vald, valdGrupp],
  )
  const summa = useMemo(() => summera(valda), [valda])

  // ─── Året och det som väntar (samma urval som gamla sidans årsöversikt) ───
  const aret = useMemo(() => {
    const ar = nu.getFullYear()
    let intjanat = 0
    // Antal poster i år, samma räkning och samma snitt som gamla sidans årsöversikt
    let arenden = 0
    let utbetalt = 0
    let senastUtbetald: string | null = null
    let vantar = 0
    let vantarAntal = 0
    let aldsta = 0
    for (const p of poster) {
      const skapatAr = new Date(p.created_at).getFullYear()
      if (skapatAr === ar) {
        intjanat += p.commission_amount
        arenden++
      }
      if (p.status === 'pending_invoice') {
        vantar += p.commission_amount
        vantarAntal++
        aldsta = Math.max(aldsta, daysSince(p.created_at, nu))
      }
      if (p.status === 'paid_out') {
        if (p.payout_month?.startsWith(String(ar)) || skapatAr === ar) utbetalt += p.commission_amount
        if (p.paid_out_at && (!senastUtbetald || p.paid_out_at > senastUtbetald)) senastUtbetald = p.paid_out_at
      }
    }
    return { intjanat, arenden, utbetalt, senastUtbetald, vantar, vantarAntal, aldsta }
  }, [poster, nu])

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: 'Dina provisionsposter, samma siffror som lönen', onVisaMig: oppnaVisaMig })

  // ─── Sammanfattningen i klartext ───
  const arendenText = (n: number) => `${n} ${n === 1 ? 'ärende' : 'ärenden'}`
  const mening = (() => {
    if (lage === 'intjanat') {
      const nar = vald === nuNyckel ? 'Den här månaden' : `I ${manadNamn(vald, nu)}`
      if (summa.poster === 0) {
        return { huvud: vald === nuNyckel ? 'Den här månaden har du ingen provision än.' : `I ${manadNamn(vald, nu)} fick du ingen provision.`, delar: [] as string[] }
      }
      const klarManader = valda
        .filter(p => p.status === 'ready_for_payout' || p.status === 'approved')
        .map(p => getPostPayoutMonth(p, cutoff, nu).month)
      const delar: string[] = []
      if (summa.klar + summa.godkand > 0) delar.push(`${kr(summa.klar + summa.godkand)} är klart för utbetalning med ${lonerText(klarManader)}.`)
      if (summa.vantar > 0) delar.push(`${kr(summa.vantar)} väntar på att kunden betalar.`)
      if (summa.utbetald > 0) delar.push(`${kr(summa.utbetald)} är utbetalt.`)
      return {
        huvud: `${nar} har du tjänat ${kr(summa.totalt)} i provision på ${arendenText(summa.arenden)}.`,
        delar,
      }
    }
    const lon = payoutSalaryLabel(vald)
    const passerad = vald < nuNyckel
    if (summa.poster === 0) {
      return { huvud: `Med ${lon} ${passerad ? 'fick du ingen provision' : 'finns ingen provision än'}.`, delar: [] as string[] }
    }
    const delar: string[] = []
    if (summa.godkand > 0) delar.push(`${kr(summa.godkand)} är godkänt för lön.`)
    if (summa.klar > 0) delar.push(`${kr(summa.klar)} är klart och väntar på att löneadministratören godkänner det.`)
    if (summa.vantar > 0) delar.push(`${kr(summa.vantar)} står här preliminärt eftersom kunden inte har betalat än. De posterna kommer med den lön som gäller när kunden betalar.`)
    if (summa.utbetald > 0 && summa.utbetald < summa.totalt) delar.push(`${kr(summa.utbetald)} är redan utbetalt.`)
    return {
      huvud: `Med ${lon} ${passerad && summa.utbetald === summa.totalt ? 'fick du' : 'får du'} ${kr(summa.totalt)} i provision för ${arendenText(summa.arenden)}.`,
      delar,
    }
  })()

  const etikett = lage === 'intjanat' ? versal(manadNamn(vald, nu, true)) : `${versal(payoutSalaryLabel(vald))} ${vald.slice(0, 4)}`

  if (laddar && poster.length === 0 && !fel) {
    return <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar din provision..." /></div>
  }

  if (fel) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <div className="rounded-2xl bg-slate-900 border border-red-500/40 p-4">
          <p className="text-white font-medium">Provisionen kunde inte hämtas</p>
          <p className="mt-1 text-sm text-slate-400">{fel}</p>
          <button type="button" onClick={ladda} className="mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  // ─── Tomt läge: ingen provision alls ───
  if (poster.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-5">
        <div data-genomgang="provision-oversikt" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-5 text-center">
          <Icon name="provision.tom" size={32} className="mx-auto text-slate-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">Du har ingen provision än</h2>
          <p className="mt-2 text-[15px] text-slate-300 leading-relaxed">
            Du får provision när ett ärende du har en andel i avslutas och är markerat som provisionsgrundande.
            Posten dyker upp här direkt, och den betalas ut med lönen när kunden har betalat fakturan.
          </p>
          <button
            type="button"
            onClick={ladda}
            className="mt-4 h-11 px-4 inline-flex items-center gap-2 rounded-xl border border-slate-600 text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <Icon name="provision.uppdatera" size={20} />
            Uppdatera
          </button>
        </div>
        <div data-genomgang="provision-forklaring">
          <ProvisionForklaring settings={settings} cutoff={cutoff} nu={nu} oppenFranBorjan />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 lg:p-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Vänster: sammanfattning, månad, diagram och poster */}
        <div className="space-y-5 min-w-0">
          <section data-genomgang="provision-oversikt" aria-label="Sammanfattning" className="space-y-2">
            <p className="text-lg lg:text-xl font-semibold text-white leading-snug">{mening.huvud}</p>
            {mening.delar.length > 0 && (
              <p className="text-[15px] text-slate-300 leading-relaxed">{mening.delar.join(' ')}</p>
            )}
            {nasta && (
              <p className="flex items-start gap-2 text-[15px] text-slate-300">
                <Icon name="provision.lon" size={20} className="mt-0.5 text-[#20c58f] flex-shrink-0" />
                <span>
                  Nästa utbetalning: <span className="font-semibold text-white">{kr(nasta.status_totals.ready + nasta.status_totals.approved)}</span> med {payoutSalaryLabel(nasta.month_key)}
                  {nasta.status_totals.approved > 0 && nasta.status_totals.ready > 0
                    ? `, varav ${kr(nasta.status_totals.approved)} godkänt och ${kr(nasta.status_totals.ready)} som väntar på godkännande.`
                    : nasta.status_totals.approved > 0 ? ', godkänt för lön.' : ', väntar på att löneadministratören godkänner det.'}
                </span>
              </p>
            )}
            <p className="text-[13px] text-slate-400 leading-relaxed">{utbetalningsRegel(cutoff, nu)}</p>
          </section>

          <section aria-label="Välj månad" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LageVal lage={lage} onLage={bytLage} />
              <div className="flex items-center gap-1">
                <ManadVal etikett={etikett} onSteg={steg} forraAv={valdIndex <= 0} nastaAv={valdIndex < 0 || valdIndex >= manader.length - 1} />
                <button
                  type="button"
                  onClick={ladda}
                  disabled={laddar}
                  aria-label="Uppdatera"
                  title="Uppdatera"
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                >
                  <Icon name="provision.uppdatera" size={20} className={laddar ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div data-genomgang="provision-diagram" className="rounded-2xl bg-slate-900 border border-slate-700/60 px-3 pt-3 pb-1">
              <p className="px-1 text-[13px] text-slate-400">
                {lage === 'intjanat' ? 'Intjänat per månad, senaste 12 månaderna' : 'Provision per lönemånad'}
              </p>
              <ProvisionDiagram
                data={diagram}
                vald={vald}
                onValj={setVald}
                beskrivning={`${lage === 'intjanat' ? 'Intjänat per månad' : 'Provision per lönemånad'}: ${diagram.map(d => `${d.hel} ${kr(d.varde)}`).join(', ')}`}
              />
            </div>
          </section>

          <section aria-labelledby="hjalp-provision-poster-rubrik" className="space-y-2" data-genomgang="provision-lista">
            <HjalpText
              id="provision-poster"
              rubrik={summa.poster === 0 ? 'Poster' : `${summa.poster} ${summa.poster === 1 ? 'post' : 'poster'}`}
              ikon="falt.provision"
            >
              {lage === 'intjanat'
                ? 'Provisionen från ärenden som avslutades den här månaden. Tryck på en rad för att öppna ärendet.'
                : 'Provisionen som betalas ut med den här lönen. Tryck på en rad för att öppna ärendet.'}
            </HjalpText>
            {valda.length === 0 ? (
              <p className="rounded-2xl bg-slate-900 border border-slate-700/60 px-3 py-4 text-sm text-slate-400">
                {lage === 'intjanat' ? 'Inga provisionsposter den här månaden.' : 'Inga provisionsposter på den här lönen.'}
              </p>
            ) : (
              <ProvisionLista poster={valda} uppslag={uppslag} cutoff={cutoff} nu={nu} onOppna={setOppet} />
            )}
          </section>
        </div>

        {/* Höger: året, det som väntar och förklaringen */}
        <div className="space-y-5 min-w-0">
          <section aria-label="Översikt" className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden">
            <dl className="divide-y divide-slate-700/60">
              <InfoRad rubrik={`I år, ${nu.getFullYear()}`}>
                {kr(aret.intjanat)} intjänat på {arendenText(aret.arenden)}
                {aret.arenden > 0 && <span className="text-slate-400">, i snitt {kr(aret.intjanat / aret.arenden)} per ärende</span>}
                <span className="block text-[13px] text-slate-400">
                  {kr(aret.utbetalt)} utbetalt{aret.senastUtbetald ? `, senast ${dagFor(aret.senastUtbetald)}` : ''}
                </span>
              </InfoRad>
              <InfoRad rubrik="Väntar på kundens betalning">
                {aret.vantarAntal === 0
                  ? <span className="text-slate-300">Inget väntar</span>
                  : <>
                      {kr(aret.vantar)} på {aret.vantarAntal} {aret.vantarAntal === 1 ? 'post' : 'poster'}
                      <span className={`block text-[13px] ${aret.aldsta > UNPAID_AGE_WARNING_DAYS ? 'text-amber-500' : 'text-slate-400'}`}>Äldsta registrerades för {aret.aldsta} dagar sedan</span>
                    </>}
              </InfoRad>
            </dl>
          </section>
          <div data-genomgang="provision-forklaring">
            <ProvisionForklaring settings={settings} cutoff={cutoff} nu={nu} />
          </div>
        </div>
      </div>

      <OppnaArende arende={oppet} onClose={() => setOppet(null)} onSaved={ladda} />
      {!laddar && <Genomgang id="ny-provision" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />}
    </>
  )
}
