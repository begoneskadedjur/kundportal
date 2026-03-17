import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Eye,
  Copy,
  Info,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

interface SmsTemplate {
  id: string
  name: string
  slug: string
  body: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const AVAILABLE_VARIABLES = [
  { key: 'kundnamn', description: 'Kundens namn' },
  { key: 'datum', description: 'Bokningsdatum (t.ex. 17 mars)' },
  { key: 'tid', description: 'Exakt klockslag (t.ex. 10:00)' },
  { key: 'starttid', description: 'Starttid för tidsspann' },
  { key: 'sluttid', description: 'Sluttid för tidsspann' },
  { key: 'adress', description: 'Kundens adress' },
  { key: 'skadedjur', description: 'Typ av skadedjur' },
  { key: 'tekniker', description: 'Teknikerns namn' },
]

const EXAMPLE_VALUES: Record<string, string> = {
  kundnamn: 'Anna Svensson',
  datum: '17 mars',
  tid: '10:00',
  starttid: '10:00',
  sluttid: '12:00',
  adress: 'Storgatan 5, Stockholm',
  skadedjur: 'Råttor',
  tekniker: 'Kim Wahlberg',
}

export function SmsTemplatesSettings() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '', body: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTemplates() }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      setTemplates(data || [])
    } catch {
      toast.error('Kunde inte ladda SMS-mallar')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setFormData({ name: '', slug: '', body: '', description: '' })
    setIsCreating(true)
    setEditingTemplate(null)
    setShowPreview(false)
  }

  const openEdit = (template: SmsTemplate) => {
    setFormData({
      name: template.name,
      slug: template.slug,
      body: template.body,
      description: template.description || '',
    })
    setEditingTemplate(template)
    setIsCreating(false)
    setShowPreview(false)
  }

  const closeForm = () => {
    setEditingTemplate(null)
    setIsCreating(false)
    setShowPreview(false)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.body) {
      toast.error('Namn, slug och meddelandetext krävs')
      return
    }

    setSaving(true)
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('sms_templates')
          .update({
            name: formData.name,
            slug: formData.slug,
            body: formData.body,
            description: formData.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id)
        if (error) throw error
        toast.success('Mall uppdaterad')
      } else {
        const { error } = await supabase
          .from('sms_templates')
          .insert({
            name: formData.name,
            slug: formData.slug,
            body: formData.body,
            description: formData.description || null,
          })
        if (error) throw error
        toast.success('Mall skapad')
      }
      closeForm()
      loadTemplates()
    } catch (error: any) {
      if (error?.message?.includes('unique') || error?.code === '23505') {
        toast.error('En mall med denna slug finns redan')
      } else {
        toast.error(error?.message || 'Kunde inte spara mall')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (template: SmsTemplate) => {
    try {
      const { error } = await supabase
        .from('sms_templates')
        .update({ is_active: !template.is_active, updated_at: new Date().toISOString() })
        .eq('id', template.id)
      if (error) throw error
      toast.success(template.is_active ? 'Mall inaktiverad' : 'Mall aktiverad')
      loadTemplates()
    } catch {
      toast.error('Kunde inte ändra status')
    }
  }

  const handleDelete = async (template: SmsTemplate) => {
    if (!window.confirm(`Vill du ta bort mallen "${template.name}"?`)) return
    try {
      const { error } = await supabase
        .from('sms_templates')
        .delete()
        .eq('id', template.id)
      if (error) throw error
      toast.success('Mall borttagen')
      loadTemplates()
    } catch {
      toast.error('Kunde inte ta bort mall')
    }
  }

  const insertVariable = (key: string) => {
    setFormData(prev => ({ ...prev, body: prev.body + `{{${key}}}` }))
  }

  const getPreviewText = (body: string) => {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => EXAMPLE_VALUES[key] || `{{${key}}}`)
  }

  const isFormOpen = isCreating || editingTemplate !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">SMS Mallar</h1>
            <p className="text-sm text-slate-400">Hantera meddelandemallar för bokningsbekräftelser och andra utskick</p>
          </div>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} className="mr-1" /> Ny mall
        </Button>
      </div>

      {/* Mallista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga SMS-mallar skapade</p>
          <Button variant="primary" onClick={openCreate} className="mt-4">
            <Plus size={16} className="mr-1" /> Skapa första mallen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {templates.map(template => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border ${
                  template.is_active
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-800/20 border-slate-700/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare size={16} className="text-[#20c58f] flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-white truncate">{template.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-mono">
                        {template.slug}
                      </span>
                      {!template.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Inaktiv</span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-slate-500 mb-2">{template.description}</p>
                    )}
                    <p className="text-sm text-slate-300 bg-slate-900/50 rounded-lg px-3 py-2 font-mono text-xs leading-relaxed">
                      {template.body}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      title={template.is_active ? 'Inaktivera' : 'Aktivera'}
                    >
                      {template.is_active
                        ? <ToggleRight size={18} className="text-[#20c58f]" />
                        : <ToggleLeft size={18} className="text-slate-500" />
                      }
                    </button>
                    <button
                      onClick={() => openEdit(template)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Redigera"
                    >
                      <Edit2 size={16} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Ta bort"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Skapa/Redigera formulär */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && closeForm()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">
                  {editingTemplate ? 'Redigera mall' : 'Ny SMS-mall'}
                </h2>
                <button onClick={closeForm} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Namn</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="T.ex. Bokningsbekräftelse"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-[#20c58f] focus:border-[#20c58f]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Slug (unik identifierare)</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                      placeholder="T.ex. booking_first_time"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-[#20c58f] focus:border-[#20c58f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning (valfritt)</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Intern beskrivning av mallen"
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-[#20c58f] focus:border-[#20c58f]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-400">Meddelandetext</label>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <Eye size={12} />
                      {showPreview ? 'Dölj förhandsgranskning' : 'Förhandsgranska'}
                    </button>
                  </div>
                  <textarea
                    value={formData.body}
                    onChange={e => setFormData(prev => ({ ...prev, body: e.target.value }))}
                    rows={4}
                    placeholder="Skriv ditt meddelande här. Använd {{variabel}} för dynamiskt innehåll."
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-[#20c58f] focus:border-[#20c58f]"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {formData.body.length} tecken {formData.body.length > 160 && `(${Math.ceil(formData.body.length / 153)} SMS-delar)`}
                  </div>
                </div>

                {/* Preview */}
                {showPreview && formData.body && (
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Eye size={14} className="text-slate-400" />
                      <span className="text-xs font-medium text-slate-400">Förhandsgranskning</span>
                    </div>
                    <div className="bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg px-3 py-2">
                      <p className="text-sm text-white leading-relaxed">{getPreviewText(formData.body)}</p>
                    </div>
                  </div>
                )}

                {/* Variabler */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Info size={14} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-400">Tillgängliga variabler</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_VARIABLES.map(v => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md transition-colors group"
                        title={v.description}
                      >
                        <Copy size={10} className="text-slate-500 group-hover:text-[#20c58f]" />
                        <span className="text-xs font-mono text-slate-300">{`{{${v.key}}}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
                <Button variant="secondary" onClick={closeForm}>Avbryt</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin mr-1" /> : <Save size={16} className="mr-1" />}
                  {editingTemplate ? 'Spara ändringar' : 'Skapa mall'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
