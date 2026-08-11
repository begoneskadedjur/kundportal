// src/pages/shared/intranet/intranetShared.tsx
// Delade småkomponenter och hjälpare för intranätets undersidor

import { Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, ChevronRight, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  INTRANET_CATEGORY_CONFIG,
  INTRANET_SLUG_ICONS,
  estimateReadingMinutes,
  type IntranetDocumentWithStatus,
} from '../../../types/intranet'
import type { Profile } from '../../../contexts/AuthContext'

/** Kan användaren posta anslag? (admin eller koordinator, inkl. extraroller) */
export function canPostAnnouncements(profile: Profile | null): boolean {
  if (!profile) return false
  const roles = new Set<string>([profile.role || ''])
  if (profile.is_admin) roles.add('admin')
  for (const r of profile.extra_roles || []) roles.add(r)
  return roles.has('admin') || roles.has('koordinator')
}

/** Relativ svensk tid: "idag", "igår", "för 3 dagar sedan", annars datum */
export function relativeDate(iso: string): string {
  const then = new Date(iso)
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days <= 0) return 'idag'
  if (days === 1) return 'igår'
  if (days < 7) return `för ${days} dagar sedan`
  return then.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

/** Sektionshuvud med räknare och valfri åtgärd till höger */
export function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  count,
  action,
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  count?: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h2>
        {typeof count === 'number' && (
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-800 border border-slate-700 text-slate-400">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  )
}

/** Tyngre dokumentkort för policys (statuslist överst, version + datum synligt) */
export function DocumentCard({
  doc,
  basePath,
  index = 0,
}: {
  doc: IntranetDocumentWithStatus
  basePath: string
  index?: number
}) {
  const config = INTRANET_CATEGORY_CONFIG[doc.category]
  const Icon = INTRANET_SLUG_ICONS[doc.slug] || config.icon
  const needsAck = doc.requires_acknowledgement && !doc.currentAck
  const isUpdated = needsAck && !!doc.latestAck
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Link
        to={`${basePath}/intranat/dokument/${doc.slug}`}
        className="group block rounded-xl border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600 transition-all overflow-hidden"
      >
        <div className={`h-1 ${doc.currentAck ? 'bg-[#20c58f]' : doc.requires_acknowledgement ? 'bg-amber-500' : 'bg-slate-700'}`} />
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white group-hover:text-[#20c58f] transition-colors leading-snug">
                {doc.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{doc.summary}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className={`px-2 py-0.5 font-medium rounded-full ${config.bgColor} ${config.color}`}>{config.label}</span>
            <span className="text-slate-500">Version {doc.version}</span>
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3 h-3" />
              {estimateReadingMinutes(doc.content)} min
            </span>
            <span className="ml-auto">
              {doc.currentAck ? (
                <span className="flex items-center gap-1 font-medium text-[#20c58f]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Kvitterad
                </span>
              ) : doc.requires_acknowledgement ? (
                <span className="flex items-center gap-1 font-medium text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {isUpdated ? 'Uppdaterad - kvittera igen' : 'Ej kvitterad'}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

/** Lättare guidekort för Handbok */
export function GuideDocCard({
  doc,
  basePath,
  index = 0,
}: {
  doc: IntranetDocumentWithStatus
  basePath: string
  index?: number
}) {
  const config = INTRANET_CATEGORY_CONFIG[doc.category]
  const Icon = INTRANET_SLUG_ICONS[doc.slug] || config.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Link
        to={`${basePath}/intranat/dokument/${doc.slug}`}
        className="group flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all min-h-[88px]"
      >
        <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-white group-hover:text-[#20c58f] transition-colors">{doc.title}</h3>
            {doc.currentAck && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[#20c58f]/15 text-[#20c58f] rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Läst
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 line-clamp-2 mt-0.5">{doc.summary}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#20c58f] group-hover:translate-x-1 transition-all flex-shrink-0" />
      </Link>
    </motion.div>
  )
}
