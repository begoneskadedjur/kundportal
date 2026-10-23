// src/components/technician/ny/utrustning/KontrollerFlik.tsx
// Fliken Kontroller på Stationer i nya arbetsvyn. Ersätter InspectionOverviewTab
// i nya vyn (den gamla är orörd och används av gamla sidan).
//
// Samma data som gamla fliken (useKontrollData: getInspectionOverview och
// getActiveScheduleCustomerIds), grupperad per läge i svensk kalenderdag:
//   Försenade           bokade men inte utförda, äldst först, orange (rött bara för akut)
//   Idag, Denna vecka   de bokade
//   Resten av månaden   hopfälld
//   Saknar schema       kunder med stationer men utan aktivt återkommande schema
//
// Åtgärder: gamla fliken öppnade kundens schemapanel (Hantera och raden). Det
// finns kvar som Boka om. Öppna öppnar kontrollens ärende (OppnaArende i
// föräldern), eller kundens stationer när kontrollen saknar ärende.
// Vyn skapar och flyttar aldrig bokningar själv, precis som gamla fliken.

import { useState } from 'react'
import type { CustomerStationSummary } from '../../../../services/equipmentService'
import { frequencyLabel, type BookedInspection } from '../../../../services/technicianEquipmentService'
import { klockslag, kortDag, laggTillDagar, ortUrAdress, svenskDag } from '../../../../services/teknikerDagService'
import { Icon, type IconName } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import { ManadsRad } from './AttGora'
import type { KontrollData } from './useKontrollData'
import { IKONKNAPP, KORT, RADKNAPP, RAM_IKONKNAPP, dagarMellan } from './utrustningUi'

const FORSENADE_SYNLIGA = 4

interface Props {
  kontroll: KontrollData
  saknarSchema: CustomerStationSummary[]
  /** Kunder med pågående etablering, visas i Saknar schema */
  etableringKunder: Set<string>
  onBokaOm: (customerId: string, kund: string) => void
  onOppna: (i: BookedInspection) => void
  onSchemalagg: (kunder: CustomerStationSummary[]) => void
}

function kundNamn(i: BookedInspection): string {
  return i.site_name && !i.customer_name.includes(i.site_name) ? `${i.customer_name}, ${i.site_name}` : i.customer_name
}

function meta(i: BookedInspection): string {
  const f = frequencyLabel(i.frequency)
  return [f, i.total_stations > 0 ? `${i.total_stations} stationer` : null].filter(Boolean).join(', ')
}

function sistaIManaden(idag: string): string {
  const [y, m] = idag.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0, 12))
  return d.toISOString().slice(0, 10)
}

function GruppRubrik({ id, ikon, farg, rubrik, antal, antalFarg = 'text-slate-400', text }: {
  id: string; ikon: IconName; farg: string; rubrik: string; antal: number; antalFarg?: string; text?: string
}) {
  return (
    <div className="space-y-0.5">
      <h3 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name={ikon} size={20} className={farg} />
        {rubrik}
        <span className={`font-medium tabular-nums ${antalFarg}`}>{antal}</span>
      </h3>
      {text && <p className="text-[13px] text-slate-400">{text}</p>}
    </div>
  )
}

export function KontrollerFlik({ kontroll, saknarSchema, etableringKunder, onBokaOm, onOppna, onSchemalagg }: Props) {
  const [allaForsenade, setAllaForsenade] = useState(false)
  const [visaManaden, setVisaManaden] = useState(false)
  const { grupper, laddar } = kontroll
  const idag = svenskDag()

  if (laddar) {
    return (
      <div className="py-16 flex justify-center text-slate-400 text-[15px] items-center gap-2">
        <Icon name="allman.laddar" size={20} className="animate-spin" />Hämtar kontrollerna...
      </div>
    )
  }

  const forsenade = allaForsenade ? grupper.forsenade : grupper.forsenade.slice(0, FORSENADE_SYNLIGA)

  const bokadRad = (i: BookedInspection) => {
    const dag = svenskDag(new Date(i.scheduled_at))
    return (
      <li key={i.id} className="flex items-center gap-2 py-2 pl-3 pr-2">
        <button
          type="button"
          onClick={() => onOppna(i)}
          className="flex-1 min-w-0 min-h-[52px] flex items-center gap-3 text-left rounded-lg hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          aria-label={`Öppna kontrollen hos ${kundNamn(i)}`}
        >
          <span className="w-14 flex-shrink-0 text-center">
            <span className="block font-mono text-[15px] font-semibold text-white tabular-nums">{klockslag(new Date(i.scheduled_at))}</span>
            <span className="block text-[12px] text-slate-400">{kortDag(dag, idag)}{dag > idag && dag !== laggTillDagar(idag, 1) ? ` ${Number(dag.slice(8))}` : ''}</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-white leading-snug break-words">{kundNamn(i)}</span>
            {meta(i) && <span className="block text-[13px] text-slate-400">{meta(i)}</span>}
          </span>
          <Icon name="allman.chevron" size={16} className="flex-shrink-0 text-slate-500" />
        </button>
        <button type="button" onClick={() => onBokaOm(i.customer_id, i.customer_name)} className={IKONKNAPP} aria-label={`Boka om kontrollen hos ${kundNamn(i)}`} title="Boka om">
          <Icon name="kund.schema" size={20} />
        </button>
      </li>
    )
  }

  const tomt = grupper.forsenade.length + grupper.idag.length + grupper.veckan.length + grupper.manaden.length === 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ManadsRad kontroll={kontroll} />
        <HjalpText id="utr-kontroller" rubrik="Kontroller" utanRubrik>
          Kontrollerna kommer från kundernas scheman. Boka om öppnar kundens schema, där du flyttar tiden.
        </HjalpText>
      </div>

      {grupper.forsenade.length > 0 && (
        <section aria-labelledby="kontr-forsenade" className="space-y-2">
          <GruppRubrik id="kontr-forsenade" ikon="arendelista.passerad" farg="text-orange-400" rubrik="Försenade" antal={grupper.forsenade.length} antalFarg="text-orange-400" text="Bokade men inte utförda. Äldst först." />
          <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>
            {forsenade.map(i => {
              const dag = svenskDag(new Date(i.scheduled_at))
              const dagar = dagarMellan(dag, idag)
              return (
                <li key={i.id} className="flex items-center gap-2 py-2.5 pl-3.5 pr-2.5">
                  <span aria-hidden="true" className="self-stretch w-1 rounded-full bg-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white leading-snug break-words">{kundNamn(i)}</p>
                    <p className="text-[13px] font-medium text-orange-400">
                      {dagar <= 0 ? 'Idag' : dagar === 1 ? '1 dag sedan' : `${dagar} dagar sedan`}, bokad {dag}
                    </p>
                    {meta(i) && <p className="text-[13px] text-slate-400">{meta(i)}</p>}
                  </div>
                  <button type="button" onClick={() => onBokaOm(i.customer_id, i.customer_name)} className={RADKNAPP} aria-label={`Boka om kontrollen hos ${kundNamn(i)}`}>
                    <Icon name="kund.schema" size={20} />Boka om
                  </button>
                  <button type="button" onClick={() => onOppna(i)} className={RAM_IKONKNAPP} aria-label={`Öppna kontrollen hos ${kundNamn(i)}`} title="Öppna">
                    <Icon name="allman.chevron" size={20} />
                  </button>
                </li>
              )
            })}
          </ul>
          {grupper.forsenade.length > FORSENADE_SYNLIGA && (
            <button type="button" onClick={() => setAllaForsenade(v => !v)} className="min-h-[44px] px-1 flex items-center gap-1 text-sm font-semibold text-[#20c58f] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
              {allaForsenade ? 'Visa färre' : `Visa alla ${grupper.forsenade.length} försenade`}
              <Icon name="allman.chevron" size={16} className={allaForsenade ? '-rotate-90' : 'rotate-90'} />
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="kontr-idag" className="space-y-2">
        <GruppRubrik id="kontr-idag" ikon="falt.idag" farg="text-violet-400" rubrik="Idag" antal={grupper.idag.length} antalFarg="text-[#20c58f]" />
        {grupper.idag.length > 0
          ? <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>{grupper.idag.map(bokadRad)}</ul>
          : <p className="text-[13px] text-slate-400">Inga kontroller bokade idag.</p>}
      </section>

      <section aria-labelledby="kontr-veckan" className="space-y-2">
        <GruppRubrik id="kontr-veckan" ikon="falt.vecka" farg="text-violet-400" rubrik="Denna vecka" antal={grupper.veckan.length} />
        {grupper.veckan.length > 0
          ? <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>{grupper.veckan.map(bokadRad)}</ul>
          : <p className="text-[13px] text-slate-400">Inga fler kontroller bokade denna vecka.</p>}
      </section>

      {grupper.manaden.length > 0 && (
        <section aria-label="Resten av månaden" className={`${KORT} overflow-hidden`}>
          <button
            type="button"
            onClick={() => setVisaManaden(v => !v)}
            aria-expanded={visaManaden}
            className="w-full min-h-[56px] flex items-center gap-3 px-3.5 py-2 text-left hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
          >
            <Icon name="falt.manad" size={20} className="flex-shrink-0 text-violet-400" />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-white">
                Resten av {new Date().toLocaleDateString('sv-SE', { month: 'long', timeZone: 'Europe/Stockholm' })}
              </span>
              <span className="block text-[13px] text-slate-400">
                {grupper.manaden.length} {grupper.manaden.length === 1 ? 'kontroll' : 'kontroller'} till och med {sistaIManaden(idag)}
              </span>
            </span>
            <Icon name="allman.chevron" size={16} className={`flex-shrink-0 text-slate-500 transition-transform ${visaManaden ? '-rotate-90' : 'rotate-90'}`} />
          </button>
          {visaManaden && <ul className="divide-y divide-slate-700/60 border-t border-slate-700/60">{grupper.manaden.map(bokadRad)}</ul>}
        </section>
      )}

      {tomt && (
        <div className={`${KORT} p-6 text-center`}>
          <Icon name="station.klar" size={32} className="mx-auto text-slate-600" />
          <p className="mt-2 text-[15px] text-slate-300">Inga bokade kontroller resten av månaden.</p>
        </div>
      )}

      {saknarSchema.length > 0 && (
        <section aria-labelledby="kontr-schema" className="space-y-2">
          <GruppRubrik id="kontr-schema" ikon="arendelista.boka" farg="text-amber-400" rubrik="Saknar schema" antal={saknarSchema.length} antalFarg="text-amber-400" text="Kunder med stationer men utan återkommande kontroller." />
          <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>
            {saknarSchema.map(c => {
              const ort = c.customer_address ? ortUrAdress(c.customer_address) : ''
              const antal = c.outdoor_count + c.indoor_count
              const delar = [ort, `${antal} ${antal === 1 ? 'station' : 'stationer'}`, etableringKunder.has(c.customer_id) ? 'etablering pågår' : null].filter(Boolean)
              return (
                <li key={c.customer_id} className="flex items-center gap-2 py-2.5 pl-3.5 pr-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white leading-snug break-words">{c.customer_name}</p>
                    <p className="text-[13px] text-slate-400">{delar.join(', ')}</p>
                  </div>
                  <button type="button" onClick={() => onSchemalagg([c])} className={RADKNAPP} aria-label={`Schemalägg kontroller för ${c.customer_name}`}>
                    <Icon name="arendelista.boka" size={20} />Schemalägg
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

export default KontrollerFlik
