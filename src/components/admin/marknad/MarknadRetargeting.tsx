// Retargeting på sidan Marknad: besökslistornas storlek ("Christian | Besökare | ...") och
// "Lönar det sig?", där varje lista som är kopplad till en kampanj (som observation) jämförs med
// kampanjens övriga trafik: kampanjens totaler minus listan. Data från marknad_retargeting().
//
// Slutsatsen är medvetet försiktig: minst 30 klick och 3 konverteringar per grupp innan något sägs,
// och skillnaden i konverteringsgrad måste klara ett enkelt tvåprovstest (z ≥ 1,96, ungefär 95 %).

import { useEffect, useMemo, useState } from 'react'
import { marknadService, type MarknadRetargeting, type RetargetingJamforelse, type RetargetingLista, type RetargetingVarden } from '../../../services/marknadService'
import { datumTid, kr, kvot, procent, tal } from './marknadFormat'
import { Punkt, Tomt } from './MarknadUi'
import { useDiagramFarger } from './useDiagramFarger'

/** Googles gräns: en lista behöver minst cirka 1 000 aktiva användare för att kunna användas i sök. */
const SOKGRANS = 1000
const MIN_KLICK = 30
const MIN_KONV = 3
/** Konverteringsvärdet är 1 kr per konvertering tills riktiga belopp (Bokat uppdrag) är primära. */
const MIN_VARDE_PER_KONV = 10

const kortNamn = (namn: string) => namn.replace(/^Christian \| Besökare \| /, '')
const kampanjKort = (namn: string) => namn.split('|').map((s) => s.trim()).filter(Boolean).pop() ?? namn

type Lage = 'lonsamt' | 'inte' | 'osaker' | 'data'

const LAGE: Record<Lage, { text: string; farg: string }> = {
  lonsamt: { text: 'Lönsamt', farg: 'bg-[#20c58f]' },
  inte: { text: 'Inte lönsamt', farg: 'bg-red-400' },
  osaker: { text: 'Ingen säker skillnad', farg: 'bg-slate-400' },
  data: { text: 'För lite data', farg: 'bg-amber-400' },
}

interface Bedomning {
  lage: Lage
  text: string
}

const konvGrad = (v: RetargetingVarden) => (v.klick ? Math.min(v.konverteringar / v.klick, 1) : null)
const kpk = (v: RetargetingVarden) => kvot(v.kostnad, v.konverteringar)
const avkastning = (v: RetargetingVarden) =>
  v.konverteringar && v.konverteringsvarde / v.konverteringar >= MIN_VARDE_PER_KONV ? kvot(v.konverteringsvarde, v.kostnad) : null

function ganger(x: number) {
  return `${tal(x, x < 10 ? 1 : 0)} gånger`
}

function bedom(l: RetargetingVarden, o: RetargetingVarden): Bedomning {
  if (l.klick < MIN_KLICK || o.klick < MIN_KLICK || l.konverteringar < MIN_KONV || o.konverteringar < MIN_KONV) {
    return {
      lage: 'data',
      text:
        `För lite data än (behöver minst ${MIN_KLICK} klick och ${MIN_KONV} konverteringar per grupp; ` +
        `nu ${tal(l.klick)} klick och ${tal(l.konverteringar, l.konverteringar % 1 ? 1 : 0)} konv. på listan, ` +
        `${tal(o.klick)} klick och ${tal(o.konverteringar, o.konverteringar % 1 ? 1 : 0)} konv. övriga).`,
    }
  }
  const rl = konvGrad(l)!
  const ro = konvGrad(o)!
  const p = Math.min((l.konverteringar + o.konverteringar) / (l.klick + o.klick), 1)
  const se = Math.sqrt(p * (1 - p) * (1 / l.klick + 1 / o.klick))
  const z = se > 0 ? (rl - ro) / se : 0
  const kl = kpk(l)!
  const ko = kpk(o)!
  const faktor = ro > 0 ? rl / ro : null
  const kostnadDiff = ko > 0 ? (ko - kl) / ko : 0

  if (Math.abs(z) < 1.96) {
    const riktning = faktor == null ? '' : faktor >= 1 ? `återkommande konverterar ${ganger(faktor)} så ofta, ` : `återkommande konverterar ${procent(1 - faktor, 0)} mer sällan, `
    return { lage: 'osaker', text: `Ingen säker skillnad än: ${riktning}men skillnaden kan vara slump. Vänta på mer data.` }
  }
  if (kl < ko && rl > ro) {
    return {
      lage: 'lonsamt',
      text: `Lönsamt: återkommande konverterar ${faktor ? ganger(faktor) : ''} bättre till ${procent(kostnadDiff, 0)} lägre kostnad per konvertering.`,
    }
  }
  if (kl < ko) {
    return { lage: 'lonsamt', text: `Lönsamt: återkommande kostar ${procent(kostnadDiff, 0)} mindre per konvertering.` }
  }
  return {
    lage: 'inte',
    text:
      rl < ro
        ? `Inte lönsamt: återkommande konverterar ${procent(1 - rl / ro, 0)} mer sällan och kostar ${procent(-kostnadDiff, 0)} mer per konvertering.`
        : `Inte lönsamt: återkommande konverterar ${faktor ? ganger(faktor) : ''} så ofta men kostar ${procent(-kostnadDiff, 0)} mer per konvertering.`,
  }
}

function Sparklinje({ punkter, farg }: { punkter: Array<number | null>; farg: string }) {
  const v = punkter.map((p) => p ?? 0)
  if (v.length < 2) return null
  const max = Math.max(...v, 1)
  const b = 64
  const h = 18
  const d = v.map((y, i) => `${((i / (v.length - 1)) * b).toFixed(1)},${(h - 1 - (y / max) * (h - 2)).toFixed(1)}`).join(' ')
  return (
    <svg width={b} height={h} viewBox={`0 0 ${b} ${h}`} aria-hidden="true" className="inline-block align-middle">
      <polyline points={d} fill="none" stroke={farg} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Matare({ storlek }: { storlek: number | null }) {
  const andel = Math.min((storlek ?? 0) / SOKGRANS, 1)
  return (
    <div className="relative h-1.5 w-24 rounded-full bg-slate-700/70 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-y-0 left-0 rounded-full bg-[#20c58f]" style={{ width: `${andel * 100}%` }} />
    </div>
  )
}

function ListTabell({ listor }: { listor: RetargetingLista[] }) {
  const f = useDiagramFarger()
  if (!listor.length) return <Tomt>Inga besökslistor hämtade än. Nattjobbet hämtar storleken varje natt.</Tomt>
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="text-xs text-slate-400 border-b border-slate-700">
          <tr>
            <th scope="col" className="px-2 py-2 text-left font-medium">Lista</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Sök</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Mot 1 000 i sök</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Display</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Förändring</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Trend (sök)</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Läge</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {listor.map((l) => {
            const sok = l.storlek_sok ?? 0
            const nadd = sok >= SOKGRANS
            const diff = l.start_storlek_sok != null && l.start_datum && l.start_datum < l.datum ? sok - l.start_storlek_sok : null
            const forfragan = /förfrågan/i.test(l.namn)
            return (
              <tr key={l.user_list_id} className="hover:bg-slate-800/60" title={`Senast hämtad ${l.datum}. Googles intervall i sök: ${l.storleksintervall_sok ?? '–'}.`}>
                <td className="px-2 py-2">
                  <div className="text-white">{kortNamn(l.namn)}</div>
                  {forfragan && <div className="text-xs text-slate-500">uteslutning senare, inte observation</div>}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-white">{tal(l.storlek_sok)}</td>
                <td className="px-2 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Matare storlek={l.storlek_sok} />
                    <span className="text-xs text-slate-400 tabular-nums">{procent(Math.min(sok / SOKGRANS, 1), 0)}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{tal(l.storlek_display)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                  {diff == null ? '–' : `${diff > 0 ? '+' : ''}${tal(diff)}`}
                </td>
                <td className="px-2 py-2">
                  <Sparklinje punkter={l.trend.map((t) => t.sok)} farg={f.dampad} />
                </td>
                <td className="px-2 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
                    <Punkt farg={nadd ? 'bg-[#20c58f]' : 'bg-amber-400'} />
                    {nadd ? 'Kan användas i sök' : 'Fylls, under 1 000'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Grupprad({ etikett, v, fet }: { etikett: string; v: RetargetingVarden; fet?: boolean }) {
  const a = avkastning(v)
  return (
    <tr>
      <td className={`px-2 py-1 text-xs ${fet ? 'text-white' : 'text-slate-400'}`}>{etikett}</td>
      <td className="px-2 py-1 text-right tabular-nums">{tal(v.klick)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{procent(kvot(v.klick, v.visningar))}</td>
      <td className="px-2 py-1 text-right tabular-nums">{tal(v.konverteringar, v.konverteringar % 1 ? 1 : 0)}</td>
      <td className="px-2 py-1 text-right tabular-nums text-white">{procent(konvGrad(v))}</td>
      <td className="px-2 py-1 text-right tabular-nums text-white">{kr(kpk(v))}</td>
      <td className="px-2 py-1 text-right tabular-nums">{a != null ? tal(a, 1) : '–'}</td>
    </tr>
  )
}

function Jamforelse({ rader }: { rader: RetargetingJamforelse[] }) {
  const sorterade = useMemo(
    () =>
      [...rader].sort((a, b) => {
        const k = kampanjKort(a.kampanj).localeCompare(kampanjKort(b.kampanj), 'sv')
        if (k) return k
        const alla = (x: RetargetingJamforelse) => (kortNamn(x.lista) === 'Alla' ? 0 : 1)
        return alla(a) - alla(b) || a.lista.localeCompare(b.lista, 'sv')
      }),
    [rader],
  )
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="text-xs text-slate-400 border-b border-slate-700">
          <tr>
            <th scope="col" className="px-2 py-2 text-left font-medium">Kampanj och lista</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Klick</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">CTR</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Konv.</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Konv.grad</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Kostnad/konv.</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Avkastning</th>
          </tr>
        </thead>
        {sorterade.map((r) => {
          const b = bedom(r.lista_varden, r.ovriga)
          const st = LAGE[b.lage]
          const lista = kortNamn(r.lista)
          return (
            <tbody key={`${r.campaign_id}-${r.criterion_id}`} className="border-b border-slate-700/60">
              <tr>
                <td colSpan={7} className="px-2 pt-3 pb-1">
                  <span className="text-white font-medium">{kampanjKort(r.kampanj)}</span>
                  <span className="text-slate-400"> · lista {lista}</span>
                  <span className="text-xs text-slate-500"> · från {r.fran}</span>
                  {r.bud_justering != null && r.bud_justering !== 1 && (
                    <span className="text-xs text-amber-400/90"> · budjustering {tal((r.bud_justering - 1) * 100, 0)} %</span>
                  )}
                </td>
              </tr>
              <Grupprad etikett={lista === 'Alla' ? 'Återkommande (på listan)' : `Besökt ${lista.toLowerCase()} (på listan)`} v={r.lista_varden} fet />
              <Grupprad etikett={lista === 'Alla' ? 'Nya besökare (övriga)' : 'Övriga i kampanjen'} v={r.ovriga} />
              <tr>
                <td colSpan={7} className="px-2 pt-1 pb-3">
                  <span className="inline-flex items-start gap-1.5 text-xs text-slate-300">
                    <span className="mt-1"><Punkt farg={st.farg} /></span>
                    <span>{b.text}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

export function RetargetingSektion({ fran, till }: { fran: string; till: string }) {
  const [data, setData] = useState<MarknadRetargeting | null>(null)
  const [fel, setFel] = useState<string | null>(null)

  useEffect(() => {
    let aktiv = true
    marknadService
      .retargeting(fran, till)
      .then((d) => {
        if (!aktiv) return
        setData(d)
        setFel(null)
      })
      .catch((e: Error) => {
        if (aktiv) setFel(e.message)
      })
    return () => {
      aktiv = false
    }
  }, [fran, till])

  if (fel) return <div className="text-sm text-red-400">{fel}</div>
  if (!data) return <div className="py-8 text-center text-sm text-slate-500">Laddar …</div>

  const avkastningSaknas = data.jamforelse.every((r) => avkastning(r.lista_varden) == null && avkastning(r.ovriga) == null)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-white">Besökslistornas storlek</h3>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">
          Antal besökare på varje lista enligt Google, hämtat varje natt. En lista behöver minst cirka 1 000 aktiva användare för att
          kunna användas i sökannonser (Googles gräns); under den visas storleken ofta som 0. Listorna fylls bara med besökare som har
          godkänt Marknadsföring i cookiebannern.
          {data.data.listor_hamtad_at && <> Senast hämtad {datumTid(data.data.listor_hamtad_at)}.</>}
        </p>
        <ListTabell listor={data.listor} />
      </div>

      <div>
        <h3 className="text-sm font-medium text-white">Lönar det sig?</h3>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">
          Varje lista som är kopplad till en kampanj som observation jämförs med kampanjens övriga trafik (kampanjen minus listan, från
          dagen listan fick data). För listan Alla betyder det återkommande mot nya besökare. Lönsamt betyder att återkommande ger
          konverteringar billigare, och att det kan vara värt att bjuda upp dem. Slutsatsen kräver minst {MIN_KLICK} klick och{' '}
          {MIN_KONV} konverteringar per grupp och att skillnaden i konverteringsgrad inte rimligen är slump (ungefär 95 % säkerhet).
        </p>
        {data.jamforelse.length === 0 ? (
          <Tomt>Listorna fylls nu. Jämförelsen startar när listorna har kopplats till kampanjerna som observation.</Tomt>
        ) : (
          <>
            <Jamforelse rader={data.jamforelse} />
            <p className="mt-3 text-xs text-slate-500">
              Konverteringar är kontots primära (formulär och samtal). Listorna överlappar: en besökare kan finnas på både Alla och en
              tjänstelista. Små tal svänger mycket; en enstaka konvertering kan ändra slutsatsen.
              {avkastningSaknas && (
                <> Avkastning (värde delat med kostnad) visas när konverteringarna har riktiga belopp; i dag är värdet 1 kr per konvertering tills Bokat uppdrag blir primärt.</>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
