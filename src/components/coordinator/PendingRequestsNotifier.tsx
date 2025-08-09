// src/components/coordinator/PendingRequestsNotifier.tsx - Diskret notifikation för väntande ärenden
import React, { useState, useEffect } from 'react'
import { Bell, AlertCircle } from 'lucide-react'
import { usePendingCases } from '../../hooks/usePendingCases'
import PendingRequestsModal from './PendingRequestsModal'
import { Case } from '../../types/cases'

interface PendingRequestsNotifierProps {
  onScheduleClick: (caseItem: Case) => void
  className?: string
}

const PendingRequestsNotifier: React.FC<PendingRequestsNotifierProps> = ({ 
  onScheduleClick,
  className = ''
}) => {
  const { totalCount, urgentCount, refresh } = usePendingCases()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Animate when new requests come in
  useEffect(() => {
    if (totalCount > 0) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [totalCount])

  // Don't render if no pending cases
  if (totalCount === 0) {
    return null
  }

  return (
    <>
      {/* Floating notification button */}
      <button
        onClick={() => {
          console.log('Notifier clicked, opening modal...');
          setIsModalOpen(true);
        }}
        className={`
          fixed bottom-8 right-8 z-40
          bg-slate-800 hover:bg-slate-700 
          border border-slate-700 hover:border-emerald-500
          text-white rounded-full 
          px-4 py-3 
          shadow-lg hover:shadow-emerald-500/25 
          transition-all duration-300 
          flex items-center gap-3
          group cursor-pointer
          ${isAnimating ? 'animate-bounce' : ''}
          ${urgentCount > 0 ? 'ring-2 ring-red-500/50 animate-pulse' : ''}
          ${className}
        `}
        title="Visa väntande förfrågningar"
      >
        <div className="relative">
          <Bell className="w-5 h-5" />
          {urgentCount > 0 && (
            <span className="absolute -top-2 -right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="font-medium">{totalCount} väntande</span>
          {urgentCount > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              {urgentCount} akut
            </span>
          )}
        </div>

        {/* Hover tooltip */}
        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Klicka för att visa förfrågningar
        </span>
      </button>

      {/* Compact notification bar (alternative to floating button) */}
      <div className={`
        fixed top-16 left-1/2 -translate-x-1/2 z-40
        bg-slate-900 border border-slate-800
        rounded-lg shadow-lg
        px-4 py-2
        flex items-center gap-3
        cursor-pointer
        hover:bg-slate-800
        transition-all duration-300
        ${isAnimating ? 'scale-105' : ''}
        ${className}
      `}
        onClick={() => setIsModalOpen(true)}
        style={{ display: 'none' }} // Hidden by default, can be enabled if preferred over floating button
      >
        <AlertCircle className={`w-4 h-4 ${urgentCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
        <span className="text-sm text-white">
          {totalCount} förfrågan{totalCount > 1 ? 'ar' : ''} väntar på schemaläggning
        </span>
        {urgentCount > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            {urgentCount} brådskande
          </span>
        )}
      </div>

      {/* Modal */}
      <PendingRequestsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          refresh() // Refresh data when closing
        }}
        onScheduleClick={onScheduleClick}
      />
    </>
  )
}

export default PendingRequestsNotifier