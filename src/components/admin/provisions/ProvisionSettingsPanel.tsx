import { useState } from 'react'
import { Settings, Save, X } from 'lucide-react'
import { ProvisionService } from '../../../services/provisionService'
import type { CommissionSettings } from '../../../types/provision'
import toast from 'react-hot-toast'

interface ProvisionSettingsPanelProps {
  settings: CommissionSettings
  onSettingsUpdated: () => void
  onClose: () => void
  userEmail: string
}

export default function ProvisionSettingsPanel({
  settings,
  onSettingsUpdated,
  onClose,
  userEmail
}: ProvisionSettingsPanelProps) {
  const [percentage, setPercentage] = useState(settings.engangsjobb_percentage)
  const [minBase, setMinBase] = useState(settings.min_commission_base)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (percentage !== settings.engangsjobb_percentage) {
        await ProvisionService.updateSetting('engangsjobb_percentage', percentage, userEmail)
      }
      if (minBase !== settings.min_commission_base) {
        await ProvisionService.updateSetting('min_commission_base', minBase, userEmail)
      }
      toast.success('Inställningar sparade')
      onSettingsUpdated()
      onClose()
    } catch (err: any) {
      toast.error(`Kunde inte spara: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-slate-400" />
          Provisionsinställningar
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">
            Provisionsprocent engångsjobb
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={percentage}
              onChange={e => setPercentage(Number(e.target.value))}
              className="w-24 px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:ring-[#20c58f] focus:border-[#20c58f]"
            />
            <span className="text-sm text-slate-400">%</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">
            Minsta provisionsgrundande belopp
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={100}
              value={minBase}
              onChange={e => setMinBase(Number(e.target.value))}
              className="w-32 px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:ring-[#20c58f] focus:border-[#20c58f]"
            />
            <span className="text-sm text-slate-400">kr exkl moms</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#20c58f] hover:bg-[#1ab37e] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Sparar...' : 'Spara'}
        </button>
      </div>
    </div>
  )
}
