// src/pages/shared/intranet/interactive/tillagg/TillaggJamforelse.tsx
// Guiden Tilläggsstationer: de två besluten sida vid sida. Texterna följer
// AddonDropPrompt och ContractScopeService (addAddonStationsSeparate,
// addAddonStationsToPremium, decideAddonLabour).

const RADER: { fraga: string; tillagg: string; iAvtalet: string }[] = [
  { fraga: 'När väljs det?', tillagg: 'Förvalt. Välj det om inget annat är sagt med kunden.', iAvtalet: 'När kunden och vi är överens om att stationerna ska ingå i avtalet.' },
  { fraga: 'Årspremien', tillagg: 'Rörs inte.', iAvtalet: 'Höjs med stationerna och arbetstiden, från datumet du väljer i Gäller från.' },
  { fraga: 'Faktura', tillagg: 'Egen faktura i samband med avtalets årsfaktura, varje avtalsår.', iAvtalet: 'Ingen egen faktura. Tillägget faktureras med avtalet.' },
  { fraga: 'Avtalets innehåll', tillagg: 'Oförändrat. Tillägget ligger bredvid avtalet, i § 5.', iAvtalet: 'Stationerna och arbetstiden blir en del av avtalet. Kostnaden läggs i § 4.' },
  { fraga: 'Antal stationer', tillagg: 'Räknas om före varje faktura. Färre stationer ger lägre belopp.', iAvtalet: 'Ingår i premien.' },
  { fraga: 'När slutar det?', tillagg: 'När avtalet slutar.', iAvtalet: 'Som resten av avtalet.' },
]

export default function TillaggJamforelse() {
  return (
    <div className="my-6">
      {/* Bred skärm: tabell */}
      <div className="hidden sm:block p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-[22%] pb-2 border-b border-slate-700" />
              <th className="text-left pb-2 px-3 border-b border-slate-700 text-[#20c58f] font-semibold">Tillägg utöver avtalet</th>
              <th className="text-left pb-2 px-3 border-b border-slate-700 text-white font-semibold">Lägg till i avtalet</th>
            </tr>
          </thead>
          <tbody>
            {RADER.map((r) => (
              <tr key={r.fraga} className="border-b border-slate-700/50 last:border-0 align-top">
                <td className="py-2 pr-3 text-xs font-medium text-slate-400">{r.fraga}</td>
                <td className="py-2 px-3 text-slate-300 leading-relaxed">{r.tillagg}</td>
                <td className="py-2 px-3 text-slate-300 leading-relaxed">{r.iAvtalet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil: två kort */}
      <div className="sm:hidden space-y-3">
        {[
          { rubrik: 'Tillägg utöver avtalet', ton: 'text-[#20c58f]', key: 'tillagg' as const },
          { rubrik: 'Lägg till i avtalet', ton: 'text-white', key: 'iAvtalet' as const },
        ].map((k) => (
          <div key={k.key} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className={`text-sm font-semibold mb-2 ${k.ton}`}>{k.rubrik}</p>
            <dl className="space-y-1.5">
              {RADER.map((r) => (
                <div key={r.fraga}>
                  <dt className="text-xs font-medium text-slate-400">{r.fraga}</dt>
                  <dd className="text-sm text-slate-300 leading-relaxed">{r[k.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
