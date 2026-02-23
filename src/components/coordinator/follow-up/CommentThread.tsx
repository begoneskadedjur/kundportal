// src/components/coordinator/follow-up/CommentThread.tsx
// Visa och skapa kommentarer på Oneflow-kontrakt
import { useState, useEffect } from 'react'
import { MessageSquare, Send, Lock, Globe, Loader2 } from 'lucide-react'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import toast from 'react-hot-toast'

interface OneflowComment {
  id: number
  body: string
  created_time: string
  private: boolean
  parent_id: number | null
  participants?: {
    sender?: { participant_name: string; party_name: string }
    recipients?: { participant_name: string; party_name: string }[]
  }
}

interface CommentThreadProps {
  contractId: string
  senderEmail?: string
}

export function CommentThread({ contractId, senderEmail }: CommentThreadProps) {
  const [comments, setComments] = useState<OneflowComment[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await OfferFollowUpService.getComments(contractId)
      setComments(data.data || [])
    } catch (err: any) {
      setError('Kunde inte ladda kommentarer')
      console.error('Comment fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchComments() }, [contractId])

  const handleSend = async () => {
    if (!newComment.trim()) return
    setSending(true)
    try {
      await OfferFollowUpService.postComment(contractId, newComment.trim(), {
        isPrivate,
        senderEmail,
      })
      setNewComment('')
      toast.success('Kommentar skickad')
      fetchComments()
    } catch (err) {
      toast.error('Kunde inte skicka kommentar')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Laddar kommentarer...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {comments.length === 0 && !error && (
        <p className="text-xs text-slate-500 py-2">Inga kommentarer</p>
      )}

      {/* Kommentarlista */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {comments.map(c => (
          <div key={c.id} className={`p-2.5 rounded-lg text-sm ${c.parent_id ? 'ml-6' : ''} ${c.private ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-800/50 border border-slate-700/50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-white text-xs">
                {c.participants?.sender?.participant_name || 'Okänd'}
              </span>
              <span className="text-[10px] text-slate-500">
                {new Date(c.created_time).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              {c.private && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                  <Lock className="w-2.5 h-2.5" /> Intern
                </span>
              )}
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      {/* Skriv ny kommentar */}
      <div className="flex gap-2 items-end pt-1">
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Skriv en kommentar..."
            rows={2}
            className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend()
            }}
          />
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${isPrivate ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400'}`}
            >
              {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
              {isPrivate ? 'Intern' : 'Extern'}
            </button>
            <span className="text-[10px] text-slate-600">Ctrl+Enter för att skicka</span>
          </div>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !newComment.trim()}
          className="p-2 bg-[#20c58f] hover:bg-[#1bb07f] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
