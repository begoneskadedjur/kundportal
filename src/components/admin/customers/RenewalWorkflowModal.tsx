// src/components/admin/customers/RenewalWorkflowModal.tsx - Förnyelse-workflow modal

import React, { useState } from 'react'
import { X, DollarSign, FileText, Clock } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import Select from '../../ui/Select'
import toast from 'react-hot-toast'

interface RenewalWorkflowModalProps {
  organization: ConsolidatedCustomer | null
  isOpen: boolean
  onClose: () => void
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function RenewalWorkflowModal({ organization, isOpen, onClose }: RenewalWorkflowModalProps) {
  const [newAnnualValue, setNewAnnualValue] = useState('')
  const [contractLength, setContractLength] = useState('12')
  const [startDate, setStartDate] = useState('')
  const [comments, setComments] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isOpen || !organization) return null

  const currentEndDate = organization.nextRenewalDate
    ? new Date(organization.nextRenewalDate).toLocaleDateString('sv-SE')
    : 'Okänt'

  const daysLeft = organization.daysToNextRenewal || 0

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      // Spara som draft — för närvarande bara en toast-notifikation
      // I framtiden: spara till renewal_drafts-tabell i Supabase
      const draft = {
        organizationId: organization.id,
        organizationName: organization.company_name,
        currentValue: organization.totalContractValue,
        newAnnualValue: newAnnualValue ? parseFloat(newAnnualValue) : null,
        contractLengthMonths: parseInt(contractLength),
        proposedStartDate: startDate || null,
        comments,
        createdAt: new Date().toISOString(),
      }

      // Simulera sparande
      console.log('Renewal draft saved:', draft)
      await new Promise(resolve => setTimeout(resolve, 500))

      toast.success(`Förnyelseförslag sparat för ${organization.company_name}`)
      onClose()
    } catch {
      toast.error('Kunde inte spara förslaget')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white truncate">Avtalsförnyelse</h2>
            <p className="text-xs text-slate-400 truncate mt-0.5">{organization.company_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Nuvarande avtal — textrader med whisper header */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Nuvarande avtal</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-400">Avtalsvärde</span>
                <span className="text-slate-200 tabular-nums">
                  {formatCurrency(organization.totalContractValue)}
                  <span className="text-slate-500"> · {formatCurrency(organization.totalAnnualValue || 0)}/år</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-400">Utgångsdatum</span>
                <span className="text-slate-200 tabular-nums">
                  {currentEndDate}
                  <span className={`ml-2 text-xs ${
                    daysLeft <= 30 ? 'text-red-400' : daysLeft <= 60 ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {daysLeft} dagar kvar
                  </span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-400">Health score</span>
                <span className={`tabular-nums ${
                  organization.overallHealthScore.score >= 70 ? 'text-[#20c58f]' :
                    organization.overallHealthScore.score >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {organization.overallHealthScore.score}/100
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-400">Churnrisk</span>
                <span className={`tabular-nums ${
                  organization.highestChurnRisk.risk === 'low' ? 'text-[#20c58f]' :
                    organization.highestChurnRisk.risk === 'medium' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {organization.highestChurnRisk.risk === 'low' ? 'Låg' :
                    organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Hög'}
                  {' '}({Math.round(organization.highestChurnRisk.score)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Förnyelse-formulär */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Förnyelseförslag</h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nytt årsvärde (SEK)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  value={newAnnualValue}
                  onChange={(e) => setNewAnnualValue(e.target.value)}
                  placeholder={String(organization.totalAnnualValue || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kontraktslängd</label>
                <Select
                  value={contractLength}
                  onChange={setContractLength}
                  options={[
                    { value: '6', label: '6 månader' },
                    { value: '12', label: '12 månader' },
                    { value: '24', label: '24 månader' },
                    { value: '36', label: '36 månader' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Startdatum</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Kommentarer</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
                placeholder="Anteckningar om förnyelsen..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Avbryt
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#20c58f] text-[#fff] rounded-lg hover:bg-[#1ba876] disabled:opacity-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              {saving ? 'Sparar...' : 'Spara utkast'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
