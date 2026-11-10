// src/components/admin/settings/PaymentBlockSettingsSection.tsx
// Inställningar för betalningsspärren (3.128.0) på /admin/installningar/betalningsvillkor:
// på/av, antal dagar efter förfallodagen, lägsta skuld och standardpaus vid
// hävning. Lagras i payment_block_settings (en rad, skriv admin/koordinator).

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { Icon } from '../../icons/Icon'
import { useAuth } from '../../../contexts/AuthContext'
import {
  PAYMENT_BLOCK_DEFAULTS,
  PaymentBlockService,
  type PaymentBlockSettings,
} from '../../../services/paymentBlockService'

export default function PaymentBlockSettingsSection() {
  const { profile } = useAuth()
  const [saved, setSaved] = useState<PaymentBlockSettings>(PAYMENT_BLOCK_DEFAULTS)
  const [enabled, setEnabled] = useState(true)
  const [days, setDays] = useState('20')
  const [minAmount, setMinAmount] = useState('100')
  const [pauseDays, setPauseDays] = useState('14')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    PaymentBlockService.getSettings()
      .then((s) => {
        setSaved(s)
        setEnabled(s.enabled)
        setDays(String(s.days_after_due))
        setMinAmount(String(s.min_amount))
        setPauseDays(String(s.default_pause_days))
      })
      .catch((err) => toast.error(err.message || 'Kunde inte läsa spärrinställningarna'))
      .finally(() => setLoading(false))
  }, [])

  const changed =
    enabled !== saved.enabled ||
    Number(days) !== saved.days_after_due ||
    Number(minAmount) !== saved.min_amount ||
    Number(pauseDays) !== saved.default_pause_days

  const handleSave = async () => {
    const d = parseInt(days, 10)
    const m = parseInt(minAmount, 10)
    const p = parseInt(pauseDays, 10)
    if (!Number.isFinite(d) || d < 0 || d > 365) return toast.error('Dagar efter förfallodagen: 0 till 365')
    if (!Number.isFinite(m) || m < 0) return toast.error('Lägsta skuld måste vara 0 kr eller mer')
    if (!Number.isFinite(p) || p < 1 || p > 365) return toast.error('Paus vid hävning: 1 till 365 dagar')
    setSaving(true)
    try {
      const next = { enabled, days_after_due: d, min_amount: m, default_pause_days: p }
      await PaymentBlockService.updateSettings(next, profile?.id ?? null)
      setSaved(next)
      toast.success('Spärrinställningarna sparade')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-24 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]'

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Icon name="allman.las" size={20} className="text-[#20c58f]" />
        Betalningsspärr
      </h2>
      <p className="text-sm text-slate-400 mb-3">
        Kunder med förfallna fakturor från portalen spärras automatiskt för nya bokningar. Bara fakturor som
        skapats i portalen och skickats till Fortnox räknas; fakturor som skickas direkt från Fortnox påverkas inte.
        ROT/RUT-avdrag som väntar hos Skatteverket räknas inte som kundens skuld. Kontrollen körs var 15:e minut och
        efter varje synk från Fortnox. Spärren hävs automatiskt när skulden är betald; manuella spärrar hävs bara på kundkortet.
      </p>

      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Laddar...</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded text-[#20c58f] focus:ring-[#20c58f]"
              />
              Betalningsspärren är på
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span>Spärra när fakturan är mer än</span>
              <input type="number" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
              <span>dagar efter förfallodagen</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span>och kundens förfallna skuld är mer än</span>
              <input type="number" min={0} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputClass} />
              <span>kr</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span>Hävs en automatisk spärr pausas automatiken i</span>
              <input type="number" min={1} max={365} value={pauseDays} onChange={(e) => setPauseDays(e.target.value)} className={inputClass} />
              <span>dagar (förslag, kan ändras vid hävningen)</span>
            </div>
            {changed && (
              <div className="pt-2 border-t border-slate-700/50">
                <Button size="sm" onClick={handleSave} loading={saving} disabled={saving}>
                  Spara
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
