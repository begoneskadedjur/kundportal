// src/components/admin/customers/record/ContractWorkList.tsx
// Arbetslistan överst i avtalskartan (steg 10 i docs/planer/avtalsar-exakt-arsdag-teknik.md).
// Ersätter uppgiftsremsan "tillägg att besluta": varje rad säger ATT något
// måste göras, PÅ VILKEN enhet och VAD man gör, med knapparna för just det.
//
// Brickorna att besluta byggs av kartan (samma brickor som pappret visar, så
// alla som ser kartan ser dem). Övriga uppgifter hämtas ur contract_work_items
// och bara för faktureringsansvariga (profiles.can_approve_invoices).
// Platt text med statuspunkt, inga piller (minnet ui-inga-piller).

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../../../ui/Modal'
import { Icon, type IconName } from '../../../icons/Icon'
import { supabase } from '../../../../lib/supabase'
import { AddonCoverageService } from '../../../../services/addonCoverageService'
import { fetchContractWorkItems, refreshContractWorkItems } from '../../../../hooks/useContractWorkItems'
import {
  WORK_ITEM_TITLE,
  addonDecideInstruction,
  sortWorkItems,
  workItemsCountLabel,
  type ContractWorkItem,
  type WorkItemKind,
  type WorkItemTarget,
} from '../../../../shared/contractWorkItems'

const InvoiceDetailModal = lazy(() => import('../../invoicing/InvoiceDetailModal'))

/** En rad "tillägg att besluta" som kartan bygger ur brickorna */
export interface DecideRow {
  contractId: string
  contractLabel: string
  unitId: string
  unitName: string
  count: number
  v2: boolean
}

interface Props {
  rootId: string
  /** Brickor att besluta per avtal och enhet */
  decideRows: DecideRow[]
  /** Kundens tillägg i kr/år (samma källa som kundlistan), eller null */
  addonAnnualKr: number | null
  /** Faktureringsansvarig: ser övriga uppgifter och får välja */
  canApprove: boolean
  /** Uppgiften som länken pekade på (?todo=, ?contract=, ?unit=) */
  target: WorkItemTarget | null
  /** Bumpas av kartan efter ett beslut så listan läses om */
  reloadKey: number
  contractLabelOf: (contractId: string | null) => string | null
  oneflowUrlOf: (contractId: string | null) => string | null
  formatKr: (n: number) => string
  /** Tillägg utöver avtalet (equipment) eller Ingår i premien (premium) */
  onDecide: (row: DecideRow, zone: 'premium' | 'equipment', x: number, y: number) => void
  onOpenPlan: () => void
  onOpenAnchor: (contractId: string) => void
}

const KIND_ICON: Record<WorkItemKind, IconName> = {
  coverage_cancelled: 'sok.faktura',
  coverage_conflict: 'rapport.avvikelse',
  addon_decide: 'kund.beslut',
  addon_no_case: 'arende.arende',
  gap_invoice: 'kund.period',
  anchor_verify: 'kund.avtal',
}

const PRIMARY_BTN =
  'shrink-0 text-[12px] px-3 py-1 rounded-md bg-[#20c58f] text-[#fff] font-semibold hover:brightness-110 disabled:opacity-50'
const SECONDARY_BTN =
  'shrink-0 text-[12px] px-3 py-1 rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f] disabled:opacity-50'

type ActionState =
  | { type: 'waive'; item: ContractWorkItem }
  | { type: 'rebill'; item: ContractWorkItem }
  | { type: 'case'; item: ContractWorkItem }
  | null

interface Row {
  key: string
  kind: WorkItemKind
  unitName: string
  instruction: string
  meta: string | null
  contractId: string | null
  unitId: string | null
  decide?: DecideRow
  item?: ContractWorkItem
}

export default function ContractWorkList(p: Props) {
  const [items, setItems] = useState<ContractWorkItem[]>([])
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<ActionState>(null)
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)
  const highlightRef = useRef<HTMLLIElement | null>(null)
  const scrolledRef = useRef(false)

  const load = useCallback(async () => {
    if (!p.canApprove) {
      setItems([])
      return
    }
    try {
      // Brickorna att besluta kommer från kartan, resten från arbetslistan
      setItems((await fetchContractWorkItems(p.rootId)).filter((i) => i.kind !== 'addon_decide'))
    } catch {
      setItems([])
    }
  }, [p.canApprove, p.rootId])

  useEffect(() => {
    void load()
  }, [load, p.reloadKey])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const it of sortWorkItems(items)) {
      if (it.kind === 'addon_decide') continue
      const label = p.contractLabelOf(it.contract_id)
      const period = it.period_from ? `${it.period_from}${it.period_to ? ` t.o.m. ${it.period_to}` : ''}` : null
      out.push({
        key: `${it.kind}|${it.unit_id}|${it.contract_id}|${it.invoice_id}|${it.period_from}|${(it.station_ids ?? []).join(',')}`,
        kind: it.kind,
        unitName: it.unit_name ?? it.root_name,
        instruction: it.instruction,
        meta: [label, it.kind === 'coverage_cancelled' || it.kind === 'coverage_conflict' ? period : null,
          it.station_count > 0 && it.kind !== 'gap_invoice' && it.kind !== 'addon_no_case' ? `${it.station_count} st` : null]
          .filter(Boolean).join(' · ') || null,
        contractId: it.contract_id,
        unitId: it.unit_id,
        item: it,
      })
    }
    // Brickorna efter makulerade fakturor och konflikter, samma ordning som SQL
    const firstAfterDecide = out.findIndex((r) => !['coverage_cancelled', 'coverage_conflict'].includes(r.kind))
    const decide: Row[] = p.decideRows.map((d) => ({
      key: `addon_decide|${d.unitId}|${d.contractId}`,
      kind: 'addon_decide',
      unitName: d.unitName,
      instruction: addonDecideInstruction(d.count, d.unitName, d.v2),
      meta: d.contractLabel,
      contractId: d.contractId,
      unitId: d.unitId,
      decide: d,
    }))
    if (firstAfterDecide < 0) return [...out, ...decide]
    return [...out.slice(0, firstAfterDecide), ...decide, ...out.slice(firstAfterDecide)]
  }, [items, p])

  const isTarget = (r: Row) =>
    !!p.target &&
    (!p.target.kind || p.target.kind === r.kind) &&
    (!p.target.contractId || p.target.contractId === r.contractId) &&
    (!p.target.unitId || p.target.unitId === r.unitId)
  const targetKey = rows.find(isTarget)?.key ?? null

  useEffect(() => {
    if (!targetKey || scrolledRef.current) return
    scrolledRef.current = true
    window.setTimeout(() => highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }, [targetKey])

  const after = async (msg: string) => {
    toast.success(msg)
    setAction(null)
    refreshContractWorkItems()
    await load()
  }

  const resolveConflict = async (it: ContractWorkItem) => {
    if (!it.conflict_ids?.length) return
    setBusy(true)
    try {
      await AddonCoverageService.resolveConflicts(it.conflict_ids)
      await after('Konflikten är markerad som hanterad.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte markera konflikten')
    } finally {
      setBusy(false)
    }
  }

  if (rows.length === 0) return null

  const decideCount = p.decideRows.reduce((s, d) => s + d.count, 0)

  return (
    <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
      <div className="px-3 pt-2 pb-1.5 flex flex-wrap items-baseline gap-x-3">
        <span className="text-[12.5px] font-semibold text-amber-200">{workItemsCountLabel(rows.length)}</span>
        {decideCount > 0 && p.addonAnnualKr != null && p.addonAnnualKr > 0 && (
          <span className="text-[11px] text-amber-200/80 tabular-nums">
            {decideCount} tillägg att besluta · {p.formatKr(p.addonAnnualKr)}/år
          </span>
        )}
      </div>
      <ul className="divide-y divide-amber-500/15">
        {rows.map((r) => {
          const hot = r.key === targetKey
          const it = r.item
          return (
            <li
              key={r.key}
              ref={hot ? highlightRef : undefined}
              className={`px-3 py-2 flex flex-wrap items-start gap-x-3 gap-y-2 ${hot ? 'shadow-[inset_3px_0_0_#20c58f] bg-[#20c58f]/[.06]' : ''}`}
            >
              <Icon name={KIND_ICON[r.kind]} size={20} className="shrink-0 mt-0.5 text-amber-300" />
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden />
                  <span>{WORK_ITEM_TITLE[r.kind]}</span>
                  <span className="text-slate-400 font-normal truncate">· {r.unitName}</span>
                </div>
                <p className="text-[12px] text-slate-200 mt-0.5">{r.instruction}</p>
                {r.meta && <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{r.meta}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.kind === 'addon_decide' && r.decide && (
                  <>
                    <button type="button" className={PRIMARY_BTN} onClick={(e) => p.onDecide(r.decide!, 'equipment', e.clientX, e.clientY)}>
                      Tillägg utöver avtalet
                    </button>
                    <button type="button" className={SECONDARY_BTN} onClick={(e) => p.onDecide(r.decide!, 'premium', e.clientX, e.clientY)}>
                      Ingår i premien
                    </button>
                  </>
                )}
                {r.kind === 'addon_no_case' && it && (
                  <button type="button" className={PRIMARY_BTN} disabled={busy} onClick={() => setAction({ type: 'case', item: it })}>
                    Välj ärende
                  </button>
                )}
                {r.kind === 'coverage_cancelled' && it && (
                  <>
                    <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={() => setAction({ type: 'rebill', item: it })}>
                      Fakturera igen
                    </button>
                    {p.canApprove && (
                      <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={() => setAction({ type: 'waive', item: it })}>
                        Efterskänk
                      </button>
                    )}
                  </>
                )}
                {r.kind === 'coverage_conflict' && it && (
                  <>
                    {it.invoice_id && (
                      <button type="button" className={PRIMARY_BTN} onClick={() => setOpenInvoiceId(it.invoice_id)}>
                        Öppna fakturan
                      </button>
                    )}
                    <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={() => void resolveConflict(it)}>
                      Hanterad
                    </button>
                  </>
                )}
                {r.kind === 'gap_invoice' && (
                  <button type="button" className={PRIMARY_BTN} onClick={p.onOpenPlan}>
                    Planera fakturor
                  </button>
                )}
                {r.kind === 'anchor_verify' && r.contractId && (
                  <>
                    {p.oneflowUrlOf(r.contractId) && (
                      <a href={p.oneflowUrlOf(r.contractId)!} target="_blank" rel="noreferrer" className={SECONDARY_BTN}>
                        Öppna avtalet i Oneflow
                      </a>
                    )}
                    <button type="button" className={PRIMARY_BTN} onClick={() => p.onOpenAnchor(r.contractId!)}>
                      Markera avtalsdag
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {action?.type === 'waive' && (
        <CoverageDecisionModal
          title="Efterskänk"
          item={action.item}
          intro={`Stationerna får ingen ny faktura för ${action.item.period_from} t.o.m. ${action.item.period_to}. Dagarna räknas som betalda.`}
          noteLabel="Varför efterskänks debiteringen?"
          confirmLabel="Efterskänk"
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={async (note) => {
            const it = action.item
            if (!it.station_ids?.length || !it.station_kind || !it.period_from || !it.period_to) return
            setBusy(true)
            try {
              await AddonCoverageService.waive({
                stationIds: it.station_ids,
                kind: it.station_kind,
                from: it.period_from,
                to: it.period_to,
                note: `${note} (faktura ${it.invoice_number ?? it.case_number ?? 'utan nummer'} makulerad)`,
              })
              await after('Debiteringen är efterskänkt.')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Kunde inte efterskänka')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {action?.type === 'rebill' && (
        <CoverageDecisionModal
          title="Fakturera igen"
          item={action.item}
          intro={`Dagarna ${action.item.period_from} t.o.m. ${action.item.period_to} blir obetalda igen. Planera fakturor tar med dem på nästa faktura.`}
          noteLabel="Kommentar (valfri)"
          noteOptional
          confirmLabel="Fakturera igen"
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={async (note) => {
            const it = action.item
            if (!it.coverage_ids?.length) return
            setBusy(true)
            try {
              const nr = it.invoice_number ?? it.case_number ?? 'utan nummer'
              await AddonCoverageService.release(it.coverage_ids, `Faktura ${nr} makulerad, faktureras igen${note ? `: ${note}` : ''}`)
              await after('Stationerna faktureras igen vid nästa planering.')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Kunde inte släppa täckningen')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {action?.type === 'case' && (
        <ChooseCaseModal
          item={action.item}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={async (caseId) => {
            const it = action.item
            if (!it.station_ids?.length || !it.station_kind || !it.unit_id) return
            setBusy(true)
            try {
              await AddonCoverageService.setStationCase(it.station_ids, it.station_kind, caseId)
              // Nya tilläggsregler: pro rata på ärendet direkt (stängt ärende ger ingen rad)
              if (it.v2) {
                const { error } = await supabase.rpc('sync_addon_prorata_line', {
                  p_customer_id: it.unit_id,
                  p_annual_price: null,
                  p_technician_id: null,
                  p_technician_name: null,
                  p_case_id: caseId,
                })
                if (error) throw new Error(`Ärendet är valt men pro rata kunde inte skapas: ${error.message}`)
              }
              await after('Stationen hör nu till ärendet.')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Kunde inte välja ärende')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {openInvoiceId && (
        <Suspense fallback={null}>
          <InvoiceDetailModal isOpen invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
        </Suspense>
      )}
    </div>
  )
}

function CoverageDecisionModal({
  title,
  item,
  intro,
  noteLabel,
  noteOptional = false,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  title: string
  item: ContractWorkItem
  intro: string
  noteLabel: string
  noteOptional?: boolean
  confirmLabel: string
  busy: boolean
  onClose: () => void
  onConfirm: (note: string) => void | Promise<void>
}) {
  const [note, setNote] = useState('')
  const valid = noteOptional || note.trim().length > 0
  return (
    <Modal isOpen onClose={onClose} usePortal size="sm" title={title}
      subtitle={`${item.unit_name ?? item.root_name} · faktura ${item.invoice_number ?? item.case_number ?? 'utan nummer'}`}>
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">{intro}</p>
        <label className="block text-xs font-medium text-slate-400">
          {noteLabel}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            autoFocus
            className="mt-1 w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
          <button type="button" onClick={onClose} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200">
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => valid && void onConfirm(note.trim())}
            disabled={!valid || busy}
            className="bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface CaseOption {
  id: string
  case_number: string | null
  title: string | null
  status: string | null
  created_at: string | null
}

function ChooseCaseModal({
  item,
  busy,
  onClose,
  onConfirm,
}: {
  item: ContractWorkItem
  busy: boolean
  onClose: () => void
  onConfirm: (caseId: string) => void | Promise<void>
}) {
  const [cases, setCases] = useState<CaseOption[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ids = [item.unit_id, item.root_customer_id].filter((x): x is string => !!x)
      const { data } = await supabase
        .from('cases')
        .select('id, case_number, title, status, created_at')
        .in('customer_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40)
      if (!cancelled) setCases((data ?? []) as CaseOption[])
    })()
    return () => {
      cancelled = true
    }
  }, [item.unit_id, item.root_customer_id])

  return (
    <Modal isOpen onClose={onClose} usePortal size="sm" title="Välj ärende"
      subtitle={`${item.station_count} ${item.station_count === 1 ? 'station' : 'stationer'} på ${item.unit_name ?? item.root_name}`}>
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          Välj ärendet där stationen sattes ut. Är ärendet öppet hamnar pro rata där, annars tar nästa planering det som en egen faktura.
        </p>
        {cases === null ? (
          <p className="text-xs text-slate-500 py-4 text-center">Hämtar ärenden</p>
        ) : cases.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Enheten har inga ärenden.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {cases.map((c) => (
              <label key={c.id} className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="radio"
                  name="case"
                  checked={chosen === c.id}
                  onChange={() => setChosen(c.id)}
                  className="mt-0.5 w-3.5 h-3.5 border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <span className="min-w-0">
                  <span className="text-sm text-white font-mono">{c.case_number ?? 'Ärende'}</span>
                  <span className="text-xs text-slate-400"> · {c.status ?? 'okänd status'}</span>
                  {c.title && <span className="block text-xs text-slate-400 truncate">{c.title}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
          <button type="button" onClick={onClose} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200">
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => chosen && void onConfirm(chosen)}
            disabled={!chosen || busy}
            className="bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            Välj ärende
          </button>
        </div>
      </div>
    </Modal>
  )
}
