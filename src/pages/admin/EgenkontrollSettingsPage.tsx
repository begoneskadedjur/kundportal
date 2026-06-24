// src/pages/admin/EgenkontrollSettingsPage.tsx
// Admin-byggare för dynamiska egenkontroller per organisation (regionalkund).
// Välj organisation → bygg frågor (text, svarstyp ja/nej eller procent, ordna,
// aktivera/inaktivera) + avvikelse-toggle. Org utan egen mall ärver den globala
// standardmallen tills admin skapar en egen.

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Save, AlertCircle, Loader2, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import {
  EgenkontrollService,
  type EgenkontrollTemplate,
  type EgenkontrollQuestion,
  type EgenkontrollAnswerType,
} from '../../services/egenkontrollService'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'

interface RegionalOrg {
  organization_id: string
  name: string
}

const ANSWER_TYPE_OPTIONS = [
  { value: 'yes_no', label: 'Ja / Nej' },
  { value: 'percent', label: 'Procent (0–100%)' },
]

export default function EgenkontrollSettingsPage() {
  const [orgs, setOrgs] = useState<RegionalOrg[]>([])
  const [selectedOrg, setSelectedOrg] = useState<RegionalOrg | null>(null)
  const [template, setTemplate] = useState<EgenkontrollTemplate | null>(null)
  const [isInherited, setIsInherited] = useState(false) // true = visar global mall (org saknar egen)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Ladda organisationer (samma mönster som RonderingPage)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('customers')
        .select('organization_id, company_name')
        .eq('is_multisite', true)
        .eq('site_type', 'enhet')
        .not('organization_id', 'is', null)

      const seen = new Set<string>()
      const unique: RegionalOrg[] = []
      for (const row of data || []) {
        const orgId = (row as { organization_id: string | null; company_name: string | null }).organization_id
        if (orgId && !seen.has(orgId)) {
          seen.add(orgId)
          // Visa organisationsnamnet utan region-suffix
          const baseName = (row.company_name || orgId).split('—')[0].trim()
          unique.push({ organization_id: orgId, name: baseName })
        }
      }
      setOrgs(unique)
      if (unique.length > 0) setSelectedOrg(unique[0])
    }
    load()
  }, [])

  const loadTemplate = useCallback(async (org: RegionalOrg) => {
    setLoading(true)
    try {
      const own = await EgenkontrollService.getTemplateByOrganization(org.organization_id)
      if (own) {
        setTemplate(own)
        setIsInherited(false)
      } else {
        // Visa global standardmall i read-only-läge
        const global = await EgenkontrollService.getGlobalTemplate()
        setTemplate(global)
        setIsInherited(true)
      }
    } catch (err: any) {
      toast.error('Kunde inte ladda mallen: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedOrg) loadTemplate(selectedOrg)
  }, [selectedOrg, loadTemplate])

  // Skapa egen mall för organisationen (klona global)
  const handleCreateOwnTemplate = async () => {
    if (!selectedOrg) return
    setSaving(true)
    try {
      const created = await EgenkontrollService.createTemplateForOrganization(selectedOrg.organization_id)
      setTemplate(created)
      setIsInherited(false)
      toast.success('Egen mall skapad – nu kan du redigera frågorna')
    } catch (err: any) {
      toast.error('Kunde inte skapa mall: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const reload = () => selectedOrg && loadTemplate(selectedOrg)

  const handleToggleDeviations = async () => {
    if (!template || isInherited) return
    try {
      await EgenkontrollService.updateTemplate(template.id, { allow_deviations: !template.allow_deviations })
      setTemplate({ ...template, allow_deviations: !template.allow_deviations })
    } catch (err: any) {
      toast.error('Kunde inte uppdatera: ' + err.message)
    }
  }

  const handleAddQuestion = async () => {
    if (!template || isInherited) return
    try {
      await EgenkontrollService.addQuestion(template.id, {
        question_text: 'Ny fråga',
        answer_type: 'yes_no',
        sort_order: template.questions.length,
      })
      reload()
    } catch (err: any) {
      toast.error('Kunde inte lägga till fråga: ' + err.message)
    }
  }

  const handleUpdateQuestion = async (
    q: EgenkontrollQuestion,
    patch: Partial<Pick<EgenkontrollQuestion, 'question_text' | 'answer_type' | 'active'>>
  ) => {
    try {
      await EgenkontrollService.updateQuestion(q.id, patch)
      setTemplate(t => t ? { ...t, questions: t.questions.map(x => x.id === q.id ? { ...x, ...patch } : x) } : t)
    } catch (err: any) {
      toast.error('Kunde inte spara fråga: ' + err.message)
    }
  }

  const handleDeleteQuestion = async (q: EgenkontrollQuestion) => {
    if (!confirm(`Ta bort frågan "${q.question_text}"?`)) return
    try {
      await EgenkontrollService.deleteQuestion(q.id)
      reload()
    } catch (err: any) {
      toast.error('Kunde inte ta bort fråga: ' + err.message)
    }
  }

  const handleMove = async (index: number, dir: -1 | 1) => {
    if (!template) return
    const target = index + dir
    if (target < 0 || target >= template.questions.length) return
    const qs = [...template.questions]
    ;[qs[index], qs[target]] = [qs[target], qs[index]]
    const updates = qs.map((q, i) => ({ id: q.id, sort_order: i }))
    setTemplate({ ...template, questions: qs.map((q, i) => ({ ...q, sort_order: i })) })
    try {
      await EgenkontrollService.reorderQuestions(updates)
    } catch (err: any) {
      toast.error('Kunde inte ändra ordning: ' + err.message)
      reload()
    }
  }

  return (
    <div className="space-y-4">
      {/* Org-väljare */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[260px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Organisation (regionalkund)</label>
          <Select
            value={selectedOrg?.organization_id || ''}
            onChange={(v) => setSelectedOrg(orgs.find(o => o.organization_id === v) || null)}
            options={orgs.map(o => ({ value: o.organization_id, label: o.name }))}
            placeholder="Välj organisation..."
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#20c58f] animate-spin" />
        </div>
      ) : !template ? (
        <div className="text-center py-12 text-slate-400">Ingen mall hittades.</div>
      ) : (
        <div className="space-y-4">
          {/* Status: egen mall vs ärver global */}
          {isInherited && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-medium">Ärver standardmallen</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Den här organisationen har ingen egen egenkontroll. Den använder den globala standardmallen.
                  Skapa en egen för att kunna redigera frågorna.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={handleCreateOwnTemplate} loading={saving}>
                Skapa egen mall
              </Button>
            </div>
          )}

          {/* Inställningar */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <label className={`flex items-center gap-3 ${isInherited ? 'opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={template.allow_deviations}
                onChange={handleToggleDeviations}
                disabled={isInherited}
                className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">Tillåt avvikelserapportering</span>
                <p className="text-xs text-slate-500">Teknikern kan registrera avvikelser per station i egenkontrollen</p>
              </div>
            </label>
          </div>

          {/* Frågor */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-200">Frågor ({template.questions.length})</h3>
              {!isInherited && (
                <Button variant="primary" size="sm" onClick={handleAddQuestion}>
                  <Plus className="w-4 h-4" /> Lägg till fråga
                </Button>
              )}
            </div>

            {template.questions.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">Inga frågor ännu.</p>
            )}

            {template.questions.map((q, index) => (
              <div key={q.id} className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-start gap-2">
                {/* Ordning */}
                <div className="flex flex-col items-center pt-1.5">
                  {!isInherited ? (
                    <>
                      <button onClick={() => handleMove(index, -1)} disabled={index === 0}
                        className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleMove(index, 1)} disabled={index === template.questions.length - 1}
                        className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <GripVertical className="w-4 h-4 text-slate-600" />
                  )}
                </div>

                {/* Frågetext + svarstyp */}
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={q.question_text}
                    disabled={isInherited}
                    onChange={(e) => setTemplate(t => t ? { ...t, questions: t.questions.map(x => x.id === q.id ? { ...x, question_text: e.target.value } : x) } : t)}
                    onBlur={(e) => !isInherited && handleUpdateQuestion(q, { question_text: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] disabled:opacity-60"
                    placeholder="Frågetext, t.ex. 'Är X gjort?'"
                  />
                  <div className="flex items-center gap-3">
                    <div className="w-44">
                      <Select
                        value={q.answer_type}
                        onChange={(v) => handleUpdateQuestion(q, { answer_type: v as EgenkontrollAnswerType })}
                        options={ANSWER_TYPE_OPTIONS}
                        disabled={isInherited}
                      />
                    </div>
                    {!isInherited && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.active}
                          onChange={(e) => handleUpdateQuestion(q, { active: e.target.checked })}
                          className="h-3.5 w-3.5 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
                        />
                        <span className="text-xs text-slate-400">Aktiv</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Ta bort */}
                {!isInherited && (
                  <button onClick={() => handleDeleteQuestion(q)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors pt-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
