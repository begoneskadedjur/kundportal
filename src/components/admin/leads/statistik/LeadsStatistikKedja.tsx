// src/components/admin/leads/statistik/LeadsStatistikKedja.tsx
// Kedjan i Leads-statistiken: skapade, kontaktade, besök bokat, offert, vunna, förlorade och pågående
// per källa eller per ursprung (ärendetyp), för leads skapade i perioden. Raderna kommer färdigräknade
// från RPC:n lead_statistik. Samma tabellstil som WebLeadsKedja: sorterbara kolumner, andel med tunn
// stapel under talet, nollor nedtonade, summeringsrad och CSV-export.
// Ett steg räknas som nått om leaden någon gång varit där (historiken, kopplingarna eller steget nu).

import { useMemo, useState } from 'react'
import { Icon } from '../../../icons/Icon'
import { SortRubrik, type Riktning } from '../../marknad/MarknadUi'
import { kr, tal } from '../../marknad/marknadFormat'
import { andelText, laddaNerCsv } from '../../webLeads/statistik/statistikData'
import { Andelsstapel, Vaxel } from '../../webLeads/statistik/StatistikUi'
import type { LeadStatKedja } from '../../../../types/leads'
import { kedjaNamn, type KedjaDimension } from './leadsStatistikFormat'

type Falt = 'namn' | 'skapade' | 'kontaktade' | 'besok' | 'offert' | 'vunna' | 'forlorade' | 'oppna' | 'vunnen_premie'
type Rad = LeadStatKedja & { namn: string }

const DIMENSIONER: Array<[KedjaDimension, string]> = [
  ['kalla', 'Källa'],
  ['ursprung', 'Ursprung'],
]

const TOM: LeadStatKedja = { nyckel: '', skapade: 0, kontaktade: 0, besok: 0, offert: 0, vunna: 0, forlorade: 0, oppna: 0, vunnen_premie: 0 }

function summa(rader: LeadStatKedja[]): LeadStatKedja {
  return rader.reduce(
    (s, r) => ({
      ...s,
      skapade: s.skapade + r.skapade,
      kontaktade: s.kontaktade + r.kontaktade,
      besok: s.besok + r.besok,
      offert: s.offert + r.offert,
      vunna: s.vunna + r.vunna,
      forlorade: s.forlorade + r.forlorade,
      oppna: s.oppna + r.oppna,
      vunnen_premie: s.vunnen_premie + Number(r.vunnen_premie),
    }),
    TOM,
  )
}

function Cell({ antal, av, stark }: { antal: number; av?: number; stark?: boolean }) {
  return (
    <td className="px-2 py-2 text-right align-top whitespace-nowrap">
      <span className={`tabular-nums ${antal ? (stark ? 'text-white font-medium' : 'text-slate-200') : 'text-slate-600'}`}>{tal(antal)}</span>
      {av != null && (
        <div className="mt-1 ml-auto w-16">
          <div className={`text-[11px] leading-none mb-0.5 tabular-nums ${antal ? 'text-slate-400' : 'text-slate-600'}`}>{av ? andelText(antal, av) : '–'}</div>
          <Andelsstapel andel={av ? antal / av : 0} />
        </div>
      )}
    </td>
  )
}

export default function LeadsStatistikKedja({
  kalla,
  ursprung,
  fran,
  till,
}: {
  kalla: LeadStatKedja[]
  ursprung: LeadStatKedja[]
  fran: string
  till: string
}) {
  const [dim, setDim] = useState<KedjaDimension>('kalla')
  const [falt, setFalt] = useState<Falt>('skapade')
  const [riktning, setRiktning] = useState<Riktning>('desc')

  const lista: Rad[] = useMemo(() => {
    const kalla_ = dim === 'kalla' ? kalla : ursprung
    const tecken = riktning === 'asc' ? 1 : -1
    return kalla_
      .map((r) => ({ ...r, vunnen_premie: Number(r.vunnen_premie), namn: kedjaNamn(dim, r.nyckel) }))
      .sort((a, b) => {
        if (falt === 'namn') return tecken * a.namn.localeCompare(b.namn, 'sv')
        return tecken * (a[falt] - b[falt]) || a.namn.localeCompare(b.namn, 'sv')
      })
  }, [dim, kalla, ursprung, falt, riktning])

  const fot = useMemo(() => summa(lista), [lista])
  const etikett = dim === 'kalla' ? 'Källa' : 'Ursprung'

  const sortera = (f: Falt) => {
    if (f === falt) setRiktning((r) => (r === 'asc' ? 'desc' : 'asc'))
    else {
      setFalt(f)
      setRiktning(f === 'namn' ? 'asc' : 'desc')
    }
  }

  const exportera = () => {
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : '')
    const rad = (namn: string, r: LeadStatKedja) => [
      namn,
      r.skapade,
      r.kontaktade,
      pct(r.kontaktade, r.skapade),
      r.besok,
      r.offert,
      pct(r.offert, r.skapade),
      r.vunna,
      pct(r.vunna, r.skapade),
      r.forlorade,
      r.oppna,
      Math.round(Number(r.vunnen_premie)),
    ]
    laddaNerCsv(
      `leads-kedja-${dim}-${fran}-${till}.csv`,
      [etikett, 'Skapade', 'Kontaktade', 'Andel kontaktade (%)', 'Besök bokat', 'Offert', 'Andel offert (%)', 'Vunna', 'Andel vunna (%)', 'Förlorade', 'Pågående', 'Vunnen årspremie (kr)'],
      [...lista.map((r) => rad(r.namn, r)), rad('Totalt', fot)],
    )
  }

  const celler = (r: LeadStatKedja, stark = false) => (
    <>
      <Cell antal={r.skapade} stark />
      <Cell antal={r.kontaktade} av={r.skapade} stark={stark} />
      <Cell antal={r.besok} av={r.skapade} stark={stark} />
      <Cell antal={r.offert} av={r.skapade} stark={stark} />
      <Cell antal={r.vunna} av={r.skapade} stark={stark} />
      <Cell antal={r.forlorade} stark={stark} />
      <Cell antal={r.oppna} stark={stark} />
      <td className={`px-2 py-2 text-right align-top whitespace-nowrap tabular-nums ${r.vunnen_premie ? 'text-slate-200' : 'text-slate-600'}`}>
        {r.vunnen_premie ? kr(Number(r.vunnen_premie)) : '–'}
      </td>
    </>
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <Vaxel etikett="Gruppera på" val={DIMENSIONER} varde={dim} onVal={setDim} />
        <button
          type="button"
          onClick={exportera}
          disabled={!lista.length}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
        >
          <Icon name="allman.ladda-ner" size={16} /> Exportera CSV
        </button>
      </div>

      {lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Inga leads skapades under perioden.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <SortRubrik falt="namn" aktiv={falt} riktning={riktning} onSort={sortera} hoger={false}>{etikett}</SortRubrik>
                <SortRubrik falt="skapade" aktiv={falt} riktning={riktning} onSort={sortera}>Skapade</SortRubrik>
                <SortRubrik falt="kontaktade" aktiv={falt} riktning={riktning} onSort={sortera}>Kontaktade</SortRubrik>
                <SortRubrik falt="besok" aktiv={falt} riktning={riktning} onSort={sortera}>Besök bokat</SortRubrik>
                <SortRubrik falt="offert" aktiv={falt} riktning={riktning} onSort={sortera}>Offert</SortRubrik>
                <SortRubrik falt="vunna" aktiv={falt} riktning={riktning} onSort={sortera}>Vunna</SortRubrik>
                <SortRubrik falt="forlorade" aktiv={falt} riktning={riktning} onSort={sortera}>Förlorade</SortRubrik>
                <SortRubrik falt="oppna" aktiv={falt} riktning={riktning} onSort={sortera}>Pågående</SortRubrik>
                <SortRubrik falt="vunnen_premie" aktiv={falt} riktning={riktning} onSort={sortera}>Vunnen årspremie</SortRubrik>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.nyckel} className="border-b border-slate-700/40 hover:bg-slate-700/10">
                  <td className="px-2 py-2 align-top text-slate-200 break-words">{r.namn}</td>
                  {celler(r)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 bg-slate-900/30">
                <th scope="row" className="px-2 py-2 text-left font-semibold text-white align-top">Totalt</th>
                {celler(fot, true)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">
        Leads skapade under perioden. Andelarna räknas på de skapade. Ett steg räknas som nått om leaden någon gång varit där, även om den
        sedan gått vidare eller förlorats. Klicka på en kolumnrubrik för att sortera.
      </p>
    </div>
  )
}
