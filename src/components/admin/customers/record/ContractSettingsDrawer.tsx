// src/components/admin/customers/record/ContractSettingsDrawer.tsx
// Inställningspanelen och pulsen till höger om avtalspappret.
//
// Tre lager (artifacten "Avtalskartan i tre lager"): pappret säger vad vi
// avtalat, den här panelen säger hur systemet sköter det, pulsen säger hur
// det går. Panelen öppnas från kugghjulet på den paragraf den gäller, på
// rätt grupp, och ligger bredvid pappret så att raden på pappret uppdateras
// medan man skriver. Åtta grupper, en synlig i taget, aldrig något som
// pappret redan visar.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  BILLING_FREQUENCY_LABEL,
  VISIT_FREQUENCY_LABEL,
  customerRowName,
  formatDateSv,
  formatKr,
  type CustomerRecordData,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordInspectionSession,
} from '../../../../hooks/useCustomerRecord'
import type { CaseBillingItemWithRelations } from '../../../../types/caseBilling'
import type { AddonBrick } from '../../../../types/addonStations'
import { formatPayback, marginTone, paybackTone, toneTextClass } from '../../../../shared/marginEngine'
import { PANEL_INK, PANEL_INPUT_CLASS } from './paperInk'
import { AgreementObjectText } from './PaperSignatures'
import ContractPremiumSection, { premiumSummary, type PremiumPlanEntry } from './ContractPremiumSection'
import ContractReferencesSection from './ContractReferencesSection'
import ContractTermSection, { termWatch } from './ContractTermSection'
import ContractPriceListSection from './ContractPriceListSection'
import { billingModelOf, MODEL_LABEL, siteOf, type BillingModel } from './ContractEquipmentSection'
import { useContractContent } from './ContractContentSection'
import { useAvropCatalog } from './ContractPriceListSection'
import type { HistoryTab } from './ContractHistoryModal'
import type { UnitFollowup } from './ContractMapSection'
import {
  SETTINGS_GROUPS,
  SETTINGS_GROUP_LABEL,
  computeCompleteness,
  type CompletenessInput,
  type SettingsGroup,
} from './contractCompleteness'

export type SettingsTab = 'settings' | 'puls'

export interface PaperFollowup {
  nextVisit: RecordInspectionSession | null
  visitsDone: number
  visitsBooked: number
  casesDone: number
  casesOpen: number
  casesTotal: number
  units: UnitFollowup[]
}

export interface ContractSettingsDrawerProps {
  contract: RecordContract
  root: RecordCustomer
  archived: boolean
  group: SettingsGroup
  tab: SettingsTab
  onChangeGroup: (g: SettingsGroup) => void
  onChangeTab: (t: SettingsTab) => void
  onClose: () => void
  /** Kompletthetens underlag utom marginalen, som panelen hämtar själv */
  completenessBase: Omit<CompletenessInput, 'breakdown'>
  contentReloadKey: number
  /** Kundradens prislista, fallback när avtalet saknar egen */
  rootPriceListId: string | null
  // Avtalet
  contractTypes: string[]
  onChangeType?: (typeName: string) => void
  onEditSignedAt?: () => void
  staff: { id: string; name: string; email?: string | null }[]
  onSaveSalesPerson?: (name: string | null) => Promise<void>
  onSaveAccountManager?: (name: string | null, email: string | null) => Promise<void>
  oneflowUrl: string | null
  // Omfattning
  scope: RecordContractSite[]
  customerById: Map<string, RecordCustomer>
  isSingleSite: boolean
  isUnitContract: boolean
  onClearCoversAll?: () => void
  onEndCoverage?: (cs: RecordContractSite, x: number, y: number) => void
  onSaveAgreementText?: (text: string | null) => Promise<void>
  // Prislista
  priceListLabel: string | null
  onEditPriceList?: (x: number, y: number) => void
  // Uppföljning
  followup: PaperFollowup
  onEditFrequency?: () => void
  onEditSitePlan?: (unit: UnitFollowup) => void
  // Innehåll och utrustning
  onEditContent?: () => void
  onChangeLineModel?: (item: CaseBillingItemWithRelations, model: BillingModel) => Promise<void>
  bricks: AddonBrick[]
  onDecideBrick?: (brick: AddonBrick, zone: 'premium' | 'equipment', x: number, y: number) => void
  /** Samma beslut för flera brickor på det här avtalet (kryssade i panelen) */
  onDecideBricks?: (bricks: AddonBrick[], zone: 'premium' | 'equipment', x: number, y: number) => void
  /** Beslutat på det här avtalet sedan panelen öppnades: stationer och kr/år */
  decided?: { count: number; kr: number } | null
  /** Nästa avtal på kunden som fortfarande har brickor att besluta */
  nextBricks?: { contractId: string; label: string; count: number } | null
  onGoNext?: () => void
  unitNameOf: (unitId: string) => string
  equipmentInvoiceMode: 'with_premium' | 'separate'
  onChangeEquipmentInvoiceMode?: (mode: 'with_premium' | 'separate') => Promise<void>
  // Fakturering
  premiumEvents: CustomerRecordData['premiumEvents']
  annualInForce: number | null
  invoiceMode: 'per_contract' | 'consolidated'
  planEntries: PremiumPlanEntry[]
  onLinkFortnox?: (period: { periodStart: string; periodEnd: string; expectedSubtotal: number | null; kind?: string }) => void
  onSavePremium?: (input: { annualValue: number | null; billingFrequency: string | null; billingAnchorMonth: number | null }) => Promise<void>
  onAddPremiumEvent?: (input: { eventType: 'step_up' | 'indexation' | 'adjustment'; effectiveFrom: string; annualValue: number; note: string | null }) => Promise<void>
  // Referenser
  coveredLocations: RecordCustomer[]
  onSaveInvoiceReference?: (input: { invoiceReference: string | null; diaryNumber: string | null }) => Promise<void>
  onSaveUnitReference?: (unit: RecordCustomer, code: string | null) => Promise<void>
  // Löptid
  onSaveTerm?: (input: { startDate: string | null; endDate: string | null; noticePeriodMonths: number | null }) => Promise<void>
  onSaveRenewal?: (input: { renewalMode: 'rolling' | 'fixed' | 'option'; optionUntil: string | null; optionDecisionDeadline: string | null; reminderDays: number | null }) => Promise<void>
  onExerciseOption?: () => Promise<void>
  onTerminate?: () => void
  onReactivate?: () => void
  onDelete?: () => void
  // Puls
  stationCount: { outdoor: number; indoor: number; addon: number } | null
  onOpenHistory: (tab: HistoryTab, unitFilter?: string) => void
}

const ink = PANEL_INK
const brickKeyOf = (b: AddonBrick) => `${b.unitId}|${b.stationTypeId ?? ''}|${b.model}`

const STATUS_DOT: Record<'ok' | 'warn' | 'note' | 'none', string> = {
  ok: 'bg-[#20c58f]',
  warn: 'bg-amber-400',
  note: 'bg-slate-400',
  none: 'border border-slate-600',
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-slate-500 mb-1">{children}</div>
}

/**
 * Personalväljare i panelen: aldrig fritext (21 namnvarianter hade uppstått
 * i avtalen mot 12 i registret). Tomt val = ärv från kundkortet.
 */
function StaffSelect({
  value,
  fallback,
  staff,
  onSave,
}: {
  value: string | null
  fallback: string | null
  staff: { id: string; name: string }[]
  onSave?: (name: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const names = staff.map((s) => s.name)
  // Ett namn som inte längre finns i registret måste ändå gå att visa
  const options = value && !names.includes(value) ? [value, ...names] : names
  const change = async (next: string) => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(next || null)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <select
        value={value ?? ''}
        onChange={(e) => void change(e.target.value)}
        disabled={!onSave || saving}
        className={`${PANEL_INPUT_CLASS} disabled:opacity-60`}
      >
        <option value="">{fallback ? `Som kundkortet: ${fallback}` : 'Inte angett'}</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {!value && fallback && (
        <div className="mt-1 text-[11px] text-slate-500">Ärvs från kundkortet tills avtalet får ett eget namn.</div>
      )}
    </div>
  )
}

function H5({ children }: { children: React.ReactNode }) {
  return <h5 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2.5">{children}</h5>
}

function Kpi({ title, value, sub, tone, children }: { title: string; value?: React.ReactNode; sub?: React.ReactNode; tone?: 'warn'; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</div>
      {value !== undefined && (
        <div className={`font-serif text-[19px] font-semibold mt-0.5 tabular-nums ${tone === 'warn' ? 'text-amber-400 text-[15px]' : 'text-white'}`}>{value}</div>
      )}
      {sub && <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>}
      {children}
    </div>
  )
}

export default function ContractSettingsDrawer(p: ContractSettingsDrawerProps) {
  const { contract, group, tab, archived } = p
  const contentData = useContractContent(contract.id, p.contentReloadKey)
  const content = contentData.content
  const contentLoading = contentData.loading
  const avrop = useAvropCatalog(
    contract.price_list_id ?? p.rootPriceListId ?? null,
    content.services.map((s) => s.service_id).filter((id): id is string => !!id)
  )
  const completeness = computeCompleteness({ ...p.completenessBase, breakdown: content.summary?.breakdown ?? null })

  // Esc stänger panelen, som i portalens modaler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p])

  const b = content.summary?.breakdown ?? null
  const settings = content.settings
  const ps = premiumSummary({ contract, annualInForce: p.annualInForce, planEntries: p.planEntries })
  const tw = termWatch(contract)
  const nextStep = completeness.nextStep
  // Flerval bland brickorna. Nollställs när panelen byter papper, så ett
  // "Välj alla" aldrig följer med till fel avtal.
  const [selectedBricks, setSelectedBricks] = useState<Set<string>>(new Set())
  useEffect(() => {
    setSelectedBricks(new Set())
  }, [contract.id])

  const services = content.services
  const articles = content.articles
  const addonServices = services.filter((s) => billingModelOf(s) !== 'premium' && !(siteOf(s) && Number(s.quantity) === 0))
  const premiumServices = services.filter((s) => billingModelOf(s) === 'premium')

  const renderGroup = () => {
    switch (group) {
      case 'avtalet':
        return (
          <div>
            <H5>Avtalet</H5>
            <div className="mb-3">
              <Label>Avtalstyp</Label>
              {p.onChangeType && !archived ? (
                <select
                  value={p.contractTypes.includes(contract.label ?? '') ? (contract.label as string) : ''}
                  onChange={(e) => e.target.value && p.onChangeType?.(e.target.value)}
                  className={PANEL_INPUT_CLASS}
                >
                  <option value="">Välj avtalstyp</option>
                  {p.contractTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[13px] text-white">{contract.label ?? contract.contract_type ?? 'Avtal'}</div>
              )}
            </div>
            <div className="mb-3">
              <Label>Signerat</Label>
              <div className="flex items-center gap-3 text-[13px] text-white">
                {contract.signed_at ? formatDateSv(contract.signed_at) : <span className="text-amber-400">inte angett</span>}
                {p.onEditSignedAt && !archived && (
                  <button type="button" onClick={p.onEditSignedAt} className="text-[12px] text-[#20c58f] underline decoration-dotted">
                    {contract.signed_at ? 'ändra' : 'ange datum'}
                  </button>
                )}
              </div>
            </div>
            {/* Skrivstilen hör hemma på pappret. I panelen är det vanliga
                väljare i panelens toner, annars syns namnen inte mot mörkt. */}
            <div className="mb-3">
              <Label>Säljare, den som skrivit under för BeGone</Label>
              <StaffSelect
                value={contract.begone_employee_name ?? null}
                fallback={p.root.sales_person ?? null}
                staff={p.staff}
                onSave={archived || !p.onSaveSalesPerson ? undefined : (name) => p.onSaveSalesPerson!(name)}
              />
            </div>
            <div className="mb-3">
              <Label>Kundansvarig</Label>
              <StaffSelect
                value={contract.account_manager_name ?? null}
                fallback={p.root.assigned_account_manager ?? null}
                staff={p.staff}
                onSave={
                  archived || !p.onSaveAccountManager
                    ? undefined
                    : (name) => p.onSaveAccountManager!(name, name ? p.staff.find((s) => s.name === name)?.email ?? null : null)
                }
              />
            </div>
            {p.oneflowUrl && (
              <div className="mb-3">
                <Label>Oneflow</Label>
                <a href={p.oneflowUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-[#20c58f] underline decoration-dotted">
                  Öppna det signerade avtalet
                </a>
              </div>
            )}
          </div>
        )
      case 'omfattning':
        return (
          <div>
            <H5>Omfattning</H5>
            {contract.covers_all_sites ? (
              <div className="flex items-center gap-3 mb-3 text-[13px] text-white">
                Täcker hela verksamheten, även framtida enheter
                {p.onClearCoversAll && !archived && (
                  <button type="button" onClick={p.onClearCoversAll} className="text-[12px] text-[#20c58f] underline decoration-dotted">
                    byt till valda enheter
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-[12.5px] mb-3">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.06em] text-slate-500">
                    <th className="text-left font-medium pb-1.5 border-b border-slate-700">Enhet</th>
                    <th className="text-left font-medium pb-1.5 border-b border-slate-700">Gäller från</th>
                    <th className="border-b border-slate-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {p.isUnitContract && (
                    <tr>
                      <td className="py-1.5 border-b border-slate-700 text-white" colSpan={3}>
                        {customerRowName(p.customerById.get(contract.customer_id ?? '') ?? p.root)} · avtalet bor på enheten
                      </td>
                    </tr>
                  )}
                  {p.scope.map((cs) => {
                    const unit = p.customerById.get(cs.customer_id)
                    return (
                      <tr key={cs.id}>
                        <td className="py-1.5 border-b border-slate-700 text-white">{unit ? (p.isSingleSite ? unit.company_name : customerRowName(unit)) : 'Okänd enhet'}</td>
                        <td className="py-1.5 border-b border-slate-700 font-mono tabular-nums text-slate-300">{cs.active_from ?? ''}</td>
                        <td className="py-1.5 border-b border-slate-700 text-right">
                          {p.onEndCoverage && !archived && (
                            <button type="button" onClick={(e) => p.onEndCoverage?.(cs, e.clientX, e.clientY)} className="text-[11.5px] text-slate-400 hover:text-red-300 underline decoration-dotted">
                              avsluta täckning
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {p.scope.length === 0 && !p.isUnitContract && (
                    <tr>
                      <td colSpan={3} className="py-2 text-[12px] italic text-slate-500">Inga enheter ännu. Dra in dem från Verksamheten till § 1.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            <AgreementObjectText text={contract.agreement_text ?? null} onSave={archived ? undefined : p.onSaveAgreementText} ink={ink} />
          </div>
        )
      case 'prislista':
        return (
          <div>
            <H5>Prislista för avrop</H5>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-[13px] text-white">{p.priceListLabel ?? 'Ingen egen prislista'}</div>
              {p.onEditPriceList && !archived && (
                <button type="button" onClick={(e) => p.onEditPriceList?.(e.clientX, e.clientY)} className="ml-auto text-[12px] text-[#20c58f] underline decoration-dotted">
                  {p.priceListLabel ? 'byt prislista' : 'välj prislista'}
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-slate-500 mb-2">
              {p.priceListLabel
                ? 'Gäller avrop och tillägg per ärende och följer med till fakturan. Dra också en prislista från katalogen till § 2.'
                : 'Utan egen prislista gäller kundens lista eller prisguiden för avrop på avtalets enheter.'}
            </p>
            <div className="rounded-lg border border-slate-700 bg-[#f6f3ea] px-3 py-1 text-[#262e38]">
              <ContractPriceListSection catalog={avrop.catalog} loading={avrop.loading} priceListLabel={p.priceListLabel} />
              {avrop.catalog.priced.length === 0 && avrop.catalog.quoted.length === 0 && !avrop.loading && (
                <p className="font-sans text-[11.5px] italic py-2 text-[#8a9099]">Inga tjänster i listan ännu.</p>
              )}
            </div>
          </div>
        )
      case 'uppfoljning':
        return (
          <div>
            <H5>Uppföljning</H5>
            <div className="mb-3">
              <Label>Förval för avtalet</Label>
              <div className="flex items-center gap-3 text-[13px] text-white">
                {contract.visits_per_year
                  ? `${contract.visits_per_year} besök per år`
                  : contract.visit_frequency
                    ? VISIT_FREQUENCY_LABEL[contract.visit_frequency] ?? contract.visit_frequency
                    : <span className="text-amber-400">inte angett</span>}
                {p.onEditFrequency && !archived && (
                  <button type="button" onClick={p.onEditFrequency} className="text-[12px] text-[#20c58f] underline decoration-dotted">
                    ändra
                  </button>
                )}
              </div>
            </div>
            {/* En rad per enhet, takten som underrad: fyra kolumner får inte
                plats i 480 px utan att namnen bryts mitt i. */}
            <Label>Per enhet</Label>
            <div className="divide-y divide-slate-700 border-y border-slate-700">
              {p.followup.units.map((u) => {
                const unit = p.customerById.get(u.unitId)
                const takt =
                  u.serviceMode === 'on_demand'
                    ? 'Avrop, inga planerade besök'
                    : `Stationskontroll${
                        u.frequency ? ` · ${VISIT_FREQUENCY_LABEL[u.frequency] ?? u.frequency}` : u.visitsPerYear ? ` · ${u.visitsPerYear}/år` : ''
                      }`
                return (
                  <div key={u.unitId} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-white truncate">{unit ? customerRowName(unit) : 'Enhet'}</div>
                      <div className="text-[11.5px] text-slate-400">
                        {takt}
                        {u.inherited && <span className="text-slate-500"> · avtalets förval</span>}
                      </div>
                    </div>
                    {p.onEditSitePlan && !archived && (
                      <button type="button" onClick={() => p.onEditSitePlan?.(u)} className="shrink-0 text-[11.5px] text-[#20c58f] underline decoration-dotted">
                        ändra
                      </button>
                    )}
                  </div>
                )
              })}
              {p.followup.units.length === 0 && (
                <div className="py-2 text-[12px] italic text-slate-500">Inga enheter i omfattningen ännu.</div>
              )}
            </div>
          </div>
        )
      case 'innehall':
        return (
          <div>
            <H5>Innehåll och utrustning</H5>
            {/* Klarrad: sista brickan på avtalet är beslutad. Kön går vidare
                manuellt, en slide-over som byter papper av sig själv tappar
                bort var man är. */}
            {p.bricks.length === 0 && p.decided && p.decided.count > 0 && (
              <div className="rounded-lg border border-[#20c58f]/35 bg-[#20c58f]/5 px-3 py-2.5 mb-3">
                <div className="text-[12.5px] font-semibold text-white">Klart på det här avtalet</div>
                <div className="text-[12px] text-slate-400 mt-0.5">
                  {p.decided.count} tillägg · {formatKr(p.decided.kr)}/år beslutat
                </div>
                {p.nextBricks && p.onGoNext && (
                  <button type="button" onClick={p.onGoNext} className="mt-2 text-[12px] px-3 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold hover:brightness-110">
                    Nästa avtal · {p.nextBricks.count} tillägg
                  </button>
                )}
              </div>
            )}
            {p.bricks.length > 0 && (
              <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5 mb-3">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-amber-400">Att besluta · {p.bricks.length}</div>
                  {/* Samma beslut för flera: kryss per rad, aldrig förkryssat.
                      Nio av tio blir två klick, men aldrig ett beslut av tröghet. */}
                  {p.onDecideBricks && !archived && p.bricks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBricks(selectedBricks.size === p.bricks.length ? new Set() : new Set(p.bricks.map(brickKeyOf)))}
                      className="text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-200"
                    >
                      {selectedBricks.size === p.bricks.length ? 'Avmarkera alla' : `Välj alla ${p.bricks.length}`}
                    </button>
                  )}
                </div>
                {p.bricks.map((br) => (
                  <div key={brickKeyOf(br)} className="mb-2 last:mb-0">
                    <label className="flex items-start gap-2 text-[12.5px] text-white mb-1.5 cursor-pointer">
                      {p.onDecideBricks && !archived && p.bricks.length > 1 && (
                        <input
                          type="checkbox"
                          checked={selectedBricks.has(brickKeyOf(br))}
                          onChange={(e) => {
                            const next = new Set(selectedBricks)
                            if (e.target.checked) next.add(brickKeyOf(br))
                            else next.delete(brickKeyOf(br))
                            setSelectedBricks(next)
                          }}
                          className="mt-[3px] h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
                          aria-label={`Välj ${br.count} st ${br.stationTypeName} på ${p.unitNameOf(br.unitId)}`}
                        />
                      )}
                      <span>
                        {br.count} st {br.stationTypeName} · {p.unitNameOf(br.unitId)} · {br.model === 'per_month' ? 'per månad' : 'per år'}
                      </span>
                    </label>
                    {p.onDecideBrick && !archived && (
                      <div className="flex gap-2">
                        <button type="button" onClick={(e) => p.onDecideBrick?.(br, 'premium', e.clientX, e.clientY)} className="text-[12px] px-2.5 py-1 rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f]">
                          Baka in i premien
                        </button>
                        <button type="button" onClick={(e) => p.onDecideBrick?.(br, 'equipment', e.clientX, e.clientY)} className="text-[12px] px-2.5 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold hover:brightness-110">
                          Tillägg utöver avtalet
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {/* Åtgärdsrad för de kryssade: samma två knappar, antal i texten */}
                {p.onDecideBricks && !archived && selectedBricks.size > 0 && (() => {
                  const chosen = p.bricks.filter((br) => selectedBricks.has(brickKeyOf(br)))
                  const stations = chosen.reduce((s, br) => s + br.count, 0)
                  return (
                    <div className="mt-2.5 pt-2.5 border-t border-amber-500/30 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-slate-300 tabular-nums mr-auto">
                        {chosen.length} {chosen.length === 1 ? 'bricka' : 'brickor'} · {stations} stationer
                      </span>
                      <button
                        type="button"
                        onClick={(e) => p.onDecideBricks?.(chosen, 'premium', e.clientX, e.clientY)}
                        className="text-[12px] px-2.5 py-1 rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f]"
                      >
                        Baka in i premien
                      </button>
                      <button
                        type="button"
                        onClick={(e) => p.onDecideBricks?.(chosen, 'equipment', e.clientX, e.clientY)}
                        className="text-[12px] px-2.5 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold hover:brightness-110"
                      >
                        Tillägg utöver avtalet
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}
            {contentLoading ? (
              <p className="text-[12px] text-slate-500">Hämtar avtalsinnehåll…</p>
            ) : (
              <>
                <table className="w-full text-[12.5px] mb-3">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.06em] text-slate-500">
                      <th className="text-left font-medium pb-1.5 border-b border-slate-700">Rad</th>
                      <th className="text-right font-medium pb-1.5 border-b border-slate-700">Antal</th>
                      <th className="text-right font-medium pb-1.5 border-b border-slate-700">Pris</th>
                      <th className="text-left font-medium pb-1.5 pl-3 border-b border-slate-700">Läge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...premiumServices, ...addonServices].map((s) => {
                      const model = billingModelOf(s)
                      const site = siteOf(s)
                      return (
                        <tr key={s.id}>
                          <td className="py-1.5 border-b border-slate-700 text-white">
                            {s.service_name ?? s.article_name}
                            {site && <span className="text-slate-500"> · {p.unitNameOf(site)}</span>}
                          </td>
                          <td className="py-1.5 border-b border-slate-700 text-right font-mono tabular-nums text-slate-300">{Number(s.quantity ?? 1)}</td>
                          <td className="py-1.5 border-b border-slate-700 text-right font-mono tabular-nums text-slate-300">{formatKr(Number(s.unit_price ?? 0))}</td>
                          <td className="py-1.5 pl-3 border-b border-slate-700">
                            {p.onChangeLineModel && !archived ? (
                              <select
                                value={model}
                                onChange={(e) => void p.onChangeLineModel?.(s, e.target.value as BillingModel)}
                                className="bg-slate-800/70 border border-slate-700 rounded px-1.5 py-0.5 text-[11.5px] text-slate-200"
                              >
                                {(Object.keys(MODEL_LABEL) as BillingModel[]).map((m) => (
                                  <option key={m} value={m}>
                                    {MODEL_LABEL[m]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-400 text-[11.5px]">{MODEL_LABEL[model]}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {services.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-[12px] italic text-slate-500">Inga tjänster ännu. Dra in från katalogen, eller öppna redigeraren.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <H5>Intern kostnad</H5>
                <table className="w-full text-[12.5px] mb-3">
                  <tbody>
                    {articles.map((a) => (
                      <tr key={a.id}>
                        <td className="py-1.5 border-b border-slate-700 text-white">
                          {a.article_name}
                          {siteOf(a) && <span className="text-slate-500"> · {p.unitNameOf(siteOf(a) as string)}</span>}
                        </td>
                        <td className="py-1.5 border-b border-slate-700 text-right font-mono tabular-nums text-slate-300">
                          {Number(a.quantity ?? 1)} {a.article?.category === 'Arbetstid' ? 'h' : 'st'}
                        </td>
                        <td className="py-1.5 border-b border-slate-700 text-right font-mono tabular-nums text-slate-300">{formatKr(Number(a.total_price ?? 0))}</td>
                        <td className="py-1.5 pl-3 border-b border-slate-700 text-[10.5px] text-slate-500">{a.article?.is_durable ? 'varaktig' : ''}</td>
                      </tr>
                    ))}
                    {articles.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-[12px] italic text-slate-500">Inga interna kostnader. Lägg in årets arbetstid så marginalen säger något.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {p.onEditContent && !archived && (
                  <button type="button" onClick={p.onEditContent} className="text-[12px] px-2.5 py-1.5 rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f]">
                    Öppna redigeraren för tjänster och kostnader
                  </button>
                )}
              </>
            )}
            <div className="mt-4 pt-3 border-t border-slate-700">
              <H5>Tilläggen faktureras</H5>
              <div className="space-y-1.5 text-[12.5px] text-slate-200">
                {(['with_premium', 'separate'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`eq-mode-${contract.id}`}
                      checked={p.equipmentInvoiceMode === m}
                      disabled={!p.onChangeEquipmentInvoiceMode || archived}
                      onChange={() => void p.onChangeEquipmentInvoiceMode?.(m)}
                      className="text-[#20c58f] focus:ring-[#20c58f]"
                    />
                    {m === 'with_premium' ? 'På premiefakturan' : 'Egna fakturor, en per avtal'}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Läget sitter på kunden och gäller alla kundens avtal.</p>
            </div>
          </div>
        )
      case 'fakturering':
        return (
          <div>
            <H5>Fakturering</H5>
            <ContractPremiumSection
              contract={contract}
              premiumEvents={p.premiumEvents}
              annualInForce={p.annualInForce}
              ink={ink}
              archived={archived}
              mode="settings"
              invoiceMode={p.invoiceMode}
              planEntries={p.planEntries}
              onLinkFortnox={p.onLinkFortnox}
              onSavePremium={p.onSavePremium}
              onAddPremiumEvent={p.onAddPremiumEvent}
              equipmentInvoiceMode={p.equipmentInvoiceMode}
            />
            <div className="mt-4 pt-3 border-t border-slate-700 text-[12px] text-slate-400">
              Faktureras {p.invoiceMode === 'consolidated' ? 'på kundens samlingsfaktura, som egen rad' : 'på egen faktura'}. Samlingsfakturan styrs av gemet ovanför pappren.
            </div>
          </div>
        )
      case 'referenser':
        return (
          <div>
            <H5>Referenser</H5>
            <ContractReferencesSection
              contract={contract}
              coveredLocations={p.coveredLocations}
              ink={ink}
              archived={archived}
              mode="settings"
              onSaveInvoiceReference={p.onSaveInvoiceReference}
              onSaveUnitReference={p.onSaveUnitReference}
            />
          </div>
        )
      case 'loptid':
        return (
          <div>
            <H5>Löptid och option</H5>
            <ContractTermSection
              contract={contract}
              ink={ink}
              archived={archived}
              mode="settings"
              onSaveTerm={p.onSaveTerm}
              onSaveRenewal={p.onSaveRenewal}
              onExerciseOption={p.onExerciseOption}
              onTerminate={p.onTerminate}
              onReactivate={p.onReactivate}
              onDelete={p.onDelete}
            />
          </div>
        )
    }
  }

  const renderPuls = () => {
    const tone = b ? (b.labour_missing ? 'bad' : marginTone(b.headline_percent, settings)) : 'none'
    return (
      <div className="p-4 grid gap-2.5">
        <Kpi
          title="Nästa faktura"
          value={ps.paused ? (ps.pausedUntil ? `pausad till ${ps.pausedUntil}` : 'pausad') : ps.nextLabel ? formatDateSv(ps.nextLabel.date) : 'ingen planerad'}
          sub={
            ps.nextLabel ? (
              <>
                {ps.nextLabel.text}
                {ps.nextEquipment && (
                  <>
                    <br />
                    Tillägg {formatDateSv(ps.nextEquipment.periodStart)} · {formatKr(ps.nextEquipment.subtotal)}
                    {ps.nextEquipment.kind === 'equipment_monthly' ? '/mån' : '/år'}
                  </>
                )}
              </>
            ) : ps.frequencyLabel ? (
              `${ps.frequencyLabel} · ${BILLING_FREQUENCY_LABEL[contract.billing_frequency ?? ''] ? '' : ''}`
            ) : (
              'Sätt frekvens under Fakturering'
            )
          }
        />
        <Kpi
          title="Besök"
          value={
            <>
              {p.followup.visitsDone} <small className="font-sans text-[12px] font-normal text-slate-400">utförda</small>
              {p.followup.visitsBooked > 0 && (
                <>
                  {' '}· {p.followup.visitsBooked} <small className="font-sans text-[12px] font-normal text-slate-400">bokade</small>
                </>
              )}
            </>
          }
          sub={
            <>
              {p.followup.nextVisit ? (
                <>
                  Nästa <b className="text-white font-medium">{formatDateSv(p.followup.nextVisit.scheduled_at)}</b> · {customerRowName(p.customerById.get(p.followup.nextVisit.customer_id) ?? p.root)}
                </>
              ) : (
                'Inget bokat'
              )}
              {' · '}
              <button type="button" onClick={() => p.onOpenHistory('besok')} className="text-[#20c58f] underline decoration-dotted">
                historik
              </button>
            </>
          }
        />
        <Kpi
          title="Ärenden"
          value={
            <>
              {p.followup.casesDone} <small className="font-sans text-[12px] font-normal text-slate-400">utförda</small>
              {p.followup.casesOpen > 0 && (
                <>
                  {' '}· <span className="text-amber-400">{p.followup.casesOpen}</span> <small className="font-sans text-[12px] font-normal text-slate-400">öppna</small>
                </>
              )}
            </>
          }
          sub={
            <button type="button" onClick={() => p.onOpenHistory('arenden')} className="text-[#20c58f] underline decoration-dotted">
              visa ärenden
            </button>
          }
        />
        {b && (
          <Kpi
            title={b.headline_label}
            tone={b.labour_missing ? 'warn' : undefined}
            value={
              b.labour_missing ? (
                'Arbetstid saknas'
              ) : (
                <span className={toneTextClass(tone)}>{b.headline_percent != null ? `${b.headline_percent.toFixed(1)} %` : '–'}</span>
              )
            }
          >
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11.5px] mt-2">
              <dt className="text-slate-500">Avtalsvärde per år</dt>
              <dd className="font-mono tabular-nums text-slate-200 text-right">{formatKr(b.revenue)}</dd>
              <dt className="text-slate-500">Löpande kostnad</dt>
              <dd className="font-mono tabular-nums text-slate-200 text-right">−{formatKr(b.cost_ongoing)}</dd>
              <dt className="text-slate-500">Täckningsbidrag per år</dt>
              <dd className="font-mono tabular-nums text-white text-right">{formatKr(b.contribution_ongoing)}</dd>
              {b.cost_durable > 0 && (
                <>
                  <dt className="text-slate-500">Varaktig utrustning, engångs</dt>
                  <dd className="font-mono tabular-nums text-slate-200 text-right">−{formatKr(b.cost_durable)}</dd>
                  <dt className="text-slate-500">Återbetald efter</dt>
                  <dd className={`font-mono tabular-nums text-right ${paybackTone(b, settings) === 'bad' ? 'text-red-300' : 'text-slate-200'}`}>
                    {b.payback_never ? 'aldrig med nuvarande kostnad' : formatPayback(b.payback_years)}
                  </dd>
                  <dt className="text-slate-500">Marginal år 1</dt>
                  <dd className="font-mono tabular-nums text-slate-400 text-right">{b.margin_percent_year1 != null ? `${b.margin_percent_year1.toFixed(1)} %` : '–'}</dd>
                  {b.margin_percent_3y != null && (
                    <>
                      <dt className="text-slate-500">Över tre år</dt>
                      <dd className="font-mono tabular-nums text-slate-400 text-right">{b.margin_percent_3y.toFixed(1)} %</dd>
                    </>
                  )}
                </>
              )}
            </dl>
          </Kpi>
        )}
        <Kpi
          title="Stationer"
          value={
            p.stationCount && p.stationCount.outdoor + p.stationCount.indoor > 0 ? (
              <>
                {p.stationCount.outdoor + p.stationCount.indoor} <small className="font-sans text-[12px] font-normal text-slate-400">utplacerade</small>
              </>
            ) : (
              'inga'
            )
          }
          sub={
            p.stationCount ? (
              <>
                {p.stationCount.outdoor} ute · {p.stationCount.indoor} inne
                {p.stationCount.addon > 0 ? ` · ${p.stationCount.addon} tillägg` : ''}
                {p.bricks.length > 0 ? ` · ${p.bricks.reduce((s, x) => s + x.count, 0)} väntar på beslut` : ''}
              </>
            ) : undefined
          }
        />
        {(completeness.missing.length > 0 || completeness.warnings.length > 0) && (
          <Kpi title={`Att åtgärda · ${completeness.missing.length + completeness.warnings.length}`}>
            <ul className="mt-1.5 space-y-1 text-[12px]">
              {[...completeness.missing, ...completeness.warnings].map((item) => (
                <li key={item.key} className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${item.vital ? 'bg-amber-400' : 'bg-slate-500'}`} />
                  <button
                    type="button"
                    onClick={() => {
                      p.onChangeGroup(item.group)
                      p.onChangeTab('settings')
                    }}
                    className="text-left text-slate-200 hover:text-[#20c58f]"
                  >
                    {item.label} <span className="text-slate-500">({item.paragraph})</span>
                  </button>
                </li>
              ))}
            </ul>
          </Kpi>
        )}
        {p.planEntries.length > 0 && (
          <Kpi title="Fakturaplan">
            <ul className="mt-1.5 space-y-1 text-[11.5px]">
              {p.planEntries
                .filter((e) => e.action !== 'delete')
                .slice(0, 8)
                .map((e) => (
                  <li key={`${e.kind ?? 'premium'}|${e.periodStart}`} className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-slate-300">
                      {formatDateSv(e.periodStart)} till {formatDateSv(e.periodEnd)}
                    </span>
                    <span className="text-slate-500">{e.kind === 'equipment' || e.kind === 'equipment_monthly' ? 'tillägg' : ''}</span>
                    <span className="ml-auto font-mono tabular-nums text-slate-200">{formatKr(e.subtotal)}</span>
                    {e.action === 'uncovered' ? (
                      p.onLinkFortnox && !archived ? (
                        <button
                          type="button"
                          onClick={() => p.onLinkFortnox?.({ periodStart: e.periodStart, periodEnd: e.periodEnd, expectedSubtotal: e.subtotal || null, kind: e.kind })}
                          className="text-[11px] text-amber-400 underline decoration-dotted"
                        >
                          koppla Fortnox
                        </button>
                      ) : (
                        <span className="text-[11px] text-amber-400">saknar faktura</span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {e.existingStatus === 'paid' ? 'betald' : e.existingStatus ? e.existingStatus : 'planerad'}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </Kpi>
        )}
        {tw.decisionDate && !archived && (
          <Kpi
            title={tw.decisionKind}
            tone={tw.urgent ? 'warn' : undefined}
            value={tw.daysLeft !== null ? (tw.daysLeft < 0 ? 'passerat' : tw.daysLeft === 0 ? 'i dag' : `${tw.daysLeft} dagar`) : formatDateSv(tw.decisionDate)}
            sub={
              <>
                {formatDateSv(tw.decisionDate)}
                {tw.remindDate ? ` · påminnelse ${formatDateSv(tw.remindDate)}` : ''}
              </>
            }
          />
        )}
      </div>
    )
  }

  // Slide-over vid skärmens högerkant, utanför gridet: pappret behåller sin
  // bredd och sidans max-width rörs inte. Ingen dimmad bakgrund, pappret ska
  // gå att läsa och dra brickor till medan panelen är öppen. Portal mot body
  // så ingen förälder med transform kan ankra den fel.
  return createPortal(
    <aside
      className="fixed inset-y-0 right-0 z-40 w-[480px] max-w-[92vw] flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl overflow-hidden"
      aria-label="Inställningar och puls för avtalet"
    >
      <div className="flex items-center border-b border-slate-700">
        {(['settings', 'puls'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => p.onChangeTab(t)}
            className={`flex-1 py-2.5 text-[12px] border-b-2 transition-colors ${
              tab === t ? 'text-white font-semibold border-[#20c58f]' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {t === 'settings' ? 'Inställningar' : 'Puls'}
          </button>
        ))}
        <button type="button" onClick={p.onClose} className="px-3 text-slate-500 hover:text-white" aria-label="Stäng panelen" title="Stäng (Esc)">
          <X className="w-4 h-4" />
        </button>
      </div>

      {tab === 'settings' ? (
        <div className="flex-1 min-h-0 grid grid-cols-[150px_1fr] overflow-hidden">
          <nav className="border-r border-slate-700 py-2 overflow-y-auto">
            <div className="px-3 pb-2 text-[11px] text-slate-500">
              {completeness.vitalOk} av {completeness.vitalTotal} vitala delar
              <div className="h-[3px] bg-slate-800 rounded mt-1 overflow-hidden">
                <i className="block h-full bg-[#20c58f]" style={{ width: `${completeness.percent}%` }} />
              </div>
            </div>
            {SETTINGS_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => p.onChangeGroup(g)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
                  group === g ? 'text-white font-semibold bg-slate-800 shadow-[inset_2px_0_0_#20c58f]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[completeness.groupStatus[g]]}`} />
                {SETTINGS_GROUP_LABEL[g]}
              </button>
            ))}
          </nav>
          <div className="min-h-0 overflow-y-auto">
            <div className="p-4 text-[12.5px] text-slate-300">{renderGroup()}</div>
            {nextStep && !archived && (
              <div className="mx-4 mb-4 rounded-lg border border-[#20c58f]/35 bg-[#20c58f]/5 px-3.5 py-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#20c58f]">
                  Nästa steg · {completeness.vitalOk} av {completeness.vitalTotal}
                </div>
                <div className="text-[13px] font-semibold text-white mt-1">{nextStep.label}</div>
                <div className="text-[12px] text-slate-400 mt-0.5">{nextStep.hint}</div>
                {nextStep.group !== group && (
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={() => p.onChangeGroup(nextStep.group)} className="text-[12px] px-3 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold hover:brightness-110">
                      Öppna
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">{renderPuls()}</div>
      )}
    </aside>,
    document.body
  )
}
