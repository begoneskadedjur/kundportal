// src/components/admin/customers/BillingSettingsModal.tsx
// Faktureringsinställningar per kund – artiklar, antal, fast avtalsvärde, premiejustering

import { useState, useEffect, useId } from 'react'
import {
  Receipt, Save, Building2, Copy, TrendingUp, Plus, Minus,
  Trash2, Search, Package, ChevronDown, ChevronRight, Clock,
  CalendarDays, FileSignature
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { PriceListService } from '../../../services/priceListService'
import { CustomerContractArticleService } from '../../../services/customerContractArticleService'
import type { PriceListItemWithArticle } from '../../../types/articles'
import {
  ARTICLE_UNIT_CONFIG,
  ARTICLE_CATEGORY_CONFIG,
  type PriceList,
  type ArticleCategory,
} from '../../../types/articles'
import { type BillingFrequency, BILLING_FREQUENCY_CONFIG } from '../../../types/contractBilling'
import toast from 'react-hot-toast'

interface ContractRow {
  tempId: string
  article_id: string
  article_name: string
  article_code: string
  article_unit: string
  article_category: string
  list_price: number
  quantity: number
}

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
  sites,
  isOpen,
  onClose,
  onSave,
}: BillingSettingsModalProps) {
  const uid = useId()
  const [saving, setSaving] = useState(false)
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [catalogItems, setCatalogItems] = useState<PriceListItemWithArticle[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [contractRows, setContractRows] = useState<ContractRow[]>([])
  const [showArticleList, setShowArticleList] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory | 'all'>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

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
  const [siteBilling, setSiteBilling] = useState<SiteBillingData[]>([])

  // Init form
  useEffect(() => {
    if (!isOpen || !customerId) return
    setBillingFrequency(currentBillingFrequency || 'monthly')
    setPriceListId(currentPriceListId || null)
    setBillingEmail(currentBillingEmail || '')
    setBillingAddress(currentBillingAddress || '')
    setBillingType(currentBillingType || 'consolidated')
    setBillingReference(currentBillingReference || '')
    setCostCenter(currentCostCenter || '')
    setBillingRecipient(currentBillingRecipient || '')
    setPriceAdjustmentPercent(currentPriceAdjustmentPercent != null ? String(currentPriceAdjustmentPercent) : '')
    setBillingActive(currentBillingActive ?? false)
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
      currentBillingRecipient, currentPriceAdjustmentPercent, sites])

  // Load price lists
  useEffect(() => {
    PriceListService.getActivePriceLists().then(setPriceLists).catch(console.error)
  }, [])

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

  // Load catalog articles from selected price list
  useEffect(() => {
    if (!priceListId) { setCatalogItems([]); return }
    setLoadingCatalog(true)
    PriceListService.getPriceListItems(priceListId)
      .then(items => setCatalogItems(items.filter(i => i.article?.is_active)))
      .catch(() => setCatalogItems([]))
      .finally(() => setLoadingCatalog(false))
  }, [priceListId])

  // Load existing contract articles
  useEffect(() => {
    if (!isOpen || !customerId) return
    setFixedContractValue('')
    CustomerContractArticleService.getArticles(customerId)
      .then(articles => {
        // fixed_price på första raden = totalt fast avtalsvärde (lagras på kund, inte per artikel)
        // Vi hämtar det från kunden istället
        setContractRows(
          articles.map((ca, i) => ({
            tempId: `existing-${i}-${ca.article_id}`,
            article_id: ca.article_id,
            article_name: ca.article?.name || '',
            article_code: (ca.article as any)?.code || '',
            article_unit: (ca.article as any)?.unit || 'st',
            article_category: (ca.article as any)?.category || 'Övrigt',
            list_price: ca.list_price,
            quantity: ca.quantity,
          }))
        )
        // Hämta fast avtalsvärde från kunden
        if (customerId) {
          supabase.from('customers').select('annual_value').eq('id', customerId).single()
            .then(({ data }) => {
              if (data && (data as any).annual_value) {
                setFixedContractValue(String((data as any).annual_value))
              }
            })
        }
      })
      .catch(console.error)
  }, [isOpen, customerId])

  // Summering
  const adjustPct = priceAdjustmentPercent !== '' ? parseFloat(priceAdjustmentPercent) || 0 : 0
  const hasAdjustment = adjustPct !== 0
  const calculatedTotal = contractRows.reduce((s, r) => s + r.list_price * r.quantity, 0)
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

  // Katalog: gruppera per kategori
  const usedArticleIds = new Set(contractRows.map(r => r.article_id))
  const filteredCatalog = catalogItems.filter(item => {
    const matchSearch = !searchTerm ||
      item.article?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.article as any)?.code?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchCat = categoryFilter === 'all' || item.article?.category === categoryFilter
    return matchSearch && matchCat
  })
  const articlesByCategory = filteredCatalog.reduce((acc, item) => {
    const cat = (item.article?.category || 'Övrigt') as ArticleCategory
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<ArticleCategory, PriceListItemWithArticle[]>)

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const addArticle = (item: PriceListItemWithArticle) => {
    if (usedArticleIds.has(item.article_id)) return
    setContractRows(prev => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${item.article_id}`,
        article_id: item.article_id,
        article_name: item.article?.name || '',
        article_code: (item.article as any)?.code || '',
        article_unit: item.article?.unit || 'st',
        article_category: item.article?.category || 'Övrigt',
        list_price: item.custom_price,
        quantity: 1,
      },
    ])
  }

  const removeRow = (tempId: string) => {
    setContractRows(prev => prev.filter(r => r.tempId !== tempId))
  }

  const updateQty = (tempId: string, delta: number) => {
    setContractRows(prev => prev.map(r => {
      if (r.tempId !== tempId) return r
      const newQty = Math.max(1, r.quantity + delta)
      return { ...r, quantity: newQty }
    }))
  }

  const setQtyDirect = (tempId: string, val: string) => {
    const n = parseInt(val) || 1
    setContractRows(prev => prev.map(r => r.tempId === tempId ? { ...r, quantity: Math.max(1, n) } : r))
  }

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
      // 1. Spara avtalsartiklar (fixed_price=null, avtalsvärde lagras separat på kunden)
      await CustomerContractArticleService.saveArticles(
        customerId,
        contractRows.map((r, i) => ({
          customer_id: customerId,
          article_id: r.article_id,
          quantity: r.quantity,
          fixed_price: null,
          sort_order: i,
        }))
      )

      // 2. Beräkna annual_value: fast avtalsvärde om satt, annars beräknat från artiklar
      const annualValue = adjustedTotal > 0 ? adjustedTotal : null
      const monthlyValue = annualValue ? Math.round(annualValue / 12) : null

      // 3. Spara kundinställningar
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
      onSave()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Kunde inte spara: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !customerId) return null

  const sel = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none'
  const allCategories = Object.keys(articlesByCategory) as ArticleCategory[]

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

          {/* ── Avtalsinnehåll ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#20c58f]" />
                Produkter &amp; tjänster
                {contractRows.length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#20c58f]/20 text-[#20c58f]">{contractRows.length}</span>
                )}
              </h3>
              {priceListId && (
                <button
                  onClick={() => { setShowArticleList(v => !v); setSearchTerm(''); setCategoryFilter('all') }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#20c58f] hover:bg-[#1bb07e] text-white rounded-lg transition-colors"
                >
                  {showArticleList ? <ChevronDown className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showArticleList ? 'Stäng' : 'Lägg till'}
                </button>
              )}
            </div>

            {/* Artikel-picker */}
            {showArticleList && priceListId && (
              <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Sök artikel (namn, kod)..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  />
                </div>

                {/* Kategorifilter */}
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setCategoryFilter('all')}
                    className={`px-2 py-0.5 text-xs rounded-md transition-colors ${categoryFilter === 'all' ? 'bg-[#20c58f] text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                    Alla
                  </button>
                  {(Object.keys(articlesByCategory) as ArticleCategory[]).map(cat => {
                    const cfg = ARTICLE_CATEGORY_CONFIG[cat]
                    return (
                      <button key={cat} onClick={() => setCategoryFilter(cat)}
                        className={`px-2 py-0.5 text-xs rounded-md transition-colors ${categoryFilter === cat ? 'bg-[#20c58f] text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                        {cfg?.label ?? cat}
                      </button>
                    )
                  })}
                </div>

                {loadingCatalog ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2"><LoadingSpinner />Laddar...</div>
                ) : allCategories.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2 text-center">Inga artiklar matchar sökningen</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {allCategories.map(cat => {
                      const items = articlesByCategory[cat]
                      if (!items?.length) return null
                      const cfg = ARTICLE_CATEGORY_CONFIG[cat]
                      const isExp = expandedCategories.has(cat)
                      return (
                        <div key={cat} className="border border-slate-700/50 rounded-lg overflow-hidden">
                          <button onClick={() => toggleCategory(cat)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-2">
                              {isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                              <span className={`px-1.5 py-0.5 text-xs rounded ${cfg?.bgColor ?? ''} ${cfg?.color ?? ''}`}>{cfg?.label ?? cat}</span>
                              <span className="text-xs text-slate-500">{items.length} artiklar</span>
                            </div>
                          </button>
                          {isExp && (
                            <div className="divide-y divide-slate-700/30">
                              {items.map(item => {
                                const unit = ARTICLE_UNIT_CONFIG[item.article?.unit as keyof typeof ARTICLE_UNIT_CONFIG]
                                const isAdded = usedArticleIds.has(item.article_id)
                                return (
                                  <div key={item.article_id}
                                    className={`flex items-center justify-between px-3 py-2 transition-colors ${isAdded ? 'bg-[#20c58f]/5 border-l-2 border-[#20c58f]/40' : 'hover:bg-slate-800/20'}`}>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {item.article?.unit === 'timme' && <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                                        <span className="text-sm text-white font-medium truncate">{item.article?.name}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">{(item.article as any)?.code}</span>
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[#20c58f] text-sm font-medium">{fmt(item.custom_price)}</span>
                                        <span className="text-[10px] text-slate-500">/ {unit?.shortLabel ?? item.article?.unit}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 shrink-0">
                                      {isAdded && <span className="text-[10px] text-[#20c58f] font-medium">Tillagd</span>}
                                      <button onClick={() => addArticle(item)} disabled={isAdded}
                                        className="p-1.5 text-[#20c58f] hover:bg-[#20c58f]/20 rounded-lg transition-colors disabled:opacity-30">
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Valda artiklar */}
            {contractRows.length === 0 ? (
              <div className="text-center py-4">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-500">Inga artiklar tillagda</p>
                {priceListId && <p className="text-xs text-slate-600 mt-0.5">Klicka "Lägg till" för att välja produkter &amp; tjänster</p>}
                {!priceListId && <p className="text-xs text-slate-600 mt-0.5">Välj en artikelkatalog ovan</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {contractRows.map(row => {
                  const unit = ARTICLE_UNIT_CONFIG[row.article_unit as keyof typeof ARTICLE_UNIT_CONFIG]
                  const isTime = row.article_unit === 'timme'
                  const lineTotal = row.list_price * row.quantity
                  return (
                    <div key={row.tempId} className="px-3 py-2 rounded-xl border border-slate-700/50 bg-slate-800/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Artikelnamn */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isTime && <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                            <span className="text-sm text-white font-medium">{row.article_name}</span>
                            {row.article_code && <span className="text-[10px] text-slate-500 font-mono">{row.article_code}</span>}
                          </div>
                          {/* Kontroller */}
                          <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap">
                            {/* Antal +/- */}
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => updateQty(row.tempId, -1)} disabled={row.quantity <= 1}
                                className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 transition-colors">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input type="number" min="1" value={row.quantity}
                                onChange={e => setQtyDirect(row.tempId, e.target.value)}
                                className="w-12 px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-[#20c58f]" />
                              <button onClick={() => updateQty(row.tempId, 1)}
                                className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs text-slate-500 ml-0.5">{unit?.shortLabel ?? row.article_unit}</span>
                            </div>
                            <span className="text-slate-600">×</span>
                            <span className="text-[#20c58f] font-medium">{fmt(row.list_price)}</span>
                          </div>
                        </div>
                        {/* Radtotal + ta bort */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-white font-semibold text-sm">{fmt(lineTotal)}</span>
                          <button onClick={() => removeRow(row.tempId)}
                            className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Summering */}
                <div className="pt-2 border-t border-slate-700/50 space-y-1">
                  {fixedVal == null && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Beräknat årsbelopp</span>
                      <span className="text-white font-semibold">{fmt(calculatedTotal)}</span>
                    </div>
                  )}
                  {fixedVal != null && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Beräknat årsbelopp</span>
                      <span className="line-through text-slate-500">{fmt(calculatedTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Årsbelopp (exkl. moms)</span>
                    <div className="flex items-center gap-2">
                      {hasAdjustment && <span className="line-through text-slate-500">{fmt(baseTotal)}</span>}
                      <span className={`font-semibold ${hasAdjustment ? 'text-emerald-400' : 'text-white'}`}>{fmt(adjustedTotal)}</span>
                    </div>
                  </div>
                  {freqMonths > 0 && freqMonths !== 12 && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Per faktura ({BILLING_FREQUENCY_CONFIG[billingFrequency]?.label.toLowerCase()})</span>
                      <span className={`font-semibold ${hasAdjustment ? 'text-emerald-400' : 'text-white'}`}>{fmt(perPeriodAdj)}</span>
                    </div>
                  )}
                </div>
              </div>
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
              <p className="text-xs text-slate-500 mt-1">Lämna tomt = beräknas från artiklar ovan</p>
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
    </div>
  )
}
