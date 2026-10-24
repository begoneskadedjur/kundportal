// src/pages/shared/intranet/guider/_tillbud.tsx
// Delade skärmdelar för guiderna om Tillbud och avvikelser (tekniker och kontor),
// efterbildningar av IncidentsPage från 2026-10-24: flikarna Rapportera, Mina rapporter
// och Registret, formuläret i fyra steg, tack-läget, listan med grupper och rapporten
// med utredningen. Etiketterna är exakt som på sidan (components/tillbud/*).
// Mål för markörer och tryck: flik:<lage>, typ:<typ>, vad, forslag, sok-arende,
// berord, skicka, tom, se-mina, en-till, rad:<id>, status:<status>, uppfoljning, spara, tillbaka.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { ALL_INCIDENT_TYPES, INCIDENT_TYPE_CONFIG, type IncidentStatus, type IncidentType } from '../../../../types/caseIncidents'
import { STATUS_TON, TON_PUNKT, TON_TEXT, TYP_IKON, TYP_TON, rapporteradText, type Ton } from '../../../../components/tillbud/tillbudLogik'
import { Markor } from '../skarmkit'
import type { Mk, Tryck } from './_nyvy_min_dag'

export type Lage = 'rapportera' | 'mina' | 'register'

const STATUS_TEXT: Record<IncidentStatus, string> = { ny: 'Ny', under_utredning: 'Under utredning', atgardad: 'Åtgärdad', avslutad: 'Avslutad' }

const RAM: Record<Ton, string> = {
  gul: 'border-amber-500 bg-amber-500/10', rod: 'border-red-500 bg-red-500/10', bla: 'border-sky-500 bg-sky-500/10',
  gron: 'border-[#20c58f] bg-[#20c58f]/10', gra: 'border-slate-500 bg-slate-500/10',
}

function PunktText({ ton, children }: { ton: Ton; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${TON_TEXT[ton]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${TON_PUNKT[ton]}`} />
      {children}
    </span>
  )
}

export function StatusMini({ status }: { status: IncidentStatus }) {
  return <PunktText ton={STATUS_TON[status]}>{STATUS_TEXT[status]}</PunktText>
}

function Mal({ id, mk, tryck, block = true, className = '', children, ...rest }: {
  id: string; mk: Mk; tryck?: Tryck; block?: boolean; className?: string; children: ReactNode; 'aria-disabled'?: boolean
}) {
  return (
    <Markor markor={mk(id)} block={block}>
      <button type="button" onClick={() => tryck?.(id)} className={`${block ? 'w-full' : ''} text-left ${className}`} {...rest}>
        {children}
      </button>
    </Markor>
  )
}

// ─── Sidhuvud och flikar ───────────────────────────

/** Rubriken (bara när nya vyn inte visar den i sidhuvudet) och raden under */
export function TillbudHuvud({ rubrik, attHantera }: { rubrik?: boolean; attHantera?: number }) {
  return (
    <div className="mb-1.5">
      {rubrik && <p className="text-[15px] font-bold text-white">Tillbud och avvikelser</p>}
      <p className="text-[11px] text-slate-300">
        {attHantera !== undefined
          ? <strong className={attHantera > 0 ? 'text-amber-500' : 'text-slate-200'}>{attHantera} {attHantera === 1 ? 'ny rapport' : 'nya rapporter'} att hantera</strong>
          : 'Oj, aj eller hmm? Rapportera direkt, stort som smått.'}
      </p>
    </div>
  )
}

export function TillbudFlikar({ aktiv, mina, register, mk, tryck }: { aktiv: Lage; mina: number; register?: number; mk: Mk; tryck?: Tryck }) {
  const flikar: { v: Lage; text: string; antal?: number }[] = [
    { v: 'rapportera', text: 'Rapportera' },
    { v: 'mina', text: 'Mina rapporter', antal: mina },
    ...(register !== undefined ? [{ v: 'register' as Lage, text: 'Registret', antal: register }] : []),
  ]
  return (
    <div className="mb-2 flex gap-3 border-b border-slate-700">
      {flikar.map(f => (
        <Markor key={f.v} markor={mk(`flik:${f.v}`)}>
          <button type="button" onClick={() => tryck?.(`flik:${f.v}`)}
            className={`-mb-px flex items-center gap-1 whitespace-nowrap border-b-2 py-1.5 text-[11.5px] font-semibold ${aktiv === f.v ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400'}`}>
            {f.text}{f.antal !== undefined && <span className="font-medium text-slate-400">{f.antal}</span>}
          </button>
        </Markor>
      ))}
    </div>
  )
}

// ─── Formuläret ────────────────────────────────────

function Steg({ nr, children }: { nr: number; children: ReactNode }) {
  return (
    <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-white">
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 font-mono text-[9.5px] text-slate-300">{nr}</span>
      {children}
    </p>
  )
}

const FALT = 'block w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-left text-[11px]'
const ETIKETT = 'mb-0.5 block text-[10px] font-medium text-slate-300'

export interface FormVy {
  typ: IncidentType
  /** Beskrivningen är skriven */
  text?: string
  /** Kopplat ärende, visas i grön ruta */
  koppla?: string
  berorda: string[]
  /** Tekniker: eget namn förvalt och förslag på besök */
  tekniker?: boolean
}

export function TillbudForm({ v, dator, mk, tryck, forslag = [] }: { v: FormVy; dator?: boolean; mk: Mk; tryck?: Tryck; forslag?: { kund: string; rad: string }[] }) {
  const saknas = !v.text ? 'Skriv vad som hände för att kunna skicka.' : v.berorda.length === 0 ? 'Lägg till minst en berörd anställd för att kunna skicka.' : ''
  return (
    <div className="grid gap-2.5 rounded-xl border border-slate-700 bg-slate-900 p-2.5">
      <div>
        <p className="text-[12.5px] font-semibold text-white">Rapportera en händelse</p>
        <p className="text-[10px] text-slate-400">Stort som smått. Rapportera hellre en gång för mycket.</p>
      </div>
      <div>
        <Steg nr={1}>Vad hände?</Steg>
        <div className={`grid gap-1 ${dator ? 'grid-cols-3' : ''}`}>
          {ALL_INCIDENT_TYPES.map(t => {
            const c = INCIDENT_TYPE_CONFIG[t]
            const vald = v.typ === t
            const ton = TYP_TON[t]
            return (
              <Mal key={t} id={`typ:${t}`} mk={mk} tryck={tryck}
                className={`flex items-start gap-1.5 rounded-lg border p-1.5 ${vald ? RAM[ton] : 'border-slate-700 bg-slate-900'}`}>
                <Icon name={TYP_IKON[t]} size={16} className={`mt-0.5 flex-none ${vald ? TON_TEXT[ton] : 'text-slate-300'}`} />
                <span className="min-w-0">
                  <span className={`block text-[11px] font-semibold ${vald ? TON_TEXT[ton] : 'text-white'}`}><span className="font-extrabold">{c.exclamation}</span> {c.label}</span>
                  {(dator || vald) && <span className="block text-[9.5px] leading-snug text-slate-400">{c.description}</span>}
                </span>
              </Mal>
            )
          })}
        </div>
        {v.typ === 'olycka' && (
          <p className="mt-1 flex items-start gap-1 rounded-lg border border-red-500/40 bg-red-500/10 p-1.5 text-[9.5px] text-slate-200">
            <Icon name="tillbud.myndighet" size={16} className="h-3 w-3 flex-none text-red-400" />
            Vid allvarlig skada: ring 112 först. Allvarlig olycka eller allvarligt tillbud anmäls till Arbetsmiljöverket på anmalarbetsskada.se
          </p>
        )}
      </div>
      <div>
        <Steg nr={2}>Beskriv</Steg>
        <span className={ETIKETT}>Vad har hänt? <span className="text-red-400">*</span></span>
        <Mal id="vad" mk={mk} tryck={tryck} className={`${FALT} min-h-[40px] ${v.text ? 'text-white' : 'text-slate-500'}`}>
          {v.text || 'Vad hände, var och hur?'}
        </Mal>
        <span className={`${ETIKETT} mt-1`}>Vad har ni redan gjort? <span className="font-normal text-slate-500">(valfritt)</span></span>
        <span className={`${FALT} text-slate-500`}>Till exempel sanerat platsen</span>
      </div>
      <div>
        <Steg nr={3}>När och vem</Steg>
        <div className={`grid gap-1.5 ${dator ? 'grid-cols-2' : ''}`}>
          <div><span className={ETIKETT}>När inträffade händelsen?</span><span className={`${FALT} text-white`}>2026-10-26 07:30</span></div>
          <div><span className={ETIKETT}>Rapportör</span><span className={`${FALT} border-slate-700/60 bg-slate-800/40 text-slate-300`}>Anna Exempel</span></div>
        </div>
        <span className={`${ETIKETT} mt-1`}>Berörda anställda <span className="text-red-400">*</span></span>
        {v.berorda.map((b, i) => (
          <span key={b} className="mb-1 flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-white">
            <Icon name="rapport.person" size={16} className="h-3 w-3 text-slate-400" />
            <span className="flex-1">{b}{v.tekniker && i === 0 && <span className="ml-1 text-slate-400">du</span>}</span>
            {!(v.tekniker && i === 0) && <Icon name="allman.stang" size={16} className="h-3 w-3 text-slate-400" />}
          </span>
        ))}
        <Mal id="berord" mk={mk} tryck={tryck} className={`${FALT} flex items-center justify-between text-slate-400`}>
          {v.berorda.length === 0 ? 'Välj den det gäller' : 'Lägg till fler berörda'}
          <Icon name="allman.chevron" size={16} className="h-3 w-3 rotate-90" />
        </Mal>
      </div>
      <div>
        <Steg nr={4}>Koppla till ärende <span className="font-normal text-slate-500">(valfritt)</span></Steg>
        {v.koppla ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/5 px-2 py-1.5 text-[11px] font-semibold text-white">
            <Icon name="allman.foretag" size={16} className="h-3.5 w-3.5 text-slate-300" />
            <span className="flex-1 truncate">{v.koppla}</span>
            <Icon name="allman.stang" size={16} className="h-3 w-3 text-slate-400" />
          </span>
        ) : (
          <>
            <Mal id="sok-arende" mk={mk} tryck={tryck} className={`${FALT} flex items-center gap-1 text-slate-500`}>
              <Icon name="allman.sok" size={16} className="h-3 w-3" />{v.tekniker ? 'Sök bland dina ärenden' : 'Sök ärende'}
            </Mal>
            {forslag.length > 0 && (
              <div className="mt-1 grid gap-1">
                <span className="text-[10px] text-slate-400">Dina besök i går och i dag:</span>
                {forslag.map((f, i) => (
                  <Mal key={f.kund} id={i === 0 ? 'forslag' : `forslag:${i}`} mk={mk} tryck={tryck}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1">
                    <Icon name="allman.foretag" size={16} className="h-3.5 w-3.5 flex-none text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-white">{f.kund}</span>
                      <span className="block truncate text-[9.5px] text-slate-400">{f.rad}</span>
                    </span>
                    <Icon name="allman.plus" size={16} className="h-3 w-3 text-slate-400" />
                  </Mal>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="grid gap-1 border-t border-slate-700/60 pt-2">
        <div className={`flex gap-1.5 ${dator ? 'justify-end' : 'flex-col-reverse'}`}>
          <Mal id="tom" mk={mk} tryck={tryck} block={!dator} className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-center text-[11px] font-medium text-white">Töm formuläret</Mal>
          <Mal id="skicka" mk={mk} tryck={tryck} block={!dator} aria-disabled={!!saknas}
            className={`flex items-center justify-center gap-1 rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11.5px] font-semibold text-[#04281c] ${saknas ? 'opacity-50' : ''}`}>
            <Icon name="rapport.skicka" size={16} className="h-3.5 w-3.5" />Skicka rapport
          </Mal>
        </div>
        {saknas && <p className={`text-[9.5px] text-slate-400 ${dator ? 'text-right' : ''}`}>{saknas}</p>}
      </div>
    </div>
  )
}

/** Läget efter Skicka rapport */
export function TillbudTack({ typ, mk, tryck }: { typ: IncidentType; mk: Mk; tryck?: Tryck }) {
  const mottagare = typ === 'olycka' ? 'olyckor' : typ === 'tillbud' ? 'tillbud' : 'avvikelser'
  return (
    <div className="grid gap-2 rounded-xl border border-[#20c58f]/40 bg-slate-900 p-2.5">
      <div className="flex items-start gap-2">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#20c58f]/15 text-[#20c58f]"><Icon name="allman.bock" size={16} /></span>
        <div>
          <p className="text-[12.5px] font-semibold text-white">{rapporteradText(typ)}</p>
          <p className="text-[10.5px] leading-snug text-slate-300">Tack. De som tar emot {mottagare} har fått en notis och ett mejl. Rapporten ligger under Mina rapporter med status Ny.</p>
        </div>
      </div>
      <Mal id="se-mina" mk={mk} tryck={tryck} className="flex items-center justify-center gap-1 rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11.5px] font-semibold text-[#04281c]">
        <Icon name="allman.lista" size={16} className="h-3.5 w-3.5" />Se mina rapporter
      </Mal>
      <Mal id="en-till" mk={mk} tryck={tryck} className="flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11.5px] font-medium text-white">
        <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Rapportera en till
      </Mal>
    </div>
  )
}

// ─── Listan ────────────────────────────────────────

export interface ExRapport {
  id: string
  typ: IncidentType
  status: IncidentStatus
  text: string
  datum: string
  berorda: string
  atgard?: string
  ansvarig?: string
}

export interface ExGrupp {
  rubrik: string
  beskr: string
  ikon: IconName
  ikonFarg?: string
  rader: ExRapport[]
  hopfalld?: boolean
}

export function TillbudLista({ grupper, vald, mk, tryck }: { grupper: ExGrupp[]; vald?: string; mk: Mk; tryck?: Tryck }) {
  return (
    <div className="grid gap-2.5">
      {grupper.map(g => (
        <section key={g.rubrik}>
          <p className="flex items-center gap-1 text-[12px] font-semibold text-white">
            <Icon name={g.ikon} size={16} className={g.ikonFarg || 'text-slate-400'} />
            {g.rubrik}<span className="font-medium text-slate-400">{g.rader.length}</span>
            {g.hopfalld && <Icon name="allman.chevron" size={16} className="h-3 w-3 text-slate-400" />}
          </p>
          <p className="mb-1 text-[10px] text-slate-400">{g.beskr}</p>
          {!g.hopfalld && g.rader.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              {g.rader.map(r => (
                <Mal key={r.id} id={`rad:${r.id}`} mk={mk} tryck={tryck}
                  className={`grid grid-cols-[22px_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 border-b border-l-2 border-slate-700/60 px-2 py-1.5 last:border-b-0 ${vald === r.id ? 'border-l-[#20c58f] bg-[#20c58f]/10' : 'border-l-transparent'}`}>
                  <span className={`row-span-3 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-slate-700 bg-slate-800 ${TON_TEXT[TYP_TON[r.typ]]}`}>
                    <Icon name={TYP_IKON[r.typ]} size={16} className="h-3 w-3" />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${TON_TEXT[TYP_TON[r.typ]]}`}>{INCIDENT_TYPE_CONFIG[r.typ].label}</span>
                    <StatusMini status={r.status} />
                  </span>
                  <span className="truncate text-[11px] text-white">{r.text}</span>
                  <span className="truncate text-[9.5px] text-slate-400">{r.datum}, {r.berorda}</span>
                </Mal>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

// ─── Rapporten ─────────────────────────────────────

const STATUSAR: IncidentStatus[] = ['ny', 'under_utredning', 'atgardad', 'avslutad']

export function TillbudRapport({ r, hantera, status, uppfoljning, mk, tryck, tillbaka }: {
  r: ExRapport; hantera?: boolean; status?: IncidentStatus; uppfoljning?: string; mk: Mk; tryck?: Tryck; tillbaka?: boolean
}) {
  const c = INCIDENT_TYPE_CONFIG[r.typ]
  const s = status ?? r.status
  const fakta = (e: string, v: string) => (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-1.5 border-b border-slate-700/60 py-1 text-[10.5px] last:border-b-0">
      <span className="text-slate-400">{e}</span><span className="text-white">{v}</span>
    </div>
  )
  return (
    <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2.5">
      <div className="flex items-start gap-1.5">
        {tillbaka && <Mal id="tillbaka" mk={mk} tryck={tryck} block={false} className="mt-0.5 text-slate-400"><Icon name="rapport.tillbaka" size={16} /></Mal>}
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border border-slate-700 bg-slate-800 ${TON_TEXT[TYP_TON[r.typ]]}`}><Icon name={TYP_IKON[r.typ]} size={16} /></span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-white">{c.exclamation} {c.label}</p>
          <span className="flex items-center gap-2"><StatusMini status={r.status} /><span className="font-mono text-[9.5px] text-slate-400">{r.datum}</span></span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-medium text-slate-400">Vad har hänt?</p>
        <p className="text-[11px] leading-snug text-white">{r.text}</p>
      </div>
      <div className="border-y border-slate-700/60">
        {fakta('Inträffade', r.datum)}
        {fakta('Rapportör', 'Anna Exempel')}
        {fakta('Berörda', r.berorda)}
      </div>
      {!hantera && (
        <div>
          <p className="text-[11.5px] font-semibold text-white">Hanteringen</p>
          <p className="text-[10.5px] leading-snug text-slate-300">
            {r.status === 'ny' ? 'Mottagarna har fått rapporten men ingen har börjat utreda den än.'
              : r.status === 'under_utredning' ? 'Någon utreder vad som hände och varför.'
              : r.status === 'atgardad' ? 'En åtgärd är beslutad. Den följs upp innan rapporten avslutas.'
              : 'Åtgärden är genomförd och uppföljd. Rapporten är klar.'}
          </p>
          {r.atgard && <div className="mt-1 border-y border-slate-700/60">{fakta('Åtgärd', r.atgard)}{r.ansvarig && fakta('Ansvarig', r.ansvarig)}</div>}
        </div>
      )}
      {hantera && (
        <>
          <div>
            <p className="mb-1 text-[11.5px] font-semibold text-white">Status</p>
            <div className="grid grid-cols-2 gap-1">
              {STATUSAR.map(x => {
                const ton = STATUS_TON[x]
                return (
                  <Mal key={x} id={`status:${x}`} mk={mk} tryck={tryck}
                    className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[10.5px] ${s === x ? `${RAM[ton]} font-semibold text-white` : 'border-slate-700 text-slate-300'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${TON_PUNKT[ton]}`} />{STATUS_TEXT[x]}
                  </Mal>
                )
              })}
            </div>
          </div>
          <p className="text-[10.5px] text-slate-400">Klassificering, Orsaksanalys och Beslutad åtgärd med Ansvarig och Klart till</p>
          <div>
            <p className="text-[11.5px] font-semibold text-white">Uppföljning</p>
            <span className={ETIKETT}>Är åtgärden genomförd och tillräcklig? <span className="font-normal text-slate-500">(krävs för att avsluta)</span></span>
            <Mal id="uppfoljning" mk={mk} tryck={tryck} className={`${FALT} ${uppfoljning ? 'text-white' : 'text-slate-500'}`}>
              {uppfoljning || 'Utvärdera effekten av åtgärden'}
            </Mal>
          </div>
          <div className="flex items-center justify-between border-t border-slate-700/60 pt-1.5">
            <span className="flex items-center gap-1 text-[11px] text-red-400"><Icon name="allman.radera" size={16} className="h-3.5 w-3.5" />Radera</span>
            <Mal id="spara" mk={mk} tryck={tryck} block={false} className="flex items-center gap-1 rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11.5px] font-semibold text-[#04281c]">
              <Icon name="allman.bock" size={16} className="h-3.5 w-3.5" />{s === 'avslutad' ? 'Spara och avsluta' : 'Spara'}
            </Mal>
          </div>
        </>
      )}
    </div>
  )
}
