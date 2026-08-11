// src/pages/shared/intranet/AudienceModal.tsx
// Admin väljer vilka som ser ett intranätdokument:
// alla interna roller, specifika roller och/eller utvalda användare.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { X, Eye, Loader2, Users } from 'lucide-react'
import { IntranetService } from '../../../services/intranetService'
import { AUDIENCE_ROLE_OPTIONS, type IntranetDocument } from '../../../types/intranet'

interface AudienceModalProps {
  doc: IntranetDocument
  onClose: () => void
  onSaved: (roles: string[] | null, userIds: string[] | null) => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
  'säljare': 'Säljare',
}

export default function AudienceModal({ doc, onClose, onSaved }: AudienceModalProps) {
  const initialMode = (doc.audience_roles?.length || doc.audience_user_ids?.length) ? 'begransad' : 'alla'
  const [mode, setMode] = useState<'alla' | 'begransad'>(initialMode)
  const [roles, setRoles] = useState<Set<string>>(new Set(doc.audience_roles || []))
  const [userIds, setUserIds] = useState<Set<string>>(new Set(doc.audience_user_ids || []))
  const [users, setUsers] = useState<{ user_id: string; name: string; role: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    IntranetService.getInternalUsers()
      .then(setUsers)
      .catch(() => toast.error('Kunde inte ladda användarlistan'))
      .finally(() => setLoadingUsers(false))
  }, [])

  const toggle = <T,>(set: Set<T>, value: T, setter: (next: Set<T>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const handleSave = async () => {
    if (saving) return
    const nextRoles = mode === 'alla' ? null : [...roles]
    const nextUsers = mode === 'alla' ? null : [...userIds]
    if (mode === 'begransad' && roles.size === 0 && userIds.size === 0) {
      toast.error('Välj minst en roll eller användare - eller välj Alla roller')
      return
    }
    setSaving(true)
    try {
      await IntranetService.setAudience(doc.id, nextRoles, nextUsers)
      toast.success('Synligheten uppdaterad')
      onSaved(nextRoles && nextRoles.length > 0 ? nextRoles : null, nextUsers && nextUsers.length > 0 ? nextUsers : null)
    } catch {
      toast.error('Kunde inte spara synligheten')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
            <h2 className="text-sm font-semibold text-white truncate">Synlighet: {doc.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Läge */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
              <input
                type="radio"
                checked={mode === 'alla'}
                onChange={() => setMode('alla')}
                className="h-4 w-4 bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <div>
                <span className="text-sm font-medium text-slate-300">Alla roller</span>
                <p className="text-xs text-slate-500">Dokumentet syns för alla interna medarbetare</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
              <input
                type="radio"
                checked={mode === 'begransad'}
                onChange={() => setMode('begransad')}
                className="h-4 w-4 bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <div>
                <span className="text-sm font-medium text-slate-300">Begränsad</span>
                <p className="text-xs text-slate-500">Välj roller och/eller enskilda användare - träff på någon räcker</p>
              </div>
            </label>
          </div>

          {mode === 'begransad' && (
            <>
              {/* Roller */}
              <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                <p className="text-xs font-medium text-slate-400 mb-2">Roller</p>
                <div className="flex flex-wrap gap-1.5">
                  {AUDIENCE_ROLE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggle(roles, option.value, setRoles)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        roles.has(option.value)
                          ? 'bg-[#20c58f] border-[#20c58f] text-[#fff]'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enskilda användare */}
              <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-medium text-slate-400">Enskilda användare (utöver rollerna)</p>
                </div>
                {loadingUsers ? (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {users.map(user => (
                      <label
                        key={user.user_id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={userIds.has(user.user_id)}
                          onChange={() => toggle(userIds, user.user_id, setUserIds)}
                          className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
                        />
                        <span className="text-sm text-slate-300 flex-1 truncate">{user.name}</span>
                        <span className="text-[11px] text-slate-500">{ROLE_LABEL[user.role] || user.role}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <p className="text-xs text-slate-500">
            Admin ser alltid alla dokument. Kräver dokumentet kvittens räknas bara de som ser det.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] hover:bg-[#1ab37e] disabled:opacity-60 text-[#fff] rounded-lg text-sm font-semibold transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Spara
          </button>
        </div>
      </div>
    </div>
  )
}
