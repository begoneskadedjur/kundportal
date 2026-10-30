// src/components/admin/customers/record/ContractBillingModePanel.tsx
// Avtalsår, tilläggsregler och ärendefakturering i inställningspanelens grupp
// Fakturering (steg 12 i docs/planer/avtalsar-exakt-arsdag-teknik.md).
//
// Avtalsåret: "Följer avtalsdagen" (contracts.billing_anchor_mode =
// 'start_day') eller "Börjar den 1:a (som tidigare)" (NULL). Byte till
// avtalsdagen kräver att startdatumet markeras som kontrollerat mot
// Oneflow-avtalet. Innan något sparas visas nästa tre perioder och vad som
// händer med utkasten (fakturaplanen i provläge, ingen apply). Fakturorna
// ändras först när någon kör Planera fakturor.
//
// Skrivning via ContractScopeService (SECURITY DEFINER-RPC, kräver
// befogenheten att godkänna fakturor, loggas i avtalets historik).
// Platt text med statuspunkt, inga piller.

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { supabase } from '../../../../lib/supabase'
import { ContractScopeService } from '../../../../services/contractScopeService'
import {
  ADHOC_GROUPING_LABEL,
  CustomerBillingService,
  type AdhocInvoiceGrouping,
} from '../../../../services/customerBillingService'
import { upcomingPeriods, type PlanChangePreview } from '../../../../shared/contractAnchorPreview'
import { anchorDayText, reviewDateKey } from '../../../../shared/contractReview'
import { todayKey } from '../../../../utils/contractLifecycle'
import type { RecordContract } from '../../../../hooks/useCustomerRecord'
import { PANEL_INPUT_CLASS } from './paperInk'

type AnchorChoice = 'start_day' | 'first'
type AddonChoice = 'v2' | 'legacy'

const DEFAULT_NOTE = 'Startdatum kontrollerat mot Oneflow-avtalet'

const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-[#20c58f] text-[#fff] font-semibold hover:brightness-110 disabled:opacity-50'
const SECONDARY_BTN =
  'inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f] disabled:opacity-50'

interface Props {
  contract: RecordContract
  archived: boolean
  /** profiles.can_approve_invoices: får byta avtalsår och tilläggsregler */
  canApprove: boolean
  oneflowUrl: string | null
  /** Avropsavtal: ärendefaktureringen på kundraden som äger avtalet */
  adhoc?: { customerId: string; value: AdhocInvoiceGrouping; canEdit: boolean } | null
  /** Arbetslistans "Markera avtalsdag": kontrollformuläret öppet direkt */
  focusAnchor?: boolean
  onChanged: () => void | Promise<void>
  onOpenPlan?: () => void
}

function H6({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-slate-300 mb-1.5">{children}</div>
}

function Dot({ tone }: { tone: 'ok' | 'warn' | 'muted' }) {
  const cls = tone === 'ok' ? 'bg-[#20c58f]' : tone === 'warn' ? 'bg-amber-400' : 'bg-slate-500'
  return <span className={`mt-[6px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`} aria-hidden />
}

/** Förhandsvisningen: vad Planera fakturor gör med utkasten efter bytet. */
function PreviewBox({ loading, preview, error }: { loading: boolean; preview: PlanChangePreview | null; error: string | null }) {
  return (
    <div className="mt-2 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-[12px]">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        <Icon name="kund.period" size={16} />
        <span>Fakturorna efter bytet</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Planerar i förhandsvisning
        </div>
      ) : error ? (
        <div className="text-amber-300">{error}</div>
      ) : preview ? (
        <>
          {preview.lines.length === 0 ? (
            <div className="text-slate-300">Inga utkast får nya datum.</div>
          ) : (
            <ul className="space-y-1">
              {preview.lines.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-200">
                  <Dot tone={l.kind === 'deleted' ? 'warn' : l.kind === 'created' ? 'muted' : 'ok'} />
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1.5 text-[11px] text-slate-500">{preview.footer}</div>
        </>
      ) : null}
    </div>
  )
}

function usePlanPreview(contractId: string, change: { billing_anchor_mode?: 'start_day' | null; addon_rules?: 'v2' | null } | null) {
  const [state, setState] = useState<{ loading: boolean; preview: PlanChangePreview | null; error: string | null }>({
    loading: false,
    preview: null,
    error: null,
  })
  const key = change ? JSON.stringify(change) : ''
  useEffect(() => {
    if (!change) {
      setState({ loading: false, preview: null, error: null })
      return
    }
    let alive = true
    setState({ loading: true, preview: null, error: null })
    ContractScopeService.previewBillingModeChange(contractId, change)
      .then((preview) => alive && setState({ loading: false, preview, error: null }))
      .catch((err) => alive && setState({ loading: false, preview: null, error: err instanceof Error ? err.message : 'Förhandsvisningen misslyckades' }))
    return () => {
      alive = false
    }
    // key bär ändringen; change är ett nytt objekt varje render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, key])
  return state
}

export default function ContractBillingModePanel({ contract, archived, canApprove, oneflowUrl, adhoc, focusAnchor, onChanged, onOpenPlan }: Props) {
  const start = contract.contract_start_date ?? null
  const currentAnchor: AnchorChoice = contract.billing_anchor_mode === 'start_day' ? 'start_day' : 'first'
  const currentAddon: AddonChoice = contract.addon_rules === 'v2' ? 'v2' : 'legacy'
  const verifiedAt = contract.billing_anchor_verified_at ?? null
  const canEdit = canApprove && !archived

  const [anchorDraft, setAnchorDraft] = useState<AnchorChoice>(currentAnchor)
  const [reverify, setReverify] = useState(false)
  const [note, setNote] = useState(DEFAULT_NOTE)
  const [checked, setChecked] = useState(false)
  const [addonDraft, setAddonDraft] = useState<AddonChoice>(currentAddon)
  const [saving, setSaving] = useState<null | 'anchor' | 'addon' | 'adhoc'>(null)
  const [savedHint, setSavedHint] = useState(false)
  const [verifierName, setVerifierName] = useState<string | null>(null)

  // Nytt avtal i panelen eller sparat värde: utkastet följer databasen
  useEffect(() => {
    setAnchorDraft(currentAnchor)
    setAddonDraft(currentAddon)
    setNote(DEFAULT_NOTE)
    setChecked(false)
    setReverify(!!focusAnchor && currentAnchor === 'start_day' && !verifiedAt)
    setSavedHint(false)
  }, [contract.id, currentAnchor, currentAddon, verifiedAt, focusAnchor])

  // Vem som kontrollerade: billing_anchor_verified_by pekar på profiles.id
  useEffect(() => {
    const id = contract.billing_anchor_verified_by ?? null
    if (!id) {
      setVerifierName(null)
      return
    }
    let alive = true
    void supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const row = data as { display_name?: string | null; email?: string | null } | null
        setVerifierName(row?.display_name || row?.email || null)
      })
    return () => {
      alive = false
    }
  }, [contract.billing_anchor_verified_by])

  const anchorChanged = anchorDraft !== currentAnchor
  const anchorFormOpen = canEdit && (anchorChanged || reverify)
  const addonChanged = addonDraft !== currentAddon

  const anchorPreview = usePlanPreview(
    contract.id,
    anchorChanged ? { billing_anchor_mode: anchorDraft === 'start_day' ? 'start_day' : null } : null
  )
  const addonPreview = usePlanPreview(contract.id, addonChanged ? { addon_rules: addonDraft === 'v2' ? 'v2' : null } : null)

  const today = todayKey()
  const periods = useMemo(
    () =>
      upcomingPeriods(
        {
          contract_start_date: start,
          billing_frequency: contract.billing_frequency ?? null,
          billing_anchor_month: contract.billing_anchor_month ?? null,
          billing_anchor_mode: anchorDraft === 'start_day' ? 'start_day' : null,
        },
        today,
        3
      ),
    [start, contract.billing_frequency, contract.billing_anchor_month, anchorDraft, today]
  )

  const saveAnchor = async () => {
    const mode = anchorDraft === 'start_day' ? 'start_day' : null
    if (mode === 'start_day' && (!checked || !note.trim())) return
    setSaving('anchor')
    try {
      await ContractScopeService.setBillingAnchorMode(contract.id, mode, mode === 'start_day' ? note.trim() : null)
      toast.success(
        mode === 'start_day'
          ? reverify && !anchorChanged
            ? 'Avtalsdagen är markerad som kontrollerad.'
            : 'Avtalsåret följer nu avtalsdagen. Kör Planera fakturor för att flytta utkasten.'
          : 'Avtalsåret börjar den 1:a igen. Kör Planera fakturor för att flytta utkasten.'
      )
      setSavedHint(anchorChanged)
      setReverify(false)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara avtalsåret')
    } finally {
      setSaving(null)
    }
  }

  const saveAddon = async () => {
    setSaving('addon')
    try {
      await ContractScopeService.setAddonRules(contract.id, addonDraft === 'v2' ? 'v2' : null)
      toast.success(addonDraft === 'v2' ? 'Tilläggen följer nu premien.' : 'Tilläggen faktureras som tidigare.')
      setSavedHint(true)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara tilläggsreglerna')
    } finally {
      setSaving(null)
    }
  }

  const saveAdhoc = async (value: AdhocInvoiceGrouping) => {
    if (!adhoc || value === adhoc.value) return
    setSaving('adhoc')
    try {
      await CustomerBillingService.setAdhocGrouping(adhoc.customerId, value)
      toast.success(`Ärenden faktureras nu ${ADHOC_GROUPING_LABEL[value]}.`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara ärendefaktureringen')
    } finally {
      setSaving(null)
    }
  }

  const dayText = start ? anchorDayText(start) : null

  return (
    <div className="mt-4 pt-3 border-t border-slate-700 space-y-4">
      {/* Avtalsår */}
      <div>
        <H6>Avtalsår</H6>
        {canEdit ? (
          <div className="space-y-1">
            <label className={`flex items-center gap-2 text-[12.5px] ${start ? 'text-white cursor-pointer' : 'text-slate-500'}`}>
              <input
                type="radio"
                name={`anchor-${contract.id}`}
                checked={anchorDraft === 'start_day'}
                disabled={!start || saving !== null}
                onChange={() => setAnchorDraft('start_day')}
                className="text-[#20c58f] focus:ring-[#20c58f]"
              />
              Följer avtalsdagen{dayText ? ` (${dayText})` : ''}
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-white cursor-pointer">
              <input
                type="radio"
                name={`anchor-${contract.id}`}
                checked={anchorDraft === 'first'}
                disabled={saving !== null}
                onChange={() => setAnchorDraft('first')}
                className="text-[#20c58f] focus:ring-[#20c58f]"
              />
              Börjar den 1:a (som tidigare)
            </label>
            {!start && <div className="text-[11px] text-slate-500">Sätt startdatum under Löptid för att kunna följa avtalsdagen.</div>}
          </div>
        ) : (
          <div className="text-[12.5px] text-white">
            {currentAnchor === 'start_day' ? `Följer avtalsdagen${dayText ? ` (${dayText})` : ''}` : 'Börjar den 1:a (som tidigare)'}
          </div>
        )}

        {periods.length > 0 && (
          <div className="mt-1.5 text-[11.5px] text-slate-400 tabular-nums">
            {anchorChanged ? 'Med valet: ' : 'Nästa perioder: '}
            {periods.map((p) => `${p.periodStart} t.o.m. ${p.periodEnd}`).join(' · ')}
          </div>
        )}

        {/* Kontrollmarkeringen */}
        {currentAnchor === 'start_day' && !anchorChanged && (
          <div className="mt-2 flex items-start gap-2 text-[12px]">
            <Dot tone={verifiedAt ? 'ok' : 'warn'} />
            <div className="flex-1 min-w-0 text-slate-300">
              {verifiedAt ? (
                <>
                  Avtalsdagen kontrollerad {reviewDateKey(verifiedAt)}
                  {verifierName ? ` av ${verifierName}` : ''}
                  {contract.billing_anchor_verified_note ? <span className="block text-slate-500">{contract.billing_anchor_verified_note}</span> : null}
                </>
              ) : (
                <>
                  <span className="text-amber-300">Avtalsdagen är inte kontrollerad mot Oneflow-avtalet.</span>
                  {contract.billing_anchor_verified_note ? <span className="block text-slate-500">{contract.billing_anchor_verified_note}</span> : null}
                </>
              )}
            </div>
            {canEdit && !reverify && !verifiedAt && (
              <button type="button" className={SECONDARY_BTN} onClick={() => setReverify(true)}>
                Markera avtalsdag
              </button>
            )}
          </div>
        )}

        {anchorFormOpen && (
          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
            {anchorDraft === 'start_day' && (
              <>
                <label className="flex items-start gap-2 text-[12px] text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-[3px] h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  <span>
                    Startdatumet {start} stämmer med det signerade avtalet i Oneflow.
                    {oneflowUrl && (
                      <>
                        {' '}
                        <a href={oneflowUrl} target="_blank" rel="noreferrer" className="text-[#20c58f] underline decoration-dotted">
                          Öppna avtalet
                        </a>
                      </>
                    )}
                  </span>
                </label>
                <div className="mt-2">
                  <div className="text-[11px] text-slate-500 mb-1">Hur kontrollerades det</div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className={PANEL_INPUT_CLASS} aria-label="Hur startdatumet kontrollerades" />
                </div>
              </>
            )}
            {anchorChanged && <PreviewBox {...anchorPreview} />}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={saving !== null || (anchorDraft === 'start_day' && (!checked || !note.trim()))}
                onClick={() => void saveAnchor()}
              >
                {saving === 'anchor' && <Loader2 className="w-3 h-3 animate-spin" />}
                {anchorChanged ? 'Spara avtalsåret' : 'Markera som kontrollerad'}
              </button>
              <button
                type="button"
                className={SECONDARY_BTN}
                disabled={saving !== null}
                onClick={() => {
                  setAnchorDraft(currentAnchor)
                  setReverify(false)
                  setChecked(false)
                }}
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tilläggsregler */}
      <div>
        <H6>Tilläggsregler</H6>
        {canEdit ? (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-[12.5px] text-white cursor-pointer">
              <input
                type="radio"
                name={`addon-${contract.id}`}
                checked={addonDraft === 'v2'}
                disabled={saving !== null}
                onChange={() => setAddonDraft('v2')}
                className="text-[#20c58f] focus:ring-[#20c58f]"
              />
              Följer premien
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-white cursor-pointer">
              <input
                type="radio"
                name={`addon-${contract.id}`}
                checked={addonDraft === 'legacy'}
                disabled={saving !== null}
                onChange={() => setAddonDraft('legacy')}
                className="text-[#20c58f] focus:ring-[#20c58f]"
              />
              Som tidigare
            </label>
          </div>
        ) : (
          <div className="text-[12.5px] text-white">{currentAddon === 'v2' ? 'Följer premien' : 'Som tidigare'}</div>
        )}
        <div className="mt-1 text-[11.5px] text-slate-400">
          {addonDraft === 'v2'
            ? 'Tilläggen faktureras med premiens perioder, en faktura per enhetens referenskod och med enhetens namn på raden. Utan premie faktureras de årsvis på avtalsdagen.'
            : 'Tilläggen faktureras på egen faktura i samband med årsfakturan, som hittills.'}
        </div>
        {canEdit && addonChanged && (
          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
            {addonDraft === 'v2' && (
              <div className="flex items-start gap-2 text-[12px] text-amber-300">
                <Dot tone="warn" />
                <span>Slå på först när betald till och med stämmer för kundens tilläggsstationer (Innehåll och utrustning).</span>
              </div>
            )}
            <PreviewBox {...addonPreview} />
            <div className="mt-2.5 flex items-center gap-2">
              <button type="button" className={PRIMARY_BTN} disabled={saving !== null} onClick={() => void saveAddon()}>
                {saving === 'addon' && <Loader2 className="w-3 h-3 animate-spin" />}
                Spara tilläggsreglerna
              </button>
              <button type="button" className={SECONDARY_BTN} disabled={saving !== null} onClick={() => setAddonDraft(currentAddon)}>
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

      {savedHint && onOpenPlan && (
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          <Dot tone="warn" />
          <span className="flex-1">Utkasten ändras först när fakturorna planeras om.</span>
          <button type="button" className={PRIMARY_BTN} onClick={onOpenPlan}>
            Planera fakturor
          </button>
        </div>
      )}

      {/* Ärendefakturering för avrop */}
      {adhoc && (
        <div>
          <H6>Ärenden faktureras</H6>
          {adhoc.canEdit && !archived ? (
            <select
              value={adhoc.value}
              disabled={saving !== null}
              onChange={(e) => void saveAdhoc(e.target.value as AdhocInvoiceGrouping)}
              className={PANEL_INPUT_CLASS}
              aria-label="Ärenden faktureras"
            >
              <option value="per_case">Per ärende</option>
              <option value="monthly_batch">Samlat per månad</option>
            </select>
          ) : (
            <div className="text-[12.5px] text-white">{ADHOC_GROUPING_LABEL[adhoc.value]}</div>
          )}
          <div className="mt-1 text-[11.5px] text-slate-400">
            {adhoc.value === 'monthly_batch'
              ? 'Avslutade ärenden samlas på en faktura per månad.'
              : 'Varje avslutat ärende får en egen faktura.'}
          </div>
        </div>
      )}
    </div>
  )
}
