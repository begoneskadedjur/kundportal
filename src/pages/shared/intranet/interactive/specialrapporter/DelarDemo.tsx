// src/pages/shared/intranet/interactive/specialrapporter/DelarDemo.tsx
// Specialrapportguiden: klickbar miniatyr av listan Rapportens delar i redigeraren.
// Klicka en rad och se vad den innehåller och hur kunden ser den. Namnen följer
// SpecialReportEditorPage.tsx och AddSectionModal.tsx, färgerna SECTION_COLORS.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../../components/icons/Icon'
import { Ram } from '../leads/leadsShared'

interface Rad {
  id: string
  namn: string
  under: string
  ikon?: IconName
  nr?: number
  farg?: string
  vad: string
  kunden: string
}

const RADER: Rad[] = [
  {
    id: 'om',
    namn: 'Om rapporten',
    under: 'Kund, adress och inledning',
    ikon: 'rapport.rapport',
    vad: 'Rapportens framsida med titel, period och siffror, kundkortet, Typ av rapport (Saneringsrapport, Inspektionsrapport eller Åtgärdsrapport) och Inledning.',
    kunden: 'Första sidan. Inledningen är det första kunden läser.',
  },
  {
    id: 'oversikt',
    namn: 'Översiktskarta',
    under: '3 områden',
    ikon: 'rapport.karta',
    vad: 'Satellitkartan med alla ritade områden. Här trycker du Rita område. Bocken Med i rapporten avgör om kartan kommer med.',
    kunden: 'En karta med varje område i delens färg och nummer, om Med i rapporten är ikryssad.',
  },
  {
    id: 'del1',
    namn: 'Hus A, källaren',
    under: 'Område · 4 händelser',
    nr: 1,
    farg: '#20c58f',
    vad: 'En del av typen Område. Den har ett ritat område, text, händelser och bilder.',
    kunden: 'Ett eget avsnitt med kartutsnitt, händelsetabell och numrerade bilder.',
  },
  {
    id: 'del2',
    namn: 'Besök 12 september',
    under: 'Besök · 2 händelser',
    nr: 2,
    farg: '#3b82f6',
    vad: 'En del av typen Besök: vad som gjordes en viss dag, oavsett var. Skapas ofta med Skapa en del per besök.',
    kunden: 'Ett avsnitt per besök, i den ordning du har lagt delarna.',
  },
  {
    id: 'del3',
    namn: 'Tätning av fasaden',
    under: 'Underleverantör · 1 händelse',
    nr: 3,
    farg: '#f59e0b',
    vad: 'En del av typen Underleverantör: arbete som någon annan gjorde på vårt uppdrag.',
    kunden: 'Ett eget avsnitt, så att kunden ser vad som gjordes och av vem.',
  },
  {
    id: 'samm',
    namn: 'Bedömning och åtgärder',
    under: 'Din slutsats till kunden',
    ikon: 'allman.bock',
    vad: 'Bedömning, en lista över rapportens avvikelser och Rekommenderade åtgärder, en åtgärd per rad.',
    kunden: 'Slutet av rapporten. Avvikelserna och de första åtgärderna syns också på översikten.',
  },
]

export default function DelarDemo() {
  const [valt, setValt] = useState('del1')
  const rad = RADER.find(r => r.id === valt) ?? RADER[0]

  return (
    <Ram where="Specialrapporter · Rapportens delar">
      <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
        <nav aria-label="Rapportens delar, övning" className="flex flex-col gap-1.5">
          {RADER.map(r => {
            const aktiv = r.id === valt
            return (
              <div key={r.id} className="contents">
                {r.id === 'samm' && (
                  <span className="flex min-h-[40px] items-center gap-2 rounded-xl border-[1.5px] border-dashed border-slate-600 px-3 text-sm text-slate-400">
                    <Icon name="allman.plus" size={16} />
                    Lägg till del
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setValt(r.id)}
                  aria-pressed={aktiv}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border-[1.5px] px-2.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                    aktiv && !r.farg ? 'border-[#20c58f] bg-[#20c58f]/10' : aktiv ? '' : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'
                  }`}
                  style={aktiv && r.farg ? { borderColor: r.farg, background: `${r.farg}1a` } : undefined}
                >
                  {r.nr ? (
                    <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-[#fff]" style={{ background: r.farg }}>
                      {r.nr}
                    </span>
                  ) : (
                    <Icon name={r.ikon ?? 'rapport.rapport'} size={20} className="flex-shrink-0 text-slate-400" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{r.namn}</span>
                    <span className="block truncate text-[11px] text-slate-400">{r.under}</span>
                  </span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3" aria-live="polite">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            {rad.nr && (
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-extrabold text-[#fff]" style={{ background: rad.farg }}>
                {rad.nr}
              </span>
            )}
            {rad.namn}
          </p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Det här gör du här</dt>
              <dd className="leading-relaxed text-slate-200">{rad.vad}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Så ser kunden det</dt>
              <dd className="leading-relaxed text-slate-200">{rad.kunden}</dd>
            </div>
          </dl>
          {rad.nr && (
            <p className="mt-3 border-t border-slate-700/50 pt-2 text-xs leading-relaxed text-slate-400">
              Dra raden för att ändra ordning, eller använd menyn med tre punkter och Flytta upp eller Flytta ned. Numret följer ordningen.
            </p>
          )}
        </div>
      </div>
    </Ram>
  )
}
