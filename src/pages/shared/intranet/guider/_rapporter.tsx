// src/pages/shared/intranet/guider/_rapporter.tsx
// Delade skärmdelar för rapporten i nya arbetsvyn (3.132.0 och 3.132.1). Ingen guidemodul
// (filen börjar med _). Används av guide-fakturering, guide-kontrollrapport,
// guide-stationskontroll och guide-skicka-rapport-efterhand.
//
// Efterbildningar, kontrollerade mot källkoden 2026-11-13:
//  - KlartRapport.tsx: rutan Rapporten är klar (Skicka till kund med adressen, Ladda ned PDF,
//    Ladda ned Excel för kontrollrapporten, Skicka till mig med din adress, Skicka inte nu),
//    hopfälld till Rapporten skickades inte / Inte skickad / Visa val, eller
//    <Rapporten> är skickad / Skickad till <adress>. Hjälptexten Rapporten skickas inte av
//    sig själv med länken Gå till Rapporter.
//  - SkickaTillKundArk.tsx: Skicka till kund?, <rapporten> för <nr> skickas till:, adressen,
//    Fel adress? Ändra den i ärendets kunduppgifter först., Avbryt och Skicka.
//  - NyRapporter.tsx: Mina rapporter (Dina rapporter, Sök kund eller ärendenummer, 30 dagar,
//    90 dagar, 12 mån/12 månader, Alla typer, månadsgrupper, raderna med Ladda ned och Skicka),
//    arket Skicka rapporten (Till kunden, Till mig) och datorns panel (Ladda ned PDF,
//    Skicka till kund med adressfält, Skicka till kunden, Skicka till mig, Öppna ärendet).
// Påhittade kunder och adresser.

import { Icon } from '../../../../components/icons/Icon'
import { Markor } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import type { Mk, Tryck } from './_nyvy_salja'

// ─── Rutan Rapporten är klar (steget Klart, avslutat ärende) ───

export type RutaLage = 'val' | 'inte-nu' | 'skickad'

const RAD = 'flex min-h-[28px] w-full items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-2 text-left text-[11px] font-medium text-white'

/** "Kontrollrapport" blir "Kontrollrapporten", som bestamdForm i portalen */
export function bestamd(namn: string): string {
  return `${namn}en`
}

/**
 * Rutan Rapporten är klar. Mål: rk-kund, rk-pdf, rk-excel, rk-mig, rk-intenu, rk-visaval, rk-ga.
 * excel = kontrollrapporten (stationskontroll) har även Ladda ned Excel.
 */
export function RapportKlarRuta({ lage = 'val', rapportNamn, kundEpost, minEpost, excel, mk, tryck }: {
  lage?: RutaLage; rapportNamn: string; kundEpost: string; minEpost: string; excel?: boolean; mk: Mk; tryck: Tryck
}) {
  const hjalp = (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 px-2 py-1">
      <p className="text-[10.5px] font-semibold text-white">Rapporten skickas inte av sig själv</p>
      <p className="text-[9.5px] leading-snug text-slate-400">
        {lage === 'inte-nu'
          ? 'Du hittar rapporten under Rapporter. Där kan du skicka den till kunden eller ladda ned den när du vill. '
          : 'Väljer du Skicka inte nu finns rapporten kvar under Rapporter, där du kan skicka eller ladda ned den senare. '}
        <Markor markor={mk('rk-ga')}>
          <button type="button" onClick={() => tryck('rk-ga')} className="font-medium text-[#20c58f] underline underline-offset-2">Gå till Rapporter</button>
        </Markor>
      </p>
    </div>
  )

  if (lage !== 'val') {
    return (
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-2">
          <Icon name="rapport.rapport" size={20} className="flex-none text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white">{lage === 'skickad' ? `${bestamd(rapportNamn)} är skickad` : 'Rapporten skickades inte'}</p>
            <p className="flex items-center gap-1 truncate text-[10px] text-slate-300">
              <span className={`h-1.5 w-1.5 flex-none rounded-full ${lage === 'skickad' ? 'bg-[#20c58f]' : 'bg-slate-400'}`} />
              <span className="truncate">{lage === 'skickad' ? `Skickad till ${kundEpost}` : 'Inte skickad'}</span>
            </p>
          </div>
          <Markor markor={mk('rk-visaval')}>
            <button type="button" onClick={() => tryck('rk-visaval')} className="h-7 rounded-lg border border-slate-600 px-2 text-[10.5px] font-medium text-white">Visa val</button>
          </Markor>
        </div>
        {hjalp}
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/60 p-2">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="rapport.rapport" size={16} className="text-slate-300" />Rapporten är klar</p>
        <p className="text-[10px] text-slate-400">{rapportNamn}. Vad vill du göra med den?</p>
        <Markor markor={mk('rk-kund')} block>
          <button type="button" onClick={() => tryck('rk-kund')} className="flex w-full items-center gap-1.5 rounded-lg bg-[#20c58f] px-2 py-1 text-left text-[#04281c]">
            <Icon name="rapport.skicka" size={16} className="flex-none" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold">Skicka till kund</span>
              <span className="block truncate text-[9.5px] opacity-80">{kundEpost}</span>
            </span>
          </button>
        </Markor>
        <Markor markor={mk('rk-pdf')} block>
          <button type="button" onClick={() => tryck('rk-pdf')} className={RAD}><Icon name="rapport.ladda" size={16} className="flex-none" />Ladda ned PDF</button>
        </Markor>
        {excel && (
          <Markor markor={mk('rk-excel')} block>
            <button type="button" onClick={() => tryck('rk-excel')} className={RAD}><Icon name="upphandling.excel" size={16} className="flex-none" />Ladda ned Excel</button>
          </Markor>
        )}
        <Markor markor={mk('rk-mig')} block>
          <button type="button" onClick={() => tryck('rk-mig')} className={RAD}>
            <Icon name="rapport.person" size={16} className="flex-none" />
            <span className="min-w-0 truncate">Skicka till mig <span className="text-[9.5px] text-slate-400">{minEpost}</span></span>
          </button>
        </Markor>
        <Markor markor={mk('rk-intenu')} block>
          <button type="button" onClick={() => tryck('rk-intenu')} className="w-full py-0.5 text-center text-[10.5px] font-medium text-slate-300 underline underline-offset-2">Skicka inte nu</button>
        </Markor>
      </div>
      {hjalp}
    </div>
  )
}

// ─── Arket Skicka till kund? ───

/** Frågan före utskicket. Bottenark i telefonen, ruta på datorn. Mål: ark-avbryt, ark-skicka. */
export function SkickaKundArk({ rapportNamn, arendeNr, epost, adressHjalp, tidigare, mk, tryck }: {
  rapportNamn: string; arendeNr: string; epost: string; adressHjalp?: string; tidigare?: string; mk: Mk; tryck: Tryck
}) {
  const enhet = useGuideEnhet()
  return (
    <div className={`absolute inset-0 z-40 flex bg-black/60 ${enhet === 'mobil' ? 'items-end' : 'items-center justify-center p-3'}`}>
      <div className={`grid w-full gap-1.5 border border-slate-700 bg-slate-900 p-3 ${enhet === 'mobil' ? 'rounded-t-2xl' : 'max-w-[300px] rounded-xl'}`}>
        {enhet === 'mobil' && <span className="mx-auto h-1 w-8 rounded-full bg-slate-600" />}
        <p className="text-[13px] font-semibold text-white">Skicka till kund?</p>
        <p className="text-[10.5px] text-slate-300">{bestamd(rapportNamn)} för <span className="font-mono">{arendeNr}</span> skickas till:</p>
        <p className="break-all rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11.5px] font-semibold text-white">{epost}</p>
        <p className="text-[9.5px] text-slate-400">{adressHjalp ?? 'Fel adress? Ändra den i ärendets kunduppgifter först.'}</p>
        {tidigare && (
          <p className="flex items-start gap-1 text-[9.5px] text-amber-300"><Icon name="kund.info" size={16} className="h-3 w-3 flex-none" />{tidigare} Skickar du nu får kunden en ny version.</p>
        )}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <Markor markor={mk('ark-avbryt')} block>
            <button type="button" onClick={() => tryck('ark-avbryt')} className="h-8 w-full rounded-lg border border-slate-600 text-[11.5px] font-semibold text-white">Avbryt</button>
          </Markor>
          <Markor markor={mk('ark-skicka')} block>
            <button type="button" onClick={() => tryck('ark-skicka')} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#20c58f] text-[11.5px] font-semibold text-[#04281c]">
              <Icon name="rapport.skicka" size={16} />Skicka
            </button>
          </Markor>
        </div>
      </div>
    </div>
  )
}

// ─── Mina rapporter ───

export interface RapportRadEx {
  id: string
  nr: string
  datum: string
  kund: string
  tjanst: string
  rapport: string
  epost: string
}

export type Period = '30' | '90' | '365'

/** Arket Skicka rapporten från en rad. Mål: val-kund, val-mig, val-stang. */
export function SkickaValArk({ rad, minEpost, mk, tryck }: { rad: RapportRadEx; minEpost: string; mk: Mk; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  const val = (id: string, rubrik: string, under: string, ikon: 'rapport.skicka' | 'rapport.person', prim?: boolean) => (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-800">
        <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${prim ? 'bg-[#20c58f]/10 text-[#20c58f]' : 'bg-slate-800 text-slate-200'}`}><Icon name={ikon} size={20} /></span>
        <span className="min-w-0">
          <span className="block text-[11.5px] font-semibold text-white">{rubrik}</span>
          <span className="block truncate text-[10px] text-slate-400">{under}</span>
        </span>
      </button>
    </Markor>
  )
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${enhet === 'mobil' ? 'items-end' : 'items-center justify-center p-3'}`}>
      <div className={`grid w-full gap-1 border border-slate-700 bg-slate-900 p-2.5 ${enhet === 'mobil' ? 'rounded-t-2xl' : 'max-w-[300px] rounded-xl'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Skicka rapporten</p>
            <p className="truncate text-[10.5px] text-slate-400">{rad.nr}, {rad.rapport}</p>
          </div>
          <Markor markor={mk('val-stang')}>
            <button type="button" aria-label="Stäng" onClick={() => tryck('val-stang')} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="allman.stang" size={16} /></button>
          </Markor>
        </div>
        {val('val-kund', 'Till kunden', rad.epost, 'rapport.skicka', true)}
        {val('val-mig', 'Till mig', minEpost, 'rapport.person')}
      </div>
    </div>
  )
}

const PERIODER: { id: Period; kort: string; lang: string }[] = [
  { id: '30', kort: '30 dagar', lang: '30 dagar' },
  { id: '90', kort: '90 dagar', lang: '90 dagar' },
  { id: '365', kort: '12 mån', lang: '12 månader' },
]

/**
 * Sidans innehåll: hjälptexten, sök, period, typ och raderna per månad.
 * Mål: sok, period:30/90/365, typ, ladda:<id>, skicka:<id>, rad:<id>.
 * Datorn visar dessutom panelen för den valda raden (mål panel-pdf, panel-adress,
 * panel-skicka, panel-mig, panel-oppna).
 */
export function RapporterInnehall({ manader, period, sok, vald, minEpost, mk, tryck }: {
  manader: { titel: string; rader: RapportRadEx[] }[]
  period: Period
  sok: string
  vald?: string
  minEpost: string
  mk: Mk
  tryck: Tryck
}) {
  const enhet = useGuideEnhet()
  const dator = enhet === 'dator'
  const alla = manader.flatMap(m => m.rader)
  const valt = dator ? (alla.find(r => r.id === vald) ?? alla[0]) : undefined

  const ikonKnapp = (id: string, ikon: 'rapport.ladda' | 'rapport.skicka', etikett: string, prim?: boolean) => (
    <Markor markor={mk(id)}>
      <button type="button" aria-label={etikett} onClick={e => { e.stopPropagation(); tryck(id) }}
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${prim ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 text-slate-200'}`}>
        <Icon name={ikon} size={16} />
      </button>
    </Markor>
  )

  const lista = alla.length === 0 ? (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900 p-2.5 text-center">
      <p className="text-[11.5px] font-semibold text-white">Inga träffar</p>
      <p className="text-[10px] text-slate-400">Inga rapporter matchar sökningen eller typen.</p>
    </div>
  ) : (
    <div className="grid gap-2">
      {manader.filter(m => m.rader.length).map(m => (
        <div key={m.titel} className="grid gap-1">
          <p className="flex items-baseline gap-1.5 px-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">{m.titel}<span className="font-mono text-slate-500">{m.rader.length}</span></p>
          <div className={dator ? 'overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900' : 'grid gap-1'}>
            {m.rader.map(r => dator ? (
              <Markor key={r.id} markor={mk(`rad:${r.id}`)} block>
                <div role="button" tabIndex={0} onClick={() => tryck(`rad:${r.id}`)}
                  className={`grid cursor-pointer grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-slate-700/60 px-1.5 py-1 last:border-b-0 ${valt?.id === r.id ? 'bg-[#20c58f]/10' : ''}`}>
                  <span className="font-mono text-[9.5px] text-slate-300">{r.nr}<span className="block font-sans text-slate-500">{r.datum}</span></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-white">{r.kund}</span>
                    <span className="block truncate text-[9.5px] text-slate-400">{r.tjanst} · {r.rapport}</span>
                  </span>
                  <span className="flex gap-1">{ikonKnapp(`ladda:${r.id}`, 'rapport.ladda', `Ladda ned rapporten för ${r.nr}`)}{ikonKnapp(`skicka:${r.id}`, 'rapport.skicka', `Skicka rapporten för ${r.nr}`, true)}</span>
                </div>
              </Markor>
            ) : (
              <div key={r.id} className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 p-1.5">
                <div className="min-w-0 flex-1">
                  <p className="flex gap-1.5 text-[9.5px] text-slate-400"><span className="font-mono">{r.nr}</span><span>{r.datum}</span></p>
                  <p className="truncate text-[11.5px] font-semibold text-white">{r.kund}</p>
                  <p className="truncate text-[10px] text-slate-300">{r.tjanst} · {r.rapport}</p>
                  <p className="truncate text-[9.5px] text-slate-400">{r.epost}</p>
                </div>
                {ikonKnapp(`ladda:${r.id}`, 'rapport.ladda', `Ladda ned rapporten för ${r.nr}`)}
                {ikonKnapp(`skicka:${r.id}`, 'rapport.skicka', `Skicka rapporten för ${r.nr}`, true)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="grid gap-1.5">
      <div>
        <p className="text-[11.5px] font-semibold text-white">Dina rapporter</p>
        <p className="text-[9.5px] leading-snug text-slate-400">Inget skickas av sig självt. Här skickar du rapporten till kunden eller dig själv, eller laddar ned den. Du ser bara ärenden där du var tekniker.</p>
      </div>
      <div className={`grid gap-1 ${dator ? 'grid-cols-[minmax(0,1fr)_auto_auto] items-center' : ''}`}>
        <Markor markor={mk('sok')} block>
          <button type="button" onClick={() => tryck('sok')} className="flex h-7 w-full items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 text-left text-[10.5px]">
            <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-400" />
            <span className={sok ? 'text-white' : 'text-slate-500'}>{sok || 'Sök kund eller ärendenummer'}</span>
          </button>
        </Markor>
        <div className={`flex gap-1 ${dator ? 'contents' : ''}`}>
          <div className="grid flex-1 grid-cols-3 gap-0.5 rounded-lg bg-slate-800 p-0.5">
            {PERIODER.map(p => (
              <Markor key={p.id} markor={mk(`period:${p.id}`)} block>
                <button type="button" aria-pressed={period === p.id} onClick={() => tryck(`period:${p.id}`)}
                  className={`h-6 w-full whitespace-nowrap rounded-md px-1 text-[9.5px] ${period === p.id ? 'border border-slate-600 bg-slate-900 font-semibold text-white' : 'text-slate-300'}`}>
                  {dator ? p.lang : p.kort}
                </button>
              </Markor>
            ))}
          </div>
          <Markor markor={mk('typ')}>
            <button type="button" onClick={() => tryck('typ')} className="flex h-7 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10px] font-semibold text-slate-300">
              Alla typer<Icon name="allman.chevron" size={16} className="h-3 w-3 rotate-90" />
            </button>
          </Markor>
        </div>
      </div>
      {dator ? (
        <div className="grid grid-cols-[minmax(0,1fr)_150px] items-start gap-2">
          {lista}
          {valt && <Panel rad={valt} minEpost={minEpost} mk={mk} tryck={tryck} />}
        </div>
      ) : lista}
    </div>
  )
}

/** Datorns högerpanel för den valda rapporten */
function Panel({ rad, minEpost, mk, tryck }: { rad: RapportRadEx; minEpost: string; mk: Mk; tryck: Tryck }) {
  const knapp = 'flex h-7 w-full items-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-1.5 text-left text-[10px] font-semibold text-white'
  return (
    <div className="grid gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 p-2">
      <div>
        <p className="text-[9.5px] text-slate-400"><span className="font-mono">{rad.nr}</span>, avslutat {rad.datum}</p>
        <p className="truncate text-[11.5px] font-semibold text-white">{rad.kund}</p>
      </div>
      <p className="flex items-center gap-1 text-[9.5px] text-slate-300"><span className="h-1.5 w-1.5 flex-none rounded-full bg-[#20c58f]" />{rad.rapport} klar att skicka eller ladda ned</p>
      <Markor markor={mk('panel-pdf')} block>
        <button type="button" onClick={() => tryck('panel-pdf')} className={knapp}><Icon name="rapport.ladda" size={16} className="h-3.5 w-3.5" />Ladda ned PDF</button>
      </Markor>
      <div className="grid gap-1 rounded-md border border-slate-700 bg-slate-800/60 p-1.5">
        <p className="text-[9.5px] font-medium text-slate-300">Skicka till kund</p>
        <Markor markor={mk('panel-adress')} block>
          <button type="button" onClick={() => tryck('panel-adress')} className="h-6 w-full truncate rounded border border-slate-600 bg-slate-950/60 px-1.5 text-left text-[9.5px] text-white">{rad.epost}</button>
        </Markor>
        <Markor markor={mk('panel-skicka')} block>
          <button type="button" onClick={() => tryck('panel-skicka')} className="flex h-6 w-full items-center justify-center gap-1 rounded-md bg-[#20c58f] text-[9.5px] font-semibold text-[#04281c]"><Icon name="rapport.skicka" size={16} className="h-3 w-3" />Skicka till kunden</button>
        </Markor>
      </div>
      <Markor markor={mk('panel-mig')} block>
        <button type="button" onClick={() => tryck('panel-mig')} className={knapp}><Icon name="rapport.person" size={16} className="h-3.5 w-3.5" /><span className="truncate">Skicka till mig<span className="font-normal text-slate-400">, {minEpost}</span></span></button>
      </Markor>
      <Markor markor={mk('panel-oppna')} block>
        <button type="button" onClick={() => tryck('panel-oppna')} className="flex h-6 w-full items-center justify-center gap-1 text-[10px] font-semibold text-[#20c58f]"><Icon name="arende.arende" size={16} className="h-3 w-3" />Öppna ärendet</button>
      </Markor>
    </div>
  )
}
