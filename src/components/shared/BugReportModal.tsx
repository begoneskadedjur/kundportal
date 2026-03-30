// src/components/shared/BugReportModal.tsx

import { useState, useRef } from 'react'
import { X, Bug, Send, ImagePlus, Loader2, ChevronRight, Clock, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { BugReportService } from '../../services/bugReportService'
import { BUG_STATUS_CONFIG } from '../../types/bugReport'
import type { BugReport } from '../../types/bugReport'

interface BugReportModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'new' | 'mine'

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<Tab>('new')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [myReports, setMyReports] = useState<BugReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Rubrik och beskrivning krävs')
      return
    }
    if (!user) return

    setLoading(true)
    const userName = profile?.full_name || user.email || 'Okänd'
    const userRole = profile?.role || 'okänd'

    const { error } = await BugReportService.create(
      { title: title.trim(), description: description.trim(), url: url.trim() || undefined, image: image ?? undefined },
      user.id,
      userName,
      user.email ?? '',
      userRole
    )
    setLoading(false)

    if (error) {
      toast.error('Kunde inte skicka rapporten')
      return
    }

    toast.success('Tack för din buggrapport!')
    setTitle('')
    setDescription('')
    setUrl('')
    handleRemoveImage()
    onClose()
  }

  const handleLoadMine = async () => {
    setTab('mine')
    setLoadingReports(true)
    const reports = await BugReportService.getOwn()
    setMyReports(reports)
    setLoadingReports(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-400" />
            <span className="text-white font-semibold text-sm">Buggrapportering</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab('new')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'new' ? 'text-[#20c58f] border-b-2 border-[#20c58f]' : 'text-slate-400 hover:text-white'}`}
          >
            Ny rapport
          </button>
          <button
            onClick={handleLoadMine}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'mine' ? 'text-[#20c58f] border-b-2 border-[#20c58f]' : 'text-slate-400 hover:text-white'}`}
          >
            Mina rapporter
          </button>
        </div>

        {/* Content */}
        {tab === 'new' ? (
          <div className="p-4 space-y-3">
            {/* Rubrik */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Rubrik *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Beskriv buggen kort..."
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
              />
            </div>

            {/* Beskrivning */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Beskrivning *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Vad hände? Hur reproducerar man buggen?"
                rows={3}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-none"
              />
            </div>

            {/* URL */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">URL <span className="text-slate-600">(valfritt)</span></label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
              />
            </div>

            {/* Bild */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Skärmdump <span className="text-slate-600">(valfritt)</span></label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-40 rounded-lg border border-slate-700 object-contain" />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 border-dashed rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-sm"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>Välj bild</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-700/50 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !title.trim() || !description.trim()}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#20c58f] hover:bg-[#1aad7d] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Skicka rapport
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {loadingReports ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Du har inga rapporter ännu</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {myReports.map(r => {
                  const cfg = BUG_STATUS_CONFIG[r.status]
                  return (
                    <div key={r.id} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white text-sm font-medium leading-snug">{r.title}</p>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bgClass} ${cfg.textClass}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 text-slate-500 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(r.created_at).toLocaleDateString('sv-SE')}</span>
                      </div>
                      {r.description && (
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{r.description}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="pt-3 border-t border-slate-700/50 mt-3">
              <button
                onClick={() => setTab('new')}
                className="flex items-center gap-1 text-[#20c58f] text-sm hover:underline"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Skapa ny rapport
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
