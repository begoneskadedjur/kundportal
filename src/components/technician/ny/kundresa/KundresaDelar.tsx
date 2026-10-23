// src/components/technician/ny/kundresa/KundresaDelar.tsx
// Avsnitten i Min kundresa under flödet: integritetsraden, periodväljaren,
// Vad siffrorna säger, Tid i varje steg, Just nu i din resa och Så räknas siffrorna.
// Inga kort och inga piller: platt text med statuspunkt och hårfina avdelare.

import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../../icons/Icon'
import { Punkt } from '../dokument/dokumentUi'
import {
  ARKIVGRANS, BOKNING_MATS_FRAN, MINSTA_FOR_JAMFORELSE, dokLank, tidText, trend,
  type DokTyp, type Flode, type Insikt, type JustNuRad, type PeriodDagar,
} from './kundresaData'

// ─── Integritetsraden ───

export function Integritet() {
  return (
    <section aria-label="Om sidan" className="flex items-start gap-3">
      <span aria-hidden="true" className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#20c58f]/10 text-[#20c58f] flex items-center justify-center">
        <Icon name="allman.las" size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] leading-relaxed text-slate-300">
          <strong className="font-semibold text-white">Sidan är din.</strong> Jämförelserna görs bara mot din egen tidigare period, aldrig mot kollegor. Kontoret följer försäljningen på sina egna sidor, inte här.
        </p>
        <details className="group">
          <summary className="list-none cursor-pointer min-h-[44px] lg:min-h-[36px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#20c58f] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] [&::-webkit-details-marker]:hidden">
            <Icon name="kund.info" size={16} />
            Vem ser vad
          </summary>
          <ul className="mt-1 pl-5 list-disc space-y-1 text-sm leading-relaxed text-slate-300">
            <li><strong className="font-semibold text-white">Du</strong> ser allt på sidan, byggt bara på dina egna dokument.</li>
            <li><strong className="font-semibold text-white">Kontoret</strong> ser dina offerter och avtal som vanligt, eftersom de bokar in och fakturerar. Deras översikter visar försäljningen per tekniker.</li>
            <li><strong className="font-semibold text-white">Texterna</strong> under Vad siffrorna säger räknas fram när du öppnar sidan och sparas inte.</li>
          </ul>
        </details>
      </div>
    </section>
  )
}

// ─── Periodväljaren ───

export function PeriodVal({ valt, onVal }: { valt: PeriodDagar; onVal: (p: PeriodDagar) => void }) {
  const val: PeriodDagar[] = [30, 90, 365]
  return (
    <div role="tablist" aria-label="Period, rullande" className="flex gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-700/60">
      {val.map(p => {
        const aktiv = p === valt
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={aktiv}
            onClick={() => onVal(p)}
            className={`flex-1 min-w-0 h-11 px-3 flex items-center justify-center rounded-xl text-sm font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              aktiv ? 'bg-[#20c58f] text-[#04281c]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {p} dagar
          </button>
        )
      })}
    </div>
  )
}

// ─── Rubrik för ett avsnitt ───

export function Rubrik({ id, ikon, farg, text, under }: { id: string; ikon: IconName; farg: string; text: string; under?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 id={id} className="flex items-center gap-2.5 text-[17px] font-semibold leading-snug text-white">
        <Icon name={ikon} size={20} className={farg} />
        {text}
      </h2>
      {under && <p className="text-sm text-slate-400">{under}</p>}
    </div>
  )
}

// ─── Vad siffrorna säger ───

export function Insikter({ insikter, utan, foreText }: { insikter: Insikt[]; utan: string | null; foreText: string | null }) {
  return (
    <section aria-labelledby="kr-insikter" className="space-y-3" data-genomgang="kundresa-insikter">
      <Rubrik id="kr-insikter" ikon="guide.bra-att-veta" farg="text-sky-400" text="Vad siffrorna säger" under={foreText ?? undefined} />
      {insikter.length > 0 && (
        <ul className="space-y-3 max-w-[880px]">
          {insikter.map((x, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className={`mt-[9px] w-2 h-2 flex-shrink-0 rounded-full ${x.ton === 'tips' ? 'bg-amber-500' : x.ton === 'bra' ? 'bg-[#20c58f]' : 'bg-sky-500'}`} />
              <p className="text-[15px] lg:text-base leading-relaxed text-slate-300">
                <strong className="font-semibold text-white">{x.fet}</strong> {x.text}
                {x.lankar && x.lankar.length > 0 && (
                  <>
                    {' '}<span className="text-slate-400">Gällde</span>{' '}
                    {x.lankar.map((d, j) => (
                      <span key={d.id}>
                        {j > 0 && <span aria-hidden="true" className="text-slate-500">, </span>}
                        <Link to={dokLank(d.id)} className="font-semibold text-[#20c58f] underline underline-offset-[3px] decoration-[#20c58f]/40 hover:decoration-[#20c58f] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
                          {d.kundnamn}
                        </Link>
                      </span>
                    ))}.
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {utan && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-400 max-w-[880px]">
          <Icon name="kund.info" size={16} className="mt-0.5 flex-shrink-0" />
          {utan}
        </p>
      )}
    </section>
  )
}

// ─── Tid i varje steg ───

function TrendText({ t }: { t: ReturnType<typeof trend> }) {
  if (t === null) return null
  if (t === 'kortare') return <Punkt ton="gron">kortare</Punkt>
  if (t === 'langre') return <Punkt ton="gul">längre</Punkt>
  return <Punkt ton="gra">lika</Punkt>
}

export function TidISteg({ nu, fore }: { nu: Flode; fore: Flode | null }) {
  const rader: Array<{ steg: string; forkl: string; nu: number | null; fore: number | null }> = [
    { steg: 'Skickad till signerad', forkl: 'Hälften av de signerade, kunden gör steget', nu: nu.medianSignerad, fore: fore?.medianSignerad ?? null },
    { steg: 'Skickad till förfallen', forkl: 'Hälften av de förfallna, fristen', nu: nu.medianForfoll, fore: fore?.medianForfoll ?? null },
  ]
  return (
    <section aria-labelledby="kr-tid" className="space-y-2 min-w-0" data-genomgang="kundresa-tid">
      <Rubrik id="kr-tid" ikon="allman.klocka" farg="text-violet-400" text="Tid i varje steg" under={fore ? 'Nu och perioden före, median' : 'Median för perioden'} />
      <table className="w-full border-collapse text-sm text-white">
        <thead>
          <tr className="text-slate-400 border-t border-slate-700/60">
            <th scope="col" className="py-2 pr-3 text-left font-semibold">Steg</th>
            <th scope="col" className="py-2 px-3 text-right font-semibold">Nu</th>
            {fore && <th scope="col" className="py-2 pl-3 text-left font-semibold">Perioden före</th>}
          </tr>
        </thead>
        <tbody>
          {rader.map(r => (
            <tr key={r.steg} className="border-t border-slate-700/60 align-middle">
              <th scope="row" className="py-3 pr-3 text-left font-normal">
                <span className="block font-semibold">{r.steg}</span>
                <span className="block text-slate-400">{r.forkl}</span>
              </th>
              <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">{r.nu !== null ? tidText(r.nu) : <span className="font-sans font-normal text-slate-500">Inga än</span>}</td>
              {fore && (
                <td className="py-3 pl-3">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-slate-400 whitespace-nowrap">{r.fore !== null ? tidText(r.fore) : 'Inga'}</span>
                    <TrendText t={trend(r.nu, r.fore)} />
                  </span>
                </td>
              )}
            </tr>
          ))}
          <tr className="border-t border-slate-700/60">
            <th scope="row" className="py-3 pr-3 text-left font-normal">
              <span className="block font-semibold">Signerad till betald</span>
              <span className="block text-slate-400">Kontoret och kunden gör stegen</span>
            </th>
            <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">Mäts inte än</td>
            {fore && <td />}
          </tr>
        </tbody>
      </table>
      <p className="pt-2 border-t border-slate-700/60 text-sm leading-relaxed text-slate-400">
        Bokad, utförd, fakturerad och betald räknas för offerter som kontoret bokar in med Boka in, från {BOKNING_MATS_FRAN}. Äldre offerter saknar kopplingen till ärendet.
      </p>
    </section>
  )
}

// ─── Just nu i din resa ───

export function JustNu({ rader, typ }: { rader: JustNuRad[]; typ: DokTyp }) {
  const tomt = typ === 'offer' ? 'Inga offerter väntar just nu.' : 'Inga avtal väntar just nu.'
  return (
    <section aria-labelledby="kr-justnu" className="space-y-2 min-w-0" data-genomgang="kundresa-justnu">
      <Rubrik id="kr-justnu" ikon="falt.vantar" farg="text-violet-400" text="Just nu i din resa" under="Väntar på svar, nyss förfallna och signerade, med nästa steg" />
      {rader.length === 0 ? (
        <p className="py-3 border-t border-slate-700/60 text-sm text-slate-400">{tomt}</p>
      ) : (
        <ul>
          {rader.map(r => (
            <li key={r.dok.id} className="border-t border-slate-700/60">
              <Link
                to={dokLank(r.dok.id)}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3 px-1 -mx-1 rounded-lg text-white hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="text-[15px] font-semibold truncate">{r.dok.kundnamn}</span>
                  <Punkt ton={r.ton}>{r.status}</Punkt>
                  <span className="text-sm leading-snug text-slate-300"><span className="text-slate-400">Nästa steg:</span> {r.nasta}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold whitespace-nowrap">{r.steg}</span>
                    <span className="text-sm text-slate-400 whitespace-nowrap">
                      {r.dagar <= 0 ? 'idag' : <><span className="font-mono">{r.dagar}</span> {r.dagar === 1 ? 'dag' : 'dagar'} sedan</>}
                    </span>
                  </span>
                  <Icon name="allman.chevron" size={20} className="text-slate-500" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/technician/dokumentsignering"
        className="inline-flex items-center gap-1.5 min-h-[44px] w-full pt-1 border-t border-slate-700/60 text-sm font-semibold text-[#20c58f] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      >
        <Icon name="falt.signera" size={16} />
        Allt som väntar finns i Dokumentsignering
        <Icon name="allman.chevron" size={16} />
      </Link>
    </section>
  )
}

// ─── Så räknas siffrorna ───

const BERAKNING: Array<[string, string]> = [
  ['Vilka dokument räknas.', 'Offerter och avtal där du står som avsändare i Oneflow, skickade under perioden. Ett dokument hör till perioden då det skickades, även om kunden signerar senare. Utkast räknas inte.'],
  ['Skickad och signerad.', 'Tidpunkterna kommer från Oneflow: när dokumentet skickades till kunden och när kunden signerade.'],
  ['Förföll och raderades.', 'Förföll betyder att fristen för att signera gick ut. Raderades betyder att dokumentet togs bort i Oneflow innan kunden signerade. För raderade finns ingen tidpunkt.'],
  ['Väntar på svar.', 'Skickat, inte signerat och fristen är inte ute. Räknas inte som förlorat.'],
  ['Tiden.', 'Hälften av dokumenten var klara inom tiden (median). Ett enstaka dokument som drar ut på tiden påverkar därför inte siffran.'],
  ['Jämförelsen.', `Bara mot din egen period före, lika lång. Aldrig mot kollegor. Meningarna skrivs bara när båda perioderna har minst ${MINSTA_FOR_JAMFORELSE} dokument.`],
  ['Arkiverat räknas inte.', `Dokument skickade före ${ARKIVGRANS}, då portalen tog över, och arkiverade dokument räknas inte. Därför finns ingen jämförelse för 365 dagar förrän ett år efter det datumet.`],
  ['Efter signeringen.', `Bokad visas för dokument som kontoret bokat in med Boka in, från ${BOKNING_MATS_FRAN}. Utförd, fakturerad och betald mäts inte än.`],
  ['Därför syns inte Öppnad.', 'Oneflow skickar inte uppgiften om att kunden öppnat dokumentet till portalen än. Steget läggs till när den kommer.'],
]

export function SaRaknas() {
  return (
    <details className="group" data-genomgang="kundresa-berakning">
      <summary className="list-none cursor-pointer min-h-[48px] flex items-center gap-2.5 text-[17px] font-semibold text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] [&::-webkit-details-marker]:hidden">
        <Icon name="kund.info" size={20} className="text-sky-400" />
        <span id="kr-berakning">Så räknas siffrorna</span>
        <Icon name="allman.chevron" size={20} className="ml-auto text-slate-500 transition-transform group-open:rotate-90" />
      </summary>
      <dl className="mt-2 grid gap-x-6 gap-y-2 lg:grid-cols-[240px_minmax(0,1fr)] max-w-[980px]">
        {BERAKNING.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[15px] font-semibold leading-relaxed text-white mt-2 lg:mt-0">{k}</dt>
            <dd className="text-sm lg:text-[15px] leading-relaxed text-slate-300">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
