// src/components/admin/webLeads/WebLeadsKedja.tsx
// Statistik i Leads (Webb): från förfrågan till affär (förfrågningar, kontaktade, bokade, vunna,
// förlorade efter och utan bokning, väntar på utfall och värde) per tjänst, källa, kanal, kundgrupp,
// vecka, kampanj, sökord eller sida. Raderna kommer aggregerade från RPC:n web_inquiry_statistik.
// Bokad = ett ärende har skapats eller kopplats (bokad_at), oavsett vad som hänt sedan.
// Sorterbara kolumner, inline-staplar för andelar, nollor nedtonade, summeringsrad och CSV-export.
// Under Kanal är AI-assistent och Hänvisning grupprader med delsumma som fälls ut till en rad per
// källa (assistent eller hänvisande webbplats); sorteringen gäller både mellan kanalerna och mellan
// källorna inom gruppen. Fliken Per källa inom kanal listar källorna i en kanal, med kanalens summa
// i foten.

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, Download } from 'lucide-react'
import type { StatGrupp, StatMatt, StatRad } from '../../../services/webLeadStatistikService'
import { kr, tal } from '../marknad/marknadFormat'
import { SortRubrik, type Riktning } from '../marknad/MarknadUi'
import { KallaIcon, TjanstIcon } from './WebLeadIcons'
import { KANAL_FARG, KANAL_LABEL, UNDERDELADE, UNDERKALLA_RUBRIK, arUnderdelad, type UnderdeladKanal } from './leadKlassning'
import { andelText, grupp, kanalFranNyckel, laddaNerCsv, summaAv, tjanstIkon, underGrupp, type Grupprad } from './statistik/statistikData'
import { Andelsstapel, Vaxel } from './statistik/StatistikUi'

/** 'inom' är kanalraderna för AI-assistent eller Hänvisning uppdelade per källa (ingen egen grupp i RPC:n). */
type Dimension = Extract<StatGrupp, 'tjanst' | 'kalla' | 'kanal' | 'kundgrupp' | 'vecka' | 'kampanj' | 'sokord' | 'sida'> | 'inom'

const DIMENSIONER: Array<[Dimension, string]> = [
  ['tjanst', 'Tjänst'],
  ['kalla', 'Källa'],
  ['kanal', 'Kanal'],
  ['inom', 'Per källa inom kanal'],
  ['kundgrupp', 'Kundgrupp'],
  ['vecka', 'Vecka'],
  ['kampanj', 'Kampanj'],
  ['sokord', 'Sökord'],
  ['sida', 'Sida'],
]

type Falt = 'namn' | 'n' | 'kontaktade' | 'bokade' | 'vunna' | 'forl_efter' | 'forl_utan' | 'pagaende' | 'varde'

const TOPP = 15

const INOM_VAL: Array<[UnderdeladKanal, string]> = UNDERDELADE.map((k) => [k, KANAL_LABEL[k]])

function ikonFor(dim: Dimension, r: Grupprad, inomKanal: UnderdeladKanal): ReactNode {
  if (dim === 'tjanst') return <TjanstIcon name={tjanstIkon(r.nyckel)} className="w-4 h-4 text-slate-400 flex-none" />
  if (dim === 'kanal') {
    const k = kanalFranNyckel(r.nyckel)
    return <KallaIcon name={k} className={`w-4 h-4 flex-none ${KANAL_FARG[k]}`} />
  }
  if (dim === 'inom') return <KallaIcon name={inomKanal} className={`w-4 h-4 flex-none ${KANAL_FARG[inomKanal]}`} />
  return null
}

/** Tal med valfri andel och stapel under. Nollor tonas ned. */
function Cell({ antal, del, av, stark }: { antal: number; del?: number; av?: number; stark?: boolean }) {
  const harAndel = av != null && del != null
  return (
    <td className="px-2 py-2 text-right align-top whitespace-nowrap">
      <span className={`tabular-nums ${antal ? (stark ? 'text-white font-medium' : 'text-slate-200') : 'text-slate-600'}`}>{tal(antal)}</span>
      {harAndel && (
        <div className="mt-1 ml-auto w-16">
          <div className={`text-[11px] leading-none mb-0.5 tabular-nums ${del ? 'text-slate-400' : 'text-slate-600'}`}>{av ? andelText(del!, av!) : '–'}</div>
          <Andelsstapel andel={av ? del! / av! : 0} />
        </div>
      )}
    </td>
  )
}

export default function WebLeadsKedja({
  rader,
  summa,
  fran,
  till,
}: {
  rader: StatRad[]
  summa: StatMatt
  fran: string
  till: string
}) {
  const [dim, setDim] = useState<Dimension>('tjanst')
  const [falt, setFalt] = useState<Falt>('n')
  const [riktning, setRiktning] = useState<Riktning>('desc')
  const [alla, setAlla] = useState(false)
  const [inomKanal, setInomKanal] = useState<UnderdeladKanal>('ai')
  // Utfällda grupper under Kanal: AI från början (få rader), Hänvisning kan bli lång
  const [oppna, setOppna] = useState<Set<UnderdeladKanal>>(() => new Set(['ai']))
  const vaxla = (k: UnderdeladKanal) =>
    setOppna((s) => {
      const ny = new Set(s)
      if (ny.has(k)) ny.delete(k)
      else ny.add(k)
      return ny
    })

  const jamfor = useMemo(() => {
    const tecken = riktning === 'asc' ? 1 : -1
    return (a: Grupprad, b: Grupprad) => {
      if (falt === 'namn') return tecken * a.namn.localeCompare(b.namn, 'sv')
      return tecken * (a[falt] - b[falt]) || a.namn.localeCompare(b.namn, 'sv')
    }
  }, [falt, riktning])

  // Källorna inom kanalerna sorteras sinsemellan med samma kolumn och riktning som tabellen
  const inom = useMemo(
    () => ({ ai: underGrupp(rader, 'ai').sort(jamfor), hanvisning: underGrupp(rader, 'hanvisning').sort(jamfor) }),
    [rader, jamfor],
  )

  const lista = useMemo(
    () => (dim === 'inom' ? [...inom[inomKanal]] : grupp(rader, dim).sort(jamfor)),
    [rader, dim, jamfor, inom, inomKanal],
  )

  /** Kanalen för en grupprad under Kanal när den delas upp i källor, annars null. */
  const underdeladFor = (r: Grupprad): UnderdeladKanal | null => {
    if (dim !== 'kanal') return null
    const k = kanalFranNyckel(r.nyckel)
    return arUnderdelad(k) && inom[k].length > 0 ? k : null
  }

  const fot = dim === 'inom' ? summaAv(inom[inomKanal]) : summa
  const fotText = dim === 'inom' ? `Totalt ${KANAL_LABEL[inomKanal]}` : 'Totalt'

  const sortera = (f: Falt) => {
    if (f === falt) setRiktning((r) => (r === 'asc' ? 'desc' : 'asc'))
    else {
      setFalt(f)
      setRiktning(f === 'namn' ? 'asc' : 'desc')
    }
  }

  const bytDim = (d: Dimension) => {
    setDim(d)
    setAlla(false)
    if (d === 'vecka') {
      setFalt('namn')
      setRiktning('desc')
    } else if (falt === 'namn') {
      setFalt('n')
      setRiktning('desc')
    }
  }

  const visaVarde = summa.varde > 0
  const etikett = dim === 'inom' ? UNDERKALLA_RUBRIK[inomKanal] : (DIMENSIONER.find(([d]) => d === dim)?.[1] ?? '')
  const synliga = alla ? lista : lista.slice(0, TOPP)
  const ingaBokade = summa.n > 0 && summa.bokade === 0

  const exportera = () => {
    // Kanal: AI-assistent och Hänvisning delas upp i en rad per källa så att summan i Excel stämmer
    const medInom = dim === 'kanal' || dim === 'inom'
    const rubriker = [medInom ? 'Kanal' : etikett, ...(medInom ? ['Källa inom kanal (assistent eller webbplats)'] : []), 'Förfrågningar', 'Kontaktade', 'Bokade', 'Andel bokade (%)', 'Vunna', 'Andel vunna av bokade (%)', 'Förlorade efter bokning', 'Förlorade utan bokning', 'Väntar på utfall', 'Värde vunna (kr)']
    const rad = (namn: string, r: StatMatt, kalla?: string) => [
      namn,
      ...(medInom ? [kalla ?? ''] : []),
      r.n,
      r.kontaktade,
      r.bokade,
      r.n ? Math.round((r.bokade / r.n) * 1000) / 10 : '',
      r.vunna,
      r.bokade ? Math.round((r.vunna / r.bokade) * 1000) / 10 : '',
      r.forl_efter,
      r.forl_utan,
      r.pagaende,
      Math.round(r.varde),
    ]
    const kropp =
      dim === 'inom'
        ? lista.map((r) => rad(KANAL_LABEL[inomKanal], r, r.namn))
        : lista.flatMap((r) => {
            const k = underdeladFor(r)
            return k ? inom[k].map((b) => rad(r.namn, b, b.namn)) : [rad(r.namn, r)]
          })
    const filDim = dim === 'inom' ? `inom-${inomKanal}` : dim
    laddaNerCsv(`leads-webb-${filDim}-${fran}-${till}.csv`, rubriker, [...kropp, rad(fotText, fot)])
  }

  const radCeller = (r: StatMatt, stark = false) => (
    <>
      <Cell antal={r.n} stark />
      <Cell antal={r.kontaktade} del={r.kontaktade} av={r.n} stark={stark} />
      <Cell antal={r.bokade} del={r.bokade} av={r.n} stark={stark} />
      <Cell antal={r.vunna} del={r.vunna} av={r.bokade} stark={stark} />
      <Cell antal={r.forl_efter} stark={stark} />
      <Cell antal={r.forl_utan} stark={stark} />
      <Cell antal={r.pagaende} stark={stark} />
      {visaVarde && (
        <td className={`px-2 py-2 text-right align-top whitespace-nowrap tabular-nums ${r.varde ? 'text-slate-200' : 'text-slate-600'}`}>
          {r.varde ? kr(r.varde) : '–'}
        </td>
      )}
    </>
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="max-w-full overflow-x-auto space-y-2">
          <Vaxel etikett="Gruppera på" val={DIMENSIONER} varde={dim} onVal={bytDim} />
          {dim === 'inom' && <Vaxel etikett="Kanal" val={INOM_VAL} varde={inomKanal} onVal={setInomKanal} />}
        </div>
        <button
          type="button"
          onClick={exportera}
          disabled={!lista.length}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Exportera CSV
        </button>
      </div>

      {lista.length === 0 && dim === 'inom' ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {inomKanal === 'ai'
            ? 'Inga förfrågningar från AI-assistenter under perioden. Här listas varje assistent (ChatGPT, Copilot, Perplexity, Gemini med flera) när kunder hittar hit via dem.'
            : 'Inga förfrågningar via hänvisning under perioden. Här listas varje webbplats som skickat besökare (Trustpilot, Reco med flera).'}
        </p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Inga förfrågningar för nyförsäljning under perioden. Tabellen visar hur förfrågningarna går vidare till kontakt, bokning och
          affär när de kommer in.
        </p>
      ) : (
        <>
          {ingaBokade && (
            <p className="mb-3 text-xs text-slate-400 flex items-start gap-2">
              <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 flex-none" aria-hidden="true" />
              Ingen förfrågan under perioden har bokats än. Kolumnerna Bokade, Vunna och Förlorade efter bokning fylls när ett ärende
              skapas eller kopplas från en förfrågan.
            </p>
          )}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <SortRubrik falt="namn" aktiv={falt} riktning={riktning} onSort={sortera} hoger={false}>
                    {etikett}
                  </SortRubrik>
                  <SortRubrik falt="n" aktiv={falt} riktning={riktning} onSort={sortera}>Förfrågningar</SortRubrik>
                  <SortRubrik falt="kontaktade" aktiv={falt} riktning={riktning} onSort={sortera}>Kontaktade</SortRubrik>
                  <SortRubrik falt="bokade" aktiv={falt} riktning={riktning} onSort={sortera}>Bokade</SortRubrik>
                  <SortRubrik falt="vunna" aktiv={falt} riktning={riktning} onSort={sortera}>Vunna</SortRubrik>
                  <SortRubrik falt="forl_efter" aktiv={falt} riktning={riktning} onSort={sortera}>Förl. efter bokning</SortRubrik>
                  <SortRubrik falt="forl_utan" aktiv={falt} riktning={riktning} onSort={sortera}>Förl. utan bokning</SortRubrik>
                  <SortRubrik falt="pagaende" aktiv={falt} riktning={riktning} onSort={sortera}>Väntar på utfall</SortRubrik>
                  {visaVarde && (
                    <SortRubrik falt="varde" aktiv={falt} riktning={riktning} onSort={sortera}>Värde vunna</SortRubrik>
                  )}
                </tr>
              </thead>
              <tbody>
                {synliga.map((r) => {
                  const k = underdeladFor(r)
                  const barn = k ? inom[k] : []
                  const oppen = k != null && oppna.has(k)
                  return (
                    <Fragment key={r.namn}>
                      <tr className="border-b border-slate-700/40 hover:bg-slate-700/10">
                        <td className="px-2 py-2 align-top">
                          <span className="flex items-center gap-2 min-w-0">
                            {ikonFor(dim, r, inomKanal)}
                            {k ? (
                              <button
                                type="button"
                                onClick={() => vaxla(k)}
                                aria-expanded={oppen}
                                className="inline-flex items-center gap-1 min-w-0 text-slate-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
                              >
                                <span className="break-words min-w-0 text-left">{r.namn}</span>
                                <ChevronRight className={`w-3.5 h-3.5 flex-none text-slate-400 transition-transform ${oppen ? 'rotate-90' : ''}`} aria-hidden="true" />
                                <span className="sr-only">{oppen ? ', dölj källorna' : `, visa ${barn.length} källor`}</span>
                              </button>
                            ) : (
                              <span className="text-slate-200 break-words min-w-0">{r.namn}</span>
                            )}
                          </span>
                        </td>
                        {radCeller(r)}
                      </tr>
                      {oppen &&
                        barn.map((b) => (
                          <tr key={`${r.namn}|${b.namn}`} className="border-b border-slate-700/30 bg-slate-900/20 hover:bg-slate-700/10 text-[13px]">
                            <td className="pl-8 pr-2 py-1.5 align-top">
                              <span className="block border-l border-slate-600 pl-2 text-slate-300 break-words">{b.namn}</span>
                            </td>
                            {radCeller(b)}
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600 bg-slate-900/30">
                  <th scope="row" className="px-2 py-2 text-left font-semibold text-white align-top">
                    {fotText}
                  </th>
                  {radCeller(fot, true)}
                </tr>
              </tfoot>
            </table>
          </div>
          {lista.length > TOPP && (
            <button
              type="button"
              onClick={() => setAlla((v) => !v)}
              className="mt-2 text-xs text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
            >
              {alla ? `Visa topp ${TOPP}` : `Visa alla ${tal(lista.length)} rader`}
            </button>
          )}
        </>
      )}
      <p className="text-xs text-slate-500 mt-3">
        Andelen under Kontaktade och Bokade räknas på förfrågningarna, under Vunna på de bokade. Klicka på en kolumnrubrik för att
        sortera.
      </p>
    </div>
  )
}
