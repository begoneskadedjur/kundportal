// src/pages/shared/intranet/interactive/tillagg/TillaggKedja.tsx
// Guiden Tilläggsstationer: hela kedjan som en lodrät tidslinje. Varje steg
// visar vem som gör det (rollens färg på punkten och etiketten), vad som
// händer och en förenklad skärmbild. Fakta kontrollerade mot koden
// 2026-09-30: addonStationBillingService, sync_addon_prorata_line,
// AddonLabourStep, createAdHocItemsFromCase, AddonDropPrompt,
// generate-continuing-contracts och contractPlanner.rollingHorizonEnd.

import { RoleTag } from './tillaggShared'
import { ROLE_CONFIG, type TillaggRole } from './tillaggRoles'
import { STEG } from './tillaggSteg'

export default function TillaggKedja() {
  return (
    <div className="my-6">
      {/* Förklaring av färgerna */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <span className="text-xs text-slate-400 w-full sm:w-auto">Färgen visar vem som gör steget:</span>
        {(['koordinator', 'tekniker', 'fakturering', 'systemet'] as TillaggRole[]).map((r) => (
          <RoleTag key={r} role={r} />
        ))}
      </div>

      <ol>
        {STEG.map((steg, i) => {
          const main = ROLE_CONFIG[steg.roles[0]]
          return (
            <li key={i} className="relative flex gap-3 sm:gap-4 pb-8 last:pb-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className={`w-8 h-8 rounded-full border-2 border-current ${main.text} bg-slate-900 text-sm font-bold flex items-center justify-center`}>
                  {i + 1}
                </span>
                {i < STEG.length - 1 && <span className="w-px flex-1 bg-slate-700 mt-1" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-semibold text-white leading-snug">{steg.title}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 mb-2">
                  {steg.roles.map((r) => (
                    <RoleTag key={r} role={r} />
                  ))}
                  <span className="text-xs text-slate-500">{steg.when}</span>
                </div>
                {steg.body}
                {steg.screens}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
