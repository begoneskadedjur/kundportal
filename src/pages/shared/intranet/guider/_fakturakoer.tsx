// src/pages/shared/intranet/guider/_fakturakoer.tsx
// Delade skärmdelar för guiderna om /admin/fakturering efter 3.121.0 till 3.125.0:
// guide-avtalsfakturor-kontor, guide-merforsaljning-avtal-kontor,
// guide-fakturaarkiv-kontor och sista steget i guide-fakturering-kontor.
// Ingen guidemodul (filen börjar med _).
//
// Etiketterna är ordagrant desamma som i portalen:
// - src/pages/admin/invoicing/index.tsx: Fakturering, flikarna Privat & Företag,
//   Avtalskunder, Merförsäljning Avtal och växeln Att hantera | Arkiv (ModeSwitch)
// - queue/QueueParts.tsx: nyckeltalen, knappraden (Inga fakturor markerade, Bocka i
//   fakturor eller en hel grupp, n fakturor markerade, Avmarkera, Godkänn markerade (n),
//   Skicka godkända till Fortnox (n)), gruppraden med kryssruta, sidopanelens kort
// - queue/ContractSchedule.tsx: grupperna Perioden har börjat, Försenade, Skicka denna
//   vecka, Kommande, Väntar på beslut, kolumnerna Skicka, Kund och faktura, Perioden,
//   Förfaller om skickad idag, Belopp exkl., sidopanelen Skickdatum, Så faktureras
//   avtalen och Skickat senaste veckan
// - queue/AdhocQueue.tsx: Utfört arbete utan faktura, Skapa faktura, Kräver
//   godkännande, Godkända, redo för Fortnox, kolumnerna Utfört, Kund och ärende,
//   Märkning på fakturan, Tekniker, Belopp inkl., Så faktureras merförsäljning
// - queue/EarlySendDialog.tsx: Perioden börjar / Fakturan gäller, Ska skickas, Idag,
//   Vänta till, Skicka ändå
// - queue/FortnoxBatchDialog.tsx: Skapa n utkast i Fortnox, Avbryt, Skapa n utkast,
//   Skapar n av n, Utkast i Fortnox, n utkast skapade, n misslyckades, n hoppades över,
//   Totalt, Stäng
// Påhittade kunder, ingenting sparas.

import type { ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../../components/admin/invoicing/queue/queueUtils'
import { Dator, DatorSida, Markor, Notis, PKnapp } from '../skarmkit'
import { mk } from './_fakturering'

export type { Tone }
export type Tryck = (id: string) => void

interface Bas {
  tryck: Tryck
  markera?: string
  nr: number
}

// ─── Småbitar ───────────────────────────────────────

export function Punkt({ ton, children }: { ton: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[9.5px] ${TONE_TEXT[ton]}`}>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${TONE_DOT[ton]}`} />
      {children}
    </span>
  )
}

/** Kryssruta som i listorna (Checkbox i QueueParts) */
export function Ruta({ pa, delvis, etikett, onClick, markor }: {
  pa: boolean; delvis?: boolean; etikett: string; onClick: () => void; markor?: ReturnType<typeof mk>
}) {
  return (
    <Markor markor={markor}>
      <button type="button" role="checkbox" aria-checked={delvis ? 'mixed' : pa} aria-label={etikett} onClick={onClick}
        className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded border-[1.5px] ${pa || delvis ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>
        {pa && <Icon name="allman.bock" size={16} className="h-2.5 w-2.5" strokeWidth={2.6} />}
        {!pa && delvis && <span className="h-[1.5px] w-2 bg-[#fff]" />}
      </button>
    </Markor>
  )
}

export interface Nyckeltal { rubrik: string; ton: Tone; antal: number; summa: string; hint: string }

/** Nyckeltalen överst (KpiRow) */
export function NyckeltalRad({ tal }: { tal: Nyckeltal[] }) {
  return (
    <div className={`grid grid-cols-2 gap-1.5 ${tal.length >= 5 ? 'lg:grid-cols-5' : 'sm:grid-cols-4'}`}>
      {tal.map(t => (
        <div key={t.rubrik} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
          <p className="flex items-center gap-1 truncate text-[8.5px] uppercase tracking-wider text-slate-500"><span className={`h-1.5 w-1.5 flex-none rounded-full ${TONE_DOT[t.ton]}`} />{t.rubrik}</p>
          <p className="text-[13px] font-bold text-white">{t.antal} <span className="text-[10px] font-normal text-slate-300">{t.summa}</span></p>
          <p className="truncate text-[8.5px] text-slate-500">{t.hint}</p>
        </div>
      ))}
    </div>
  )
}

/** Knappraden överst i listan (SelectionBar) */
export function Valrad({ antal, summa, godkannAntal, skickaAntal, tryck, markera, nr }: Bas & {
  antal: number; summa: string; godkannAntal: number; skickaAntal: number
}) {
  const aktiv = antal > 0
  return (
    <div className={`flex flex-wrap items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 ${aktiv ? 'border-[#20c58f]/40 bg-[#20c58f]/10' : 'border-slate-800 bg-slate-900/90'}`}>
      <span className="min-w-0 text-[11px]">
        <b className="text-white">{aktiv ? `${antal} ${antal === 1 ? 'faktura markerad' : 'fakturor markerade'}` : 'Inga fakturor markerade'}</b>
        <span className="text-slate-400"> {aktiv ? summa : 'Bocka i fakturor eller en hel grupp'}</span>
      </span>
      <span className="flex flex-wrap gap-1">
        {aktiv && <PKnapp onClick={() => tryck('avmarkera')} markor={mk(markera, 'avmarkera', nr)}>Avmarkera</PKnapp>}
        <PKnapp ikon="allman.bock" inaktiv={godkannAntal === 0} onClick={() => tryck('godkann-markerade')} markor={mk(markera, 'godkann-markerade', nr)}>Godkänn markerade ({godkannAntal})</PKnapp>
        <PKnapp prim ikon="rapport.skicka" inaktiv={skickaAntal === 0} onClick={() => tryck('skicka-godkanda')} markor={mk(markera, 'skicka-godkanda', nr)}>Skicka godkända till Fortnox ({skickaAntal})</PKnapp>
      </span>
    </div>
  )
}

/** Gruppens rubrikrad med kryssruta (GroupHeader). utanRuta för Utfört arbete utan faktura. */
export function Grupprad({ id, ton, titel, desc, total, pa, delvis, utanRuta, tryck, markera, nr }: Bas & {
  id: string; ton: Tone; titel: string; desc: string; total: string; pa?: boolean; delvis?: boolean; utanRuta?: boolean
}) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-800/40 px-2 py-1.5 first:border-t-0">
      {utanRuta ? <span className="w-3.5 flex-none" /> : (
        <Ruta pa={!!pa} delvis={delvis} etikett={`Markera alla i ${titel}`} onClick={() => tryck(`grupp-${id}`)} markor={mk(markera, `grupp-${id}`, nr)} />
      )}
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`h-2 w-2 flex-none rounded-full ${TONE_DOT[ton]}`} />
        <span className="whitespace-nowrap text-[11.5px] font-semibold text-white">{titel}</span>
        <span className="hidden truncate text-[9.5px] text-slate-500 sm:inline">{desc}</span>
      </span>
      <span className="whitespace-nowrap text-[9.5px] text-slate-400">{total}</span>
    </div>
  )
}

export function SidoKort({ titel, atgard, children }: { titel: string; atgard?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-white">{titel}</p>
        {atgard}
      </div>
      {children}
    </div>
  )
}

export function Regler({ regler, fot }: { regler: [string, string][]; fot?: string }) {
  return (
    <div>
      {regler.map(([t, x]) => (
        <div key={t} className="border-t border-slate-800 py-1 first:border-t-0 first:pt-0">
          <p className="text-[10px] font-medium text-slate-200">{t}</p>
          <p className="text-[9.5px] leading-snug text-slate-400">{x}</p>
        </div>
      ))}
      {fot && <p className="mt-1 border-t border-slate-800 pt-1 text-[9.5px] text-slate-500">{fot}</p>}
    </div>
  )
}

// ─── Sidan Fakturering med flikar och växeln ───────

const FLIKAR: [string, string][] = [['flik-privat', 'Privat & Företag'], ['flik-avtal', 'Avtalskunder'], ['flik-merforsaljning', 'Merförsäljning Avtal']]

/** Fakturering med flikarna och växeln Att hantera | Arkiv. flik: 0, 1 eller 2. */
export function FaktureringSida({ flik, arkiv, tryck, markera, nr, overlay, notis, children }: Bas & {
  flik: number; arkiv?: boolean; overlay?: ReactNode; notis?: string; children: ReactNode
}) {
  return (
    <Dator adress="fakturering">
      <div className="relative min-h-[470px]">
        <DatorSida meny={['Översikt', 'Ärenden', 'Fakturering']} aktiv="Fakturering" titel="Fakturering">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b border-slate-700">
            <div className="flex gap-3">
              {FLIKAR.map(([id, namn], i) => (
                <Markor key={id} markor={mk(markera, id, nr)}>
                  <button type="button" onClick={() => tryck(id)}
                    className={`-mb-px border-b-2 py-1.5 text-[12px] font-semibold ${flik === i ? 'border-[#20c58f] text-[#20c58f]' : 'border-transparent text-slate-400'}`}>{namn}</button>
                </Markor>
              ))}
            </div>
            {flik > 0 && (
              <span role="group" aria-label="Läge" className="mb-1 inline-flex overflow-hidden rounded-md border border-slate-700 text-[11px]">
                <Markor markor={mk(markera, 'hantera', nr)}>
                  <button type="button" aria-pressed={!arkiv} onClick={() => tryck('hantera')} className={`px-2 py-0.5 ${!arkiv ? 'bg-slate-800 font-semibold text-white' : 'text-slate-400'}`}>Att hantera</button>
                </Markor>
                <Markor markor={mk(markera, 'arkiv', nr)}>
                  <button type="button" aria-pressed={!!arkiv} onClick={() => tryck('arkiv')} className={`border-l border-slate-700 px-2 py-0.5 ${arkiv ? 'bg-slate-800 font-semibold text-white' : 'text-slate-400'}`}>Arkiv</button>
                </Markor>
              </span>
            )}
          </div>
          {children}
        </DatorSida>
        {overlay}
        {notis && <Notis text={notis} />}
      </div>
    </Dator>
  )
}

/** Mörk bakgrund och dialogruta, som portalens Modal */
export function Dialog({ titel, ikon, fot, bred, children }: { titel: ReactNode; ikon?: ReactNode; fot: ReactNode; bred?: boolean; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
      <div className={`w-full ${bred ? 'max-w-xl' : 'max-w-md'} overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl`}>
        <p className="flex items-center gap-2 border-b border-slate-700 bg-slate-800/50 px-3 py-2 text-[13px] font-semibold text-white">{ikon}{titel}</p>
        <div className="grid gap-2 px-3 py-2.5">{children}</div>
        <div className="flex flex-wrap justify-end gap-1.5 border-t border-slate-700 bg-slate-800/50 px-3 py-2">{fot}</div>
      </div>
    </div>
  )
}

// ─── Avtalskunder: faktureringsschemat ─────────────

export interface ARad {
  id: string
  skicka: string
  status: string
  ton: Tone
  godkand?: boolean
  kund: string
  under: string
  not?: string
  period: string
  periodTill: string
  forfaller: string
  rod?: boolean
  belopp: string
}

export interface AGrupp { key: string; ton: Tone; titel: string; desc: string; total: string; rader: ARad[] }

export const GRUPP_TEXT: Record<string, { titel: string; desc: string; ton: Tone }> = {
  started: { titel: 'Perioden har börjat', desc: 'Skulle ha skickats, kunden har redan fått tjänsten', ton: 'red' },
  late: { titel: 'Försenade', desc: 'Skicka idag, perioden har inte börjat än', ton: 'orange' },
  this_week: { titel: 'Skicka denna vecka', desc: 'Skickas på sitt datum', ton: 'green' },
  upcoming: { titel: 'Kommande', desc: 'Skickas på sitt datum', ton: 'green' },
  waiting: { titel: 'Väntar på beslut', desc: 'Premien bekräftas i avtalskartan innan fakturan kan godkännas', ton: 'grey' },
}

const AGRID = 'grid grid-cols-[78px_minmax(120px,1.6fr)_80px_104px_54px] items-center gap-2'

export function Avtalsschema({ grupper, valda, tryck, markera, nr }: Bas & { grupper: AGrupp[]; valda: Set<string> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="min-w-[500px]">
        <div className="flex items-center gap-2 border-b border-slate-800 px-2 py-1">
          <span className="w-3.5 flex-none" />
          <div className={`flex-1 ${AGRID} text-[8.5px] font-semibold uppercase tracking-wider text-slate-500`}>
            <span>Skicka</span><span>Kund och faktura</span><span>Perioden</span><span>Förfaller om skickad idag</span><span className="text-right">Belopp exkl.</span>
          </div>
        </div>
        {grupper.map(g => {
          const n = g.rader.filter(r => valda.has(r.id)).length
          return (
            <div key={g.key}>
              <Grupprad id={g.key} ton={g.ton} titel={g.titel} desc={g.desc} total={g.total}
                pa={n > 0 && n === g.rader.length} delvis={n > 0 && n < g.rader.length} tryck={tryck} markera={markera} nr={nr} />
              {g.rader.map(r => (
                <div key={r.id} className={`flex items-center gap-2 border-t border-slate-800/60 px-2 py-1 ${valda.has(r.id) ? 'bg-[#20c58f]/5' : ''}`}>
                  <Ruta pa={valda.has(r.id)} etikett={`Markera ${r.kund}`} onClick={() => tryck(`ruta-${r.id}`)} />
                  <Markor markor={mk(markera, `rad-${r.id}`, nr)} block>
                    <button type="button" onClick={() => tryck(`rad-${r.id}`)} className={`w-full text-left ${AGRID}`}>
                      <span className="grid">
                        <span className="font-mono text-[10.5px] text-white">{r.skicka}</span>
                        <Punkt ton={r.ton}>{r.status}</Punkt>
                        {r.godkand && <span className="text-[9.5px] text-slate-400">Godkänd</span>}
                      </span>
                      <span className="grid min-w-0">
                        <span className="truncate text-[11px] text-white">{r.kund}</span>
                        <span className="truncate text-[9px] text-slate-500">{r.under}</span>
                        {r.not && <span className="truncate text-[9px] text-slate-500">{r.not}</span>}
                      </span>
                      <span className="grid font-mono text-[9.5px]"><span className="text-slate-200">{r.period}</span><span className="text-slate-500">till {r.periodTill}</span></span>
                      <span className="grid">
                        <span className={`font-mono text-[9.5px] ${r.rod ? 'text-red-400' : 'text-slate-200'}`}>{r.forfaller}</span>
                        <span className={`text-[9px] ${r.rod ? 'text-red-400' : 'text-slate-500'}`}>{r.rod ? 'Betalas efter periodstart' : 'Före periodstart'}</span>
                      </span>
                      <span className="text-right text-[11px] font-semibold text-white">{r.belopp}</span>
                    </button>
                  </Markor>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Sidopanelen i Avtalskunder: kalendern, reglerna och det som skickats */
export function AvtalSidopanel({ skickat, tryck }: { skickat: [string, string, string][]; tryck: Tryck }) {
  // November 2026: den 1:a är en söndag, måndag först
  const celler: (number | null)[] = [...Array(6).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)]
  while (celler.length % 7 !== 0) celler.push(null)
  const prickar: Record<number, Tone[]> = { 3: ['red'], 2: ['blue'], 4: ['blue'], 9: ['green'], 20: ['green'] }
  return (
    <div className="grid content-start gap-2">
      <SidoKort titel="Skickdatum">
        <p className="mb-1 text-[10.5px] font-semibold text-white">November 2026</p>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[7.5px] uppercase text-slate-500">
          {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {celler.map((d, i) => d === null ? <span key={i} /> : (
            <span key={i} className={`flex h-5 flex-col items-center justify-center rounded border text-[8.5px] ${d === 5 ? 'border-[#20c58f] bg-[#20c58f]/10 font-semibold text-white' : d < 5 ? 'border-slate-800 text-slate-500' : 'border-slate-800 text-slate-300'}`}>
              {d}
              <span className="flex h-1 gap-px">{(prickar[d] ?? []).map(t => <span key={t} className={`h-1 w-1 rounded-full ${TONE_DOT[t]}`} />)}</span>
            </span>
          ))}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-2 text-[8.5px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Försenat</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Ska skickas</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Skickat</span>
        </p>
      </SidoKort>
      <SidoKort titel="Så faktureras avtalen">
        <Regler
          regler={[
            ['Årsvis, halvårsvis och kvartalsvis', 'Skickas 40 dagar före periodstart. Kunden betalar innan perioden börjar.'],
            ['Månadsvis', 'Skickas den 1:a i den månad fakturan gäller. Utkastet syns en vecka innan.'],
            ['Tillägg per månad', 'Skickas den 1:a, tillsammans med månadens premie.'],
            ['Varning', 'Portalen frågar innan en månadsfaktura skickas mer än 10 dagar före sin period, eller en årsfaktura mer än 60 dagar före.'],
          ]}
          fot="Fakturadatum i Fortnox blir alltid den dag fakturan skickas. Förfallodag är 30 dagar senare."
        />
      </SidoKort>
      <SidoKort titel="Skickat senaste veckan" atgard={<button type="button" onClick={() => tryck('visa-alla')} className="text-[9.5px] text-[#20c58f]">Visa alla</button>}>
        {skickat.length === 0 ? <p className="text-[9.5px] text-slate-500">Inget skickat de senaste sju dagarna.</p> : skickat.map(([kund, under, belopp]) => (
          <p key={kund + under} className="flex justify-between gap-2 border-t border-slate-800 py-0.5 text-[9.5px] first:border-t-0">
            <span className="min-w-0 truncate text-slate-300">{kund}<span className="text-slate-500"> · {under}</span></span>
            <span className="whitespace-nowrap text-slate-200">{belopp}</span>
          </p>
        ))}
      </SidoKort>
    </div>
  )
}

/** Två kolumner: listan och sidopanelen (sidopanelen under på smal skärm) */
export function MedSidopanel({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  return (
    <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1fr)_190px]">
      <div className="grid min-w-0 gap-2">{children}</div>
      {panel}
    </div>
  )
}

// ─── Varningen vid för tidig sändning ──────────────

export function TidigVarning({ titel, manad, kund, faktura, skaSkickas, idagText, tryck, markera, nr }: Bas & {
  titel: string; manad?: boolean; kund: string; faktura: string; skaSkickas: string; idagText: string
}) {
  return (
    <Dialog
      titel={titel}
      ikon={<Icon name="rapport.avvikelse" size={16} className="text-orange-400" />}
      fot={<>
        <PKnapp onClick={() => tryck('vanta')} markor={mk(markera, 'vanta', nr)}>Vänta till {skaSkickas}</PKnapp>
        <PKnapp onClick={() => tryck('skicka-anda')} markor={mk(markera, 'skicka-anda', nr)}>Skicka ändå</PKnapp>
      </>}
    >
      <p className="text-[11px] leading-snug text-slate-300">
        {manad
          ? 'Månadsfakturor skickas den 1:a i den månad de gäller. Skickar du nu har kunden flera obetalda månadsfakturor samtidigt, och det kan se ut som dubbelfakturering.'
          : 'Års-, halvårs- och kvartalsfakturor skickas 40 dagar före periodstart. Skickas fakturan mer än 60 dagar före får kunden den långt innan perioden, och intäkten hamnar i fel månad.'}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-lg border border-slate-700 bg-slate-800/30 px-2 py-1.5 text-[10.5px]">
        <dt className="text-slate-400">Kund</dt><dd className="truncate text-white">{kund}</dd>
        <dt className="text-slate-400">Faktura</dt><dd className="font-mono text-white">{faktura}</dd>
        <dt className="text-slate-400">Ska skickas</dt><dd className="font-mono text-white">{skaSkickas}</dd>
        <dt className="text-slate-400">Idag</dt><dd className="text-white">{idagText}</dd>
      </dl>
    </Dialog>
  )
}

// ─── Skicka godkända till Fortnox ──────────────────

export interface BRad { id: string; kund: string; faktura: string; belopp: string; utfall?: { ton: Tone; text: string } }

const utkast = (n: number) => `${n} utkast`

/** FortnoxBatchDialog: fas confirm (bekräftelse) eller done (resultat) */
export function BatchDialog({ fas, rader, total, moms, tryck, markera, nr }: Bas & {
  fas: 'confirm' | 'done'; rader: BRad[]; total: string; moms: string
}) {
  const n = rader.length
  const antal = (t: Tone) => rader.filter(r => r.utfall?.ton === t).length
  return (
    <Dialog
      titel={fas === 'confirm' ? `Skapa ${utkast(n)} i Fortnox` : 'Utkast i Fortnox'}
      fot={fas === 'confirm' ? <>
        <PKnapp onClick={() => tryck('avbryt-batch')}>Avbryt</PKnapp>
        <PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skapa-utkast')} markor={mk(markera, 'skapa-utkast', nr)}>Skapa {utkast(n)}</PKnapp>
      </> : (
        <PKnapp prim onClick={() => tryck('stang-batch')} markor={mk(markera, 'stang-batch', nr)}>Stäng</PKnapp>
      )}
    >
      {fas === 'confirm' ? (
        <p className="text-[11px] leading-snug text-slate-300">Varje faktura blir ett utkast i Fortnox, en i taget, på samma sätt som Skapa utkast i Fortnox i fakturan. Fakturadatum blir idag. Utkasten bokförs och skickas till kunden i Fortnox.</p>
      ) : (
        <div className="grid gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
            <span className="font-medium text-white">{n} av {n}</span>
            <span className="flex flex-wrap gap-x-2">
              <Punkt ton="green">{utkast(antal('green'))} skapade</Punkt>
              {antal('red') > 0 && <Punkt ton="red">{antal('red')} misslyckades</Punkt>}
              {antal('orange') > 0 && <Punkt ton="orange">{antal('orange')} hoppades över</Punkt>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-full bg-[#20c58f]" /></div>
        </div>
      )}
      <ul className="divide-y divide-slate-700/50 rounded-lg border border-slate-700 bg-slate-800/30">
        {rader.map(r => (
          <li key={r.id} className="px-2 py-1 text-[10.5px]">
            <span className="flex justify-between gap-2">
              <span className="min-w-0 truncate text-white">{r.kund}<span className="font-mono text-[9.5px] text-slate-500"> · {r.faktura}</span></span>
              <span className="whitespace-nowrap text-slate-200">{r.belopp}</span>
            </span>
            {fas === 'done' && r.utfall && <Punkt ton={r.utfall.ton}>{r.utfall.text}</Punkt>}
          </li>
        ))}
      </ul>
      {fas === 'confirm' ? (
        <p className="flex justify-between text-[10px] text-slate-500"><span>Totalt</span><span className="text-slate-300">{total} {moms}</span></p>
      ) : antal('green') < n ? (
        <p className="text-[10px] text-slate-500">Fakturor som misslyckades eller hoppades över ligger kvar i listan. Öppna dem för att se vad som saknas och skapa utkastet därifrån.</p>
      ) : null}
    </Dialog>
  )
}

// ─── Merförsäljning Avtal: arbetslistan ────────────

export interface MRad {
  id: string
  utfort: string
  status: string
  ton: Tone
  kund: string
  arende: string
  markning: string
  order?: string
  tekniker: string
  belopp: string
}

const MGRID = 'grid grid-cols-[92px_minmax(120px,1.5fr)_110px_70px_54px] items-center gap-2'

function MRadVy({ r, ruta, valda, tryck, markera, nr, knapp }: Bas & { r: MRad; ruta: boolean; valda: Set<string>; knapp?: ReactNode }) {
  const innehall = (
    <>
      <span className="grid"><span className="font-mono text-[10.5px] text-white">{r.utfort}</span><Punkt ton={r.ton}>{r.status}</Punkt></span>
      <span className="grid min-w-0"><span className="truncate text-[11px] text-white">{r.kund}</span><span className="truncate text-[9px] text-slate-500"><span className="font-mono">{r.arende}</span></span></span>
      <span className="grid min-w-0 text-[9.5px]"><span className={`truncate ${r.markning ? 'text-slate-200' : 'text-slate-500'}`}>{r.markning || 'Ingen märkning'}</span>{r.order && <span className="truncate text-slate-500">{r.order}</span>}</span>
      <span className="truncate text-[9.5px] text-slate-300">{r.tekniker}</span>
      <span className="text-right text-[11px] font-semibold text-white">{r.belopp}</span>
    </>
  )
  return (
    <div className={`flex items-center gap-2 border-t border-slate-800/60 px-2 py-1 ${valda.has(r.id) ? 'bg-[#20c58f]/5' : ''}`}>
      {ruta ? <Ruta pa={valda.has(r.id)} etikett={`Markera ${r.kund}`} onClick={() => tryck(`ruta-${r.id}`)} /> : <span className="w-3.5 flex-none" />}
      {knapp ? (
        <>
          <div className={`flex-1 ${MGRID}`}>{innehall}</div>
          {knapp}
        </>
      ) : (
        <Markor markor={mk(markera, `rad-${r.id}`, nr)} block>
          <button type="button" onClick={() => tryck(`rad-${r.id}`)} className={`w-full text-left ${MGRID}`}>{innehall}</button>
        </Markor>
      )}
    </div>
  )
}

export function MerforsaljningLista({ utan, vantar, godkanda, valda, tryck, markera, nr }: Bas & {
  utan: MRad[]; vantar: MRad[]; godkanda: MRad[]; valda: Set<string>
}) {
  const grupp = (key: string, ton: Tone, titel: string, desc: string, rader: MRad[], summa: string) => {
    if (rader.length === 0) return null
    const n = rader.filter(r => valda.has(r.id)).length
    return (
      <div key={key}>
        <Grupprad id={key} ton={ton} titel={titel} desc={desc} total={`${rader.length} ${rader.length === 1 ? 'faktura' : 'fakturor'} · ${summa}`}
          pa={n > 0 && n === rader.length} delvis={n > 0 && n < rader.length} tryck={tryck} markera={markera} nr={nr} />
        {rader.map(r => <MRadVy key={r.id} r={r} ruta valda={valda} tryck={tryck} markera={markera} nr={nr} />)}
      </div>
    )
  }
  const sum = (rader: MRad[]) => `${rader.reduce((s, r) => s + Number(r.belopp.replace(/\s/g, '')), 0).toLocaleString('sv-SE')} kr`
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="min-w-[540px]">
        <div className="flex items-center gap-2 border-b border-slate-800 px-2 py-1">
          <span className="w-3.5 flex-none" />
          <div className={`flex-1 ${MGRID} text-[8.5px] font-semibold uppercase tracking-wider text-slate-500`}>
            <span>Utfört</span><span>Kund och ärende</span><span>Märkning på fakturan</span><span>Tekniker</span><span className="text-right">Belopp inkl.</span>
          </div>
        </div>
        {utan.length === 0 && vantar.length === 0 && godkanda.length === 0 && (
          <p className="py-6 text-center text-[11px] text-slate-400">Ingen merförsäljning att fakturera just nu</p>
        )}
        {utan.length > 0 && (
          <div>
            <Grupprad id="utan" ton="red" titel="Utfört arbete utan faktura" desc="Skapa fakturan från ärendet" utanRuta
              total={`${utan.length} ${utan.length === 1 ? 'ärende' : 'ärenden'} · ${sum(utan)}`} tryck={tryck} markera={markera} nr={nr} />
            {utan.map(r => (
              <MRadVy key={r.id} r={r} ruta={false} valda={valda} tryck={tryck} markera={markera} nr={nr}
                knapp={<PKnapp prim ikon="allman.plus" onClick={() => tryck(`skapa-${r.id}`)} markor={mk(markera, `skapa-${r.id}`, nr)}>Skapa faktura</PKnapp>} />
            ))}
          </div>
        )}
        {grupp('vantar', 'orange', 'Kräver godkännande', 'Granska och godkänn', vantar, sum(vantar))}
        {grupp('godkanda', 'green', 'Godkända, redo för Fortnox', 'Skickas med knappen ovan', godkanda, sum(godkanda))}
      </div>
    </div>
  )
}

/** Sidopanelen i Merförsäljning Avtal */
export function MerforsaljningSidopanel({ skickatText, tryck }: { skickatText: string; tryck: Tryck }) {
  return (
    <div className="grid content-start gap-2">
      <SidoKort titel="Så faktureras merförsäljning">
        <Regler regler={[
          ['När jobbet är utfört', 'Fakturan skapas när ärendet stängs och ska skickas inom en vecka. Lagens gräns är den 15:e månaden efter.'],
          ['En faktura per ärende', 'Kundens märkning blir Er referens, arbetsorder och objekt blir Ert ordernummer, ärendets adress blir leveransadress.'],
          ['Delfakturering', 'Ärenden med flera besök kan faktureras per besök. Nästa besök visas på fakturan.'],
        ]} />
      </SidoKort>
      <SidoKort titel="Skickat i månaden" atgard={<button type="button" onClick={() => tryck('visa-arkivet')} className="text-[9.5px] text-[#20c58f]">Visa arkivet</button>}>
        <p className="text-[9.5px] text-slate-400">{skickatText}</p>
      </SidoKort>
    </div>
  )
}
