// src/components/coordinator/CoordinatorHelpSection.tsx
// Hjälp- och guide-sektion för koordinatorportalen - listbaserad design

import { Link } from 'react-router-dom'
import {
  HelpCircle,
  ChevronRight,
  Trash2,
  CalendarDays,
  Wand2
} from 'lucide-react'
import { motion } from 'framer-motion'
import Card from '../ui/Card'

// Typ för guide-items
interface GuideItem {
  id: string
  title: string
  description: string
  icon: React.ElementType
  iconColor: string
  iconBgColor: string
  path: string
  isNew?: boolean
}

// Lista med tillgängliga guider för koordinatorer
const guides: GuideItem[] = [
  {
    id: 'case-deletion',
    title: 'Radera vs Slaska ärenden',
    description: 'När och hur du avbryter ärenden - och varför du aldrig ska radera',
    icon: Trash2,
    iconColor: 'text-red-400',
    iconBgColor: 'bg-red-500/20',
    path: '/koordinator/guides/case-deletion',
    isNew: true
  },
  {
    id: 'scheduling-tips',
    title: 'Schemaläggning',
    description: 'Tips för effektiv schemaläggning och optimering av teknikerrutter',
    icon: CalendarDays,
    iconColor: 'text-blue-400',
    iconBgColor: 'bg-blue-500/20',
    path: '/koordinator/schema',
    isNew: false
  },
  {
    id: 'booking-assistant',
    title: 'Schemaoptimeraren',
    description: 'Hur du använder AI-assistenten för att optimera bokningar',
    icon: Wand2,
    iconColor: 'text-purple-400',
    iconBgColor: 'bg-purple-500/20',
    path: '/koordinator/booking-assistant',
    isNew: false
  }
]

export default function CoordinatorHelpSection() {
  return (
    <Card className="p-6">
      {/* Rubrik med ikon */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Guider och Hjälp</h2>
          <p className="text-sm text-slate-400">Steg-för-steg instruktioner</p>
        </div>
      </div>

      {/* Guidelista */}
      <div className="space-y-2">
        {guides.map((guide, index) => (
          <motion.div
            key={guide.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={guide.path}
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all group"
            >
              {/* Ikon */}
              <div className={`w-12 h-12 rounded-xl ${guide.iconBgColor} flex items-center justify-center flex-shrink-0`}>
                <guide.icon className={`w-6 h-6 ${guide.iconColor}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                    {guide.title}
                  </h3>
                  {guide.isNew && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                      Ny
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 truncate">
                  {guide.description}
                </p>
              </div>

              {/* Pil */}
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Footer med kontaktinfo */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <p className="text-sm text-slate-500 text-center">
          Hittar du inte det du söker? Kontakta IT-support för hjälp.
        </p>
      </div>
    </Card>
  )
}
