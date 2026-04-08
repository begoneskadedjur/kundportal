// src/components/admin/customers/BillingSettingsModal.tsx
// Faktureringsinställningar per kund – välj avtalsartiklar, antal, fast pris, premiejustering

import { useState, useEffect, useId } from 'react'
import {
  Receipt, Save, Building2, Copy, TrendingUp, Plus, Trash2, AlertCircle
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { PriceListService } from '../../../services/priceListService'
import { CustomerContractArticleService } from '../../../services/customerContractArticleService'
import type { PriceList, PriceListItemWithArticle } from '../../../types/articles'
import { BillingFrequency, BILLING_FREQUENCY_CONFIG } from '../../../types/contractBilling'
import toast from 'react-hot-toast'

interface ContractRow {
  tempId: string
  article_id: string
  article_name: string
  article_unit: string
  list_price: number
  quantity: string
  fixed_price: string   // tom sträng = använd list_price
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

interface SiteBillingData {
  id: string
  site_name: string
  billing_email: string
  billing_address: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

function calcRowTotal(row: ContractRow): number {
  const qty = parseFloat(row.quantity) || 0
  const fp = row.fixed_price !== '' ? parseFloat(row.fixed_price) : null
  if (fp != null) return fp
  return row.list_price * qty
}

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
  const [showArticlePicker, setShowArticlePicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

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

  // Load catalog articles from selected price list
  useEffect(() => {
    if (!priceListId) { setCatalogItems([]); return }
    setLoadingCatalog(true)
    PriceListService.getPriceListItems(priceListId)
      .then(items => setCatalogItems(items.filter(i => i.article?.is_active)))
      .catch(() => setCatalogItems([]))
      .finally(() => setLoadingCatalog(false))
  }, [priceListId])

  // Load existing contract articles for this customer
  useEffect(() => {
    if (!isOpen || !customerId) return
    CustomerContractArticleService.getArticles(customerId)
      .then(articles => {
        setContractRows(
          articles.map((ca, i) => ({
            tempId: `existing-${i}-${ca.article_id}`,
            article_id: ca.article_id,
            article_name: ca.article?.name || '',
            article_unit: (ca.article as any)?.unit || 'st',
            list_price: ca.list_price,
            quantity: String(ca.quantity),
            fixed_price: ca.fixed_price != null ? String(ca.fixed_price) : '',
          }))
        )
      })
      .catch(console.error)
  }, [isOpen, customerId])

  // Summering
  const adjustPct = priceAdjustmentPercent !== '' ? parseFloat(priceAdjustmentPercent) || 0 : 0
  const hasAdjustment = adjustPct !== 0
  const baseTotal = contractRows.reduce((s, r) => s + calcRowTotal(r), 0)
  const adjustedTotal = hasAdjustment ? Math.round(baseTotal * (1 + adjustPct / 100)) : baseTotal
  const freqMonths = BILLING_FREQUENCY_CONFIG[billingFrequency]?.months ?? 1
  const perPeriodBase = freqMonths > 0 && freqMonths !== 12 ? Math.round(baseTotal * freqMonths / 12) : baseTotal
  const perPeriodAdj = freqMonths > 0 && freqMonths !== 12 ? Math.round(adjustedTotal * freqMonths / 12) : adjustedTotal

  // Artiklar som inte redan lagts till
  const usedArticleIds = new Set(contractRows.map(r => r.article_id))
  const availableArticles = catalogItems.filter(i => !usedArticleIds.has(i.article_id))
  const filteredAvailable = pickerSearch
    ? availableArticles.filter(i => i.article?.name?.toLowerCase().includes(pickerSearch.toLowerCase()))
    : availableArticles

  const addArticle = (item: PriceListItemWithArticle) => {
    setContractRows(prev => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${item.article_id}`,
        article_id: item.article_id,
        article_name: item.article?.name || '',
        article_unit: item.article?.unit || 'st',
        list_price: item.custom_price,
        quantity: '1',
        fixed_price: '',
      },
    ])
    setShowArticlePicker(false)
    setPickerSearch('')
  }

  const removeRow = (tempId: string) => {
    setContractRows(prev => prev.filter(r => r.tempId !== tempId))
  }

  const updateRow = (tempId: string, field: 'quantity' | 'fixed_price', value: string) => {
    setContractRows(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r))
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
      // 1. Spara avtalsartiklar
      await CustomerContractArticleService.saveArticles(
        customerId,
        contractRows.map((r, i) => ({
          customer_id: customerId,
          article_id: r.article_id,
          quantity: parseFloat(r.quantity) || 1,
          fixed_price: r.fixed_price !== '' ? parseFloat(r.fixed_price) : null,
          sort_order: i,
        }))
      )

      // 2. Beräkna värden
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)

      if (error) throw error

      // 4. Per-site uppdatering
      if (isMultisite && billingType === 'per_site') {
        for (const site of siteBilling) {
          const { error: se } = await supabase
            .from('customers')
            .update({ billing_email: site.billing_email || null, billing_address: site.billing_address || null, updated_at: new Date().toISOString() })
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

          {/* ── Fakturering ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#20c58f]" />Fakturering
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Faktureringsfrekvens</label>
                <select value={billingFrequency} onChange={e => setBillingFrequency(e.target.value as BillingFrequency)} className={sel}>
                  {Object.entries(BILLING_FREQUENCY_CONFIG).map(([k, c]) => (
                    <option key={k} value={k}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Artikelkatalog (prislista)</label>
                <select value={priceListId || ''} onChange={e => setPriceListId(e.target.value || null)} className={sel}>
                  <option value="">Ingen prislista</option>
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.name} {pl.is_default && '(Standard)'}</option>
                  ))}
                </select>
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

          {/* ── Avtalsartiklar ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Avtalsinnehåll</h3>
              {priceListId && (
                <button
                  onClick={() => { setShowArticlePicker(v => !v); setPickerSearch('') }}
                  className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />Lägg till artikel
                </button>
              )}
            </div>

            {!priceListId && (
              <p className="text-xs text-slate-500">Välj en artikelkatalog ovan för att lägga till artiklar.</p>
            )}

            {/* Artikel-picker dropdown */}
            {showArticlePicker && (
              <div className="p-2 bg-slate-800/60 border border-slate-600 rounded-xl space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Sök artikel..."
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                />
                {loadingCatalog ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-1"><LoadingSpinner size="sm" />Laddar...</div>
                ) : filteredAvailable.length === 0 ? (
                  <p className="text-xs text-slate-500 py-1">
                    {availableArticles.length === 0 ? 'Alla artiklar har lagts till.' : 'Inga träffar.'}
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {filteredAvailable.map(item => (
                      <button
                        key={item.article_id}
                        onClick={() => addArticle(item)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-700/60 transition-colors"
                      >
                        <span className="text-xs text-slate-300 truncate flex-1">{item.article?.name}</span>
                        <span className="text-xs text-slate-400 ml-2 shrink-0">{fmt(item.custom_price)}/{item.article?.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Artikel-rader */}
            {contractRows.length > 0 ? (
              <div className="space-y-1.5">
                {/* Header */}
                <div className="grid gap-2 px-1 text-xs text-slate-500" style={{ gridTemplateColumns: '1fr 70px 90px 90px 70px 24px' }}>
                  <span>Artikel</span>
                  <span className="text-right">Antal</span>
                  <span className="text-right">Listpris</span>
                  <span className="text-right">Fast pris</span>
                  <span className="text-right">Rad</span>
                  <span />
                </div>

                {contractRows.map(row => {
                  const lineTotal = calcRowTotal(row)
                  const hasFixed = row.fixed_price !== ''
                  return (
                    <div key={row.tempId} className="grid gap-2 items-center px-1" style={{ gridTemplateColumns: '1fr 70px 90px 90px 70px 24px' }}>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 truncate">{row.article_name}</p>
                        <p className="text-xs text-slate-500">{row.article_unit}</p>
                      </div>
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={e => updateRow(row.tempId, 'quantity', e.target.value)}
                        min="0"
                        step="1"
                        className="px-2 py-1 text-xs text-right bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] w-full"
                      />
                      <span className="text-xs text-slate-400 text-right">{fmt(row.list_price)}</span>
                      <input
                        type="number"
                        value={row.fixed_price}
                        onChange={e => updateRow(row.tempId, 'fixed_price', e.target.value)}
                        placeholder="–"
                        min="0"
                        className={`px-2 py-1 text-xs text-right bg-slate-800 border rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f] w-full ${hasFixed ? 'border-amber-500/50' : 'border-slate-600'}`}
                      />
                      <span className="text-xs text-white text-right font-medium">{fmt(lineTotal)}</span>
                      <button onClick={() => removeRow(row.tempId)} className="text-slate-600 hover:text-red-400 transition-colors flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}

                {/* Summering */}
                <div className="pt-2 border-t border-slate-700/50 space-y-1">
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
                      <div className="flex items-center gap-2">
                        {hasAdjustment && <span className="line-through text-slate-500">{fmt(perPeriodBase)}</span>}
                        <span className={`font-semibold ${hasAdjustment ? 'text-emerald-400' : 'text-white'}`}>{fmt(perPeriodAdj)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : priceListId ? (
              <p className="text-xs text-slate-500 py-1">Inga artiklar tillagda. Klicka "+ Lägg till artikel" för att börja.</p>
            ) : null}
          </div>

          {/* ── Premiejustering ── */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-slate-400" />Årlig premiejustering
            </h3>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Justeringsprocent (%)</label>
                <input
                  type="number"
                  value={priceAdjustmentPercent}
                  onChange={e => setPriceAdjustmentPercent(e.target.value)}
                  placeholder="0.0"
                  step="0.01"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500"
                />
              </div>
              {hasAdjustment && baseTotal > 0 && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-xs text-emerald-400 font-medium">{fmt(baseTotal)} → {fmt(adjustedTotal)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">+{fmt(adjustedTotal - baseTotal)}/år ({adjustPct > 0 ? '+' : ''}{adjustPct}%)</p>
                </div>
              )}
            </div>
            {hasAdjustment && baseTotal > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">Justeringen appliceras vid nästa fakturering. För ackumulering – uppdatera priserna efter varje år.</p>
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

          {/* ── Per-site (multisite) ── */}
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
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Spara
          </Button>
        </div>
      </div>
    </div>
  )
}
