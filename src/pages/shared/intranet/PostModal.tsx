// src/pages/shared/intranet/PostModal.tsx
// Skapa/redigera anslag på intranätets anslagstavla (admin + koordinator)

import { useState } from 'react'
import toast from 'react-hot-toast'
import { X, Megaphone, Loader2 } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { IntranetService } from '../../../services/intranetService'
import type { IntranetPost } from '../../../types/intranet'

interface PostModalProps {
  post: IntranetPost | null
  onClose: () => void
  onSaved: () => void
}

export default function PostModal({ post, onClose, onSaved }: PostModalProps) {
  const { user, profile } = useAuth()
  const [title, setTitle] = useState(post?.title || '')
  const [body, setBody] = useState(post?.body || '')
  const [pinned, setPinned] = useState(post?.pinned || false)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !user?.id || saving) return
    setSaving(true)
    try {
      if (post) {
        await IntranetService.updatePost(post.id, { title: title.trim(), body: body.trim(), pinned })
        toast.success('Anslaget uppdaterat')
      } else {
        await IntranetService.createPost({
          title: title.trim(),
          body: body.trim(),
          pinned,
          author_user_id: user.id,
          author_name: profile?.display_name || profile?.email || null,
        })
        toast.success('Anslaget publicerat')
      }
      onSaved()
    } catch {
      toast.error('Kunde inte spara anslaget')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#20c58f]" />
            <h2 className="text-sm font-semibold text-white">{post ? 'Redigera anslag' : 'Nytt anslag'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Rubrik</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="T.ex. Ny prislista gäller från 1 september"
              required
              className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Innehåll</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Skriv anslaget. Tomrad ger nytt stycke."
              required
              rows={6}
              className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-y"
            />
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={pinned}
              onChange={e => setPinned(e.target.checked)}
              className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
            />
            <div>
              <span className="text-sm font-medium text-slate-300">Fäst överst</span>
              <p className="text-xs text-slate-500">Anslaget ligger kvar högst upp tills det avfästs</p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] hover:bg-[#1ab37e] disabled:opacity-60 text-[#fff] rounded-lg text-sm font-semibold transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {post ? 'Spara ändringar' : 'Publicera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
