// src/components/admin/procurement/workshop/RequirementsList.tsx
// Anbudsverkstad a) Kravlista: skallkrav, börkrav, bevis och kvalitetskriterier
// med sidhänvisning, ansvarig, klar och bilaga. AI skapar första versionen ur
// underlaget; listan granskas alltid av en människa.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Trash2 } from 'lucide-react'
import { ProcurementService, type ProcurementManagerProfile } from '../../../../services/procurementService'
import {
  REQUIREMENT_TYPE_LABEL,
  type ProcurementDocument,
  type ProcurementRequirement,
  type ProcurementRequirementType,
} from '../../../../types/procurement'
import { EmptyState, LinkButton } from '../ui'
import { BlurText, NumberField, SubHeading, checkboxCls, inputCls, selectCls } from '../detail/fields'
import { errMsg, useConfirm } from '../detail/helpers'

const TYPES = Object.keys(REQUIREMENT_TYPE_LABEL) as ProcurementRequirementType[]
const NOTE = '__note__'

interface Props {
  noticeId: string
  requirements: ProcurementRequirement[]
  documents: ProcurementDocument[]
  managers: ProcurementManagerProfile[]
  onChanged: () => void
}

export default function RequirementsList({ noticeId, requirements, documents, managers, onChanged }: Props) {
  const [filter, setFilter] = useState<'all' | ProcurementRequirementType>('all')
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<ProcurementRequirementType>('skall')
  const [adding, setAdding] = useState(false)
  const [noteOpen, setNoteOpen] = useState<Set<string>>(new Set())
  const { confirm, node: confirmNode } = useConfirm()

  const visible = filter === 'all' ? requirements : requirements.filter((r) => r.req_type === filter)
  const hasAi = requirements.some((r) => r.source === 'ai')
  const doneCount = requirements.filter((r) => r.done).length

  const patch = async (r: ProcurementRequirement, p: Partial<ProcurementRequirement>) => {
    try {
      // created_by skickas med så att servicen inte skriver över skaparen
      await ProcurementService.saveRequirement({ id: r.id, notice_id: noticeId, created_by: r.created_by, ...p })
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara kravet'))
    }
  }

  const add = async () => {
    if (!newText.trim()) return
    setAdding(true)
    try {
      const maxSort = requirements.reduce((m, r) => Math.max(m, r.sort_order), 0)
      await ProcurementService.saveRequirement({ notice_id: noticeId, text: newText.trim(), req_type: newType, source: 'manual', sort_order: maxSort + 10 })
      setNewText('')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte lägga till kravet'))
    } finally {
      setAdding(false)
    }
  }

  const remove = (r: ProcurementRequirement) =>
    confirm('Ta bort krav', `Ta bort "${r.text.slice(0, 80)}"?`, async () => {
      try {
        await ProcurementService.deleteRequirement(r.id)
        onChanged()
      } catch (e) {
        toast.error(errMsg(e, 'Kunde inte ta bort kravet'))
      }
    })

  return (
    <div>
      <SubHeading
        action={
          <select className={`${selectCls} w-auto py-1`} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtrera på typ">
            <option value="all">Alla typer ({requirements.length})</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUIREMENT_TYPE_LABEL[t]} ({requirements.filter((r) => r.req_type === t).length})
              </option>
            ))}
          </select>
        }
      >
        Kravlista, {doneCount} av {requirements.length} klara
      </SubHeading>

      {hasAi && (
        <p className="flex items-center gap-1.5 text-[11.5px] text-amber-400/90 mb-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          Rader märkta AI är utlästa ur underlaget. En människa ska granska hela listan mot underlaget innan anbudet lämnas.
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState title={requirements.length === 0 ? 'Kravlistan är tom' : 'Inga krav av den typen'} hint={requirements.length === 0 ? 'Ladda upp underlaget så skapar AI ett förslag, eller lägg till krav nedan.' : undefined} />
      ) : (
        <ul className="divide-y divide-slate-800 border-y border-slate-800 -mx-4">
          {visible.map((r) => {
            const attachValue = r.attachment_document_id ?? (r.attachment_note || noteOpen.has(r.id) ? NOTE : '')
            return (
              <li key={r.id} className={`px-4 py-2.5 ${r.done ? 'bg-slate-900/30' : ''}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" className={`${checkboxCls} mt-2`} checked={r.done} onChange={(e) => void patch(r, { done: e.target.checked })} aria-label="Klar" />
                  <div className="flex-1 min-w-0">
                    <BlurText value={r.text} multiline rows={1} onCommit={(v) => v && void patch(r, { text: v })} className={r.done ? 'text-slate-500 line-through' : ''} ariaLabel="Kravtext" />
                  </div>
                  {r.source === 'ai' && <span className="mt-2 text-[10.5px] text-amber-400/80 shrink-0" title="Utläst av AI">AI</span>}
                  <button type="button" onClick={() => remove(r)} className="mt-1.5 p-1 text-slate-600 hover:text-red-400 shrink-0" aria-label="Ta bort krav">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 ml-5 grid grid-cols-2 sm:grid-cols-[110px_80px_80px_1fr_1.3fr] gap-2">
                  <select className={selectCls} value={r.req_type} onChange={(e) => void patch(r, { req_type: e.target.value as ProcurementRequirementType })} aria-label="Typ">
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{REQUIREMENT_TYPE_LABEL[t]}</option>
                    ))}
                  </select>
                  <NumberField value={r.weight} commitOnBlur onChange={(n) => void patch(r, { weight: n })} placeholder="Vikt" ariaLabel="Vikt" />
                  <BlurText value={r.page} onCommit={(v) => void patch(r, { page: v })} placeholder="Sida" ariaLabel="Sida" />
                  <select className={selectCls} value={r.owner_id ?? ''} onChange={(e) => void patch(r, { owner_id: e.target.value || null })} aria-label="Ansvarig">
                    <option value="">Ingen ansvarig</option>
                    {managers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>
                    ))}
                  </select>
                  <select
                    className={`${selectCls} col-span-2 sm:col-span-1`}
                    value={attachValue}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === NOTE) {
                        setNoteOpen((s) => new Set(s).add(r.id))
                        if (r.attachment_document_id) void patch(r, { attachment_document_id: null })
                      } else {
                        setNoteOpen((s) => {
                          const n = new Set(s)
                          n.delete(r.id)
                          return n
                        })
                        void patch(r, { attachment_document_id: v || null, attachment_note: null })
                      }
                    }}
                    aria-label="Bilaga"
                  >
                    <option value="">Ingen bilaga</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>{d.file_name}</option>
                    ))}
                    <option value={NOTE}>Fri anteckning</option>
                  </select>
                </div>
                {attachValue === NOTE && (
                  <div className="mt-1.5 ml-5">
                    <BlurText value={r.attachment_note} onCommit={(v) => void patch(r, { attachment_note: v })} placeholder="T.ex. F-skattsedel hämtas från Skatteverket" ariaLabel="Bilageanteckning" />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <input
          className={inputCls}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
          placeholder="Nytt krav"
          aria-label="Nytt krav"
        />
        <select className={`${selectCls} sm:w-36`} value={newType} onChange={(e) => setNewType(e.target.value as ProcurementRequirementType)} aria-label="Typ för nytt krav">
          {TYPES.map((t) => (
            <option key={t} value={t}>{REQUIREMENT_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <LinkButton onClick={() => void add()} disabled={adding || !newText.trim()}>
          Lägg till
        </LinkButton>
      </div>
      {confirmNode}
    </div>
  )
}
