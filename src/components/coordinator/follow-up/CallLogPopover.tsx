// src/components/coordinator/follow-up/CallLogPopover.tsx
// Lätt popover för att logga ett samtal + ev. planera uppföljning ("ring åter").
// Koordinatorn ska aldrig lämna kön — därför popover, inte modal.
import { useState } from 'react'
import { Phone, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'

interface CallLogPopoverProps {
  contractId: string
  companyName: string
  byName?: string | null
  byEmail?: string | null
  onClose: () => void
  onSaved: () => void
}

type Outcome = 'reached' | 'voicemail' | 'no_answer'

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: 'reached', label: 'Nådde kunden' },
  { key: 'voicemail', label: 'Röstbrevlåda' },
  { key: 'no_answer', label: 'Inget svar' },
]

function isoDatePlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().substring(0, 10)
}

function nextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + ((8 - day) % 7 || 7))
  return d.toISOString().substring(0, 10)
}

export default function CallLogPopover({
  contractId, companyName, byName, byEmail, onClose, onSaved,
}: CallLogPopoverProps) {
  const [outcome, setOutcome] = useState<Outcome>('reached')
  const [note, setNote] = useState('')
  const [followUpAt, setFollowUpAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const quickChoices: { label: string; value: string | null }[] = [
    { label: 'Ingen', value: null },
    { label: 'Imorgon', value: isoDatePlus(1) },
    { label: 'Om 3 d', value: isoDatePlus(3) },
    { label: 'Måndag', value: nextMonday() },
  ]

  const handleSave = async () => {
    setSaving(true)
    try {
      await OfferFollowUpService.logCall(contractId, {
        outcome,
        note: note.trim() || null,
        followUpAt,
        byName: byName || null,
        byEmail: byEmail || null,
      })
      toast.success(followUpAt ? `Samtal loggat — ringer åter ${followUpAt}` : 'Samtal loggat')
      onSaved()
    } catch (err) {
      console.error('logCall:', err)
      toast.error('Kunde inte logga samtalet')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5 text-[#20c58f]" />
        <p className="text-sm font-semibold text-white truncate">Logga samtal · {companyName}</p>
      </div>

      {/* Utfall */}
      <div className="flex gap-1">
        {OUTCOMES.map(o => (
          <button
            key={o.key}
            onClick={() => setOutcome(o.key)}
            className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
              outcome === o.key
                ? 'bg-[#20c58f]/15 border-[#20c58f] text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Anteckning */}
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Anteckning (valfritt)…"
        rows={2}
        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
      />

      {/* Ring åter */}
      <div>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Ring åter</p>
        <div className="flex items-center gap-1 flex-wrap">
          {quickChoices.map(c => (
            <button
              key={c.label}
              onClick={() => setFollowUpAt(c.value)}
              className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                followUpAt === c.value
                  ? 'bg-[#20c58f]/15 border-[#20c58f] text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {c.label}
            </button>
          ))}
          <input
            type="date"
            value={followUpAt || ''}
            onChange={e => setFollowUpAt(e.target.value || null)}
            className="px-2 py-1 text-[11px] bg-slate-800 border border-slate-700 rounded-md text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-slate-700/50">
        <button onClick={onClose} className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          Avbryt
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-lg transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Spara
        </button>
      </div>
    </div>
  )
}
