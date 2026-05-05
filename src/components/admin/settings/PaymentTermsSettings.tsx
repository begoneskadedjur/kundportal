// src/components/admin/settings/PaymentTermsSettings.tsx
// Admin-inställningar: dynamiska betalningsvillkor per kategori (privat/företag/avtal)

import { useEffect, useState } from 'react'
import { Save, Loader2, Calendar, User, Building2, FileSignature } from 'lucide-react'
import toast from 'react-hot-toast'
import { PaymentTermsService, type BillingCategory } from '../../../services/paymentTermsService'

interface CategoryRow {
  key: BillingCategory
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: CategoryRow[] = [
  {
    key: 'private',
    label: 'Privatpersoner',
    description: 'Förfallodatum för fakturor till privatkunder',
    icon: User,
  },
  {
    key: 'business',
    label: 'Företag',
    description: 'Förfallodatum för fakturor till företagskunder (engångsärenden)',
    icon: Building2,
  },
  {
    key: 'contract',
    label: 'Avtalskunder',
    description: 'Förfallodatum för avtalsfakturor och merförsäljning',
    icon: FileSignature,
  },
]

export default function PaymentTermsSettings() {
  const [values, setValues] = useState<Record<BillingCategory, number>>({ private: 20, business: 14, contract: 30 })
  const [drafts, setDrafts] = useState<Record<BillingCategory, string>>({ private: '20', business: '14', contract: '30' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<BillingCategory | null>(null)

  useEffect(() => {
    PaymentTermsService.getAll()
      .then(data => {
        setValues(data)
        setDrafts({
          private: String(data.private),
          business: String(data.business),
          contract: String(data.contract),
        })
      })
      .catch(err => toast.error(err.message || 'Kunde inte ladda betalningsvillkor'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (category: BillingCategory) => {
    const days = parseInt(drafts[category], 10)
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      toast.error('Ange ett antal dagar mellan 1 och 365')
      return
    }
    setSaving(category)
    try {
      await PaymentTermsService.update(category, days)
      setValues(prev => ({ ...prev, [category]: days }))
      toast.success('Betalningsvillkor uppdaterat')
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte spara')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#20c58f]" />
          Betalningsvillkor
        </h1>
        <p className="text-sm text-slate-400">
          Antal dagar från fakturadatum till förfallodatum, per kundkategori. Påverkar
          alla nya fakturor som skapas. Befintliga fakturor behåller sina datum, men
          kan justeras manuellt på fakturadetalj-sidan.
        </p>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const draft = drafts[cat.key]
          const current = values[cat.key]
          const changed = parseInt(draft, 10) !== current
          const isSaving = saving === cat.key
          return (
            <div
              key={cat.key}
              className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl"
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-[#20c58f] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white">{cat.label}</div>
                  <div className="text-xs text-slate-500 mb-3">{cat.description}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={draft}
                      onChange={e => setDrafts(prev => ({ ...prev, [cat.key]: e.target.value }))}
                      className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                    />
                    <span className="text-sm text-slate-400">dagar</span>
                    {changed && (
                      <button
                        type="button"
                        onClick={() => handleSave(cat.key)}
                        disabled={isSaving}
                        className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1bb07e] text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Spara
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
