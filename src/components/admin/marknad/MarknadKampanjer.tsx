// Per kampanj (tjänst): sorterbar tabell med kostnad, klick, CTR, CPC, konverteringar, kostnad per
// konvertering, bokat, värde, ROAS och status.

import { useMemo, useState } from 'react'
import type { MarknadKampanj } from '../../../services/marknadService'
import { KAMPANJSTATUS, KANALTYP, kr, kvot, procent, tal } from './marknadFormat'
import { Punkt, SortRubrik, Tomt, type Riktning } from './MarknadUi'

type Falt = 'namn' | 'kostnad' | 'klick' | 'ctr' | 'cpc' | 'konv' | 'kpk' | 'bokat' | 'varde' | 'roas' | 'status'

interface Rad extends MarknadKampanj {
  ctr: number | null
  cpc: number | null
  kpk: number | null
  varde: number
  roas: number | null
}

/** "Christian | Sök | Råttor" visas som "Råttor" med resten under. */
function delaNamn(namn: string) {
  const delar = namn.split('|').map((s) => s.trim()).filter(Boolean)
  if (delar.length < 2) return { huvud: namn, under: '' }
  return { huvud: delar[delar.length - 1]!, under: delar.slice(0, -1).join(' | ') }
}

export function KampanjTabell({ kampanjer }: { kampanjer: MarknadKampanj[] }) {
  const [falt, setFalt] = useState<Falt>('kostnad')
  const [riktning, setRiktning] = useState<Riktning>('desc')
  const [visaBorttagna, setVisaBorttagna] = useState(true)

  const rader = useMemo<Rad[]>(() => {
    const r = kampanjer
      .filter((k) => visaBorttagna || k.status !== 'REMOVED')
      .map((k) => {
        const varde = k.genomfort_varde || k.bokat_varde
        return {
          ...k,
          ctr: kvot(k.klick, k.visningar),
          cpc: kvot(k.kostnad, k.klick),
          kpk: k.konverteringar ? k.kostnad / k.konverteringar : null,
          varde,
          roas: varde ? kvot(varde, k.kostnad) : null,
        }
      })
    const val = (x: Rad): number | string => {
      switch (falt) {
        case 'namn': return x.namn.toLowerCase()
        case 'status': return x.status ?? ''
        case 'konv': return x.konverteringar
        case 'bokat': return x.bokat
        default: return (x[falt] as number | null) ?? -1
      }
    }
    return [...r].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const c = typeof va === 'string' ? va.localeCompare(vb as string, 'sv') : va - (vb as number)
      return riktning === 'asc' ? c : -c
    })
  }, [kampanjer, falt, riktning, visaBorttagna])

  const sortera = (f: Falt) => {
    if (f === falt) setRiktning(riktning === 'asc' ? 'desc' : 'asc')
    else {
      setFalt(f)
      setRiktning(f === 'namn' || f === 'status' || f === 'kpk' || f === 'cpc' ? 'asc' : 'desc')
    }
  }

  const antalBorttagna = kampanjer.filter((k) => k.status === 'REMOVED').length
  const sp = { aktiv: falt, riktning, onSort: sortera }

  if (!kampanjer.length) return <Tomt>Ingen kampanjdata för perioden.</Tomt>

  return (
    <div>
      {antalBorttagna > 0 && (
        <label className="inline-flex items-center gap-2 text-xs text-slate-400 mb-3 cursor-pointer">
          <input type="checkbox" className="accent-[#20c58f]" checked={visaBorttagna} onChange={(e) => setVisaBorttagna(e.target.checked)} />
          Visa borttagna kampanjer ({antalBorttagna})
        </label>
      )}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[880px]">
          <thead className="text-xs text-slate-400 border-b border-slate-700">
            <tr>
              <SortRubrik falt="namn" hoger={false} {...sp}>Kampanj</SortRubrik>
              <SortRubrik falt="kostnad" {...sp}>Kostnad</SortRubrik>
              <SortRubrik falt="klick" {...sp}>Klick</SortRubrik>
              <SortRubrik falt="ctr" {...sp}>CTR</SortRubrik>
              <SortRubrik falt="cpc" {...sp}>CPC</SortRubrik>
              <SortRubrik falt="konv" {...sp}>Konv.</SortRubrik>
              <SortRubrik falt="kpk" {...sp}>Kostnad/konv.</SortRubrik>
              <SortRubrik falt="bokat" {...sp}>Bokat</SortRubrik>
              <SortRubrik falt="varde" {...sp}>Värde</SortRubrik>
              <SortRubrik falt="roas" {...sp}>ROAS</SortRubrik>
              <SortRubrik falt="status" hoger={false} {...sp}>Status</SortRubrik>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {rader.map((r) => {
              const n = delaNamn(r.namn)
              const st = KAMPANJSTATUS[r.status ?? ''] ?? { text: r.status ?? '–', farg: 'bg-slate-500' }
              return (
                <tr key={r.campaign_id} className={`hover:bg-slate-800/60 ${r.status === 'REMOVED' ? 'opacity-70' : ''}`}>
                  <td className="px-2 py-2 max-w-[280px]">
                    <div className="text-white truncate" title={r.namn}>{n.huvud}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {[n.under, KANALTYP[r.kanaltyp ?? ''] ?? r.kanaltyp].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-white">{kr(r.kostnad)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{tal(r.klick)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{procent(r.ctr)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{kr(r.cpc, 2)}</td>
                  <td className="px-2 py-2 text-right tabular-nums" title={`Formulär ${tal(r.formular)}, samtal annons ${tal(r.samtal_annons)}, samtal webbplats ${tal(r.samtal_webb)}`}>
                    {tal(r.konverteringar, r.konverteringar % 1 ? 1 : 0)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{kr(r.kpk)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.bokat ? tal(r.bokat) : '–'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.varde ? kr(r.varde) : '–'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.roas != null ? tal(r.roas, 1) : '–'}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
                      <Punkt farg={st.farg} />
                      {st.text}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Konverteringar är kontots primära (formulär, samtal från annons, samtal från webbplatsen). Bokat och värde kommer från
        uppladdade uppdrag ur kundportalen (Bokat uppdrag och Genomfört uppdrag); värdet är genomfört om det finns, annars bokat, exkl. moms.
        ROAS = värde delat med kostnad.
      </p>
    </div>
  )
}
