// src/components/shared/CommissionSection.tsx
// Delad formulärsektion för provisionsmarkering i ärendemodaler
import React, { useState, useEffect, useMemo } from 'react'
import { DollarSign, Users, Info, AlertTriangle } from 'lucide-react'
import { ProvisionService } from '../../services/provisionService'
import type { CommissionSettings, TechnicianShare } from '../../types/provision'

interface Technician {
  id: string
  name: string
}

interface CommissionSectionProps {
  isEligible: boolean
  onEligibleChange: (value: boolean) => void
  // Tillgängliga tekniker på ärendet
  assignedTechnicians: Technician[]
  // Teknikerfördelning
  technicianShares: TechnicianShare[]
  onSharesChange: (shares: TechnicianShare[]) => void
  // Avdrag
  deductions: number
  onDeductionsChange: (amount: number) => void
  // Anteckningar
  notes: string
  onNotesChange: (notes: string) => void
  // Basbelopp (pris exkl moms)
  baseAmount: number
  // ROT/RUT
  isRotRut?: boolean
  rotRutOriginalAmount?: number
  // Visa om poster redan finns
  existingPostCount?: number
  // Automatiskt avdrag från underentreprenörsartiklar
  subcontractorDeduction?: number
}

export default function CommissionSection({
  isEligible,
  onEligibleChange,
  assignedTechnicians,
  technicianShares,
  onSharesChange,
  deductions,
  onDeductionsChange,
  notes,
  onNotesChange,
  baseAmount,
  isRotRut,
  rotRutOriginalAmount,
  existingPostCount = 0,
  subcontractorDeduction = 0
}: CommissionSectionProps) {
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)

  useEffect(() => {
    ProvisionService.getSettings()
      .then(s => setSettings(s))
      .catch(console.error)
      .finally(() => setLoadingSettings(false))
  }, [])

  // Auto-initiera teknikerfördelning när tilldelade tekniker ändras
  useEffect(() => {
    if (assignedTechnicians.length > 0 && technicianShares.length === 0 && isEligible) {
      const share = Math.floor(100 / assignedTechnicians.length)
      const remainder = 100 - (share * assignedTechnicians.length)
      const shares: TechnicianShare[] = assignedTechnicians.map((tech, i) => ({
        technician_id: tech.id,
        technician_name: tech.name,
        share_percentage: share + (i === assignedTechnicians.length - 1 ? remainder : 0)
      }))
      onSharesChange(shares)
    }
  }, [assignedTechnicians, isEligible])

  // Beräkna provision per tekniker
  const calculations = useMemo(() => {
    if (!settings || !isEligible) return null

    const effectiveBase = isRotRut && rotRutOriginalAmount ? rotRutOriginalAmount : baseAmount
    const belowThreshold = effectiveBase < settings.min_commission_base

    return technicianShares.map(tech => {
      const amount = ProvisionService.calculateCommission(
        effectiveBase,
        settings.engangsjobb_percentage,
        tech.share_percentage,
        deductions
      )
      return {
        ...tech,
        commission_amount: amount,
        below_threshold: belowThreshold
      }
    })
  }, [settings, isEligible, baseAmount, deductions, technicianShares, isRotRut, rotRutOriginalAmount])

  const totalCommission = calculations?.reduce((sum, c) => sum + c.commission_amount, 0) ?? 0
  const effectiveBase = isRotRut && rotRutOriginalAmount ? rotRutOriginalAmount : baseAmount
  const belowThreshold = settings ? effectiveBase < settings.min_commission_base : false

  if (loadingSettings) return null

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-1.5 mb-2">
        <DollarSign className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Provision</span>
      </div>

      {/* Redan skapad */}
      {existingPostCount > 0 && (
        <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            {existingPostCount} provisionspost(er) redan skapade för detta ärende.
          </p>
        </div>
      )}

      {/* Radioknapp */}
      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="commission_eligible"
            checked={isEligible}
            onChange={() => onEligibleChange(true)}
            className="text-[#20c58f] focus:ring-[#20c58f]"
            disabled={existingPostCount > 0}
          />
          <span className="text-sm text-slate-300">Ja, provisionsgrundande</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="commission_eligible"
            checked={!isEligible}
            onChange={() => onEligibleChange(false)}
            className="text-slate-500 focus:ring-slate-500"
            disabled={existingPostCount > 0}
          />
          <span className="text-sm text-slate-300">Nej</span>
        </label>
      </div>

      {/* Expanderat innehåll vid Ja */}
      {isEligible && settings && (
        <div className="space-y-3">
          {/* Varning under tröskelvärde */}
          {belowThreshold && (
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-400">
                Beloppet {effectiveBase.toLocaleString('sv-SE')} kr understiger minsta provisionsgrundande belopp ({settings.min_commission_base.toLocaleString('sv-SE')} kr exkl moms). Provision skapas inte.
              </p>
            </div>
          )}

          {/* Procent & belopp info */}
          <div className="flex items-center gap-2 p-2 bg-slate-800/20 border border-slate-700/50 rounded-lg">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400">
              Provisionsprocent: <span className="text-slate-200 font-medium">{settings.engangsjobb_percentage}%</span>
              {' · '}
              Grundbelopp: <span className="text-slate-200 font-medium">{effectiveBase.toLocaleString('sv-SE')} kr</span>
              {isRotRut && ' (belopp före ROT-avdrag)'}
            </span>
          </div>

          {/* Teknikerfördelning */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-400">Fördelning mellan tekniker</span>
            </div>

            {technicianShares.length === 0 && (
              <p className="text-xs text-slate-500 italic">Inga tekniker tilldelade ärendet.</p>
            )}

            <div className="space-y-2">
              {technicianShares.map((tech, idx) => (
                <div key={tech.technician_id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 flex-1 truncate">{tech.technician_name}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tech.share_percentage}
                      onChange={(e) => {
                        const newValue = Math.min(100, Math.max(0, Number(e.target.value)))
                        const newShares = [...technicianShares]
                        newShares[idx] = { ...tech, share_percentage: newValue }

                        // Fördela resterande bland andra tekniker
                        const remaining = 100 - newValue
                        const otherIndices = newShares.map((_, i) => i).filter(i => i !== idx)

                        if (otherIndices.length === 1) {
                          newShares[otherIndices[0]] = { ...newShares[otherIndices[0]], share_percentage: remaining }
                        } else if (otherIndices.length > 1) {
                          const othersTotal = otherIndices.reduce((s, i) => s + technicianShares[i].share_percentage, 0)
                          let distributed = 0
                          otherIndices.forEach((oi, j) => {
                            if (j === otherIndices.length - 1) {
                              newShares[oi] = { ...newShares[oi], share_percentage: remaining - distributed }
                            } else {
                              const proportion = othersTotal > 0 ? technicianShares[oi].share_percentage / othersTotal : 1 / otherIndices.length
                              const share = Math.round(remaining * proportion)
                              newShares[oi] = { ...newShares[oi], share_percentage: share }
                              distributed += share
                            }
                          })
                        }

                        onSharesChange(newShares)
                      }}
                      className="w-16 px-2 py-1 text-sm text-right bg-slate-800 border border-slate-600 rounded text-slate-200 focus:ring-[#20c58f] focus:border-[#20c58f]"
                      disabled={existingPostCount > 0}
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                  {calculations && calculations[idx] && (
                    <span className="text-sm font-medium text-emerald-400 w-24 text-right">
                      {calculations[idx].commission_amount.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Varning om andelar inte summerar till 100% */}
            {technicianShares.length > 0 && (() => {
              const total = technicianShares.reduce((s, t) => s + t.share_percentage, 0)
              if (Math.abs(total - 100) > 0.01) {
                return (
                  <p className="text-xs text-red-400 mt-1">
                    Andelarna summerar till {total}% — måste vara 100%
                  </p>
                )
              }
              return null
            })()}
          </div>

          {/* Avdrag */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Avdrag (underentreprenörskostnader)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={deductions || ''}
                onChange={(e) => onDeductionsChange(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-32 px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:ring-[#20c58f] focus:border-[#20c58f]"
                disabled={existingPostCount > 0}
              />
              <span className="text-xs text-slate-400">kr</span>
            </div>
            {subcontractorDeduction > 0 && (
              <p className="text-xs text-cyan-400 mt-1">
                Varav {new Intl.NumberFormat('sv-SE').format(subcontractorDeduction)} kr från underentreprenörsartiklar
              </p>
            )}
          </div>

          {/* Anteckningar */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Anteckningar (valfritt)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="T.ex. fördelning, godkännande, specialfall..."
              rows={2}
              className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:ring-[#20c58f] focus:border-[#20c58f] resize-none"
              disabled={existingPostCount > 0}
            />
          </div>

          {/* Total provision */}
          {!belowThreshold && totalCommission > 0 && (
            <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-sm text-slate-400">Total provision:</span>
              <span className="text-lg font-bold text-emerald-400">
                {totalCommission.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
