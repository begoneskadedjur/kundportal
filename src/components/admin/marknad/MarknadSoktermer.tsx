// Topp söktermer (kostnad) för perioden, från google_ads_sokterm_vecka. Veckodata: perioden rundas
// ner till måndagen, så första veckan kan räknas med i sin helhet.

import type { MarknadSoktermer } from '../../../services/marknadService'
import { kortDatum, kr, tal } from './marknadFormat'
import { Tomt } from './MarknadUi'

export function SoktermTabell({ data }: { data: MarknadSoktermer }) {
  if (!data.rader.length) return <Tomt>Inga söktermer med klick under perioden.</Tomt>
  return (
    <div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="text-xs text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-800">
            <tr>
              <th scope="col" className="px-2 py-2 text-left font-medium">Sökterm</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Kostnad</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Klick</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Konv.</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Kampanj</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {data.rader.map((r) => (
              <tr key={r.sokterm}>
                <td className="px-2 py-1.5 text-white">{r.sokterm}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{kr(r.kostnad)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tal(r.klick)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.konverteringar ? tal(r.konverteringar, r.konverteringar % 1 ? 1 : 0) : '–'}</td>
                <td className="px-2 py-1.5 text-xs text-slate-400 max-w-[260px] truncate" title={r.kampanjer}>{r.kampanjer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {tal(data.antal_termer)} söktermer med klick sedan veckan {kortDatum(data.fran_vecka)}. Visar de {data.rader.length} dyraste.
      </p>
    </div>
  )
}
