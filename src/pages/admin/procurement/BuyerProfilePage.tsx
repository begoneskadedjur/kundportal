// src/pages/admin/procurement/BuyerProfilePage.tsx
// Köparprofil (verktyg 2): uppgifter och kundkoppling, förfaranden,
// ramavtal eller kontrakt, kriterietyp, antal anbud, nuvarande och tidigare
// leverantörer, byter de leverantör, överprövningar, uppskattat mot utfall,
// upphandlingar i bevakningen och begärda handlingar.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, ExternalLink, Link2, Search, X } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier } from '../../../services/procurementService'
import { formatOrgNumber, todaySwedish } from '../../../shared/procurementRules'
import {
  END_SOURCE_LABEL,
  OUR_STATUS_DOT,
  OUR_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  type ProcurementBuyer,
  type ProcurementDocumentRequest,
  type ProcurementNotice,
} from '../../../types/procurement'
import { EmptyState, LinkButton, PulseRow, Section, StatusDot } from '../../../components/admin/procurement/ui'
import { fmtDate, fmtKrShort, fmtNum, fmtPct, tableCls } from '../../../components/admin/procurement/uiFormat'
import { VALUE_KIND_LABEL, buildProcurements, median, type ProcurementGroup } from '../../../components/admin/procurement/market/marketStats'
import { HistoryEmpty, SupplierName } from '../../../components/admin/procurement/market/shared'
import { countyLabel, criteriaLabel } from '../../../components/admin/procurement/market/format'
import { countBy, sortKey, supplierSwitches } from '../../../components/admin/procurement/registry/registryStats'
import { procurementPath } from '../../../lib/procurementPortal'

type Customer = { id: string; company_name: string; organization_number: string | null }

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Uppskattat värde: UHM:s rådata, annars annonsens uppskattade värde */
function estimatedOf(g: ProcurementGroup, notices: ProcurementNotice[]): number | null {
  const fromRaw = num(g.raw?.['uppskattat_varde'])
  if (fromRaw) return fromRaw
  const n = g.noticeId ? notices.find((x) => x.id === g.noticeId) : null
  return n?.estimated_value ?? null
}

function CustomerLink({ buyer, onChange }: { buyer: ProcurementBuyer; onChange: (customerId: string | null) => Promise<void> }) {
  const [current, setCurrent] = useState<Customer | null>(null)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!buyer.customer_id) {
      setCurrent(null)
      return
    }
    ProcurementService.getCustomersByIds([buyer.customer_id])
      .then((r) => setCurrent(r[0] ?? null))
      .catch(() => setCurrent(null))
  }, [buyer.customer_id])

  useEffect(() => {
    if (!searching || q.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      ProcurementService.searchCustomers(q)
        .then(setResults)
        .catch(() => toast.error('Kunde inte söka kunder'))
    }, 250)
    return () => clearTimeout(t)
  }, [q, searching])

  const pick = async (id: string | null) => {
    setBusy(true)
    try {
      await onChange(id)
      setSearching(false)
      setQ('')
    } catch {
      // Felet visas som toast
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-3">
      {buyer.customer_id && !searching ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to={`/admin/befintliga-kunder/${buyer.customer_id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-100 hover:text-[#20c58f]">
            <Link2 className="w-3.5 h-3.5 text-[#20c58f]" />
            {current?.company_name ?? 'Kopplad kund'}
            {current?.organization_number && <span className="text-[11px] text-slate-500">{formatOrgNumber(current.organization_number)}</span>}
          </Link>
          <div className="flex gap-3">
            <LinkButton tone="muted" onClick={() => setSearching(true)}>Byt kund</LinkButton>
            <LinkButton tone="danger" disabled={busy} onClick={() => void pick(null)}>Ta bort koppling</LinkButton>
          </div>
        </div>
      ) : !searching ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-500">Inte kopplad till någon kund i portalen.</span>
          <LinkButton onClick={() => setSearching(true)}>Koppla till kund</LinkButton>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Sök kund, t.ex. ${buyer.name.split(' ')[0]}`}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
              />
            </div>
            <button type="button" onClick={() => { setSearching(false); setQ('') }} className="text-slate-500 hover:text-slate-200" aria-label="Avbryt">
              <X className="w-4 h-4" />
            </button>
          </div>
          {results.length > 0 ? (
            <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" disabled={busy} onClick={() => void pick(c.id)} className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-slate-800/40">
                    <span className="text-slate-200">{c.company_name}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">{c.organization_number ? formatOrgNumber(c.organization_number) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="text-[12px] text-slate-500 px-1">Inga träffar.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function DetailsForm({ buyer, onSave }: { buyer: ProcurementBuyer; onSave: (p: Partial<ProcurementBuyer>) => Promise<void> }) {
  const [email, setEmail] = useState(buyer.registrar_email ?? '')
  const [website, setWebsite] = useState(buyer.website ?? '')
  const [sector, setSector] = useState(buyer.sector ?? '')
  const [notes, setNotes] = useState(buyer.notes ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = email !== (buyer.registrar_email ?? '') || website !== (buyer.website ?? '') || sector !== (buyer.sector ?? '') || notes !== (buyer.notes ?? '')
  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const save = async () => {
    if (!emailValid) {
      toast.error('Registratorns e-post ser inte giltig ut')
      return
    }
    setSaving(true)
    try {
      await onSave({ registrar_email: email.trim() || null, website: website.trim() || null, sector: sector.trim() || null, notes: notes.trim() || null })
    } catch {
      // Felet visas som toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Registratorns e-post"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="registrator@kommun.se"
          helperText="Används för begäran om allmänna handlingar"
          error={emailValid ? undefined : 'Ogiltig adress'}
        />
        <Input label="Webbplats" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        <Input label="Sektor" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="kommun, region, kommunalt bolag ..." />
      </div>
      <Input as="textarea" rows={3} label="Anteckningar" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => void save()} disabled={!dirty} loading={saving}>Spara uppgifter</Button>
      </div>
    </div>
  )
}

function Tally({ items }: { items: Array<{ key: string; count: number }> }) {
  if (items.length === 0) return <span className="text-slate-600">–</span>
  return (
    <span className="text-slate-300">
      {items.map((i, idx) => (
        <span key={i.key}>
          {idx > 0 && ', '}
          {i.key} <span className="text-slate-500 tabular-nums">{i.count}</span>
        </span>
      ))}
    </span>
  )
}

export default function BuyerProfilePage() {
  const { buyerId } = useParams<{ buyerId: string }>()
  const [loading, setLoading] = useState(true)
  const [buyer, setBuyer] = useState<ProcurementBuyer | null>(null)
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [notices, setNotices] = useState<ProcurementNotice[]>([])
  const [requests, setRequests] = useState<ProcurementDocumentRequest[]>([])

  const load = useCallback(async () => {
    if (!buyerId) return
    setLoading(true)
    try {
      const [b, a, n, r] = await Promise.all([
        ProcurementService.getBuyer(buyerId),
        ProcurementService.listAwards({ buyerId }),
        ProcurementService.listNoticesForBuyer(buyerId),
        ProcurementService.listDocumentRequests().catch(() => [] as ProcurementDocumentRequest[]),
      ])
      setBuyer(b)
      setAwards(a)
      setNotices(n)
      const noticeIds = new Set(n.map((x) => x.id))
      setRequests(r.filter((x) => x.buyer_id === buyerId || (x.notice_id && noticeIds.has(x.notice_id))))
      const refs = [...new Set(a.map((x) => x.source_ref).filter((x): x is string => !!x))]
      if (refs.length > 0) {
        const bd = await ProcurementService.listBidders({ sourceRefs: refs }).catch(() => [])
        const keys = new Set(a.map((x) => `${x.source}:${x.source_ref}`))
        setBidders(bd.filter((x) => keys.has(`${x.source}:${x.source_ref}`)))
      } else setBidders([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta köparen')
    } finally {
      setLoading(false)
    }
  }, [buyerId])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const groups = useMemo(() => buildProcurements(awards).sort((a, b) => sortKey(b).localeCompare(sortKey(a))), [awards])
  const biddersByRef = useMemo(() => {
    const m = new Map<string, BidderWithSupplier[]>()
    for (const b of bidders) {
      const k = `${b.source}:${b.source_ref}`
      m.set(k, [...(m.get(k) ?? []), b])
    }
    return m
  }, [bidders])

  const switches = useMemo(() => supplierSwitches(groups), [groups])
  const bidsMedian = median(groups.map((g) => g.bidsReceived))
  const appealed = groups.filter((g) => g.wasAppealed).length
  const appealKnown = groups.filter((g) => g.wasAppealed != null).length
  const current = groups.filter((g) => g.endDate && g.endDate >= today)
  const nextEnd = current.map((g) => g.endDate!).sort()[0] ?? null
  const procedures = countBy(groups, (g) => g.procedureType)
  const frameworks = countBy(groups, (g) => (g.isFramework == null ? null : g.isFramework ? 'Ramavtal' : 'Kontrakt'))
  const criteria = countBy(groups, (g) => (g.criteriaType ? criteriaLabel(g.criteriaType) : null))
  const estVsActual = groups
    .map((g) => ({ g, est: estimatedOf(g, notices), act: g.value != null && (g.valueKind === 'ceiling' || g.valueKind === 'actual') ? g.value : null }))
    .filter((x) => x.est != null && x.act != null)
  const ratioMedian = median(estVsActual.map((x) => x.act! / x.est!))

  const saveBuyer = async (patch: Partial<ProcurementBuyer>) => {
    if (!buyer) return
    try {
      await ProcurementService.updateBuyer(buyer.id, patch)
      setBuyer({ ...buyer, ...patch })
      toast.success('Köparen är sparad')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara köparen')
      throw e
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!buyer) {
    return (
      <div className="space-y-4">
        <Link to={procurementPath('/kopare')} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-3.5 h-3.5" /> Köpare
        </Link>
        <EmptyState title="Köparen finns inte" hint="Den kan ha slagits ihop med en annan köpare vid importen." />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to={procurementPath('/kopare')} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Köpare
        </Link>
        <h2 className="text-lg font-semibold text-slate-100">{buyer.name}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500 mt-0.5 tabular-nums">
          {buyer.org_number && <span>{formatOrgNumber(buyer.org_number)}</span>}
          <span>{buyer.sector ?? 'Sektor okänd'}</span>
          <span>{buyer.county_name ?? countyLabel(buyer.county_code)}</span>
          {buyer.website && (
            <a href={buyer.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#20c58f]">
              Webbplats <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {buyer.aliases.length > 0 && <div className="text-[11px] text-slate-600 mt-1">Även: {buyer.aliases.join(', ')}</div>}
      </div>

      <PulseRow
        stats={[
          { label: 'Kända upphandlingar', value: fmtNum(groups.length), hint: groups.length ? `sedan ${groups[groups.length - 1].year ?? 'okänt år'}` : null },
          { label: 'Median anbud', value: fmtNum(bidsMedian, 1), hint: bidsMedian != null && bidsMedian <= 2 ? 'duopol, ett tredje anbud har chans' : null, tone: bidsMedian != null && bidsMedian <= 2 ? 'good' : 'neutral' },
          { label: 'Byter leverantör', value: switches.comparisons ? `${switches.switches} av ${switches.comparisons}` : '–', hint: 'byten mellan upphandlingar' },
          { label: 'Överprövade', value: appealKnown ? `${appealed} av ${appealKnown}` : '–', tone: appealed > 0 ? 'warn' : 'neutral' },
          { label: 'Nästa avtalsslut', value: fmtDate(nextEnd), hint: nextEnd ? current.find((g) => g.endDate === nextEnd)?.winners.map((w) => w.name).join(', ') : null },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Uppgifter">
          <DetailsForm key={buyer.id} buyer={buyer} onSave={saveBuyer} />
        </Section>
        <div className="space-y-6">
          <Section title="Kundkoppling" hint="Koppla köparen till kunden i portalen när de redan är kund hos oss.">
            <CustomerLink buyer={buyer} onChange={(id) => saveBuyer({ customer_id: id })} />
          </Section>
          <Section title="Så brukar de upphandla">
            <dl className="divide-y divide-slate-800 text-[12.5px]">
              {[
                { k: 'Förfarande', v: <Tally items={procedures} /> },
                { k: 'Avtalsform', v: <Tally items={frameworks} /> },
                { k: 'Kriterier', v: <Tally items={criteria} /> },
                { k: 'Antal anbud', v: groups.some((g) => g.bidsReceived) ? <span className="tabular-nums">{groups.filter((g) => g.bidsReceived).map((g) => g.bidsReceived).join(', ')}</span> : <span className="text-slate-600">–</span> },
                {
                  k: 'Uppskattat mot utfall',
                  v: ratioMedian != null ? <span className="tabular-nums">median {fmtNum(ratioMedian, 2)} på {estVsActual.length} upphandlingar</span> : <span className="text-slate-600">–</span>,
                },
              ].map((r) => (
                <div key={r.k} className="flex gap-3 px-4 py-2">
                  <dt className="w-40 shrink-0 text-slate-500">{r.k}</dt>
                  <dd className="min-w-0">{r.v}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>

      <Section title="Leverantörer över tid" hint="Nuvarande avtal överst. Värdet är ramtak om inget annat anges.">
        {groups.length === 0 ? (
          <HistoryEmpty title="Inga kända tilldelningar för köparen" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>År</th>
                  <th className={tableCls.th}>Upphandling</th>
                  <th className={tableCls.th}>Leverantör</th>
                  <th className={tableCls.th}>Övriga anbud</th>
                  <th className={tableCls.thRight}>Värde</th>
                  <th className={tableCls.thRight}>Anbud</th>
                  <th className={tableCls.th}>Kriterier</th>
                  <th className={tableCls.th}>Avtalsslut</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const losers = g.refs.flatMap((r) => biddersByRef.get(r) ?? []).filter((b) => !b.is_winner)
                  const running = !!g.endDate && g.endDate >= today
                  return (
                    <tr key={g.key} className={tableCls.tr}>
                      <td className={tableCls.td}>{g.year ?? '–'}</td>
                      <td className={tableCls.td}>
                        <div className="min-w-[180px] max-w-[260px]">
                          <div className="truncate" title={g.title ?? ''}>{g.title ?? 'Utan titel'}</div>
                          <div className="text-[11px] text-slate-500">
                            {g.sources.map((s) => s.toUpperCase().replace('_XML', ' äldre')).join(' och ')}
                            {g.isFramework != null ? (g.isFramework ? ' · ramavtal' : ' · kontrakt') : ''}
                            {g.wasAppealed ? ' · överprövad' : ''}
                          </div>
                          {g.noticeId && <Link to={procurementPath(`/${g.noticeId}`)} className="text-[11px] text-[#20c58f] hover:underline">Öppna annonsen</Link>}
                        </div>
                      </td>
                      <td className={tableCls.td}>
                        <div className="space-y-0.5 min-w-[140px]">
                          {g.winners.length === 0 ? '–' : g.winners.map((w) => <div key={`${w.supplierId}${w.org}${w.name}`}><SupplierName w={w} /></div>)}
                        </div>
                      </td>
                      <td className={tableCls.td}>
                        {losers.length === 0 ? <span className="text-slate-600">–</span> : (
                          <div className="space-y-0.5 min-w-[120px]">
                            {losers.map((b) => (
                              <div key={b.id} className="text-slate-400">
                                {b.supplier?.name ?? b.name}
                                {b.price != null && <span className="text-slate-500"> · {fmtKrShort(b.price)}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={tableCls.tdRight}>
                        {fmtKrShort(g.value)}
                        {g.value != null && <div className="text-[10.5px] text-slate-500">{VALUE_KIND_LABEL[g.valueKind]}</div>}
                      </td>
                      <td className={tableCls.tdRight}>{fmtNum(g.bidsReceived)}</td>
                      <td className={tableCls.td}>{criteriaLabel(g.criteriaType)}</td>
                      <td className={`${tableCls.td} whitespace-nowrap`}>
                        <div className={running ? 'text-slate-100' : ''}>{fmtDate(g.endDate)}</div>
                        <div className="text-[11px] text-slate-500">{g.endSource ? END_SOURCE_LABEL[g.endSource] : ''}</div>
                        {running && <StatusDot tone="good">Löper</StatusDot>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {estVsActual.length > 0 && (
        <Section title="Uppskattat mot utfall" hint="Uppskattat värde i annonsen mot kontrakterat värde (ramtak).">
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>År</th>
                  <th className={tableCls.th}>Upphandling</th>
                  <th className={tableCls.thRight}>Uppskattat</th>
                  <th className={tableCls.thRight}>Utfall</th>
                  <th className={tableCls.thRight}>Kvot</th>
                </tr>
              </thead>
              <tbody>
                {estVsActual.map(({ g, est, act }) => (
                  <tr key={g.key} className={tableCls.tr}>
                    <td className={tableCls.td}>{g.year ?? '–'}</td>
                    <td className={tableCls.td}><div className="truncate max-w-[280px]">{g.title ?? 'Utan titel'}</div></td>
                    <td className={tableCls.tdRight}>{fmtKrShort(est)}</td>
                    <td className={tableCls.tdRight}>{fmtKrShort(act)}</td>
                    <td className={tableCls.tdRight}>{fmtPct(act! / est!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Upphandlingar i bevakningen">
        {notices.length === 0 ? (
          <EmptyState title="Inga annonser från köparen i bevakningen" />
        ) : (
          <ul className="divide-y divide-slate-800">
            {notices.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <Link to={procurementPath(`/${n.id}`)} className="text-[13px] text-slate-200 hover:text-[#20c58f] hover:underline">
                    {n.title}
                  </Link>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    BGU-{n.bgu_number} · publicerad {fmtDate(n.published_at)} · sista anbudsdag {fmtDate(n.tender_deadline)}
                  </div>
                </div>
                <StatusDot dotClass={OUR_STATUS_DOT[n.our_status]}>{OUR_STATUS_LABEL[n.our_status]}</StatusDot>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Begärda handlingar" hint="Begäran skickas från upphandlingens detaljsida till registratorns adress ovan.">
        {requests.length === 0 ? (
          <EmptyState title="Inga begärda handlingar" hint={buyer.registrar_email ? undefined : 'Fyll i registratorns e-post för att kunna begära handlingar.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Skickad</th>
                  <th className={tableCls.th}>Ämne</th>
                  <th className={tableCls.th}>Mottagare</th>
                  <th className={tableCls.th}>Status</th>
                  <th className={tableCls.th}>Mottagen</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className={tableCls.tr}>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDate(r.sent_at ?? r.created_at)}</td>
                    <td className={tableCls.td}>
                      {r.notice_id ? (
                        <Link to={procurementPath(`/${r.notice_id}`)} className="hover:text-[#20c58f] hover:underline">{r.subject ?? 'Begäran'}</Link>
                      ) : (r.subject ?? 'Begäran')}
                    </td>
                    <td className={tableCls.td}>{r.recipient_email}</td>
                    <td className={tableCls.td}>
                      <StatusDot tone={r.status === 'received' ? 'good' : r.status === 'rejected' ? 'bad' : r.status === 'escalated' ? 'warn' : 'neutral'}>
                        {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                      </StatusDot>
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDate(r.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
