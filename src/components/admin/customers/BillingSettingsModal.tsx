// src/components/admin/customers/BillingSettingsModal.tsx
// Dedikerad modal for faktureringsinstellningar per kund

import { useState, useEffect } from 'react'
import { Receipt, Save, Building2, Copy } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { PriceListService } from '../../../services/priceListService'
import type { PriceList } from '../../../types/articles'
import { BillingFrequency, BILLING_FREQUENCY_CONFIG } from '../../../types/contractBilling'
import toast from 'react-hot-toast'

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
  sites,
  isOpen,
  onClose,
  onSave
}: BillingSettingsModalProps) {
  const [saving, setSaving] = useState(false)
  const [priceLists, setPriceLists] = useState<PriceList[]>([])

  // Form state
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly')
  const [priceListId, setPriceListId] = useState<string | null>(null)
  const [billingEmail, setBillingEmail] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingType, setBillingType] = useState<'consolidated' | 'per_site'>('consolidated')
  const [siteBilling, setSiteBilling] = useState<SiteBillingData[]>([])

  // Init form
  useEffect(() => {
    if (isOpen && customerId) {
      setBillingFrequency(currentBillingFrequency || 'monthly')
      setPriceListId(currentPriceListId || null)
      setBillingEmail(currentBillingEmail || '')
      setBillingAddress(currentBillingAddress || '')
      setBillingType(currentBillingType || 'consolidated')
      setSiteBilling(
        sites
          .filter(s => s.id !== customerId)
          .map(s => ({
            id: s.id,
            site_name: s.site_name || s.company_name || 'Okänd enhet',
            billing_email: s.billing_email || '',
            billing_address: s.billing_address || ''
          }))
      )
    }
  }, [isOpen, customerId, currentBillingFrequency, currentPriceListId, currentBillingEmail, currentBillingAddress, currentBillingType, sites])

  // Load price lists
  useEffect(() => {
    PriceListService.getActivePriceLists()
      .then(setPriceLists)
      .catch(err => console.error('Kunde inte ladda prislistor:', err))
  }, [])

  const handleSiteBillingChange = (siteId: string, field: 'billing_email' | 'billing_address', value: string) => {
    setSiteBilling(prev =>
      prev.map(s => s.id === siteId ? { ...s, [field]: value } : s)
    )
  }

  const copyFromMain = (siteId: string) => {
    setSiteBilling(prev =>
      prev.map(s => s.id === siteId ? { ...s, billing_email: billingEmail, billing_address: billingAddress } : s)
    )
  }

  const handleSave = async () => {
    if (!customerId) return
    setSaving(true)

    try {
      // Update main customer
      const { error: mainError } = await supabase
        .from('customers')
        .update({
          billing_frequency: billingFrequency,
          price_list_id: priceListId,
          billing_email: billingEmail || null,
          billing_address: billingAddress || null,
          billing_type: isMultisite ? billingType : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)

      if (mainError) throw mainError

      // Update sites if per_site
      if (isMultisite && billingType === 'per_site') {
        for (const site of siteBilling) {
          const { error: siteError } = await supabase
            .from('customers')
            .update({
              billing_email: site.billing_email || null,
              billing_address: site.billing_address || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', site.id)

          if (siteError) throw siteError
        }
      }

      toast.success('Faktureringsinställningar sparade!')
      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error saving billing settings:', error)
      toast.error('Kunde inte spara: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !customerId) return null

  const selectStyles = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f]'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
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
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Sektion 1: Grundinställningar */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#20c58f]" />
              Fakturering
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Faktureringsfrekvens</label>
                <select
                  value={billingFrequency}
                  onChange={(e) => setBillingFrequency(e.target.value as BillingFrequency)}
                  className={selectStyles}
                >
                  {Object.entries(BILLING_FREQUENCY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Prislista</label>
                <select
                  value={priceListId || ''}
                  onChange={(e) => setPriceListId(e.target.value || null)}
                  className={selectStyles}
                >
                  <option value="">Ingen prislista</option>
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} {pl.is_default && '(Standard)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Faktura-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="faktura@example.com"
                />
                {billingEmail && billingEmail !== contactEmail && (
                  <p className="text-xs text-yellow-400 mt-1">Skiljer sig från kontakt-email</p>
                )}
              </div>
              <Input
                label="Fakturaadress"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Gatuadress, Postnr Ort"
              />
            </div>
          </div>

          {/* Sektion 2: Konsolideringsval (multisite only) */}
          {isMultisite && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-400" />
                Faktureringssätt
              </h3>

              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                  <input
                    type="radio"
                    name="billingType"
                    value="consolidated"
                    checked={billingType === 'consolidated'}
                    onChange={() => setBillingType('consolidated')}
                    className="mt-0.5 h-4 w-4 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Konsoliderad faktura</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      En samlad faktura till huvudkontoret för alla enheter.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                  <input
                    type="radio"
                    name="billingType"
                    value="per_site"
                    checked={billingType === 'per_site'}
                    onChange={() => setBillingType('per_site')}
                    className="mt-0.5 h-4 w-4 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Faktura per enhet</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Varje enhet får sin egen faktura med egna fakturainställningar.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Sektion 3: Enhetsinställningar (multisite + per_site) */}
          {isMultisite && billingType === 'per_site' && siteBilling.length > 0 && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Enheternas fakturainställningar
              </h3>

              <div className="space-y-2">
                {siteBilling.map(site => (
                  <div key={site.id} className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{site.site_name}</span>
                      <button
                        type="button"
                        onClick={() => copyFromMain(site.id)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
                        title="Kopiera från huvudkontor"
                      >
                        <Copy className="w-3 h-3" />
                        Kopiera
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Faktura-email</label>
                        <input
                          type="email"
                          value={site.billing_email}
                          onChange={(e) => handleSiteBillingChange(site.id, 'billing_email', e.target.value)}
                          placeholder="faktura@enhet.se"
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fakturaadress</label>
                        <input
                          type="text"
                          value={site.billing_address}
                          onChange={(e) => handleSiteBillingChange(site.id, 'billing_address', e.target.value)}
                          placeholder="Gatuadress, Postnr Ort"
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-700/50 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Spara
          </Button>
        </div>
      </div>
    </div>
  )
}
