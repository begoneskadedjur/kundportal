// src/components/admin/customers/BillingSettingsModal.tsx
// Faktureringsinställningar per kund – artiklar, antal, fast avtalsvärde, premiejustering

import { useState, useEffect, useId } from 'react'
import {
  Receipt, Save, Building2, Copy, TrendingUp, Plus,
  Trash2, Package, CalendarDays, FileSignature
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { PriceListService } from '../../../services/priceListService'
import ContractCaseServiceSelector from './ContractCaseServiceSelector'
import { type PriceList } from '../../../types/articles'
import { type BillingFrequency, BILLING_FREQUENCY_CONFIG, type AdhocInvoiceGrouping } from '../../../types/contractBilling'
import toast from 'react-hot-toast'
import { ContractInvoiceGenerator, type BillingPlan } from '../../../services/contractInvoiceGenerator'
import BillingPlanPreviewModal from './BillingPlanPreviewModal'

interface SiteBillingData {
  id: string
  site_name: string
  billing_email: string
  billing_address: string
}

interface BillingSettingsModalProps {
  customerId: string | null
  customerName: string
  contactEmail: string
  isMultisite: boolean
  currentBillingFrequency: BillingFrequency | null
  currentPriceListId: string | null
  currentBillingEmail: string | null
  currentBillingAddress: string | null
  currentBillingType: 'consolidated' | 'per_site' | null
  currentBillingReference: string | null
  currentCostCenter: string | null
  currentBillingRecipient: string | null
  currentPriceAdjustmentPercent?: number | null
  currentBillingActive?: boolean
  currentContractStartDate?: string | null
  currentContractEndDate?: string | null
  currentBillingAnchorMonth?: number | null
  currentAdhocInvoiceGrouping?: AdhocInvoiceGrouping | null
  sites: Array<{
    id: string
    site_name?: string | null
    company_name?: string
    billing_email?: string | null
    billing_address?: string | null
  }>
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

export default function BillingSettingsModal({
  customerId,
  customerName,
  contactEmail,
  isMultisite,
  currentBillingFrequency,
  currentPriceListId,
  currentBillingEmail,
  currentBillingAddress,
  currentBillingType,
  currentBillingReference,
  currentCostCenter,
  currentBillingRecipient,
  currentPriceAdjustmentPercent,
  currentBillingActive,
  currentContractStartDate,
  currentContractEndDate,
  currentBillingAnchorMonth,
  currentAdhocInvoiceGrouping,
  sites,
  isOpen,
  onClose,
  onSave,
}: BillingSettingsModalProps) {
  const uid = useId()
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [priceLists, setPriceLists] = useState<PriceList[]>([])

  // "Fast avtalsvärde" – override för hela årsbeloppet
  const [fixedContractValue, setFixedContractValue] = useState('')

  // Avtalsinfo
  const [billingActive, setBillingActive] = useState(false)
  const [contractStartDate, setContractStartDate] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [billingAnchorMonth, setBillingAnchorMonth] = useState<number | null>(null)

  // Premiejusteringshistorik
  const [priceAdjustments, setPriceAdjustments] = useState<Array<{ year: number; adjustment_percent: number; note: string }>>([])
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)

  // Avtalstjänster från signerat kontrakt (case_billing_items)
  type ContractService = {
    id: string
    service_name: string
    quantity: number
    total_price: number
    articles: Array<{ article_name: string; quantity: number; unit_price: number }>
  }
  const [contractServices, setContractServices] = useState<ContractService[]>([])
  // True om kunden har ett "riktigt" Oneflow-signerat kontrakt (läs-only).
  // False = ingen contracts-rad, eller bara importerad container → rendera editor.
  const [hasOneflowContract, setHasOneflowContract] = useState(false)
  const [contractReloadTick, setContractReloadTick] = useState(0)
  // Summa av tjänsterader från CaseServiceSelector (exkl. moms).
  // Används som "beräknat årsbelopp" och placeholder för Fast avtalsvärde.
  const [contractServicesTotal, setContractServicesTotal] = useState(0)

  // Billing form state
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly')
  const [priceListId, setPriceListId] = useState<string | null>(null)
  const [billingEmail, setBillingEmail] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingType, setBillingType] = useState<'consolidated' | 'per_site'>('consolidated')
  const [billingReference, setBillingReference] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [billingRecipient, setBillingRecipient] = useState('')
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState('')
  const [adhocInvoiceGrouping, setAdhocInvoiceGrouping] = useState<AdhocInvoiceGrouping>('per_case')
  const [siteBilling, setSiteBilling] = useState<SiteBillingData[]>([])

  // Init form
  useEffect(() => {
    if (!isOpen || !customerId) return
    setBillingFrequency(currentBillingFrequency || 'yearly')
    setPriceListId(currentPriceListId || null)
    setBillingEmail(currentBillingEmail || '')
    setBillingAddress(currentBillingAddress || '')
    setBillingType(currentBillingType || 'consolidated')
    setBillingReference(currentBillingReference || '')
    setCostCenter(currentCostCenter || '')
    setBillingRecipient(currentBillingRecipient || '')
    setPriceAdjustmentPercent(currentPriceAdjustmentPercent != null ? String(currentPriceAdjustmentPercent) : '')
    setAdhocInvoiceGrouping(currentAdhocInvoiceGrouping || 'per_case')
    setBillingActive(currentBillingActive ?? true)
    setContractStartDate(currentContractStartDate || '')
    setContractEndDate(currentContractEndDate || '')
    // Ankarmånad: använd sparad, eller härled från avtalsstartdatum, eller nuvarande månad
    if (currentBillingAnchorMonth != null) {
      setBillingAnchorMonth(currentBillingAnchorMonth)
    } else if (currentContractStartDate) {
      setBillingAnchorMonth(new Date(currentContractStartDate).getMonth() + 1)
    } else {
      setBillingAnchorMonth(new Date().getMonth() + 1)
    }
    setSiteBilling(
      sites
        .filter(s => s.id !== customerId)
        .map(s => ({
          id: s.id,
          site_name: s.site_name || s.company_name || 'Okänd enhet',
          billing_email: s.billing_email || '',
          billing_address: s.billing_address || '',
        }))
    )
  }, [isOpen, customerId, currentBillingFrequency, currentPriceListId, currentBillingEmail,
      currentBillingAddress, currentBillingType, currentBillingReference, currentCostCenter,
      currentBillingRecipient, currentPriceAdjustmentPercent, currentAdhocInvoiceGrouping, sites])

  // Load price lists
  useEffect(() => {
    PriceListService.getActivePriceLists().then(setPriceLists).catch(console.error)
  }, [])

  // Default till standardprislistan om kunden saknar sparad prislista
  useEffect(() => {
    if (!isOpen || !customerId) return
    if (currentPriceListId) return // Kunden har egen prislista → rör inte
    PriceListService.getDefaultPriceList()
      .then(pl => { if (pl) setPriceListId(pl.id) })
      .catch(console.error)
  }, [isOpen, customerId, currentPriceListId])

  // Load premiejusteringshistorik
  useEffect(() => {
    if (!isOpen || !customerId) return
    setLoadingAdjustments(true)
    Promise.resolve(
      supabase
        .from('customer_price_adjustments')
        .select('year, adjustment_percent, note')
        .eq('customer_id', customerId)
        .order('year', { ascending: false })
    ).then(({ data }) => {
      setPriceAdjustments((data || []).map(r => ({
        year: r.year,
        adjustment_percent: r.adjustment_percent,
        note: r.note || '',
      })))
    }).finally(() => setLoadingAdjustments(false))
  }, [isOpen, customerId])

  // Ladda kundens nuvarande fasta avtalsvärde (om satt)
  useEffect(() => {
    if (!isOpen || !customerId) return
    setFixedContractValue('')
    supabase.from('customers').select('annual_value').eq('id', customerId).single()
      .then(({ data }) => {
        if (data && (data as any).annual_value) {
          setFixedContractValue(String((data as any).annual_value))
        }
      })
  }, [isOpen, customerId])

  // Hämta avtalstjänster + interna artiklar från kundens signerade kontrakt (case_billing_items)
  useEffect(() => {
    if (!isOpen || !customerId) {
      setContractServices([])
      setHasOneflowContract(false)
      return
    }
    ;(async () => {
      try {
        const { data: contracts } = await supabase
          .from('contracts')
          .select('id, oneflow_contract_id')
          .eq('customer_id', customerId)
          .in('status', ['signed', 'active'])

        if (!contracts?.length) {
          setContractServices([])
          setHasOneflowContract(false)
          return
        }
        // "Riktigt" Oneflow = oneflow_contract_id som INTE börjar med 'imported-'
        const oneflowContracts = contracts.filter(
          (c: any) => c.oneflow_contract_id && !String(c.oneflow_contract_id).startsWith('imported-')
        )
        setHasOneflowContract(oneflowContracts.length > 0)
        const contractIds = contracts.map((c: any) => c.id)

        const { data: items } = await supabase
          .from('case_billing_items')
          .select('id, item_type, service_name, article_name, quantity, unit_price, total_price, mapped_service_id')
          .in('case_id', contractIds)
          .eq('case_type', 'contract')

        if (!items) {
          setContractServices([])
          return
        }
        const services: ContractService[] = items
          .filter((i: any) => i.item_type === 'service')
          .map((s: any) => ({
            id: s.id,
            service_name: s.service_name || 'Okänd tjänst',
            quantity: s.quantity,
            total_price: s.total_price,
            articles: items
              .filter((a: any) => a.item_type === 'article' && a.mapped_service_id === s.id)
              .map((a: any) => ({
                article_name: a.article_name,
                quantity: a.quantity,
                unit_price: a.unit_price,
              })),
          }))
        setContractServices(services)
        setContractServicesTotal(services.reduce((s, v) => s + (v.total_price || 0), 0))
      } catch (err) {
        console.error('Kunde inte hämta avtalstjänster:', err)
        setContractServices([])
        setContractServicesTotal(0)
      }
    })()
  }, [isOpen, customerId, contractReloadTick])

  // Summering
  const adjustPct = priceAdjustmentPercent !== '' ? parseFloat(priceAdjustmentPercent) || 0 : 0
  const hasAdjustment = adjustPct !== 0
  // Beräknat årsbelopp = summan av tjänsterader i CaseServiceSelector
  // (samma logik som wizarden/EditCaseModal). För Oneflow-kunder kommer
  // värdet från read-only-listan, för importerade från wrapperns onChange.
  const calculatedTotal = contractServicesTotal
  const fixedVal = fixedContractValue !== '' ? parseFloat(fixedContractValue) || 0 : null
  const baseTotal = fixedVal != null ? fixedVal : calculatedTotal
  const adjustedTotal = hasAdjustment ? Math.round(baseTotal * (1 + adjustPct / 100)) : baseTotal
  const freqMonths = BILLING_FREQUENCY_CONFIG[billingFrequency]?.months ?? 1
  const perPeriodAdj = freqMonths > 0 && freqMonths !== 12 ? Math.round(adjustedTotal * freqMonths / 12) : adjustedTotal

  // Fakturaschema – beräkna nästa fakturadatum baserat på ankarmånad + frekvens
  const billingSchedule: Date[] = []
  if (billingAnchorMonth != null && freqMonths > 0 && billingFrequency !== 'on_demand') {
    const today = new Date()
    let year = today.getFullYear()
    let m = billingAnchorMonth - 1 // 0-indexed
    // Backa till rätt start inom innevarande år
    while (m > today.getMonth()) m -= freqMonths
    while (m < 0) { m += 12; year-- }
    // Framåt tills vi har 4 kommande datum (eller 2 för årsvis/halvårsvis)
    const wantCount = freqMonths >= 6 ? 2 : 4
    let safety = 0
    while (billingSchedule.length < wantCount && safety < 30) {
      const d = new Date(year, m, 1)
      if (d >= new Date(today.getFullYear(), today.getMonth(), 1)) {
        billingSchedule.push(d)
      }
      m += freqMonths
      if (m >= 12) { m -= 12; year++ }
      safety++
    }
  }

  const MONTHS_SV = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

  const handleSiteBillingChange = (siteId: string, field: 'billing_email' | 'billing_address', value: string) => {
    setSiteBilling(prev => prev.map(s => s.id === siteId ? { ...s, [field]: value } : s))
  }

  const copyFromMain = (siteId: string) => {
    setSiteBilling(prev => prev.map(s => s.id === siteId ? { ...s, billing_email: billingEmail, billing_address: billingAddress } : s))
  }

  const handleSave = async () => {
    if (!customerId) return
    setSaving(true)
    try {
      // Avtalsinnehåll (tjänster + interna artiklar) sparas direkt av
      // CaseServiceSelector → case_billing_items. Här sparar vi bara
      // kundens övergripande fakturerings- och avtalsinställningar.

      // Beräkna annual_value: fast avtalsvärde om satt, annars beräknat från tjänsterader
      const annualValue = adjustedTotal > 0 ? adjustedTotal : null
      const monthlyValue = annualValue ? Math.round(annualValue / 12) : null

      // Spara kundinställningar
      const { error } = await supabase
        .from('customers')
        .update({
          billing_frequency: billingFrequency,
          price_list_id: priceListId,
          billing_email: billingEmail || null,
          billing_address: billingAddress || null,
          billing_type: isMultisite ? billingType : null,
          billing_reference: billingReference || null,
          cost_center: costCenter || null,
          billing_recipient: billingRecipient || null,
          price_adjustment_percent: priceAdjustmentPercent !== '' ? parseFloat(priceAdjustmentPercent) : null,
          annual_value: annualValue,
          monthly_value: monthlyValue,
          contract_start_date: contractStartDate || null,
          contract_end_date: contractEndDate || null,
          billing_anchor_month: billingAnchorMonth,
          billing_active: billingActive,
          adhoc_invoice_grouping: adhocInvoiceGrouping,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)

      if (error) throw error

      // 4. Spara premiejusteringshistorik (upsert per år)
      if (priceAdjustments.length > 0) {
        const rows = priceAdjustments.map(a => ({
          customer_id: customerId,
          year: a.year,
          adjustment_percent: a.adjustment_percent,
          note: a.note || null,
        }))
        const { error: adjError } = await supabase
          .from('customer_price_adjustments')
          .upsert(rows, { onConflict: 'customer_id,year' })
        if (adjError) throw adjError
      }

      // 5. Per-site
      if (isMultisite && billingType === 'per_site') {
        for (const site of siteBilling) {
          const { error: se } = await supabase
            .from('customers')
            .update({
              billing_email: site.billing_email || null,
              billing_address: site.billing_address || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', site.id)
          if (se) throw se
        }
      }

      toast.success('Faktureringsinställningar sparade!')

      // Beräkna ev. fakturaplan-diff efter sparade inställningar
      try {
        setPlanLoading(true)
        setPlanOpen(true)
        const newPlan = await ContractInvoiceGenerator.planForCustomer(customerId)
        setPlan(newPlan)
        const hasChanges = (newPlan.summary.create + newPlan.summary.update + newPlan.summary.delete) > 0
        if (!hasChanges) {
          setPlanOpen(false)
          setPlan(null)
          onSave()
          onClose()
        }
      } catch (planErr: any) {
        console.error('Plan error:', planErr)
        setPlanOpen(false)
        toast.error('Kunde inte beräkna fakturaplan: ' + planErr.message)
        onSave()
        onClose()
      } finally {
        setPlanLoading(false)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Kunde inte spara: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmPlan = async () => {
    if (!plan) return
    try {
      const result = await ContractInvoiceGenerator.apply(plan)
      toast.success(
        `Plan applicerad: ${result.createdIds.length} nya, ${result.updatedIds.length} uppdaterade, ${result.deletedIds.length} raderade`
      )
      setPlanOpen(false)
      setPlan(null)
      onSave()
      onClose()
    } catch (err: any) {
      toast.error('Kunde inte applicera plan: ' + err.message)
    }
  }

  const handleCancelPlan = () => {
    setPlanOpen(false)
    setPlan(null)
    onSave()
    onClose()
  }

  if (!isOpen || !customerId) return null

  const sel = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#20c58f]/10 rounded-full flex items-center justify-center">
              <Receipt className="w-4 h-4 text-[#20c58f]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-white truncate">Faktureringsinställningar</h2>
              <p className="text-slate-400 text-xs truncate">{customerName}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">

          {/* ── Avtal ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-[#20c58f]" />Avtal
              </h3>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={billingActive}
                  onChange={e => setBillingActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <span className="text-xs font-medium text-slate-300">Ska faktureras</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Avtalets startdatum</label>
                <input type="text" value={contractStartDate} placeholder="ÅÅÅÅ-MM-DD" pattern="\d{4}-\d{2}-\d{2}" onChange={e => {
                  setContractStartDate(e.target.value)
                  if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && billingAnchorMonth === null) {
                    setBillingAnchorMonth(new Date(e.target.value).getMonth() + 1)
                  }
                }} className={sel} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Avtalets slutdatum</label>
                <input type="text" value={contractEndDate} placeholder="ÅÅÅÅ-MM-DD" pattern="\d{4}-\d{2}-\d{2}" onChange={e => setContractEndDate(e.target.value)} className={sel} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fakturamånad (ankarmånad)</label>
              <Select
                value={billingAnchorMonth != null ? String(billingAnchorMonth) : ''}
                onChange={(v) => setBillingAnchorMonth(v ? parseInt(v) : null)}
                placeholder="Ej angiven"
                options={[
                  { value: '', label: 'Ej angiven' },
                  ...MONTHS_SV.map((m, i) => ({
                    value: String(i + 1),
                    label: m.charAt(0).toUpperCase() + m.slice(1),
                  })),
                ]}
              />
              <p className="text-xs text-slate-500 mt-1">Månaden avtalet ingicks – fakturor läggs i denna månad + intervall</p>
            </div>

            {/* Fakturaschema */}
            {billingSchedule.length > 0 && (
              <div className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarDays className="w-3.5 h-3.5 text-[#20c58f]" />
                  <span className="text-xs font-medium text-slate-300">Fakturaschema</span>
                  <span className="text-xs text-slate-500">· {BILLING_FREQUENCY_CONFIG[billingFrequency]?.label.toLowerCase()}, fakturamånad: {billingAnchorMonth ? MONTHS_SV[billingAnchorMonth - 1] : '–'}</span>
                </div>
                <div className="space-y-1">
                  {billingSchedule.map((d, i) => {
                    const isFirst = i === 0
                    const label = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
                    const amount = freqMonths > 0 ? Math.round(adjustedTotal * freqMonths / 12) : adjustedTotal
                    return (
                      <div key={i} className={`flex items-center justify-between text-xs ${isFirst ? 'text-white' : 'text-slate-400'}`}>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${isFirst ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />
                          <span className={isFirst ? 'font-medium' : ''}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
                          {isFirst && <span className="px-1 py-0.5 text-[10px] bg-[#20c58f]/20 text-[#20c58f] rounded">Nästa</span>}
                        </div>
                        {adjustedTotal > 0 && <span className={isFirst ? 'font-semibold text-white' : ''}>{fmt(amount)}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {billingAnchorMonth != null && billingFrequency !== 'on_demand' && billingSchedule.length === 0 && (
              <p className="text-xs text-slate-500">Inga kommande fakturadatum beräknade.</p>
            )}
          </div>

          {/* ── Fakturering ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#20c58f]" />Fakturering
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Faktureringsfrekvens</label>
                <Select
                  value={billingFrequency}
                  onChange={(v) => setBillingFrequency(v as BillingFrequency)}
                  options={Object.entries(BILLING_FREQUENCY_CONFIG).map(([k, c]) => ({
                    value: k,
                    label: c.label,
                  }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Artikelkatalog (prislista)</label>
                <Select
                  value={priceListId || ''}
                  onChange={(v) => setPriceListId(v || null)}
                  placeholder="Ingen prislista"
                  options={[
                    { value: '', label: 'Ingen prislista' },
                    ...priceLists.map(pl => ({
                      value: pl.id,
                      label: `${pl.name}${pl.is_default ? ' (Standard)' : ''}`,
                    })),
                  ]}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Merförsäljning från ärenden</label>
              <Select
                value={adhocInvoiceGrouping}
                onChange={(v) => setAdhocInvoiceGrouping((v as AdhocInvoiceGrouping) || 'per_case')}
                options={[
                  { value: 'per_case', label: 'En faktura per ärende' },
                  { value: 'monthly_batch', label: 'Slå ihop per månad' },
                ]}
              />
              <p className="text-xs text-slate-500 mt-1">
                Styr hur avslutade avtalsärenden faktureras utanför årspremien (fliken "Merförsäljning Avtal").
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input label="Faktura-email" type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="faktura@example.com" />
                {billingEmail && billingEmail !== contactEmail && (
                  <p className="text-xs text-yellow-400 mt-1">Skiljer sig från kontakt-email</p>
                )}
              </div>
              <Input label="Fakturaadress" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Gatuadress, Postnr Ort" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Er referens" value={billingReference} onChange={e => setBillingReference(e.target.value)} placeholder="PO-nummer / referens" />
              <Input label="Kostnadsställe" value={costCenter} onChange={e => setCostCenter(e.target.value)} placeholder="T.ex. 4010" />
              <Input label="Fakturamottagare" value={billingRecipient} onChange={e => setBillingRecipient(e.target.value)} placeholder="Mottagarens namn" />
            </div>
          </div>

          {/* ── Avtalsinnehåll — identiskt med wizard-steg 7 / EditCaseModal ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#20c58f]" />
              Avtalsinnehåll
            </h3>

            {hasOneflowContract ? (
              contractServices.length > 0 ? (
                <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileSignature className="w-4 h-4 text-[#20c58f]" />
                    <h4 className="text-sm font-semibold text-white">Ingår i avtalet</h4>
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#20c58f]/20 text-[#20c58f]">
                      {contractServices.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {contractServices.map(s => (
                      <div key={s.id} className="px-3 py-2 bg-slate-800/40 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {s.service_name} × {s.quantity}
                          </span>
                          <span className="text-sm text-[#20c58f] font-medium">
                            {fmt(s.total_price)}
                          </span>
                        </div>
                        {s.articles.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 text-xs text-slate-400">
                            {s.articles.map((a, i) => (
                              <li key={i}>• {a.article_name} × {a.quantity}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">
                  Kontraktet är signerat men saknar registrerade tjänster.
                </p>
              )
            ) : (
              customerId && (
                <ContractCaseServiceSelector
                  customerId={customerId}
                  onChange={subtotal => {
                    setContractServicesTotal(subtotal)
                    setContractReloadTick(t => t + 1)
                  }}
                />
              )
            )}
          </div>

          {/* ── Prissättning ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-slate-400" />Prissättning
            </h3>

            {/* Fast avtalsvärde */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fast avtalsvärde/år (kr)</label>
              <input
                type="number"
                value={fixedContractValue}
                onChange={e => setFixedContractValue(e.target.value)}
                placeholder={calculatedTotal > 0 ? String(calculatedTotal) : '0'}
                min="0"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                {calculatedTotal > 0 ? (
                  <>
                    Beräknat från tjänsterader: <span className="text-slate-300 font-medium">{fmt(calculatedTotal)}</span>
                    {fixedVal == null && ' — används som årsbelopp'}
                  </>
                ) : (
                  'Lämna tomt = beräknas från tjänsterader'
                )}
              </p>
              {hasAdjustment && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Efter justering ({adjustPct > 0 ? '+' : ''}{adjustPct}%): <span className="text-emerald-400 font-medium">{fmt(adjustedTotal)}</span>
                  {freqMonths > 0 && freqMonths !== 12 && (
                    <> — {fmt(perPeriodAdj)} per faktura ({BILLING_FREQUENCY_CONFIG[billingFrequency]?.label.toLowerCase()})</>
                  )}
                </p>
              )}
              {!hasAdjustment && freqMonths > 0 && freqMonths !== 12 && adjustedTotal > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Per faktura ({BILLING_FREQUENCY_CONFIG[billingFrequency]?.label.toLowerCase()}): <span className="text-slate-300 font-medium">{fmt(perPeriodAdj)}</span>
                </p>
              )}
            </div>

            {/* Premiejusteringshistorik */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Premiejusteringar per år</label>
                <button
                  type="button"
                  onClick={() => {
                    const currentYear = new Date().getFullYear()
                    const exists = priceAdjustments.some(a => a.year === currentYear)
                    if (!exists) {
                      setPriceAdjustments(prev => [{ year: currentYear, adjustment_percent: 0, note: '' }, ...prev])
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#1bb07e] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />Lägg till år
                </button>
              </div>

              {loadingAdjustments ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2"><LoadingSpinner />Laddar...</div>
              ) : priceAdjustments.length === 0 ? (
                <p className="text-xs text-slate-600 py-1">Ingen historik ännu – lägg till ett år ovan.</p>
              ) : (
                <div className="space-y-1.5">
                  {priceAdjustments.map((adj, i) => (
                    <div key={adj.year} className="flex items-center gap-2 p-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                      <span className="text-xs font-mono text-slate-300 w-10 shrink-0">{adj.year}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={adj.adjustment_percent}
                          step="0.01"
                          onChange={e => setPriceAdjustments(prev => prev.map((a, j) => j === i ? { ...a, adjustment_percent: parseFloat(e.target.value) || 0 } : a))}
                          className="w-16 px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <input
                        type="text"
                        value={adj.note}
                        placeholder="Anteckning (valfritt)"
                        onChange={e => setPriceAdjustments(prev => prev.map((a, j) => j === i ? { ...a, note: e.target.value } : a))}
                        className="flex-1 px-2 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                      />
                      {adj.adjustment_percent !== 0 && baseTotal > 0 && (
                        <span className="text-xs text-emerald-400 shrink-0">
                          {fmt(Math.round(baseTotal * (1 + adj.adjustment_percent / 100)))}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPriceAdjustments(prev => prev.filter((_, j) => j !== i))}
                        className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Aktuell justering (används vid fakturering) */}
            {hasAdjustment && baseTotal > 0 && (
              <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <span className="text-xs text-emerald-400 font-medium">{fmt(baseTotal)} → {fmt(adjustedTotal)}</span>
                <span className="text-xs text-slate-400">(aktuell justering: {adjustPct > 0 ? '+' : ''}{adjustPct}%)</span>
              </div>
            )}
          </div>

          {/* ── Faktureringssätt (multisite) ── */}
          {isMultisite && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-400" />Faktureringssätt
              </h3>
              <div className="space-y-2">
                {(['consolidated', 'per_site'] as const).map(type => (
                  <label key={type} className="flex items-start gap-3 p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="radio" name={`${uid}-billingType`} value={type} checked={billingType === type} onChange={() => setBillingType(type)}
                      className="mt-0.5 h-4 w-4 text-[#20c58f] focus:ring-[#20c58f]" />
                    <div>
                      <span className="text-sm font-medium text-white">
                        {type === 'consolidated' ? 'Konsoliderad faktura' : 'Faktura per enhet'}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {type === 'consolidated' ? 'En samlad faktura till huvudkontoret.' : 'Varje enhet får sin egen faktura.'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Per-site ── */}
          {isMultisite && billingType === 'per_site' && siteBilling.length > 0 && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Enheternas fakturainställningar</h3>
              <div className="space-y-2">
                {siteBilling.map(site => (
                  <div key={site.id} className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{site.site_name}</span>
                      <button onClick={() => copyFromMain(site.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#20c58f] transition-colors">
                        <Copy className="w-3 h-3" />Kopiera
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Faktura-email</label>
                        <input type="email" value={site.billing_email} onChange={e => handleSiteBillingChange(site.id, 'billing_email', e.target.value)}
                          placeholder="faktura@enhet.se"
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fakturaadress</label>
                        <input type="text" value={site.billing_address} onChange={e => handleSiteBillingChange(site.id, 'billing_address', e.target.value)}
                          placeholder="Gatuadress, Postnr Ort"
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-700/50 flex items-center justify-end gap-3 shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Avbryt</Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? <LoadingSpinner /> : <Save className="w-4 h-4" />}
            Spara
          </Button>
        </div>
      </div>

      <BillingPlanPreviewModal
        isOpen={planOpen}
        plan={plan}
        loading={planLoading}
        onConfirm={handleConfirmPlan}
        onCancel={handleCancelPlan}
      />
    </div>
  )
}
