import React, { useState, useEffect } from 'react'
import { Calendar, Phone, MapPin, ChevronRight, ChevronDown, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { Link } from 'react-router-dom'

interface ScheduleCase {
  id: string
  title: string
  status: string
  case_type: 'private' | 'business'
  start_date: string | null
  kontaktperson: string | null
  telefon_kontaktperson: string | null
  adress: any
  skadedjur: string | null
  work_started_at: string | null
  time_spent_minutes: number | null
  company_name?: string | null
}

interface Props {
  technicianId: string
}

function formatAddress(address: any): string {
  if (!address) return ''
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address
  if (typeof address === 'string') {
    try { const p = JSON.parse(address); return p.formatted_address || address } catch { return address }
  }
  return ''
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function CaseRow({ c, index }: { c: ScheduleCase; index: number }) {
  const addr = formatAddress(c.adress)
  const isActive = !!c.work_started_at && !c.time_spent_minutes

  return (
    <motion.div
      key={c.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 px-3 py-3 bg-slate-900/50 border border-slate-700/30 rounded-lg"
    >
      {/* Time */}
      <div className="shrink-0 w-12 text-center">
        {c.start_date ? (
          <span className="font-mono text-sm font-bold text-white">{formatTime(c.start_date)}</span>
        ) : (
          <span className="text-xs text-slate-500">Obestämd</span>
        )}
        {isActive && (
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#20c58f] animate-pulse" />
            <span className="text-[10px] text-[#20c58f] font-medium">Aktiv</span>
          </div>
        )}
      </div>

      {/* Divider line */}
      <div className="w-px h-10 bg-slate-700 shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-white truncate">
            {c.kontaktperson || c.company_name || 'Okänd kund'}
          </span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            c.case_type === 'business' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            {c.case_type === 'business' ? 'Ftg' : 'Priv'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
          {c.skadedjur && <span>{c.skadedjur}</span>}
          {addr && (
            <span className="truncate max-w-[180px]">{addr}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {c.telefon_kontaktperson && (
          <a
            href={`tel:${c.telefon_kontaktperson}`}
            className="p-2.5 text-slate-400 hover:text-[#20c58f] hover:bg-slate-700/50 rounded-lg transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        {addr && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <MapPin className="w-4 h-4" />
          </a>
        )}
      </div>
    </motion.div>
  )
}

export default function TodayScheduleCard({ technicianId }: Props) {
  const [cases, setCases] = useState<ScheduleCase[]>([])
  const [tomorrowCases, setTomorrowCases] = useState<ScheduleCase[]>([])
  const [showTomorrow, setShowTomorrow] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTodaysCases()
  }, [technicianId])

  const fetchTodaysCases = async () => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const dayAfter = new Date(now)
    dayAfter.setDate(dayAfter.getDate() + 2)
    const dayAfterStr = dayAfter.toISOString().slice(0, 10)

    const selectFields = 'id, title, status, start_date, kontaktperson, telefon_kontaktperson, adress, skadedjur, work_started_at, time_spent_minutes'

    try {
      // Today's cases (exclude completed/closed)
      const [privToday, bizToday] = await Promise.allSettled([
        supabase.from('private_cases').select(selectFields)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', today).lt('start_date', tomorrowStr)
          .is('deleted_at', null)
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
        supabase.from('business_cases').select(`${selectFields}, company_name`)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', today).lt('start_date', tomorrowStr)
          .is('deleted_at', null)
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
      ])

      const todayCases: ScheduleCase[] = [
        ...(privToday.status === 'fulfilled' ? privToday.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'private' as const })),
        ...(bizToday.status === 'fulfilled' ? bizToday.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'business' as const })),
      ].sort((a, b) => {
        if (!a.start_date) return 1
        if (!b.start_date) return -1
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      })

      setCases(todayCases)

      // Tomorrow's cases — full data for expandable list (exclude completed/closed)
      const [privTmrw, bizTmrw] = await Promise.allSettled([
        supabase.from('private_cases').select(selectFields)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', tomorrowStr).lt('start_date', dayAfterStr)
          .is('deleted_at', null)
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
        supabase.from('business_cases').select(`${selectFields}, company_name`)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', tomorrowStr).lt('start_date', dayAfterStr)
          .is('deleted_at', null)
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
      ])

      const tmrwCases: ScheduleCase[] = [
        ...(privTmrw.status === 'fulfilled' ? privTmrw.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'private' as const })),
        ...(bizTmrw.status === 'fulfilled' ? bizTmrw.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'business' as const })),
      ].sort((a, b) => {
        if (!a.start_date) return 1
        if (!b.start_date) return -1
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      })

      setTomorrowCases(tmrwCases)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">Dagens schema</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">Dagens schema</h3>
          <span className="px-1.5 py-0.5 bg-[#20c58f]/20 text-[#20c58f] text-xs font-medium rounded-full">
            {cases.length}
          </span>
        </div>
        <Link to="/technician/schedule" className="text-xs text-[#20c58f] font-medium hover:underline">
          Fullständigt schema
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="py-6 text-center">
          <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Inga bokade ärenden idag</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c, i) => (
            <CaseRow key={c.id} c={c} index={i} />
          ))}
        </div>
      )}

      {/* Tomorrow — expandable */}
      {tomorrowCases.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-700/50">
          <button
            type="button"
            onClick={() => setShowTomorrow(!showTomorrow)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">
                Imorgon: <span className="text-white font-medium">{tomorrowCases.length} ärenden</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/technician/schedule"
                className="text-[10px] text-slate-500 hover:text-[#20c58f] transition-colors mr-1"
                onClick={e => e.stopPropagation()}
              >
                Schema
              </Link>
              {showTomorrow ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#20c58f] transition-colors" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#20c58f] transition-colors" />
              )}
            </div>
          </button>

          <AnimatePresence>
            {showTomorrow && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mt-2.5">
                  {tomorrowCases.map((c, i) => (
                    <CaseRow key={c.id} c={c} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* No tomorrow cases */}
      {tomorrowCases.length === 0 && (
        <Link
          to="/technician/schedule"
          className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-700/50 group"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">
              Imorgon: <span className="text-white font-medium">Inga ärenden</span>
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#20c58f] transition-colors" />
        </Link>
      )}
    </div>
  )
}
