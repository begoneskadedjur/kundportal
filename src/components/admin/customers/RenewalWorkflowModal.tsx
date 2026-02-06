// src/components/admin/customers/RenewalWorkflowModal.tsx - Förnyelse-workflow modal

import React, { useState } from 'react'
import { X, Calendar, DollarSign, FileText, Clock, AlertTriangle, Activity } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
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
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Avtalsförnyelse</h2>
            <p className="text-sm text-slate-400">{organization.company_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nuvarande avtal */}
        <div className="p-5 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Nuvarande avtal</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <DollarSign className="w-3 h-3" />
                Avtalsvärde
              </div>
              <div className="text-sm font-semibold text-white">{formatCurrency(organization.totalContractValue)}</div>
              <div className="text-xs text-slate-500">{formatCurrency(organization.totalAnnualValue || 0)}/år</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Calendar className="w-3 h-3" />
                Utgångsdatum
              </div>
              <div className="text-sm font-semibold text-white">{currentEndDate}</div>
              <div className={`text-xs font-medium ${
                daysLeft <= 30 ? 'text-red-400' : daysLeft <= 60 ? 'text-amber-400' : 'text-yellow-400'
              }`}>
                {daysLeft} dagar kvar
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Activity className="w-3 h-3" />
                Health Score
              </div>
              <div className={`text-sm font-semibold ${
                organization.overallHealthScore.score >= 70 ? 'text-green-400' :
                  organization.overallHealthScore.score >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {organization.overallHealthScore.score}/100
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <AlertTriangle className="w-3 h-3" />
                Churn Risk
              </div>
              <div className={`text-sm font-semibold ${
                organization.highestChurnRisk.risk === 'low' ? 'text-green-400' :
                  organization.highestChurnRisk.risk === 'medium' ? 'text-amber-400' : 'text-red-400'
              }`}>
                {organization.highestChurnRisk.risk === 'low' ? 'Låg' :
                  organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Hög'}
                ({Math.round(organization.highestChurnRisk.score)}%)
              </div>
            </div>
          </div>
        </div>

        {/* Förnyelse-formulär */}
        <div className="p-5 space-y-4">
          <h3 className="text-sm font-medium text-slate-300">Förnyelseförslag</h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Nytt årsvärde (SEK)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="number"
                value={newAnnualValue}
                onChange={(e) => setNewAnnualValue(e.target.value)}
                placeholder={String(organization.totalAnnualValue || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Kontraktslängd</label>
              <select
                value={contractLength}
                onChange={(e) => setContractLength(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/50"
              >
                <option value="6">6 månader</option>
                <option value="12">12 månader</option>
                <option value="24">24 månader</option>
                <option value="36">36 månader</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Startdatum</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/50"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Kommentarer</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Anteckningar om förnyelsen..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Avbryt
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 disabled:opacity-50 transition-colors"
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
