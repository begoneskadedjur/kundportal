// Webbförfrågningar per källa och tjänst, utfall (vunnen, förlorad, pågår) och andel med samtycke
// till marknadsföring. Plus kohorten: vad förfrågningarna under perioden har blivit hittills.

import type { MarknadLeads, MarknadUtfall, UtfallGrupp } from '../../../services/marknadService'
import { KALLA_NAMN, kr, kvot, procent, tal, tjanstNamn } from './marknadFormat'
import { Punkt, Tomt } from './MarknadUi'

const KALLA_PUNKT: Record<string, string> = {
  google_ads: 'bg-[#20c58f]',
  organiskt: 'bg-sky-400',
  direkt: 'bg-slate-400',
  ovrigt: 'bg-violet-400',
}

function Utfall({ vunnen, forlorad, pagar }: { vunnen: number; forlorad: number; pagar: number }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      <span className="inline-flex items-center gap-1 text-slate-300"><Punkt farg="bg-[#20c58f]" />{tal(vunnen)} vunna</span>
      <span className="inline-flex items-center gap-1 text-slate-300"><Punkt farg="bg-red-400" />{tal(forlorad)} förlorade</span>
      <span className="inline-flex items-center gap-1 text-slate-300"><Punkt farg="bg-amber-400" />{tal(pagar)} pågår</span>
    </span>
  )
}

function UtfallKolumn({ titel, g }: { titel: string; g: UtfallGrupp }) {
  return (
    <div className="bg-slate-900/40 border border-slate-700/70 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-2">{titel}</div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Förfrågningar</dt>
          <dd className="text-white font-semibold tabular-nums">{tal(g.forfragningar)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Bokade</dt>
          <dd className="text-white font-semibold tabular-nums">{tal(g.bokat)}</dd>
          <dd className="text-xs text-slate-400 tabular-nums">{g.bokat_varde ? kr(g.bokat_varde) : '–'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Genomförda</dt>
          <dd className="text-white font-semibold tabular-nums">{tal(g.genomfort)}</dd>
          <dd className="text-xs text-slate-400 tabular-nums">{g.genomfort_varde ? kr(g.genomfort_varde) : '–'}</dd>
        </div>
      </dl>
    </div>
  )
}

export function LeadsSektion({ leads, utfall }: { leads: MarknadLeads; utfall: MarknadUtfall | null }) {
  if (!leads.totalt) return <Tomt>Inga webbförfrågningar under perioden.</Tomt>
  const samtyckeAndel = kvot(leads.samtycke_ej_skrap, leads.samtycke_underlag)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-slate-300"><span className="text-white font-semibold tabular-nums">{tal(leads.totalt)}</span> förfrågningar</span>
        <span className="text-slate-300"><span className="text-white font-semibold tabular-nums">{tal(leads.skrap)}</span> skräp</span>
        <span className="text-slate-300">
          <span className="text-white font-semibold tabular-nums">{procent(samtyckeAndel, 0)}</span> med samtycke till marknadsföring
          <span className="text-slate-500"> ({tal(leads.samtycke_ej_skrap)} av {tal(leads.samtycke_underlag)} utom skräp)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="min-w-0">
          <h3 className="text-xs font-medium text-slate-300 mb-2">Per källa</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead className="text-xs text-slate-400 border-b border-slate-700">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left font-medium">Källa</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Antal</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">Utfall</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Samtycke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {leads.per_kalla.map((k) => (
                  <tr key={k.kalla}>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-2 text-white"><Punkt farg={KALLA_PUNKT[k.kalla] ?? 'bg-slate-500'} />{KALLA_NAMN[k.kalla] ?? k.kalla}</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-white">{tal(k.antal)}</td>
                    <td className="px-2 py-2"><Utfall vunnen={k.vunnen} forlorad={k.forlorad} pagar={k.pagar} /></td>
                    <td className="px-2 py-2 text-right tabular-nums">{procent(kvot(k.samtycke, k.antal - k.skrap), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Google Ads: klick-id (gclid, gbraid, wbraid) eller utm_source google med utm_medium cpc. Organisk: hänvisning från en sökmotor.
            Direkt: ingen hänvisning.
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="text-xs font-medium text-slate-300 mb-2">Per tjänst</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead className="text-xs text-slate-400 border-b border-slate-700">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left font-medium">Tjänst</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Antal</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Varav Ads</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">Utfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {leads.per_tjanst.map((t) => (
                  <tr key={t.tjanst}>
                    <td className="px-2 py-2 text-white">{tjanstNamn(t.tjanst)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-white">{tal(t.antal)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{tal(t.google_ads)}</td>
                    <td className="px-2 py-2"><Utfall vunnen={t.vunnen} forlorad={t.forlorad} pagar={t.pagar} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {utfall && (
        <div>
          <h3 className="text-xs font-medium text-slate-300 mb-2">Vad förfrågningarna har blivit</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UtfallKolumn titel="Från Google Ads" g={utfall.google_ads} />
            <UtfallKolumn titel="Alla källor" g={utfall.alla} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Förfrågningar som kom in under perioden, utom skräp och befintliga kunder. Bokad = ärende bokat eller offert signerad,
            genomförd = vunnen och fakturerad. Belopp exkl. moms.
          </p>
        </div>
      )}
    </div>
  )
}
