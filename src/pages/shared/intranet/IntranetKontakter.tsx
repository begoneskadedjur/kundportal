// src/pages/shared/intranet/IntranetKontakter.tsx
// Kontakter: personkort för alla medarbetare + ansvarsmatris (vem gör vad)

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Briefcase, Phone, Mail, AlertCircle, RefreshCw } from 'lucide-react'
import { IntranetService } from '../../../services/intranetService'
import type { IntranetContact, IntranetResponsibility } from '../../../types/intranet'
import { SectionHeader } from './intranetShared'

const ROLE_BADGES: Record<string, string> = {
  'Admin': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'Koordinator': 'bg-green-500/10 text-green-400 border-green-500/30',
  'Skadedjurstekniker': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  'Säljare': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
}

export default function IntranetKontakter() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<IntranetContact[]>([])
  const [responsibilities, setResponsibilities] = useState<IntranetResponsibility[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [contactsData, respData] = await Promise.all([
        IntranetService.getContacts(),
        IntranetService.getResponsibilities(),
      ])
      setContacts(contactsData)
      setResponsibilities(respData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda kontakterna')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-28 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-10 bg-slate-800/30 border border-slate-700 rounded-xl">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm text-slate-400 mb-3">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] text-[#fff] rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Försök igen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Ansvarsmatris */}
      <section className="space-y-3">
        <SectionHeader icon={Briefcase} iconColor="text-[#20c58f]" title="Vem gör vad?" count={responsibilities.length} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {responsibilities.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl"
            >
              <p className="text-sm font-semibold text-white">{r.area}</p>
              {r.description && <p className="text-xs text-slate-400 mt-1">{r.description}</p>}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                <span className="w-7 h-7 rounded-full bg-[#20c58f]/15 text-[#20c58f] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.person_name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{r.person_name}</p>
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="text-xs text-slate-400 hover:text-[#20c58f] truncate block">
                      {r.email}
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Medarbetare */}
      <section className="space-y-3">
        <SectionHeader icon={Users} iconColor="text-cyan-400" title="Medarbetare" count={contacts.length} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contacts.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#fff] text-sm font-bold">{c.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full border mt-0.5 ${ROLE_BADGES[c.role] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {c.role}
                  </span>
                </div>
              </div>
              <div className="space-y-1 mt-3 pt-3 border-t border-slate-700/50">
                {c.direct_phone && (
                  <a href={`tel:${c.direct_phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-[#20c58f] transition-colors">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    {c.direct_phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-[#20c58f] transition-colors truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Kontorets växel: <a href="tel:0102051600" className="text-[#20c58f] hover:underline">010-205 16 00</a>.
        Fel i kontaktuppgifterna? Ändra under Användarkonton (Personal) eller kontakta administratören.
      </p>
    </div>
  )
}
