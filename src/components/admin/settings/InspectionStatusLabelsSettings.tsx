// src/components/admin/settings/InspectionStatusLabelsSettings.tsx
// Admin-inställningar för inspektionsstatusetiketter

import { useState, useEffect } from 'react'
import { Activity, Save, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

interface StatusLabelRow {
  id: string
  level: string
  label: string
  color: string
}

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  none:   'Mätvärde = 0 (ingen förbrukning)',
  low:    'Mätvärde > 0 men under varningsnivån',
  medium: 'Mätvärde >= varningsnivå men under kritisk nivå',
  high:   'Mätvärde >= kritisk nivå',
}

const LEVEL_ORDER = ['none', 'low', 'medium', 'high']

export function InspectionStatusLabelsSettings() {
  const [rows, setRows] = useState<StatusLabelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('inspection_status_labels')
      .select('id, level, label, color')
      .then(({ data, error }) => {
        if (error) { toast.error('Kunde inte hämta statusetiketter'); return }
        const sorted = (data || []).sort(
          (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
        )
        setRows(sorted)
        setLoading(false)
      })
  }, [])

  const handleSave = async (row: StatusLabelRow) => {
    setSaving(row.level)
    const { error } = await supabase
      .from('inspection_status_labels')
      .update({ label: row.label, color: row.color })
      .eq('id', row.id)

    setSaving(null)
    if (error) {
      toast.error('Kunde inte spara: ' + error.message)
    } else {
      toast.success('Sparat!')
    }
  }

  const updateRow = (level: string, field: 'label' | 'color', value: string) => {
    setRows(prev => prev.map(r => r.level === level ? { ...r, [field]: value } : r))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#20c58f20' }}>
          <Activity className="w-5 h-5" style={{ color: '#20c58f' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Inspektionsstatus</h1>
          <p className="text-sm text-slate-400">Anpassa namngivning och färg för varje aktivitetsnivå</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.level} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
            <div className="flex items-start gap-4">
              {/* Färgindikator */}
              <div className="flex-shrink-0 mt-1">
                <input
                  type="color"
                  value={row.color}
                  onChange={e => updateRow(row.level, 'color', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-600 bg-transparent"
                  title="Välj färg"
                />
              </div>

              {/* Info + redigering */}
              <div className="flex-grow space-y-2">
                <div className="text-xs text-slate-500 font-mono">{row.level}</div>
                <div className="text-xs text-slate-400">{LEVEL_DESCRIPTIONS[row.level] || ''}</div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={row.label}
                    onChange={e => updateRow(row.level, 'label', e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                    placeholder="Statusnamn..."
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSave(row)}
                    disabled={saving === row.level}
                    className="flex items-center gap-1.5"
                  >
                    {saving === row.level
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Save className="w-3.5 h-3.5" />
                    }
                    Spara
                  </Button>
                </div>
                {/* Förhandsgranskning */}
                <div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: `${row.color}20`, color: row.color }}
                  >
                    {row.label || '(tomt)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Ändringarna visas direkt i kundportalen och i nedladdade PDF-rapporter.
      </p>
    </div>
  )
}
