// src/components/admin/customers/FortnoxNumberField.tsx
// Fortnox-kundnummer för en kundrad eller enhet. Numret gissas aldrig i
// fritext: det ärvs från huvudkontoret, delas med en annan rad i samma bolag,
// hämtas ur Fortnox-spegeln på org.nr eller skapas i Fortnox via
// api/fortnox/allocate-customer. Manuell inmatning finns som reserv men
// kontrolleras mot spegeln.
//
// Ordning (samma som src/utils/fortnoxCustomerResolver.ts):
//  1. Enhet utan eget org.nr, eller med huvudkontorets → ärver HK:s nummer.
//  2. Annan rad i samma organisation med samma org.nr bär ett nummer → delar det.
//  3. Spegeln på org.nr: en aktiv träff → numret, flera → användaren väljer
//     (aldrig auto-val), ingen → "Skapa i Fortnox".
//
// Komponenten skriver inget själv. Den rapporterar ett FortnoxNumberResolution
// till föräldern, som sparar raden och vid behov kör runFortnoxAllocation
// efteråt (allocate-customer kräver att kundraden finns).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { FortnoxMirrorService } from '../../../services/fortnoxMirrorService'
import { CustomerGroupService } from '../../../services/customerGroupService'
import type { CustomerGroup } from '../../../types/customerGroups'
import {
  decideCandidate,
  orgDigits,
  parseFortnoxCustomerNumber,
  type FortnoxMirrorHit,
} from '../../../shared/fortnoxCustomerNumbers'

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

export interface FortnoxAllocateRequest {
  chosenCustomerNumber?: string
  reactivate?: boolean
  forceNew?: boolean
}

export interface FortnoxNumberResolution {
  /** Värdet som ska skrivas i customers.customer_number (null = inget eget) */
  customerNumber: number | null
  /** Numret matchar en aktiv Fortnox-kund med samma org.nr */
  verified: boolean
  /** Kör allocate-customer när raden sparats (skapa, återaktivera eller valt nummer) */
  allocate: FortnoxAllocateRequest | null
  /** Uppslaget pågår: föräldern bör vänta med att spara */
  pending: boolean
}

export const EMPTY_FORTNOX_RESOLUTION: FortnoxNumberResolution = {
  customerNumber: null,
  verified: false,
  allocate: null,
  pending: false,
}

interface Props {
  /** Radens org.nr som det står i formuläret just nu */
  orgNr: string
  /** Org.nr som är sparat på raden (null för ny rad). Avgör om Skapa i Fortnox kan köras direkt. */
  savedOrgNr?: string | null
  /** Huvudkontoret när raden är en enhet */
  parent?: { orgNr: string | null; customerNumber: number | null; name: string } | null
  /** customers.organization_id för syskonuppslaget (null = fristående kund) */
  organizationId: string | null
  /** Radens id, null innan raden finns */
  customerId: string | null
  /** Kundgrupp som styr intervallet när kunden skapas i Fortnox */
  customerGroupId: string | null
  /** customer_number som raden har i dag (null för ny rad) */
  initialNumber: number | null
  onChange: (resolution: FortnoxNumberResolution) => void
  /** Anropas när numret skrivits i databasen direkt (befintlig rad, Skapa i Fortnox) */
  onAllocated?: (customerNumber: number) => void
}

interface Sibling {
  id: string
  name: string
  customer_number: number
  digits: string | null
}

type Lookup =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'inherit' }
  | { kind: 'shared'; holderName: string; customerNumber: number; outsideOrg: boolean }
  | { kind: 'single'; hit: FortnoxMirrorHit; numeric: number | null }
  | { kind: 'multiple'; candidates: FortnoxMirrorHit[] }
  | { kind: 'inactive-only'; candidates: FortnoxMirrorHit[] }
  | { kind: 'none' }
  | { kind: 'error'; message: string }

type ManualCheck =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'match'; name: string | null }
  | { kind: 'other'; name: string | null; org: string | null }
  | { kind: 'missing' }
  | { kind: 'portal-taken'; holderName: string }

// Kundgrupperna ändras sällan: en hämtning per sidladdning räcker.
let groupsPromise: Promise<CustomerGroup[]> | null = null
function loadGroups(): Promise<CustomerGroup[]> {
  if (!groupsPromise) {
    groupsPromise = CustomerGroupService.getAllGroups().catch((err) => {
      groupsPromise = null
      throw err
    })
  }
  return groupsPromise
}

// ---------------------------------------------------------------------------
// Statuspunkt (samma uttryck som FortnoxDot i kundlistan)
// ---------------------------------------------------------------------------

export function FortnoxStatusDot({ state }: { state: 'verified' | 'unverified' | 'missing' | 'inherit' }) {
  if (state === 'verified') return <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] shrink-0" aria-hidden />
  if (state === 'missing') return <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />
  if (state === 'inherit') return <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" aria-hidden />
  return <span className="w-1.5 h-1.5 rounded-full border border-amber-400 bg-transparent shrink-0" aria-hidden />
}

// ---------------------------------------------------------------------------
// Allokering efter att raden sparats
// ---------------------------------------------------------------------------

/**
 * Kör allocate-customer för en sparad kundrad och visar resultatet som toast.
 * Returnerar tilldelat nummer, eller null om inget nummer kunde sättas.
 * Kastar aldrig: kundraden är redan sparad och ska inte rullas tillbaka.
 */
export async function runFortnoxAllocation(params: {
  customerId: string
  groupId: string | null
  request?: FortnoxAllocateRequest | null
}): Promise<number | null> {
  try {
    const result = await FortnoxMirrorService.allocateCustomer({
      customerId: params.customerId,
      groupId: params.groupId,
      ...(params.request ?? {}),
    })
    if (result.status === 'candidates') {
      toast(
        result.kind === 'multiple'
          ? 'Flera Fortnox-kunder har samma org.nr. Välj kundnummer under Redigera.'
          : 'Kunden finns i Fortnox men är inaktiv. Välj återaktivering under Redigera.',
        { icon: '⚠️', duration: 8000 }
      )
      return null
    }
    for (const w of result.warnings ?? []) toast(w, { icon: '⚠️', duration: 8000 })
    if (result.status === 'conflict-adopted') {
      toast(`Kundnummer ${result.customerNumber} bärs redan av en annan kundrad i portalen. Raden faktureras mot samma Fortnox-kund via org.nr.`, { icon: '⚠️', duration: 8000 })
      return null
    }
    if (result.status === 'created') {
      toast.success(`Ny Fortnox-kund ${result.customerNumber}${result.groupName ? ` (${result.groupName})` : ''}`)
    } else if (result.status === 'reused') {
      toast.success(`Befintlig Fortnox-kund ${result.customerNumber} kopplad${result.outsideGroup ? ' (utanför vald kundgrupp)' : ''}`)
    }
    return parseFortnoxCustomerNumber(result.customerNumber)
  } catch (err) {
    toast.error(`Kundraden är sparad men fick inget Fortnox-nummer: ${err instanceof Error ? err.message : 'okänt fel'}`, { duration: 9000 })
    return null
  }
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

export default function FortnoxNumberField({
  orgNr,
  savedOrgNr = null,
  parent = null,
  organizationId,
  customerId,
  customerGroupId,
  initialNumber,
  onChange,
  onAllocated,
}: Props) {
  const [lookup, setLookup] = useState<Lookup>({ kind: 'loading' })
  const [siblings, setSiblings] = useState<Sibling[] | null>(organizationId ? null : [])
  const [chosen, setChosen] = useState<{ hit: FortnoxMirrorHit; reactivate: boolean } | null>(null)
  const [forceNew, setForceNew] = useState(false)
  const [createRequested, setCreateRequested] = useState(false)
  const [creatingNow, setCreatingNow] = useState(false)
  const [allocatedNumber, setAllocatedNumber] = useState<number | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualValue, setManualValue] = useState(initialNumber != null ? String(initialNumber) : '')
  const [manualCheck, setManualCheck] = useState<ManualCheck>({ kind: 'idle' })
  const [groups, setGroups] = useState<CustomerGroup[]>([])

  const digits = orgDigits(orgNr)
  const parentDigits = orgDigits(parent?.orgNr)
  const inherits = !!parent && (!digits || digits === parentDigits)
  const group = groups.find((g) => g.id === customerGroupId) ?? null
  const orgUnchanged = !!customerId && orgDigits(savedOrgNr) === digits

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    loadGroups().then(setGroups).catch(() => setGroups([]))
  }, [])

  // Syskon i organisationen som bär ett nummer (för "Delar nummer med …")
  useEffect(() => {
    if (!organizationId) {
      setSiblings([])
      return
    }
    let cancelled = false
    setSiblings(null)
    supabase
      .from('customers')
      .select('id, company_name, site_name, organization_number, customer_number')
      .eq('organization_id', organizationId)
      .not('customer_number', 'is', null)
      .then(({ data }) => {
        if (cancelled) return
        setSiblings(
          ((data ?? []) as { id: string; company_name: string; site_name: string | null; organization_number: string | null; customer_number: number }[])
            .map((r) => ({
              id: r.id,
              name: r.site_name || r.company_name,
              customer_number: r.customer_number,
              digits: orgDigits(r.organization_number),
            }))
        )
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  // Uppslag när org.nr ändras (fördröjt medan man skriver)
  useEffect(() => {
    setChosen(null)
    setForceNew(false)
    setCreateRequested(false)
    if (inherits) {
      setLookup({ kind: 'inherit' })
      return
    }
    if (!digits) {
      setLookup({ kind: 'empty' })
      return
    }
    if (siblings === null) {
      setLookup({ kind: 'loading' })
      return
    }
    // Radens eget nummer går före delning; saknas det, dela med bärarraden.
    if (initialNumber == null) {
      const holder = siblings.find((s) => s.id !== customerId && s.digits === digits)
      if (holder) {
        setLookup({ kind: 'shared', holderName: holder.name, customerNumber: holder.customer_number, outsideOrg: false })
        return
      }
    }

    let cancelled = false
    setLookup({ kind: 'loading' })
    const timer = setTimeout(async () => {
      try {
        const hits = await FortnoxMirrorService.findByOrgNr(digits)
        if (cancelled) return
        const range = group ? { start: group.series_start, end: group.series_end } : null
        const decision = decideCandidate(hits, range)
        if (decision.kind === 'single') {
          const numeric = parseFortnoxCustomerNumber(decision.hit.customer_number)
          // Bär en annan portalrad redan numret (unikt index)? Då delas det via org.nr.
          if (numeric != null && numeric !== initialNumber) {
            let q = supabase.from('customers').select('id, company_name, site_name').eq('customer_number', numeric)
            if (customerId) q = q.neq('id', customerId)
            const { data: holder } = await q.maybeSingle()
            if (cancelled) return
            if (holder) {
              const h = holder as { company_name: string; site_name: string | null }
              setLookup({ kind: 'shared', holderName: h.site_name || h.company_name, customerNumber: numeric, outsideOrg: true })
              return
            }
          }
          setLookup({ kind: 'single', hit: decision.hit, numeric })
        } else if (decision.kind === 'multiple') {
          setLookup({ kind: 'multiple', candidates: decision.candidates })
        } else if (decision.kind === 'inactive-only') {
          setLookup({ kind: 'inactive-only', candidates: decision.candidates })
        } else {
          setLookup({ kind: 'none' })
        }
      } catch (err) {
        if (!cancelled) setLookup({ kind: 'error', message: err instanceof Error ? err.message : 'Uppslaget misslyckades' })
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // group.series_* räcker som beroende: gruppen påverkar bara sorteringen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, inherits, siblings, customerId, initialNumber, group?.series_start, group?.series_end])

  // Manuellt nummer: kontrollera mot spegeln och portalen
  const manualNumeric = parseFortnoxCustomerNumber(manualValue)
  useEffect(() => {
    if (!manualMode || manualNumeric == null) {
      setManualCheck({ kind: 'idle' })
      return
    }
    let cancelled = false
    setManualCheck({ kind: 'checking' })
    const timer = setTimeout(async () => {
      try {
        let q = supabase.from('customers').select('id, company_name, site_name').eq('customer_number', manualNumeric)
        if (customerId) q = q.neq('id', customerId)
        const [{ data: holder }, hit] = await Promise.all([q.maybeSingle(), FortnoxMirrorService.findByCustomerNumber(manualNumeric)])
        if (cancelled) return
        if (holder) {
          const h = holder as { company_name: string; site_name: string | null }
          setManualCheck({ kind: 'portal-taken', holderName: h.site_name || h.company_name })
        } else if (!hit || hit.missing_since) {
          setManualCheck({ kind: 'missing' })
        } else if (digits && hit.org_digits === digits && hit.active) {
          setManualCheck({ kind: 'match', name: hit.name })
        } else {
          setManualCheck({ kind: 'other', name: hit.name, org: hit.organisation_number })
        }
      } catch {
        if (!cancelled) setManualCheck({ kind: 'idle' })
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [manualMode, manualNumeric, customerId, digits])

  // Resultatet till föräldern
  const resolution = useMemo<FortnoxNumberResolution>(() => {
    if (allocatedNumber != null) {
      return { customerNumber: allocatedNumber, verified: true, allocate: null, pending: false }
    }
    if (manualMode) {
      return {
        customerNumber: manualNumeric,
        verified: manualCheck.kind === 'match',
        allocate: null,
        pending: manualCheck.kind === 'checking',
      }
    }
    switch (lookup.kind) {
      case 'loading':
        return { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: initialNumber, pending: true }
      case 'inherit':
        // En enhet som redan bär bolagets nummer behåller det (inget raderas här)
        return { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: initialNumber }
      case 'shared':
        return { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: null }
      case 'single':
        if (lookup.numeric == null) return { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: initialNumber }
        return { customerNumber: lookup.numeric, verified: true, allocate: null, pending: false }
      case 'multiple':
      case 'inactive-only': {
        if (forceNew) return { customerNumber: null, verified: false, allocate: { forceNew: true }, pending: false }
        if (!chosen) return { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: initialNumber }
        const numeric = parseFortnoxCustomerNumber(chosen.hit.customer_number)
        if (chosen.reactivate || numeric == null) {
          return { customerNumber: null, verified: false, allocate: { chosenCustomerNumber: chosen.hit.customer_number, reactivate: chosen.reactivate }, pending: false }
        }
        return { customerNumber: numeric, verified: true, allocate: null, pending: false }
      }
      case 'none':
        return createRequested
          ? { customerNumber: null, verified: false, allocate: {}, pending: false }
          : { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: initialNumber }
      default:
        return { ...EMPTY_FORTNOX_RESOLUTION, customerNumber: initialNumber }
    }
  }, [allocatedNumber, manualMode, manualNumeric, manualCheck.kind, lookup, forceNew, chosen, createRequested, initialNumber])

  useEffect(() => {
    onChangeRef.current(resolution)
  }, [resolution])

  // Skapa i Fortnox: direkt om raden finns och org.nr är sparat, annars när raden sparas
  const handleCreate = async () => {
    if (!customerGroupId) return
    if (!orgUnchanged || !customerId) {
      setCreateRequested(true)
      return
    }
    setCreatingNow(true)
    const nr = await runFortnoxAllocation({ customerId, groupId: customerGroupId })
    setCreatingNow(false)
    if (nr != null) {
      setAllocatedNumber(nr)
      onAllocated?.(nr)
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  const line = (dot: 'verified' | 'unverified' | 'missing' | 'inherit', content: React.ReactNode) => (
    <div className="flex items-center gap-2 min-h-[34px] text-sm">
      <FortnoxStatusDot state={dot} />
      <div className="min-w-0">{content}</div>
    </div>
  )

  const linkBtn = 'text-xs text-slate-400 underline decoration-dotted underline-offset-2 hover:text-white'

  function renderCandidates(kind: 'multiple' | 'inactive-only', candidates: FortnoxMirrorHit[]) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-amber-400">
          {kind === 'multiple'
            ? 'Flera Fortnox-kunder har detta org.nr. Välj vilken raden ska faktureras mot.'
            : 'Kunden finns i Fortnox men är inaktiv. Återaktivera den eller skapa en ny.'}
        </p>
        <ul className="divide-y divide-slate-800 border-y border-slate-800">
          {candidates.map((c) => {
            const selected = chosen?.hit.customer_number === c.customer_number && !forceNew
            return (
              <li key={c.customer_number}>
                <button
                  type="button"
                  onClick={() => { setForceNew(false); setChosen({ hit: c, reactivate: !c.active }) }}
                  className={`w-full text-left px-2 py-1.5 flex items-center gap-2 text-sm transition-colors border-l-2 ${
                    selected ? 'border-[#20c58f] bg-slate-800/40' : 'border-transparent hover:bg-slate-800/30'
                  }`}
                >
                  <FortnoxStatusDot state={c.active ? 'verified' : 'unverified'} />
                  <span className="font-mono text-white w-14 shrink-0">{c.customer_number}</span>
                  <span className="text-slate-300 truncate flex-1">{c.name ?? 'Namn saknas'}</span>
                  <span className={`text-xs shrink-0 ${c.active ? 'text-slate-500' : 'text-amber-400'}`}>
                    {c.active ? 'aktiv' : 'inaktiv, återaktiveras'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-3">
          {kind === 'inactive-only' && (
            <button
              type="button"
              onClick={() => { setChosen(null); setForceNew(true) }}
              disabled={!customerGroupId}
              className={`${linkBtn} ${forceNew ? 'text-[#20c58f]' : ''} disabled:opacity-40`}
            >
              {forceNew ? 'Ny Fortnox-kund skapas när du sparar' : 'Skapa ny Fortnox-kund med nytt nummer'}
            </button>
          )}
          <button type="button" onClick={() => setManualMode(true)} className={linkBtn}>Ange manuellt</button>
        </div>
        {chosen?.reactivate && <p className="text-xs text-slate-500">Kunden återaktiveras i Fortnox när du sparar.</p>}
      </div>
    )
  }

  const body = (() => {
    if (allocatedNumber != null) {
      return line('verified', (
        <span>
          <span className="font-mono text-white">#{allocatedNumber}</span>
          <span className="text-[#20c58f] ml-2">Skapad i Fortnox</span>
        </span>
      ))
    }

    if (manualMode) {
      const check = manualCheck
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FortnoxStatusDot state={manualNumeric == null ? 'missing' : check.kind === 'match' ? 'verified' : 'unverified'} />
            <input
              type="text"
              inputMode="numeric"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value.replace(/\D/g, ''))}
              placeholder="Kundnummer"
              className="w-32 px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
            />
            <button type="button" onClick={() => { setManualMode(false); setManualValue(initialNumber != null ? String(initialNumber) : '') }} className={linkBtn}>
              Tillbaka till uppslag
            </button>
          </div>
          {check.kind === 'checking' && <p className="text-xs text-slate-500">Kontrollerar mot Fortnox-spegeln…</p>}
          {check.kind === 'match' && <p className="text-xs text-[#20c58f]">Verifierad mot Fortnox{check.name ? `: ${check.name}` : ''}</p>}
          {check.kind === 'missing' && <p className="text-xs text-amber-400">Numret finns inte i Fortnox-spegeln. Kontrollera att kunden finns i Fortnox.</p>}
          {check.kind === 'other' && (
            <p className="text-xs text-amber-400">
              Numret tillhör {check.name ?? 'en annan kund'}{check.org ? ` (${check.org})` : ''} i Fortnox, inte detta org.nr.
            </p>
          )}
          {check.kind === 'portal-taken' && (
            <p className="text-xs text-red-400">Numret sitter redan på {check.holderName} i portalen och kan bara finnas på en rad.</p>
          )}
        </div>
      )
    }

    switch (lookup.kind) {
      case 'loading':
        return (
          <div className="flex items-center gap-2 min-h-[34px] text-sm text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Slår upp i Fortnox…
          </div>
        )
      case 'empty':
        return line('missing', (
          <span className="text-slate-400">
            Fyll i org.nr så slås kunden upp i Fortnox.
            <button type="button" onClick={() => setManualMode(true)} className={`${linkBtn} ml-2`}>Ange manuellt</button>
          </span>
        ))
      case 'inherit':
        if (initialNumber != null) {
          return line('inherit', (
            <span className="text-slate-400">
              Bär bolagets nummer <span className="font-mono text-slate-200">#{initialNumber}</span> (samma bolag som huvudkontoret)
            </span>
          ))
        }
        return line('inherit', (
          <span className="text-slate-400">
            {parent?.customerNumber != null
              ? <>Ärver huvudkontorets nummer <span className="font-mono text-slate-200">#{parent.customerNumber}</span></>
              : 'Ärver huvudkontorets nummer (huvudkontoret saknar nummer)'}
          </span>
        ))
      case 'shared':
        return line('inherit', (
          <span className="text-slate-400">
            Delar nummer med {lookup.holderName} <span className="font-mono text-slate-200">#{lookup.customerNumber}</span>
            {lookup.outsideOrg && <span className="block text-xs text-slate-500">Samma bolag i Fortnox, numret bor på den raden.</span>}
            {initialNumber != null && (
              <span className="block text-xs text-amber-400">Radens nuvarande #{initialNumber} tas bort när du sparar.</span>
            )}
          </span>
        ))
      case 'single':
        if (lookup.numeric == null) {
          return line('unverified', (
            <span className="text-amber-400">
              Fortnox-kunden {lookup.hit.name ?? ''} har kundnummer "{lookup.hit.customer_number}" som inte är numeriskt.
              <button type="button" onClick={() => setManualMode(true)} className={`${linkBtn} ml-2`}>Ange manuellt</button>
            </span>
          ))
        }
        return line('verified', (
          <span>
            <span className="font-mono text-white">#{lookup.numeric}</span>
            <span className="text-[#20c58f] ml-2">Verifierad mot Fortnox</span>
            {lookup.hit.name && <span className="text-slate-500 ml-2">{lookup.hit.name}</span>}
            {initialNumber != null && initialNumber !== lookup.numeric && (
              <span className="block text-xs text-amber-400">Ersätter nuvarande #{initialNumber} när du sparar.</span>
            )}
          </span>
        ))
      case 'multiple':
      case 'inactive-only':
        return renderCandidates(lookup.kind, lookup.candidates)
      case 'none':
        // Raden har redan ett nummer: allocate-customer skulle bara svara "existing".
        // Visa numret som overifierat och låt användaren rätta det manuellt.
        if (initialNumber != null) {
          return line('unverified', (
            <span>
              <span className="font-mono text-white">#{initialNumber}</span>
              <span className="text-amber-400 ml-2">Ej verifierat, org.nr finns inte i Fortnox</span>
              <button type="button" onClick={() => setManualMode(true)} className={`${linkBtn} ml-2`}>Ändra manuellt</button>
            </span>
          ))
        }
        if (createRequested) {
          return line('unverified', (
            <span className="text-slate-300">
              Skapas i Fortnox när du sparar{group ? `, nästa lediga i ${group.name} (${group.series_start}-${group.series_end})` : ''}.
              <button type="button" onClick={() => setCreateRequested(false)} className={`${linkBtn} ml-2`}>Ångra</button>
            </span>
          ))
        }
        return (
          <div className="space-y-1.5">
            {line('missing', <span className="text-slate-400">Finns inte i Fortnox</span>)}
            <div className="flex items-center gap-3 pl-3.5">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!customerGroupId || creatingNow}
                className="px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ba876] text-[#fff] text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {creatingNow && <Loader2 className="w-3 h-3 animate-spin" />}
                Skapa i Fortnox
              </button>
              <button type="button" onClick={() => setManualMode(true)} className={linkBtn}>Ange manuellt</button>
            </div>
            {!customerGroupId ? (
              <p className="text-xs text-amber-400 pl-3.5">Välj kundgrupp först, den styr vilket nummerintervall kunden får.</p>
            ) : group ? (
              <p className="text-xs text-slate-500 pl-3.5">Nästa lediga nummer i {group.name} ({group.series_start}-{group.series_end}).</p>
            ) : null}
          </div>
        )
      case 'error':
        return line('unverified', (
          <span className="text-amber-400">
            {lookup.message}
            <button type="button" onClick={() => setManualMode(true)} className={`${linkBtn} ml-2`}>Ange manuellt</button>
          </span>
        ))
    }
  })()

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">Kundnummer (Fortnox)</label>
      {body}
    </div>
  )
}
