import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Clock, FileX, CalendarX } from 'lucide-react'

export interface AlertItem {
  id: string
  type: 'error' | 'warning'
  icon: React.ElementType
  label: string
}

interface AlertsBannerProps {
  alerts: AlertItem[]
  onDismiss: (id: string) => void
}

const colorMap = {
  error: 'bg-red-500/15 border-red-500/30 text-red-300',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
}

const AlertsBanner: React.FC<AlertsBannerProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => {
          const Icon = alert.icon
          return (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${colorMap[alert.type]}`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{alert.label}</span>
              <button
                onClick={() => onDismiss(alert.id)}
                className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default AlertsBanner
export { AlertTriangle, Clock, FileX, CalendarX }
