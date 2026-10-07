// src/components/admin/webLeads/WebLeadsStats.tsx
// Fliken Statistik i Leads (Webb). Periodväljare (7, 30, 90 dagar, 12 månader eller egen) med
// jämförelse mot föregående period lika lång; granulariteten följer perioden (dag, vecka, månad).
// Nyckeltal med förändring och sparkline, tratten förfrågan till vunnen, trend per kundgrupp eller
// källa, fördelning per tjänst, källa och kundgrupp, värmekarta veckodag × timme, geografi, tabellen
// Från förfrågan till affär, kundens val mot bokad tjänst och befintliga avtalskunder.
//
// Siffrorna räknas i databasen (RPC web_inquiry_statistik) i stället för på sidans lista, som är
// begränsad till 2000 rader: fliken ska ge samma svar vid 7 förfrågningar som vid 10 000.
// Befintliga avtalskunder (status Befintlig kund) räknas inte som nyförsäljning och visas för sig.
// Perioden står i adressen (period, pfran, ptill) så att en länk visar samma urval.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { webLeadStatistikService, type WebLeadStatistik } from '../../../services/webLeadStatistikService'
import type { WebInquiry } from '../../../types/webInquiry'
import DateField from '../../ui/DateField'
import { dagarMellan, foregaende, kr, procent, tal } from '../marknad/marknadFormat'
import { Sektion } from '../marknad/MarknadUi'
import { KallaIcon, TjanstIcon } from './WebLeadIcons'
import { KANAL_FARG } from './leadKlassning'
import { svDatum } from './format'
import WebLeadsKedja from './WebLeadsKedja'
import WebLeadsBefintliga from './WebLeadsBefintliga'
import {
  GRAN_TEXT,
  PERIODER,
  andelText,
  granFor,
  grupp,
  hinkar,
  kanalFranNyckel,
  periodFor,
  svarstidText,
  tidserie,
  tillFordelning,
  tjanstIkon,
  totalt,
  type StatPeriod,
} from './statistik/statistikData'
import { Delta, KpiRuta, Skelett, Sparkline } from './statistik/StatistikUi'
import StatistikTratt from './statistik/StatistikTratt'
import StatistikTrend from './statistik/StatistikTrend'
import StatistikFordelning from './statistik/StatistikFordelning'
import StatistikHeatmap from './statistik/StatistikHeatmap'
import StatistikMatris from './statistik/StatistikMatris'

const GILTIGA = new Set<string>(PERIODER.map(([v]) => v))
const DATUM = /^\d{4}-\d{2}-\d{2}$/

export default function WebLeadsStats({ inquiries }: { inquiries: WebInquiry[] }) {
  const [params, setParams] = useSearchParams()
  const paramPeriod = params.get('period') ?? ''
  const val: StatPeriod = GILTIGA.has(paramPeriod) ? (paramPeriod as StatPeriod) : '30'
  const [jamfor, setJamfor] = useState(true)

  const { fran, till } = useMemo(() => {
    if (val !== 'egen') return periodFor(val)
    const f = params.get('pfran') ?? ''
    const t = params.get('ptill') ?? ''
    return DATUM.test(f) && DATUM.test(t) ? { fran: f, till: t } : periodFor('30')
  }, [val, params])
  const giltig = fran <= till
  const dagar = giltig ? dagarMellan(fran, till) : 0
  const gran = granFor(dagar)
  const fore = useMemo(() => (giltig ? foregaende(fran, till) : null), [fran, till, giltig])

  const [data, setData] = useState<WebLeadStatistik | null>(null)
  const [foreData, setForeData] = useState<WebLeadStatistik | null>(null)
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)

  // Realtid: sidan laddar om listan vid varje ändring; hämta om statistiken när den ändras
  const andringsnyckel = useMemo(() => {
    let senast = ''
    for (const i of inquiries) if (i.updated_at > senast) senast = i.updated_at
    return `${inquiries.length}|${senast}`
  }, [inquiries])

  useEffect(() => {
    if (!giltig) return
    let aktiv = true
    const t = window.setTimeout(() => {
      setLaddar(true)
      setFel(null)
      Promise.all([
        webLeadStatistikService.hamta(fran, till, gran),
        jamfor && fore ? webLeadStatistikService.hamta(fore.fran, fore.till, gran) : Promise.resolve(null),
      ])
        .then(([nu, f]) => {
          if (!aktiv) return
          setData(nu)
          setForeData(f)
        })
        .catch((e: Error) => {
          if (aktiv) setFel(e.message || 'Statistiken kunde inte hämtas')
        })
        .finally(() => {
          if (aktiv) setLaddar(false)
        })
    }, 250)
    return () => {
      aktiv = false
      window.clearTimeout(t)
    }
  }, [fran, till, gran, giltig, jamfor, fore, andringsnyckel])

  const valjPeriod = (v: StatPeriod) => {
    setParams(
      (p) => {
        if (v === '30') p.delete('period')
        else p.set('period', v)
        if (v === 'egen') {
          p.set('pfran', fran)
          p.set('ptill', till)
        } else {
          p.delete('pfran')
          p.delete('ptill')
        }
        return p
      },
      { replace: true },
    )
  }
  const sattEgen = (nyckel: 'pfran' | 'ptill', v: string) => {
    setParams(
      (p) => {
        if (v) p.set(nyckel, v)
        return p
      },
      { replace: true },
    )
  }

  const rader = useMemo(() => data?.rader ?? [], [data])
  const alla = useMemo(() => (giltig ? hinkar(fran, till, gran) : []), [fran, till, gran, giltig])
  const m = totalt(rader)
  const fm = foreData ? totalt(foreData.rader) : null
  const serie = useMemo(() => tidserie(rader, alla), [rader, alla])

  const befintliga = useMemo(
    () =>
      inquiries.filter((i) => {
        if (i.status !== 'befintlig_kund') return false
        const d = svDatum(i.created_at)
        return d >= fran && d <= till
      }),
    [inquiries, fran, till],
  )

  const tjanster = useMemo(() => tillFordelning(grupp(rader, 'tjanst'), (r) => <TjanstIcon name={tjanstIkon(r.nyckel)} className="w-4 h-4" />), [rader])
  const kanaler = useMemo(
    () =>
      tillFordelning(grupp(rader, 'kanal'), (r) => {
        const k = kanalFranNyckel(r.nyckel)
        return <KallaIcon name={k} className={`w-4 h-4 ${KANAL_FARG[k]}`} />
      }),
    [rader],
  )
  const kundgrupper = useMemo(() => tillFordelning(grupp(rader, 'kundgrupp')), [rader])
  const orter = useMemo(() => tillFordelning(grupp(rader, 'ort')), [rader])
  const ingangar = useMemo(() => tillFordelning(grupp(rader, 'kalla')), [rader])

  const forlorade = m.forl_efter + m.forl_utan
  const foreForlorade = fm ? fm.forl_efter + fm.forl_utan : null
  const kvot = (a: number, b: number) => (b ? a / b : null)

  const periodRad = (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div role="tablist" aria-label="Period" className="flex flex-wrap gap-x-4 border-b border-slate-700 text-sm">
        {PERIODER.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={val === v}
            onClick={() => valjPeriod(v)}
            className={`pb-2 -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded-t ${
              val === v ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      {val === 'egen' && (
        <div className="flex items-center gap-2">
          <DateField value={fran} onChange={(v) => sattEgen('pfran', v)} className="pl-9 w-36" aria-label="Från" />
          <span className="text-slate-500">till</span>
          <DateField value={till} onChange={(v) => sattEgen('ptill', v)} className="pl-9 w-36" aria-label="Till" />
        </div>
      )}
      <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer pb-2">
        <input type="checkbox" className="accent-[#20c58f]" checked={jamfor} onChange={(e) => setJamfor(e.target.checked)} />
        Jämför med föregående period
      </label>
    </div>
  )

  const info = giltig ? (
    <p className="text-xs text-slate-400">
      {fran} till {till} ({tal(dagar)} {dagar === 1 ? 'dag' : 'dagar'}), {GRAN_TEXT[gran]}
      {jamfor && fore && (
        <>
          , jämfört med {fore.fran} till {fore.till}
        </>
      )}
      .{data && (data.skrap > 0 || data.befintliga > 0) && (
        <>
          {' '}Utanför nyförsäljningen: {tal(data.skrap)} skräp och {tal(data.befintliga)} från befintliga avtalskunder.
        </>
      )}
    </p>
  ) : (
    <p className="text-xs text-amber-400">Välj ett giltigt datumintervall: från-datumet ska vara före till-datumet.</p>
  )

  if (!data) {
    return (
      <div className="space-y-4">
        {periodRad}
        {info}
        {fel ? <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{fel}</div> : <Skelett />}
      </div>
    )
  }

  const tom = m.n === 0

  return (
    <div className="space-y-4">
      {periodRad}
      {info}
      {fel && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{fel}</div>}

      <div className={`space-y-4 transition-opacity ${laddar ? 'opacity-60' : ''}`}>
        {/* Nyckeltal */}
        <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
          <KpiRuta
            etikett="Förfrågningar"
            varde={tal(m.n)}
            delta={jamfor && <Delta nu={m.n} fore={fm?.n} />}
            under={<span>nyförsäljning</span>}
            trend={<Sparkline varden={serie.map((s) => s.n)} titel="Förfrågningar under perioden" />}
          />
          <KpiRuta
            etikett="Akuta"
            varde={tal(m.akuta)}
            delta={jamfor && <Delta nu={m.akuta} fore={fm?.akuta} />}
            under={m.n ? <span>{andelText(m.akuta, m.n)} av alla</span> : undefined}
            trend={<Sparkline varden={serie.map((s) => s.akuta)} titel="Akuta förfrågningar under perioden" />}
          />
          <KpiRuta
            etikett="Kontakt samma dag"
            varde={m.n ? procent(m.samma_dag / m.n, 0) : '–'}
            dampad={!m.n}
            delta={jamfor && <Delta nu={kvot(m.samma_dag, m.n)} fore={fm ? kvot(fm.samma_dag, fm.n) : null} satt="pe" />}
            under={m.n ? <span>{tal(m.samma_dag)} av {tal(m.n)}</span> : undefined}
            trend={<Sparkline varden={serie.map((s) => kvot(s.samma_dag, s.n))} titel="Andel kontakt samma dag under perioden" />}
          />
          <KpiRuta
            etikett="Svarstid, median"
            varde={svarstidText(m.svarstid_median)}
            dampad={m.svarstid_median == null}
            delta={jamfor && <Delta nu={m.svarstid_median} fore={fm?.svarstid_median} omvand />}
            under={<span>till första kontakt</span>}
            trend={<Sparkline varden={serie.map((s) => s.svarstid_median)} titel="Svarstid under perioden" />}
          />
          <KpiRuta
            etikett="Bokade"
            varde={tal(m.bokade)}
            delta={jamfor && <Delta nu={m.bokade} fore={fm?.bokade} />}
            under={m.n ? <span>{andelText(m.bokade, m.n, 1)} konvertering</span> : undefined}
            trend={<Sparkline varden={serie.map((s) => s.bokade)} titel="Bokade under perioden" />}
          />
          <KpiRuta
            etikett="Vunna"
            varde={tal(m.vunna)}
            delta={jamfor && <Delta nu={m.vunna} fore={fm?.vunna} />}
            under={<span>{m.bokade ? `${andelText(m.vunna, m.bokade)} av bokade` : 'inga bokade än'}</span>}
            trend={<Sparkline varden={serie.map((s) => s.vunna)} titel="Vunna under perioden" />}
          />
          <KpiRuta
            etikett="Förlorade"
            varde={tal(forlorade)}
            delta={jamfor && <Delta nu={forlorade} fore={foreForlorade} omvand />}
            under={<span>{tal(m.forl_efter)} efter bokning</span>}
            trend={<Sparkline varden={serie.map((s) => s.forl_efter + s.forl_utan)} accent="#94a3b8" titel="Förlorade under perioden" />}
          />
          <KpiRuta
            etikett="Värde, vunna"
            varde={m.varde ? kr(m.varde) : '–'}
            dampad={!m.varde}
            delta={jamfor && m.varde > 0 && <Delta nu={m.varde} fore={fm?.varde} />}
            under={<span>{m.varde ? `${tal(m.med_varde)} affärer, exkl. moms` : 'inga vunna med belopp än'}</span>}
            trend={m.varde ? <Sparkline varden={serie.map((s) => s.varde)} titel="Värde vunna under perioden" /> : undefined}
          />
        </div>

        {tom ? (
          <Sektion titel="Inga förfrågningar under perioden">
            <p className="text-sm text-slate-400">
              Det finns inga förfrågningar för nyförsäljning mellan {fran} och {till}. Välj en längre period ovan; diagrammen fylls så
              fort förfrågningar kommer in från formulären på begone.se.
            </p>
          </Sektion>
        ) : (
          <>
            {/* Tratt och trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Sektion titel="Från förfrågan till vunnen" under="Andel av alla förfrågningar och tappet mellan stegen">
                <StatistikTratt m={m} fore={jamfor ? fm : null} />
              </Sektion>
              <div className="lg:col-span-2 min-w-0">
                <Sektion titel={`Förfrågningar ${GRAN_TEXT[gran]}`} under="Staplat per kundgrupp eller källa. Håll över en stapel för detaljer.">
                  <StatistikTrend rader={rader} alla={alla} gran={gran} fran={fran} till={till} />
                </Sektion>
              </div>
            </div>

            {/* Fördelning */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Sektion titel="Tjänst" under="Vad kunden valde i formuläret">
                <StatistikFordelning rader={tjanster} />
              </Sektion>
              <Sektion titel="Källa" under="Kanal enligt klick-id, utm-fält och hänvisning">
                <StatistikFordelning rader={kanaler} />
              </Sektion>
              <Sektion titel="Kundgrupp">
                <StatistikFordelning rader={kundgrupper} />
              </Sektion>
            </div>

            {/* Tid på dygnet och geografi */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 min-w-0">
                <Sektion titel="När kommer förfrågningarna" under="Veckodag och timme i svensk tid">
                  <StatistikHeatmap rader={rader} />
                </Sektion>
              </div>
              <Sektion titel="Geografi" under="Ort enligt adressen, rättad ort om den finns">
                <StatistikFordelning rader={orter} topp={8} />
              </Sektion>
            </div>

            {/* Tabellen */}
            <Sektion titel="Från förfrågan till affär" under="Hela kedjan per grupp. Exportera till CSV för vidare analys.">
              <WebLeadsKedja rader={rader} summa={m} fran={fran} till={till} />
            </Sektion>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 min-w-0">
                <Sektion titel="Kundens val mot bokad tjänst" under="Tjänsten kunden valde på sajten och tjänsten som bokades i ärendet">
                  <StatistikMatris rader={rader} />
                </Sektion>
              </div>
              <Sektion titel="Ingång på sajten" under="Formuläret förfrågan skickades från">
                <StatistikFordelning rader={ingangar} />
              </Sektion>
            </div>
          </>
        )}

        <WebLeadsBefintliga befintliga={befintliga} />

        <p className="text-xs text-slate-500">
          Förfrågningar markerade som skräp räknas inte. Nyckeltalen, diagrammen och tabellerna gäller nyförsäljning; förfrågningar från
          befintliga avtalskunder visas för sig. Kontaktad betyder att statusen ändrats från Ny (eller att förfrågan bokats). Svarstiden
          är klocktid från förfrågan till första kontakt, även kvällar och helger. Bokad betyder att ett ärende skapats från förfrågan.
          Vunnen när ärendet fakturerats inom 30 dagar från bokningen (90 dagar om offert skickats), annars förlorad efter bokning.
          Värdet är ärendets fakturaunderlag exklusive moms. Förändringen jämförs med lika lång period direkt före; andelar jämförs i
          procentenheter (p.e.). Veckor enligt ISO, måndag först, allt i svensk tid.
        </p>
      </div>
    </div>
  )
}
