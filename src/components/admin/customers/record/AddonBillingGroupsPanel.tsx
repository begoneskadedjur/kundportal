// src/components/admin/customers/record/AddonBillingGroupsPanel.tsx
// Faktureringsgrupper för tilläggsstationer (2026-11-03) i inställningspanelens
// grupp Innehåll och utrustning, bara för avtal med nya tilläggsregler (v2).
// Kontoret skapar grupper (namn, intervall, startdag, märkning) och väljer
// grupp per § 6-rad. Rader utan grupp följer tilläggens vanliga regler.
// Platt text med statuspunkt, inga piller; ikonknappar med aria-label.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DateField from '../../../ui/DateField'
import { Icon } from '../../../icons/Icon'
import { AddonBillingGroupService, type AddonLineWithGroup } from '../../../../services/addonBillingGroupService'
import {
  BILLING_GROUP_CADENCES,
  BILLING_GROUP_CADENCE_LABEL,
  describeBillingGroup,
  groupNextPeriodStart,
  type BillingGroupCadence,
} from '../../../../shared/addonBillingGroups'
import type { AddonBillingGroupCadence, ContractAddonBillingGroup } from '../../../../types/database'

interface Props {
  contract: {
    id: string
    contract_start_date: string | null
    billing_anchor_mode?: string | null
    billing_anchor_month: number | null
  }
  archived: boolean
  unitNameOf: (unitId: string) => string
  reloadKey?: number
  /** Efter ändring: planen och kartan läses om */
  onChanged?: () => void | Promise<void>
}

type Draft = { id: string | null; name: string; cadence: AddonBillingGroupCadence; anchor: string; marking: string }

const EMPTY: Draft = { id: null, name: '', cadence: 'monthly', anchor: '', marking: '' }
const inputCls = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-[12.5px] focus:ring-2 focus:ring-[#20c58f] focus:outline-none'
const LINK_BTN = 'text-[11.5px] text-[#20c58f] underline decoration-dotted disabled:opacity-50'
const ICON_BTN = 'inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40'

function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default function AddonBillingGroupsPanel({ contract, archived, unitNameOf, reloadKey, onChanged }: Props) {
  const [groups, setGroups] = useState<ContractAddonBillingGroup[]>([])
  const [lines, setLines] = useState<AddonLineWithGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [g, l] = await Promise.all([AddonBillingGroupService.list(contract.id), AddonBillingGroupService.addonLines(contract.id)])
      setGroups(g)
      setLines(l)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Faktureringsgrupperna kunde inte läsas')
    } finally {
      setLoading(false)
    }
  }, [contract.id])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const today = todayIso()
  const countByGroup = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lines) if (l.addon_billing_group_id) m.set(l.addon_billing_group_id, (m.get(l.addon_billing_group_id) ?? 0) + 1)
    return m
  }, [lines])

  const save = async () => {
    if (!draft || !draft.name.trim()) return
    setBusy(true)
    try {
      const input = { name: draft.name, cadence: draft.cadence, anchor_date: draft.anchor || null, marking: draft.marking || null }
      if (draft.id) await AddonBillingGroupService.update(draft.id, input)
      else await AddonBillingGroupService.create(contract.id, input)
      toast.success(draft.id ? 'Gruppen sparad' : 'Gruppen skapad. Välj den på tilläggsraderna nedan.')
      setDraft(null)
      await load()
      await onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gruppen kunde inte sparas')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await AddonBillingGroupService.remove(id)
      toast.success('Gruppen borttagen. Raderna följer tilläggens vanliga regler.')
      setConfirmDelete(null)
      await load()
      await onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gruppen kunde inte tas bort')
    } finally {
      setBusy(false)
    }
  }

  const setLineGroup = async (line: AddonLineWithGroup, groupId: string | null) => {
    setBusy(true)
    try {
      await AddonBillingGroupService.setLineGroup(line.id, groupId)
      toast.success(groupId ? `${line.name} faktureras i gruppen ${groups.find((g) => g.id === groupId)?.name ?? ''}` : `${line.name} följer tilläggens vanliga regler`)
      await load()
      await onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gruppen kunde inte bytas')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-4 pt-3 border-t border-slate-700 flex items-center gap-1.5 text-[12px] text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" /> Läser faktureringsgrupperna
      </div>
    )
  }

  return (
    <div className="mt-4 pt-3 border-t border-slate-700">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 flex-1">Faktureringsgrupper</div>
        {!archived && !draft && (
          <button type="button" className={ICON_BTN} aria-label="Ny faktureringsgrupp" title="Ny faktureringsgrupp" onClick={() => setDraft({ ...EMPTY })}>
            <Icon name="allman.plus" size={16} />
          </button>
        )}
      </div>
      <p className="text-[12px] text-slate-400 mb-2">
        En grupp ger tilläggen ett eget intervall, till exempel varje månad fast premien är årlig. Rader utan grupp följer de vanliga reglerna ovan.
      </p>
      {error && <div className="text-[12px] text-amber-300 mb-2">{error}</div>}

      {groups.length > 0 && (
        <ul className="divide-y divide-slate-700/60 border-y border-slate-700/60 mb-2">
          {groups.map((g) => {
            const next = groupNextPeriodStart(g, contract, today)
            const n = countByGroup.get(g.id) ?? 0
            return (
              <li key={g.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${n > 0 ? 'bg-[#20c58f]' : 'border border-slate-600'}`} aria-hidden />
                <button
                  type="button"
                  disabled={archived}
                  onClick={() => setDraft({ id: g.id, name: g.name, cadence: g.cadence, anchor: g.anchor_date ?? '', marking: g.marking ?? '' })}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                  title={archived ? undefined : 'Ändra gruppen'}
                >
                  <span className="block text-slate-100 font-medium truncate">{g.name}</span>
                  <span className="block text-slate-500 truncate">
                    {describeBillingGroup(g)}
                    {next ? ` · nästa period ${next}` : ''} · {n === 1 ? '1 rad' : `${n} rader`}
                  </span>
                </button>
                {!archived &&
                  (confirmDelete === g.id ? (
                    <span className="shrink-0 inline-flex items-center gap-2">
                      <button type="button" className="text-[11.5px] text-red-400 underline decoration-dotted" disabled={busy} onClick={() => void remove(g.id)}>
                        Ta bort
                      </button>
                      <button type="button" className="text-[11.5px] text-slate-400" onClick={() => setConfirmDelete(null)}>
                        Avbryt
                      </button>
                    </span>
                  ) : (
                    <button type="button" className={ICON_BTN} aria-label={`Ta bort gruppen ${g.name}`} title="Ta bort gruppen" onClick={() => setConfirmDelete(g.id)}>
                      <Icon name="allman.radera" size={16} />
                    </button>
                  ))}
              </li>
            )
          })}
        </ul>
      )}
      {confirmDelete && (
        <p className="text-[11.5px] text-slate-400 mb-2">
          Raderna och stationerna i gruppen går tillbaka till de vanliga reglerna. Skickade fakturor ligger kvar.
        </p>
      )}

      {draft && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3 mb-2">
          <div className="text-sm font-semibold text-white">{draft.id ? 'Ändra gruppen' : 'Ny faktureringsgrupp'}</div>
          <label className="block text-xs font-medium text-slate-400">
            Namn
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${inputCls} mt-1`} placeholder="t.ex. Månadsvis" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-400">
              Intervall
              <select
                value={draft.cadence}
                onChange={(e) => setDraft({ ...draft, cadence: e.target.value as AddonBillingGroupCadence })}
                className={`${inputCls} mt-1`}
              >
                {BILLING_GROUP_CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {BILLING_GROUP_CADENCE_LABEL[c as BillingGroupCadence]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-400">
              <span className="flex items-baseline gap-2">
                <span className="flex-1">Startdag</span>
                {draft.anchor && (
                  <button type="button" className="text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-200" onClick={() => setDraft({ ...draft, anchor: '' })}>
                    avtalsdagen
                  </button>
                )}
              </span>
              <DateField
                value={draft.anchor}
                onChange={(v) => setDraft({ ...draft, anchor: v })}
                aria-label="Startdag"
                className={`${inputCls} mt-1 pl-7`}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-400">
            Märkning på fakturan
            <input
              value={draft.marking}
              onChange={(e) => setDraft({ ...draft, marking: e.target.value })}
              className={`${inputCls} mt-1`}
              placeholder="Tomt = enhetens eller avtalets referens"
            />
          </label>
          <p className="text-[11.5px] text-slate-500">
            {draft.cadence === 'follows_premium'
              ? 'Följer premien: samma takt som tilläggen i dag, men på egna fakturor för gruppen.'
              : 'Tom startdag = avtalsdagen. Perioderna räknas från startdagen, och gruppen fakturerar från första periodstart efter att den skapats.'}
          </p>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
            <button type="button" onClick={() => setDraft(null)} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200">
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !draft.name.trim()}
              className="inline-flex items-center gap-1.5 bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
          </div>
        </div>
      )}

      {lines.length > 0 && (groups.length > 0 || lines.some((l) => l.addon_billing_group_id)) && (
        <>
          <div className="text-[11px] text-slate-500 mt-2 mb-1">Tilläggsrader i § 6</div>
          <ul className="divide-y divide-slate-700/60 border-y border-slate-700/60">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-slate-200" title={l.name}>
                  {l.name}
                  {l.site_customer_id && <span className="text-slate-500"> · {unitNameOf(l.site_customer_id)}</span>}
                  <span className="text-slate-500"> · {l.quantity} st {l.billing_model === 'per_month' ? 'per månad' : 'per år'}</span>
                </span>
                <select
                  value={l.addon_billing_group_id ?? ''}
                  disabled={archived || busy}
                  onChange={(e) => void setLineGroup(l, e.target.value || null)}
                  aria-label={`Faktureringsgrupp för ${l.name}`}
                  className="shrink-0 max-w-[45%] px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-200 text-[12px] focus:ring-2 focus:ring-[#20c58f] focus:outline-none disabled:opacity-50"
                >
                  <option value="">Vanliga regler</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
      {groups.length === 0 && !draft && !archived && (
        <button type="button" className={LINK_BTN} onClick={() => setDraft({ ...EMPTY })}>
          Skapa en faktureringsgrupp
        </button>
      )}
    </div>
  )
}
