// src/components/admin/customers/record/AddonCoveragePanel.tsx
// Täckningspanelen i inställningspanelens grupp Innehåll och utrustning
// (steg 12 i docs/planer/avtalsar-exakt-arsdag-teknik.md): en rad per
// tilläggsstation på avtalets enheter med "Betald t.o.m. {datum} · {källa}
// {referens}", och för den som får godkänna fakturor knapparna
// "Registrera Fortnox-faktura" och "Efterskänk" per enhet.
//
// Betald t.o.m. kommer ur addon_station_paid_through: täckningen
// (addon_station_coverage) när stationen har täckningsrader, annars dagens
// räkning (pro rata och låsta tilläggsfakturor). Registrering och
// efterskänkning går via AddonCoverageService (SECURITY DEFINER-RPC som
// kräver befogenheten). Platt text med statuspunkt, inga piller.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../../ui/Modal'
import DateField from '../../../ui/DateField'
import { Icon } from '../../../icons/Icon'
import { supabase } from '../../../../lib/supabase'
import { AddonCoverageService, type AddonStationKind } from '../../../../services/addonCoverageService'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import { addonPaidThroughLabel, type AddonPaidThrough } from '../../../../types/addonStations'

interface StationRow {
  id: string
  kind: AddonStationKind
  unitId: string
  label: string
  decided: boolean
  mode: string | null
  model: string | null
  paid: AddonPaidThrough | null
}

interface Props {
  contractId: string
  /** Enheterna avtalet omfattar (och avtalets egen kundrad) */
  unitIds: string[]
  unitNameOf: (unitId: string) => string
  canApprove: boolean
  archived: boolean
  reloadKey: number
  onChanged?: () => void | Promise<void>
}

const SOURCE_LABEL: Record<string, string> = {
  invoice: 'faktura',
  prorata: 'pro rata',
  gap_invoice: 'faktura från utsättning',
  fortnox_manual: 'Fortnox',
  waived: 'efterskänkt',
  backfill: 'tidigare faktura',
}

const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50'
const LINK_BTN = 'text-[11.5px] text-[#20c58f] underline decoration-dotted disabled:opacity-50'

/** Statusraden för en station: text och ton för punkten. */
function coverageStatus(s: Pick<StationRow, 'decided' | 'mode' | 'model' | 'paid'>): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  const p = s.paid
  if (!s.decided) return { text: 'väntar på beslut', tone: 'warn' }
  if (s.mode === 'included') return { text: 'ingår i premien', tone: 'muted' }
  if (!p) return { text: 'kunde inte läsas', tone: 'muted' }
  if (!p.applies) return { text: s.model === 'per_inspection' ? 'faktureras per kontroll' : 'faktureras inte som tillägg', tone: 'muted' }
  if (p.cancelled_unresolved) return { text: 'fakturan makulerad, välj i arbetslistan', tone: 'warn' }
  if (p.paid_through) {
    const source = p.source ? SOURCE_LABEL[p.source] ?? p.source : null
    const ref = p.reference ? ` ${p.reference}` : ''
    return {
      text: `${addonPaidThroughLabel(p).replace('till och med', 't.o.m.')} ${p.paid_through}${source ? ` · ${source}${ref}` : ref}`,
      tone: p.source === 'waived' ? 'muted' : 'ok',
    }
  }
  if (p.not_billed_yet) return { text: `pro rata väntar${p.reference ? ` på ${p.reference}` : ''}`, tone: 'muted' }
  return { text: 'ingen betalning registrerad', tone: 'warn' }
}

function Dot({ tone }: { tone: 'ok' | 'warn' | 'muted' }) {
  const cls = tone === 'ok' ? 'bg-[#20c58f]' : tone === 'warn' ? 'bg-amber-400' : 'bg-slate-500'
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`} aria-hidden />
}

type Action = { type: 'manual' | 'waive'; unitId: string } | null

export default function AddonCoveragePanel({ contractId, unitIds, unitNameOf, canApprove, archived, reloadKey, onChanged }: Props) {
  const [rows, setRows] = useState<StationRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<Action>(null)
  const [localKey, setLocalKey] = useState(0)
  const unitKey = [...unitIds].sort().join(',')

  const load = useCallback(async () => {
    if (unitIds.length === 0) {
      setRows([])
      return
    }
    setError(null)
    try {
      const [outdoor, indoor] = await Promise.all([
        supabase
          .from('equipment_placements')
          .select('id, customer_id, serial_number, equipment_type, addon_contract_id, addon_contract_mode, addon_billing_model, station_type:station_types(name)')
          .in('customer_id', unitIds)
          .eq('is_addon', true)
          .eq('status', 'active'),
        supabase
          .from('indoor_stations')
          .select('id, station_number, addon_contract_id, addon_contract_mode, addon_billing_model, station_type:station_types(name), floor_plan:floor_plans!inner(customer_id, name)')
          .in('floor_plan.customer_id', unitIds)
          .eq('is_addon', true)
          .eq('status', 'active'),
      ])
      if (outdoor.error) throw outdoor.error
      if (indoor.error) throw indoor.error
      type Out = { id: string; customer_id: string; serial_number: string | null; equipment_type: string | null; addon_contract_id: string | null; addon_contract_mode: string | null; addon_billing_model: string | null; station_type: { name: string } | null }
      type In = { id: string; station_number: string | null; addon_contract_id: string | null; addon_contract_mode: string | null; addon_billing_model: string | null; station_type: { name: string } | null; floor_plan: { customer_id: string; name: string | null } | null }
      // Avtalets stationer och de obeslutade (de väntar på ett beslut här)
      const mine = (c: string | null) => c === contractId || c === null
      const base: StationRow[] = [
        ...((outdoor.data ?? []) as unknown as Out[])
          .filter((s) => mine(s.addon_contract_id))
          .map((s) => ({
            id: s.id,
            kind: 'outdoor' as const,
            unitId: s.customer_id,
            label: `${s.station_type?.name ?? s.equipment_type ?? 'Station'}${s.serial_number ? ` ${s.serial_number}` : ''}`,
            decided: !!s.addon_contract_id,
            mode: s.addon_contract_mode,
            model: s.addon_billing_model,
            paid: null,
          })),
        ...((indoor.data ?? []) as unknown as In[])
          .filter((s) => mine(s.addon_contract_id))
          .map((s) => ({
            id: s.id,
            kind: 'indoor' as const,
            unitId: s.floor_plan?.customer_id ?? '',
            label: `${s.station_type?.name ?? 'Station'}${s.station_number ? ` ${s.station_number}` : ''}${s.floor_plan?.name ? ` · ${s.floor_plan.name}` : ''}`,
            decided: !!s.addon_contract_id,
            mode: s.addon_contract_mode,
            model: s.addon_billing_model,
            paid: null,
          })),
      ]
      const paid = await Promise.all(
        base.map((s) => (s.decided && s.mode !== 'included' ? AddonStationBillingService.getPaidThrough(s.id, s.kind === 'indoor') : Promise.resolve(null)))
      )
      setRows(base.map((s, i) => ({ ...s, paid: paid[i] })).sort((a, b) => a.label.localeCompare(b.label, 'sv', { numeric: true })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte läsa stationerna')
      setRows([])
    }
    // unitKey bär enheterna
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, unitKey])

  useEffect(() => {
    void load()
  }, [load, reloadKey, localKey])

  const byUnit = useMemo(() => {
    const map = new Map<string, StationRow[]>()
    for (const r of rows ?? []) {
      const list = map.get(r.unitId) ?? []
      list.push(r)
      map.set(r.unitId, list)
    }
    return map
  }, [rows])

  if (rows === null) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" /> Läser tilläggsstationerna
      </div>
    )
  }
  if (rows.length === 0 && !error) return null

  return (
    <div className="mt-4 pt-3 border-t border-slate-700">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2.5">Tilläggsstationer, betald till och med</div>
      {error && <div className="text-[12px] text-amber-300 mb-2">{error}</div>}
      <div className="space-y-3">
        {Array.from(byUnit.entries()).map(([unitId, list]) => {
          const billable = list.filter((s) => s.decided && s.mode !== 'included' && s.paid?.applies)
          return (
            <div key={unitId}>
              <div className="flex items-baseline gap-3 mb-1">
                <div className="text-[12.5px] font-semibold text-white flex-1 min-w-0 truncate">{unitNameOf(unitId)}</div>
                {canApprove && !archived && billable.length > 0 && (
                  <>
                    <button type="button" className={LINK_BTN} onClick={() => setAction({ type: 'manual', unitId })}>
                      Registrera Fortnox-faktura
                    </button>
                    <button type="button" className={LINK_BTN} onClick={() => setAction({ type: 'waive', unitId })}>
                      Efterskänk
                    </button>
                  </>
                )}
              </div>
              <ul className="divide-y divide-slate-700/60 border-y border-slate-700/60">
                {list.map((s) => {
                  const st = coverageStatus(s)
                  return (
                    <li key={`${s.kind}-${s.id}`} className="flex items-center gap-2 py-1.5 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-slate-200" title={s.label}>
                        {s.label}
                      </span>
                      <Dot tone={st.tone} />
                      <span className={`shrink-0 tabular-nums ${st.tone === 'warn' ? 'text-amber-300' : st.tone === 'ok' ? 'text-slate-200' : 'text-slate-400'}`}>
                        {st.text}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {action && (
        <CoverageModal
          type={action.type}
          unitName={unitNameOf(action.unitId)}
          stations={(byUnit.get(action.unitId) ?? []).filter((s) => s.decided && s.mode !== 'included' && s.paid?.applies)}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null)
            setLocalKey((k) => k + 1)
            await onChanged?.()
          }}
        />
      )}
    </div>
  )
}

function CoverageModal({
  type,
  unitName,
  stations,
  onClose,
  onDone,
}: {
  type: 'manual' | 'waive'
  unitName: string
  stations: StationRow[]
  onClose: () => void
  onDone: () => void | Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [doc, setDoc] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const manual = type === 'manual'
  const valid =
    selected.size > 0 && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to && (manual ? doc.trim().length > 0 : note.trim().length > 0)

  const save = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const chosen = stations.filter((s) => selected.has(`${s.kind}-${s.id}`))

      for (const kind of ['outdoor', 'indoor'] as const) {
        const ids = chosen.filter((s) => s.kind === kind).map((s) => s.id)
        if (ids.length === 0) continue
        if (manual) {
          await AddonCoverageService.registerManual({ stationIds: ids, kind, from, to, fortnoxDocument: doc.trim(), note: note.trim() || null })
        } else {
          await AddonCoverageService.waive({ stationIds: ids, kind, from, to, note: note.trim() })
        }
      }
      toast.success(manual ? `Fortnox-faktura ${doc.trim()} registrerad på ${chosen.length} stationer.` : `${chosen.length} stationer efterskänkta ${from} t.o.m. ${to}.`)
      await onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none'

  return (
    <Modal isOpen onClose={onClose} usePortal size="sm" title={manual ? 'Registrera Fortnox-faktura' : 'Efterskänk'} subtitle={unitName}>
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          {manual
            ? 'Stationerna räknas som betalda för perioden. Använd när tillägget fakturerats direkt i Fortnox.'
            : 'Stationerna får ingen faktura för perioden. Dagarna räknas som betalda utan debitering.'}
        </p>
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="kund.beslut" size={16} />
            <span className="text-sm font-semibold text-white flex-1">Stationer</span>
            <button
              type="button"
              className="text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-200"
              onClick={() => setSelected(selected.size === stations.length ? new Set() : new Set(stations.map((s) => `${s.kind}-${s.id}`)))}
            >
              {selected.size === stations.length ? 'Avmarkera alla' : `Välj alla ${stations.length}`}
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {stations.map((s) => {
              const key = `${s.kind}-${s.id}`
              return (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={(e) => {
                      const next = new Set(selected)
                      if (e.target.checked) next.add(key)
                      else next.delete(key)
                      setSelected(next)
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  <span className="flex-1 min-w-0 truncate">{s.label}</span>
                  <span className="text-slate-500 tabular-nums">{s.paid?.paid_through ? `t.o.m. ${s.paid.paid_through}` : ''}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-400">
            Från och med
            <DateField className={`${inputCls} mt-1 pl-7`} value={from} onChange={setFrom} />
          </label>
          <label className="block text-xs font-medium text-slate-400">
            Till och med
            <DateField className={`${inputCls} mt-1 pl-7`} value={to} onChange={setTo} />
          </label>
        </div>
        {manual && (
          <label className="block text-xs font-medium text-slate-400">
            Fortnox-fakturans nummer
            <input value={doc} onChange={(e) => setDoc(e.target.value)} className={`${inputCls} mt-1`} inputMode="numeric" placeholder="t.ex. 744" />
          </label>
        )}
        <label className="block text-xs font-medium text-slate-400">
          {manual ? 'Anteckning (valfri)' : 'Varför efterskänks debiteringen?'}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} mt-1`} />
        </label>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
          <button type="button" onClick={onClose} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200">
            Avbryt
          </button>
          <button type="button" onClick={() => void save()} disabled={!valid || busy} className={PRIMARY_BTN}>
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            {manual ? 'Registrera' : 'Efterskänk'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
