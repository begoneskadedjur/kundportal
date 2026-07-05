// src/components/admin/settings/OneflowTemplatesSettings.tsx
// Admin-CRUD för dynamiska Oneflow-avtalsmallar (tabellen oneflow_templates).
// Avaktivera = mallen försvinner ur avtals-/offertwizarden men webhook och
// nattsync känner fortfarande igen befintliga avtal. Hård radering är spärrad
// så länge avtal i systemet refererar mallen - annars skulle nattsyncen
// trasha dem (se skill externa-integrationer, Fallgropar).

import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, Star, Trash2, AlertTriangle, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { OneflowTemplateService, type OneflowTemplateRow } from '../../../services/oneflowTemplateService'

const EMPTY_FORM = {
  oneflow_template_id: '',
  name: '',
  type: 'contract' as 'contract' | 'offer',
  category: 'company' as 'company' | 'individual'
}

export default function OneflowTemplatesSettings() {
  const [templates, setTemplates] = useState<OneflowTemplateRow[]>([])
  const [contractCounts, setContractCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    try {
      const [rows, counts] = await Promise.all([
        OneflowTemplateService.getAll(),
        OneflowTemplateService.getContractCounts()
      ])
      setTemplates(rows)
      setContractCounts(counts)
    } catch (err) {
      console.error('Kunde inte ladda mallar:', err)
      toast.error('Kunde inte ladda avtalsmallar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!/^\d+$/.test(form.oneflow_template_id.trim())) {
      toast.error('Oneflow-ID måste vara numeriskt (mallens ID i Oneflow)')
      return
    }
    if (!form.name.trim()) {
      toast.error('Ange ett visningsnamn')
      return
    }
    setSaving(true)
    try {
      await OneflowTemplateService.create({
        oneflow_template_id: form.oneflow_template_id,
        name: form.name,
        type: form.type,
        category: form.type === 'offer' ? form.category : null
      })
      toast.success('Mall tillagd - den är nu valbar i wizarden och igenkänd av webhook/sync')
      setForm(EMPTY_FORM)
      setShowAddForm(false)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg.includes('duplicate') ? 'Mall-ID:t finns redan' : `Kunde inte lägga till: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (t: OneflowTemplateRow) => {
    setSaving(true)
    try {
      await OneflowTemplateService.update(t.id, { is_active: !t.is_active })
      toast.success(t.is_active
        ? `${t.name} avaktiverad - försvinner ur wizarden, befintliga avtal påverkas inte`
        : `${t.name} aktiverad - valbar i wizarden igen`)
      await load()
    } catch {
      toast.error('Kunde inte ändra status')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePopular = async (t: OneflowTemplateRow) => {
    try {
      await OneflowTemplateService.update(t.id, { popular: !t.popular })
      await load()
    } catch {
      toast.error('Kunde inte ändra populär-markering')
    }
  }

  const handleDelete = async (t: OneflowTemplateRow) => {
    const count = contractCounts[t.oneflow_template_id] ?? 0
    if (count > 0) return
    if (!window.confirm(`Radera mallen "${t.name}" permanent? Detta går inte att ångra.`)) return
    setSaving(true)
    try {
      await OneflowTemplateService.remove(t.id)
      toast.success('Mall raderad')
      await load()
    } catch {
      toast.error('Kunde inte radera mallen')
    } finally {
      setSaving(false)
    }
  }

  const renderGroup = (type: 'contract' | 'offer', title: string) => {
    const group = templates.filter(t => t.type === type)
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        {group.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Inga mallar</p>
        ) : (
          <div className="space-y-2">
            {group.map(t => {
              const count = contractCounts[t.oneflow_template_id] ?? 0
              return (
                <div key={t.id} className={`flex items-center justify-between px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-lg ${!t.is_active ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePopular(t)}
                      title={t.popular ? 'Ta bort populär-markering' : 'Markera som populär'}
                      className="shrink-0"
                    >
                      <Star className={`w-4 h-4 ${t.popular ? 'text-[#20c58f] fill-[#20c58f]' : 'text-slate-600'}`} />
                    </button>
                    <div className="min-w-0">
                      <span className="text-sm text-white font-medium">{t.name}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        ID {t.oneflow_template_id}
                        {t.category ? ` · ${t.category === 'company' ? 'Företag' : 'Privatperson'}` : ''}
                        {` · ${count} avtal i systemet`}
                        {!t.is_active ? ' · AVAKTIVERAD' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => handleToggleActive(t)}
                      disabled={saving}
                      title={t.is_active ? 'Avaktivera (dölj i wizarden)' : 'Aktivera'}
                      className={`p-1.5 rounded-lg transition-colors ${t.is_active ? 'text-[#20c58f] hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-700'}`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={saving || count > 0}
                      title={count > 0 ? `Kan inte raderas: ${count} avtal refererar mallen. Avaktivera i stället.` : 'Radera permanent'}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p className="text-sm text-slate-400 py-4">Laddar avtalsmallar...</p>

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[#20c58f]" />
          <h2 className="text-sm font-semibold text-white">Oneflow-avtalsmallar</h2>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Lägg till mall
        </Button>
      </div>

      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300">
            <strong>Avaktivera</strong> döljer mallen i avtals-/offertwizarden - befintliga avtal
            fortsätter synkas som vanligt. <strong>Radera</strong> är bara möjligt när inga avtal
            refererar mallen. En ny mall blir direkt igenkänd av webhook och nattsync; för att
            fältdata ska läsas in korrekt måste mallens fält i Oneflow ha custom-id:n satta
            (standard i era mallar).
          </p>
        </div>
      </div>

      {showAddForm && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Oneflow mall-ID</label>
              <input
                type="text"
                value={form.oneflow_template_id}
                onChange={e => setForm(f => ({ ...f, oneflow_template_id: e.target.value }))}
                placeholder="t.ex. 8486368"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Visningsnamn</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="t.ex. Avtal Fågelsäkring"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Typ</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'contract' | 'offer' }))}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              >
                <option value="contract">Avtal</option>
                <option value="offer">Offert</option>
              </select>
            </div>
            {form.type === 'offer' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kategori</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as 'company' | 'individual' }))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                >
                  <option value="company">Företag</option>
                  <option value="individual">Privatperson</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
            <Button variant="secondary" size="sm" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM) }}>Avbryt</Button>
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={saving}>Spara mall</Button>
          </div>
        </div>
      )}

      {renderGroup('contract', 'Avtalsmallar')}
      {renderGroup('offer', 'Offertmallar')}
    </div>
  )
}
