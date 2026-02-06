// src/components/admin/customers/TerminateContractModal.tsx - Modal för avtalsuppsägning

import React, { useState, useMemo } from 'react'
import { X, AlertTriangle, Calendar, DollarSign } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

interface TerminateContractModalProps {
  organization: ConsolidatedCustomer | null
  isOpen: boolean
  onClose: () => void
  onTerminated: () => void
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export default function TerminateContractModal({ organization, isOpen, onClose, onTerminated }: TerminateContractModalProps) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  if (!isOpen || !organization) return null

  const today = new Date()
  const contractEnd = organization.nextRenewalDate ? new Date(organization.nextRenewalDate) : null

  // Beräkna effective_end_date baserat på affärsreglerna
  const { effectiveEndDate, isWithinContractPeriod } = useMemo(() => {
    if (!contractEnd) {
      // Inget slutdatum → 2 månader från idag
      const eff = addMonths(today, 2)
      return { effectiveEndDate: eff, isWithinContractPeriod: false }
    }

    if (today <= contractEnd) {
      // Inom avtalstiden → avslutas vid contract_end_date
      return { effectiveEndDate: contractEnd, isWithinContractPeriod: true }
    } else {
      // Har löpt vidare → 2 månader från idag
      const eff = addMonths(today, 2)
      return { effectiveEndDate: eff, isWithinContractPeriod: false }
    }
  }, [contractEnd])

  const formatDate = (d: Date) => d.toLocaleDateString('sv-SE')
  const effectiveDateStr = effectiveEndDate.toISOString().split('T')[0]

  const handleTerminate = async () => {
    if (!confirmed) return
    setSaving(true)

    try {
      // Uppdatera alla sites i organisationen
      const siteIds = organization.sites.map(s => s.id)

      const { error } = await supabase
        .from('customers')
        .update({
          terminated_at: new Date().toISOString(),
          termination_reason: reason || null,
          effective_end_date: effectiveDateStr,
          contract_status: 'terminated'
        })
        .in('id', siteIds)

      if (error) throw error

      toast.success(`Avtal uppsagt for ${organization.company_name} — slutdatum: ${formatDate(effectiveEndDate)}`)
      onTerminated()
      onClose()
    } catch (err) {
      console.error('Error terminating contract:', err)
      toast.error('Kunde inte säga upp avtalet')
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Säg upp avtal</h2>
              <p className="text-sm text-slate-400">{organization.company_name}</p>
            </div>
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
                Avtalets slutdatum
              </div>
              <div className="text-sm font-semibold text-white">
                {contractEnd ? formatDate(contractEnd) : 'Ej angivet'}
              </div>
              {contractEnd && (
                <div className={`text-xs font-medium ${today > contractEnd ? 'text-amber-400' : 'text-slate-500'}`}>
                  {today > contractEnd ? 'Avtalet har löpt vidare' : `${organization.daysToNextRenewal} dagar kvar`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Uppsägningsinfo */}
        <div className="p-5 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Uppsägningsberäkning</h3>

          <div className={`rounded-lg p-4 border ${isWithinContractPeriod ? 'bg-blue-500/10 border-blue-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            {isWithinContractPeriod ? (
              <>
                <p className="text-sm text-blue-300 font-medium mb-1">Uppsägning inom avtalstiden</p>
                <p className="text-xs text-blue-200/70">
                  Avtalet avslutas vid nuvarande slutdatum: <strong className="text-white">{formatDate(effectiveEndDate)}</strong>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-amber-300 font-medium mb-1">Avtalet har löpt vidare efter avtalstiden</p>
                <p className="text-xs text-amber-200/70">
                  Uppsägningstid 2 månader. Avtalet avslutas: <strong className="text-white">{formatDate(effectiveEndDate)}</strong>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Anledning */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Anledning (valfritt)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Anledning till uppsägningen..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 resize-none"
            />
          </div>

          {/* Bekräftelse checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded bg-slate-700 border-slate-600 text-red-500 focus:ring-red-500"
            />
            <span className="text-xs text-slate-300">
              Jag bekräftar att avtalet med <strong>{organization.company_name}</strong> ska sägas upp med slutdatum <strong>{formatDate(effectiveEndDate)}</strong>.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleTerminate}
            disabled={!confirmed || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            {saving ? 'Säger upp...' : 'Säg upp avtal'}
          </button>
        </div>
      </div>
    </div>
  )
}
