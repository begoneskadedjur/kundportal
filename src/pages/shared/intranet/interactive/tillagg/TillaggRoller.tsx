// src/pages/shared/intranet/interactive/tillagg/TillaggRoller.tsx
// Guiden Tilläggsstationer: rollerna som kort och en "vem gör vad"-tabell
// över kedjans åtta steg. Tabell på bred skärm, lista per steg på mobil.

import { RoleTag } from './tillaggShared'
import { ROLE_CONFIG, ROLE_ORDER, type TillaggRole } from './tillaggRoles'
import { STEG } from './tillaggSteg'

const ROLLKORT: Record<TillaggRole, { vem: string; gor: string[] }> = {
  koordinator: {
    vem: 'Den som bokar i schemat.',
    gor: ['Bokar etableringsärendet på rätt enhet hos avtalskunden.'],
  },
  tekniker: {
    vem: 'Den som är på plats hos kunden.',
    gor: [
      'Sätter ut stationen och kryssar i Tillägg utöver avtal.',
      'Väljer per år, per månad eller per kontroll, och vilken produkt som sattes ut.',
      'Svarar på frågan om arbetstid i timmar per år när ärendet avslutas.',
      'Stänger ärendet med Färdig med etablering.',
    ],
  },
  fakturering: {
    vem: 'Den som har behörigheten att godkänna fakturor. Behörigheten sätts per person, inte per roll.',
    gor: [
      'Får notisen Tillägg att besluta.',
      'Beslutar tilläggen i avtalskartan: Tillägg utöver avtalet eller Lägg till i avtalet.',
      'Godkänner och skickar fakturorna.',
    ],
  },
  systemet: {
    vem: 'Portalen, utan att någon trycker på något.',
    gor: [
      'Hämtar priset ur kundens prislista.',
      'Räknar ut vad som betalas nu och skapar fakturaraderna.',
      'Planerar tilläggsfakturan varje avtalsår.',
    ],
  },
}

export default function TillaggRoller() {
  return (
    <div className="my-6 space-y-4">
      {/* Rollkort */}
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
            <RoleTag role={r} className="text-sm" />
            <p className="text-xs text-slate-400 mt-1">{ROLLKORT[r].vem}</p>
            <ul className="mt-2 space-y-1">
              {ROLLKORT[r].gor.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                  <span className={`w-1.5 h-1.5 rounded-full ${ROLE_CONFIG[r].dot} mt-2 flex-shrink-0`} aria-hidden />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Vem gör vad: tabell på bred skärm */}
      <div className="hidden sm:block p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <p className="text-sm font-semibold text-white mb-3">Vem gör vad i varje steg</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="text-left font-medium pb-2 border-b border-slate-700">Steg</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className={`text-center font-medium pb-2 px-2 border-b border-slate-700 ${ROLE_CONFIG[r].text}`}>
                  {ROLE_CONFIG[r].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STEG.map((s, i) => (
              <tr key={i} className="border-b border-slate-700/50 last:border-0">
                <td className="py-2 pr-2 text-slate-300">
                  <span className="text-slate-500 tabular-nums mr-1.5">{i + 1}.</span>
                  {s.title}
                </td>
                {ROLE_ORDER.map((r) => {
                  const idx = s.roles.indexOf(r)
                  return (
                    <td key={r} className="py-2 px-2 text-center">
                      {idx >= 0 ? (
                        <span
                          className={`inline-block rounded-full ${ROLE_CONFIG[r].dot} ${idx === 0 ? 'w-3 h-3' : 'w-2 h-2 opacity-60'}`}
                          title={idx === 0 ? 'Gör steget' : 'Är med'}
                        />
                      ) : (
                        <span className="text-slate-700" aria-hidden>·</span>
                      )}
                      <span className="sr-only">{idx === 0 ? 'Gör steget' : idx > 0 ? 'Är med' : 'Inte med'}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">Stor punkt: gör steget. Liten punkt: är med.</p>
      </div>

      {/* Vem gör vad: lista på mobil */}
      <div className="sm:hidden p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <p className="text-sm font-semibold text-white mb-2">Vem gör vad i varje steg</p>
        <ol className="space-y-2">
          {STEG.map((s, i) => (
            <li key={i} className="pb-2 border-b border-slate-700/50 last:border-0 last:pb-0">
              <p className="text-sm text-slate-300">
                <span className="text-slate-500 tabular-nums mr-1.5">{i + 1}.</span>
                {s.title}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {s.roles.map((r) => (
                  <RoleTag key={r} role={r} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
