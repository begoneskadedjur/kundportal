// src/components/admin/customers/record/ContractUnitsAppendix.tsx
// Bilaga A · Enheter. På avtal med många enheter listade § 1, § 3 och § 7
// samma enheter tre gånger (28 + 28 + 28 rader). Här står varje enhet EN
// gång: gäller fr. · uppföljning (rytm, utfall i avtalsåret, nästa) ·
// Er referens · tilläggsstationer. Paragraferna behåller sina
// sammanfattningsrader och pekar hit.
//
// Ingen ny data: projektion av omfattningsraderna, uppföljningen (samma
// resolver som § 3), enhetens billing_reference och ledgern. Sökbar och
// sorterbar vid 51 rader. Släpp av en enhet här = § 1 (samma zon).

import { useMemo, useState } from 'react'
import {
  VISIT_FREQUENCY_LABEL,
  customerRowName,
  formatDateSv,
  type RecordContractSite,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'
import type { AddonLedger } from '../../../../shared/addonLedger'
import type { PaperInk } from './paperInk'
import type { UnitFollowup } from './ContractMapSection'

type SortKey = 'name' | 'next' | 'reference' | 'addons'

interface Props {
  units: RecordCustomer[]
  scope: RecordContractSite[]
  followup: UnitFollowup[]
  ledger: AddonLedger | null
  ink: PaperInk
  archived: boolean
  onOpenSettings?: (group: 'uppfoljning' | 'referenser') => void
}

export default function ContractUnitsAppendix({ units, scope, followup, ledger, ink, archived, onOpenSettings }: Props) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('name')

  const rows = useMemo(() => {
    const scopeBy = new Map(scope.map((cs) => [cs.customer_id, cs]))
    const fuBy = new Map(followup.map((u) => [u.unitId, u]))
    const addonsBy = new Map<string, number>()
    for (const s of ledger?.stations ?? []) if (!s.removed) addonsBy.set(s.unitId, (addonsBy.get(s.unitId) ?? 0) + 1)
    return units.map((u) => {
      const cs = scopeBy.get(u.id) ?? null
      const fu = fuBy.get(u.id) ?? null
      const behind = !!fu && fu.serviceMode === 'inspection' && fu.expectedSoFar != null && fu.doneThisYear < fu.expectedSoFar
      const noSchedule = !!fu && fu.serviceMode === 'inspection' && !fu.nextVisitAt
      return {
        unit: u,
        name: customerRowName(u),
        activeFrom: cs?.active_from ?? null,
        fu,
        behind,
        noSchedule,
        reference: u.billing_reference ?? null,
        addons: addonsBy.get(u.id) ?? 0,
      }
    })
  }, [units, scope, followup, ledger])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle) || (r.reference ?? '').toLowerCase().includes(needle)) : rows
    const cmp: Record<SortKey, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, 'sv'),
      next: (a, b) => (a.fu?.nextVisitAt ?? '9999').localeCompare(b.fu?.nextVisitAt ?? '9999'),
      reference: (a, b) => (a.reference ?? '').localeCompare(b.reference ?? '', 'sv') || a.name.localeCompare(b.name, 'sv'),
      addons: (a, b) => b.addons - a.addons || a.name.localeCompare(b.name, 'sv'),
    }
    return [...list].sort(cmp[sort])
  }, [rows, q, sort])

  const sortLink = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSort(key)}
      className={`print:hidden underline decoration-dotted ${sort === key ? 'font-semibold' : ''}`}
      style={{ color: sort === key ? ink.primary : ink.muted }}
    >
      {label}
    </button>
  )

  return (
    <div className="mt-5 group/para" data-appendix="units">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          Bilaga A · Enheter
        </h4>
        <span className="ml-auto font-sans text-[10.5px] tabular-nums flex items-baseline gap-2" style={{ color: ink.muted }}>
          <span>{units.length} enheter</span>
          <span className="print:hidden">· sortera {sortLink('name', 'namn')} {sortLink('next', 'nästa besök')} {sortLink('reference', 'referens')} {sortLink('addons', 'tillägg')}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="sök"
            className="print:hidden font-sans text-[10.5px] w-24 bg-transparent border-b border-dotted outline-none px-1"
            style={{ borderColor: ink.rule, color: ink.primary }}
            aria-label="Sök enhet i bilagan"
          />
        </span>
      </div>
      {/* Kolumnhuvud i samma stil som underrubrikerna */}
      <div className="font-sans text-[8.5px] font-bold uppercase tracking-[0.14em] pt-2 pb-0.5 grid grid-cols-[1.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_5rem_4rem] gap-2" style={{ color: ink.muted }}>
        <span />
        <span>Enhet</span>
        <span>Gäller</span>
        <span>Uppföljning</span>
        <span>Referens</span>
        <span className="text-right">Tillägg</span>
      </div>
      {filtered.map((r, i) => {
        const fu = r.fu
        const rhythm =
          !fu
            ? ''
            : fu.serviceMode === 'on_demand'
              ? 'avrop'
              : `${fu.frequency ? (VISIT_FREQUENCY_LABEL[fu.frequency] ?? fu.frequency).toLowerCase() : fu.visitsPerYear ? `${fu.visitsPerYear}/år` : 'rytm saknas'}`
        const outcome =
          !fu || fu.serviceMode === 'on_demand'
            ? fu ? `${fu.casesThisYear} ärenden i år` : ''
            : `${fu.visitsPerYear != null ? `${fu.doneThisYear} av ${fu.visitsPerYear}` : ''}${r.behind ? ' · efter plan' : ''}${fu.nextVisitAt ? ` · nästa ${formatDateSv(fu.nextVisitAt)}` : ' · inget schema'}`
        return (
          <div
            key={r.unit.id}
            className="grid grid-cols-[1.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_5rem_4rem] gap-2 items-baseline py-1.5 border-b border-dotted text-[12.5px]"
            style={{ borderColor: ink.rule }}
          >
            <span className="font-sans text-[10px] tabular-nums" style={{ color: ink.muted }}>A.{i + 1}</span>
            <span className="font-semibold truncate" style={{ color: ink.primary }} title={r.name}>{r.name}</span>
            <span className="font-sans text-[11px] tabular-nums truncate" style={{ color: ink.secondary }}>
              {r.activeFrom ? `fr. ${formatDateSv(r.activeFrom)}` : 'avtalets egen rad'}
            </span>
            <span className="font-sans text-[11px] tabular-nums truncate" style={{ color: r.behind || r.noSchedule ? ink.warn : ink.secondary }} title={`${rhythm} · ${outcome}`}>
              {rhythm}{outcome ? ` · ${outcome}` : ''}
            </span>
            <span className="font-sans text-[11px] tabular-nums truncate" style={{ color: r.reference ? ink.primary : ink.warn }}>
              {r.reference ?? (onOpenSettings && !archived ? (
                <button type="button" onClick={() => onOpenSettings('referenser')} className="underline decoration-dotted">saknas</button>
              ) : 'saknas')}
            </span>
            <span className="font-sans text-[11px] tabular-nums text-right" style={{ color: r.addons > 0 ? ink.primary : ink.muted }}>
              {r.addons > 0 ? `${r.addons} st` : '–'}
            </span>
          </div>
        )
      })}
      {filtered.length === 0 && (
        <div className="font-sans text-[11px] italic py-2" style={{ color: ink.muted }}>Ingen enhet matchar sökningen.</div>
      )}
    </div>
  )
}
