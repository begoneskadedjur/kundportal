// src/components/technician/ny/utrustning/KundLista.tsx
// Kundlistan på Utrustning i nya arbetsvyn. Ersätter AllCustomersList,
// ExpandableCustomerRow och MultisiteOrgRow i nya vyn (de gamla är orörda):
//  - sök på namn, enhet, adress och org.nr (substring, som AllCustomersList)
//  - sortering A-Ö, Antal, Avvikelser och Senast kontrollerad
//  - multisite-organisationer som grupp med enheterna under sig
//  - per kund: antal ute och inne, typernas färger, avvikelser, senaste kontroll,
//    vem som placerat, schemapanelen och Schemalägg (en kund, alla eller valda enheter)
// Grupperingen och sökningen följer AllCustomersList.tsx:84-186.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CustomerStationSummary } from '../../../../services/equipmentService'
import type { HealthStatus } from '../../../shared/StationHealthBadge'
import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import { IKONKNAPP, KORT, halsa, senast } from './utrustningUi'

export type Sortering = 'name' | 'count' | 'health' | 'recent'

const SORTERINGAR: { varde: Sortering; text: string }[] = [
  { varde: 'name', text: 'A till Ö' },
  { varde: 'count', text: 'Flest stationer' },
  { varde: 'health', text: 'Avvikelser först' },
  { varde: 'recent', text: 'Senast kontrollerad' },
]

const HALSA_ORDNING: Record<HealthStatus, number> = { poor: 0, fair: 1, good: 2, excellent: 3 }

export interface TypRad { namn: string; farg: string; antal: number }

type Post =
  | { typ: 'kund'; kund: CustomerStationSummary; nyckel: string; antal: number; halsa: number; senast: number }
  | { typ: 'org'; orgId: string; namn: string; enheter: CustomerStationSummary[]; nyckel: string; antal: number; halsa: number; senast: number }

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

interface Props {
  kunder: CustomerStationSummary[]
  /** Utomhusstationernas typer per kund (färgpunkter) */
  typerPerKund: Map<string, TypRad[]>
  sok: string
  onSok: (v: string) => void
  sortering: Sortering
  onSortering: (v: Sortering) => void
  onSchemapanel: (customerId: string, kund: string, enheter?: { customerId: string; siteName: string }[]) => void
  onSchemalagg: (kunder: CustomerStationSummary[]) => void
}

export function KundLista({ kunder, typerPerKund, sok, onSok, sortering, onSortering, onSchemapanel, onSchemalagg }: Props) {
  const [oppenOrg, setOppenOrg] = useState<string | null>(null)

  const poster = useMemo(() => {
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
      const samre = enheter.reduce<HealthStatus>((v, s) => HALSA_ORDNING[s.health_status] < HALSA_ORDNING[v] ? s.health_status : v, 'excellent')
      lista.push({
        typ: 'org', orgId, namn,
        enheter: [...enheter].sort((a, b) => enhetsNamn(a).localeCompare(enhetsNamn(b), 'sv')),
        nyckel: namn,
        antal: enheter.reduce((s, e) => s + e.outdoor_count + e.indoor_count, 0),
        halsa: HALSA_ORDNING[samre],
        senast: enheter.reduce((m, e) => Math.max(m, tid(e.latest_inspection_date)), 0),
      })
    }
    for (const c of enskilda) {
      lista.push({
        typ: 'kund', kund: c, nyckel: c.customer_name,
        antal: c.outdoor_count + c.indoor_count,
        halsa: HALSA_ORDNING[c.health_status],
        senast: tid(c.latest_inspection_date),
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
        case 'recent':
          if (!a.senast && !b.senast) return a.nyckel.localeCompare(b.nyckel, 'sv')
          if (!a.senast) return 1
          if (!b.senast) return -1
          return b.senast - a.senast
        default: return a.nyckel.localeCompare(b.nyckel, 'sv')
      }
    })
    return filtrerad
  }, [kunder, sok, sortering])

  const visaOppen = (orgId: string) => oppenOrg === orgId

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Sök kund</span>
          <Icon name="allman.sok" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={sok}
            onChange={e => onSok(e.target.value)}
            placeholder="Sök kund, enhet, adress eller org.nr"
            className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          />
          {sok && (
            <button type="button" onClick={() => onSok('')} aria-label="Rensa sökningen" className={`absolute right-0.5 top-1/2 -translate-y-1/2 ${IKONKNAPP}`}>
              <Icon name="allman.stang" size={16} />
            </button>
          )}
        </label>
        <label className="relative sm:w-56">
          <span className="sr-only">Sortera</span>
          <Icon name="utrustning.sortera" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={sortering}
            onChange={e => onSortering(e.target.value as Sortering)}
            className="w-full h-12 pl-11 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          >
            {SORTERINGAR.map(s => <option key={s.varde} value={s.varde}>{s.text}</option>)}
          </select>
        </label>
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
        <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`} data-genomgang="utr-kunder">
          {poster.map(p => p.typ === 'kund' ? (
            <li key={p.kund.customer_id}>
              <KundRad
                kund={p.kund}
                typer={typerPerKund.get(p.kund.customer_id)}
                onSchemapanel={() => onSchemapanel(p.kund.customer_id, p.kund.customer_name)}
                onSchemalagg={() => onSchemalagg([p.kund])}
              />
            </li>
          ) : (
            <li key={`org-${p.orgId}`}>
              <OrgRad
                namn={p.namn}
                enheter={p.enheter}
                typerPerKund={typerPerKund}
                oppen={visaOppen(p.orgId)}
                onVaxla={() => setOppenOrg(o => o === p.orgId ? null : p.orgId)}
                onSchemapanel={() => onSchemapanel(
                  p.enheter[0].customer_id,
                  p.namn,
                  p.enheter.map(s => ({ customerId: s.customer_id, siteName: enhetsNamn(s) })),
                )}
                onSchemalagg={onSchemalagg}
                onSchemapanelEnhet={(s) => onSchemapanel(s.customer_id, s.customer_name)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TypPunkter({ typer }: { typer?: TypRad[] }) {
  if (!typer || typer.length === 0) return null
  const visa = typer.slice(0, 4)
  return (
    <span className="inline-flex items-center gap-1" title={typer.map(t => `${t.antal} ${t.namn}`).join(', ')}>
      {visa.map(t => (
        <span key={t.namn} aria-hidden="true" className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.farg }} />
      ))}
      <span className="sr-only">{typer.map(t => `${t.antal} ${t.namn}`).join(', ')}</span>
      {typer.length > 4 && <span className="text-[12px] text-slate-500">+{typer.length - 4}</span>}
    </span>
  )
}

function Antal({ ute, inne }: { ute: number; inne: number }) {
  return (
    <span className="inline-flex items-center gap-3 text-[13px] text-slate-300 tabular-nums">
      <span className="inline-flex items-center gap-1" aria-label={`${ute} utomhus`}>
        <Icon name="station.ute" size={16} className="text-slate-500" />{ute}
      </span>
      <span className="inline-flex items-center gap-1" aria-label={`${inne} inomhus`}>
        <Icon name="station.inne" size={16} className="text-slate-500" />{inne}
      </span>
    </span>
  )
}

function KundRad({ kund, typer, onSchemapanel, onSchemalagg, inskjuten = false, vald, onVald }: {
  kund: CustomerStationSummary
  typer?: TypRad[]
  onSchemapanel: () => void
  onSchemalagg?: () => void
  inskjuten?: boolean
  vald?: boolean
  onVald?: () => void
}) {
  const navigate = useNavigate()
  const totalt = kund.outdoor_count + kund.indoor_count
  const h = halsa(kund.health_status)
  const namn = inskjuten ? enhetsNamn(kund) : kund.customer_name
  return (
    <div className={`flex items-stretch ${inskjuten ? 'pl-2 bg-slate-950/30' : ''}`}>
      {onVald && (
        <label className="w-11 flex-shrink-0 flex items-center justify-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!vald}
            onChange={onVald}
            aria-label={`Välj ${namn} för schemaläggning`}
            className="w-5 h-5 rounded border-slate-600 bg-slate-800 accent-[#20c58f]"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => navigate(`/technician/equipment/customer/${kund.customer_id}`)}
        className="flex-1 min-w-0 text-left px-3 py-3 min-h-[64px] hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
      >
        <span className="block text-[15px] font-medium text-white leading-snug line-clamp-2 break-words">{namn}</span>
        {kund.customer_address && <span className="block text-[13px] text-slate-400 truncate">{kund.customer_address}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {totalt > 0 ? <Antal ute={kund.outdoor_count} inne={kund.indoor_count} /> : <span className="text-[13px] text-slate-500">Inga stationer</span>}
          <TypPunkter typer={typer} />
          {totalt > 0 && <StatusPunkt ton={h.ton}>{h.text}</StatusPunkt>}
          {kund.latest_inspection_date && (
            <span className="text-[13px] text-slate-400">Kontroll {senast(kund.latest_inspection_date)}</span>
          )}
        </span>
        {kund.technician_names.length > 0 && (
          <span className="block mt-0.5 text-[12px] text-slate-500 truncate">Placerade av {kund.technician_names.join(', ')}</span>
        )}
      </button>
      {totalt > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-center pr-1 gap-0.5">
          <button type="button" onClick={onSchemapanel} className={IKONKNAPP} aria-label={`Schema och kontroller för ${namn}`} title="Schema och kontroller">
            <Icon name="utrustning.kontroller" size={20} />
          </button>
          {onSchemalagg && (
            <button type="button" onClick={onSchemalagg} className={IKONKNAPP} aria-label={`Schemalägg kontroller för ${namn}`} title="Schemalägg kontroller">
              <Icon name="kund.schema" size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function OrgRad({ namn, enheter, typerPerKund, oppen, onVaxla, onSchemapanel, onSchemalagg, onSchemapanelEnhet }: {
  namn: string
  enheter: CustomerStationSummary[]
  typerPerKund: Map<string, TypRad[]>
  oppen: boolean
  onVaxla: () => void
  onSchemapanel: () => void
  onSchemalagg: (kunder: CustomerStationSummary[]) => void
  onSchemapanelEnhet: (s: CustomerStationSummary) => void
}) {
  const [valda, setValda] = useState<Set<string>>(new Set())
  const ute = enheter.reduce((s, e) => s + e.outdoor_count, 0)
  const inne = enheter.reduce((s, e) => s + e.indoor_count, 0)
  const samre = enheter.reduce<HealthStatus>((v, s) => HALSA_ORDNING[s.health_status] < HALSA_ORDNING[v] ? s.health_status : v, 'excellent')
  const h = halsa(samre)
  const senaste = enheter.reduce<string | null>((m, e) => (e.latest_inspection_date && (!m || e.latest_inspection_date > m) ? e.latest_inspection_date : m), null)
  const vaxlaVald = (id: string) => setValda(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const allaValda = valda.size === enheter.length

  return (
    <div>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onVaxla}
          aria-expanded={oppen}
          className="flex-1 min-w-0 flex items-start gap-3 text-left px-3 py-3 min-h-[64px] hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
        >
          <span className="w-9 h-9 mt-0.5 flex-shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
            <Icon name="utrustning.enheter" size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-white leading-snug line-clamp-2 break-words">{namn}</span>
            <span className="block text-[13px] text-slate-400">{enheter.length} enheter</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Antal ute={ute} inne={inne} />
              {ute + inne > 0 && <StatusPunkt ton={h.ton}>{h.text}</StatusPunkt>}
              {senaste && <span className="text-[13px] text-slate-400">Kontroll {senast(senaste)}</span>}
            </span>
          </span>
          <Icon name="allman.chevron" size={16} className={`mt-3 flex-shrink-0 text-slate-500 transition-transform ${oppen ? 'rotate-90' : ''}`} />
        </button>
        <div className="flex flex-col sm:flex-row items-center justify-center pr-1 gap-0.5">
          <button type="button" onClick={onSchemapanel} className={IKONKNAPP} aria-label={`Schema och kontroller för ${namn}`} title="Schema och kontroller">
            <Icon name="utrustning.kontroller" size={20} />
          </button>
          <button type="button" onClick={() => onSchemalagg(enheter)} className={IKONKNAPP} aria-label={`Schemalägg alla enheter i ${namn}`} title="Schemalägg alla enheter">
            <Icon name="kund.schema" size={20} />
          </button>
        </div>
      </div>
      {oppen && (
        <div className="border-t border-slate-700/60">
          <div className="flex items-center justify-between gap-2 pl-3 pr-2 min-h-[48px] bg-slate-950/30">
            <button
              type="button"
              onClick={() => setValda(allaValda ? new Set() : new Set(enheter.map(e => e.customer_id)))}
              className="min-h-[44px] px-1 text-sm font-medium text-slate-300 hover:text-white"
            >
              {allaValda ? 'Avmarkera alla' : 'Markera alla'}
            </button>
            {valda.size > 0 && (
              <button
                type="button"
                onClick={() => onSchemalagg(enheter.filter(e => valda.has(e.customer_id)))}
                className="h-11 px-3 flex items-center gap-1.5 rounded-xl bg-[#20c58f] text-[#04281c] text-sm font-semibold hover:bg-[#1bb07f]"
              >
                <Icon name="kund.schema" size={16} />
                Schemalägg {valda.size} {valda.size === 1 ? 'enhet' : 'enheter'}
              </button>
            )}
          </div>
          <ul className="divide-y divide-slate-700/60">
            {enheter.map(e => (
              <li key={e.customer_id}>
                <KundRad
                  kund={e}
                  typer={typerPerKund.get(e.customer_id)}
                  inskjuten
                  vald={valda.has(e.customer_id)}
                  onVald={() => vaxlaVald(e.customer_id)}
                  onSchemapanel={() => onSchemapanelEnhet(e)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default KundLista
