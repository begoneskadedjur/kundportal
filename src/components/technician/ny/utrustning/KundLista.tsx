// src/components/technician/ny/utrustning/KundLista.tsx
// Kundlistan på Stationer i nya arbetsvyn. Ersätter AllCustomersList,
// ExpandableCustomerRow och MultisiteOrgRow i nya vyn (de gamla är orörda):
//  - sök på namn, enhet, adress och org.nr (substring, som AllCustomersList)
//  - sortering A till Ö, Flest stationer, Avvikelser först, Senast kontrollerad
//    och Saknar schema först
//  - multisite-organisationer som grupp med enheterna under sig, kryssrutor och
//    Schemalägg N enheter
//  - per kund: ort, vem som placerat, antal ute och inne, typernas rutor med
//    antal, senaste och nästa kontroll, avvikelser i ord och EN åtgärd:
//    Schema (schemapanelen) eller Schemalägg när aktivt schema saknas
// Grupperingen och sökningen följer AllCustomersList.tsx:84-186.
//
// Breda ytor (behållaren minst 720 px) får en riktig tabell, smala ytor
// tvåradiga rader. Bredden mäts på behållaren (@container), inte på skärmen,
// eftersom sidokolumnen Att göra tar plats på datorn.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CustomerStationSummary } from '../../../../services/equipmentService'
import { frequencyLabel } from '../../../../services/technicianEquipmentService'
import { ortUrAdress, svenskDag } from '../../../../services/teknikerDagService'
import type { HealthStatus } from '../../../shared/StationHealthBadge'
import StationTypeTile from '../../../shared/stations/StationTypeTile'
import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import type { KontrollPerKund } from './useKontrollData'
import { IKONKNAPP, KORT, RADKNAPP, avvikelseOrd, datum } from './utrustningUi'

export type Sortering = 'name' | 'count' | 'health' | 'recent' | 'schema'

const SORTERINGAR: { varde: Sortering; text: string }[] = [
  { varde: 'name', text: 'A till Ö' },
  { varde: 'count', text: 'Flest stationer' },
  { varde: 'health', text: 'Avvikelser först' },
  { varde: 'recent', text: 'Senast kontrollerad' },
  { varde: 'schema', text: 'Saknar schema först' },
]

const HALSA_ORDNING: Record<HealthStatus, number> = { poor: 0, fair: 1, good: 2, excellent: 3 }
const SIDA = 40
// Tabellens kolumner på bred yta: Kund, Stationer, Senaste, Nästa, Avvikelser, Schema
const KOLUMNER = '@min-[720px]:grid-cols-[minmax(0,1fr)_156px_100px_124px_84px_112px]'

export interface TypRad { namn: string; farg: string; ikon: string; antal: number }

type Post =
  | { typ: 'kund'; kund: CustomerStationSummary; nyckel: string; antal: number; halsa: number; senast: number; utanSchema: boolean }
  | { typ: 'org'; orgId: string; namn: string; enheter: CustomerStationSummary[]; nyckel: string; antal: number; halsa: number; senast: number; utanSchema: boolean }

function orgNamn(enheter: CustomerStationSummary[]): string {
  const hk = enheter.find(s => s.site_type === 'huvudkontor')
  if (hk) return hk.customer_name
  const forsta = enheter[0]
  const i = forsta.customer_name.indexOf(' - ')
  return i > 0 ? forsta.customer_name.substring(0, i) : forsta.customer_name
}

function enhetsNamn(s: CustomerStationSummary): string {
  return s.site_name || s.customer_name.split(' - ').pop() || s.customer_name
}

function tid(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0
}

/** "idag", "igår" eller datumet */
function senasteKontroll(iso: string | null): string {
  if (!iso) return 'Ingen än'
  const dag = datum(iso)
  const idag = svenskDag()
  if (dag === idag) return 'idag'
  const igar = new Date(Date.now() - 86_400_000)
  if (dag === svenskDag(igar)) return 'igår'
  return dag
}

function samreHalsa(enheter: CustomerStationSummary[]): HealthStatus {
  return enheter.reduce<HealthStatus>((v, s) => HALSA_ORDNING[s.health_status] < HALSA_ORDNING[v] ? s.health_status : v, 'excellent')
}

function slaIhopTyper(listor: (TypRad[] | undefined)[]): TypRad[] {
  const m = new Map<string, TypRad>()
  for (const l of listor) for (const t of l ?? []) {
    const r = m.get(t.namn) ?? { ...t, antal: 0 }
    r.antal += t.antal
    m.set(t.namn, r)
  }
  return Array.from(m.values()).sort((a, b) => b.antal - a.antal)
}

interface Props {
  kunder: CustomerStationSummary[]
  /** Utomhusstationernas typer per kund (rutor med antal) */
  typerPerKund: Map<string, TypRad[]>
  /** Nästa och försenad kontroll per kund (useKontrollData) */
  kontrollPerKund: Map<string, KontrollPerKund>
  /** Kunder med aktivt schema, null medan det hämtas */
  medSchema: Set<string> | null
  sok: string
  onSok: (v: string) => void
  sortering: Sortering
  onSortering: (v: Sortering) => void
  /** Alla/Mina, ligger i verktygsraden */
  omfang?: ReactNode
  onSchemapanel: (customerId: string, kund: string, enheter?: { customerId: string; siteName: string }[]) => void
  onSchemalagg: (kunder: CustomerStationSummary[]) => void
}

export function KundLista({
  kunder, typerPerKund, kontrollPerKund, medSchema, sok, onSok, sortering, onSortering, omfang, onSchemapanel, onSchemalagg,
}: Props) {
  const [oppenOrg, setOppenOrg] = useState<string | null>(null)
  const [antalVisade, setAntalVisade] = useState(SIDA)
  useEffect(() => { setAntalVisade(SIDA) }, [sok, sortering])

  const utanSchema = (c: CustomerStationSummary) => !!medSchema && !medSchema.has(c.customer_id)

  const poster = useMemo(() => {
    const saknar = (c: CustomerStationSummary) => !!medSchema && !medSchema.has(c.customer_id)
    const orgar = new Map<string, CustomerStationSummary[]>()
    const enskilda: CustomerStationSummary[] = []
    for (const c of kunder) {
      if (c.is_multisite && c.organization_id) {
        const l = orgar.get(c.organization_id) ?? []
        l.push(c)
        orgar.set(c.organization_id, l)
      } else enskilda.push(c)
    }
    const lista: Post[] = []
    for (const [orgId, enheter] of orgar) {
      const namn = orgNamn(enheter)
      lista.push({
        typ: 'org', orgId, namn,
        enheter: [...enheter].sort((a, b) => enhetsNamn(a).localeCompare(enhetsNamn(b), 'sv')),
        nyckel: namn,
        antal: enheter.reduce((s, e) => s + e.outdoor_count + e.indoor_count, 0),
        halsa: HALSA_ORDNING[samreHalsa(enheter)],
        senast: enheter.reduce((m, e) => Math.max(m, tid(e.latest_inspection_date)), 0),
        utanSchema: enheter.some(saknar),
      })
    }
    for (const c of enskilda) {
      lista.push({
        typ: 'kund', kund: c, nyckel: c.customer_name,
        antal: c.outdoor_count + c.indoor_count,
        halsa: HALSA_ORDNING[c.health_status],
        senast: tid(c.latest_inspection_date),
        utanSchema: saknar(c),
      })
    }

    let filtrerad = lista
    const q = sok.trim().toLowerCase()
    if (q) {
      const orgNr = q.replace(/-/g, '')
      const traff = (c: CustomerStationSummary) =>
        c.customer_name.toLowerCase().includes(q)
        || !!c.site_name?.toLowerCase().includes(q)
        || !!c.customer_address?.toLowerCase().includes(q)
        || (orgNr.length > 0 && !!c.organization_number?.replace(/-/g, '').includes(orgNr))
      filtrerad = lista.filter(p => p.typ === 'kund' ? traff(p.kund) : p.namn.toLowerCase().includes(q) || p.enheter.some(traff))
    }

    filtrerad.sort((a, b) => {
      switch (sortering) {
        case 'count': return b.antal - a.antal
        case 'health': return a.halsa - b.halsa || a.nyckel.localeCompare(b.nyckel, 'sv')
        case 'schema': return Number(b.utanSchema) - Number(a.utanSchema) || a.nyckel.localeCompare(b.nyckel, 'sv')
        case 'recent':
          if (!a.senast && !b.senast) return a.nyckel.localeCompare(b.nyckel, 'sv')
          if (!a.senast) return 1
          if (!b.senast) return -1
          return b.senast - a.senast
        default: return a.nyckel.localeCompare(b.nyckel, 'sv')
      }
    })
    return filtrerad
  }, [kunder, sok, sortering, medSchema])

  const visade = poster.slice(0, antalVisade)
  const totalKunder = poster.length

  return (
    <div className="space-y-3 @container">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        <label className="relative flex-1 sm:min-w-[240px]">
          <span className="sr-only">Sök kund</span>
          <Icon name="allman.sok" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={sok}
            onChange={e => onSok(e.target.value)}
            placeholder="Sök kund, enhet, adress eller org.nr"
            className="w-full h-11 pl-11 pr-11 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          />
          {sok && (
            <button type="button" onClick={() => onSok('')} aria-label="Rensa sökningen" className={`absolute right-0 top-1/2 -translate-y-1/2 ${IKONKNAPP}`}>
              <Icon name="allman.stang" size={16} />
            </button>
          )}
        </label>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:w-56 sm:flex-none">
            <span className="sr-only">Sortera</span>
            <Icon name="utrustning.sortera" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={sortering}
              onChange={e => onSortering(e.target.value as Sortering)}
              className="w-full h-11 pl-11 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
            >
              {SORTERINGAR.map(s => <option key={s.varde} value={s.varde}>{s.text}</option>)}
            </select>
          </label>
          {omfang}
        </div>
      </div>

      {poster.length === 0 ? (
        <div className={`${KORT} p-6 text-center`}>
          <Icon name="arende.station" size={32} className="mx-auto text-slate-600" />
          <p className="mt-2 text-[15px] text-slate-300">{sok ? 'Ingen kund matchar sökningen.' : 'Inga kunder med stationer än.'}</p>
          {sok && (
            <button type="button" onClick={() => onSok('')} className="mt-2 min-h-[44px] px-3 text-sm font-medium text-[#20c58f] hover:underline">
              Rensa sökningen
            </button>
          )}
        </div>
      ) : (
        <div role="table" aria-label="Kunder med stationer" className={`${KORT} overflow-hidden`} data-genomgang="utr-kunder">
          <div role="row" className={`hidden @min-[720px]:grid ${KOLUMNER} gap-3 px-3.5 py-2.5 border-b border-slate-700/60 bg-slate-800/40 text-[12px] font-semibold text-slate-400`}>
            <span role="columnheader">Kund</span>
            <span role="columnheader">Stationer</span>
            <span role="columnheader">Senaste kontroll</span>
            <span role="columnheader">Nästa kontroll</span>
            <span role="columnheader">Avvikelser</span>
            <span role="columnheader" className="text-right">Schema</span>
          </div>
          <div role="rowgroup" className="divide-y divide-slate-700/60">
            {visade.map(p => p.typ === 'kund' ? (
              <KundRad
                key={p.kund.customer_id}
                kund={p.kund}
                typer={typerPerKund.get(p.kund.customer_id)}
                kontroll={kontrollPerKund.get(p.kund.customer_id)}
                utanSchema={utanSchema(p.kund)}
                schemaKant={!!medSchema}
                onSchemapanel={() => onSchemapanel(p.kund.customer_id, p.kund.customer_name)}
                onSchemalagg={() => onSchemalagg([p.kund])}
              />
            ) : (
              <OrgRad
                key={`org-${p.orgId}`}
                namn={p.namn}
                enheter={p.enheter}
                typerPerKund={typerPerKund}
                kontrollPerKund={kontrollPerKund}
                medSchema={medSchema}
                oppen={oppenOrg === p.orgId}
                onVaxla={() => setOppenOrg(o => o === p.orgId ? null : p.orgId)}
                onSchemapanel={() => onSchemapanel(
                  p.enheter[0].customer_id,
                  p.namn,
                  p.enheter.map(s => ({ customerId: s.customer_id, siteName: enhetsNamn(s) })),
                )}
                onSchemalagg={onSchemalagg}
                onSchemapanelEnhet={(s) => onSchemapanel(s.customer_id, s.customer_name)}
              />
            ))}
          </div>
          {totalKunder > visade.length && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-t border-slate-700/60 text-[13px] text-slate-400">
              <span>Visar {visade.length} av {totalKunder} kunder.</span>
              <button type="button" onClick={() => setAntalVisade(n => n + SIDA)} className="min-h-[44px] px-2 font-semibold text-[#20c58f] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
                Visa fler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TypRutor({ typer }: { typer?: TypRad[] }) {
  if (!typer || typer.length === 0) return null
  const visa = typer.slice(0, 4)
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {visa.map(t => (
        <span key={t.namn} title={`${t.antal} ${t.namn}`} className="inline-flex items-center gap-1 text-[12px] text-slate-300 tabular-nums">
          <StationTypeTile size={20} color={t.farg} icon={t.ikon} title={`${t.antal} ${t.namn}`} />
          <span aria-hidden="true">{t.antal}</span>
        </span>
      ))}
      {typer.length > 4 && <span className="text-[12px] text-slate-500">+{typer.length - 4}</span>}
    </span>
  )
}

/** Nästa kontroll: försenad (orange), datum med frekvens, Inget schema eller schema utan bokning hos dig */
function NastaKontroll({ kontroll, utanSchema, schemaKant, enheter, enhet }: {
  kontroll?: KontrollPerKund
  utanSchema: boolean
  schemaKant: boolean
  /** Antal enheter, för organisationsraden */
  enheter?: number
  enhet?: boolean
}) {
  if (kontroll?.forsenad) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-orange-400">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />Försenad
        </span>
        <span className="text-[12px] text-slate-400">bokad {svenskDag(new Date(kontroll.forsenad.scheduled_at))}</span>
      </span>
    )
  }
  if (kontroll?.nasta) {
    const f = enheter ? `${enheter} enheter` : frequencyLabel(kontroll.nasta.frequency)?.toLowerCase()
    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-mono text-[13px] font-medium text-white tabular-nums">{svenskDag(new Date(kontroll.nasta.scheduled_at))}</span>
        {f && <span className="text-[12px] text-slate-400">{f}</span>}
      </span>
    )
  }
  if (!schemaKant) return <span className="text-[13px] text-slate-500">Hämtar...</span>
  if (utanSchema) {
    return (
      <span className="flex flex-col gap-0.5">
        <StatusPunkt ton="gul">Inget schema</StatusPunkt>
        {enhet && <span className="text-[12px] text-slate-400">Markera för att schemalägga</span>}
      </span>
    )
  }
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[13px] text-slate-300">Schema finns</span>
      <span className="text-[12px] text-slate-400">ingen bokning på dig</span>
    </span>
  )
}

/** Telefonens statusrad: det viktigaste först */
function KortStatus({ kontroll, utanSchema, halsaStatus, harStationer }: {
  kontroll?: KontrollPerKund; utanSchema: boolean; halsaStatus: HealthStatus; harStationer: boolean
}) {
  if (kontroll?.forsenad) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-orange-400">
        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />Kontrollen är försenad
      </span>
    )
  }
  if (utanSchema) return <StatusPunkt ton="gul">Inget schema</StatusPunkt>
  if (harStationer && halsaStatus !== 'excellent') return <StatusPunkt ton="gul">{avvikelseOrd(halsaStatus).text} avvikelser</StatusPunkt>
  if (kontroll?.nasta) return <span className="text-[13px] text-slate-400">Nästa kontroll {svenskDag(new Date(kontroll.nasta.scheduled_at))}</span>
  return null
}

function SchemaKnapp({ utanSchema, namn, onSchemapanel, onSchemalagg, enheter }: {
  utanSchema: boolean; namn: string; onSchemapanel: () => void; onSchemalagg?: () => void; enheter?: boolean
}) {
  if (utanSchema && onSchemalagg) {
    return (
      <button type="button" onClick={onSchemalagg} className={RADKNAPP} aria-label={`Schemalägg kontroller för ${enheter ? 'alla enheter i ' : ''}${namn}`}>
        <Icon name="arendelista.boka" size={20} />Schemalägg
      </button>
    )
  }
  return (
    <button type="button" onClick={onSchemapanel} className={RADKNAPP} aria-label={`Schema och kontroller för ${enheter ? 'alla enheter i ' : ''}${namn}`} title="Schema och kontroller">
      <Icon name="kund.schema" size={20} />Schema
    </button>
  )
}

function KundRad({ kund, typer, kontroll, utanSchema, schemaKant, onSchemapanel, onSchemalagg, inskjuten = false, vald, onVald }: {
  kund: CustomerStationSummary
  typer?: TypRad[]
  kontroll?: KontrollPerKund
  utanSchema: boolean
  schemaKant: boolean
  onSchemapanel: () => void
  onSchemalagg?: () => void
  inskjuten?: boolean
  vald?: boolean
  onVald?: () => void
}) {
  const navigate = useNavigate()
  const totalt = kund.outdoor_count + kund.indoor_count
  const namn = inskjuten ? enhetsNamn(kund) : kund.customer_name
  const ort = kund.customer_address ? ortUrAdress(kund.customer_address) : ''
  const av = avvikelseOrd(kund.health_status)
  const oppna = () => navigate(`/technician/equipment/customer/${kund.customer_id}`)
  const antalText = totalt > 0 ? `${kund.outdoor_count} ute, ${kund.indoor_count} inne` : 'Inga stationer'

  const kryss = onVald && (
    <label className="w-11 h-11 -ml-2 flex-shrink-0 flex items-center justify-center cursor-pointer">
      <input
        type="checkbox"
        checked={!!vald}
        onChange={onVald}
        aria-label={`Välj ${namn} för schemaläggning`}
        className="w-5 h-5 rounded border-slate-600 bg-slate-800 accent-[#20c58f]"
      />
    </label>
  )

  return (
    <div role="row" className={`${inskjuten ? 'bg-slate-950/30' : ''}`}>
      {/* Bred yta: tabellrad */}
      <div className={`hidden @min-[720px]:grid ${KOLUMNER} items-center gap-3 min-h-[64px] py-2 pl-3.5 pr-3`}>
        <div role="cell" className={`min-w-0 flex items-center gap-1 ${inskjuten ? 'pl-5' : ''}`}>
          {kryss}
          <button type="button" onClick={oppna} className="min-w-0 flex flex-col gap-0.5 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] group">
            <span className={`${inskjuten ? 'text-sm' : 'text-[15px]'} font-semibold text-white leading-snug break-words group-hover:underline`}>
              {namn}{ort && <span className="font-normal text-slate-400">, {ort}</span>}
            </span>
            {kund.technician_names.length > 0 && (
              <span className="text-[12px] text-slate-400 truncate">Placerade av {kund.technician_names.join(', ')}</span>
            )}
          </button>
        </div>
        <div role="cell" className="flex flex-col gap-1">
          <span className="text-[13px] text-white">{antalText}</span>
          <TypRutor typer={typer} />
        </div>
        <div role="cell"><span className={`font-mono text-[13px] ${kund.latest_inspection_date ? 'text-slate-300' : 'text-slate-500'}`}>{senasteKontroll(kund.latest_inspection_date)}</span></div>
        <div role="cell"><NastaKontroll kontroll={kontroll} utanSchema={utanSchema} schemaKant={schemaKant} enhet={!!onVald} /></div>
        <div role="cell">{totalt > 0 ? <StatusPunkt ton={av.ton}>{av.text}</StatusPunkt> : <span className="text-[13px] text-slate-500">Inga stationer</span>}</div>
        <div role="cell" className="flex justify-end">
          {totalt > 0 && <SchemaKnapp utanSchema={utanSchema} namn={namn} onSchemapanel={onSchemapanel} onSchemalagg={onSchemalagg} />}
        </div>
      </div>

      {/* Smal yta: två rader */}
      <div className={`@min-[720px]:hidden flex items-center gap-2 py-2.5 pl-3.5 pr-2.5 min-h-[64px] ${inskjuten ? 'pl-5' : ''}`}>
        {kryss}
        <button type="button" onClick={oppna} className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
          <span className="block text-[15px] font-semibold text-white leading-snug break-words">{namn}</span>
          <span className="block text-[13px] text-slate-400 truncate">{[ort, antalText].filter(Boolean).join(', ')}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <TypRutor typer={typer} />
            <KortStatus kontroll={kontroll} utanSchema={utanSchema} halsaStatus={kund.health_status} harStationer={totalt > 0} />
          </span>
        </button>
        {totalt > 0 && <SchemaKnapp utanSchema={utanSchema} namn={namn} onSchemapanel={onSchemapanel} onSchemalagg={onSchemalagg} />}
      </div>
    </div>
  )
}

function OrgRad({ namn, enheter, typerPerKund, kontrollPerKund, medSchema, oppen, onVaxla, onSchemapanel, onSchemalagg, onSchemapanelEnhet }: {
  namn: string
  enheter: CustomerStationSummary[]
  typerPerKund: Map<string, TypRad[]>
  kontrollPerKund: Map<string, KontrollPerKund>
  medSchema: Set<string> | null
  oppen: boolean
  onVaxla: () => void
  onSchemapanel: () => void
  onSchemalagg: (kunder: CustomerStationSummary[]) => void
  onSchemapanelEnhet: (s: CustomerStationSummary) => void
}) {
  const [valda, setValda] = useState<Set<string>>(new Set())
  const ute = enheter.reduce((s, e) => s + e.outdoor_count, 0)
  const inne = enheter.reduce((s, e) => s + e.indoor_count, 0)
  const av = avvikelseOrd(samreHalsa(enheter))
  const senaste = enheter.reduce<string | null>((m, e) => (e.latest_inspection_date && (!m || e.latest_inspection_date > m) ? e.latest_inspection_date : m), null)
  const typer = useMemo(() => slaIhopTyper(enheter.map(e => typerPerKund.get(e.customer_id))), [enheter, typerPerKund])
  const utan = medSchema ? enheter.filter(e => !medSchema.has(e.customer_id)).length : 0
  const allaUtan = !!medSchema && utan === enheter.length

  // Organisationens kontroll: äldsta försenade, annars tidigaste nästa bland enheterna
  const kontroll = useMemo<KontrollPerKund>(() => {
    let forsenad: KontrollPerKund['forsenad'] = null
    let nasta: KontrollPerKund['nasta'] = null
    for (const e of enheter) {
      const k = kontrollPerKund.get(e.customer_id)
      if (k?.forsenad && (!forsenad || k.forsenad.scheduled_at < forsenad.scheduled_at)) forsenad = k.forsenad
      if (k?.nasta && (!nasta || k.nasta.scheduled_at < nasta.scheduled_at)) nasta = k.nasta
    }
    return { forsenad, nasta }
  }, [enheter, kontrollPerKund])

  const vaxlaVald = (id: string) => setValda(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const allaValda = valda.size === enheter.length
  const underrad = `${enheter.length} enheter${utan > 0 ? `, ${utan} saknar schema` : ''}`

  const rubrikKnapp = (
    <button
      type="button"
      onClick={onVaxla}
      aria-expanded={oppen}
      className="min-w-0 flex items-center gap-2.5 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
    >
      <Icon name="allman.chevron" size={16} className={`flex-shrink-0 text-slate-500 transition-transform ${oppen ? 'rotate-90' : ''}`} />
      <span className="w-9 h-9 flex-shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
        <Icon name="utrustning.enheter" size={20} />
      </span>
      <span className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-white leading-snug break-words">{namn}</span>
        <span className="text-[13px] text-slate-400">{underrad}</span>
      </span>
    </button>
  )

  return (
    <div role="rowgroup" className="divide-y divide-slate-700/60">
      <div role="row">
        <div className={`hidden @min-[720px]:grid ${KOLUMNER} items-center gap-3 min-h-[64px] py-2 pl-3.5 pr-3`}>
          <div role="cell" className="min-w-0">{rubrikKnapp}</div>
          <div role="cell" className="flex flex-col gap-1">
            <span className="text-[13px] text-white">{ute} ute, {inne} inne</span>
            <TypRutor typer={typer} />
          </div>
          <div role="cell"><span className={`font-mono text-[13px] ${senaste ? 'text-slate-300' : 'text-slate-500'}`}>{senasteKontroll(senaste)}</span></div>
          <div role="cell"><NastaKontroll kontroll={kontroll} utanSchema={allaUtan} schemaKant={!!medSchema} enheter={enheter.length} /></div>
          <div role="cell">{ute + inne > 0 ? <StatusPunkt ton={av.ton}>{av.text}</StatusPunkt> : <span className="text-[13px] text-slate-500">Inga stationer</span>}</div>
          <div role="cell" className="flex justify-end">
            <SchemaKnapp utanSchema={allaUtan} namn={namn} enheter onSchemapanel={onSchemapanel} onSchemalagg={() => onSchemalagg(enheter)} />
          </div>
        </div>
        <div className="@min-[720px]:hidden flex items-center gap-2 py-2.5 pl-3 pr-2.5 min-h-[64px]">
          <div className="flex-1 min-w-0">
            {rubrikKnapp}
            <span className="mt-1 ml-[70px] flex flex-wrap items-center gap-x-3 gap-y-1">
              <TypRutor typer={typer} />
              <span className="text-[13px] text-slate-400">{ute} ute, {inne} inne</span>
              {ute + inne > 0 && av.text !== 'Inga' && <StatusPunkt ton={av.ton}>{av.text} avvikelser</StatusPunkt>}
            </span>
          </div>
          <SchemaKnapp utanSchema={allaUtan} namn={namn} enheter onSchemapanel={onSchemapanel} onSchemalagg={() => onSchemalagg(enheter)} />
        </div>
      </div>
      {oppen && (
        <>
          {enheter.map(e => (
            <KundRad
              key={e.customer_id}
              kund={e}
              typer={typerPerKund.get(e.customer_id)}
              kontroll={kontrollPerKund.get(e.customer_id)}
              utanSchema={!!medSchema && !medSchema.has(e.customer_id)}
              schemaKant={!!medSchema}
              inskjuten
              vald={valda.has(e.customer_id)}
              onVald={() => vaxlaVald(e.customer_id)}
              onSchemapanel={() => onSchemapanelEnhet(e)}
            />
          ))}
          <div role="row" className="flex flex-wrap items-center justify-between gap-2 min-h-[52px] py-1.5 pl-5 pr-3 bg-slate-950/30">
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setValda(allaValda ? new Set() : new Set(enheter.map(e => e.customer_id)))}
                className="min-h-[44px] px-1 text-[13px] font-semibold text-[#20c58f] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                {allaValda ? 'Avmarkera alla' : 'Markera alla'}
              </button>
              <span className="text-[13px] text-slate-400">{valda.size} av {enheter.length} enheter valda</span>
            </span>
            {valda.size > 0 && (
              <button
                type="button"
                onClick={() => onSchemalagg(enheter.filter(e => valda.has(e.customer_id)))}
                className="h-11 px-3.5 flex items-center gap-1.5 rounded-xl bg-[#20c58f] text-[#04281c] text-sm font-semibold hover:bg-[#1bb07f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]"
              >
                <Icon name="arendelista.boka" size={20} />
                Schemalägg {valda.size} {valda.size === 1 ? 'enhet' : 'enheter'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default KundLista
