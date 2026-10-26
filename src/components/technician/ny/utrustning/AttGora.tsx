// src/components/technician/ny/utrustning/AttGora.tsx
// Att göra på Stationer i nya arbetsvyn: pågående etableringar och kontroller.
//
//   AttGoraKolumn   dator, sidokolumnen till höger (ca 360 px)
//   AttGoraTelefon  telefon, kompakt lista överst (3 etableringar + Visa alla N)
//   AttGoraList     dator i kartläget, hopfälld till en smal list med antalen
//   AttGoraRad      telefon i kartläget, en rad ovanför flikarna med antalen
//
// Etableringarna kommer ur usePagaendeEtableringar. Varje rad visar avtalets
// antal mot placerade avtalsstationer ("18 av 24 stationer placerade", per typ
// på en rad under), se avtaletsStationer.ts. Avsluta etablering frågar först i
// en egen dialog (AvslutaEtablering.tsx) och går sedan samma väg som förut
// (useEtableringsflode.finishEstablishmentFor). När alla stationer är ute är
// knappen primär. Avslutet spärras inte här: avslutsspärren vid 0 placerade
// stationer i useEtableringsflode ligger kvar.
// En etablering utan placerade stationer mer än GLOMD_EFTER_DAGAR efter
// bokningen räknas som bortglömd: bärnstensfärgad rad och länken Kontrollera
// ärendet, som öppnar etableringsärendet (OppnaArende i föräldern). Gränsen
// och uträkningen står i etableringInfo.ts.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../../icons/Icon'
import type { CustomerStationSummary } from '../../../../services/equipmentService'
import { klockslag, langtDatum, svenskDag } from '../../../../services/teknikerDagService'
import { StatusPunkt } from '../besokUi'
import { avslutsLage, useAvslutaEtablering } from './AvslutaEtablering'
import type { EtableringInfo } from './etableringInfo'
import type { KontrollData } from './useKontrollData'
import { KORT, RADKNAPP, RADKNAPP_PRIMAR, RAM_IKONKNAPP } from './utrustningUi'

/** "idag 08:00", "igår", "för 4 dagar sedan" eller datumet */
function bokadText(e: EtableringInfo): string {
  if (!e.rad.bokad || e.dagar === null) return 'Påbörjad'
  const d = new Date(e.rad.bokad)
  if (e.dagar <= 0) return `Bokad idag ${klockslag(d)}`
  if (e.dagar === 1) return 'Bokad igår'
  if (e.dagar < 14) return `Bokad för ${e.dagar} dagar sedan`
  return `Bokad ${svenskDag(d)}`
}
function bokadKort(e: EtableringInfo): string {
  if (!e.rad.bokad || e.dagar === null) return 'påbörjad'
  if (e.dagar <= 0) return 'idag'
  if (e.dagar === 1) return 'igår'
  if (e.dagar < 14) return `för ${e.dagar} dagar sedan`
  return svenskDag(new Date(e.rad.bokad))
}

function PlaceradeText({ e, kompakt }: { e: EtableringInfo; kompakt?: boolean }) {
  const p = e.rad.placerade
  const lage = avslutsLage(e.rad)
  if (e.glomd) return <StatusPunkt ton="gul">Inga stationer på {e.dagar} dagar</StatusPunkt>

  // Avtalets antal finns: "18 av 24 stationer placerade"
  if (lage.avtalat !== null && lage.placerade !== null) {
    const x = lage.placerade
    const ton = lage.klar ? 'gron' : x === 0 ? 'gul' : 'gra'
    return (
      <StatusPunkt ton={ton}>
        {kompakt ? `${x} av ${lage.avtalat} placerade, ${bokadKort(e)}` : `${x} av ${lage.avtalat} stationer placerade`}
      </StatusPunkt>
    )
  }

  // Avtalets antal saknas: som förut, med en grå rad om det
  if (p === null) return <StatusPunkt ton="gra">Antalet kunde inte hämtas</StatusPunkt>
  return (
    <>
      {p === 0 ? (
        <StatusPunkt ton="gul">{kompakt ? `Inga placerade, ${bokadKort(e)}` : 'Inga stationer placerade än'}</StatusPunkt>
      ) : (
        <StatusPunkt ton="gron">
          {kompakt ? `${p} placerade, ${bokadKort(e)}` : `${p} ${p === 1 ? 'station' : 'stationer'} placerade sedan start`}
        </StatusPunkt>
      )}
      {e.rad.avtal && <span className="text-[13px] text-slate-500">Avtalets antal saknas</span>}
    </>
  )
}

/** "Betongstation 12 av 16, Mekanisk fälla 6 av 8" och tilläggen utöver avtalet */
function PerTypText({ e }: { e: EtableringInfo }) {
  const avtal = e.rad.avtal
  if (!avtal || e.glomd) return null
  const delar: string[] = []
  if (avtal.perTyp.length > 1) {
    for (const t of avtal.perTyp) delar.push(`${t.namn} ${t.placerade ?? 0} av ${t.avtalat}`)
  }
  if (avtal.tillagg > 0) delar.push(`${avtal.tillagg} ${avtal.tillagg === 1 ? 'tilläggsstation' : 'tilläggsstationer'} utöver avtalet`)
  if (delar.length === 0) return null
  return <span className="text-[13px] text-slate-400">{delar.join(', ')}</span>
}

interface EtableringProps {
  etableringar: EtableringInfo[]
  onPlacera: (customerId: string) => void
  onFardig: (customerId: string, kund: string, kommentar: string) => void
  onOppnaArende: (caseId: string) => void
  avslutar: string | null
}

type RadProps = Omit<EtableringProps, 'etableringar' | 'onFardig'> & {
  e: EtableringInfo
  kompakt?: boolean
  /** Öppnar bekräftelsen, avslutet körs först efter den */
  onAvsluta: (e: EtableringInfo) => void
}

function EtableringRad({ e, kompakt, onPlacera, onAvsluta, onOppnaArende, avslutar }: RadProps) {
  const { rad } = e
  const arbetar = avslutar === rad.customerId
  const klar = avslutsLage(rad).klar
  const knappar = (
    <>
      <button
        type="button"
        onClick={() => onPlacera(rad.customerId)}
        className={RAM_IKONKNAPP}
        aria-label={`Placera station hos ${rad.kund}`}
        title="Placera station"
      >
        <Icon name="utrustning.placera" size={20} />
      </button>
      <button
        type="button"
        onClick={() => onAvsluta(e)}
        disabled={arbetar}
        className={klar ? RADKNAPP_PRIMAR : RADKNAPP}
        aria-label={`Avsluta etableringen hos ${rad.kund}`}
      >
        <Icon name={arbetar ? 'allman.laddar' : 'station.klar'} size={20} className={arbetar ? 'animate-spin' : ''} />
        {kompakt ? 'Avsluta' : 'Avsluta etablering'}
      </button>
    </>
  )
  return (
    <li className={`flex ${kompakt ? 'items-center' : 'flex-col items-stretch'} gap-2 py-2.5 pl-3.5 pr-2.5 ${e.glomd ? 'bg-amber-500/10' : ''}`}>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <Link
          to={`/technician/equipment/customer/${rad.customerId}`}
          className="text-[15px] font-semibold text-white truncate hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
        >
          {rad.kund}{e.ort && !kompakt && <span className="font-normal text-slate-400">, {e.ort}</span>}
        </Link>
        <PlaceradeText e={e} kompakt={kompakt} />
        <PerTypText e={e} />
        {(!kompakt || e.glomd) && (
          <span className="text-[13px] text-slate-400">
            {e.glomd ? (
              <>
                {!kompakt && <>Bokad {rad.bokad ? svenskDag(new Date(rad.bokad)) : ''}. </>}
                <button
                  type="button"
                  onClick={() => onOppnaArende(rad.caseId)}
                  className="font-semibold text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
                >
                  Kontrollera ärendet
                </button>
              </>
            ) : bokadText(e)}
          </span>
        )}
      </div>
      {kompakt ? knappar : <div className="flex items-center justify-end gap-2">{knappar}</div>}
    </li>
  )
}

interface KontrollProps {
  kontroll: KontrollData
  saknarSchema: CustomerStationSummary[]
  onVisaKontroller: () => void
}

function namnLista(namn: string[]): string {
  if (namn.length === 0) return ''
  if (namn.length === 1) return namn[0]
  if (namn.length === 2) return `${namn[0]} och ${namn[1]}`
  const rest = namn.length - 2
  return `${namn[0]}, ${namn[1]} och ${rest === 1 ? 'en till' : `${rest} till`}`
}

function manadsNamn(): string {
  const m = new Date().toLocaleDateString('sv-SE', { month: 'long', timeZone: 'Europe/Stockholm' })
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** Raden "Oktober 9 utförda, 6 kvar, 18 försenade" */
export function ManadsRad({ kontroll }: { kontroll: KontrollData }) {
  const { grupper, utfordaManad } = kontroll
  return (
    <p className="text-[13px] text-slate-400">
      <span className="font-semibold text-white">{manadsNamn()}</span>{' '}
      {utfordaManad} utförda, {grupper.kvarIManaden} kvar, {grupper.forsenade.length} försenade
    </p>
  )
}

function KontrollLank({ ikon, ikonFarg, rubrik, antal, antalFarg, text, onClick }: {
  ikon: IconName; ikonFarg: string; rubrik: string; antal: number; antalFarg: string; text: string; onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full min-h-[56px] flex items-center gap-3 py-2 pl-3.5 pr-2.5 text-left hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
      >
        <Icon name={ikon} size={20} className={`flex-shrink-0 ${ikonFarg}`} />
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-white">
            {rubrik}<span className={`font-medium tabular-nums ${antalFarg}`}>{antal}</span>
          </span>
          {text && <span className="text-[13px] text-slate-400 truncate">{text}</span>}
        </span>
        <Icon name="allman.chevron" size={16} className="flex-shrink-0 text-slate-500" />
      </button>
    </li>
  )
}

function KontrollSammanfattning({ kontroll, saknarSchema, onVisaKontroller }: KontrollProps) {
  const { grupper, laddar } = kontroll
  if (laddar) {
    return <p className="text-[13px] text-slate-400 flex items-center gap-2"><Icon name="allman.laddar" size={16} className="animate-spin" />Hämtar kontrollerna...</p>
  }
  const nastaVecka = grupper.veckan[0]
  const rader = [
    grupper.forsenade.length > 0 && (
      <KontrollLank
        key="forsenade"
        ikon="arendelista.passerad" ikonFarg="text-orange-400"
        rubrik="Försenade" antal={grupper.forsenade.length} antalFarg="text-orange-400"
        text={`Bokade men inte utförda, äldst ${svenskDag(new Date(grupper.forsenade[0].scheduled_at))}`}
        onClick={onVisaKontroller}
      />
    ),
    <KontrollLank
      key="idag"
      ikon="falt.idag" ikonFarg="text-violet-400"
      rubrik="Idag" antal={grupper.idag.length} antalFarg="text-[#20c58f]"
      text={grupper.idag.length === 0 ? 'Inga kontroller bokade idag' : namnLista(grupper.idag.map(i => `${i.customer_name} ${klockslag(new Date(i.scheduled_at))}`))}
      onClick={onVisaKontroller}
    />,
    <KontrollLank
      key="veckan"
      ikon="falt.vecka" ikonFarg="text-violet-400"
      rubrik="Denna vecka" antal={grupper.veckan.length} antalFarg="text-slate-400"
      text={nastaVecka ? `Nästa: ${nastaVecka.customer_name}, ${langtDatum(svenskDag(new Date(nastaVecka.scheduled_at))).toLowerCase()}` : 'Inga fler denna vecka'}
      onClick={onVisaKontroller}
    />,
    saknarSchema.length > 0 && (
      <KontrollLank
        key="schema"
        ikon="arendelista.boka" ikonFarg="text-amber-400"
        rubrik="Saknar schema" antal={saknarSchema.length} antalFarg="text-amber-400"
        text={namnLista(saknarSchema.map(c => c.customer_name))}
        onClick={onVisaKontroller}
      />
    ),
  ].filter(Boolean)
  return (
    <>
      <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>{rader}</ul>
      <ManadsRad kontroll={kontroll} />
    </>
  )
}

/** Dator: sidokolumnen */
export function AttGoraKolumn(props: EtableringProps & KontrollProps & { onDolj?: () => void }) {
  const { etableringar, onDolj, onFardig, ...rest } = props
  const avsluta = useAvslutaEtablering(onFardig)
  return (
    <aside aria-label="Att göra" className="flex flex-col gap-4">
      {avsluta.dialog}
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-white">
        <Icon name="arendelista.att-gora" size={20} className="text-[#20c58f]" />
        <span className="flex-1">Att göra</span>
        {onDolj && (
          <button type="button" onClick={onDolj} className="min-h-[44px] px-2 text-[13px] font-semibold text-[#20c58f] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
            Fäll ihop
          </button>
        )}
      </h2>

      {etableringar.length > 0 && (
        <section aria-labelledby="attgora-etab" data-genomgang="utr-etablering" className="flex flex-col gap-2">
          <h3 id="attgora-etab" className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Icon name="bokning.etablering" size={20} className="text-violet-400" />
            <span className="flex-1">{etableringar.length === 1 ? 'Pågående etablering' : 'Pågående etableringar'}</span>
            <span className="text-sm font-medium text-slate-400 tabular-nums">{etableringar.length}</span>
          </h3>
          <p className="text-[13px] leading-relaxed text-slate-400">
            Tryck Avsluta etablering när alla stationer är ute. Då stängs ärendet och tilläggsstationer faktureras.
          </p>
          <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>
            {etableringar.map(e => <EtableringRad key={e.rad.caseId} e={e} onAvsluta={x => avsluta.fraga(x.rad)} {...rest} />)}
          </ul>
        </section>
      )}

      <section aria-labelledby="attgora-kontr" className={`flex flex-col gap-2 ${etableringar.length > 0 ? 'pt-4 border-t border-slate-700/60' : ''}`}>
        <h3 id="attgora-kontr" className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <Icon name="utrustning.kontroller" size={20} className="text-violet-400" />
          <span className="flex-1">Kontroller</span>
          <button type="button" onClick={rest.onVisaKontroller} className="min-h-[44px] px-1 text-[13px] font-semibold text-[#20c58f] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
            Visa alla
          </button>
        </h3>
        <KontrollSammanfattning kontroll={rest.kontroll} saknarSchema={rest.saknarSchema} onVisaKontroller={rest.onVisaKontroller} />
      </section>
    </aside>
  )
}

/** Telefon: kompakt lista överst */
export function AttGoraTelefon(props: EtableringProps & Omit<KontrollProps, 'saknarSchema'>) {
  const { etableringar, kontroll, onVisaKontroller, onFardig, ...rest } = props
  const [allaSynliga, setAllaSynliga] = useState(false)
  const avsluta = useAvslutaEtablering(onFardig)
  const forsenade = kontroll.grupper.forsenade
  if (etableringar.length === 0 && forsenade.length === 0) return null
  // Bortglömda först så att de inte göms bakom Visa alla
  const sorterade = [...etableringar].sort((a, b) => Number(b.glomd) - Number(a.glomd))
  const visade = allaSynliga ? sorterade : sorterade.slice(0, 3)
  return (
    <section aria-label="Att göra" className="flex flex-col gap-2">
      {avsluta.dialog}
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
        <Icon name="arendelista.att-gora" size={20} className="text-[#20c58f]" />
        Att göra
      </h2>
      <div className={`${KORT} overflow-hidden`}>
        {etableringar.length > 0 && (
          <div data-genomgang="utr-etablering">
            <h3 className="flex items-center gap-2 px-3.5 pt-3 pb-1 text-sm font-semibold text-white">
              <Icon name="bokning.etablering" size={16} className="text-violet-400" />
              {etableringar.length === 1 ? 'Pågående etablering' : `Pågående etableringar, ${etableringar.length}`}
            </h3>
            <ul className="divide-y divide-slate-700/60">
              {visade.map(e => <EtableringRad key={e.rad.caseId} e={e} kompakt onAvsluta={x => avsluta.fraga(x.rad)} {...rest} />)}
            </ul>
            {etableringar.length > 3 && (
              <button
                type="button"
                onClick={() => setAllaSynliga(v => !v)}
                className="w-full min-h-[44px] px-3.5 flex items-center gap-1 text-sm font-semibold text-[#20c58f] border-t border-slate-700/60 hover:bg-slate-800/60"
              >
                {allaSynliga ? 'Visa färre' : `Visa alla ${etableringar.length} etableringar`}
                <Icon name="allman.chevron" size={16} className={allaSynliga ? '-rotate-90' : 'rotate-90'} />
              </button>
            )}
          </div>
        )}
        {forsenade.length > 0 && (
          <button
            type="button"
            onClick={onVisaKontroller}
            className={`w-full min-h-[56px] flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-800/60 ${etableringar.length > 0 ? 'border-t border-slate-700/60' : ''}`}
          >
            <Icon name="arendelista.passerad" size={20} className="flex-shrink-0 text-orange-400" />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-white">
                {forsenade.length === 1 ? '1 kontroll är försenad' : `${forsenade.length} kontroller är försenade`}
              </span>
              <span className="block text-[13px] text-slate-400">
                Äldst bokad {svenskDag(new Date(forsenade[0].scheduled_at))}. <span className="font-semibold text-[#20c58f]">Visa i Kontroller</span>
              </span>
            </span>
            <Icon name="allman.chevron" size={16} className="flex-shrink-0 text-slate-500" />
          </button>
        )}
      </div>
    </section>
  )
}

interface AntalProps {
  etableringar: EtableringInfo[]
  kontroll: KontrollData
  saknarSchema: CustomerStationSummary[]
  onVisa: () => void
  onVisaKontroller: () => void
}

/** Dator i kartläget: smal list med antalen */
export function AttGoraList({ etableringar, kontroll, saknarSchema, onVisa, onVisaKontroller }: AntalProps) {
  const glomda = etableringar.filter(e => e.glomd).length
  const knapp = 'w-full min-h-[64px] flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
  return (
    <aside aria-label="Att göra, hopfälld" className={`${KORT} w-[76px] flex flex-col items-stretch gap-1 p-1.5`}>
      <button type="button" onClick={onVisa} className={knapp} aria-label="Visa Att göra" title="Visa Att göra">
        <Icon name="falt.attgora" size={20} className="text-[#20c58f]" />
        <span className="text-[11px] font-semibold text-white leading-tight">Att göra</span>
      </button>
      <span aria-hidden="true" className="mx-2 border-t border-slate-700/60" />
      <button
        type="button"
        onClick={onVisa}
        className={knapp}
        aria-label={`${etableringar.length} pågående etableringar${glomda > 0 ? `, ${glomda} utan stationer` : ''}`}
      >
        <Icon name="bokning.etablering" size={20} className={glomda > 0 ? 'text-amber-400' : 'text-violet-400'} />
        <span className="text-[15px] font-semibold text-white tabular-nums">{etableringar.length}</span>
        <span className="text-[11px] text-slate-400 leading-tight">Etablering</span>
      </button>
      <button type="button" onClick={onVisaKontroller} className={knapp} aria-label={`${kontroll.grupper.forsenade.length} försenade kontroller`}>
        <Icon name="arendelista.passerad" size={20} className="text-orange-400" />
        <span className="text-[15px] font-semibold text-white tabular-nums">{kontroll.grupper.forsenade.length}</span>
        <span className="text-[11px] text-slate-400 leading-tight">Försenade</span>
      </button>
      <button type="button" onClick={onVisaKontroller} className={knapp} aria-label={`${saknarSchema.length} kunder saknar schema`}>
        <Icon name="arendelista.boka" size={20} className="text-amber-400" />
        <span className="text-[15px] font-semibold text-white tabular-nums">{saknarSchema.length}</span>
        <span className="text-[11px] text-slate-400 leading-tight text-center">Utan schema</span>
      </button>
    </aside>
  )
}

/** Telefon i kartläget: en rad med antalen, trycket fäller ut listan */
export function AttGoraRad({ etableringar, kontroll, onVisa }: Pick<AntalProps, 'etableringar' | 'kontroll' | 'onVisa'>) {
  const delar = [
    etableringar.length > 0 ? `${etableringar.length} ${etableringar.length === 1 ? 'etablering' : 'etableringar'}` : null,
    kontroll.grupper.forsenade.length > 0 ? `${kontroll.grupper.forsenade.length} försenade` : null,
  ].filter(Boolean)
  if (delar.length === 0) return null
  return (
    <button
      type="button"
      onClick={onVisa}
      className={`${KORT} w-full min-h-[56px] flex items-center gap-3 px-3.5 py-2 text-left hover:bg-slate-800/60`}
    >
      <Icon name="arendelista.att-gora" size={20} className="flex-shrink-0 text-[#20c58f]" />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-white">Att göra</span>
        <span className="block text-[13px] text-slate-400 truncate">{delar.join(', ')}</span>
      </span>
      <Icon name="allman.chevron" size={16} className="flex-shrink-0 text-slate-500 rotate-90" />
    </button>
  )
}
