// src/components/procurement/ProcurementNotificationBell.tsx
// Notisklocka i den fristående upphandlingsportalen. Visar bara notiser med
// case_type 'procurement' (nya träffar, påminnelser, tilldelningar, att man
// blivit upphandlingsansvarig). Klick öppnar upphandlingen inne i portalen.
// Hämtas om var femte minut och när fliken får fokus; ingen realtid, tabellen
// notifications ligger inte i supabase_realtime-publikationen.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { procurementPath } from '../../lib/procurementPortal'
import { fmtDate } from '../admin/procurement/uiFormat'

interface ProcurementNotification {
  id: string
  case_id: string | null
  title: string
  preview: string | null
  case_title: string | null
  is_read: boolean
  created_at: string
}

const LIMIT = 15

export function ProcurementNotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ProcurementNotification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    const [list, count] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, case_id, title, preview, case_title, is_read, created_at')
        .eq('recipient_id', user.id)
        .eq('case_type', 'procurement')
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('case_type', 'procurement')
        .eq('is_read', false),
    ])
    if (!list.error) setItems((list.data ?? []) as ProcurementNotification[])
    if (!count.error) setUnread(count.count ?? 0)
  }, [user?.id])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5 * 60 * 1000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids)
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)))
    setUnread((u) => Math.max(0, u - ids.length))
  }

  const openItem = (n: ProcurementNotification) => {
    setOpen(false)
    if (!n.is_read) void markRead([n.id])
    navigate(procurementPath(n.case_id ? `/${n.case_id}` : ''))
  }

  const markAll = async () => {
    if (!user?.id) return
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('case_type', 'procurement')
      .eq('is_read', false)
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void load()
        }}
        className={`relative p-2 rounded-lg transition-colors ${open ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
        aria-label={`Notiser${unread > 0 ? ` (${unread} olästa)` : ''}`}
        title="Notiser"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#20c58f] text-[#fff] text-[10px] font-semibold rounded-full flex items-center justify-center tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(24rem,calc(100vw-2rem))] bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Notiser</span>
            {unread > 0 && (
              <button type="button" onClick={() => void markAll()} className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-[#20c58f]">
                <CheckCheck className="w-3.5 h-3.5" />
                Markera alla som lästa
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-slate-500">Inga notiser ännu.</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className="w-full text-left px-4 py-2.5 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.is_read ? 'bg-slate-700' : 'bg-[#20c58f]'}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] leading-snug ${n.is_read ? 'text-slate-300' : 'text-slate-100 font-medium'}`}>{n.title}</div>
                        {n.case_title && <div className="text-[12px] text-slate-400 truncate">{n.case_title}</div>}
                        {n.preview && <div className="text-[12px] text-slate-500 line-clamp-2">{n.preview}</div>}
                        <div className="text-[11px] text-slate-600 tabular-nums mt-0.5">{fmtDate(n.created_at)}</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
